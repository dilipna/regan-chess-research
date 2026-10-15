"use client";

import { KV } from "@/components/site/tech";
import { useJson } from "@/lib/data";
import { DATA3, type MovePrediction, type ThreeDemo } from "@/lib/three";

/** Methodology of the direct three-model comparison (read from the exported files where possible). */
export function ThreeMethodology({ H }: { H: (p: { id: string; children: React.ReactNode }) => React.ReactElement }) {
  const demo = useJson<ThreeDemo>(DATA3.demo).data;
  const mp = useJson<MovePrediction>(DATA3.movePrediction).data;
  const q = demo?.models.Q;
  const template = (q?.prompt as { template?: string } | undefined)?.template;
  return (
    <>
      <H id="three">Model comparison</H>
      <p>
        The central question is whether a general-purpose LLM can solve the same underlying prediction problem as a statistical
        human-move model: <em>given a position, the player&apos;s rating and the legal moves, which move will this human choose?</em> Three
        approaches answer it for the same held-out decisions. The Regan-inspired reconstruction and Maia-3 79M have been evaluated; the
        held-out Qwen3-8B-Base run is the next experiment (method built and tested; seven MoveLens demo positions were scored locally with the 8B model, which is not an evaluation).
      </p>
      <ul className="my-4 list-disc space-y-1.5 pl-5 text-ink-2">
        <li>
          <strong>Regan-inspired public reconstruction (R).</strong> The existing projection model: position difficulty from Stockfish
          features and Elo, an Elo-band × difficulty-decile table fitted on training decisions, κ from validation. Per decision it outputs
          projected probabilities of matching the engine&apos;s first line and top three lines; per game, z(top-1). It does
          <strong> not</strong> output a probability for every legal move, so move-level metrics are reported as &ldquo;not defined&rdquo;
          and R is compared on the engine-first-move and engine-top-3 events, which every approach predicts.
        </li>
        <li>
          <strong>Qwen3-8B-Base (Q).</strong> A base (non-chat) LLM used as a scorer, never as a judge. For each legal move the frozen
          prompt is followed by the continuation &ldquo; &lt;uci&gt;\n&rdquo;; the summed log-probability of every token of that continuation
          is the move&apos;s score, and a softmax over the legal moves gives the distribution. No text is generated, no confidence is
          requested, no few-shot examples are used.
        </li>
        <li>
          <strong>Maia-3 79M (M).</strong> The released 79M Chessformer checkpoint, a human-move transformer (not a language model),
          with the same input construction as the existing 5M pipeline. The 5M checkpoint used inside hybrid systems C/D is reported as a
          secondary row and never relabelled.
        </li>
      </ul>
      <KV rows={[
        ["Qwen checkpoint", q ? `${q.model_id} @ ${q.revision}` : "—"],
        ["Qwen status", q ? (q.status === "ok" ? "scored" : "held-out run pending (needs a cloud GPU); 7 demo positions scored locally") : "—"],
        ["Prompt SHA-256 (Regan-aligned)", <span key="p" className="break-all">{q?.prompt_hash ?? "—"}</span>],
        ["Maia-3 79M", demo ? `${demo.models.M.checkpoint} @ ${demo.models.M.revision}` : "—"],
        ["Analysis plan", mp ? `${mp.generator.plan_version}, SHA-256 ${mp.generator.plan_sha256.slice(0, 16)}… (frozen before test evaluation)` : "—"],
        ["Task 1 data", mp ? `${mp.data.positions.toLocaleString()} original test decisions, ${mp.data.source_games} source games` : "—"],
        ["Bootstrap", "paired source-game cluster bootstrap, 2,000 resamples, no refitting, no multiplicity correction"],
      ]} />
      <p className="mt-4">
        <strong>Task 1</strong> uses only original (presumed-human) decisions of the test split: top-1 / top-3 accuracy, mean negative
        log-likelihood, multi-class Brier score (Σ over legal moves of (pᵢ − yᵢ)²) and mean rank (1 + number of moves with strictly higher
        probability). <strong>Task 2</strong> reuses the existing controlled benchmark unchanged; the pre-registered game-level score is the
        mean surprisal −ln P(move) of the evaluated moves for Q and M, and z(top-1) for R. Low-FPR thresholds come from validation original
        player-games, and the realized test FPR is always shown next to recall.
      </p>
      <p>
        <strong>Information policy.</strong> The prompt contains only what is known before the decision: both ratings, side to move, FEN,
        the legal moves in lexicographic order, and the Stockfish MultiPV values that the statistical model also uses. The played move is
        never marked; when it lies outside the five engine lines its own engine value (which is derived from the target) is not shown.
        Prompts are built from position fields only, and automated tests check that changing the played move or any assistance field leaves
        the prompt byte-identical.
      </p>
      {template && (
        <details className="my-4">
          <summary className="cursor-pointer text-[13px] text-ink-2 underline decoration-dotted underline-offset-2">Frozen prompt template</summary>
          <pre className="mt-2 overflow-auto rounded border border-rule bg-paper-2 p-3 text-[11.5px] leading-snug whitespace-pre-wrap text-ink-2">{template}</pre>
        </details>
      )}
      <p>
        <strong>Numerics.</strong> bfloat16 weights, float32 log-softmax, candidates scored through one shared prompt key/value cache
        (verified against independent full-sequence scoring: 2.5×10⁻⁵ nats in float32). In bfloat16 the two paths differ by rounding
        (up to 0.16 nats on the small pipeline-check model), so the candidate batch composition is fixed for reproducibility.
      </p>
    </>
  );
}
