// Glass Box: parse recorded Qwen3-8B block tensors and re-derive each operation in the browser.
// Each check compares a formula applied to recorded INPUTS with the recorded OUTPUT. Alternative (wrong) formulas are
// offered so a reader can see that only the operation Qwen actually uses reproduces its numbers.

export interface GbArrayIndex { name: string; shape: number[]; offset: number }
export interface GbLayerMeta {
  layer: number; file: string; floats: number; arrays: GbArrayIndex[];
  python_ledger: { check: string; max_err_rel_to_max: number; median_rel_err: number; uses: string }[];
}
export interface GbManifest {
  status: "ok"; model_id: string; revision: string; dtype: string; text: string;
  tokens: { pos: number; id: number; text: string; prefix: boolean }[];
  query_position: number; n_heads: number; n_kv_heads: number; head_dim: number; hidden_size: number; intermediate_size: number;
  rms_norm_eps: number; rope_theta: number; n_layers: number; layers: GbLayerMeta[]; notes: string[];
}
export type GbArrays = Record<string, Float64Array>;

/** Split a little-endian float32 buffer into named arrays (as float64 for exact browser arithmetic). */
export function parseLayer(meta: GbLayerMeta, buf: ArrayBuffer): GbArrays {
  const dv = new DataView(buf);
  if (buf.byteLength !== meta.floats * 4) throw new Error(`expected ${meta.floats * 4} bytes, got ${buf.byteLength}`);
  const out: GbArrays = {};
  for (const a of meta.arrays) {
    const n = a.shape.reduce((x, y) => x * y, 1);
    const arr = new Float64Array(n);
    for (let i = 0; i < n; i++) arr[i] = dv.getFloat32((a.offset + i) * 4, true);
    out[a.name] = arr;
  }
  return out;
}

export interface Comparison { maxRel: number; medianRel: number }
/** Same metric as the Python ledger: max |a-b| / max|b|, and the median of |a-b| / (|b| + 1e-3 max|b|). */
export function compare(got: ArrayLike<number>, ref: ArrayLike<number>): Comparison {
  let scale = 1e-12;
  for (let i = 0; i < ref.length; i++) scale = Math.max(scale, Math.abs(ref[i]));
  let maxAbs = 0;
  const rel: number[] = new Array(ref.length);
  for (let i = 0; i < ref.length; i++) {
    const d = Math.abs(got[i] - ref[i]);
    maxAbs = Math.max(maxAbs, d);
    rel[i] = d / (Math.abs(ref[i]) + 1e-3 * scale);
  }
  rel.sort((a, b) => a - b);
  return { maxRel: maxAbs / scale, medianRel: rel[Math.floor(rel.length / 2)] };
}

/** bfloat16 keeps 8 significant bits; two or three roundings stay well below 3% of the vector's largest value. */
export const MATCH_TOLERANCE = 0.03;

export interface Ranked { id: string; label: string; correct?: boolean; cmp: Comparison; ratio: number; best: boolean }
/** Model selection: run every candidate formula, rank by median relative error (robust to the few huge activations),
 *  and report how many times worse each is than the best. */
export function rankVariants(check: GbCheck, A: GbArrays, m: GbManifest, pos: number): Ranked[] {
  const rows = check.variants.map((v) => { const { got, ref } = check.run(A, m, v.id, pos); return { ...v, cmp: compare(got, ref) }; });
  const best = Math.min(...rows.map((r) => r.cmp.medianRel));
  return rows.map((r) => ({ ...r, ratio: r.cmp.medianRel / Math.max(best, 1e-12), best: r.cmp.medianRel === best }));
}

// ------------------------------------------------------------------ operations and their alternatives
function rowsNorm(x: Float64Array, rowLen: number, gain: Float64Array | null, eps: number, mode: "rms" | "layer" | "l2"): Float64Array {
  const out = new Float64Array(x.length);
  for (let r = 0; r < x.length / rowLen; r++) {
    const o = r * rowLen;
    let mean = 0, ss = 0;
    for (let i = 0; i < rowLen; i++) mean += x[o + i];
    mean /= rowLen;
    for (let i = 0; i < rowLen; i++) { const v = mode === "layer" ? x[o + i] - mean : x[o + i]; ss += v * v; }
    const denom = mode === "l2" ? Math.sqrt(ss + eps) : Math.sqrt(ss / rowLen + eps);
    for (let i = 0; i < rowLen; i++) {
      const v = mode === "layer" ? x[o + i] - mean : x[o + i];
      out[o + i] = (v / denom) * (gain ? gain[i % gain.length] : 1);
    }
  }
  return out;
}

function rope(x: Float64Array, heads: number, dim: number, pos: number, theta: number, mode: "half" | "interleaved" | "none"): Float64Array {
  const out = new Float64Array(x.length);
  const half = dim / 2;
  for (let h = 0; h < heads; h++) {
    const o = h * dim;
    for (let i = 0; i < half; i++) {
      const ang = pos * Math.pow(theta, -(2 * i) / dim), c = Math.cos(ang), s = Math.sin(ang);
      if (mode === "none") { out[o + i] = x[o + i]; out[o + i + half] = x[o + i + half]; continue; }
      const [a, b] = mode === "half" ? [o + i, o + i + half] : [o + 2 * i, o + 2 * i + 1];
      out[a] = x[a] * c - x[b] * s;
      out[b] = x[b] * c + x[a] * s;
    }
  }
  return out;
}

function attentionProbs(A: GbArrays, m: GbManifest, scaleMode: "sqrt" | "none" | "full", groupMode: "grouped" | "modulo"): Float64Array {
  const H = m.n_heads, KV = m.n_kv_heads, D = m.head_dim, T = m.query_position + 1, G = H / KV;
  const out = new Float64Array(H * T);
  const scale = scaleMode === "sqrt" ? 1 / Math.sqrt(D) : scaleMode === "full" ? 1 / D : 1;
  for (let h = 0; h < H; h++) {
    const kvh = groupMode === "grouped" ? Math.floor(h / G) : h % KV;
    const s = new Array(T).fill(0);
    for (let t = 0; t < T; t++) for (let d = 0; d < D; d++) s[t] += A.q_rope[h * D + d] * A.k_rope_all[(t * KV + kvh) * D + d];
    const sc = s.map((v) => v * scale), mx = Math.max(...sc);
    const e = sc.map((v) => Math.exp(v - mx)), z = e.reduce((a, b) => a + b, 0);
    for (let t = 0; t < T; t++) out[h * T + t] = e[t] / z;
  }
  return out;
}

function weightedSum(A: GbArrays, m: GbManifest, groupMode: "grouped" | "modulo"): Float64Array {
  const H = m.n_heads, KV = m.n_kv_heads, D = m.head_dim, T = m.query_position + 1, G = H / KV;
  const out = new Float64Array(H * D);
  for (let h = 0; h < H; h++) {
    const kvh = groupMode === "grouped" ? Math.floor(h / G) : h % KV;
    for (let t = 0; t < T; t++) {
      const p = A.attn_probs[h * T + t];
      for (let d = 0; d < D; d++) out[h * D + d] += p * A.v_all[(t * KV + kvh) * D + d];
    }
  }
  return out;
}

const silu = (z: number) => z / (1 + Math.exp(-z));
const relu = (z: number) => Math.max(0, z);

export interface GbVariant { id: string; label: string; correct?: boolean }
export interface GbCheck {
  id: string; title: string; operation: string; uses: string; variants: GbVariant[]; usesPosition?: boolean;
  run: (A: GbArrays, m: GbManifest, variant: string, pos: number) => { got: ArrayLike<number>; ref: ArrayLike<number> };
}

export const CHECKS: GbCheck[] = [
  { id: "rms1", title: "RMSNorm #1 (input_layernorm)", operation: "g ⊙ x / √(mean(x²) + ε)", uses: "residual entering the block, learned gain",
    variants: [{ id: "rms", label: "RMSNorm", correct: true }, { id: "layer", label: "LayerNorm (subtract the mean)" }, { id: "nogain", label: "RMSNorm without the learned gain" }],
    run: (A, m, v) => ({ got: rowsNorm(A.resid_pre, m.hidden_size, v === "nogain" ? null : A.gain_in, m.rms_norm_eps, v === "layer" ? "layer" : "rms"), ref: A.attn_norm }) },
  { id: "qnorm", title: "Q RMSNorm (q_norm)", operation: "RMSNorm over each 128-number query head", uses: "q_proj output, q_norm gain",
    variants: [{ id: "head", label: "per head (128 numbers)", correct: true }, { id: "whole", label: "over all 4,096 numbers at once" }, { id: "nogain", label: "per head, no gain" }],
    run: (A, m, v) => ({ got: rowsNorm(A.q_raw, v === "whole" ? m.n_heads * m.head_dim : m.head_dim, v === "nogain" ? null : A.gain_q, m.rms_norm_eps, "rms"), ref: A.q_normed }) },
  { id: "knorm", title: "K RMSNorm (k_norm)", operation: "RMSNorm over each 128-number key head", uses: "k_proj output, k_norm gain",
    variants: [{ id: "head", label: "per head (128 numbers)", correct: true }, { id: "whole", label: "over all 1,024 numbers at once" }],
    run: (A, m, v) => ({ got: rowsNorm(A.k_raw, v === "whole" ? m.n_kv_heads * m.head_dim : m.head_dim, A.gain_k, m.rms_norm_eps, "rms"), ref: A.k_normed }) },
  { id: "rope", title: "RoPE on the query", operation: "rotate pairs (i, i+64) by position × θ^(−2i/128)", uses: "normalized query, position, θ", usesPosition: true,
    variants: [{ id: "half", label: "rotate-half pairs (i, i+64)", correct: true }, { id: "interleaved", label: "interleaved pairs (2i, 2i+1)" }, { id: "none", label: "no rotation" }],
    run: (A, m, v, pos) => ({ got: rope(A.q_normed, m.n_heads, m.head_dim, pos, m.rope_theta, v as "half" | "interleaved" | "none"), ref: A.q_rope }) },
  { id: "softmax", title: "Scores, scaling and softmax", operation: "softmax(q·k / √128) over the 6 visible positions, per head", uses: "rotated query, rotated keys of every position",
    variants: [{ id: "sqrt", label: "divide by √128", correct: true }, { id: "none", label: "no scaling" }, { id: "full", label: "divide by 128" }],
    run: (A, m, v) => ({ got: attentionProbs(A, m, v as "sqrt" | "none" | "full", "grouped"), ref: A.attn_probs }) },
  { id: "wsum", title: "Weighted sum of values (grouped-query)", operation: "Σ_t p[h,t] · v[t, ⌊h/4⌋]", uses: "attention probabilities, values of every position",
    variants: [{ id: "grouped", label: "query head h uses KV head ⌊h/4⌋", correct: true }, { id: "modulo", label: "query head h uses KV head h mod 8" }],
    run: (A, m, v) => ({ got: weightedSum(A, m, v as "grouped" | "modulo"), ref: A.attn_concat }) },
  { id: "res1", title: "Residual addition #1", operation: "x′ = x + attention update", uses: "residual entering, o_proj output",
    variants: [{ id: "add", label: "add the update to x", correct: true }, { id: "replace", label: "replace x by the update" }],
    run: (A, _m, v) => ({ got: v === "add" ? A.resid_pre.map((x, i) => x + A.o_out[i]) : A.o_out, ref: A.resid_mid }) },
  { id: "rms2", title: "RMSNorm #2 (post_attention_layernorm)", operation: "g ⊙ x′ / √(mean(x′²) + ε)", uses: "residual after attention, learned gain",
    variants: [{ id: "rms", label: "RMSNorm", correct: true }, { id: "layer", label: "LayerNorm (subtract the mean)" }],
    run: (A, m, v) => ({ got: rowsNorm(A.resid_mid, m.hidden_size, A.gain_post, m.rms_norm_eps, v === "layer" ? "layer" : "rms"), ref: A.mlp_norm }) },
  { id: "swiglu", title: "SwiGLU gate", operation: "SiLU(gate) ⊙ up", uses: "gate_proj and up_proj outputs",
    variants: [{ id: "silu", label: "SiLU(gate) × up", correct: true }, { id: "relu", label: "ReLU(gate) × up" }, { id: "swap", label: "gate × SiLU(up)" }],
    run: (A, _m, v) => ({ got: A.gate.map((g, i) => (v === "silu" ? silu(g) * A.up[i] : v === "relu" ? relu(g) * A.up[i] : g * silu(A.up[i]))), ref: A.act_prod }) },
  { id: "res2", title: "Residual addition #2", operation: "x″ = x′ + MLP update", uses: "residual after attention, down_proj output",
    variants: [{ id: "add", label: "add the update to x′", correct: true }, { id: "replace", label: "replace x′ by the update" }],
    run: (A, _m, v) => ({ got: v === "add" ? A.resid_mid.map((x, i) => x + A.down[i]) : A.down, ref: A.resid_post }) },
];

/** The matrix multiplications that need the large weight matrices and are shown only as recorded input → output. */
export const NOT_DERIVABLE = [
  { name: "q_proj, k_proj, v_proj", why: "4,096 × 6,144 learned weights" },
  { name: "o_proj", why: "4,096 × 4,096 learned weights" },
  { name: "gate_proj, up_proj", why: "2 × 4,096 × 12,288 learned weights" },
  { name: "down_proj", why: "12,288 × 4,096 learned weights" },
];

export const rmsOf = (x: ArrayLike<number>) => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; return Math.sqrt(s / x.length); };
export const absMax = (x: ArrayLike<number>) => { let m = 0, at = 0; for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > m) { m = Math.abs(x[i]); at = i; } return { value: m, index: at }; };
