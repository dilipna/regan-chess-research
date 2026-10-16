// Small, exact computations for the Learn Mode labs. These run on toy numbers chosen for teaching and are always
// labelled "toy" in the interface. Real Qwen3-8B values come only from the exported artifacts.

export const round = (x: number, d = 3) => Math.round(x * 10 ** d) / 10 ** d;

// ------------------------------------------------------------------ normalization
export interface RmsSteps { x: number[]; squares: number[]; meanSquare: number; eps: number; rms: number; normalized: number[]; gain: number[]; out: number[] }

export function rmsnormSteps(x: number[], gain: number[] = x.map(() => 1), eps = 1e-6): RmsSteps {
  const squares = x.map((v) => v * v);
  const meanSquare = squares.reduce((a, b) => a + b, 0) / x.length;
  const rms = Math.sqrt(meanSquare + eps);
  const normalized = x.map((v) => v / rms);
  return { x, squares, meanSquare, eps, rms, normalized, gain, out: normalized.map((v, i) => v * gain[i]) };
}

export function layernorm(x: number[], gain: number[] = x.map(() => 1), bias: number[] = x.map(() => 0), eps = 1e-5) {
  const mean = x.reduce((a, b) => a + b, 0) / x.length;
  const centered = x.map((v) => v - mean);
  const variance = centered.reduce((a, v) => a + v * v, 0) / x.length;
  const sd = Math.sqrt(variance + eps);
  return { mean, centered, variance, sd, out: centered.map((v, i) => (v / sd) * gain[i] + bias[i]) };
}

export const rmsOf = (x: number[]) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / x.length);
export const meanOf = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;

// ------------------------------------------------------------------ softmax and decoding
export function softmax(z: number[], temperature = 1): number[] {
  const s = z.map((v) => v / temperature);
  const m = Math.max(...s);
  const e = s.map((v) => Math.exp(v - m));
  const tot = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / tot);
}

/** Probabilities of the given (top) logits under temperature T, normalised over the FULL vocabulary by an exact
 *  log-sum-exp computed offline for that temperature. */
export function probsWithNormalizer(z: number[], temperature: number, logsumexp: number): number[] {
  return z.map((v) => Math.exp(v / temperature - logsumexp));
}

export function topKMask(p: number[], k: number): boolean[] {
  const order = p.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]);
  const keep = new Set(order.slice(0, k).map(([, i]) => i));
  return p.map((_, i) => keep.has(i));
}

/** Smallest set of highest-probability tokens whose total probability reaches p (nucleus). */
export function topPMask(probs: number[], pThreshold: number): boolean[] {
  const order = probs.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]);
  const keep = new Set<number>();
  let cum = 0;
  for (const [v, i] of order) {
    keep.add(i);
    cum += v;
    if (cum >= pThreshold) break;
  }
  return probs.map((_, i) => keep.has(i));
}

export function renormalize(p: number[], mask: boolean[]): number[] {
  const tot = p.reduce((a, v, i) => a + (mask[i] ? v : 0), 0);
  return p.map((v, i) => (mask[i] && tot > 0 ? v / tot : 0));
}

// ------------------------------------------------------------------ rotary embeddings (2D toy)
export function rotate2(v: [number, number], angle: number): [number, number] {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
}
export const dot2 = (a: [number, number], b: [number, number]) => a[0] * b[0] + a[1] * b[1];

/** Qwen3 inverse frequencies: theta^(-2i/d) for i = 0..d/2-1. */
export function ropeInvFreq(theta: number, headDim: number): number[] {
  return Array.from({ length: headDim / 2 }, (_, i) => theta ** (-(2 * i) / headDim));
}

// ------------------------------------------------------------------ causal attention (toy)
export function matmulT(a: number[][], b: number[][]): number[][] {
  return a.map((r) => b.map((c) => r.reduce((s, v, k) => s + v * c[k], 0)));
}

export function causalAttention(Q: number[][], K: number[][], V: number[][]) {
  const d = Q[0].length;
  const scores = matmulT(Q, K).map((r) => r.map((v) => v / Math.sqrt(d)));
  const masked = scores.map((r, t) => r.map((v, j) => (j > t ? -Infinity : v)));
  const weights = masked.map((r) => {
    const m = Math.max(...r.filter(Number.isFinite));
    const e = r.map((v) => (Number.isFinite(v) ? Math.exp(v - m) : 0));
    const s = e.reduce((a, b) => a + b, 0);
    return e.map((v) => v / s);
  });
  const out = weights.map((w) => V[0].map((_, c) => w.reduce((s, wj, j) => s + wj * V[j][c], 0)));
  return { scores, masked, weights, out };
}

// ------------------------------------------------------------------ SwiGLU (toy, one feature)
export const silu = (x: number) => x / (1 + Math.exp(-x));

// ------------------------------------------------------------------ backprop explorer
// Two-weight network: h = w1 * x, yhat = w2 * h, loss = (yhat - y)^2.
export function backpropStep(x: number, y: number, w1: number, w2: number, lr: number) {
  const h = w1 * x;
  const yhat = w2 * h;
  const loss = (yhat - y) ** 2;
  const dL_dyhat = 2 * (yhat - y);
  const dL_dw2 = dL_dyhat * h;          // yhat = w2 * h
  const dL_dh = dL_dyhat * w2;
  const dL_dw1 = dL_dh * x;             // h = w1 * x
  return { h, yhat, loss, dL_dyhat, dL_dw2, dL_dh, dL_dw1, next: { w1: w1 - lr * dL_dw1, w2: w2 - lr * dL_dw2 } };
}

export function crossEntropy(probs: number[], target: number) {
  return -Math.log(Math.max(probs[target], 1e-12));
}

// ------------------------------------------------------------------ formatting
export function fmtEps(e: number) {
  return e > 0 && e < 1e-3 ? e.toExponential().replace("e-", "e-") : String(e);
}
export function fmtInt(n: number) {
  return n.toLocaleString("en-US");
}
export function fmtBytes(b: number) {
  const u = ["B", "KiB", "MiB", "GiB", "TiB"];
  let i = 0;
  while (b >= 1024 && i < u.length - 1) {
    b /= 1024;
    i++;
  }
  return `${b >= 100 ? b.toFixed(0) : b >= 10 ? b.toFixed(1) : b.toFixed(2)} ${u[i]}`;
}
export function fmtProb(p: number) {
  if (p >= 0.01) return p.toFixed(3);
  if (p <= 0) return "< 1e-5"; // artifacts store probabilities rounded to 5 decimals
  const e = Math.floor(Math.log10(p));
  return `${(p / 10 ** e).toFixed(1)}e${e}`;
}
/** Shows token text with visible spaces and newlines. */
export function showTok(s: string | null | undefined) {
  if (s == null) return "";
  return s.replace(/ /g, "␣").replace(/\n/g, "↵");
}
