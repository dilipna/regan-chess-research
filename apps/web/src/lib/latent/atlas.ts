// The Transformer Atlas: the whole decoder-only transformer at four zoom levels (model, one block, attention, MLP).
// Every node carries the five-idea explanation from parts.ts plus a memory hook. Numbers come from the VERIFIED
// architecture (architecture.json); layouts are hand-placed coordinates in a 460-wide SVG viewBox.
import { blockParts, dims, pipelineParts, type Part } from "./parts";
import type { AtlasExample } from "./atlas-example";
import type { Architecture } from "./types";

export type Role = "resid" | "norm" | "attn" | "mlp" | "io";
export type LevelId = "model" | "block" | "attention" | "mlp";

export interface AtlasPart extends Part { hook: string }

export interface AtlasNode {
  id: string;
  label: string;
  sub?: string;
  role: Role;
  x: number; y: number; w: number; h: number;   // centre and size
  kind?: "box" | "op" | "stack";
  badge?: string;                   // e.g. "×36" on the block stack
  dive?: LevelId;
  part: AtlasPart;
}

export interface AtlasEdge {
  from: string;
  to: string;
  d?: string;                       // custom path; otherwise straight or elbow
  label?: string;
  lx?: number; ly?: number;         // label position
  anchor?: "start" | "end";
  resid?: boolean;                  // drawn as the residual stream
}

export interface AtlasLevel {
  id: LevelId;
  tab: string;
  title: string;
  mnemonic: string;
  summary: string;
  parent?: LevelId;
  width: number;
  height: number;
  nodes: AtlasNode[];
  edges: AtlasEdge[];
  order: string[];                  // the path a token takes; drives the tour and Prev/Next
}

export const ROLE_NAME: Record<Role, string> = {
  resid: "Residual stream", norm: "Normalization", attn: "Attention", mlp: "MLP", io: "Input / output",
};

export const ROLE_COLOR: Record<Role, string> = {
  resid: "var(--role-resid)", norm: "var(--role-norm)", attn: "var(--role-attn)", mlp: "var(--role-mlp)", io: "#a9b6cb",
};
export const ROLE_INK: Record<Role, string> = {
  resid: "var(--role-resid-ink)", norm: "var(--role-norm-ink)", attn: "var(--role-attn-ink)", mlp: "var(--role-mlp-ink)", io: "#cdd6e4",
};
const fmt = (n: number) => n.toLocaleString("en-US");

function hookFor(id: string, d: ReturnType<typeof dims>): string {
  const hooks: Record<string, string> = {
    text: "Strings in. The network can't read letters, so step one is turning text into numbers.",
    tokenizer: "Scissors. Cut the text into familiar pieces from a fixed menu.",
    ids: "Locker numbers. Each one points to a row in a table. On its own it means nothing.",
    embedding: `A dictionary lookup. The id goes in and a ${fmt(d.d)}-number meaning card comes out.`,
    residual: "The highway. Every block merges an update onto it. No block ever tears it up.",
    blocks: `Same floor plan, ${d.L} different floors. The architecture repeats but the weights don't.`,
    final_norm: "Steady the voice before speaking. One last rescale, then read out.",
    lm_head: `Hold the thought up against all ${fmt(d.V)} vocabulary entries and score each one.`,
    logits: "Raw votes, not percentages. Only the gaps between them matter.",
    softmax: "Votes become a pie chart that always adds up to 100%.",
    next: "Pick a slice, append it, repeat. That loop is all of generation.",
    resid_in: "The highway entering this floor. It carries everything learned so far.",
    norm1: "Set the volume to a standard level before attention listens.",
    attn: "Look back and borrow. The only place tokens talk to each other.",
    add1: "Write in pen on top. Never erase.",
    norm2: "Same volume knob, its own setting, before the MLP thinks.",
    mlp: "Think privately. Each token on its own: expand, gate, contract.",
    add2: "Second note added to the highway. Still nothing erased.",
    next_block: `Hand the highway up one floor. Repeat ${d.L} times.`,
    a_in: "Attention only ever sees a normalized copy, never the stream itself.",
    q: "Q is the question: what am I looking for?",
    k: "K is the label: what can I be found by?",
    v: `V is the content: what do I hand over if chosen? Each V head is shared by ${d.G} query heads.`,
    qknorm: "Same-length arrows. Matches can't blow up just because a vector got long.",
    rope: "Clock hands. Position becomes rotation, and only the gap between two hands matters.",
    scores: "Every question meets every label. Result: a T × T table of match scores.",
    mask: "No peeking at the future. Later positions are blanked out.",
    attn_softmax: "Each row of matches becomes an attention budget that adds up to 1.",
    weighted: "Blend the contents you paid attention to.",
    oproj: `${d.H} reports stapled together, then translated back into the stream's language.`,
    a_out: "An update, not a replacement. It is about to be added to the highway.",
    m_in: "The MLP also reads a normalized copy, one position at a time.",
    gate: "The bouncer. It decides how much of each feature gets through.",
    up: "The crowd at the door: candidate features waiting to get in.",
    silu: "A soft switch. Negative mostly off, positive passes through.",
    mul: "Gate × content. Features survive only where the bouncer says yes.",
    down: `Compress ${fmt(d.F)} features back to ${fmt(d.d)} so it fits on the highway.`,
    m_out: "Another update for the highway. The MLP never looked at other positions.",
  };
  return hooks[id] ?? "";
}

const P = (part: Part, d: ReturnType<typeof dims>, id = part.id): AtlasPart => ({ ...part, hook: hookFor(id, d) });

export function atlasLevels(a: Architecture, ex?: AtlasExample): AtlasLevel[] {
  const d = dims(a);
  const pp = Object.fromEntries(pipelineParts(a).map((p) => [p.id, p]));
  const bp = Object.fromEntries(blockParts(a).map((p) => [p.id, p]));
  const per = a.parameters.per_layer;
  const mlpShare = Math.round((per.mlp / per.total) * 100);
  const scale = (1 / Math.sqrt(d.dh)).toFixed(4);

  // ---------- Level 1: the whole model ----------
  const W = 460, cx = 230, bw = 230, bh = 38;
  const model: AtlasLevel = {
    id: "model", tab: "The model", title: "The whole model",
    mnemonic: `Look up → Mix + Think (×${d.L}) → Read out`,
    summary: `A decoder-only transformer turns text into token ids, looks each id up as a ${fmt(d.d)}-number vector, then passes those vectors through ${d.L} identical-looking blocks. Each block lets tokens mix information (attention) and then transforms each token on its own (MLP), always by adding to one running vector per position, the residual stream. A final read-out scores every word in the vocabulary, and one is chosen. Repeat for the next word.`,
    width: W, height: 716,
    nodes: [
      { id: "text", label: "Text", sub: `“${ex?.text ?? "The researcher opened the notebook"}”`, role: "io", x: cx, y: 32, w: 270, h: bh, part: P(pp.text, d) },
      { id: "tokenizer", label: "Tokenizer", sub: "byte-level BPE", role: "io", x: cx, y: 94, w: bw, h: bh, part: P(pp.tokenizer, d) },
      { id: "ids", label: "Token IDs", sub: "integers", role: "io", x: cx, y: 156, w: bw, h: bh, part: P(pp.ids, d) },
      { id: "embedding", label: "Embedding lookup", sub: `${fmt(d.V)} × ${fmt(d.d)} table`, role: "resid", x: cx, y: 218, w: bw, h: bh, part: P(pp.embedding, d) },
      { id: "blocks", label: `Transformer block`, sub: "attention + MLP", role: "resid", kind: "stack", badge: `×${d.L}`, dive: "block", x: cx, y: 336, w: 270, h: 104,
        part: P({ ...pp.blocks, mechanism: pp.blocks.mechanism + ` Each block holds ${(per.total / 1e6).toFixed(1)}M parameters, about ${mlpShare}% of them in the MLP.` }, d) },
      { id: "final_norm", label: "Final RMSNorm", sub: "model.norm", role: "norm", x: cx, y: 456, w: bw, h: bh, part: P(pp.final_norm, d) },
      { id: "lm_head", label: "LM head", sub: `${fmt(d.d)} → ${fmt(d.V)}`, role: "io", x: cx, y: 518, w: bw, h: bh, part: P(pp.lm_head, d) },
      { id: "logits", label: "Logits", sub: "one score per entry", role: "io", x: cx, y: 580, w: bw, h: bh, part: P(pp.logits, d) },
      { id: "softmax", label: "Softmax → sample", sub: "probabilities", role: "io", x: cx, y: 642, w: bw, h: bh,
        part: P({ ...pp.softmax, mechanism: pp.softmax.mechanism + " " + pp.next.mechanism, why: pp.softmax.why + " " + pp.next.why, confusion: pp.softmax.confusion }, d) },
      { id: "next", label: `“${ex?.top[0]?.label ?? "."}”`, sub: "next token, appended", role: "io", x: cx, y: 692, w: 170, h: 38, part: P(pp.next, d) },
    ],
    edges: [
      { from: "text", to: "tokenizer" },
      { from: "tokenizer", to: "ids", label: "T pieces", lx: cx + 10, ly: 128 },
      { from: "ids", to: "embedding", label: "[T]", lx: cx + 10, ly: 190 },
      { from: "embedding", to: "blocks", resid: true, label: `[T, ${fmt(d.d)}]`, lx: cx + 12, ly: 266 },
      { from: "blocks", to: "final_norm", resid: true, label: `[T, ${fmt(d.d)}]`, lx: cx + 12, ly: 414 },
      { from: "final_norm", to: "lm_head" },
      { from: "lm_head", to: "logits", label: `[T, ${fmt(d.V)}]`, lx: cx + 10, ly: 552 },
      { from: "logits", to: "softmax" },
      { from: "softmax", to: "next" },
    ],
    order: ["text", "tokenizer", "ids", "embedding", "blocks", "final_norm", "lm_head", "logits", "softmax", "next"],
  };

  // ---------- Level 2: one block ----------
  const sx = 112, bx = 318, sw = 196;
  const block: AtlasLevel = {
    id: "block", tab: "One block", title: `Inside one block (×${d.L})`, parent: "model",
    mnemonic: "Normalize a copy → Attend → Add.   Normalize a copy → MLP → Add.",
    summary: `The residual stream runs straight down the left. Each block has two side branches. Each branch reads a normalized copy of the stream, computes an update, and adds it back. Attention moves information between positions. The MLP transforms each position on its own. The stream itself is never normalized or overwritten, so whatever earlier blocks wrote is still in it.`,
    width: W, height: 628,
    nodes: [
      { id: "resid_in", label: "x", sub: "from previous block", role: "resid", x: sx, y: 34, w: 150, h: 40, part: P(bp.resid_in, d) },
      { id: "norm1", label: "RMSNorm #1", sub: "input_layernorm", role: "norm", x: bx, y: 128, w: sw, h: bh, part: P(bp.norm1, d) },
      { id: "attn", label: "Attention", sub: `${d.H} Q heads · ${d.Hkv} KV heads`, role: "attn", x: bx, y: 204, w: sw, h: 54, dive: "attention",
        part: P({ ...bp.attn, mechanism: bp.attn.mechanism + ` ${(per.attention_projections / 1e6).toFixed(1)}M parameters per block.` }, d) },
      { id: "add1", label: "+", role: "resid", kind: "op", x: sx, y: 290, w: 30, h: 30, part: P(bp.add1, d) },
      { id: "norm2", label: "RMSNorm #2", sub: "post_attention_layernorm", role: "norm", x: bx, y: 376, w: sw, h: bh, part: P(bp.norm2, d) },
      { id: "mlp", label: "SwiGLU MLP", sub: `${fmt(d.d)} → ${fmt(d.F)} → ${fmt(d.d)}`, role: "mlp", x: bx, y: 452, w: sw, h: 54, dive: "mlp",
        part: P({ ...bp.mlp, why: bp.mlp.why + ` In Qwen3-8B the MLP holds ${(per.mlp / 1e6).toFixed(1)}M of each block's ${(per.total / 1e6).toFixed(1)}M parameters (${mlpShare}%).` }, d) },
      { id: "add2", label: "+", role: "resid", kind: "op", x: sx, y: 538, w: 30, h: 30, part: P(bp.add2, d) },
      { id: "next_block", label: "x″", sub: "to next block", role: "resid", x: sx, y: 604, w: 150, h: 40, part: P(bp.next_block, d) },
    ],
    edges: [
      { from: "resid_in", to: "add1", resid: true },
      { from: "add1", to: "add2", resid: true, label: "x′", lx: sx - 34, ly: 418 },
      { from: "add2", to: "next_block", resid: true },
      { from: "resid_in", to: "norm1", d: `M ${sx} 78 H ${bx} V ${128 - bh / 2}`, label: "copy", lx: sx + 70, ly: 72 },
      { from: "norm1", to: "attn" },
      { from: "attn", to: "add1", d: `M ${bx} ${204 + 27} V 290 H ${sx + 15}`, label: `Δattn [T, ${fmt(d.d)}]`, lx: sx + 34, ly: 284 },
      { from: "add1", to: "norm2", d: `M ${sx} 326 H ${bx} V ${376 - bh / 2}`, label: "copy", lx: sx + 70, ly: 320 },
      { from: "norm2", to: "mlp" },
      { from: "mlp", to: "add2", d: `M ${bx} ${452 + 27} V 538 H ${sx + 15}`, label: `Δmlp [T, ${fmt(d.d)}]`, lx: sx + 34, ly: 532 },
    ],
    order: ["resid_in", "norm1", "attn", "add1", "norm2", "mlp", "add2", "next_block"],
  };

  // ---------- Level 3a: attention ----------
  const qx = 92, kx = 230, vx = 368, cw = 124, qk = (qx + kx) / 2, wide = kx - qx + cw;
  const attention: AtlasLevel = {
    id: "attention", tab: "Attention", title: "Inside attention", parent: "block",
    mnemonic: "Project → Normalize → Rotate → Match → Mask → Softmax → Blend → Merge",
    summary: `Each position makes a query, a key and a value. Queries are compared with the keys of earlier positions to decide where to look, and the matching values are blended into an update. Qwen3-8B runs ${d.H} query heads but stores only ${d.Hkv} key/value heads (grouped-query attention): every K/V head is shared by ${d.G} query heads, which makes the KV cache ${d.G}× smaller.`,
    width: W, height: 724,
    nodes: [
      { id: "a_in", label: "RMSNorm(x)", sub: `[T, ${fmt(d.d)}]`, role: "norm", x: kx, y: 30, w: 180, h: 36,
        part: { id: "a_in", title: "Normalized input", module: "input_layernorm output", intuition: "Attention reads a normalized copy of the residual stream, one vector per position.",
          mechanism: `The output of RMSNorm #1: each position's ${fmt(d.d)}-number vector rescaled to a standard size and multiplied by a learned gain.`,
          shapes: `[B, T, ${fmt(d.d)}]`, why: "The three projections below need inputs on a stable scale.", confusion: "This is a copy. The residual stream x itself is not changed.", hook: hookFor("a_in", d) } },
      { id: "q", label: "Wq → Q", sub: `${d.H} heads × ${d.dh}`, role: "attn", x: qx, y: 112, w: cw, h: 42,
        part: { id: "q", title: "Query projection", module: "self_attn.q_proj", intuition: "Each position computes a query vector: what it is looking for.",
          mechanism: `Q = X Wq maps ${fmt(d.d)} numbers to ${d.H} × ${d.dh} = ${fmt(d.H * d.dh)}, then splits into ${d.H} heads of ${d.dh}. No bias.`,
          equation: "Q = X Wq", shapes: `[B, T, ${fmt(d.d)}] -> [B, ${d.H}, T, ${d.dh}]`,
          why: "Each head can look for a different kind of relationship.", confusion: bp.qkv.confusion, hook: hookFor("q", d) } },
      { id: "k", label: "Wk → K", sub: `${d.Hkv} heads × ${d.dh}`, role: "attn", x: kx, y: 112, w: cw, h: 42,
        part: { id: "k", title: "Key projection", module: "self_attn.k_proj", intuition: "Each position computes a key vector: how it can be found.",
          mechanism: `K = X Wk maps ${fmt(d.d)} numbers to ${d.Hkv} × ${d.dh} = ${fmt(d.Hkv * d.dh)}. Only ${d.Hkv} key heads exist. Each is shared by ${d.G} query heads (grouped-query attention).`,
          equation: "K = X Wk", shapes: `[B, T, ${fmt(d.d)}] -> [B, ${d.Hkv}, T, ${d.dh}]`,
          why: `Fewer key heads mean a ${d.G}× smaller KV cache during generation, with little loss in quality.`, confusion: "GQA shares keys and values, not attention patterns. Each query head still gets its own weights over positions.", hook: hookFor("k", d) } },
      { id: "v", label: "Wv → V", sub: `${d.Hkv} heads × ${d.dh}`, role: "attn", x: vx, y: 112, w: cw, h: 42,
        part: { id: "v", title: "Value projection", module: "self_attn.v_proj", intuition: "Each position computes a value vector: what it passes on if attended to.",
          mechanism: `V = X Wv maps ${fmt(d.d)} numbers to ${d.Hkv} × ${d.dh} = ${fmt(d.Hkv * d.dh)}. V is not normalized and not rotated.`,
          equation: "V = X Wv", shapes: `[B, T, ${fmt(d.d)}] -> [B, ${d.Hkv}, T, ${d.dh}]`,
          why: "Separating what you match on (K) from what you pass on (V) lets the two be learned independently.", confusion: "RoPE and QK-norm never touch V. Position enters only through the Q·K match.", hook: hookFor("v", d) } },
      { id: "qknorm", label: "QK-norm", sub: `RMSNorm per ${d.dh}-dim head`, role: "norm", x: qk, y: 194, w: wide, h: 38, part: P(bp.qknorm, d) },
      { id: "rope", label: "RoPE", sub: `rotate Q and K · θ = ${fmt(d.theta)}`, role: "attn", x: qk, y: 262, w: wide, h: 38, part: P(bp.rope, d) },
      { id: "scores", label: "Q · Kᵀ / √d", sub: `scale ${scale} · [${d.H}, T, T]`, role: "attn", x: qk, y: 334, w: wide, h: 42,
        part: { id: "scores", title: "Match scores", intuition: "Every query is compared with every key by a dot product: a big value means a good match.",
          mechanism: `For each head, multiply Q [T, ${d.dh}] by Kᵀ [${d.dh}, T] to get a T × T table, then multiply by 1/√${d.dh} = ${scale}. Each K head is reused by ${d.G} query heads.`,
          equation: `S = Q Kᵀ / √${d.dh}`, shapes: `[B, ${d.H}, T, ${d.dh}] × [B, ${d.H}, ${d.dh}, T] -> [B, ${d.H}, T, T]`,
          why: `Without the 1/√${d.dh} scale, dot products of ${d.dh}-dimensional vectors grow large and softmax saturates, which stalls learning.`,
          confusion: "Scores are not probabilities yet. They can be any sign and any size until softmax.", hook: hookFor("scores", d) } },
      { id: "mask", label: "Causal mask", sub: "future → −∞", role: "attn", x: qk, y: 404, w: wide, h: 38,
        part: { id: "mask", title: "Causal mask", intuition: "A position may only look at itself and earlier positions.",
          mechanism: "Every score where the key comes after the query (column > row) is set to −∞ before softmax, so its weight becomes exactly 0.",
          equation: "S[t, s] = −∞  for s > t", shapes: `[B, ${d.H}, T, T] (upper triangle masked)`,
          why: "The model is trained to predict the next token. Seeing the future during training would let it cheat.",
          confusion: "The mask doesn't delete tokens. Later positions still see earlier ones. The mask only forbids looking forward.", hook: hookFor("mask", d) } },
      { id: "attn_softmax", label: "Softmax over keys", sub: "each row sums to 1", role: "attn", x: qk, y: 474, w: wide, h: 38,
        part: { id: "attn_softmax", title: "Attention weights", intuition: "Each query's row of scores becomes a set of weights that add up to 1.",
          mechanism: "exp() every score and divide by the row's total. Masked positions get exactly 0. Computed in float32 for stability.",
          equation: "A = softmax(S + mask)", shapes: `[B, ${d.H}, T, T], rows sum to 1`,
          why: "A weighted average needs non-negative weights that sum to 1.", confusion: "This softmax runs over positions (T). The output softmax runs over the vocabulary. Same operation, different job.", hook: hookFor("attn_softmax", d) } },
      { id: "weighted", label: "A · V", sub: `blend values · [${d.H}, T, ${d.dh}]`, role: "attn", x: kx, y: 556, w: 290, h: 42,
        part: { id: "weighted", title: "Weighted sum of values", intuition: "Each position's output is a blend of the values it attended to.",
          mechanism: `Multiply the weights A [T, T] by V [T, ${d.dh}] for each head. Each V head is broadcast to its ${d.G} query heads.`,
          equation: "O = A V", shapes: `[B, ${d.H}, T, T] × [B, ${d.H}, T, ${d.dh}] -> [B, ${d.H}, T, ${d.dh}]`,
          why: "This is the step where information actually moves from one position to another.", confusion: "Attention moves values, not keys. Keys only decide how much of each value to take.", hook: hookFor("weighted", d) } },
      { id: "oproj", label: "Concat heads → Wo", sub: `${fmt(d.H * d.dh)} → ${fmt(d.d)}`, role: "attn", x: kx, y: 630, w: 290, h: 42, part: P(bp.oproj, d) },
      { id: "a_out", label: "Δattn", sub: "added to the stream", role: "resid", x: kx, y: 698, w: 160, h: 34,
        part: { id: "a_out", title: "Attention update", intuition: "The attention sub-layer's output: one update vector per position.",
          mechanism: "Returned to the block, where it is added to the residual stream: x′ = x + Δattn.", equation: "x' = x + Δattn",
          shapes: `[B, T, ${fmt(d.d)}]`, why: "Adding keeps everything the stream already held.", confusion: bp.add1.confusion, hook: hookFor("a_out", d) } },
    ],
    edges: [
      { from: "a_in", to: "q", d: `M ${kx} 48 V 72 H ${qx} V 91` },
      { from: "a_in", to: "k" },
      { from: "a_in", to: "v", d: `M ${kx} 48 V 72 H ${vx} V 91` },
      { from: "q", to: "qknorm", d: `M ${qx} 133 V 175` },
      { from: "k", to: "qknorm", d: `M ${kx} 133 V 175` },
      { from: "qknorm", to: "rope" },
      { from: "rope", to: "scores" },
      { from: "scores", to: "mask" },
      { from: "mask", to: "attn_softmax" },
      { from: "attn_softmax", to: "weighted", d: `M ${qk} 493 V 535` },
      { from: "v", to: "weighted", d: `M ${vx} 133 V 535`, label: "skips QK-norm and RoPE", lx: vx - 8, ly: 302, anchor: "end" },
      { from: "weighted", to: "oproj" },
      { from: "oproj", to: "a_out" },
    ],
    order: ["a_in", "q", "k", "v", "qknorm", "rope", "scores", "mask", "attn_softmax", "weighted", "oproj", "a_out"],
  };

  // ---------- Level 3b: SwiGLU MLP ----------
  const gx = 140, ux = 320;
  const mlp: AtlasLevel = {
    id: "mlp", tab: "MLP", title: "Inside the SwiGLU MLP", parent: "block",
    mnemonic: "Expand → Gate → Multiply → Contract",
    summary: `The MLP works on each position separately. It widens the ${fmt(d.d)}-number vector to ${fmt(d.F)} features along two parallel paths. One path (the gate) goes through SiLU and decides how much of each feature the other path may pass. Their product is compressed back to ${fmt(d.d)}. About ${mlpShare}% of each block's parameters live here.`,
    width: W, height: 470,
    nodes: [
      { id: "m_in", label: "RMSNorm(x′)", sub: `[T, ${fmt(d.d)}]`, role: "norm", x: kx, y: 30, w: 180, h: 36,
        part: { id: "m_in", title: "Normalized input", module: "post_attention_layernorm output", intuition: "The MLP reads a normalized copy of the stream after attention.",
          mechanism: `The output of RMSNorm #2, one ${fmt(d.d)}-number vector per position.`, shapes: `[B, T, ${fmt(d.d)}]`,
          why: "Stable scale for the two wide projections.", confusion: "Positions never interact inside the MLP.", hook: hookFor("m_in", d) } },
      { id: "gate", label: "gate_proj", sub: `${fmt(d.d)} → ${fmt(d.F)}`, role: "mlp", x: gx, y: 118, w: 150, h: 42,
        part: { id: "gate", title: "Gate projection", module: "mlp.gate_proj", intuition: "A wide linear map whose output, after SiLU, acts as a per-feature volume knob.",
          mechanism: `W_gate x: ${fmt(d.d)} → ${fmt(d.F)}, no bias.`, equation: "g = W_gate x", shapes: `[B, T, ${fmt(d.d)}] -> [B, T, ${fmt(d.F)}]`,
          why: "Gating lets the network switch features on and off depending on the input. It trains better than a plain ReLU MLP.",
          confusion: "gate_proj and up_proj see the same input but have different weights and different jobs.", hook: hookFor("gate", d) } },
      { id: "up", label: "up_proj", sub: `${fmt(d.d)} → ${fmt(d.F)}`, role: "mlp", x: ux, y: 118, w: 150, h: 42,
        part: { id: "up", title: "Up projection", module: "mlp.up_proj", intuition: "A second wide linear map: the candidate features themselves.",
          mechanism: `W_up x: ${fmt(d.d)} → ${fmt(d.F)}, no bias. No activation on this path.`, equation: "u = W_up x", shapes: `[B, T, ${fmt(d.d)}] -> [B, T, ${fmt(d.F)}]`,
          why: `${fmt(d.F)} features give the MLP room to represent many patterns at once (${(d.F / d.d).toFixed(0)}× the stream width).`,
          confusion: "The up path has no nonlinearity. All the nonlinearity comes from SiLU on the gate path.", hook: hookFor("up", d) } },
      { id: "silu", label: "SiLU", sub: "x · sigmoid(x)", role: "mlp", x: gx, y: 198, w: 150, h: 38,
        part: { id: "silu", title: "SiLU activation", intuition: "A smooth switch: large negative inputs go to about 0 and positive inputs pass through almost unchanged.",
          mechanism: "SiLU(g) = g · σ(g), applied to each of the gate's features.", equation: "SiLU(g) = g / (1 + e^(−g))", shapes: `[B, T, ${fmt(d.F)}] (elementwise)`,
          why: "The network needs a nonlinearity. Without one, all the layers would collapse into a single linear map.",
          confusion: "SiLU is not a probability. Its output can be slightly negative and has no upper bound.", hook: hookFor("silu", d) } },
      { id: "mul", label: "×", role: "mlp", kind: "op", x: kx, y: 270, w: 32, h: 32,
        part: { id: "mul", title: "Elementwise product", intuition: "Multiply gate and content feature by feature.",
          mechanism: `h_i = SiLU(g_i) · u_i for each of the ${fmt(d.F)} features.`, equation: "h = SiLU(g) ⊙ u", shapes: `[B, T, ${fmt(d.F)}]`,
          why: "This is the gated linear unit (GLU): the input decides which features matter for this token.",
          confusion: "This is not a dot product. Nothing is summed, and the vector keeps all its features.", hook: hookFor("mul", d) } },
      { id: "down", label: "down_proj", sub: `${fmt(d.F)} → ${fmt(d.d)}`, role: "mlp", x: kx, y: 350, w: 190, h: 42,
        part: { id: "down", title: "Down projection", module: "mlp.down_proj", intuition: "Compress the gated features back to the width of the stream.",
          mechanism: `W_down h: ${fmt(d.F)} → ${fmt(d.d)}, no bias.`, equation: "MLP(x) = W_down (SiLU(W_gate x) ⊙ W_up x)", shapes: `[B, T, ${fmt(d.F)}] -> [B, T, ${fmt(d.d)}]`,
          why: "The update must have the stream's shape so it can be added.", confusion: bp.mlp.confusion, hook: hookFor("down", d) } },
      { id: "m_out", label: "Δmlp", sub: "added to the stream", role: "resid", x: kx, y: 430, w: 160, h: 34,
        part: { id: "m_out", title: "MLP update", intuition: "One update vector per position, computed without looking at any other position.",
          mechanism: "Returned to the block and added: x″ = x′ + Δmlp.", equation: "x'' = x' + Δmlp", shapes: `[B, T, ${fmt(d.d)}]`,
          why: "Same additive rule as attention.", confusion: bp.add2.confusion, hook: hookFor("m_out", d) } },
    ],
    edges: [
      { from: "m_in", to: "gate", d: `M ${kx} 48 V 74 H ${gx} V 97` },
      { from: "m_in", to: "up", d: `M ${kx} 48 V 74 H ${ux} V 97` },
      { from: "gate", to: "silu" },
      { from: "silu", to: "mul", d: `M ${gx} 217 V 270 H ${kx - 16}` },
      { from: "up", to: "mul", d: `M ${ux} 139 V 270 H ${kx + 16}` },
      { from: "mul", to: "down", label: `[T, ${fmt(d.F)}]`, lx: kx + 10, ly: 312 },
      { from: "down", to: "m_out" },
    ],
    order: ["m_in", "gate", "up", "silu", "mul", "down", "m_out"],
  };

  return [model, block, attention, mlp];
}

/** The four verbs that summarise the whole model, for the memory section. */
export function fourVerbs(a: Architecture) {
  const d = dims(a);
  return [
    { verb: "Look up", role: "resid" as Role, what: "Embedding", line: `Each token id picks one row of a ${fmt(d.V)} × ${fmt(d.d)} table.` },
    { verb: "Mix", role: "attn" as Role, what: "Attention", line: "Tokens look back at earlier tokens and borrow what they need." },
    { verb: "Think", role: "mlp" as Role, what: "MLP", line: "Each token is transformed alone: expand, gate, contract." },
    { verb: "Read out", role: "io" as Role, what: "LM head", line: `Score all ${fmt(d.V)} entries, softmax, pick one, repeat.` },
  ];
}
