// Types for the precomputed JSON contract (schema chessassistlens.report.v1 and companions).
// Every field is treated as possibly missing at runtime; render "—" when absent.

export type Color = "white" | "black";
export type ModelKey = "A_stat" | "B_sf" | "C_sf_maia" | "D_sf_maia_seq";
export type ScoreKey = ModelKey | "A0_zt1";
export type Strategy = "none" | "random" | "selective" | "subtle";

export interface GameMove {
  ply: number;
  uci: string;
  san: string;
  fen_before: string;
}

export interface SfLine {
  move: string;
  cp: number;
  pv: string[];
}

export interface ShapRow {
  feature: string;
  value: number | null;
  contribution: number;
}

export interface TimelineRow {
  ply: number;
  move_no: number;
  color: Color;
  fen: string;
  move: string;
  human_move: string;
  san: string;
  display_san?: string;
  substituted: boolean;
  eligible: boolean;
  phase?: string;
  n_legal?: number;
  eval_before?: number | null;
  eval_swing?: number | null;
  gap12?: number | null;
  near_opt?: number | null;
  sf_rank: number;
  sf_rank_censored: boolean;
  cpl: number | null;
  top1?: boolean;
  maia_p: number | null;
  maia_rank: number | null;
  surprisal: number | null;
  maia_top?: string[];
  maia_top_p?: number[];
  maia_entropy?: number | null;
  sf_lines?: SfLine[];
  sf_best?: string;
  sf_depth?: number | null;
  sf_quick?: boolean;
  difficulty: number | null;
  p_t1: number | null;
  flag_triple: boolean;
  roll_t1: number | null;
  roll_loss: number | null;
  roll_surprisal: number | null;
  dm_score?: number | null;
  dm_shap?: ShapRow[];
  explanation?: string[];
}

export interface PvoRow {
  key?: string;
  metric: string;
  unit: string;
  n: number;
  projected: number | null;
  observed: number | null;
  z: number | null;
  note?: string;
}

export interface PlayerReport {
  color: Color;
  elo: number | null;
  opp_elo: number | null;
  n_decisions: number;
  n_plies: number;
  timeline: TimelineRow[];
  hard_threshold?: number;
  easy_threshold?: number;
  sufficient?: boolean;
  note?: string;
  features?: Record<string, number | null>;
  scores?: Partial<Record<ScoreKey, number | null>>;
  score_percentile_vs_clean?: Partial<Record<ScoreKey, number | null>>;
  alpha_estimate?: Partial<Record<ModelKey, number | null>>;
  pvo?: PvoRow[];
  shap?: { model: string; base_value_logit: number; rows: ShapRow[] };
  unusual_plies?: number[];
  narrative?: string[];
}

export interface Substitution {
  ply: number;
  move_no: number;
  color: Color;
  human_move: string;
  human_san: string;
  engine_move: string;
  engine_san: string;
  engine_rank: number;
}

export interface SyntheticInfo {
  strategy: Strategy;
  level: number;
  realized_alpha: number;
  color: Color;
  n_altered: number;
  substitutions: Substitution[];
}

export interface Report {
  schema: string;
  id: string;
  title: string;
  kind: string;
  disclaimer?: string;
  focus: Color;
  game: {
    white: string;
    black: string;
    white_elo: number | null;
    black_elo: number | null;
    result: string;
    time_control?: string;
    start_fen: string;
    final_fen: string;
    moves: GameMove[];
  };
  analysis?: {
    engine?: string;
    depth?: number;
    multipv?: number;
    maia_model?: string;
    elapsed_s?: number;
    assumed_elo?: string[];
  };
  synthetic: SyntheticInfo | null;
  players: Partial<Record<Color, PlayerReport | null>>;
  selection_rule?: string;
}

export interface DemoIndexEntry {
  id: string;
  title: string;
  strategy: Strategy;
  level: number;
  realized_alpha: number;
  scores: Partial<Record<ScoreKey, number | null>> | null;
  alpha_estimate: Partial<Record<ModelKey, number | null>> | null;
  n_decisions: number;
  elo: number;
}

export interface DemoIndex {
  demos: DemoIndexEntry[];
  color: Color;
}

// ---------------- simulator.json
export interface SimDecision {
  ply: number;
  move_no: number;
  difficulty: number | null;
  human_top1: boolean;
}

export interface SimVariant {
  strategy: Strategy;
  level: number;
  realized_alpha: number;
  n_altered: number;
  altered_plies: number[];
  z_t1: number | null;
  t1_rate: number | null;
  mean_loss: number | null;
  mean_surprisal: number | null;
  crit_lift: number | null;
  scores: Partial<Record<ModelKey, number | null>>;
  alpha_estimate: Partial<Record<ModelKey, number | null>>;
}

export interface SimPlayerGame {
  key: string;
  label: string;
  elo: number;
  opp_elo?: number;
  band: string;
  color: Color;
  n_decisions: number;
  decisions: SimDecision[];
  variants: SimVariant[];
}

export interface SimulatorData {
  player_games: SimPlayerGame[];
  levels: number[];
  strategies: string[];
  reference_val_clean: Partial<Record<ScoreKey, number[]>>;
}

// ---------------- metrics.json
export interface TprAtFpr {
  target_fpr: number;
  threshold: number;
  tpr: number;
  test_fpr: number;
}
export interface CalBin {
  bin_lo?: number;
  bin_hi?: number;
  mean_pred: number;
  frac_pos: number;
  n: number;
}
export interface CellMetric {
  strategy: string;
  level: number;
  n_pos?: number;
  n_neg?: number;
  roc_auc: number | null;
  pr_auc: number | null;
  mean_realized_alpha?: number;
}
export interface ClassifierMetrics {
  roc_auc: number | null;
  roc_auc_ci95?: [number, number];
  pr_auc: number | null;
  brier?: number | null;
  tpr_at_fpr?: TprAtFpr[];
  calibration?: CalBin[];
  by_cell?: CellMetric[];
  by_band?: { band: string; roc_auc: number | null }[];
  best_iteration?: number;
}
export interface RegressorMetrics {
  mae: number | null;
  rmse: number | null;
  by_level?: { level: number; mae: number; mean_estimate: number; mean_true: number }[];
  by_strategy?: { strategy: string; mae: number }[];
}
export interface Experiment {
  label?: string;
  short?: string;
  features?: string[];
  n_features?: number;
  model?: string;
  classifier: ClassifierMetrics;
  regressor?: RegressorMetrics;
}
export interface EventPowerRow {
  strategy: string;
  level: number;
  k_games: number;
  roc_auc: number;
}
export interface Metrics {
  dataset?: {
    n_variants?: Record<string, number>;
    n_player_games?: Record<string, number>;
    n_source_games?: Record<string, number>;
    mean_decisions_per_player_game?: number;
    bands_test?: Record<string, number>;
    levels?: number[];
    strategies?: string[];
  };
  experiments: Partial<Record<ScoreKey, Experiment>>;
  event_power?: Partial<Record<ScoreKey, EventPowerRow[]>>;
  shap_global?: Record<string, { feature: string; mean_abs: number }[]>;
  elapsed_s?: number;
  decision_model?: {
    features?: string[];
    levels_used?: number[];
    test_roc_auc?: number;
    test_pr_auc?: number;
    test_pos_rate?: number;
    by_strategy?: Record<string, number>;
  };
  projection?: {
    kappa?: Record<string, number>;
    hard_threshold?: number;
    easy_threshold?: number;
    n_cells?: number;
  };
  analysis?: { engine?: string; depth?: number; multipv?: number; maia_model?: string };
  config?: {
    opening_skip_plies?: number;
    decided_eval_cp?: number;
    near_optimal_cp?: number;
    subtle_max_loss_cp?: number;
    prefilter_depth?: number;
    prefilter_decided_cp?: number;
    split_fractions?: Record<string, number>;
    seed?: number;
    levels?: number[];
    eval_cap_cp?: number;
    max_analyzed_ply?: number;
  };
  baseline_calibration?: Record<string, ZCalibration | undefined>;
  versions?: Record<string, string>;
  hyperparameters?: Record<string, unknown>;
  feature_groups?: Record<string, string[]>;
  score_histograms?: Partial<
    Record<ModelKey, { edges: number[]; clean: number[]; by_level: Record<string, number[]> }>
  >;
  paired_auc_bootstrap?: PairedBootstrap;
}

export interface PairedComparison {
  from: ScoreKey;
  to: ScoreKey;
  delta: number;
  ci95: [number, number];
  share_le_0: number;
}
export interface PairedBootstrap {
  method?: string;
  n_boot?: number;
  seed?: number;
  cluster?: string;
  n_clusters?: number;
  n_rows?: number;
  n_player_games?: number;
  n_positive_rows?: number;
  comparisons: PairedComparison[];
  generated_utc?: string;
}

// ---------------- provenance.json
export interface ProvenanceFile {
  path: string;
  bytes?: number;
  sha256?: string;
  modified_utc?: string;
}
export interface Provenance {
  generated_utc?: string;
  repository?: { url: string | null; commit: string | null; note?: string };
  run_id?: { value: string | null; note?: string };
  dataset_selection?: {
    source_url?: string;
    byte_range?: string;
    raw_file_bytes?: number;
    raw_file_bytes_matches_range?: boolean;
    rules?: string[];
    n_games_selected?: number;
    games_by_band?: Record<string, number>;
  };
  splits?: {
    games_assigned?: Record<string, number>;
    source_games_with_player_games?: Record<string, number>;
    player_games?: Record<string, number>;
    rows_including_originals?: Record<string, number>;
    injected_variants?: Record<string, number>;
    note?: string;
  };
  checkpoint?: { maia3_commit?: string; maia3_checkpoint?: string; revision?: string | null; revision_note?: string };
  engine?: { name?: string; binary_sha256?: string | null; note?: string };
  environment?: { python?: string; lockfile?: string; lockfile_sha256?: string; note?: string };
  consistency_checks?: { name: string; passed: boolean; detail: string }[];
  files?: ProvenanceFile[];
  commands?: string[];
  caveats?: string[];
}

export interface ZCalibration {
  mean?: number;
  std?: number;
  frac_gt2?: number;
  frac_gt3?: number;
  normal_frac_gt2?: number;
  normal_frac_gt3?: number;
  hist_edges?: number[];
  hist?: number[];
  n?: number;
}

export type RocCurves = Partial<Record<ScoreKey, { label?: string; fpr: number[]; tpr: number[]; auc?: number }>>;

// ---------------- live API
export type JobStatus = "queued" | "stockfish" | "maia" | "features" | "done" | "error";
export interface JobState {
  id?: string;
  status: JobStatus;
  progress?: number;
  total?: number;
  report?: Report;
  error?: string;
  white?: string;
  black?: string;
  n_plies?: number;
}
