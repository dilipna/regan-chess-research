// The five-idea explanation of every component LatentLens teaches. Tensor shapes are computed from the VERIFIED
// architecture (architecture.json), never typed in by hand. B = batch size, T = sequence length.
import { fmtEps } from "./toy";
import type { Architecture } from "./types";

export interface Part {
  id: string;
  title: string;
  module?: string;          // module name in transformers' Qwen3 implementation
  intuition: string;
  mechanism: string;
  equation?: string;        // plain-text equation (always readable without rendering)
  shapes: string;
  why: string;
  confusion: string;
}

export function dims(a: Architecture) {
  const v = a.verified;
  return { L: v.num_hidden_layers, d: v.hidden_size, F: v.intermediate_size, V: v.vocab_size, H: v.num_attention_heads,
    Hkv: v.num_key_value_heads, G: v.query_heads_per_kv_head, dh: v.head_dim, eps: fmtEps(v.rms_norm_eps), theta: v.rope_theta };
}

export function pipelineParts(a: Architecture): Part[] {
  const { L, d, V } = dims(a);
  const v = a.verified;
  return [
    { id: "text", title: "Text", intuition: "The model never sees letters directly; it starts from a string that must be turned into integers.",
      mechanism: "A Python string, for example \"The researcher opened the notebook\". Nothing has been computed yet.",
      shapes: "one string", why: "Language models are trained on text, but neural networks compute on numbers.",
      confusion: "The model does not read words one character at a time. Its unit of input is the token." },
    { id: "tokenizer", title: "Tokenizer", module: "Qwen2TokenizerFast (byte-level BPE)",
      intuition: "The tokenizer cuts text into pieces from a fixed vocabulary of frequent byte sequences.",
      mechanism: `Byte-level byte-pair encoding: the text is split into pieces, each mapped to one of ${v.tokenizer_size.toLocaleString("en-US")} vocabulary entries. A leading space is part of the next token (shown as Ġ in raw pieces). Qwen's tokenizer adds no beginning-of-sequence token by itself.`,
      shapes: "string -> list of T token pieces", why: "A fixed vocabulary lets every possible string be represented, while common words stay short.",
      confusion: "A token is not a word. \"unbelievably\" is three tokens; \" notebook\" (with its space) and \"notebook\" are different tokens." },
    { id: "ids", title: "Token IDs", intuition: "Each piece becomes an integer index, like a row number in a table.",
      mechanism: "Lookup of each piece in the vocabulary dictionary. LatentLens puts <|endoftext|> (id " + v.endoftext_id + ") in front of each document, the separator Qwen base models saw between pretraining documents.",
      shapes: "[B, T] integers in 0..V-1", why: "Integers can index the embedding table.",
      confusion: "The number itself carries no meaning. Id 37166 is not \"bigger\" than id 279 in any semantic sense." },
    { id: "embedding", title: "Embedding lookup", module: "model.embed_tokens",
      intuition: "Each id selects one learned vector; this is where meaning starts.",
      mechanism: `Row selection from a learned table E of shape [${V.toLocaleString("en-US")}, ${d}]. No arithmetic is done; the row is copied.`,
      equation: "x_t = E[id_t]", shapes: `[B, T] -> [B, T, ${d}]`,
      why: "Gradient descent places tokens that behave similarly in similar regions of a " + d + "-dimensional space.",
      confusion: `The embedding is not one-hot. It is a dense learned vector of ${d} real numbers. The table has ${V.toLocaleString("en-US")} rows, more than the tokenizer uses (${v.tokenizer_size.toLocaleString("en-US")}); the extra rows are padding.` },
    { id: "residual", title: "Residual stream", intuition: "The residual stream is the information highway of the transformer.",
      mechanism: "One vector per position that every block reads from and adds to. Block k turns x into x + attention update + MLP update. Nothing overwrites it.",
      equation: "x' = x + Attn(RMSNorm(x));  x'' = x' + MLP(RMSNorm(x'))", shapes: `[B, T, ${d}] throughout all ${L} blocks`,
      why: "Additive updates let information pass through many layers unchanged unless a block decides to change it, which also makes very deep networks trainable.",
      confusion: "RMSNorm is applied to a copy that feeds the sub-layer. The stream itself is not normalized between blocks." },
    { id: "blocks", title: `Transformer blocks 1..${L}`, module: "model.layers[0.." + (L - 1) + "]",
      intuition: `The same block design repeated ${L} times, each with its own weights.`,
      mechanism: "Each block: RMSNorm, grouped-query attention with Q/K RMSNorm and RoPE, residual add, RMSNorm, SwiGLU MLP, residual add.",
      shapes: `[B, T, ${d}] -> [B, T, ${d}]`, why: "Depth lets the model build up a representation in many small steps.",
      confusion: "The architecture repeats; the weights do not. Block 3 and block 30 compute different functions." },
    { id: "final_norm", title: "Final RMSNorm", module: "model.norm",
      intuition: "One last rescaling of each position's vector before reading out a prediction.",
      mechanism: `RMSNorm over ${d} dimensions with its own learned gain (eps ${fmtEps(v.rms_norm_eps)}).`,
      equation: "h = g * x / sqrt(mean(x^2) + eps)", shapes: `[B, T, ${d}] -> [B, T, ${d}]`,
      why: "The residual stream grows in magnitude with depth; the LM head expects a normalized input.",
      confusion: "This is not a block norm. It runs once, after the last block." },
    { id: "lm_head", title: "LM head", module: "lm_head",
      intuition: "A score for every vocabulary entry, computed as a dot product with that entry's output vector.",
      mechanism: `Linear map W of shape [${V.toLocaleString("en-US")}, ${d}], no bias. ${v.tie_word_embeddings ? "Tied to the embedding table." : "Not tied: Qwen3-8B stores the LM head separately from the embedding table."}`,
      equation: "z = W h", shapes: `[B, T, ${d}] -> [B, T, ${V.toLocaleString("en-US")}]`,
      why: "Turns a hidden vector into a comparison against every possible next token.",
      confusion: "The output at position t is about token t+1, not token t." },
    { id: "logits", title: "Logits", intuition: "Raw scores, one per vocabulary entry. Higher means more favoured.",
      mechanism: "Real numbers, unbounded, any sign. Adding a constant to all of them changes nothing after softmax.",
      shapes: `[${V.toLocaleString("en-US")}] per position`, why: "Unconstrained scores are easy for a linear layer to produce and to train.",
      confusion: "LOGIT ≠ PROBABILITY. A logit of 32 says nothing by itself; only differences between logits matter." },
    { id: "softmax", title: "Softmax", intuition: "Turns scores into a probability distribution that sums to 1.",
      mechanism: "Exponentiate every logit and divide by the sum over the whole vocabulary.",
      equation: "p_i = exp(z_i) / sum_j exp(z_j)", shapes: `[${V.toLocaleString("en-US")}] -> [${V.toLocaleString("en-US")}], sums to 1`,
      why: "Training compares the model's distribution with the true next token through cross-entropy.",
      confusion: "Softmax does not pick a token. It only produces probabilities; choosing is a separate decoding step." },
    { id: "next", title: "Next token", intuition: "A decoding rule turns the distribution into one chosen token.",
      mechanism: "Greedy picks the highest probability; sampling draws from the (possibly temperature-scaled, top-k or top-p restricted) distribution. The chosen token is appended and the loop repeats.",
      shapes: "one token id per sequence per step", why: "Generation is repeated next-token prediction.",
      confusion: "Decoding rules are inference choices. They are not how the model was pretrained." },
  ];
}

export function blockParts(a: Architecture): Part[] {
  const { d, F, H, Hkv, G, dh, eps, theta } = dims(a);
  return [
    { id: "resid_in", title: "Residual x", intuition: "The current state of every position, entering the block.",
      mechanism: "The output of the previous block (or the embeddings for block 1).", shapes: `[B, T, ${d}]`,
      why: "Everything the block computes is an update to this vector.", confusion: "x is kept as is; a normalized copy goes into attention." },
    { id: "norm1", title: "Block RMSNorm #1", module: "input_layernorm",
      intuition: "Rescale each position's vector to a standard size before attention reads it.",
      mechanism: `Per position: divide by the root-mean-square over all ${d} coordinates, then multiply by a learned gain vector g (${d} numbers). Computed in float32. No mean subtraction, no bias.`,
      equation: `RMSNorm(x) = g * x / sqrt((1/${d}) sum_i x_i^2 + ${eps})`, shapes: `[B, T, ${d}] -> [B, T, ${d}]`,
      why: "Keeps the input to attention on a stable scale no matter how large the residual stream has grown.",
      confusion: "This normalizes over hidden_size. The Q/K RMSNorm inside attention normalizes 128-dimensional head vectors: a different operation." },
    { id: "qkv", title: "Q / K / V projections", module: "self_attn.q_proj, k_proj, v_proj",
      intuition: "Three learned linear maps give each position a query, a key and a value. (An analogy, not literal semantics.)",
      mechanism: `Q = X Wq (${d} -> ${H} x ${dh} = ${H * dh}); K = X Wk and V = X Wv (${d} -> ${Hkv} x ${dh} = ${Hkv * dh}). No biases. Then reshaped to heads and transposed.`,
      equation: "Q = X Wq,  K = X Wk,  V = X Wv", shapes: `Q: [B, T, ${d}] -> [B, ${H}, T, ${dh}];  K, V: [B, T, ${d}] -> [B, ${Hkv}, T, ${dh}]`,
      why: "Separate projections let the model decide what to look for, what to be found by, and what to pass on.",
      confusion: "Q, K and V are computed from the same input. \"Looking for\" and \"advertising\" are intuitions; the model only learns useful linear maps." },
    { id: "qknorm", title: "Q RMSNorm and K RMSNorm", module: "self_attn.q_norm, self_attn.k_norm",
      intuition: "Each query head vector and each key head vector is rescaled to a standard size.",
      mechanism: `RMSNorm over the ${dh} dimensions of ONE head, with a learned ${dh}-dimensional gain shared by all heads of that layer. Applied after the projection and reshape, before RoPE. V is not normalized.`,
      equation: `q_h = g_q * q_h / sqrt((1/${dh}) sum q_h,i^2 + ${eps})`, shapes: `per head vector: [${dh}] -> [${dh}]`,
      why: "Bounds the size of the dot products Q.K, which stabilises training (the Qwen3 report calls this QK-norm).",
      confusion: "It is not the block RMSNorm and it does not see the whole hidden vector. It acts on 128 numbers at a time." },
    { id: "rope", title: "RoPE on Q and K", module: "apply_rotary_pos_emb",
      intuition: "Position is encoded by rotating query and key vectors by an angle that grows with position.",
      mechanism: `The ${dh} head dimensions form ${dh / 2} pairs (dimension i with i + ${dh / 2}). Pair i at position t is rotated by angle t x theta^(-2i/${dh}), theta = ${theta.toLocaleString("en-US")}. Only Q and K are rotated.`,
      equation: "q'_t = R(t) q_t,  k'_s = R(s) k_s,  so q'_t . k'_s depends on t - s", shapes: `[B, H, T, ${dh}] -> same shape`,
      why: "The attention score between two positions then depends on how far apart they are.",
      confusion: "RoPE adds nothing to the token vectors and never touches the residual stream or V." },
    { id: "attn", title: "Causal grouped-query attention", module: "self_attn (sdpa / eager)",
      intuition: "Each position takes a weighted average of the values of earlier positions, weighted by query-key match.",
      mechanism: `Scores = Q K^T / sqrt(${dh}); future positions get -infinity (causal mask); softmax over keys; weighted sum of V. ${H} query heads share ${Hkv} key/value heads: every K/V head serves ${G} query heads.`,
      equation: "Attn = softmax(Q K^T / sqrt(d_head) + mask) V", shapes: `scores [B, ${H}, T, T];  output [B, ${H}, T, ${dh}]`,
      why: "This is the only place where information moves between positions.",
      confusion: "Each head has its own attention pattern. GQA shares keys and values, not attention weights." },
    { id: "oproj", title: "Attention output projection", module: "self_attn.o_proj",
      intuition: "The heads' outputs are joined and mapped back to the size of the residual stream.",
      mechanism: `Concatenate the ${H} head outputs (${H} x ${dh} = ${H * dh}) and multiply by Wo (${H * dh} -> ${d}).`,
      shapes: `[B, T, ${H * dh}] -> [B, T, ${d}]`, why: "Produces an update in residual-stream coordinates.",
      confusion: "The output is an update, not a replacement for x." },
    { id: "add1", title: "+ Residual (addition #1)", intuition: "Add the attention update to the stream.",
      mechanism: "x' = x + attention update.", equation: "x' = x + o_proj(Attn(...))", shapes: `[B, T, ${d}]`,
      why: "Information that attention does not change passes through untouched.", confusion: "Nothing is overwritten; the old x is still inside x'." },
    { id: "norm2", title: "Block RMSNorm #2", module: "post_attention_layernorm",
      intuition: "Rescale the updated stream before the MLP reads it.", mechanism: `Same operation as RMSNorm #1 with its own learned gain (${d} numbers).`,
      shapes: `[B, T, ${d}] -> [B, T, ${d}]`, why: "Stable input scale for the MLP.", confusion: "Again a copy: x' itself is not normalized." },
    { id: "mlp", title: "SwiGLU MLP", module: "mlp.gate_proj, up_proj, down_proj",
      intuition: "A per-position feature transformation: expand, gate, contract.",
      mechanism: `gate = gate_proj(x) and up = up_proj(x) (${d} -> ${F}); combined = SiLU(gate) * up (elementwise); out = down_proj(combined) (${F} -> ${d}). No biases.`,
      equation: "MLP(x) = W_down (SiLU(W_gate x) * (W_up x))", shapes: `[B, T, ${d}] -> [B, T, ${F}] -> [B, T, ${d}]`,
      why: "Most of the parameters live here; it transforms what each position represents.",
      confusion: "The MLP never mixes positions. It applies the same function to each position independently. Attention mixes across positions." },
    { id: "add2", title: "+ Residual (addition #2)", intuition: "Add the MLP update to the stream.", mechanism: "x'' = x' + MLP update.",
      equation: "x'' = x' + MLP(RMSNorm(x'))", shapes: `[B, T, ${d}]`, why: "Same reason as addition #1.",
      confusion: "x'' goes to the next block unnormalized; only the next block's RMSNorm copy is normalized." },
    { id: "next_block", title: "Next block", intuition: "The updated stream becomes the input of the next block.",
      mechanism: `Repeat for all ${dims(a).L} blocks, then final RMSNorm and LM head.`, shapes: `[B, T, ${d}]`,
      why: "Many small additive updates build the final representation.", confusion: "Each block has different weights even though its diagram is identical." },
  ];
}
