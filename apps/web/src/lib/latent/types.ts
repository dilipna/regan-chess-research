// Types for the LatentLens artifacts in public/data/latent/<model>/ (written by scripts/latentlens/*.py).
// Every research artifact is either status "ok" (measured values) or "pending" (no values, a reason and a command).

export type Status = "ok" | "pending" | "failed";

export interface Pending {
  schema: string;
  status: "pending";
  model_id: string;
  reason: string;
  how_to_run: string[];
}

export interface Provenance {
  git_commit: string | null;
  timestamp: string;
  versions: Record<string, string | null>;
  hardware: { gpu?: string | null; gpu_memory_gib?: number; platform?: string };
  script?: string;
}

export interface GainStats { layer?: number; mean: number; std: number; min: number; max: number; abs_max: number; dim: number }

export interface Architecture {
  schema: string;
  status: Status;
  model_id: string;
  revision: string;
  verified: {
    num_hidden_layers: number;
    hidden_size: number;
    intermediate_size: number;
    vocab_size: number;
    tokenizer_size: number;
    num_attention_heads: number;
    num_key_value_heads: number;
    query_heads_per_kv_head: number;
    head_dim: number;
    q_proj_out: number;
    kv_proj_out: number;
    attention_bias: boolean;
    attention_scaling: number;
    norm_type: string;
    rms_norm_eps: number;
    qk_norm: boolean;
    qk_norm_dim: number;
    positional_mechanism: string;
    rope_theta: number;
    rope_scaling: unknown;
    rope_frequencies: number;
    rope_wavelength_min_tokens: number;
    rope_wavelength_max_tokens: number;
    activation: string;
    mlp_type: string;
    tie_word_embeddings: boolean;
    max_position_embeddings: number;
    sliding_window: number | null;
    use_sliding_window: boolean;
    stored_dtype: string;
    bos_token_id: number;
    eos_token_id: number;
    tokenizer_adds_bos: boolean;
    endoftext_id: number;
  };
  parameters: {
    total: number; embedding: number; lm_head: number; non_embedding: number; all_layers: number; final_norm: number;
    per_layer: { attention_projections: number; qk_norm: number; mlp: number; block_norms: number; total: number };
    stored_tensor_params: number; stored_bytes: number | null;
  };
  kv_cache: { bytes_per_token_all_layers: number; bytes_per_token_if_mha: number; dtype: string };
  layer0_parameters: { name: string; shape: number[]; numel: number }[];
  checks: { source_order: { fact: string; verified: boolean; evidence: string[] }[] };
  model_card: Record<string, string | null>;
  norm_gains: { input_layernorm: GainStats[]; post_attention_layernorm: GainStats[]; q_norm: GainStats[]; k_norm: GainStats[]; final_norm: GainStats };
  sources: { transformers_modeling_file: string; transformers_version: string; technical_report: string };
  provenance: Provenance;
}

export interface TokenPiece { id: number; piece: string; text: string; start: number; end: number; special: boolean }

export interface TokenizerExamples {
  status: Status;
  model_id: string;
  tokenizer_class: string;
  tokenizer_size: number;
  add_special_tokens_prepends: number[];
  special_tokens: Record<string, number>;
  examples: { text: string; note: string; n_chars: number; n_words: number; n_tokens: number; tokens: TokenPiece[]; roundtrip_ok: boolean }[];
  embedding: {
    tensor: string; shape: number[]; text: string;
    tokens: { id: number; piece: string; text: string; dim: number; rms: number; l2: number; mean: number; std: number; min: number; max: number; first_coords: number[] }[];
    cosine: number[][];
  };
  provenance: Provenance;
}

export interface TraceLayer {
  layer: number;
  resid_pre_rms: number[]; attn_out_rms: number[]; resid_mid_rms: number[]; mlp_out_rms: number[]; resid_post_rms: number[];
  attn_norm_rms: number[]; mlp_norm_rms: number[];
  last: { resid_pre_l2: number; attn_out_l2: number; mlp_out_l2: number; resid_post_l2: number; cos_pre_post: number; max_abs_coord: number; argmax_abs_coord: number };
  pos0_max_abs_coord: number;
  pos0_argmax_abs_coord: number;
}

export interface TokenTrace {
  status: Status;
  model_id: string;
  revision: string;
  text: string;
  dtype: string;
  loader: string;
  tokens: { pos: number; id: number; piece: string; text: string; prefix: boolean }[];
  n_layers: number;
  hidden_size: number;
  embedding_rms: number[];
  layers: TraceLayer[];
  attention: { layers: string[]; weights: Record<string, number[][][]> };
  qk_norm: Record<string, Record<"q_norm" | "k_norm", { shape_per_token: number[]; rms_in: number[]; rms_out: number[] }>>;
  positions: { context: string; true_next: string; true_id: number; rank: number; p_true: number; loss_nats: number; entropy: number; top: { id: number; text: string; p: number }[] }[];
  sentence_loss_nats: number;
  final: { top: { id: number; text: string; piece: string; logit: number; p: number }[]; logsumexp_by_temperature: Record<string, number>; entropy: number; vocab_rows: number; top_mass: number };
  diagnostic_lens_last_position: { depth: number; top: { id: number; text: string; p: number }[]; final_top_rank: number; final_top_p: number }[];
  runtime_s: number;
  provenance: Provenance;
}

export interface RecallPosition {
  t: number; true_id: number | null; true: string | null; top_id: number | null; top: string | null;
  rank: number; p_true: number; p_top: number; top1: boolean; entropy: number; margin: number; stabilization_depth: number | null;
}

export interface RecallPassage {
  name: string;
  source_file: string;
  n_tokens: number;
  n_scored: number;
  truncated: boolean;
  summary: { n: number; top1_rate: number; top5_rate: number; median_rank: number; mean_logp_true: number; perplexity: number; mean_entropy: number };
  positions: RecallPosition[];
  depth_summary: { depth: number; relative_depth: number; top1_rate: number; top10_rate: number; median_rank: number; mean_log10_rank: number; mean_margin: number; agree_with_final_top: number }[];
  depth_rank: number[][];
  depth_top_id: number[][] | null;
  depth_log10_p_true: number[][];
  median_stabilization_depth: number | null;
  token_text: Record<string, string> | null;
  text_stored: boolean;
}

export interface Recall {
  status: Status;
  model_id: string;
  revision: string;
  n_layers: number;
  dtype: string;
  loader: string;
  prefix: string;
  passages: RecallPassage[];
  provenance: Provenance;
}

export interface ProbeMetrics { n: number; n_ai: number; n_human: number; roc_auc: number | null; pr_auc: number | null; balanced_accuracy: number | null; f1: number | null; roc_auc_ci95?: number[] }

export interface LayerProbe {
  status: "ok";
  model_id: string;
  n_layers: number;
  dataset: string;
  pooling: string;
  layers: { depth: number; relative_depth: number; C: number; val: ProbeMetrics }[];
  selected_depth: number;
  final_depth: number;
  test: { selected_depth: ProbeMetrics; final_depth: ProbeMetrics };
  extra_tests: Record<string, ProbeMetrics>;
  per_generator_test: Record<string, ProbeMetrics>;
  length_matched_test: ProbeMetrics | null;
  controls: { random_labels: { seed: number; val_roc_auc: number; test_roc_auc: number }[]; baselines: Record<string, { val?: ProbeMetrics; test?: ProbeMetrics; status?: string; reason?: string }> };
  splits: Record<string, { n: number; n_human: number; n_ai: number }>;
}

export interface RmsnormProbe {
  status: "ok";
  block_rmsnorm: { layer: number; resid_pre: ProbeMetrics; attn_norm: ProbeMetrics; resid_mid: ProbeMetrics; mlp_norm: ProbeMetrics; attn_norm_minus_resid_pre: { diff: number; ci95: number[] }; mlp_norm_minus_resid_mid: { diff: number; ci95: number[] } }[];
  depths: { depth: number; raw: ProbeMetrics; unit_l2: ProbeMetrics; magnitude_only: ProbeMetrics; unit_minus_raw: { diff: number; ci95: number[] }; rms_quantiles_val: { q: number[]; human: number[]; ai: number[] } }[];
}

export interface ComponentProbe {
  status: "ok";
  sites: string[];
  layers: ({ layer: number; attention_step: { diff: number; ci95: number[] }; mlp_step: { diff: number; ci95: number[] } } & Record<string, unknown>)[];
}

export interface PcaIndex { status: "ok"; pooling: string; depths: { depth: number; file: string; explained_variance_ratio: number[] }[]; note: string }

export interface StreamingCheck {
  status: Status;
  dtype: string;
  reference: string;
  candidate: string;
  results: { text: string; positions: number; top1_agreement: number; max_abs_logprob_diff_top20: number }[];
}

export interface Distribution {
  top: { id: number; text: string; logit: number; p: number }[];
  logsumexp_by_temperature: Record<string, number>;
  top_mass: number;
  entropy: number;
}

export interface GenerationSteps {
  status: Status;
  model_id: string;
  revision: string;
  dtype: string;
  loader: string;
  prompt: string;
  procedure: string;
  step1: Distribution;
  step2: ({ appended: { id: number; text: string }; context: string } & Distribution)[];
}

export interface RecallPrecision {
  status: Status;
  compared: string[];
  passages: { name: string; n_scored: number; top1_rate: Record<string, number>; top1_flips: number }[];
  note: string;
}

export interface Metadata {
  experiment_id: string;
  git_commit: string | null;
  model_id: string;
  model_revision: string;
  transformers_version: string | null;
  torch_version: string | null;
  artifacts: Record<string, Status>;
  human_vs_ai: Record<string, unknown> & { status: Status };
  device: string | null;
  timestamp: string;
}

export type Maybe<T> = (T & { status: "ok" }) | Pending;

export function isOk<T extends { status: string }>(a: T | Pending | undefined | null): a is T {
  return !!a && a.status === "ok";
}
