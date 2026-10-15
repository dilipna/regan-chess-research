"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { KV, TechBlock, TechDetails } from "@/components/site/tech";
import { fmtNum, moveLabel } from "@/lib/format";
import { MODEL_META, candidateOf, featuredPosition, sortedCandidates, type ThreeDemo, type ThreePosition } from "@/lib/three";
import { cn } from "@/lib/utils";
import { ModelBadge, Prob, ProbBar, ThreeBoard } from "./atoms";

/** "From Statistical Modeling to LLM Scoring" — the three modeling philosophies side by side. */
export function ThreePhilosophies({ withLlm = true }: { withLlm?: boolean }) {
  const R_ = { model: "R" as const, title: "Professor Regan's publicly documented approach", items: ["engine-derived move utilities", "Elo-conditioned statistical parameters", "predictive human model", "projected vs observed analysis"] };
  const M_ = { model: "M" as const, title: "Modern chess benchmark", items: ["Maia-3 79M", "chess-specific human-behavior model", "rating-conditioned move distribution"] };
  const Q_ = { model: "Q" as const, title: withLlm ? "My LLM experiment" : "Next: my LLM experiment", items: ["same chess decision", "same legal candidates", "Qwen3-8B-Base", "token-level candidate likelihoods", "normalized legal-move distribution"] };
  const cols = withLlm ? [R_, Q_, M_] : [R_, M_, Q_];
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        {cols.map((c) => {
          const next = !withLlm && c.model === "Q";
          return (
          <div key={c.model} className={cn("rounded-lg border bg-paper p-5", next && "border-dashed opacity-80")} style={{ borderColor: `color-mix(in oklab, ${MODEL_META[c.model].color} 40%, var(--rule))` }}>
            <ModelBadge model={c.model} />
            {next && <div className="mt-2 text-[11px] font-semibold tracking-[0.07em] text-ink-3 uppercase">Method built and tested · held-out run pending</div>}
            <div className="mt-3 font-serif text-[18px] leading-snug font-semibold text-ink">{c.title}</div>
            <ul className="mt-3 space-y-1.5 text-[14px] text-ink-2">
              {c.items.map((i) => (
                <li key={i} className="flex gap-2"><span aria-hidden style={{ color: MODEL_META[c.model].color }}>•</span>{i}</li>
              ))}
            </ul>
          </div>
          );
        })}
      </div>
      <p className="mt-8 text-center font-serif text-[22px] leading-snug text-ink sm:text-[26px]">
        {withLlm ? "Same decision target. Three different modeling philosophies." : "Same decision target. Different modeling philosophies."}
      </p>
    </div>
  );
}

function arrowsFor(p: ThreePosition, top?: string) {
  const out = [{ uci: p.original_move, color: "var(--ink)", label: `Original human move: ${moveLabel(p.move_no, p.color, p.original_san)}` }];
  if (p.substitute_move) out.push({ uci: p.substitute_move, color: "var(--flag)", label: `Controlled engine substitute: ${p.substitute_san}` });
  if (top && top !== p.original_move && top !== p.substitute_move)
    out.push({ uci: top, color: "var(--ink-3)", label: `Model's top move: ${candidateOf(p, top)?.san ?? top}` });
  return out;
}

function CandidateList({ p, model, n = 8 }: { p: ThreePosition; model: "Q" | "M"; n?: number }) {
  const rows = sortedCandidates(p, model === "Q" ? "qwen" : "maia");
  const shown = rows.slice(0, n);
  const extra = [p.original_move, p.substitute_move].filter((m): m is string => !!m && !shown.some((c) => c.move === m));
  const all = [...shown, ...extra.map((m) => rows.find((c) => c.move === m)!)];
  const color = MODEL_META[model].color;
  return (
    <ol className="divide-y divide-rule rounded-md border border-rule bg-paper">
      {all.map((c) => {
        const v = model === "Q" ? c.qwen : c.maia;
        const rank = model === "Q" ? c.qwen_rank : c.maia_rank;
        const human = c.move === p.original_move, sub = c.move === p.substitute_move;
        return (
          <li key={c.move} className={cn("grid grid-cols-[2.6rem_minmax(0,6.5rem)_minmax(0,1fr)_3.6rem] items-center gap-2.5 px-3 py-1.5 text-[13.5px]", human && "bg-paper-2")}>
            <span className="num text-[12px] text-ink-3">#{rank}</span>
            <span className="num truncate font-medium text-ink">
              {c.san}
              {human && <span className="ml-1.5 rounded bg-ink px-1 text-[9.5px] font-semibold tracking-wide text-paper uppercase">played</span>}
              {sub && <span className="ml-1.5 rounded bg-flag px-1 text-[9.5px] font-semibold tracking-wide text-paper uppercase">sub</span>}
            </span>
            <ProbBar value={v} color={color} />
            <span className="text-right text-ink-2"><Prob value={v} /></span>
          </li>
        );
      })}
    </ol>
  );
}

/** Section 2 — the LLM experiment on the featured position. */
export function QwenSection({ demo }: { demo: ThreeDemo }) {
  const p = featuredPosition(demo);
  const q = demo.models.Q;
  const ok = q.status === "ok";
  const top = ok ? sortedCandidates(p, "qwen")[0]?.move : undefined;
  const human = candidateOf(p, p.original_move);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:gap-14">
      <div className="lg:sticky lg:top-20 lg:self-start">
        <ThreeBoard id="board-qwen" fen={p.fen} orientation={p.color} arrows={arrowsFor(p, top)}
          title={<>Move {p.move_no}, {p.color === "white" ? "White" : "Black"} to move — the same position as Section 1</>} />
      </div>
      <div className="min-w-0 space-y-5">
        <p className="font-serif text-[20px] leading-snug text-ink">
          Instead of asking Qwen whether a player cheated, I make it score every legal move and convert the model&apos;s token likelihoods
          into a probability distribution over candidate chess moves.
        </p>
        <ol className="space-y-2 text-[14.5px] leading-relaxed text-ink-2">
          <li><span className="font-semibold text-ink">1.</span> One fixed prompt: player and opponent Elo, side to move, the FEN, all {p.n_legal} legal moves, and the Stockfish lines the statistical model also uses. The real move is never marked.</li>
          <li><span className="font-semibold text-ink">2.</span> Each legal move is appended as the answer, and the base model&apos;s log-probability of every token of that answer is summed.</li>
          <li><span className="font-semibold text-ink">3.</span> The {p.n_legal} scores are normalized over the legal moves: a probability for each move.</li>
        </ol>
        {ok ? (
          <>
            <div className="text-[13px] font-medium text-ink">Qwen3-8B-Base: probability for each legal move (top moves, plus the played move)</div>
            <CandidateList p={p} model="Q" />
            <p className="text-[13px] text-ink-2">
              The human actually played <span className="num font-medium">{p.original_san}</span>: Qwen probability <Prob value={human?.qwen} />, rank #{human?.qwen_rank} of {p.n_legal}.
            </p>
          </>
        ) : (
          <p className="rounded-md border border-dashed border-rule-strong bg-paper p-3 text-[13px] leading-relaxed text-ink-2">
            <span className="font-semibold text-ink">Held-out run pending.</span> The scorer, the frozen prompt and the evaluation are built and tested; the
            held-out run of the 8-billion-parameter model needs a cloud GPU, so no held-out Qwen numbers exist and none are shown here. A local run on
            seven demo positions is shown on the home page.
          </p>
        )}
        <TechDetails>
          <TechBlock title="Exactly what is computed">
            <KV rows={[
              ["Model", `${q.model_id} (base model, not chat)`],
              ["Revision", <span key="r" className="break-all">{q.revision}</span>],
              ["Prompt hash", <span key="h" className="break-all">{q.prompt_hash}</span>],
              ["Token scoring", "L_i = Σ_t log P(token_t | prompt, earlier candidate tokens), every token of “ <uci>\\n”"],
              ["Normalization", "P(m_i) = exp(L_i) / Σ_j exp(L_j) over the legal moves (log-sum-exp)"],
              ["Length normalization", "none in the primary score"],
              ["dtype / hardware", "bfloat16 weights, float32 log-softmax; GPU type recorded in qwen_provenance.json when scored"],
              ["Candidate count", String(p.n_legal)],
              ["Generated text", "none — Qwen never writes a verdict or a confidence"],
            ]} />
            <details className="mt-2">
              <summary className="cursor-pointer text-[12px] text-ink-2 underline decoration-dotted underline-offset-2">Show the frozen prompt for this position</summary>
              <pre className="mt-2 max-h-72 overflow-auto rounded border border-rule bg-paper p-2 text-[11px] leading-snug whitespace-pre-wrap text-ink-2">{p.qwen_prompt}</pre>
            </details>
          </TechBlock>
        </TechDetails>
      </div>
    </div>
  );
}

/** Section 3 — the chess-specific human model on the featured position. */
export function MaiaSection({ demo }: { demo: ThreeDemo }) {
  const p = featuredPosition(demo);
  const top = sortedCandidates(p, "maia")[0]?.move;
  const human = candidateOf(p, p.original_move);
  const sub = p.substitute_move ? candidateOf(p, p.substitute_move) : undefined;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:gap-14">
      <div className="lg:sticky lg:top-20 lg:self-start">
        <ThreeBoard id="board-maia" fen={p.fen} orientation={p.color} arrows={arrowsFor(p, top)}
          title={<>Move {p.move_no}, {p.color === "white" ? "White" : "Black"} to move — the same position again</>} />
      </div>
      <div className="min-w-0 space-y-5">
        <p className="font-serif text-[20px] leading-snug text-ink">
          Maia is trained specifically to model human chess behavior, so it acts as the domain-specific modern benchmark.
        </p>
        <p className="text-[14.5px] leading-relaxed text-ink-2">
          Maia-3 is a Chessformer-based human chess transformer — not a language model. It reads the board (plus recent positions) and both
          ratings — here {p.elo} to move against {p.opp_elo} — and outputs a probability for every legal move.
        </p>
        <div className="text-[13px] font-medium text-ink">Maia-3 79M: candidate human moves</div>
        <CandidateList p={p} model="M" />
        <p className="text-[13px] text-ink-2">
          Played move <span className="num font-medium">{p.original_san}</span>: <Prob value={human?.maia} />, rank #{human?.maia_rank} of {p.n_legal}.
          {sub && <> Engine substitute <span className="num font-medium">{p.substitute_san}</span>: <Prob value={sub.maia} />, rank #{sub.maia_rank}.</>}
        </p>
        <TechDetails>
          <TechBlock title="Model">
            <KV rows={[
              ["Primary checkpoint", `${demo.models.M.checkpoint} @ ${demo.models.M.revision}`],
              ["Also reported", `${demo.models.M5.checkpoint} @ ${demo.models.M5.revision} — the checkpoint inside the existing hybrid systems`],
              ["Elo conditioning", `side-to-move ${p.elo}, opponent ${p.opp_elo}`],
              ["Entropy here", `${fmtNum(p.entropy.maia, 3)} nats (79M) · ${fmtNum(p.entropy.maia5, 3)} nats (5M)`],
              ["Reference", "Monroe et al., “Chessformer”, ICLR 2026; code github.com/CSSLab/maia3"],
            ]} />
          </TechBlock>
        </TechDetails>
        <Link href="/compare" className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-paper hover:opacity-90">
          Compare the models on this position <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
