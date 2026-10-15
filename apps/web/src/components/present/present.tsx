"use client";

import { ArrowLeft, ArrowRight, ChevronRight, Clock, Hourglass, StickyNote } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ExamplePanel, OneMoveExplained, arrowsOf, type CuratedData } from "@/components/three/examples";
import { ThreeBoard } from "@/components/three/atoms";
import { REGAN_DISCLAIMER } from "@/components/three/summary";
import { explainPosition } from "@/lib/explain";
import { fmtPct, fmtNum, isNum, moveLabel } from "@/lib/format";
import { MODEL_META, candidateOf, featuredPosition, topMove, type MovePrediction, type ThreeDemo, type ThreePosition } from "@/lib/three";
import { cn } from "@/lib/utils";

export interface PairedBootstrap {
  n_boot: number; n_clusters: number; n_rows: number; n_positive_rows: number; n_player_games: number;
  comparisons: { from: string; to: string; delta: number; ci95: [number, number] }[];
}

export interface PresentData {
  demo: ThreeDemo;
  curated: CuratedData;
  paired: PairedBootstrap;
  mp: MovePrediction;
  hybridE: { status?: string; reason?: string };
}

const STEPS: { title: string; minutes: number; notes: string }[] = [
  { title: "Can an LLM add anything beyond chess statistics?", minutes: 1, notes: "Explain that the question is incremental information, not which model wins. Maia is a human-behavior control and is not an LLM." },
  { title: "What does each model actually measure?", minutes: 1.5, notes: "Emphasize engine quality and human plausibility are different concepts; the three signals are not expected to agree." },
  { title: "One position, three views", minutes: 2.5, notes: "Focus on one disagreement before discussing aggregate statistics. Qwen is pending: say so plainly and point to the label." },
  { title: "From one example to a controlled experiment", minutes: 1.5, notes: "Explain the controlled substitution experiment and held-out evaluation. Bootstrap unit is the source game, not the move." },
  { title: "Does Qwen add anything new?", minutes: 2, notes: "Emphasize B → D as the core Qwen research question. The full Qwen evaluation has not produced results; the completed Maia result is a different transition." },
  { title: "What have we learned?", minutes: 1.5, notes: "State verified results conservatively and distinguish completed Maia results from the pending Qwen evaluation. End on the takeaway." },
];

const pct = (x: number | null | undefined, d = 1) => (isNum(x) ? (x < 0.001 ? "<0.1%" : fmtPct(x, d)) : "—");

function Box({ title, sub, model, className }: { title: string; sub: string; model?: "R" | "Q" | "M"; className?: string }) {
  const color = model ? MODEL_META[model].color : "var(--ink-3)";
  return (
    <div className={cn("flex-1 rounded-lg border bg-paper px-4 py-3", className)} style={{ borderColor: `color-mix(in oklab, ${color} 55%, var(--rule))`, borderTopWidth: 3 }}>
      <div className="text-[15px] font-semibold text-ink">{title}</div>
      <div className="mt-0.5 text-[13.5px] leading-snug text-ink-2">{sub}</div>
    </div>
  );
}

function Down() {
  return <div aria-hidden className="py-1 text-center text-[20px] leading-none text-ink-3">↓</div>;
}

function Pending({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="flex items-start gap-2 rounded-md border border-dashed border-rule-strong bg-paper-2 px-3 py-2.5 text-[14px] leading-relaxed text-ink-2">
      <Hourglass className="mt-1 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

/* ----------------------------------------------------------------------------------------------- steps */

function Step1() {
  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-3xl">
        <Box title="Same chess position" sub="One real decision from a held-out game" />
        <Down />
        <div className="grid gap-3 md:grid-cols-3">
          <Box model="R" title="Statistical baseline" sub="Engine / statistical evidence" />
          <Box model="M" title="Maia-3" sub="Human move plausibility" />
          <Box model="Q" title="Qwen3-8B" sub="LLM move preference" />
        </div>
        <Down />
        <Box title="Compare + combine" sub="Same positions, same held-out evaluation" />
        <Down />
        <div className="rounded-lg border-2 border-ink bg-paper px-4 py-3 text-center font-serif text-[22px] font-semibold text-ink">Does Qwen add signal?</div>
      </div>
      <p className="mx-auto max-w-3xl rounded-md bg-paper-2 p-4 text-[16px] leading-relaxed text-ink-2">
        <span className="font-semibold text-ink">Maia-3 is not an LLM.</span> It is a chess-specific, rating-conditioned human-move transformer, used here as a
        <span className="font-semibold text-ink"> human-behavior control</span>: it tells us how much of Qwen&apos;s preference is simply &ldquo;what humans play&rdquo;.
        The question is not which model is best; it is whether Qwen carries information the other two do not.
      </p>
    </div>
  );
}

function Card({ model, q, signals, foot }: { model: "R" | "Q" | "M"; q: string; signals: string[]; foot: string }) {
  const m = MODEL_META[model];
  return (
    <article className="flex flex-col rounded-lg border bg-paper p-5" style={{ borderColor: `color-mix(in oklab, ${m.color} 50%, var(--rule))`, borderTopWidth: 4 }}>
      <div className="text-[12px] font-semibold tracking-[0.08em] uppercase" style={{ color: m.color }}>{model === "R" ? "Statistical baseline" : m.name}</div>
      <h3 className="mt-2 font-serif text-[21px] leading-snug font-semibold text-ink">{q}</h3>
      <div className="mt-3 text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Signals</div>
      <ul className="mt-1 space-y-1 text-[15px] text-ink-2">
        {signals.map((s) => <li key={s} className="flex gap-2"><span aria-hidden style={{ color: m.color }}>•</span>{s}</li>)}
      </ul>
      <p className="mt-auto border-t border-rule pt-3 text-[14px] font-medium text-ink">{foot}</p>
    </article>
  );
}

function Step2() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card model="R" q="How unusual is the move according to engine-derived evidence?" signals={["Stockfish rank", "centipawn loss", "best-move agreement", "evaluation gap", "position complexity"]} foot="Measures objective chess / statistical evidence" />
        <Card model="M" q="How plausible is this move for a human of this rating?" signals={["human move probability", "human move rank", "rating conditioning"]} foot="Measures human move plausibility" />
        <Card model="Q" q="What move does a general-purpose language model prefer?" signals={["candidate likelihood", "move ranking", "normalized LLM preference"]} foot="Measures LLM-derived move preference" />
      </div>
      <p className="mx-auto max-w-3xl rounded-lg border-2 border-ink bg-paper px-5 py-4 text-center font-serif text-[22px] leading-snug font-semibold text-ink">
        These signals should not necessarily agree because they measure different things.
      </p>
    </div>
  );
}

function Col({ model, title, rows, text, children }: { model: "R" | "Q" | "M"; title: string; rows: [string, React.ReactNode][]; text?: string; children?: React.ReactNode }) {
  const m = MODEL_META[model];
  return (
    <div className="flex min-w-0 flex-col rounded-lg border bg-paper p-4" style={{ borderColor: `color-mix(in oklab, ${m.color} 50%, var(--rule))`, borderTopWidth: 4 }}>
      <div className="text-[12px] font-semibold tracking-[0.08em] uppercase" style={{ color: m.color }}>{title}</div>
      {children}
      <dl className="mt-2 space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 text-[15px]">
            <dt className="text-ink-3">{k}</dt><dd className="text-right font-semibold text-ink num">{v}</dd>
          </div>
        ))}
      </dl>
      {text && <p className="mt-3 border-t border-rule pt-2.5 text-[13.5px] leading-relaxed text-ink-2">{text}</p>}
    </div>
  );
}

export function PositionThreeViews({ p, qwenOk }: { p: ThreePosition; qwenOk: boolean }) {
  const c = candidateOf(p, p.original_move);
  const sf1 = p.sf_lines[0];
  const mTop = topMove(p, "M");
  const e = explainPosition(p, qwenOk);
  const statText = c?.sf_rank === 1
    ? `The human played Stockfish's first choice; the baseline projected a ${pct(p.regan.p_t1)} chance of that for a player of this rating in a position of this difficulty.`
    : `Not Stockfish's first choice (${sf1.san}). The baseline projects only a ${pct(p.regan.p_t1)} chance that a player of this rating plays the engine's first move here. It gives no per-move probability.`;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:gap-8">
        <div>
          <ThreeBoard id="present-board" fen={p.fen} orientation={p.color}
            arrows={[{ uci: p.original_move, color: "var(--ink)", label: `Human played: ${c?.san}` }, ...(sf1.move !== p.original_move ? [{ uci: sf1.move, color: "var(--engine)", label: `Stockfish's first line: ${sf1.san}` }] : [])]} />
        </div>
        <div className="min-w-0 space-y-4">
          <dl className="grid grid-cols-3 gap-3 rounded-lg border border-rule-strong bg-paper p-4 text-center">
            <div><dt className="text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Player rating</dt><dd className="num mt-1 text-[22px] font-semibold text-ink">{p.elo}</dd></div>
            <div><dt className="text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Move number</dt><dd className="num mt-1 text-[22px] font-semibold text-ink">{p.move_no}{p.color === "black" ? "…" : "."}</dd></div>
            <div><dt className="text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Human played</dt><dd className="num mt-1 text-[22px] font-semibold text-ink">{moveLabel(p.move_no, p.color, c?.san ?? p.original_san)}</dd></div>
          </dl>
          <div className="grid gap-3 md:grid-cols-3">
            <Col model="R" title="Statistical" rows={[["Engine rank", c?.sf_rank ? `#${c.sf_rank}` : "outside top 5"], ["Projected P(engine #1)", pct(p.regan.p_t1)]]} text={statText} />
            <Col model="M" title="Maia-3" rows={[["Rank", `#${c?.maia_rank} of ${p.n_legal}`], ["Probability", pct(c?.maia)]]}
              text={`A player rated ${p.elo} is expected to play ${mTop?.san} (${pct(mTop?.maia)}) most often; the human move ${mTop?.move === p.original_move ? "is that move" : `is Maia's #${c?.maia_rank}`}.`} />
            {qwenOk ? (
              <Col model="Q" title="Qwen3-8B" rows={[["Rank", `#${c?.qwen_rank} of ${p.n_legal}`], ["Probability", pct(c?.qwen)]]} text={e.qwen} />
            ) : (
              <Col model="Q" title="Qwen3-8B" rows={[["Rank", "—"], ["Probability", "—"]]} text="Not part of the held-out Qwen evaluation yet (not run); nothing is estimated here. A demo-scope local Qwen score for this position is on the MoveLens home page.">
                <div className="mt-2 inline-block self-start rounded border border-dashed border-rule-strong bg-paper-2 px-2 py-1 text-[11.5px] font-semibold tracking-[0.06em] text-ink-2 uppercase">Qwen evaluation pending</div>
              </Col>
            )}
          </div>
        </div>
      </div>
      <div className="rounded-lg bg-paper-2 p-4">
        <h3 className="font-serif text-[20px] font-semibold text-ink">Why is this interesting?</h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15.5px] leading-relaxed text-ink-2">
          {[...e.agree, ...e.disagree].map((s) => <li key={s}>{s}</li>)}
        </ul>
        <p className="mt-3 font-serif text-[19px] font-semibold text-ink">The disagreement is the signal we want to study.</p>
      </div>
      <p className="text-[12px] text-ink-3">Source: PRECOMPUTED research output (prepared_three_model_demo.json): Stockfish 19 depth 12 MultiPV 5, Maia-3 79M, the reconstruction&apos;s projection. Position {p.position_id}, held-out test split.</p>
    </div>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="rounded-lg border border-rule-strong bg-paper px-4 py-3 text-center">
      <div className="num font-serif text-[30px] leading-none font-semibold text-ink">{n}</div>
      <div className="mt-1.5 text-[13px] text-ink-2">{label}</div>
    </div>
  );
}

function Step4({ d }: { d: PresentData }) {
  const b = d.paired;
  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-3xl">
        <Box title="Held-out human games" sub="Split by source game; no game or player crosses train / validation / test" />
        <Down />
        <div className="grid gap-3 md:grid-cols-2">
          <Box title="Original human moves" sub="Presumed human; the natural examples" />
          <Box title="Controlled engine-assisted substitutions" sub="Selected human decisions replaced by Stockfish lines, evaluated in the original positions" className="border-flag" />
        </div>
        <Down />
        <Box title="Evaluate all systems on the same positions" sub="ROC-AUC with source-game bootstrap intervals" />
      </div>
      <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-4">
        <Stat n={b.n_clusters.toLocaleString()} label="source games" />
        <Stat n={b.n_player_games.toLocaleString()} label="original player-games" />
        <Stat n={b.n_positive_rows.toLocaleString()} label="controlled variants" />
        <Stat n={b.n_boot.toLocaleString()} label="bootstrap resamples" />
      </div>
      <p className="mx-auto max-w-3xl text-[16.5px] leading-relaxed text-ink-2">
        <span className="font-semibold text-ink">Confidence intervals are clustered by source game</span> because moves from the same game are not independent.
        Differences between systems are paired: the same resampled games are used for both, with no refitting.
      </p>
      <p className="mx-auto max-w-3xl text-[12px] text-ink-3">Source: PRECOMPUTED research artifact paired_bootstrap.json ({b.n_rows.toLocaleString()} held-out test rows = {(b.n_rows - b.n_positive_rows).toLocaleString()} originals + {b.n_positive_rows.toLocaleString()} variants). Substitutions are decision-level counterfactuals; games are not replayed.</p>
    </div>
  );
}

function Feature({ children, tone }: { children: React.ReactNode; tone: "R" | "M" | "Q" }) {
  return <span className="rounded border px-1.5 py-0.5 text-[12px] font-medium" style={{ borderColor: `color-mix(in oklab, ${MODEL_META[tone].color} 55%, var(--rule))`, color: MODEL_META[tone].color }}>{children}</span>;
}

function AblationCard({ letter, name, parts }: { letter: string; name: string; parts: ("R" | "M" | "Q")[] }) {
  const label = { R: "Statistical", M: "Maia-3", Q: "Qwen3-8B" } as const;
  return (
    <div className="rounded-lg border border-rule-strong bg-paper p-3.5">
      <div className="flex items-baseline gap-2"><span className="font-serif text-[26px] leading-none font-semibold text-ink">{letter}</span><span className="text-[14px] font-medium text-ink">{name}</span></div>
      <div className="mt-2 flex flex-wrap gap-1.5">{parts.map((p) => <Feature key={p} tone={p}>{label[p]}</Feature>)}</div>
      <div className="mt-2.5 text-[11.5px] font-semibold tracking-[0.06em] text-ink-3 uppercase">Held-out result: pending</div>
    </div>
  );
}

function Step5({ d }: { d: PresentData }) {
  const qOk = d.mp.models.Q?.status === "ok";
  const maia = d.paired.comparisons.find((c) => c.from === "B_sf" && c.to === "C_sf_maia");
  const scored = qOk ? d.mp.data.positions : 0;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AblationCard letter="A" name="Statistical baseline" parts={["R"]} />
        <AblationCard letter="B" name="Baseline + Maia" parts={["R", "M"]} />
        <AblationCard letter="C" name="Baseline + Qwen" parts={["R", "Q"]} />
        <AblationCard letter="D" name="Baseline + Maia + Qwen" parts={["R", "M", "Q"]} />
      </div>
      <ul className="grid gap-3 md:grid-cols-3">
        <li className="rounded-lg border border-rule bg-paper p-4"><div className="font-semibold text-ink">A → B</div><div className="text-[15px] text-ink-2">Does human-behavior modeling help?</div></li>
        <li className="rounded-lg border border-rule bg-paper p-4"><div className="font-semibold text-ink">A → C</div><div className="text-[15px] text-ink-2">Does the LLM help?</div></li>
        <li className="rounded-lg border-2 border-ink bg-paper p-4"><div className="font-semibold text-ink">B → D &nbsp;<span className="rounded bg-ink px-1.5 py-0.5 text-[11px] tracking-wide text-paper uppercase">primary test</span></div><div className="text-[15px] text-ink-2">Does the LLM still help after Maia is already known?</div></li>
      </ul>
      <p className="rounded-lg border-2 border-ink bg-paper px-5 py-4 font-serif text-[21px] leading-snug font-semibold text-ink">
        Primary test: if Qwen improves B → D on held-out data, its signal is not fully explained by the statistical baseline or Maia.
      </p>
      <Pending>
        <div className="font-semibold text-ink">Full Qwen held-out evaluation: NOT YET RUN</div>
        <div className="mt-1">
          {scored.toLocaleString()} of {d.mp.data.positions.toLocaleString()} held-out test positions have Qwen3-8B-Base scores from the planned evaluation, so no A–D result is shown. (A separate local run scored only the 7 MoveLens demo positions; it is not an evaluation.)
          The scorer, frozen prompt and the paired evaluation are implemented and tested; the 8B scoring run is what remains.
          {d.hybridE.reason && <span className="text-ink-3"> ({d.hybridE.reason})</span>}
        </div>
      </Pending>
      {maia && (
        <div className="rounded-md border border-rule bg-paper-2 p-3.5 text-[13.5px] leading-relaxed text-ink-2">
          <span className="font-semibold text-ink">Related completed result (Maia, not Qwen):</span> in the earlier hybrid experiment, adding Maia-3 features to Stockfish-aggregate features
          changed held-out ROC-AUC by {fmtNum(maia.delta, 3)} (95% CI {fmtNum(maia.ci95[0], 3)} to {fmtNum(maia.ci95[1], 3)}). Its feature sets differ from the A–D above (letters here
          name the Qwen ablation; the Results page uses A–D for the earlier experiment), so it is context for the A → B question, not an entry in this table.
        </div>
      )}
    </div>
  );
}

function Step6({ d }: { d: PresentData }) {
  const maia = d.paired.comparisons.find((c) => c.from === "B_sf" && c.to === "C_sf_maia");
  const order = [["engine-vs-maia", "Engine vs Maia disagreement"], ["qwen-vs-maia", "Maia vs Qwen disagreement"], ["all-agree", "All models agree"]] as const;
  const [id, setId] = useState<string>(order[0][0]);
  const ex = d.curated.examples.find((e) => e.id === id) ?? d.curated.examples[0];
  const qwenOk = d.curated.qwen.status === "ok";
  const t1 = d.mp.models.R?.metrics?.t1_event_logloss, t1m = d.mp.models.M?.metrics?.t1_event_logloss;
  return (
    <div className="space-y-7">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-rule-strong bg-paper p-4">
          <div className="text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Verified · Maia features (not Qwen)</div>
          {maia && <>
            <div className="num mt-1 font-serif text-[30px] font-semibold text-ink">{maia.delta >= 0 ? "+" : "−"}{Math.abs(maia.delta).toFixed(3)} <span className="text-[16px] font-normal text-ink-2">ROC-AUC</span></div>
            <div className="num text-[14px] text-ink-2">95% CI {maia.ci95[0] >= 0 ? "+" : "−"}{Math.abs(maia.ci95[0]).toFixed(3)} to {maia.ci95[1] >= 0 ? "+" : "−"}{Math.abs(maia.ci95[1]).toFixed(3)}</div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">Transition: Stockfish-aggregate features → + Maia-3 features (earlier hybrid experiment, held-out, paired source-game bootstrap of {d.paired.n_boot.toLocaleString()} resamples, no refit).</p>
          </>}
        </div>
        <div className="rounded-lg border border-dashed border-rule-strong bg-paper-2 p-4">
          <div className="text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Qwen incremental value</div>
          <div className="mt-1 font-serif text-[22px] leading-snug font-semibold text-ink">Full Qwen incremental-value evaluation is the next experiment.</div>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">No Qwen result is claimed or estimated.</p>
        </div>
      </div>
      {isNum(t1) && isNum(t1m) && (
        <p className="text-[14px] leading-relaxed text-ink-2">
          Also verified: predicting whether the engine&apos;s first move is played, log-loss {fmtNum(t1m, 3)} for Maia-3 79M vs {fmtNum(t1, 3)} for the statistical reconstruction (lower is better;
          held-out original decisions). Different tasks, different winners; see Results.
        </p>
      )}

      <section aria-labelledby="disagree">
        <h3 id="disagree" className="font-serif text-[22px] font-semibold text-ink">Where the models disagree</h3>
        <div role="tablist" aria-label="Examples" className="mt-3 flex flex-wrap gap-2">
          {order.map(([k, label]) => {
            const e = d.curated.examples.find((x) => x.id === k);
            return (
              <button key={k} type="button" role="tab" aria-selected={k === id} onClick={() => setId(k)}
                className={cn("rounded-md border px-3 py-1.5 text-[13.5px] font-medium transition-colors", k === id ? "border-ink bg-ink text-paper" : "border-rule-strong bg-paper text-ink-2 hover:border-ink-3", e?.status === "pending" && k !== id && "border-dashed")}>
                {label}{e?.status === "pending" && <span className="ml-1.5 text-[10px] tracking-wide uppercase opacity-80">pending</span>}
              </button>
            );
          })}
        </div>
        {id === "all-agree" && !qwenOk && <p className="mt-3 text-[13.5px] text-ink-3">&ldquo;All&rdquo; here means the human move, Stockfish and Maia-3. Qwen3-8B has no score for this position yet (pending).</p>}
        <div className="mt-4">
          {ex.position ? (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
              <ThreeBoard id={`present-ex-${ex.id}`} fen={ex.position.fen} orientation={ex.position.color} arrows={arrowsOf(ex.position)} />
              <OneMoveExplained p={ex.position} qwenOk={qwenOk} />
            </div>
          ) : (
            <ExamplePanel ex={ex} qwenOk={qwenOk} />
          )}
        </div>
      </section>

      <div className="rounded-xl border-2 border-ink bg-paper p-6 text-center">
        <p className="font-serif text-[22px] leading-snug font-semibold text-ink sm:text-[26px]">I am not trying to replace the statistical approach with an LLM.</p>
        <p className="mx-auto mt-2 max-w-2xl text-[16.5px] leading-relaxed text-ink-2">I am testing whether a general-purpose LLM provides a complementary move-preference signal.</p>
        <div className="mx-auto mt-5 flex max-w-2xl flex-col items-center gap-1.5 text-[15.5px] font-medium text-ink sm:flex-row sm:justify-center sm:gap-3">
          <span>Statistical evidence</span><span aria-hidden>+</span><span>Human behavior</span><span aria-hidden>+</span><span>LLM preference</span><span aria-hidden>=</span>
          <span className="font-semibold">better understanding of model disagreement</span>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------------------------- shell */

export function Present({ data }: { data: PresentData }) {
  const [i, setI] = useState(0);
  const [notes, setNotes] = useState(false);
  useEffect(() => {
    const n = parseInt(window.location.hash.replace("#step-", ""), 10);
    if (!(n >= 1 && n <= STEPS.length)) return;
    const raf = requestAnimationFrame(() => setI(n - 1));
    return () => cancelAnimationFrame(raf);
  }, []);
  const go = useCallback((n: number) => {
    const k = Math.max(0, Math.min(STEPS.length - 1, n));
    setI(k);
    try { window.history.replaceState(null, "", `#step-${k + 1}`); } catch { /* ignore */ }
    window.scrollTo({ top: 0 });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,select,textarea,[role=tablist]")) return;
      if (e.key === "ArrowRight") go(i + 1);
      if (e.key === "ArrowLeft") go(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, go]);

  const s = STEPS[i];
  const qwenOk = data.demo.models.Q.status === "ok";
  return (
    <div>
      <div className="sticky top-14 z-30 -mx-4 border-b border-rule bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="num text-[13px] font-semibold text-ink">Step {i + 1} of {STEPS.length}</div>
          <div className="flex items-center gap-1.5 text-[13px] text-ink-3"><Clock className="size-3.5" aria-hidden /> suggested {s.minutes} min · total about {STEPS.reduce((a, x) => a + x.minutes, 0)} min</div>
          <button type="button" onClick={() => setNotes((n) => !n)} aria-pressed={notes}
            className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12.5px] font-medium", notes ? "border-ink bg-ink text-paper" : "border-rule-strong text-ink-2 hover:border-ink-3")}>
            <StickyNote className="size-3.5" aria-hidden /> Presenter notes
          </button>
        </div>
        <ol className="mt-2.5 flex gap-1.5" aria-label="Progress">
          {STEPS.map((x, k) => (
            <li key={x.title} className="flex-1">
              <button type="button" onClick={() => go(k)} aria-label={`Go to step ${k + 1}: ${x.title}`} aria-current={k === i ? "step" : undefined}
                className={cn("h-2 w-full rounded-full transition-colors", k <= i ? "bg-ink" : "bg-paper-3 hover:bg-rule-strong")} />
            </li>
          ))}
        </ol>
      </div>

      <div className="pt-8 pb-4">
        <h1 className="max-w-4xl font-serif text-[30px] leading-[1.1] font-semibold tracking-tight text-ink sm:text-[42px]">{s.title}</h1>
        {notes && (
          <aside role="note" className="mt-4 max-w-3xl rounded-md border-l-4 border-ink bg-paper-2 px-4 py-3 text-[15px] leading-relaxed text-ink">
            <div className="text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Presenter note</div>
            {s.notes}
          </aside>
        )}
        <div className="mt-7 min-h-[380px]">
          {i === 0 && <Step1 />}
          {i === 1 && <Step2 />}
          {i === 2 && <PositionThreeViews p={featuredPosition(data.demo)} qwenOk={qwenOk} />}
          {i === 3 && <Step4 d={data} />}
          {i === 4 && <Step5 d={data} />}
          {i === 5 && <Step6 d={data} />}
        </div>
      </div>

      <aside role="note" className="mt-8 rounded-md border border-rule bg-paper-2 px-4 py-3 text-[13px] leading-relaxed text-ink-2">
        <span className="font-semibold text-ink">MoveLens is an independent research prototype.</span> Its statistical baseline is reconstructed from publicly documented concepts and is not Professor Kenneth W. Regan&apos;s production cheating-detection system.
        <span className="sr-only"> {REGAN_DISCLAIMER}</span>
      </aside>

      <div className="mt-6 flex items-center justify-between border-t border-rule pt-4">
        <button type="button" onClick={() => go(i - 1)} disabled={i === 0} className="inline-flex items-center gap-1.5 rounded-md border border-rule-strong px-4 py-2 text-[14px] font-medium text-ink-2 enabled:hover:border-ink-3 disabled:opacity-40">
          <ArrowLeft className="size-4" aria-hidden /> Previous
        </button>
        <span className="hidden text-[12px] text-ink-3 sm:block">← → keys also work</span>
        {i < STEPS.length - 1 ? (
          <button type="button" onClick={() => go(i + 1)} className="inline-flex items-center gap-1.5 rounded-md bg-ink px-5 py-2 text-[14px] font-semibold text-paper hover:opacity-90">
            Next <ArrowRight className="size-4" aria-hidden />
          </button>
        ) : (
          <Link href="/results" className="inline-flex items-center gap-1.5 rounded-md bg-ink px-5 py-2 text-[14px] font-semibold text-paper hover:opacity-90">Open Results <ChevronRight className="size-4" aria-hidden /></Link>
        )}
      </div>
    </div>
  );
}
