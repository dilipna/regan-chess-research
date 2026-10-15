// Types and pure helpers for the direct three-model comparison (Regan-inspired reconstruction, Qwen3-8B-Base,
// Maia-3). Every number shown comes from the exported JSON written by experiments/14 and experiments/16.
// Missing / not-yet-computed model outputs are null and must render as "pending" or "not defined" — never as 0.
import { isNum } from "./format";

export type ModelKey = "R" | "Q" | "M";
export type Status = "ok" | "pending";

export const MODEL_META: Record<ModelKey, { name: string; kind: string; color: string; soft: string; short: string }> = {
  R: { name: "Regan-inspired", short: "Regan-inspired", kind: "Statistical model (public reconstruction)", color: "var(--prov-regan)", soft: "var(--tint-regan)" },
  Q: { name: "Qwen3-8B-Base", short: "Qwen3-8B", kind: "General-purpose LLM", color: "var(--llm)", soft: "var(--tint-llm)" },
  M: { name: "Maia-3 79M", short: "Maia-3", kind: "Chess-specific human-move transformer", color: "var(--human)", soft: "var(--human-soft)" },
};

export interface Candidate {
  move: string;
  san: string;
  sf_rank: number | null;
  sf_cp: number | null;
  maia: number | null;
  maia_rank: number | null;
  maia5: number | null;
  maia5_rank: number | null;
  qwen: number | null;
  qwen_rank: number | null;
  qwen_logprob: number | null;
  qwen_n_tokens: number | null;
  qwen_position_only: number | null;
}

export interface ReganPosition {
  difficulty: number | null;
  p_t1: number | null;
  p_t3: number | null;
  p_ev: number | null;
  expected_loss_cp: number | null;
  engine_first_move: string;
}

export interface ThreePosition {
  position_id: string;
  ply: number;
  move_no: number;
  color: "white" | "black";
  fen: string;
  elo: number;
  opp_elo: number;
  n_legal: number;
  original_move: string;
  original_san: string;
  substitute_move: string | null;
  substitute_san: string | null;
  substituted_in: string[];
  sf_lines: { move: string; cp: number; san: string }[];
  eval_before: number;
  phase: string;
  regan: ReganPosition;
  entropy: { maia: number | null; maia5: number | null; qwen: number | null };
  qwen_prompt: string;
  candidates: Candidate[];
}

export interface ThreeStudy {
  id: string;
  strategy: string;
  target_level: number;
  realized_alpha: number | null;
  n_decisions: number;
  substituted_plies: number[];
  game_scores: { R_z_t1: number | null; M_mean_surprisal: number | null; M5_mean_surprisal: number | null; Q_mean_surprisal: number | null; Q0_mean_surprisal?: number | null };
  existing_hybrid_D_estimate: number | null;
  existing_hybrid_D_score: number | null;
}

export interface ThreeDemo {
  schema: string;
  generator: string;
  generated_utc: string;
  player: { color: "white" | "black"; elo: number; opp_elo: number; band: string };
  selection_rule: string;
  featured_ply: number;
  featured_rule: string;
  models: {
    R: { label: string; status: Status; outputs: string };
    Q: { label: string; status: Status; model_id: string; revision: string; prompt_hash: string; prompt: Record<string, unknown>; position_only_status: Status };
    M: { label: string; status: Status; checkpoint: string; revision: string };
    M5: { label: string; status: Status; checkpoint: string; revision: string };
  };
  studies: ThreeStudy[];
  positions: ThreePosition[];
  benchmark_auc: Record<string, number | null | undefined>;
  note: string;
}

export interface ModelResult {
  label: string;
  status: Status;
  metrics: Record<string, number | null>;
  ci95?: Record<string, [number, number]>;
  observed_t1_rate?: number;
  mean_pred_t1?: number;
  by_band?: { band: string; n: number; top1_accuracy: number; mean_nll: number }[];
}

export interface MovePrediction {
  generator: { script: string; plan_version: string; plan_sha256: string; generated_utc: string };
  data: { positions: number; source_games: number; player_games: number };
  compatibility: { metric: string; R: boolean; Q: boolean; M: boolean }[];
  models: Record<string, ModelResult>;
  caveats: string[];
}

export interface AssistModel {
  label: string;
  status: Status;
  score?: string;
  roc_auc?: number;
  roc_auc_ci95?: [number, number];
  pr_auc?: number;
  tpr_at_fpr?: { target_fpr: number; threshold: number; tpr: number; test_fpr: number }[];
  by_cell?: { strategy: string; level: number; roc_auc: number }[];
  secondary_excess_surprisal?: { roc_auc: number; pr_auc: number };
}

export interface AssistResults {
  generator: MovePrediction["generator"];
  data: { rows: number; positives: number; source_games: number; val_original_player_games_for_thresholds: number };
  models: Record<string, AssistModel>;
  caveats: string[];
}

export interface Comparison {
  task: "task1" | "task2";
  from: string;
  to: string;
  metric: string;
  status: Status;
  a?: number;
  b?: number;
  delta?: number;
  ci95?: [number, number];
  share_le_0?: number;
  lower_is_better?: boolean;
}

export interface ThreeBootstrap {
  generator: MovePrediction["generator"];
  method: string;
  n_boot: number;
  comparisons: Comparison[];
}

// ------------------------------------------------------------------------------------------ position helpers

/** The decision-level counterfactual shown on the board: original human move, or the controlled engine substitute. */
export type Version = "original" | "substitute";

export function shownMove(p: ThreePosition, v: Version): string {
  return v === "substitute" && p.substitute_move ? p.substitute_move : p.original_move;
}

/** Every version is evaluated in the SAME original position: the FEN never changes with the toggle. */
export function positionFen(p: ThreePosition, v: Version): string {
  void v; // intentionally unused: both versions share the original position
  return p.fen;
}

export function candidateOf(p: ThreePosition, move: string): Candidate | undefined {
  return p.candidates.find((c) => c.move === move);
}

export type SortKey = "maia" | "qwen" | "engine";

export function sortedCandidates(p: ThreePosition, key: SortKey): Candidate[] {
  const val = (c: Candidate) =>
    key === "engine" ? (c.sf_rank != null ? 100 - c.sf_rank : -1) : key === "qwen" ? c.qwen ?? -1 : c.maia ?? -1;
  return [...p.candidates].sort((a, b) => val(b) - val(a) || a.move.localeCompare(b.move));
}

export function topMove(p: ThreePosition, model: "M" | "Q"): Candidate | null {
  const field = model === "M" ? "maia" : "qwen";
  let best: Candidate | null = null;
  for (const c of p.candidates) {
    const v = c[field];
    if (!isNum(v)) continue;
    if (!best || v > (best[field] as number)) best = c;
  }
  return best;
}

/** What the Regan-inspired reconstruction can say about any move: engine rank and the projected match rates.
 * It has no per-move probability, so `probability` is always null. */
export function reganForMove(p: ThreePosition, move: string) {
  const c = candidateOf(p, move);
  const rank = c?.sf_rank ?? null;
  return {
    probability: null as null,
    engineRank: rank,
    isEngineFirst: rank === 1,
    inEngineTop3: rank != null && rank <= 3,
    p_t1: p.regan.p_t1,
    p_t3: p.regan.p_t3,
    difficulty: p.regan.difficulty,
  };
}

export function surprisal(p: number | null | undefined): number | null {
  return isNum(p) ? -Math.log(Math.max(p, 1e-6)) : null;
}

export function featuredPosition(d: ThreeDemo): ThreePosition {
  return d.positions.find((p) => p.ply === d.featured_ply) ?? d.positions[0];
}

// ------------------------------------------------------------------------------------------ findings

export interface Finding {
  id: string;
  title: string;
  evidence: string;
  interpretation: string;
  limitation: string;
  kind: "difference" | "no-difference" | "pending";
}

const NAMES: Record<string, string> = {
  R: "the Regan-inspired reconstruction",
  Q: "Qwen3-8B-Base",
  Q0: "Qwen3-8B-Base (position-only)",
  M: "Maia-3 79M",
  M5: "Maia-3 5M",
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const METRIC_TEXT: Record<string, { name: string; fmt: (x: number) => string }> = {
  top1_accuracy: { name: "top-1 accuracy", fmt: (x) => `${(100 * x).toFixed(1)}%` },
  top3_accuracy: { name: "top-3 accuracy", fmt: (x) => `${(100 * x).toFixed(1)}%` },
  mean_nll: { name: "mean negative log-likelihood", fmt: (x) => `${x.toFixed(3)} nats` },
  t1_event_logloss: { name: "log-loss for predicting whether the engine's first move is played", fmt: (x) => x.toFixed(3) },
  roc_auc: { name: "ROC-AUC", fmt: (x) => x.toFixed(3) },
};
const fmtD = (c: Comparison, f: (x: number) => string) =>
  `${f(c.a!)} vs ${f(c.b!)}; paired difference ${c.delta! >= 0 ? "+" : "−"}${Math.abs(c.delta!).toFixed(3)} [${c.ci95![0].toFixed(3)}, ${c.ci95![1].toFixed(3)}]`;

/** A comparison "favours" a model only when the paired 95% interval excludes 0. */
export function verdict(c: Comparison): { better: string | null; worse: string | null } {
  if (c.status !== "ok" || !c.ci95) return { better: null, worse: null };
  const [lo, hi] = c.ci95;
  if (lo <= 0 && hi >= 0) return { better: null, worse: null };
  const bHigher = lo > 0;
  const bBetter = c.lower_is_better ? !bHigher : bHigher;
  return bBetter ? { better: c.to, worse: c.from } : { better: c.from, worse: c.to };
}

function findingFrom(c: Comparison, task: "task1" | "task2"): Finding | null {
  const mt = METRIC_TEXT[c.metric];
  if (!mt) return null;
  const id = `${task}-${c.metric}-${c.from}-${c.to}`;
  if (c.status !== "ok") {
    return {
      id, kind: "pending",
      title: `${cap(NAMES[c.from])} vs ${NAMES[c.to]} on ${mt.name}: pending`,
      evidence: "At least one of the two models has not been scored on the held-out data yet. No value is shown.",
      interpretation: "This comparison will be computed from real model outputs once they exist.",
      limitation: "—",
    };
  }
  const v = verdict(c);
  const ev = fmtD(c, mt.fmt) + " (paired source-game bootstrap, 95%).";
  if (!v.better) {
    return {
      id, kind: "no-difference",
      title: `${cap(NAMES[c.from])} and ${NAMES[c.to]} were not distinguishable on ${mt.name}.`,
      evidence: ev,
      interpretation: "The paired interval includes zero, so the data do not establish a difference between the two.",
      limitation: "Bootstrap conditions on the frozen models; no multiplicity correction across comparisons.",
    };
  }
  const t1 = task === "task1";
  return {
    id, kind: "difference",
    title: t1
      ? `${cap(NAMES[v.better])} ${c.metric.startsWith("t1_event") ? "predicted engine-first-move choices" : "predicted original human moves"} better than ${NAMES[v.worse!]} (${mt.name}).`
      : `${cap(NAMES[v.better])}'s signal separated controlled substitutions from originals better than ${NAMES[v.worse!]}'s (${mt.name}).`,
    evidence: ev,
    interpretation: t1
      ? "Measured on original, presumed-human decisions of the held-out test split; the models were frozen and not tuned on these data."
      : "Each model's assistance-sensitive score was evaluated on the same controlled decision-level substitutions.",
    limitation: t1
      ? "Source games are presumed human; one month of Lichess rapid/classical games; no multiplicity correction."
      : "Random and selective substitutes are Stockfish's first line by construction, which favours engine-match statistics; substitutions are evaluated in the original positions (not replayed).",
  };
}

export function threeModelFindings(boot: ThreeBootstrap | undefined | null): Finding[] {
  if (!boot) return [];
  const want: [string, string, string, string][] = [
    ["task1", "top1_accuracy", "Q", "M"],
    ["task1", "mean_nll", "Q", "M"],
    ["task1", "t1_event_logloss", "R", "M"],
    ["task1", "top1_accuracy", "M5", "M"],
    ["task1", "t1_event_logloss", "R", "Q"],
    ["task2", "roc_auc", "R", "M"],
    ["task2", "roc_auc", "R", "Q"],
    ["task2", "roc_auc", "Q", "M"],
    ["task2", "roc_auc", "M5", "M"],
  ];
  const out: Finding[] = [];
  for (const [task, metric, a, b] of want) {
    const c = boot.comparisons.find((x) => x.task === task && x.metric === metric && x.from === a && x.to === b);
    if (!c) continue;
    const f = findingFrom(c, task as "task1" | "task2");
    if (f) out.push(f);
  }
  return out;
}

// ------------------------------------------------------------------------------------------ live backend

export type LiveMode = "checking" | "live" | "prepared";

/** Health check with a hard timeout. Any failure (no URL, network error, timeout, bad JSON, models not loaded)
 * yields "prepared", so a dead or cold backend can never break the page. */
export async function checkLive(url: string | undefined, fetcher: typeof fetch = fetch, timeoutMs = 4000): Promise<LiveMode> {
  if (!url) return "prepared";
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetcher(`${url.replace(/\/+$/, "")}/health`, { signal: ctl.signal, cache: "no-store" });
    if (!r.ok) return "prepared";
    const j = (await r.json()) as { status?: string; models_loaded?: boolean };
    return j?.status === "ok" && j?.models_loaded === true ? "live" : "prepared";
  } catch {
    return "prepared";
  } finally {
    clearTimeout(timer);
  }
}

export const LIVE_URL = (process.env.NEXT_PUBLIC_LIVE_API_URL || "").replace(/\/+$/, "");

export const DATA3 = {
  demo: "/data/prepared_three_model_demo.json",
  movePrediction: "/data/three_model_move_prediction.json",
  assistance: "/data/three_model_assistance_results.json",
  bootstrap: "/data/three_model_bootstrap.json",
  hybridE: "/data/hybrid_E_results.json",
};
