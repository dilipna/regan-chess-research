// MoveLens presentation data (written by experiments/22_export_movelens_demo.py) and the fixed rules that turn
// stored numbers into one-line readings. No reading is produced for a value that does not exist.

export interface TopMove { move: string; san: string; p: number; rank: number }

export interface MLPosition {
  role: "agree" | "stat-vs-maia" | "qwen-vs-maia";
  title: string;
  rule: string;
  status?: "not-evaluated";
  position_id: string;
  fen: string;
  move_no: number;
  color: "white" | "black";
  elo: number;
  opp_elo: number;
  played: string;
  played_san: string;
  n_legal: number;
  stockfish: { lines: { move: string; san: string; cp: number }[]; played_rank: number | null; played_loss_cp: number | null };
  statistical: {
    features: { elo: number; eval_before_cp: number; gap12_cp: number; near_optimal_moves: number; legal_moves: number; eval_swing_cp: number; phase: string };
    difficulty: number; p_t1: number; p_t3: number; expected_loss_cp: number;
    engine_match: boolean; p_observed_outcome: number; label: StatLabel; game_z_t1_original: number | null;
  };
  maia: { played_p: number; played_rank: number; top3: TopMove[]; entropy: number };
  qwen: null | { played_p: number; played_rank: number; top3: TopMove[]; played_logprob: number; played_n_tokens: number; entropy: number; js_vs_maia: number };
  qwen_prompt: string;
}

export type MLExample = MLPosition | { role: "qwen-vs-maia"; title: string; status: "not-evaluated"; rule: string };

export type StatLabel = "expected" | "somewhat unexpected" | "unusual";

export interface MLData {
  schema: string;
  generator: string;
  generated_utc: string;
  label_rule: { quantity: string; unusual_below: number; somewhat_unexpected_below: number };
  models: {
    statistical: { name: string; code: string; method: string };
    stockfish: { version: string; depth: number; multipv: number; threads: number };
    maia: { checkpoint: string; revision: string };
    qwen: {
      model_id: string; revision: string; prompt_hash: string; prompt: { template?: string };
      status: "precomputed-local" | "not-evaluated"; scope: string | null;
      runtime: null | { hardware: string; candidate_batch: number; consistency_check: { max_abs_diff_nats: number } | null; generated_utc: string };
    };
  };
  examples: MLExample[];
  pool: string[];
}

export const hasPosition = (e: MLExample): e is MLPosition => !("status" in e && e.status === "not-evaluated") && "fen" in e;

export function pct(x: number | null | undefined, d = 1): string {
  if (x == null || !Number.isFinite(x)) return "—";
  if (x > 0 && x < 0.001) return "<0.1%";
  return `${(100 * x).toFixed(d)}%`;
}

export function evalText(cp: number): string {
  const v = (cp / 100).toFixed(2);
  return cp > 0 ? `+${v}` : cp < 0 ? `−${v.slice(1)}` : "0.00";
}

export const moveText = (p: Pick<MLPosition, "move_no" | "color">, san: string) => `${p.move_no}${p.color === "white" ? "." : "…"} ${fig(san)}`;

/** Statistical reading: probability the model assigned to what happened (engine #1 played, or not). */
export function statSentence(p: MLPosition): string {
  return p.statistical.label === "unusual"
    ? "This move is statistically unusual."
    : p.statistical.label === "somewhat unexpected"
      ? "This move is somewhat unexpected statistically."
      : "This move looks statistically normal.";
}

/** Shown when Stockfish's first two lines are within 10 cp: "engine #1" is then close to a coin flip between near-equal moves. */
export function tieCaveat(p: MLPosition): string | null {
  const g = p.statistical.features.gap12_cp;
  return p.statistical.engine_match && g <= 10 ? `Caveat: Stockfish's best two moves are only ${g} cp apart here, so which one counts as "engine #1" is nearly arbitrary.` : null;
}

export function statWhy(p: MLPosition): string {
  const s = p.statistical;
  return s.engine_match
    ? `The player matched Stockfish's first choice. For a ${p.elo}-rated player in a position this difficult, the model expected that only ${pct(s.p_t1)} of the time.`
    : `The player did not play Stockfish's first choice. For a ${p.elo}-rated player in a position this difficult, the model expected exactly that ${pct(1 - s.p_t1)} of the time.`;
}

export function qwenSentence(p: MLPosition): string | null {
  if (!p.qwen) return null;
  const r = p.qwen.played_rank;
  if (r === 1) return "Qwen prefers the human move.";
  if (r <= 3) return `Qwen ranks the human move among its top three (#${r} of ${p.n_legal}).`;
  return `Qwen ranks the human move below several alternatives (#${r} of ${p.n_legal}).`;
}

export function maiaSentence(p: MLPosition): string {
  const { played_p: q, played_rank: r } = p.maia;
  if (r === 1 && q >= 0.5) return "Maia considers the played move highly plausible for a player of this rating: it is Maia's most likely move.";
  if (r === 1) return "The played move is Maia's single most likely move for a player of this rating.";
  if (r <= 3) return `Maia considers the played move plausible for a player of this rating (#${r}, ${pct(q)}), though not its first choice.`;
  return `Maia considers the played move unlikely for a player of this rating (#${r} of ${p.n_legal}, ${pct(q)}).`;
}

export type Reading = { word: string; typical: boolean | null };

export function readings(p: MLPosition): { stat: Reading; qwen: Reading; maia: Reading } {
  const stat = { word: p.statistical.label, typical: p.statistical.label === "expected" };
  const qwen = p.qwen
    ? { word: p.qwen.played_rank <= 3 ? "high preference" : "low preference", typical: p.qwen.played_rank <= 3 }
    : { word: "not yet evaluated", typical: null };
  const r = p.maia.played_rank, q = p.maia.played_p;
  const maia = { word: r === 1 || q >= 0.3 ? "high human plausibility" : r <= 3 ? "moderate human plausibility" : "low human plausibility", typical: r <= 3 };
  return { stat, qwen, maia };
}

export function conclusion(p: MLPosition): string {
  const r = readings(p);
  const known = [r.stat.typical, r.qwen.typical, r.maia.typical].filter((x): x is boolean => x !== null);
  const agree = known.every((x) => x === known[0]);
  if (agree) return r.qwen.typical === null
    ? "The statistical model and Maia point the same way here; Qwen has not been evaluated on this position."
    : "Here the three systems broadly agree about the played move.";
  return "These systems disagree because they are measuring different properties of the move.";
}

// ------------------------------------------------------------------------------------------ chess notation

const FIGURINE: Record<string, string> = { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘" };

/** Figurine algebraic notation (Nf3 -> ♘f3, e8=Q -> e8=♕). Castling and pawn moves are unchanged. */
export function fig(san: string): string {
  if (!san || san.startsWith("O-O")) return san;
  return san.replace(/^[KQRBN]/, (m) => FIGURINE[m]).replace(/=([QRBN])/, (_, m: string) => `=${FIGURINE[m]}`);
}

// ------------------------------------------------------------------------------------------ statistician's checks

export interface GameVariant {
  strategy: "none" | "random" | "selective" | "subtle";
  level: number; realized_alpha: number; n_altered: number;
  projected_t1: number; actual_t1: number; var_t1: number; z_t1: number; mean_maia_surprisal: number;
  altered_plies: number[]; t1: number[];
}

export interface QwenAblationSide {
  top_san: string; top_p: number; top_is_engine_first: boolean; p_engine_first: number; rank_engine_first: number;
  played_rank: number; played_p: number; maia_rank_of_top: number;
}

export interface ReganChecks {
  schema: string; generator: string; generated_utc: string;
  game: {
    game_id: string; color: "white" | "black"; elo: number; n_decisions: number; kappa_t1: number; formula: string; check: string;
    decisions: { ply: number; move_no: number; san: string; p_t1: number; engine_match: boolean; engine_first: string; maia_p: number }[];
    variants: GameVariant[];
  };
  calibration: {
    n: number; projected_mean: number; actual_mean: number; brier: number; note: string;
    by_bin: { bin: string; n: number; projected: number; actual: number }[];
    by_band: { band: string; n: number; projected: number; actual: number }[];
  };
  clean_z: { n: number; mean: number; sd: number; hist_edges: number[]; hist: number[]; note: string;
    tails: { threshold: number; observed: number; count: number; normal: number }[] };
  screening: { note: string; rows: { strategy: string; level: number; n: number; mean_realized_alpha: number; share_z_gt2: number; share_z_gt3: number; median_z: number }[] };
  maia_by_band: { band: string; n: number; top1_accuracy: number; mean_nll: number }[];
  qwen_ablation:
    | { status: "not-evaluated"; note?: string }
    | { status: "precomputed-local"; n_positions: number; note: string;
        rows: { position_id: string; played_san: string; engine_first_san: string; maia_top_san: string; regan_aligned: QwenAblationSide; position_only: QwenAblationSide }[];
        summary: Record<"regan_aligned" | "position_only", { top_is_engine_first: number; median_rank_engine_first: number; median_played_rank: number }> };
}

/** Standard normal density, for the reference curve over the clean-game z histogram. */
export const normalPdf = (z: number) => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
