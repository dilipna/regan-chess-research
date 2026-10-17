// The Atlas's running example: one recorded forward pass of Qwen3-8B-Base over "The researcher opened the notebook".
// A compact, serializable slice of token_trace.json and tokenizer_examples.json for the small "See it" visuals.
import type { TokenizerExamples, TokenTrace } from "./types";

export interface AtlasHead { layer: number; head: number; note: string; w: number[][] }

export interface AtlasExample {
  text: string;
  tokens: { id: number; label: string; prefix: boolean }[];         // label: piece with the leading-space marker shown as ␣
  emb: { label: string; coords: number[]; rms: number }[];          // first recorded coordinates of each embedding row
  // RMS per depth for the LAST position: stream[0] is the embedding, stream[k] the residual after block k
  stream: number[];
  attnNorm: number[]; mlpNorm: number[]; attnOut: number[]; mlpOut: number[];   // per block (1..L), last position
  heads: AtlasHead[];
  top: { label: string; logit: number; p: number }[];
  topMass: number;
}

const show = (piece: string) => piece.replace(/^Ġ/, "␣").replace(/Ċ/g, "↵");

// Heads chosen from the recording by their pattern: previous-token mass over positions 2..T-1 (L1 H4: 0.72, L34 H12: 0.66)
// and mass on position 0 over positions 1..T-1 (L17 H18: 0.97).
const HEADS: { layer: number; head: number; note: string }[] = [
  { layer: 1, head: 4, note: "mostly looks at the previous token" },
  { layer: 17, head: 18, note: "parks most weight on the first token (an “attention sink”)" },
  { layer: 34, head: 12, note: "a late head that also tracks the previous token" },
];

export function atlasExample(trace?: TokenTrace, tok?: TokenizerExamples): AtlasExample | undefined {
  if (!trace || trace.status !== "ok") return undefined;
  const last = trace.tokens.length - 1;
  const heads = HEADS.flatMap((h) => {
    const w = trace.attention.weights[String(h.layer)]?.[h.head];
    return w ? [{ ...h, w: w.map((r) => r.map((x) => Math.round(x * 1000) / 1000)) }] : [];
  });
  const embRows = tok?.embedding?.text === trace.text ? tok.embedding.tokens : [];
  return {
    text: trace.text,
    tokens: trace.tokens.map((t) => ({ id: t.id, label: t.prefix ? "<|endoftext|>" : show(t.piece), prefix: t.prefix })),
    emb: embRows.map((t) => ({ label: show(t.piece), coords: t.first_coords, rms: t.rms })),
    stream: [trace.embedding_rms[last], ...trace.layers.map((l) => l.resid_post_rms[last])],
    attnNorm: trace.layers.map((l) => l.attn_norm_rms[last]),
    mlpNorm: trace.layers.map((l) => l.mlp_norm_rms[last]),
    attnOut: trace.layers.map((l) => l.attn_out_rms[last]),
    mlpOut: trace.layers.map((l) => l.mlp_out_rms[last]),
    heads,
    top: trace.final.top.slice(0, 8).map((t) => ({ label: show(t.piece), logit: t.logit, p: t.p })),
    topMass: trace.final.top_mass,
  };
}
