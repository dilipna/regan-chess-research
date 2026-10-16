// A tiny, deterministic transformer used for every "Toy calculation" in the LatentLens journey and labs.
//
// It has the same ORDER of operations as one Qwen3 block (pre-norm RMSNorm, causal attention, residual add,
// RMSNorm, SwiGLU MLP, residual add, final RMSNorm, LM head, softmax) but tiny sizes and fixed pseudo-random weights.
// Its predictions are NOT meaningful language predictions: the weights were never trained. Real Qwen values come only
// from recorded artifacts.

export const TOY = { d: 8, dHead: 4, mlp: 12, eps: 1e-6 } as const;

/** The running example, tokenized by the real Qwen tokenizer (recorded in tokenizer_examples / token_trace). */
export const EXAMPLE = {
  text: "The researcher opened the notebook",
  tokens: [
    { pos: 0, id: 151643, text: "<|endoftext|>", piece: "<|endoftext|>", prefix: true },
    { pos: 1, id: 785, text: "The", piece: "The", prefix: false },
    { pos: 2, id: 31085, text: " researcher", piece: "Ġresearcher", prefix: false },
    { pos: 3, id: 8930, text: " opened", piece: "Ġopened", prefix: false },
    { pos: 4, id: 279, text: " the", piece: "Ġthe", prefix: false },
    { pos: 5, id: 37166, text: " notebook", piece: "Ġnotebook", prefix: false },
  ],
} as const;

export const TOY_VOCAB = [".", ",", " and", " to", " with", " in", " was", "\n"] as const;

// ------------------------------------------------------------------ deterministic pseudo-random numbers
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussMatrix(rows: number, cols: number, seed: number, scale: number): number[][] {
  const r = mulberry32(seed);
  const g = () => { const u = Math.max(r(), 1e-9), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => Math.round(g() * scale * 100) / 100));
}

// ------------------------------------------------------------------ fixed toy weights ("learned" in a real model)
const W = {
  // one embedding row per token id, derived from the id so the same token always gets the same row
  embedRow: (id: number) => gaussMatrix(1, TOY.d, 1000 + (id % 997), 0.6)[0],
  gain1: gaussMatrix(1, TOY.d, 11, 0.15)[0].map((v) => Math.round((1 + v) * 100) / 100),
  gain2: gaussMatrix(1, TOY.d, 12, 0.15)[0].map((v) => Math.round((1 + v) * 100) / 100),
  gainF: gaussMatrix(1, TOY.d, 13, 0.15)[0].map((v) => Math.round((1 + v) * 100) / 100),
  Wq: gaussMatrix(TOY.d, TOY.dHead, 21, 0.5),
  Wk: gaussMatrix(TOY.d, TOY.dHead, 22, 0.5),
  Wv: gaussMatrix(TOY.d, TOY.dHead, 23, 0.5),
  Wo: gaussMatrix(TOY.dHead, TOY.d, 24, 0.5),
  Wgate: gaussMatrix(TOY.d, TOY.mlp, 31, 0.4),
  Wup: gaussMatrix(TOY.d, TOY.mlp, 32, 0.4),
  Wdown: gaussMatrix(TOY.mlp, TOY.d, 33, 0.3),
  Wlm: gaussMatrix(TOY.d, TOY_VOCAB.length, 41, 0.6),
};
export const TOY_WEIGHTS = W;

// ------------------------------------------------------------------ operations
export const matvec = (x: number[], M: number[][]) => M[0].map((_, j) => x.reduce((s, xi, i) => s + xi * M[i][j], 0));
export const add = (a: number[], b: number[]) => a.map((v, i) => v + b[i]);
export const silu = (z: number) => z / (1 + Math.exp(-z));
export const rms = (x: number[]) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);
export const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);

export function rmsnorm(x: number[], gain: number[], eps: number = TOY.eps) {
  const meanSquare = x.reduce((s, v) => s + v * v, 0) / x.length;
  const denom = Math.sqrt(meanSquare + eps);
  const normalized = x.map((v) => v / denom);
  return { meanSquare, denom, normalized, out: normalized.map((v, i) => v * gain[i]) };
}

export function layernorm(x: number[], gain: number[] = x.map(() => 1), bias: number[] = x.map(() => 0), eps = 1e-5) {
  const mean = x.reduce((s, v) => s + v, 0) / x.length;
  const centered = x.map((v) => v - mean);
  const variance = centered.reduce((s, v) => s + v * v, 0) / x.length;
  const denom = Math.sqrt(variance + eps);
  return { mean, centered, variance, denom, out: centered.map((v, i) => (v / denom) * gain[i] + bias[i]) };
}

/** Numerically stable softmax. temperature 0 means greedy: all probability on the argmax (no division by zero). */
export function softmax(z: number[], temperature = 1): number[] {
  if (temperature <= 0) {
    const m = z.indexOf(Math.max(...z));
    return z.map((_, i) => (i === m ? 1 : 0));
  }
  const s = z.map((v) => v / temperature);
  const m = Math.max(...s);
  const e = s.map((v) => Math.exp(v - m));
  const tot = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / tot);
}

export interface AttentionResult {
  q: number[][]; k: number[][]; v: number[][];
  scores: number[][];        // q . k (raw)
  scaled: number[][];        // / sqrt(d_head)
  masked: (number | null)[][]; // null = future position (masked)
  weights: number[][];       // softmax over visible positions; 0 for masked
  out: number[][];           // weighted sum of v
}

export function causalAttention(xs: number[][], Wq = W.Wq, Wk = W.Wk, Wv = W.Wv): AttentionResult {
  const q = xs.map((x) => matvec(x, Wq)), k = xs.map((x) => matvec(x, Wk)), v = xs.map((x) => matvec(x, Wv));
  const dh = q[0].length;
  const scores = q.map((qi) => k.map((kj) => dot(qi, kj)));
  const scaled = scores.map((r) => r.map((s) => s / Math.sqrt(dh)));
  const masked = scaled.map((r, t) => r.map((s, j) => (j > t ? null : s)));
  const weights = masked.map((r) => {
    const vis = r.filter((s): s is number => s !== null);
    const m = Math.max(...vis);
    const e = r.map((s) => (s === null ? 0 : Math.exp(s - m)));
    const tot = e.reduce((a, b) => a + b, 0);
    return e.map((x) => x / tot);
  });
  const out = weights.map((w) => v[0].map((_, c) => w.reduce((s, wj, j) => s + wj * v[j][c], 0)));
  return { q, k, v, scores, scaled, masked, weights, out };
}

export function swiglu(x: number[]) {
  const gate = matvec(x, W.Wgate), up = matvec(x, W.Wup);
  const act = gate.map(silu);
  const prod = act.map((a, i) => a * up[i]);
  return { gate, up, act, prod, down: matvec(prod, W.Wdown) };
}

export interface ToyForward {
  ids: number[];
  embed: number[][];
  norm1: ReturnType<typeof rmsnorm>[];
  attn: AttentionResult;
  attnUpdate: number[][];
  mid: number[][];
  norm2: ReturnType<typeof rmsnorm>[];
  mlp: ReturnType<typeof swiglu>[];
  out: number[][];
  finalNorm: ReturnType<typeof rmsnorm>[];
  logits: number[][];
  probs: number[][];
}

/** One toy block over the whole sequence. `skip` removes a branch to show what the residual path alone carries. */
export function toyForward(ids: number[], skip: { attention?: boolean; mlp?: boolean } = {}): ToyForward {
  const embed = ids.map((id) => W.embedRow(id));
  const norm1 = embed.map((x) => rmsnorm(x, W.gain1));
  const attn = causalAttention(norm1.map((n) => n.out));
  const attnUpdate = attn.out.map((o) => (skip.attention ? new Array<number>(TOY.d).fill(0) : matvec(o, W.Wo)));
  const mid = embed.map((x, t) => add(x, attnUpdate[t]));
  const norm2 = mid.map((x) => rmsnorm(x, W.gain2));
  const mlp = norm2.map((n) => swiglu(n.out));
  const out = mid.map((x, t) => (skip.mlp ? x.slice() : add(x, mlp[t].down)));
  const finalNorm = out.map((x) => rmsnorm(x, W.gainF));
  const logits = finalNorm.map((n) => matvec(n.out, W.Wlm));
  return { ids, embed, norm1, attn, attnUpdate, mid, norm2, mlp, out, finalNorm, logits, probs: logits.map((z) => softmax(z)) };
}

// ------------------------------------------------------------------ sampling (seeded, reproducible)
export function sampleIndex(p: number[], u: number): number {
  let c = 0;
  for (let i = 0; i < p.length; i++) {
    c += p[i];
    if (u < c) return i;
  }
  return p.length - 1;
}

export function seededDraws(p: number[], n: number, seed: number): number[] {
  const r = mulberry32(seed);
  return Array.from({ length: n }, () => sampleIndex(p, r()));
}

// ------------------------------------------------------------------ training (one softmax layer, exact gradient)
export interface TrainState { W: number[][]; h: number[] }

/** logits z = h W; loss = -log softmax(z)[target]; dL/dz = p - onehot; dL/dW = h^T (p - onehot). */
export function trainStep(s: TrainState, target: number, lr: number) {
  const z = matvec(s.h, s.W);
  const p = softmax(z);
  const loss = -Math.log(p[target]);
  const dz = p.map((pi, i) => pi - (i === target ? 1 : 0));
  const grad = s.W.map((row, i) => row.map((_, j) => s.h[i] * dz[j]));
  const next = s.W.map((row, i) => row.map((w, j) => w - lr * grad[i][j]));
  const pNext = softmax(matvec(s.h, next));
  return { z, p, loss, dz, grad, next, pNext, lossNext: -Math.log(pNext[target]) };
}

export const r2 = (x: number) => Math.round(x * 100) / 100;
export const r3 = (x: number) => Math.round(x * 1000) / 1000;
