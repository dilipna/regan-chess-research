"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fmtNum, moveLabel } from "@/lib/format";
import { MODEL_META, candidateOf, featuredPosition, type AssistResults, type ThreeDemo } from "@/lib/three";
import { cn } from "@/lib/utils";
import { ThreeBoard } from "./atoms";
import { CIPlot, type CIRow } from "./ciplot";
import { MoveTable, OneMoveExplained, arrowsOf, type CuratedData } from "./examples";
import { ArtifactList, LimitationsPanel, REGAN_DISCLAIMER, ThreeModelCards } from "./summary";

interface PairedBootstrap {
  n_boot: number; seed: number; n_clusters: number; n_rows: number; n_player_games: number; method: string;
  reproduced_auc: Record<string, number>;
  comparisons: { from: string; to: string; delta: number; ci95: [number, number] }[];
}

export interface WalkthroughData {
  demo: ThreeDemo;
  curated: CuratedData;
  assist: AssistResults;
  paired: PairedBootstrap;
  qwenScored: number; // number of Qwen-scored test positions (0 while pending)
  testPositions: number;
}

const STEPS = [
  "Research question",
  "One human position",
  "Three predictions",
  "Where they disagree",
  "Held-out evaluation",
  "Does combining help?",
  "Limitations",
  "Methods & provenance",
];

function Prose({ children }: { children: React.ReactNode }) {
  return <p className="max-w-3xl text-[15px] leading-relaxed text-ink-2">{children}</p>;
}

function QwenPending({ scored, total }: { scored: number; total: number }) {
  return (
    <div role="status" className="rounded-md border border-dashed border-rule-strong bg-paper-2 p-3 text-[13px] leading-relaxed text-ink-2">
      <span className="font-semibold text-ink">Qwen evaluation pending.</span> {scored.toLocaleString()} of {total.toLocaleString()} held-out test positions have been scored by
      Qwen3-8B-Base. The scorer, frozen prompt and evaluation code are implemented and tested; no Qwen result is shown or estimated.
    </div>
  );
}

const DELTA_LABEL: Record<string, { label: string; sub: string }> = {
  "A_stat→B_sf": { label: "A → B", sub: "+ Stockfish aggregate features" },
  "B_sf→C_sf_maia": { label: "B → C", sub: "+ Maia-3-derived features" },
  "C_sf_maia→D_sf_maia_seq": { label: "C → D", sub: "+ sequence features" },
};

function maiaNote(cs: PairedBootstrap["comparisons"]): string {
  const get = (a: string, b: string) => cs.find((c) => c.from === a && c.to === b);
  const bc = get("B_sf", "C_sf_maia"), ab = get("A_stat", "B_sf"), cd = get("C_sf_maia", "D_sf_maia_seq");
  if (!bc || !ab || !cd) return "";
  const others = Math.max(ab.delta, cd.delta);
  return `The Maia-derived step (B → C) added ΔAUC ${bc.delta.toFixed(3)} [${bc.ci95[0].toFixed(3)}, ${bc.ci95[1].toFixed(3)}], about ${(bc.delta / others).toFixed(0)}× the larger of the other two small steps (${ab.delta.toFixed(3)} and ${cd.delta.toFixed(3)}).`;
}

function Step({ i, d }: { i: number; d: WalkthroughData }) {
  const p = featuredPosition(d.demo);
  const qwenOk = d.demo.models.Q.status === "ok";
  switch (i) {
    case 0:
      return (
        <div className="space-y-5">
          <h2 className="font-serif text-[28px] leading-tight font-semibold text-ink sm:text-[36px]">Can language-model move preferences add signal beyond chess statistics?</h2>
          <Prose>The same chess position is evaluated three ways, then the signals are combined to ask whether the combination predicts more than any one alone.</Prose>
          <ThreeModelCards qwenOk={qwenOk} />
          {!qwenOk && <QwenPending scored={d.qwenScored} total={d.testPositions} />}
          <Prose>{REGAN_DISCLAIMER}</Prose>
        </div>
      );
    case 1:
      return (
        <div className="space-y-4">
          <h2 className="font-serif text-[26px] font-semibold text-ink">One real decision from the held-out test split</h2>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
            <ThreeBoard id="wt-board" fen={p.fen} orientation={p.color} arrows={arrowsOf(p)}
              title={<>Move {p.move_no}, {p.color === "white" ? "White" : "Black"} to move · player {p.elo} vs {p.opp_elo}</>}
              caption="Observed data: the position and the move the player chose. Everything else on the next steps is a model output or a derived feature." />
            <div className="min-w-0 space-y-3 text-[14px] leading-relaxed text-ink-2">
              <p><span className="font-semibold text-ink">Observed:</span> the player (rated {p.elo}) played <span className="num font-medium text-ink">{moveLabel(p.move_no, p.color, p.original_san)}</span>.</p>
              <p><span className="font-semibold text-ink">Engine evaluation (Stockfish 19, depth 12):</span></p>
              <ol className="num space-y-0.5 pl-4">
                {p.sf_lines.map((l, k) => <li key={l.move}>#{k + 1} {l.san} <span className="text-ink-3">({l.cp > 0 ? "+" : l.cp < 0 ? "−" : ""}{(Math.abs(l.cp) / 100).toFixed(2)})</span>{l.move === p.original_move && " ← played"}{l.move === p.substitute_move && " ← controlled substitute"}</li>)}
              </ol>
              <p>{candidateOf(p, p.original_move)?.sf_rank == null ? "The human move is not among the engine's five lines. " : `The human move is the engine's #${candidateOf(p, p.original_move)?.sf_rank} line. `}In the controlled experiment this decision can be replaced by the engine&apos;s first line, <span className="num font-medium text-ink">{p.substitute_san}</span>, and evaluated in the same position.</p>
            </div>
          </div>
        </div>
      );
    case 2:
      return (
        <div className="space-y-4">
          <h2 className="font-serif text-[26px] font-semibold text-ink">The same position, three predictions</h2>
          <MoveTable p={p} qwenOk={qwenOk} />
          {!qwenOk && <QwenPending scored={d.qwenScored} total={d.testPositions} />}
          <Prose>The statistical baseline projects how often a player of this rating matches the engine; it gives no per-move probability. Maia-3 gives a probability to every legal move. Maia-3 is a chess-specific human-move transformer, not a language model.</Prose>
        </div>
      );
    case 3:
      return (
        <div className="space-y-4">
          <h2 className="font-serif text-[26px] font-semibold text-ink">One move explained</h2>
          <OneMoveExplained p={p} qwenOk={qwenOk} />
          <Prose>More cases, including engine-vs-Maia and ambiguous positions, are on the{" "}
            <Link href="/examples" className="font-medium text-ink underline underline-offset-2">Where the models disagree</Link> page.
            Slots for Qwen-vs-Maia disagreement are reserved and marked pending.</Prose>
        </div>
      );
    case 4: {
      const order: [string, string][] = [["R", "Regan-inspired reconstruction · z(top-1)"], ["M", "Maia-3 79M · mean surprisal"], ["M5", "Maia-3 5M · mean surprisal"], ["Q", "Qwen3-8B-Base · mean surprisal"]];
      const rows: CIRow[] = order.map(([k, sub]) => {
        const m = d.assist.models[k];
        const ok = m?.status === "ok" && m.roc_auc != null && m.roc_auc_ci95;
        return { label: k === "R" ? "Statistical baseline" : k === "Q" ? "Qwen3-8B" : k === "M" ? "Maia-3 79M" : "Maia-3 5M", sub, est: ok ? m.roc_auc : null, lo: ok ? m.roc_auc_ci95![0] : null, hi: ok ? m.roc_auc_ci95![1] : null, color: k === "R" ? MODEL_META.R.color : k === "Q" ? MODEL_META.Q.color : MODEL_META.M.color, pending: "pending — Qwen not yet scored" };
      });
      return (
        <div className="space-y-4">
          <h2 className="font-serif text-[26px] font-semibold text-ink">Held-out human vs controlled engine-assisted decisions</h2>
          <ul className="max-w-3xl list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-ink-2">
            <li><span className="font-medium text-ink">Sample:</span> {d.assist.data.rows.toLocaleString()} held-out test rows from {d.assist.data.source_games} source games; originals are presumed-human, the rest contain controlled substitutions.</li>
            <li><span className="font-medium text-ink">Train / test separation:</span> splits are by source game; nothing from a test game is used for fitting, thresholds come from {d.assist.data.val_original_player_games_for_thresholds} validation player-games.</li>
            <li><span className="font-medium text-ink">Injection protocol:</span> selected human decisions are replaced by Stockfish&apos;s first line (random / selective strategies, 0–70% of decisions) and evaluated in the original positions; games are not replayed.</li>
            <li><span className="font-medium text-ink">Metric:</span> ROC-AUC of each model&apos;s pre-registered score. 95% intervals from a source-game cluster bootstrap ({d.paired.n_boot.toLocaleString()} resamples, no refitting).</li>
          </ul>
          <figure className="rounded-md border border-rule bg-paper p-4">
            <CIPlot rows={rows} min={0.5} max={0.9} ticks={[0.5, 0.6, 0.7, 0.8, 0.9]} label="ROC-AUC with 95% bootstrap interval for each single-model score" />
            <figcaption className="mt-2 text-[12px] text-ink-3">Source: three_model_assistance_results.json. Substitutes are engine first lines by construction, which favours engine-match statistics such as z(top-1).</figcaption>
          </figure>
        </div>
      );
    }
    case 5: {
      const rows: CIRow[] = d.paired.comparisons.filter((c) => `${c.from}→${c.to}` in DELTA_LABEL).map((c) => {
        const k = `${c.from}→${c.to}`;
        return { label: DELTA_LABEL[k].label, sub: DELTA_LABEL[k].sub, est: c.delta, lo: c.ci95[0], hi: c.ci95[1], color: c.to === "C_sf_maia" ? MODEL_META.M.color : "var(--ink-3)", emphasis: c.to === "C_sf_maia" };
      });
      rows.push({ label: "D → + Qwen", sub: "+ Qwen-derived features", pending: "pending — Qwen evaluation not yet run" });
      return (
        <div className="space-y-4">
          <h2 className="font-serif text-[26px] font-semibold text-ink">Incremental value of each added signal</h2>
          <Prose>Nested feature sets A (statistical) → B (+ Stockfish aggregates) → C (+ Maia-3 features) → D (+ sequence), fit on training games and compared on the same held-out predictions. Reproduced test AUC: A {fmtNum(d.paired.reproduced_auc.A_stat, 3)}, B {fmtNum(d.paired.reproduced_auc.B_sf, 3)}, C {fmtNum(d.paired.reproduced_auc.C_sf_maia, 3)}, D {fmtNum(d.paired.reproduced_auc.D_sf_maia_seq, 3)}.</Prose>
          <figure className="rounded-md border border-rule bg-paper p-4">
            <CIPlot rows={rows} min={-0.01} max={0.07} ticks={[0, 0.02, 0.04, 0.06]} zero signed digits={3} label="Paired change in ROC-AUC with 95% source-game bootstrap interval" />
            <figcaption className="mt-2 text-[12px] text-ink-3">
              Paired ΔAUC, {d.paired.n_boot.toLocaleString()} paired source-game resamples ({d.paired.n_clusters} games), held-out predictions, no refitting. Source: paired_bootstrap.json (historical A/B/C/D experiment, recomputed from the stored predictions).
            </figcaption>
          </figure>
          <Prose>{maiaNote(d.paired.comparisons)} This is a historical Maia result from the earlier experiment; it is not evidence about Qwen.</Prose>
          <QwenPending scored={d.qwenScored} total={d.testPositions} />
        </div>
      );
    }
    case 6:
      return (
        <div className="space-y-4">
          <h2 className="font-serif text-[26px] font-semibold text-ink">Limitations</h2>
          <LimitationsPanel id="wt-limitations" />
        </div>
      );
    default:
      return (
        <div className="space-y-4">
          <h2 className="font-serif text-[26px] font-semibold text-ink">Methodology and provenance</h2>
          <Prose>Every displayed number is read from one of these files, each written by the listed script. See{" "}
            <Link href="/methodology" className="font-medium text-ink underline underline-offset-2">Methodology</Link> for the full protocol and{" "}
            <Link href="/results" className="font-medium text-ink underline underline-offset-2">Results</Link> for every table.</Prose>
          <ArtifactList />
          <div className="rounded-md border border-rule bg-paper-2 p-3 text-[12.5px] leading-relaxed text-ink-2">
            Models: Qwen/Qwen3-8B-Base @ {d.demo.models.Q.revision.slice(0, 8)} (prompt hash {d.demo.models.Q.prompt_hash.slice(0, 8)}…, scoring pending) · Maia-3 79M @ {d.demo.models.M.revision.slice(0, 8)} ·
            Stockfish 19, depth 12, MultiPV 5 · analysis plan frozen before test evaluation.
          </div>
        </div>
      );
  }
}

/** Deterministic 5–7 minute walkthrough: no improvisation about which buttons to press. */
export function Walkthrough({ data }: { data: WalkthroughData }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const n = parseInt(window.location.hash.replace("#step-", ""), 10);
    if (!(n >= 1 && n <= STEPS.length)) return;
    const raf = requestAnimationFrame(() => setI(n - 1)); // after hydration; avoids a server/client markup mismatch
    return () => cancelAnimationFrame(raf);
  }, []);
  const go = useCallback((n: number) => {
    const k = Math.max(0, Math.min(STEPS.length - 1, n));
    setI(k);
    try { window.history.replaceState(null, "", `#step-${k + 1}`); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,select,textarea")) return;
      if (e.key === "ArrowRight") go(i + 1);
      if (e.key === "ArrowLeft") go(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, go]);
  return (
    <div>
      <ol className="mb-8 flex flex-wrap gap-1.5" aria-label="Walkthrough steps">
        {STEPS.map((s, k) => (
          <li key={s}>
            <button type="button" onClick={() => go(k)} aria-current={k === i ? "step" : undefined}
              className={cn("rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors", k === i ? "border-ink bg-ink text-paper" : "border-rule-strong bg-paper text-ink-2 hover:border-ink-3")}>
              <span className="num mr-1 opacity-70">{k + 1}</span>{s}
            </button>
          </li>
        ))}
      </ol>
      <div className="min-h-[420px]"><Step i={i} d={data} /></div>
      <div className="mt-10 flex items-center justify-between border-t border-rule pt-4">
        <button type="button" onClick={() => go(i - 1)} disabled={i === 0} className="inline-flex items-center gap-1.5 rounded-md border border-rule-strong px-3 py-1.5 text-[13px] font-medium text-ink-2 enabled:hover:border-ink-3 disabled:opacity-40">
          <ArrowLeft className="size-4" aria-hidden /> Back
        </button>
        <span className="num text-[12px] text-ink-3">Step {i + 1} of {STEPS.length} · use ← → keys</span>
        {i < STEPS.length - 1 ? (
          <button type="button" onClick={() => go(i + 1)} className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-[13px] font-semibold text-paper hover:opacity-90">
            Next <ArrowRight className="size-4" aria-hidden />
          </button>
        ) : (
          <Link href="/present" className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-[13px] font-semibold text-paper hover:opacity-90">Open the 10-minute demo</Link>
        )}
      </div>
    </div>
  );
}

