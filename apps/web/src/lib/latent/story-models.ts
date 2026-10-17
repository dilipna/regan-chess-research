// The small computations behind the LLM Storybook. Every one runs in the browser and is a toy unless its caller
// passes recorded Qwen numbers in (the sampling wheel). Pure functions, so the tests can check them exactly.

import { mulberry32 } from "./toy-model";

// ---------- 1. A counting machine (a bigram model) ----------

export type Counts = Record<string, Record<string, number>>;
export const END = ".";

/** Lower-case words; every sentence ends with "." so the machine also learns where sentences stop. */
export function kidWords(s: string): string[] {
  const w = s.toLowerCase().replace(/[^a-z\s.]/g, " ").replace(/\./g, " . ").split(/\s+/).filter(Boolean);
  if (w.length && w[w.length - 1] !== END) w.push(END);
  return w;
}

/** Count every "word, then next word" pair. Sentences start after an END, so START is END. Returns a new table. */
export function learn(counts: Counts, sentence: string): Counts {
  const w = [END, ...kidWords(sentence)];
  const out: Counts = Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, { ...v }]));
  for (let i = 0; i + 1 < w.length; i++) {
    const row = (out[w[i]] ??= {});
    row[w[i + 1]] = (row[w[i + 1]] ?? 0) + 1;
  }
  return out;
}

export function nextChoices(counts: Counts, word: string): { word: string; n: number; p: number }[] {
  const row = counts[word] ?? {};
  const total = Object.values(row).reduce((a, b) => a + b, 0);
  return Object.entries(row).map(([w, n]) => ({ word: w, n, p: n / total })).sort((a, b) => b.n - a.n || a.word.localeCompare(b.word));
}

/** Make a sentence by repeatedly drawing the next word in proportion to its count. */
export function babble(counts: Counts, seed: number, maxWords = 12): string[] {
  const rand = mulberry32(seed);
  const out: string[] = [];
  let cur = END;
  for (let i = 0; i < maxWords; i++) {
    const ch = nextChoices(counts, cur);
    if (!ch.length) break;
    let u = rand(), pick = ch[ch.length - 1].word;
    for (const c of ch) { if ((u -= c.p) < 0) { pick = c.word; break; } }
    out.push(pick);
    if (pick === END) break;
    cur = pick;
  }
  return out;
}

// ---------- 2. Practice: gradient descent on next-word scores ----------

export function softmax(z: number[], T = 1): number[] {
  const m = Math.max(...z.map((v) => v / T));
  const e = z.map((v) => Math.exp(v / T - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

/** One step of gradient descent on the surprise (-ln p) of one example. Gradient of the scores is p - onehot. */
export function practiceStep(scores: number[], target: number, lr: number): number[] {
  const p = softmax(scores);
  return scores.map((s, i) => s - lr * (p[i] - (i === target ? 1 : 0)));
}

/** Average surprise over a set of examples, in nats. */
export function surprise(scores: number[], examples: number[]): number {
  const p = softmax(scores);
  return examples.reduce((a, t) => a - Math.log(p[t]), 0) / examples.length;
}

// ---------- 3. The word wheel: recorded Qwen scores at a recorded temperature ----------

export interface Scored { text: string; logit: number }

/** Exact shares at temperature T, using the recorded full-vocabulary normalizer log-sum-exp(z/T). */
export function sharesAt(top: Scored[], lse: number, T: number): { slices: { text: string; p: number }[]; rest: number } {
  const slices = top.map((t) => ({ text: t.text, p: Math.exp(t.logit / T - lse) }));
  const rest = Math.max(0, 1 - slices.reduce((a, s) => a + s.p, 0));
  return { slices, rest };
}

/** Index of the slice a uniform number u in [0, 1) lands in; slices.length means "everything else". */
export function spin(ps: number[], u: number): number {
  for (let i = 0; i < ps.length; i++) { if ((u -= ps[i]) < 0) return i; }
  return ps.length;
}

// ---------- 4. A flashlight: one toy attention step ----------

export interface ToyWord { text: string; key: [number, number] }
/** Scores q·k / sqrt(2), then softmax, over the words before the query (a causal look back). */
export function attend(words: ToyWord[], query: [number, number]): number[] {
  return softmax(words.map((w) => (w.key[0] * query[0] + w.key[1] * query[1]) / Math.SQRT2));
}

// ---------- 5. A school of helpers: toy mixture-of-experts routing ----------

/** Pick k distinct routed helpers out of n (helper 0 is the shared helper and always answers). Deterministic per word. */
export function route(word: string, n: number, k: number): number[] {
  let h = 2166136261;
  for (const c of word.toLowerCase()) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rand = mulberry32(h >>> 0);
  const scores = Array.from({ length: n }, (_, i) => (i === 0 ? -Infinity : rand()));
  return scores.map((s, i) => [s, i] as const).sort((a, b) => b[0] - a[0]).slice(0, k).map(([, i]) => i).sort((a, b) => a - b);
}

// ---------- 6. Word codes: nearest neighbours in a 3-number toy space ----------

export interface CodeWord { word: string; emoji: string; code: [number, number, number] }
export function nearest(words: CodeWord[], code: [number, number, number], k = 3): { w: CodeWord; d: number }[] {
  return words
    .map((w) => ({ w, d: Math.hypot(w.code[0] - code[0], w.code[1] - code[1], w.code[2] - code[2]) }))
    .sort((a, b) => a.d - b.d || a.w.word.localeCompare(b.w.word))
    .slice(0, k);
}

// ---------- 7. Learning from preferences: a two-feature reward, Bradley-Terry style ----------

/** Update reward weights so the chosen answer scores higher than the other one (one logistic step). */
export function preferStep(w: number[], chosen: number[], other: number[], lr = 1): number[] {
  const diff = chosen.map((c, i) => c - other[i]);
  const margin = diff.reduce((a, d, i) => a + d * w[i], 0);
  const g = 1 / (1 + Math.exp(margin));                // = 1 - sigmoid(margin): big when the model still disagrees
  return w.map((wi, i) => wi + lr * g * diff[i]);
}
