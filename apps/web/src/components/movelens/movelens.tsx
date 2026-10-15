"use client";

import { ArrowLeft, ArrowRight, StickyNote, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Board } from "@/components/report/board";
import {
  conclusion, evalText, fig, hasPosition, maiaSentence, moveText, pct, qwenSentence, readings, statSentence, statWhy, tieCaveat,
  type MLData, type MLExample, type MLPosition, type ReganChecks, type TopMove,
} from "@/lib/movelens";
import { cn } from "@/lib/utils";
import { Checks } from "./checks";
import { WholeGame } from "./game";
import { Details, KV, SectionShell } from "./ui";

const SECTIONS = [
  { id: "statistical", n: 1, short: "Statistical Model",
    notes: "First I wanted to understand what a classical statistical approach sees. The position is converted into measurable evidence, and the model estimates whether the move is expected or unusual." },
  { id: "qwen", n: 2, short: "Qwen3-8B",
    notes: "Next I wanted to see whether a general-purpose language model has its own move preference. Qwen sees the same position and candidate moves, but it is not a chess-specific human model." },
  { id: "maia", n: 3, short: "Maia-3 79M",
    notes: "Maia gives us a very useful control. It was specifically trained to predict human chess moves and can condition on playing strength." },
  { id: "compare", n: 4, short: "Compare",
    notes: "The interesting part is not asking which model wins. It is asking where they disagree and whether those differences contain complementary information." },
  { id: "game", n: 5, short: "Whole game",
    notes: "One move proves nothing. The statistical idea is projected versus actual over a whole game; here is how the z-score grows as engine moves are substituted, and how little subtle substitutes move it." },
] as const;

const DISCLAIMER_REGAN = "This is an independent reconstruction based on publicly documented ideas and is not Professor Regan's production analyzer.";

/* ------------------------------------------------------------------------------------------- small pieces */

function Fact({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">{k}</div>
      <div className="num fig mt-0.5 text-[20px] font-semibold text-ink">{v}</div>
    </div>
  );
}

function PositionBoard({ p, id, arrows }: { p: MLPosition; id: string; arrows?: { uci: string; color: string }[] }) {
  return (
    <div className="min-w-0">
      <Board id={id} fen={p.fen} orientation={p.color} arrows={arrows ?? [{ uci: p.played, color: "var(--ink)" }]} />
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-rule pt-3">
        <Fact k="Played move" v={moveText(p, p.played_san)} />
        <Fact k="Player Elo" v={p.elo} />
        <Fact k="Move" v={`${p.move_no} · ${p.color === "white" ? "White" : "Black"}`} />
      </div>
    </div>
  );
}

function Badge({ kind }: { kind: "precomputed" | "local-qwen" | "not-evaluated" }) {
  const text = kind === "precomputed" ? "Precomputed result" : kind === "local-qwen" ? "Precomputed Qwen3-8B result" : "Not yet evaluated";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.06em] uppercase",
      kind === "not-evaluated" ? "border-dashed border-rule-strong text-ink-3" : "border-rule-strong bg-paper text-ink-2")}>{text}</span>
  );
}

/** Reveals a list of steps one by one after the button is pressed (explanation of a precomputed result, not a loading delay). */
function useReveal(n: number, resetKey: string) {
  const [shown, setShown] = useState(0);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const [key, setKey] = useState(resetKey);
  if (key !== resetKey) { setKey(resetKey); setShown(0); }
  const run = useCallback(() => {
    timers.current.forEach(clearTimeout);
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setShown(n); return; }
    setShown(1);
    timers.current = Array.from({ length: n - 1 }, (_, i) => window.setTimeout(() => setShown(i + 2), 420 * (i + 1)));
  }, [n]);
  return { shown, run, done: shown >= n };
}

function StepList({ steps, shown }: { steps: { title: string; body: React.ReactNode }[]; shown: number }) {
  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => (
        <li key={s.title} className={cn("grid grid-cols-[1.75rem_1fr] gap-3 transition-opacity duration-300", i < shown ? "opacity-100" : "opacity-0")} aria-hidden={i >= shown}>
          <span className="num flex size-7 items-center justify-center rounded-full border border-ink text-[12.5px] font-semibold text-ink">{i + 1}</span>
          <div className="pt-0.5">
            <div className="text-[14.5px] font-semibold text-ink">{s.title}</div>
            <div className="mt-0.5 text-[14px] leading-relaxed text-ink-2">{s.body}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function RunButton({ onClick, done, children }: { onClick: () => void; done: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex items-center gap-2 rounded-md bg-ink px-5 py-2.5 text-[14.5px] font-semibold text-paper transition-opacity hover:opacity-90">
      {done ? "Run again" : children} <ArrowRight className="size-4" aria-hidden />
    </button>
  );
}

function Verdict({ children }: { children: React.ReactNode }) {
  return <p className="mt-5 border-l-[3px] border-ink pl-4 font-serif text-[26px] leading-snug font-bold text-ink">{children}</p>;
}

function TopList({ items, played, label }: { items: TopMove[]; played: string; label: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">{label}</div>
      <ol className="mt-1.5 divide-y divide-rule rounded-md border border-rule bg-paper">
        {items.map((t) => (
          <li key={t.move} className={cn("flex items-center justify-between gap-3 px-3 py-2 text-[15px]", t.move === played && "bg-paper-2")}>
            <span className="num"><span className="mr-2 text-ink-3">#{t.rank}</span><span className="fig font-semibold text-ink">{fig(t.san)}</span>
              {t.move === played && <span className="ml-2 rounded bg-ink px-1.5 py-px text-[10px] font-semibold tracking-wide text-paper uppercase">played</span>}</span>
            <span className="num text-ink-2">{pct(t.p)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const twoCol = "grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:gap-14";

/* ------------------------------------------------------------------------------------------- 1. statistical */

function Statistical({ p, data }: { p: MLPosition; data: MLData }) {
  const s = p.statistical, f = s.features;
  const steps = [
    { title: "Position received", body: <>FEN, side to move ({p.color}), player Elo {p.elo} vs {p.opp_elo}.</> },
    { title: "Features extracted", body: <>Stockfish evaluation {evalText(f.eval_before_cp)}; gap between the best two moves {f.gap12_cp} cp; {f.near_optimal_moves} near-optimal moves (within 25 cp); {f.legal_moves} legal moves; evaluation swing {f.eval_swing_cp} cp; {f.phase}.</> },
    { title: "Statistical evidence evaluated", body: <>Difficulty {s.difficulty.toFixed(2)} (0 = easy, 1 = hard). For this rating and difficulty, players chose Stockfish&apos;s first move <b className="text-ink">{pct(s.p_t1)}</b> of the time and a top-3 move {pct(s.p_t3)}; expected loss {s.expected_loss_cp.toFixed(0)} cp.</> },
    { title: "Played move compared", body: <><span className="fig">{fig(p.played_san)}</span>: {p.stockfish.played_rank ? `Stockfish's #${p.stockfish.played_rank} line${p.stockfish.played_loss_cp ? `, ${p.stockfish.played_loss_cp} cp below the best` : ""}` : "not among Stockfish's top 5 lines"}. {s.engine_match ? "Engine match." : "No engine match."}</> },
    { title: "Final score", body: <>Probability the model gave to what actually happened: <b className="text-ink">{pct(s.p_observed_outcome)}</b>.</> },
  ];
  const { shown, run, done } = useReveal(steps.length, p.position_id);
  return (
    <SectionShell id="statistical" n={1} title="Statistical Model" sub="Can historical and engine-derived evidence tell us whether a move is unusual?">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <h3 className="text-[12px] font-semibold tracking-[0.08em] text-ink-3 uppercase">How it works</h3>
          <ol className="mt-3 space-y-2 text-[15px] leading-relaxed text-ink-2">
            <li><b className="text-ink">1.</b> Stockfish 19 evaluates the position&apos;s best five moves.</li>
            <li><b className="text-ink">2.</b> The position is described by measurable features: rating, evaluation, gap between the best moves, number of near-optimal moves, number of legal moves.</li>
            <li><b className="text-ink">3.</b> A model fitted on thousands of human decisions from training games estimates how hard the position is, i.e. how often a player of this rating finds the engine&apos;s first move.</li>
            <li><b className="text-ink">4.</b> A table of rating band × difficulty gives the expected behavior: chance of the engine&apos;s first move, of a top-3 move, expected loss.</li>
            <li><b className="text-ink">5.</b> The played move is compared with that expectation. Over a whole game, observed and expected engine matches give a z-score.</li>
          </ol>
        </div>
        <p className="self-start rounded-md border border-rule bg-paper-2 p-4 text-[14px] leading-relaxed text-ink-2">
          <b className="text-ink">Note.</b> {DISCLAIMER_REGAN} It uses no k-nearest-neighbor search; &ldquo;similar positions&rdquo; means the same rating band and difficulty decile of the training data.
        </p>
      </div>

      <div className={cn(twoCol, "mt-12")}>
        <PositionBoard p={p} id="board-stat" arrows={[{ uci: p.played, color: "var(--ink)" }, ...(p.stockfish.lines[0].move !== p.played ? [{ uci: p.stockfish.lines[0].move, color: "var(--engine)" }] : [])]} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3"><RunButton onClick={run} done={done}>Run statistical analysis</RunButton><Badge kind="precomputed" /></div>
          <p className="mt-2 text-[12.5px] text-ink-3">Black arrow: played move. Blue arrow: Stockfish&apos;s first choice (<span className="fig">{fig(p.stockfish.lines[0].san)}</span>).</p>
          <div className="mt-6"><StepList steps={steps} shown={shown} /></div>
          {done && (<>
            <Verdict>{statSentence(p)}</Verdict>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{statWhy(p)}</p>
            {tieCaveat(p) && <p className="mt-2 text-[14px] leading-relaxed text-ink-3">{tieCaveat(p)}</p>}
          </>)}
          <Details>
            <KV rows={[
              ["Reading rule", `${data.label_rule.quantity}: unusual below ${pct(data.label_rule.unusual_below, 0)}, somewhat unexpected below ${pct(data.label_rule.somewhat_unexpected_below, 0)}, otherwise expected (presentation thresholds, not a test)`],
              ["Implementation", `${data.models.statistical.method} (${data.models.statistical.code})`],
              ["Engine", `${data.models.stockfish.version}, depth ${data.models.stockfish.depth}, MultiPV ${data.models.stockfish.multipv}, ${data.models.stockfish.threads} thread`],
              ["Stockfish lines", p.stockfish.lines.map((l, i) => `#${i + 1} ${fig(l.san)} ${evalText(l.cp)}`).join(" · ")],
              ["Projected P(top-3 move)", pct(s.p_t3)],
              ["Whole game", s.game_z_t1_original != null ? `this player's original game: z(top-1) = ${s.game_z_t1_original >= 0 ? "+" : "−"}${Math.abs(s.game_z_t1_original).toFixed(2)} over all eligible decisions` : "—"],
              ["Position", p.position_id],
            ]} />
          </Details>
        </div>
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------------------------------- 2. qwen */

function FlowBox({ title, items, strong }: { title: string; items?: string[]; strong?: boolean }) {
  return (
    <div className={cn("rounded-md border bg-paper px-4 py-3", strong ? "border-ink" : "border-rule-strong")}>
      <div className="text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">{strong ? "Model" : title}</div>
      {strong ? <div className="mt-0.5 font-serif text-[20px] font-semibold text-ink">{title}</div> :
        <ul className="mt-1 space-y-0.5 text-[14px] text-ink-2">{(items ?? []).map((i) => <li key={i}>{i}</li>)}</ul>}
    </div>
  );
}

function Flow({ input, model, output }: { input: string[]; model: string; output: string[] }) {
  return (
    <div className="max-w-md">
      <FlowBox title="Input" items={input} />
      <div aria-hidden className="py-1 text-center text-ink-3">↓</div>
      <FlowBox title={model} strong />
      <div aria-hidden className="py-1 text-center text-ink-3">↓</div>
      <FlowBox title="Output" items={output} />
    </div>
  );
}

function Qwen({ p, data, echo }: { p: MLPosition; data: MLData; echo?: EchoRow }) {
  const q = p.qwen;
  const rt = data.models.qwen.runtime;
  const steps = [
    { title: "Position", body: <>{p.color === "white" ? "White" : "Black"} to move, {p.n_legal} legal moves.</> },
    { title: "Prompt construction", body: <>A fixed text template: both ratings, side to move, the FEN, Stockfish&apos;s top-5 evaluations and all legal moves. The played move is never marked.</> },
    { title: "Qwen evaluation", body: <>Each legal move is appended as the answer; Qwen&apos;s log-probability of every token of that move is summed.</> },
    { title: "Move ranking", body: q ? <>Scores normalized over the {p.n_legal} legal moves; the human move is #{q.played_rank}.</> : <>Not yet evaluated for this position.</> },
  ];
  const { shown, run, done } = useReveal(steps.length, p.position_id + "q");
  return (
    <SectionShell id="qwen" n={2} title="Qwen3-8B" sub="Can a general-purpose language model express a useful preference over chess moves?">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4 text-[16px] leading-relaxed text-ink-2">
          <p className="font-serif text-[21px] leading-snug text-ink">Qwen is not a chess engine. I give it a structured description of the position and score every legal candidate move.</p>
          <p>Nothing is generated and Qwen is never asked for a verdict. For each legal move, I measure how likely Qwen finds that move as the next piece of text, then normalize these likelihoods over the legal moves into a ranking.</p>
          <p className="text-[14px] text-ink-3">The model is Qwen3-8B-Base, the base (non-chat) checkpoint, pinned to one revision. Note that the prompt includes Stockfish&apos;s top-5 evaluations, the same engine evidence the statistical model uses.</p>
        </div>
        <Flow input={["Chess position (FEN)", "player and opponent Elo", "Stockfish top-5 evaluations", "all legal moves"]} model="Qwen3-8B-Base" output={["score for every legal move", "ranked candidate moves"]} />
      </div>

      <div className={cn(twoCol, "mt-12")}>
        <PositionBoard p={p} id="board-qwen" arrows={[{ uci: p.played, color: "var(--ink)" }, ...(q && q.top3[0].move !== p.played ? [{ uci: q.top3[0].move, color: "var(--llm)" }] : [])]} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3"><RunButton onClick={run} done={done}>Ask Qwen</RunButton><Badge kind={q ? "local-qwen" : "not-evaluated"} /></div>
          {q && <p className="mt-2 text-[12.5px] text-ink-3">Black arrow: played move. Red arrow: Qwen&apos;s first choice. No live inference runs in this page.</p>}
          <div className="mt-6"><StepList steps={steps} shown={shown} /></div>
          {done && (q ? (
            <div className="mt-5 space-y-4">
              <TopList items={q.top3} played={p.played} label="Qwen's top three" />
              {q.played_rank > 3 && <p className="text-[15px] text-ink-2">Human move <b className="num fig text-ink">{fig(p.played_san)}</b>: #{q.played_rank} of {p.n_legal}, {pct(q.played_p)}.</p>}
              <Verdict>{qwenSentence(p)}</Verdict>
              {echo && (
                <p className="text-[14.5px] leading-relaxed text-ink-2">
                  <b className="text-ink">Same prompt without Stockfish&apos;s lines:</b> Qwen&apos;s top move becomes{" "}
                  <span className="fig font-semibold text-ink">{fig(echo.position_only.top_san)}</span> and the human move is #{echo.position_only.played_rank} of {p.n_legal}
                  {echo.position_only.played_rank === q.played_rank ? " (unchanged)" : ` (instead of #${q.played_rank})`}. Across the seven demo positions Qwen&apos;s ranking shifts strongly when the engine numbers are removed;{" "}
                  <a href="#checks" className="underline underline-offset-2">see the check in section 6</a>.
                </p>
              )}
            </div>
          ) : (
            <p role="status" className="mt-5 rounded-md border border-dashed border-rule-strong bg-paper-2 p-4 text-[15px] leading-relaxed text-ink-2">
              <b className="text-ink">Not yet evaluated.</b> Qwen3-8B-Base has not scored this position, so no ranking is shown and nothing is estimated in its place.
            </p>
          ))}
          <Details>
            <KV rows={[
              ["Model", `${data.models.qwen.model_id} @ ${data.models.qwen.revision.slice(0, 12)}`],
              ["Prompt", `frozen template, SHA-256 ${data.models.qwen.prompt_hash.slice(0, 16)}…`],
              ["Candidate text", "“ <uci>\\n” appended after “Move:”; every token's log-probability summed (no length normalization)"],
              ["Normalization", "softmax over the legal moves"],
              ["Temperature / sampling", "none: nothing is generated"],
              ["This result", q && rt ? `precomputed locally (${rt.hardware}, bf16, candidate batch ${rt.candidate_batch}); scope: ${data.models.qwen.scope}; consistency vs full-sequence scoring ${rt.consistency_check ? rt.consistency_check.max_abs_diff_nats.toExponential(1) + " nats" : "—"}` : "not yet evaluated"],
              ["Held-out evaluation", "not yet run (needs a cloud GPU); no accuracy or AUC exists for Qwen"],
              ["Caveat", "the prompt contains Stockfish's evaluations; section 6 shows how Qwen's ranking changes without them"],
              ...(q ? [["Played move score", `log-prob ${q.played_logprob.toFixed(2)} over ${q.played_n_tokens} tokens`] as [string, string]] : []),
            ]} />
            <details className="mt-3"><summary className="cursor-pointer text-[12.5px] underline decoration-dotted underline-offset-2">Show the exact prompt for this position</summary>
              <pre className="mt-2 max-h-72 overflow-auto rounded border border-rule bg-paper p-2 text-[11.5px] leading-snug whitespace-pre-wrap">{p.qwen_prompt}</pre>
            </details>
          </Details>
        </div>
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------------------------------- 3. maia */

function Maia({ p, data }: { p: MLPosition; data: MLData }) {
  const m = p.maia;
  const steps = [
    { title: "Position + rating", body: <>Board, up to seven previous positions, player {p.elo} vs opponent {p.opp_elo}.</> },
    { title: "Maia-3 79M", body: <>A Chessformer-based transformer trained on human games across skill levels.</> },
    { title: "Human move distribution", body: <>A probability for each of the {p.n_legal} legal moves.</> },
  ];
  const { shown, run, done } = useReveal(steps.length, p.position_id + "m");
  return (
    <SectionShell id="maia" n={3} title="Maia-3 79M" sub="What would a human of this strength most likely play?">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4 text-[16px] leading-relaxed text-ink-2">
          <p className="font-serif text-[21px] leading-snug text-ink">Maia-3 is a chess transformer designed specifically to predict human moves across skill levels.</p>
          <p>It is not a language model. Because it is conditioned on the players&apos; ratings, it can say what a 1200 or a 2000 player would typically do in the same position, which is exactly the reference I need for human behavior.</p>
          <p className="rounded-md border border-rule bg-paper-2 p-4 text-ink">Unlike Stockfish, Maia is not trying to find the strongest possible move. It is trying to model what a human player is likely to do.</p>
        </div>
        <Flow input={["Position", "player rating", "move history (up to 7 previous positions)"]} model="Maia-3 79M" output={["human move probability distribution"]} />
      </div>

      <div className={cn(twoCol, "mt-12")}>
        <PositionBoard p={p} id="board-maia" arrows={[{ uci: p.played, color: "var(--ink)" }, ...(m.top3[0].move !== p.played ? [{ uci: m.top3[0].move, color: "var(--human)" }] : [])]} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3"><RunButton onClick={run} done={done}>Ask Maia</RunButton><Badge kind="precomputed" /></div>
          <p className="mt-2 text-[12.5px] text-ink-3">Black arrow: played move. Green arrow: Maia&apos;s most likely move.</p>
          <div className="mt-6"><StepList steps={steps} shown={shown} /></div>
          {done && (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Fact k="Player Elo" v={p.elo} />
                <Fact k="Maia's top move" v={fig(m.top3[0].san)} />
                <Fact k="Played move" v={`${pct(m.played_p)}`} />
                <Fact k="Played rank" v={`#${m.played_rank} of ${p.n_legal}`} />
              </div>
              <TopList items={m.top3} played={p.played} label="Maia's top three for this rating" />
              <Verdict>{maiaSentence(p)}</Verdict>
            </div>
          )}
          <Details label="Why not Stockfish?">
            Stockfish is optimized for objective playing strength. Maia is optimized for modeling human move behavior. Stockfish is still used here as the objective reference: engine rank, evaluation and the controlled engine substitutions.
          </Details>
          <Details>
            <KV rows={[
              ["Checkpoint", `${data.models.maia.checkpoint} @ ${data.models.maia.revision.slice(0, 12)}`],
              ["Paper", "Monroe et al., “Chessformer: A Unified Architecture for Chess Modeling”, ICLR 2026"],
              ["Output used", "softmax of the policy over all legal moves"],
              ["Entropy", `${m.entropy.toFixed(2)} nats`],
            ]} />
          </Details>
        </div>
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------------------------------- 4. compare */

function Card({ title, rows, meaning, reading }: { title: string; rows: [string, React.ReactNode][]; meaning: string; reading: { word: string; typical: boolean | null } }) {
  return (
    <div className="flex flex-col rounded-lg border border-rule-strong bg-paper p-5">
      <div className="text-[12px] font-semibold tracking-[0.08em] text-ink-3 uppercase">{title}</div>
      <dl className="mt-3 space-y-1.5">
        {rows.map(([k, v]) => <div key={k} className="flex items-baseline justify-between gap-3 text-[15px]"><dt className="text-ink-3">{k}</dt><dd className="num text-right font-semibold text-ink">{v}</dd></div>)}
      </dl>
      <p className="mt-3 text-[13.5px] text-ink-3 italic">{meaning}</p>
      <div className={cn("mt-auto pt-4 font-serif text-[22px] leading-tight font-bold", reading.typical === null ? "text-ink-3" : "text-ink")}>{reading.word}</div>
    </div>
  );
}

function Compare({ p }: { p: MLPosition }) {
  const r = readings(p);
  return (
    <SectionShell id="compare" n={4} title="Same move. Three interpretations." sub="The same position, the same played move, three different questions.">
      <div className={twoCol}>
        <PositionBoard p={p} id="board-compare" />
        <div className="min-w-0">
          <div className="grid gap-3 md:grid-cols-3">
            <Card title="Statistical model" reading={r.stat} meaning="How unusual is this statistically?"
              rows={[["Played move", fig(p.played_san)], ["Engine match", p.statistical.engine_match ? "yes" : "no"], ["Model expected this", pct(p.statistical.p_observed_outcome)]]} />
            <Card title="Qwen3-8B" reading={r.qwen} meaning="What does the general LLM prefer?"
              rows={p.qwen ? [["Played move rank", `#${p.qwen.played_rank} of ${p.n_legal}`], ["Score", pct(p.qwen.played_p)]] : [["Played move rank", "—"], ["Score", "—"]]} />
            <Card title="Maia-3 79M" reading={r.maia} meaning="How plausible is it for a human of this rating?"
              rows={[["Probability", pct(p.maia.played_p)], ["Rank", `#${p.maia.played_rank} of ${p.n_legal}`]]} />
          </div>
          <div className="mt-5 rounded-md border border-rule bg-paper-2 p-4">
            <div className="text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Agreement / disagreement</div>
            <ul className="mt-2 space-y-1 text-[15px] text-ink-2">
              <li><span className="inline-block w-36 text-ink-3">Statistical model:</span> <b className="text-ink">{r.stat.word}</b></li>
              <li><span className="inline-block w-36 text-ink-3">Qwen:</span> <b className={r.qwen.typical === null ? "text-ink-3" : "text-ink"}>{r.qwen.word}</b></li>
              <li><span className="inline-block w-36 text-ink-3">Maia:</span> <b className="text-ink">{r.maia.word}</b></li>
              <li className="pt-1 text-[13.5px] text-ink-3">Stockfish (reference): {p.stockfish.played_rank ? `the played move is its #${p.stockfish.played_rank} line` : "the played move is not in its top 5 lines"}; its first choice is <span className="fig">{fig(p.stockfish.lines[0].san)}</span>.</li>
            </ul>
            <p className="mt-3 font-serif text-[23px] leading-snug font-bold text-ink">{conclusion(p)}</p>
          </div>
        </div>
      </div>

      <div className="mt-16 rounded-xl border-2 border-ink bg-paper p-6 sm:p-8">
        <div className="text-[12px] font-semibold tracking-[0.08em] text-ink-3 uppercase">So what am I actually testing?</div>
        <p className="mt-2 font-serif text-[24px] leading-snug font-semibold text-ink sm:text-[30px]">
          Does the LLM contain useful information that is not already captured by classical statistical evidence or a specialized human chess model?
        </p>
        <p className="mt-4 max-w-3xl text-[16.5px] leading-relaxed text-ink-2">
          Each model provides a different signal. The research question is whether combining those signals gives us additional information.
        </p>
      </div>
    </SectionShell>
  );
}

function Limitations() {
  return (
    <section aria-labelledby="limits" className="border-t border-rule py-12">
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
        <h2 id="limits" className="font-serif text-[22px] font-semibold text-ink">Important limitations</h2>
        <ul className="mt-3 grid gap-x-10 gap-y-1.5 text-[14.5px] leading-relaxed text-ink-2 md:grid-cols-2">
          <li>This is not Professor Regan&apos;s production cheating detector.</li>
          <li>A strong or engine-like move is not proof of cheating.</li>
          <li>Maia predicts human behavior, not misconduct.</li>
          <li>Qwen is a general-purpose language model, not a chess cheating detector.</li>
          <li>Controlled substitutions are experimental proxies.</li>
          <li>Model disagreement is evidence for analysis, not accusation.</li>
        </ul>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
          <Link href="/methodology" className="text-ink underline underline-offset-4">Methods</Link>
          <Link href="/results" className="text-ink underline underline-offset-4">View full results</Link>
          <Link href="/methodology#repro" className="text-ink underline underline-offset-4">View provenance</Link>
          <Link href="/about" className="text-ink-2 underline underline-offset-4">Earlier detailed views</Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------- page */

function ExamplePicker({ examples, idx, setIdx }: { examples: MLExample[]; idx: number; setIdx: (i: number) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Choose an example position">
      <span className="mr-1 text-[12px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Position</span>
      {examples.map((e, i) => {
        const ok = hasPosition(e);
        return (
          <button key={e.role} type="button" disabled={!ok} aria-pressed={i === idx} onClick={() => setIdx(i)}
            title={ok ? e.rule : "Not yet evaluated: needs Qwen3-8B scores"}
            className={cn("rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors",
              i === idx ? "border-ink bg-ink text-paper" : "border-rule-strong bg-paper text-ink-2 hover:border-ink-3",
              !ok && "cursor-not-allowed border-dashed text-ink-4 hover:border-rule-strong")}>
            Example {i + 1} · {e.title}{!ok && " (not yet evaluated)"}
          </button>
        );
      })}
    </div>
  );
}

type EchoRow = Extract<ReganChecks["qwen_ablation"], { status: "precomputed-local" }>["rows"][number];

function echoFor(c: ReganChecks, pid: string): EchoRow | undefined {
  return c.qwen_ablation.status === "precomputed-local" ? c.qwen_ablation.rows.find((r) => r.position_id === pid) : undefined;
}

/** Scale of the study, computed from the exported checks file (no number typed by hand). */
function StudyScale({ c }: { c: ReganChecks }) {
  const variants = c.screening.rows.filter((r) => r.strategy !== "none").reduce((a, r) => a + r.n, 0);
  const items: [string, string][] = [
    [c.calibration.n.toLocaleString(), "held-out human decisions"],
    [c.clean_z.n.toLocaleString(), "held-out player-games"],
    [variants.toLocaleString(), "controlled engine-assisted variants"],
    ["3 + 1", "models + Stockfish 19 reference"],
  ];
  return (
    <dl className="mt-8 grid max-w-4xl grid-cols-2 gap-x-6 gap-y-4 border-y border-rule py-5 sm:grid-cols-4">
      {items.map(([n, l]) => (
        <div key={l}>
          <dt className="sr-only">{l}</dt>
          <dd className="num text-[26px] leading-none font-semibold text-ink">{n}</dd>
          <dd className="mt-1.5 text-[12.5px] leading-snug text-ink-3">{l}</dd>
        </div>
      ))}
    </dl>
  );
}

const CARDS = [
  { glyph: "♖", title: "Statistical model", q: "How unusual does the move look from historical and engine-derived evidence?", href: "#statistical" },
  { glyph: "♘", title: "Qwen3-8B", q: "What move does a general-purpose language model prefer?", href: "#qwen" },
  { glyph: "♙", title: "Maia-3 79M", q: "What move would a human of this rating most likely play?", href: "#maia" },
];

/** Progress as a rank of board squares: filled squares are the steps already shown. */
function SquareProgress({ n, at, go }: { n: number; at: number; go: (k: number) => void }) {
  return (
    <ol className="mt-2.5 flex gap-1" aria-label="Demo progress">
      {Array.from({ length: n }, (_, k) => (
        <li key={k} className="flex-1">
          <button type="button" onClick={() => go(k)} aria-label={`Go to step ${k + 1}: ${SECTIONS[k].short}`} aria-current={k === at ? "step" : undefined}
            className={cn("h-3 w-full rounded-[2px] border transition-colors", k <= at ? "border-[var(--board-dark)] bg-[var(--board-dark)]" : "border-rule-strong bg-[var(--board-light)]")} />
        </li>
      ))}
    </ol>
  );
}

export function MoveLens({ data, checks }: { data: MLData; checks: ReganChecks }) {
  const examples = data.examples;
  const [idx, setIdx] = useState(0);
  const [demo, setDemo] = useState(false);
  const [step, setStep] = useState(0);
  const [notes, setNotes] = useState(false);
  const ex = examples[idx];
  const p = hasPosition(ex) ? ex : (examples.find(hasPosition) as MLPosition);
  const first = examples[0];
  const exampleOneGame = hasPosition(first) && first.position_id.startsWith(checks.game.game_id + ":");

  const go = useCallback((k: number) => {
    const s = Math.max(0, Math.min(SECTIONS.length - 1, k));
    setStep(s);
    try { window.history.replaceState(null, "", `#${SECTIONS[s].id}`); } catch { /* ignore */ }
    window.scrollTo({ top: 0 });
  }, []);
  const start = () => { setDemo(true); setStep(0); setNotes(false); try { window.history.replaceState(null, "", `#${SECTIONS[0].id}`); } catch { /* ignore */ } window.scrollTo({ top: 0 }); };
  const exit = useCallback((to?: string) => {
    setDemo(false);
    try { window.history.replaceState(null, "", to ? `/#${to}` : "/"); } catch { /* ignore */ }
    requestAnimationFrame(() => {
      const el = to ? document.getElementById(to) : null;
      if (el) el.scrollIntoView(); else window.scrollTo({ top: 0 });
    });
  }, []);

  useEffect(() => {
    if (!demo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(step + 1);
      if (e.key === "ArrowLeft") go(step - 1);
      if (e.key === "Escape") exit();
    };
    const onHash = () => {
      const k = SECTIONS.findIndex((s) => `#${s.id}` === window.location.hash);
      if (k >= 0) setStep(k); else if (window.location.hash === "#checks") exit("checks");
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("hashchange", onHash);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("hashchange", onHash); };
  }, [demo, step, go, exit]);

  const sections = [
    <Statistical key="s" p={p} data={data} />, <Qwen key="q" p={p} data={data} echo={echoFor(checks, p.position_id)} />, <Maia key="m" p={p} data={data} />,
    <Compare key="c" p={p} />, <WholeGame key="g" checks={checks} exampleOneGame={exampleOneGame} />,
  ];

  if (demo) {
    const s = SECTIONS[step];
    const last = step === SECTIONS.length - 1;
    return (
      <main className="flex-1">
        <div className="sticky top-14 z-30 border-b border-rule bg-paper/95 backdrop-blur">
          <div className="mx-auto max-w-[1180px] px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-baseline gap-3"><span className="num text-[13px] font-semibold text-ink">{step + 1} / {SECTIONS.length}</span><span className="font-serif text-[22px] leading-none font-bold text-ink">{s.short}</span></div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setNotes((n) => !n)} aria-pressed={notes} className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12.5px] font-medium", notes ? "border-ink bg-ink text-paper" : "border-rule-strong text-ink-2 hover:border-ink-3")}>
                  <StickyNote className="size-3.5" aria-hidden /> Presenter notes
                </button>
                <button type="button" onClick={() => go(step - 1)} disabled={step === 0} className="inline-flex items-center gap-1 rounded-md border border-rule-strong px-2.5 py-1 text-[12.5px] font-medium text-ink-2 enabled:hover:border-ink-3 disabled:opacity-40"><ArrowLeft className="size-3.5" aria-hidden /> Previous</button>
                {!last
                  ? <button type="button" onClick={() => go(step + 1)} className="inline-flex items-center gap-1 rounded-md bg-ink px-3 py-1 text-[12.5px] font-semibold text-paper hover:opacity-90">Next <ArrowRight className="size-3.5" aria-hidden /></button>
                  : <button type="button" onClick={() => exit("checks")} className="inline-flex items-center gap-1 rounded-md bg-ink px-3 py-1 text-[12.5px] font-semibold text-paper hover:opacity-90">Finish: open the checks <ArrowRight className="size-3.5" aria-hidden /></button>}
                <button type="button" onClick={() => exit()} aria-label="Exit demo" className="rounded-md p-1 text-ink-3 hover:text-ink"><X className="size-4" aria-hidden /></button>
              </div>
            </div>
            <SquareProgress n={SECTIONS.length} at={step} go={go} />
            {notes && <p role="note" className="mt-3 max-w-3xl border-l-[3px] border-ink bg-paper-2 px-3 py-2 text-[14.5px] leading-relaxed text-ink">{s.notes}</p>}
            {step < 4 && <div className="mt-3"><ExamplePicker examples={examples} idx={idx} setIdx={setIdx} /></div>}
          </div>
        </div>
        {sections[step]}
        {step === 3 && <Limitations />}
      </main>
    );
  }

  return (
    <main className="flex-1">
      <section className="relative overflow-hidden">
        <div aria-hidden className="board-pattern pointer-events-none absolute -top-10 right-[-120px] hidden h-[520px] w-[560px] opacity-[0.10] [mask-image:radial-gradient(closest-side,black,transparent)] lg:block" />
        <div className="relative mx-auto max-w-[1180px] px-4 pt-16 pb-14 sm:px-6 sm:pt-24 sm:pb-20">
          <div className="text-[12px] font-semibold tracking-[0.16em] text-ink-3 uppercase">A research prototype · held-out Lichess games</div>
          <h1 className="mt-3 font-serif text-[64px] leading-[0.95] font-bold tracking-tight text-ink sm:text-[104px]">MoveLens</h1>
          <p className="mt-4 font-serif text-[28px] leading-snug text-ink-2 italic sm:text-[38px]">Three ways to understand a chess move.</p>
          <p className="mt-2 text-[14.5px] text-ink-3">Statistics, language models, and human chess behavior on the same positions.</p>
          <p className="mt-8 max-w-3xl text-[18px] leading-relaxed text-ink sm:text-[20px]">
            I take the same chess position and study it using a statistical model, a general-purpose language model, and a state-of-the-art human chess model.
          </p>
          <StudyScale c={checks} />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {CARDS.map((c) => (
              <a key={c.title} href={c.href} className="group relative overflow-hidden rounded-lg border border-rule-strong bg-paper p-6 transition-colors hover:border-ink-3">
                <span aria-hidden className="fig pointer-events-none absolute -right-2 -bottom-6 text-[96px] leading-none text-ink/[0.07] transition-colors group-hover:text-ink/[0.12]">{c.glyph}</span>
                <div className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.1em] text-ink-3 uppercase"><span aria-hidden className="fig text-[18px] text-ink">{c.glyph}</span>{c.title}</div>
                <p className="relative mt-3 font-serif text-[23px] leading-snug font-semibold text-ink">{c.q}</p>
              </a>
            ))}
          </div>
          <p className="mt-9 text-center font-serif text-[26px] text-ink italic">Same position. Three different views.</p>
          <div className="mt-7 flex justify-center">
            <button type="button" onClick={start} className="inline-flex items-center gap-3 rounded-lg bg-ink px-8 py-4 text-[17px] font-semibold text-paper transition-opacity hover:opacity-90">
              <span aria-hidden className="fig text-[22px] leading-none">♘</span> Start the 7-minute demo <ArrowRight className="size-5" aria-hidden />
            </button>
          </div>
          <p className="mx-auto mt-10 max-w-3xl text-center text-[12.5px] leading-relaxed text-ink-3">
            MoveLens is an independent research prototype. Its statistical model is reconstructed from publicly documented concepts and is not Professor Kenneth W. Regan&apos;s production cheating-detection system.
          </p>
        </div>
      </section>
      <div className="sticky top-14 z-20 border-y border-rule bg-paper/95 backdrop-blur">
        <div className="mx-auto max-w-[1180px] px-4 py-2.5 sm:px-6"><ExamplePicker examples={examples} idx={idx} setIdx={setIdx} /></div>
      </div>
      {sections.slice(0, 4)}
      <Limitations />
      {sections[4]}
      <Checks c={checks} />
    </main>
  );
}
