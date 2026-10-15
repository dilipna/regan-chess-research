# Qwen3 from zero to internals

A study guide for understanding one real decoder-only language model, Qwen3-8B-Base, well enough to explain every
operation without notes. Every architectural number below was verified by
`scripts/latentlens/inspect_qwen_architecture.py` against the checkpoint (`Qwen/Qwen3-8B-Base @ 49e3418f`), the installed
transformers 5.18 implementation, the safetensors headers and the model card. Numbers marked **measured** come from real
forward passes recorded in `results/latentlens/qwen3-8b/`. Numbers marked **toy** are small hand-made examples.

**Verified Qwen3-8B-Base facts used throughout**

| Quantity | Value |
|---|---|
| Transformer blocks (layers) | 36 |
| Hidden size d (residual stream width) | 4096 |
| MLP intermediate size F | 12288 |
| Query heads / key-value heads | 32 / 8 (4 query heads per KV head) |
| Head dimension | 128 |
| Vocabulary rows (embedding and LM head) / tokenizer entries | 151,936 / 151,669 |
| Normalization | RMSNorm, eps = 1e-6, before attention, before MLP, after the last block; plus Q/K RMSNorm over 128 dims |
| Positions | RoPE on Q and K, theta = 1,000,000, rotate-half pairing, 64 frequencies |
| MLP | SwiGLU (gate_proj, up_proj, down_proj), SiLU, no biases |
| Attention biases | none |
| Embedding and LM head tied? | no (separate 151,936 × 4096 matrices) |
| Max positions | 32,768; no sliding window |
| Parameters | 8,190,735,360 total; 6,946,075,648 without embedding and LM head; 192,946,432 per block |
| Stored dtype | bfloat16 (15.3 GiB) |

Shape notation: B = batch size, T = sequence length (tokens), d = 4096, H = 32, H_kv = 8, d_h = 128, F = 12288,
V = 151,936.

---

## 1. Autoregressive language modeling

- **Plain English.** The model reads text from left to right and, at every position, gives a probability to every
  possible next token. Generating text means repeatedly picking a next token and appending it.
- **Technical.** It models p(x_1, …, x_T) = Π_t p(x_{t+1} | x_1 … x_t). One network computes all T conditional
  distributions in a single forward pass, thanks to the causal mask.
- **Shape.** input ids [B, T] → logits [B, T, V]; position t's logits are about token t+1.
- **Equation.** log p(x) = Σ_t log p_θ(x_{t+1} | x_≤t)
- **Toy example.** For "A B C": p(A, B, C) = p(A) · p(B | A) · p(C | A, B).
- **Qwen connection.** Qwen3-8B-Base is a pure causal language model (the model card lists its training stage as
  Pretraining).
- **Misconception.** "The model outputs a sentence." It outputs one distribution per position; sentences come from a
  decoding loop around it.
- **Teach-back.** Why does one forward pass over T tokens give T predictions?

## 2. Tokenizer

- **Plain English.** Splits text into pieces from a fixed vocabulary.
- **Technical.** Byte-level byte-pair encoding (BPE). Text is turned into bytes; frequent byte sequences were merged
  into tokens when the vocabulary was built. Any string can be encoded because single bytes are tokens too.
- **Shape.** string → list of T integers.
- **Equation.** none; it is a deterministic lookup procedure.
- **Toy example (measured, real tokenizer).** "The researcher opened the notebook" → `The`, `Ġresearcher`, `Ġopened`,
  `Ġthe`, `Ġnotebook` (5 tokens; `Ġ` marks a leading space). "unbelievably" → `un`, `belie`, `vably`.
  "In 1863" → `In`, `Ġ`, `1`, `8`, `6`, `3` (digits are split one by one).
- **Qwen connection.** 151,669 tokenizer entries. The tokenizer adds **no** beginning-of-sequence token on its own.
  LatentLens puts `<|endoftext|>` (id 151643), the separator Qwen base models saw between pretraining documents, in
  front of each document.
- **Misconception.** "A token is a word." " notebook" and "notebook" are different tokens; "NOTEBOOK" is two tokens.
- **Teach-back.** Why might the same word get different token ids in different places in a sentence?

## 3. Token IDs

- **Plain English.** Each token becomes an integer index.
- **Technical.** Index into the embedding table, range 0 … 151,935.
- **Shape.** [B, T] int64.
- **Toy example (measured).** `Ġnotebook` = 37166, `Ġthe` = 279.
- **Qwen connection.** The embedding table has 151,936 rows: 267 more than the tokenizer uses (padding to a convenient
  size).
- **Misconception.** "Larger ids mean something." The integer is only an address.
- **Teach-back.** What would change if we permuted all token ids consistently in the tokenizer and in the embedding
  rows?

## 4. Embeddings

- **Plain English.** Each id picks out a learned vector; meaning starts here.
- **Technical.** Row lookup x_t = E[id_t], E ∈ R^{V × d}. No arithmetic, just copying a row. E is learned by gradient
  descent like every other weight.
- **Shape.** [B, T] → [B, T, 4096].
- **Equation.** x_t = E[id_t]
- **Toy example (measured).** The row for `Ġnotebook` has 4096 numbers, RMS 0.0268, L2 norm 1.71, mean −0.0002.
  Embedding rows are small; block 1's RMSNorm rescales them.
- **Qwen connection.** model.embed_tokens.weight, 622,329,856 parameters.
- **Misconception.** "Embeddings are one-hot vectors." They are dense learned vectors; one-hot is only the conceptual
  way of writing the lookup as a matrix product.
- **Teach-back.** Why is an embedding lookup equivalent to multiplying a one-hot vector by E?

## 5. Residual stream

- **Plain English.** The residual stream is the information highway of the transformer: one vector per position that
  every block reads and adds to.
- **Technical.** x^(0) = embeddings. Block k computes x' = x + Attn(RMSNorm(x)), then x'' = x' + MLP(RMSNorm(x')).
  Nothing ever replaces x; sub-layers only add updates.
- **Shape.** [B, T, 4096] at every depth.
- **Equation.** x^(L) = x^(0) + Σ_k (attention update_k + MLP update_k)
- **Toy example (measured).** For the last token of "The researcher opened the notebook", the residual RMS grows from
  0.027 (embedding) to about 33 after block 36. At position 0 (`<|endoftext|>`) one coordinate (dimension 2276)
  reaches about 380 after block 11 and about 1,800 after block 21: a "massive activation".
- **Qwen connection.** 36 blocks, 72 additive updates per position.
- **Misconception.** "Each layer produces a new representation that replaces the old one." The old one is still inside
  the sum.
- **Teach-back.** If a block's attention and MLP both output zero, what does the block do?

## 6. RMSNorm

- **Plain English.** Rescale a vector to a standard size, then let a learned gain reweight each coordinate.
- **Technical.** RMS(x) = sqrt((1/d) Σ x_i² + ε); RMSNorm(x) = g ⊙ x / RMS(x). Computed in float32. No mean
  subtraction, no bias. LayerNorm instead subtracts the mean, divides by the standard deviation, then applies gain and
  bias.
- **Shape.** [.., d] → [.., d], per position.
- **Equation.** RMSNorm(x) = g ⊙ x / sqrt(mean(x²) + ε), ε = 1e-6
- **Toy example (toy).** x = [2, −1, 4, 1]: squares [4, 1, 16, 1]; mean 5.5; RMS = sqrt(5.5) = 2.3452;
  x / RMS = [0.853, −0.426, 1.706, 0.426] (RMS 1); with g = 1 that is the output. Scaling x by 10 gives the same output;
  adding 5 to every entry changes it (LayerNorm would not change).
- **Qwen connection.** Three kinds of block-level RMSNorm: input_layernorm (before attention), post_attention_layernorm
  (before the MLP), model.norm (after block 36). Gains are learned and far from 1 (**measured** from the weights: block 1
  input gain mean 0.0114; final norm gain mean 2.01).
- **Misconception.** "RMSNorm normalizes the residual stream." It normalizes the copy a sub-layer reads; the stream
  keeps its magnitude.
- **Teach-back.** What information can RMSNorm remove, and what does it keep?

## 7. Linear projections

- **Plain English.** Multiply by a learned matrix: each output is a weighted sum of all inputs.
- **Technical.** y = x W (PyTorch stores W transposed and computes x Wᵀ). No biases anywhere in Qwen3-8B.
- **Shape.** [.., d_in] → [.., d_out]
- **Toy example (toy).** [1, 2] × [[1, 0, 1], [0, 1, 1]] = [1, 2, 3].
- **Qwen connection.** q_proj 4096→4096, k_proj 4096→1024, v_proj 4096→1024, o_proj 4096→4096, gate/up 4096→12288,
  down 12288→4096, LM head 4096→151,936.
- **Misconception.** "A linear layer looks at one feature." Every output looks at every input.
- **Teach-back.** How many parameters does a 4096→1024 projection without bias have?

## 8. Q (query)

- **Plain English.** "What am I looking for?" (an analogy).
- **Technical.** Q = RMSNorm(x) W_q, reshaped into 32 heads of 128 and transposed to [B, 32, T, 128].
- **Shape.** [B, T, 4096] → [B, T, 32, 128] → [B, 32, T, 128].
- **Toy example (toy).** In the causal-attention lab, C's query [1, 1] against A's key [1, 0.5] scores (1 + 0.5) / sqrt(2) = 1.061.
- **Qwen connection.** Followed by q_norm and RoPE before scores are computed.
- **Misconception.** Q is not a separate input; it is computed from the same normalized vector as K and V.
- **Teach-back.** Why does only the newest position need a query during generation?

## 9. K (key)

- **Plain English.** "What do I contain or advertise?" (analogy).
- **Technical.** K = RMSNorm(x) W_k, 8 heads of 128, then k_norm and RoPE.
- **Shape.** [B, T, 4096] → [B, 8, T, 128].
- **Qwen connection.** Keys (after RoPE) are what the KV cache stores.
- **Misconception.** "Keys are token ids." They are learned vectors that depend on context, since x already contains
  information from earlier positions.
- **Teach-back.** Why are keys cached after RoPE rather than before?

## 10. V (value)

- **Plain English.** "What should be passed on if I am selected?" (analogy).
- **Technical.** V = RMSNorm(x) W_v, 8 heads of 128. Not normalized, not rotated.
- **Shape.** [B, T, 4096] → [B, 8, T, 128].
- **Misconception.** "V decides where to attend." Only Q and K decide; V is what gets averaged.
- **Teach-back.** Could two positions with identical keys contribute different information? How?

## 11. Attention heads

- **Plain English.** Several independent attention computations in parallel, each with its own pattern.
- **Technical.** Each of the 32 query heads computes its own softmax over keys; outputs are concatenated.
- **Shape.** scores [B, 32, T, T]; outputs [B, 32, T, 128] → [B, T, 4096].
- **Toy example (measured).** In block 18, 25 of 32 heads put more than half their weight on position 0 for the
  example sentence; in block 1, none does.
- **Misconception.** "Each head has a fixed human-interpretable job." Some heads have interpretable patterns, but no
  experiment here assigns roles.
- **Teach-back.** Why can many heads be useful if they all see the same input?

## 12. Grouped-query attention (GQA)

- **Plain English.** 32 query heads share 8 key/value heads.
- **Technical.** Query head i uses KV head ⌊i / 4⌋ (implemented by repeating each K/V head 4 times, `repeat_kv`).
  MHA: one KV head per query head (32). MQA: one KV head for all. GQA sits between.
- **Shape.** K, V [B, 8, T, 128] are expanded to [B, 32, T, 128] for the score computation.
- **Equation.** KV cache bytes per token = 2 × H_kv × d_h × L × bytes = 2 × 8 × 128 × 36 × 2 = 147,456 (144 KiB).
- **Toy example.** With 32 KV heads it would be 576 KiB per token: 4 times more.
- **Qwen connection.** 8 KV heads; 4 query heads per group.
- **Misconception.** "GQA shares attention weights." It shares keys and values; each query head still has its own
  attention pattern.
- **Teach-back.** Why does GQA reduce memory traffic during generation but barely change training compute?

## 13. Q/K normalization

- **Plain English.** Rescale every query and key head vector before comparing them.
- **Technical.** q_norm and k_norm are RMSNorms over the 128 dimensions of one head, with a 128-dimensional learned
  gain shared by all heads of that layer. Applied after projection and reshape, before RoPE. V is not normalized.
- **Shape.** per head vector: [128] → [128].
- **Toy example (measured).** Block 1, last token: query head vectors entering q_norm have RMS 0.023 to 0.092; leaving,
  0.88 to 1.96 (set by the learned gain).
- **Qwen connection.** The Qwen3 model card lists "qk layernorm for all models" as a stability refinement.
- **Misconception.** "This is the same as the block RMSNorm." Different input (one head, 128 numbers vs the whole
  4096-number vector), different place, different gain.
- **Teach-back.** Why would bounding the size of q and k stabilise training?

## 14. RoPE

- **Plain English.** Encode position by rotating queries and keys by an angle that grows with position.
- **Technical.** The 128 dims form 64 pairs (i, i + 64). At position t, pair i is rotated by angle t·θ_i with
  θ_i = 1,000,000^(−2i/128). Because rotations compose, (R(t)q)·(R(s)k) = q·R(s − t)k: the score depends on the
  relative offset.
- **Shape.** [B, H, T, 128] → same.
- **Equation.** q' = q cos(tθ) + rotate_half(q) sin(tθ)
- **Toy example (toy).** In 2D with 0.5 rad per position, q at position 3 and k at position 1 give the same score as q at
  7 and k at 5.
- **Qwen connection.** Wavelengths from 6.28 tokens (fastest pair) to about 5 million tokens (slowest).
- **Misconception.** "RoPE adds a positional vector to the embeddings." Nothing is added; only Q and K are rotated.
- **Teach-back.** Why is V not rotated?

## 15. Causal masking

- **Plain English.** A position may not look at later positions.
- **Technical.** Scores for key positions j > t are set to −∞ (in practice the dtype's minimum) before softmax, so
  their weights are exactly 0.
- **Shape.** mask [T, T], lower-triangular visibility.
- **Toy example (toy).** For A B C D, row B can see A and B only.
- **Qwen connection.** `self.is_causal = True` in Qwen3Attention.
- **Misconception.** "The mask is only needed for generation." It is essential in training: without it each position
  could read its own target.
- **Teach-back.** Why does right-padding a batch not affect real tokens under a causal mask?

## 16. Attention scores

- **Plain English.** How well each query matches each key.
- **Technical.** S = Q Kᵀ / sqrt(d_h), d_h = 128 (scale 0.0884), then mask and softmax over keys.
- **Shape.** [B, 32, T, T].
- **Equation.** A = softmax(Q Kᵀ / sqrt(d_h) + M)
- **Misconception.** "Scores are probabilities." Only after softmax, and only across keys for a fixed query.
- **Teach-back.** Why divide by sqrt(d_h)?

## 17. Attention-weighted values

- **Plain English.** Each position takes a weighted average of earlier positions' values.
- **Technical.** O = A V, per head.
- **Shape.** [B, 32, T, T] × [B, 32, T, 128] → [B, 32, T, 128].
- **Toy example (toy).** In the lab's toy numbers, out(B) = 0.41·V_A + 0.59·V_B (B may see only A and itself).
- **Misconception.** "Attention copies the attended token." It mixes value vectors, which already carry context.
- **Teach-back.** What is the attention output of position 0 always equal to?

## 18. Output projection

- **Plain English.** Join the heads and map back to the residual width.
- **Technical.** Concatenate 32 × 128 = 4096 numbers and multiply by W_o (4096 → 4096).
- **Shape.** [B, T, 4096] → [B, T, 4096].
- **Misconception.** "Heads are averaged." They are concatenated and linearly mixed.
- **Teach-back.** Why is an output projection needed if concatenation already has 4096 numbers?

## 19. Residual addition #1

- **Plain English.** Add the attention update to the stream.
- **Technical.** x' = x + o_proj(Attn(RMSNorm(x))).
- **Toy example (measured).** Block 1, last token: ‖x‖ = 1.71, ‖attention update‖ = 3.61.
- **Misconception.** "The attention output replaces x."
- **Teach-back.** Which quantity is normalized here, x or x'?

## 20. Second RMSNorm

- **Plain English.** Rescale the updated stream before the MLP reads it.
- **Technical.** post_attention_layernorm(x'), its own 4096-dimensional gain.
- **Misconception.** "It is the same norm as before attention." Same formula, different learned gain.
- **Teach-back.** What would happen to the MLP's input scale late in the network without it?

## 21. SwiGLU MLP

- **Plain English.** Expand each position's vector, gate it, contract it back.
- **Technical.** gate = W_gate h, up = W_up h (4096 → 12288); combined = SiLU(gate) ⊙ up; out = W_down combined
  (12288 → 4096). SiLU(z) = z · sigmoid(z).
- **Shape.** [B, T, 4096] → [B, T, 12288] → [B, T, 4096].
- **Equation.** MLP(h) = W_down(SiLU(W_gate h) ⊙ W_up h)
- **Toy example (toy).** gate = 1.5, up = 0.8: SiLU(1.5) = 1.226; combined = 0.981.
- **Qwen connection.** 150,994,944 parameters per block (78% of a block).
- **Misconception.** "The MLP mixes positions." It processes each position independently. Attention mixes across
  positions; the MLP transforms within a position.
- **Teach-back.** Why can the MLP still change what a token "means" in context?

## 22. Residual addition #2

- **Plain English.** Add the MLP update.
- **Technical.** x'' = x' + MLP(RMSNorm(x')).
- **Toy example (measured).** Block 36, last token: ‖x'‖ = 1716, ‖MLP update‖ = 2180, ‖x''‖ = 2101; cosine between
  block input and output 0.34. In this sentence the last block substantially changes the vector's direction.
- **Teach-back.** Can the output norm be smaller than the update norm? When?

## 23. Repeated transformer blocks

- **Plain English.** The same design 36 times with different weights.
- **Technical.** model.layers[0 … 35], each 192,946,432 parameters.
- **Misconception.** "Layer 12 is the syntax layer." No experiment here supports such labels.
- **Teach-back.** What differs between block 3 and block 30?

## 24. Final RMSNorm

- **Plain English.** One last rescaling before the readout.
- **Technical.** model.norm on x^(36); gain mean 2.01 (measured from the weights).
- **Misconception.** In transformers 5.18, `output_hidden_states[-1]` is the output of this norm, while the other
  entries are pre-norm residuals. LatentLens uses explicit hooks to avoid mixing them.
- **Teach-back.** Why does a logit lens apply the final norm before the LM head?

## 25. LM head

- **Plain English.** A score for every vocabulary row.
- **Technical.** z = W h, W ∈ R^{151936 × 4096}, no bias, not tied to the embedding.
- **Shape.** [B, T, 4096] → [B, T, 151936].
- **Misconception.** "Position t's output is about token t."
- **Teach-back.** If the LM head were tied to the embedding, what would the score of a token be?

## 26. Logits

- **Plain English.** Raw, unnormalized scores.
- **Toy example (measured).** After "The researcher opened the notebook", the top logit (".") is 32.25 and its
  probability is 0.162.
- **Misconception.** Logit ≠ probability; only differences between logits matter.
- **Teach-back.** What happens to the probabilities if 10 is added to every logit?

## 27. Softmax

- **Equation.** p_i = exp(z_i) / Σ_j exp(z_j), over all 151,936 rows.
- **Plain English / technical.** Turns scores into a distribution summing to 1; computed in a numerically stable way
  by subtracting the maximum logit.
- **Toy example (toy).** softmax([2, 1, 0]) = [0.665, 0.245, 0.090].
- **Misconception.** "Softmax picks the token."
- **Teach-back.** Why is softmax invariant to adding a constant?

## 28. Decoding

- **Greedy:** argmax. **Temperature:** softmax(z / T); T < 1 sharpens, T > 1 flattens. **Top-k:** keep the k most
  probable, renormalize. **Top-p:** keep the smallest set reaching cumulative probability p, renormalize.
- **Toy example (measured).** For the example sentence the 50 top tokens hold a certain share of the probability at
  each temperature; the Decoding lab computes exact probabilities from normalizers exported per temperature.
- **Misconception.** "Temperature is part of training." Decoding rules exist only at inference.
- **Teach-back.** Why does top-p adapt to the model's uncertainty while top-k does not?

## 29. Training objective

- **Plain English.** Make the true next token as probable as possible, everywhere in the training data.
- **Equation.** L(θ) = −(1/N) Σ log p_θ(x_{t+1} | x_≤t)
- **Toy example (measured, no weights changed).** On "The researcher opened the notebook" the average loss is 8.25
  nats; " researcher" after "The" is the costliest (rank 56,550).
- **Teach-back.** Why is the loss averaged over positions and not only computed at the end?

## 30. Teacher forcing

- **Plain English.** During training each position is given the true previous tokens.
- **Toy example.** Inputs A B C D, targets B C D E, all in one forward pass.
- **Misconception.** "The model trains on its own generations." Not during pretraining.
- **Teach-back.** What is "exposure bias"?

## 31. Cross-entropy

- **Equation.** CE = −log p(true token). Averaged over positions.
- **Toy example (toy).** p(true) = 0.5 → 0.693 nats; p(true) = 0.01 → 4.6 nats.
- **Qwen connection.** Perplexity = exp(mean CE). Measured: Gettysburg Address 2.39, original control paragraph 40.5.
- **Teach-back.** Why does cross-entropy punish confident wrong answers so much?

## 32. Backpropagation

- **Plain English.** An efficient way to compute how the loss changes with every parameter.
- **Technical.** The chain rule applied backwards through the computation graph, reusing intermediate values.
- **Toy example (toy).** h = w₁x, ŷ = w₂h, L = (ŷ − y)²: ∂L/∂w₂ = 2(ŷ − y)h, ∂L/∂w₁ = 2(ŷ − y)w₂x.
- **Teach-back.** Why does backpropagation need the activations from the forward pass?

## 33. Gradients

- **Plain English.** For each parameter, how much and in which direction a small change would change the loss.
- **Technical.** ∇_θ L, same shape as θ: 8.19 billion numbers for Qwen3-8B.
- **Misconception.** "A gradient is the error." It is a derivative of the error.
- **Teach-back.** Is a zero gradient for a parameter evidence that the parameter is unimportant?

## 34. Optimizer

- **Plain English.** Turns gradients into parameter updates.
- **Technical.** SGD: θ ← θ − η∇L. Large language models usually use adaptive optimizers such as AdamW (moment
  estimates, weight decay) with learning-rate schedules. (The Qwen3 report discusses its schedules; LatentLens does not
  depend on optimizer details.)
- **Teach-back.** Why can't you train by applying the gradient of one example only?

## 35. Inference

- **Plain English.** Using the trained, frozen model to produce outputs.
- **Technical.** No gradients, `model.eval()`, `torch.inference_mode()`, generation one token at a time with a KV
  cache and a decoding rule.
- **Teach-back.** Name three things that exist at inference but not in training.

## 36. KV cache

- **Plain English.** Store past keys and values instead of recomputing them for every new token.
- **Technical.** Per layer, K (after RoPE) and V of all past positions are kept. A new token computes its own Q, K, V,
  appends K and V, and attends over all cached keys.
- **Equation.** 147,456 bytes per token for Qwen3-8B in bf16; 4.5 GiB at 32,768 tokens.
- **Misconception.** "Queries are cached." They are not needed after their step.
- **Teach-back.** Why does GQA shrink the KV cache by exactly 4×?

## 37. Hidden states

- **Plain English.** The vectors inside the model: the residual stream at each depth, and intermediate sub-layer values.
- **Technical.** LatentLens records depth 0 (embeddings) and depth k (after block k), plus seven sites inside chosen
  blocks: resid_pre, attn_norm, attn_out, resid_mid, mlp_norm, mlp_out, resid_post.
- **Shape.** [B, T, 4096] per site.
- **Teach-back.** Which two sites differ by exactly the attention update?

## 38. Latent representations

- **Plain English.** What a hidden state encodes, in a form not directly readable by humans.
- **Technical.** A point in R^4096 whose geometry (directions, distances, magnitudes) can be studied with probes and
  projections.
- **Misconception.** "Each coordinate is a feature." Information is usually spread across many directions.
- **Teach-back.** Why is pooling over tokens needed to compare documents of different lengths?

## 39. Linear probes

- **Plain English.** A simple classifier trained on frozen hidden states to see what information is linearly readable.
- **Technical.** StandardScaler + L2 logistic regression; C chosen by cross-validation on train; layer chosen on
  validation; test used once.
- **Misconception.** "If a probe succeeds, the model uses that information." It shows that the information is
  linearly accessible, not that the model uses it.
- **Teach-back.** Why prefer a linear probe over a deep classifier here?

## 40. PCA

- **Plain English.** Find the directions of largest variance and plot the data in the top two.
- **Technical.** Fit on train (after standardization with train statistics), project validation documents.
- **Misconception.** "No visible clusters means no signal." The label may be readable in a direction PCA does not
  show.
- **Teach-back.** Why must PCA be fitted on training data only?

## 41. Logit lens

- **Plain English.** Read an intermediate residual through the model's final norm and LM head.
- **Technical.** z_k = W_LM · RMSNorm_final(x^(k)). Exactly equals the real logits only at k = 36 (tested).
- **Toy example (measured).** For "The researcher opened the notebook", the last position's projection shows
  " notebook" (the current token) around depth 32 and switches to the real prediction "." only at the output. Gettysburg
  Address: the true token's median rank under the projection is 1,564 at depth 23 and 1 by depth 34.
- **Misconception.** "This is the model's prediction at layer k." The head was trained to read only the last residual.
- **Teach-back.** Why might an intermediate layer contain a token's information without the logit lens showing it?

## 42. The LatentLens research question

- **Question.** Where inside Qwen does information useful for distinguishing human-written from AI-generated text
  become linearly accessible, and which computations (attention, MLP, normalization) change it?
- **Design.** EditLens human vs fully AI-generated; frozen Qwen3-8B-Base; pooled representations at all 37 depths;
  probes with validation-only selection; one-time test; shuffled-label, length, token-count, perplexity and stylometry
  controls; held-out generator and domain splits.
- **Status.** Pipeline implemented and tested; the Qwen3-8B run waits for dataset access.
- **Misconception.** "This builds an AI detector." It measures where label-correlated information is linearly
  readable; it cannot prove authorship.
- **Teach-back.** If the length baseline reaches the same ROC-AUC as the best probe, what have we learned?
