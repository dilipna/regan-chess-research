"use client";

import { useJson } from "@/lib/data";
import type { MLData } from "@/lib/movelens";

/** Methods page, first block: exactly what the MoveLens home page computes and where each number comes from. */
export function MoveLensMethods({ H }: { H: (p: { id: string; children: React.ReactNode }) => React.ReactElement }) {
  const d = useJson<MLData>("/data/movelens_demo.json").data;
  const rt = d?.models.qwen.runtime;
  const rows: [string, React.ReactNode][] = [
    ["Statistical model", <>Logistic-regression difficulty model on Stockfish position features and rating (training split) → rating-band × difficulty-decile table of engine-match rates → κ-scaled z-score over a game (κ from the validation split). <b>Not</b> a k-nearest-neighbor model. Code: <code>services/analyzer/models/projection.py</code>. An independent reconstruction from public descriptions, not Professor Regan&apos;s analyzer.</>],
    ["Engine reference", <>Stockfish 19, fixed depth 12, MultiPV 5, one thread (bit-reproducible).</>],
    ["Maia-3", <>{d ? `${d.models.maia.checkpoint} @ ${d.models.maia.revision.slice(0, 12)}` : "UofTCSSLab/Maia3-79M"}: a Chessformer-based human-move transformer (not a language model), conditioned on both ratings and up to seven previous positions; softmax over legal moves.</>],
    ["Qwen3-8B-Base", <>{d ? `${d.models.qwen.model_id} @ ${d.models.qwen.revision.slice(0, 12)}` : "Qwen/Qwen3-8B-Base"}, base checkpoint. Frozen prompt (FEN, ratings, side to move, Stockfish top-5 evaluations, all legal moves; SHA-256 {d ? d.models.qwen.prompt_hash.slice(0, 12) : "—"}…). Each legal move&apos;s continuation “ &lt;uci&gt;\n” is scored by its summed token log-probability, then softmax over legal moves. Nothing is generated.</>],
    ["Qwen runs shown", <>Local, demo scope only: the 7 MoveLens positions, bf16, {rt ? rt.hardware : "CPU/disk offload"}{rt?.consistency_check ? `; cached vs full-sequence scoring differ by at most ${rt.consistency_check.max_abs_diff_nats.toFixed(3)} nats` : ""}. A second run used the frozen position-only prompt (no engine lines). The held-out Qwen evaluation has <b>not</b> been run.</>],
    ["Data", <>2,230 Lichess rapid/classical games (August 2026), one game per player, split 60/20/20 by connected components of players. Held-out test split: 321 source games, 605 player-games, 12,863 eligible original decisions; 9,075 controlled variants (decision-level substitutions evaluated in the original positions).</>],
    ["Reading rules", <>Statistical: probability the model gave to what happened (engine #1 played or not); “unusual” below 25%, “somewhat unexpected” below 50%, otherwise “expected” (presentation thresholds, not a test). Qwen: “high preference” if the played move is in its top 3. Maia: “high human plausibility” if it is Maia&apos;s #1 or has ≥ 30%, “moderate” if in the top 3.</>],
    ["Example selection", <>Rules fixed in <code>experiments/20_export_curated_examples.py</code> and <code>22_export_movelens_demo.py</code>, using Stockfish / Maia / statistical outputs; the “Qwen and Maia disagree” example was chosen after the Qwen run by the stated rule (largest Jensen–Shannon divergence among the remaining scored positions).</>],
    ["Whole game & checks", <><code>experiments/24_export_regan_checks.py</code>: z(top-1) recomputed from per-move projections and asserted equal to the stored values; calibration, clean-game z, screening and Maia-by-band read from held-out artifacts with no refitting.</>],
  ];
  return (
    <>
      <H id="movelens">MoveLens in one minute</H>
      <p>What the home page computes, and where every number on it comes from. Downloads are listed under <a href="#artifacts" className="underline underline-offset-2">Research artifacts</a>.</p>
      <dl className="my-5 divide-y divide-rule rounded-md border border-rule bg-paper text-[14px]">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_1fr]">
            <dt className="font-semibold text-ink">{k}</dt>
            <dd className="leading-relaxed text-ink-2">{v}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
