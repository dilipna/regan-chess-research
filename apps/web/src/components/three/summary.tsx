import { ModelBadge } from "./atoms";
import { MODEL_META, type ModelKey } from "@/lib/three";

export const REGAN_DISCLAIMER =
  "This is an independent reconstruction based on publicly documented concepts and is not Professor Regan's production analyzer.";

interface Facts { input: string; output: string; role: string; strength: string; limitation: string }

function facts(qwenOk: boolean): Record<ModelKey, Facts> {
  return {
    R: {
      input: "Player rating, Stockfish MultiPV lines (depth 12), position difficulty.",
      output: "Projected chance of matching the engine's first / top-3 move; z-score of the observed match rate. No probability per legal move.",
      role: "Statistical baseline: what looks unusual relative to the expected rate for this rating?",
      strength: "Transparent, every quantity inspectable; highest ROC-AUC of the single scores evaluated so far on the controlled-substitution benchmark (Qwen not yet evaluated; substitutes are engine lines by construction, which favours engine-match statistics).",
      limitation: "Not Professor Regan's analyzer. Cannot rank or score individual moves, so it cannot be compared move-by-move.",
    },
    Q: {
      input: "A fixed text prompt: ratings, side to move, FEN, all legal moves and Stockfish lines. The played move is never marked.",
      output: "Each legal move's summed token log-likelihood, softmax-normalized into a distribution over the legal moves.",
      role: "General-purpose language-model preference over candidate moves, evaluated for predictive value.",
      strength: "No chess-specific training objective: tests what a general LLM already encodes.",
      limitation: qwenOk
        ? "General language model, not a chess specialist; likelihoods depend on tokenization and move notation."
        : "Held-out run pending: no held-out Qwen score exists. General language model; likelihoods depend on tokenization and move notation.",
    },
    M: {
      input: "Board (plus recent positions) and both players' ratings.",
      output: "A probability for every legal move, conditioned on rating.",
      role: "Human move model: what would a player of about this strength tend to play?",
      strength: "A full human-move distribution; on the engine-first-move event it beats the reconstruction (paired bootstrap). Separates engine-optimal from human-plausible moves.",
      limitation: "Models human move preference, not cheating. A chess-specific transformer (Chessformer), not a language model.",
    },
  };
}

const TAG: Record<ModelKey, string> = {
  R: "What looks unusual statistically?",
  Q: "What does a general-purpose language model prefer?",
  M: "What would a human of this rating tend to play?",
};

/** Section 2 of the spec: three distinct columns with Input / Output / Role / Strength / Limitation. */
export function ThreeModelCards({ qwenOk }: { qwenOk: boolean }) {
  const f = facts(qwenOk);
  const order: ModelKey[] = ["R", "Q", "M"];
  const rows: [keyof Facts, string][] = [["input", "Input"], ["output", "Output"], ["role", "Role"], ["strength", "Strength"], ["limitation", "Limitation"]];
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {order.map((k) => (
        <article key={k} className="flex min-w-0 flex-col rounded-lg border bg-paper p-5" style={{ borderColor: `color-mix(in oklab, ${MODEL_META[k].color} 45%, var(--rule))`, borderTopWidth: 3 }}>
          <ModelBadge model={k} />
          {k === "Q" && !qwenOk && (
            <div className="mt-2 text-[11px] font-semibold tracking-[0.07em] text-ink-3 uppercase">Implemented and tested · scoring run pending</div>
          )}
          <h3 className="mt-3 font-serif text-[19px] leading-snug font-semibold text-ink">{TAG[k]}</h3>
          <dl className="mt-3 space-y-2.5 text-[13.5px] leading-relaxed">
            {rows.map(([key, label]) => (
              <div key={key}>
                <dt className="text-[10.5px] font-semibold tracking-[0.08em] text-ink-3 uppercase">{label}</dt>
                <dd className="text-ink-2">{f[k][key]}</dd>
              </div>
            ))}
          </dl>
        </article>
      ))}
    </div>
  );
}

export const LIMITATIONS: string[] = [
  "The statistical baseline is an independent reconstruction from publicly documented concepts, not Professor Regan's production system or calibration.",
  "Controlled engine substitutions are not identical to real-world cheating: substitutes are Stockfish lines inserted into otherwise human decisions and evaluated in the original positions (games are not replayed).",
  "Maia-3 models human move preference, not cheating. A low Maia probability means a move is unusual for that rating, nothing more.",
  "Qwen3-8B-Base is a general language model, not a chess-specialized detector. It provides a move-preference signal that can be evaluated for predictive value; it does not detect cheating.",
  "Tokenization and the way moves are written (UCI strings, ordering, prompt wording) can change LLM likelihoods; the prompt is frozen and hashed but other formulations were not explored.",
  "Results depend on the dataset (one month of online Lichess rapid/classical games, presumed human), the engine settings (Stockfish 19, depth 12, MultiPV 5) and the substitution protocol; bootstrap intervals condition on the frozen models and apply no multiplicity correction.",
  "Classification performance or correlation is not proof of misconduct and must not be used alone for adjudication.",
];

export function LimitationsPanel({ id = "limitations" }: { id?: string }) {
  return (
    <div id={id} className="scroll-mt-20 rounded-lg border border-rule-strong bg-paper p-5">
      <ul className="space-y-2.5 text-[14px] leading-relaxed text-ink-2">
        {LIMITATIONS.map((l) => (
          <li key={l} className="flex gap-2.5"><span aria-hidden className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full bg-ink-3" />{l}</li>
        ))}
      </ul>
      <p className="mt-4 border-t border-rule pt-3 text-[12.5px] text-ink-3">{REGAN_DISCLAIMER}</p>
    </div>
  );
}

export interface ArtifactEntry { path: string; label: string; what: string; generator: string }

/** Every downloadable result file, with the script that produced it. Paths are checked by the unit tests. */
export const ARTIFACTS: ArtifactEntry[] = [
  { path: "/data/movelens_demo.json", label: "MoveLens positions", what: "The three curated positions on the home page: Stockfish lines, the statistical model's features and outputs, Maia-3 79M and local Qwen3-8B-Base results, with the selection rules.", generator: "experiments/22_export_movelens_demo.py" },
  { path: "/data/regan_checks.json", label: "Whole game & checks", what: "Projected vs actual over one game (z recomputed and asserted), held-out calibration, clean-game z distribution, screening power, Maia by band, Qwen engine-echo ablation.", generator: "experiments/24_export_regan_checks.py" },
  { path: "/data/qwen_local_scores.json", label: "Raw local Qwen scores", what: "Summed token log-probabilities for every legal move of the 7 demo positions, with and without engine lines, plus hardware and consistency-check records. Not an evaluation.", generator: "experiments/23_qwen_local_demo.py → 24" },
  { path: "/data/three_model_move_prediction.json", label: "Task 1: move prediction", what: "Top-k accuracy, NLL, Brier, rank, engine-event log-loss on 12,863 original test decisions, with source-game bootstrap CIs.", generator: "experiments/14_three_model_eval.py" },
  { path: "/data/three_model_assistance_results.json", label: "Task 2: controlled substitutions", what: "ROC-AUC / PR-AUC / low-FPR recall of the reconstruction and Maia-3 on 9,680 test rows (Qwen entries pending).", generator: "experiments/14_three_model_eval.py" },
  { path: "/data/three_model_bootstrap.json", label: "Paired bootstrap (three-model)", what: "Paired source-game bootstrap differences (2,000 resamples) for every model pair; Qwen comparisons pending.", generator: "experiments/14_three_model_eval.py" },
  { path: "/data/paired_bootstrap.json", label: "Paired bootstrap (A/B/C/D)", what: "Paired source-game bootstrap of AUC differences between nested feature sets on saved held-out predictions (no refit).", generator: "experiments/09_paired_bootstrap.py" },
  { path: "/data/curated_examples.json", label: "Curated examples", what: "Six rule-selected real test decisions (+ two Qwen slots pending) with Stockfish, Maia-3 and projection outputs.", generator: "experiments/20_export_curated_examples.py" },
  { path: "/data/prepared_three_model_demo.json", label: "Prepared player-game", what: "36 decisions of one test player-game with every legal move's model outputs and the controlled substitutions.", generator: "experiments/16_export_three_model_demo.py" },
  { path: "/data/three_model_provenance.json", label: "Provenance record", what: "Model revisions, prompt hash, engine binary hash, analysis-plan hash, split counts and consistency checks.", generator: "experiments/18_three_model_provenance.py" },
  { path: "/data/metrics.json", label: "Hybrid experiment metrics", what: "A/B/C/D ROC-AUC, low-FPR recall, calibration, SHAP and configuration of the validated hybrid experiment.", generator: "experiments/05_train_eval.py + 06_export_web.py" },
  { path: "/data/three_model_results_summary.csv", label: "Results summary (CSV)", what: "Task 1, Task 2 and paired-difference tables as one flat CSV, generated from the JSON files above.", generator: "experiments/21_export_results_csv.py" },
];

export function ArtifactList() {
  return (
    <ul className="divide-y divide-rule rounded-md border border-rule bg-paper text-[13px]">
      {ARTIFACTS.map((a) => (
        <li key={a.path} className="grid gap-1 px-3.5 py-2.5 sm:grid-cols-[minmax(0,15rem)_1fr]">
          <div>
            <a href={a.path} download className="font-medium text-ink underline decoration-dotted underline-offset-2 hover:text-ink-2">{a.label}</a>
            <div className="num text-[11px] text-ink-3 break-all">{a.path.replace("/data/", "")}</div>
          </div>
          <div className="text-ink-2">{a.what} <span className="text-ink-3">Script: <span className="num">{a.generator}</span>.</span></div>
        </li>
      ))}
    </ul>
  );
}
