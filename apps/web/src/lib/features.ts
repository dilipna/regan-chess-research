// Port of services/analyzer/explain/narrative.py FEATURE_TEXT plus model display metadata.
import type { ModelKey, ScoreKey } from "./types";

export const FEATURE_TEXT: Record<string, string> = {
  z_t1: "top-1 engine match relative to projection (z)",
  z_t3: "top-3 engine match relative to projection (z)",
  z_loss: "move loss relative to projection (z)",
  z_t1_hard: "top-1 match in hard positions relative to projection (z)",
  t1_rate: "top-1 engine match rate",
  t3_rate: "top-3 engine match rate",
  mean_loss: "mean move loss",
  n_dec: "number of eligible decisions",
  elo: "player rating",
  opp_elo: "opponent rating",
  t5_rate: "top-5 engine match rate",
  median_loss: "median move loss",
  std_loss: "variability of move loss",
  frac_loss_ge100: "share of moves losing >= 100 cp",
  frac_loss_ge300: "share of moves losing >= 300 cp",
  mean_rank: "mean Stockfish rank of chosen moves",
  frac_near_opt: "share of near-optimal moves (<= 25 cp)",
  mean_abs_eval: "mean absolute evaluation",
  mean_gap12: "mean best-vs-second gap",
  mean_surprisal: "mean human surprisal (Maia-3)",
  median_surprisal: "median human surprisal (Maia-3)",
  mean_maia_p: "mean Maia-3 predicted probability of chosen moves",
  maia_t1_rate: "agreement with Maia-3's most probable move",
  maia_t3_rate: "share of moves in Maia-3's top 3",
  frac_maia_p_lt05: "share of moves with Maia-3 predicted probability < 5%",
  frac_maia_p_lt02: "share of moves with Maia-3 predicted probability < 2%",
  excess_surprisal: "surprisal above the human-model expectation",
  z_maia: "human-model surprisal relative to projection (z)",
  nonhuman_engine_rate: "engine-best choices where Maia-3's most probable move differs",
  mean_log_ratio_maia_top1: "log-probability relative to Maia-3's most probable move",
  longest_t1_streak: "longest run of consecutive top-1 matches",
  longest_t1_streak_frac: "longest top-1 run as a share of decisions",
  roll_t1_max: "peak rolling top-1 agreement (8 decisions)",
  roll_t1_std: "variability of rolling top-1 agreement",
  roll_loss_min: "lowest rolling move loss (8 decisions)",
  roll_surprisal_max: "peak rolling human surprisal (8 decisions)",
  acc_easy: "top-1 accuracy in ordinary positions",
  acc_hard: "top-1 accuracy in hard positions",
  crit_lift: "critical accuracy lift (hard minus ordinary)",
  corr_diff_t1: "correlation of difficulty with engine agreement",
  corr_diff_loss: "correlation of difficulty with move quality",
  triple_rate: "rate of engine-best, hard, low-Maia-probability moves",
  triple_count: "count of engine-best, hard, low-Maia-probability moves",
  longest_nonhuman_streak: "longest run of engine-best choices that differ from Maia-3's most probable move",
  // decision-level model
  sf_rank: "Stockfish rank of the move",
  cpl: "centipawn loss of the move",
  gap12: "best-vs-second-best gap",
  near_opt: "number of near-optimal alternatives",
  difficulty: "position difficulty",
  n_legal: "number of legal moves",
  abs_eval: "absolute evaluation",
  maia_p: "Maia-3 predicted probability",
  maia_rank: "Maia-3 rank of the move",
  surprisal: "human surprisal",
  maia_entropy: "human-model uncertainty (entropy)",
  maia_p_best: "Maia-3 predicted probability of the engine-best move",
  maia_sf_agree: "whether Maia-3's most probable move is engine-best",
};

export function featureText(f: string): string {
  return FEATURE_TEXT[f] ?? f;
}

export const SCORE_ORDER: ScoreKey[] = ["A0_zt1", "A_stat", "B_sf", "C_sf_maia", "D_sf_maia_seq"];
export const MODEL_ORDER: ModelKey[] = ["A_stat", "B_sf", "C_sf_maia", "D_sf_maia_seq"];

export interface ModelMeta {
  code: string;
  name: string;
  short: string;
  role: string;
  color: string;
  isZ?: boolean;
}

/** Display names only (no numbers). Labels from metrics.json take precedence where shown. */
export const MODEL_META: Record<ScoreKey, ModelMeta> = {
  A0_zt1: {
    code: "A0",
    name: "Baseline z(top-1) only",
    short: "z(top-1) only",
    role: "Regan-inspired statistic",
    color: "var(--m-a0)",
    isZ: true,
  },
  A_stat: { code: "A", name: "Statistical baseline", short: "Statistical baseline", role: "Regan-inspired aggregate statistics", color: "var(--m-a)" },
  B_sf: { code: "B", name: "Stockfish-XGB", short: "Stockfish-XGB", role: "+ nonlinear engine features", color: "var(--m-b)" },
  C_sf_maia: { code: "C", name: "Stockfish+Maia-XGB", short: "Stockfish+Maia", role: "+ Maia-3 human-move features", color: "var(--m-c)" },
  D_sf_maia_seq: {
    code: "D",
    name: "Stockfish+Maia+Sequence-XGB",
    short: "+ Sequence (full)",
    role: "+ sequence / criticality (sequence-aware)",
    color: "var(--m-d)",
  },
};

export const STRATEGY_TEXT: Record<string, { name: string; short: string; def: string }> = {
  none: { name: "None (original game moves)", short: "None", def: "The original game moves; no substitution." },
  random: {
    name: "Random",
    short: "Random",
    def: "Among decisions where the human did not play Stockfish's #1, choose m uniformly at random and substitute Stockfish's #1.",
  },
  selective: {
    name: "Selective",
    short: "Selective",
    def: "Same alterable set and substitute as Random, but choose the m decisions with the highest position difficulty.",
  },
  subtle: {
    name: "Subtle",
    short: "Subtle",
    def: "Substitute a move drawn uniformly from Stockfish's top-3 lines within the configured loss of the best line (excluding the human move); choose m uniformly at random.",
  },
};

/** Which nested feature group (A/B/C/D) a feature first enters. */
export function featureGroup(
  f: string,
  experiments: Partial<Record<ScoreKey, { features?: string[] }>> | undefined,
): ModelKey | null {
  if (!experiments) return null;
  for (const k of MODEL_ORDER) {
    if (experiments[k]?.features?.includes(f)) return k;
  }
  return null;
}
