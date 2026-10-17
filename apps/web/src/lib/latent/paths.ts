// Client-safe artifact locations (no server imports here).
export const MODEL_SLUG = "qwen3-8b";
export const BASE = `/data/latent/${MODEL_SLUG}`;
export const PATHS = {
  architecture: `${BASE}/architecture.json`,
  tokenizer: `${BASE}/tokenizer_examples.json`,
  trace: `${BASE}/token_trace.json`,
  recall: `${BASE}/recall_probe.json`,
  recallFp32: `${BASE}/recall_probe_fp32.json`,
  layerProbe: `${BASE}/layer_probe.json`,
  rmsnorm: `${BASE}/rmsnorm_probe.json`,
  component: `${BASE}/component_probe.json`,
  pca: `${BASE}/pca/index.json`,
  streaming: `${BASE}/streaming_check.json`,
  recallPrecision: `${BASE}/recall_precision_check.json`,
  generation: `${BASE}/generation_steps.json`,
  glassbox: `${BASE}/glassbox/manifest.json`,
  recallVersions: `${BASE}/recall_versions.json`,
  metadata: `${BASE}/metadata.json`,
} as const;
