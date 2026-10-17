# LLM end-to-end mastery

From one token to a production AI system: every Mastery topic in the A to M format, traced through Qwen3-8B-Base where facts are verifiable.

_Generated from the LatentLens curriculum data (apps/web/src/lib/latent). Edit the data, then regenerate; do not edit by hand._

## Level 1: Transformer foundations

Trace one token through Qwen3-8B.

### Autoregressive language modeling

Route: `/latent/mastery/autoregressive`

**In ten seconds.** A language model is a function that turns all the text so far into a probability for every possible next token.

**Where.** The whole model: text in, one probability distribution over the vocabulary out.

**Mechanism.**
- Text is split into tokens x1 ... xT. The model defines P(x_t | x_1, ..., x_{t-1}) for every position t.
- The probability of a whole sequence factorizes by the chain rule: P(x_1..x_T) = Π_t P(x_t | x_<t). Nothing is assumed beyond this identity.
- Training raises the probability of the token that actually came next (cross-entropy). Generation repeatedly picks a token from the predicted distribution and appends it.
- Why simple prediction yields complex behaviour: to predict text well, a model must track syntax, facts, entities, arithmetic patterns and the intent of the writer, because all of them change what comes next. Capability is whatever reduces prediction error on the training distribution; it is not guaranteed, and it does not imply understanding in a human sense.

```
P(x_1, ..., x_T) = Π_{t=1..T} P(x_t | x_1, ..., x_{t-1})
loss = − (1/T) Σ_t log P(x_t | x_<t)
```

| Input | Operation | Output |
|---|---|---|
| `token ids [T]` | 36 transformer blocks | `hidden states [T, 4096]` |
| `hidden states [T, 4096]` | final RMSNorm + LM head | `logits [T, 151936]` |
| `logits at the last position [151936]` | softmax | `probabilities summing to 1` |

**Qwen connection.**
- (verified) Qwen3-8B-Base is a decoder-only causal language model: every position predicts the next token from earlier positions only.
- (verified) Its output at each position is a vector of 151,936 logits, one per vocabulary entry.
- (verified) After "The researcher opened the notebook" its recorded top next token is "." with p ≈ 0.144; it spreads probability rather than knowing one answer.

**Why it exists.** One objective that needs no labels: every piece of text supplies its own targets, so models can learn from trillions of tokens.

**Without it.** Without the factorization there is no tractable way to score or sample long text; without the causal restriction the model could read the answer it is supposed to predict during training.

**Training vs inference.** Training scores all T positions in parallel against the known next tokens (teacher forcing). Inference produces one new token per step and feeds it back in.

**Security lens.** Everything placed in the context, trusted or not, conditions the next-token distribution. That single fact is the root of prompt injection.

**Common confusion.** "The model looks up answers." It does not retrieve stored sentences; it computes a distribution from learned weights, which is why it can produce fluent text that is false.

**Teach back.** Explain what "predict the next token" means, and why it can produce sophisticated behaviour.
- [ ] conditional probability over the whole vocabulary
- [ ] chain rule over the sequence
- [ ] cross-entropy on the true next token
- [ ] generation as a repeated choice
- [ ] capability as a by-product of reducing prediction error, without mystical claims

**Interview (level 1).** If a model only predicts the next token, how can it answer multi-step questions?

### Tokenization

Route: `/latent/mastery/tokenization`

**In ten seconds.** The model never sees characters or words, only integer ids for pieces of text chosen by a fixed tokenizer.

**Where.** Before the model: text → token ids. After the model: ids → text.

**Mechanism.**
- A byte-level BPE tokenizer starts from bytes and repeatedly merges the most frequent adjacent pairs found in its training corpus, producing a vocabulary of reusable pieces.
- Encoding greedily applies the learned merges, so common strings become one token and rare strings split into several. Any byte sequence can be encoded, so nothing is out of vocabulary.
- Special tokens (such as <|endoftext|>) are reserved ids with control meaning. Chat models add role markers as special tokens.
- Cost, context length and pricing are measured in tokens, not words; languages, code and numbers tokenize at very different rates.

| Input | Operation | Output |
|---|---|---|
| `string` | BPE encode | `ids [T] (int)` |
| `ids [T]` | decode | `the same string (round trip verified)` |

**Qwen connection.**
- (verified) Qwen3 uses a byte-level BPE tokenizer with 151,669 tokenizer entries; the embedding table is padded to 151,936 rows.
- (verified) "unbelievably" becomes 3 tokens (un | belie | vably); "The researcher opened the notebook" is 5 tokens; the leading space belongs to the token (" notebook" = 37166).
- (verified) Digits are split one per token ("1863" → 1 | 8 | 6 | 3); <|endoftext|> is id 151643 and the tokenizer adds no BOS token.

**Why it exists.** A fixed, moderate vocabulary balances sequence length (shorter with bigger pieces) against embedding size and rare-word coverage.

**Without it.** Character-level input makes sequences several times longer and attention cost grows; word-level input cannot represent new words or typos.

**Training vs inference.** Identical in both. The tokenizer is not trained with the model; it is fixed before pretraining.

**Security lens.** Filters that match strings can miss the same content tokenized differently (spacing, Unicode look-alikes, encodings); special-token strings in user text must not be parsed as control tokens; token counts drive cost, so long or token-dense inputs can be used for resource exhaustion. These are real considerations, not proof that tokenization alone breaks safety.

**Common confusion.** "One token is one word." Common English words are often one token, but numbers, rare words, code and many languages use several.

**Teach back.** Explain what the tokenizer does and why it matters for cost and security.
- [ ] text to integer ids
- [ ] subword pieces from BPE merges
- [ ] special tokens
- [ ] the leading space is part of a token
- [ ] costs and limits are in tokens
- [ ] filters and boundaries depend on tokenization

**Interview (level 1).** Why might the same prompt cost different amounts in two languages?

### Embeddings

Route: `/latent/mastery/embeddings`

**In ten seconds.** Each token id selects one learned row of numbers; that row is the token's starting point inside the model.

**Where.** First operation inside the model: ids [T] → vectors [T, 4096].

**Mechanism.**
- The embedding matrix E has one row per vocabulary entry. Embedding is a lookup: h_0[t] = E[x_t]. Equivalently, a one-hot vector times E.
- Token ids are arbitrary labels: id 37166 is not "close" to id 37165 in any meaningful sense. Geometry exists only in the learned rows.
- The rows are trained by gradient descent with the rest of the model, so tokens used in similar contexts tend to end up with related directions.
- Position is not added here in Qwen3; it enters later through RoPE inside attention.

```
h_0 = E[x]     (E ∈ ℝ^{151936 × 4096})
```

| Input | Operation | Output |
|---|---|---|
| `ids [T]` | row lookup in E [151936, 4096] | `h_0 [T, 4096]` |

**Qwen connection.**
- (verified) model.embed_tokens.weight has shape [151936, 4096], stored in bfloat16 (622,329,856 parameters).
- (verified) The input embedding and the LM head are separate matrices (tie_word_embeddings = false).
- (verified) Recorded row for "The": RMS ≈ 0.029, first coordinates −0.0386, 0.0165, −0.0030 …

**Why it exists.** Neural networks operate on vectors; a learned table lets the model place each token wherever it is most useful for prediction.

**Without it.** Feeding raw ids as numbers would impose a fake order (id 5 is "between" 4 and 6); one-hot inputs without a learned projection would be enormous and carry no similarity.

**Training vs inference.** Rows are updated during training (only rows for tokens present in a batch receive gradient). At inference the table is fixed.

**Security lens.** Embedding geometry is what retrieval systems rely on (in separate embedding models); embeddings can leak information about their inputs (embedding inversion research), which matters when vectors are stored or shared.

**Common confusion.** "The embedding is the meaning of the word." It is only the starting vector; the same token's hidden state changes a lot across the 36 blocks depending on context.

**Teach back.** Explain why token ids have no semantic geometry but embeddings do.
- [ ] lookup of one row per id
- [ ] ids are arbitrary labels
- [ ] rows are learned by gradient descent
- [ ] shape [T] to [T, 4096]
- [ ] the starting point, not the final meaning

**Interview (level 2).** What is the parameter count of Qwen3-8B's embedding table, and why is it separate from the LM head?

### The residual stream

Route: `/latent/mastery/residual-stream`

**In ten seconds.** Each position carries one 4,096-number vector up through the model, and every sub-layer only adds an update to it.

**Where.** The vector running through all 36 blocks, from the embedding to the final norm.

**Mechanism.**
- Start: h_0 = embedding. Each block reads the stream, computes two updates and adds them: h ← h + Attn(Norm(h)); h ← h + MLP(Norm(h)).
- Nothing in a block overwrites the stream. After L blocks, h_L = h_0 + Σ (all attention updates) + Σ (all MLP updates): a sum of contributions.
- Sub-layers read normalized copies, but write unnormalized updates back. So the stream's magnitude can grow with depth, while each sub-layer sees a rescaled view.
- Because it is a sum, later layers can read features written by much earlier layers directly. Interpretability methods (logit lens, probes) read this stream at different depths.

```
h_{l+½} = h_l + Attn_l(RMSNorm(h_l))
h_{l+1} = h_{l+½} + MLP_l(RMSNorm(h_{l+½}))
```

| Input | Operation | Output |
|---|---|---|
| `h [T, 4096]` | + attention update [T, 4096] | `h [T, 4096]` |
| `h [T, 4096]` | + MLP update [T, 4096] | `h [T, 4096]` |

**Qwen connection.**
- (verified) Width 4,096 throughout all 36 blocks; pre-norm: input_layernorm before attention, residual added after it.
- (verified) LatentLens recorded the stream's RMS at every block for the running example (Journey scene 6 and Glass Box show real values).
- (verified) Glass Box block 18 reproduces both residual additions exactly from recorded tensors (resid_mid = resid_pre + o_proj output).

**Why it exists.** Addition gives every layer a direct path to the input and the output, which makes deep networks trainable and lets information persist unless something writes against it.

**Without it.** Replacing addition with overwriting would force every block to re-encode everything it should keep; gradients would also have to pass through every sub-layer.

**Training vs inference.** Same computation. In training, gradients flow back through the identity paths unchanged, which is why very deep stacks train.

**Security lens.** Interpretability and some defenses (activation probes for harmful intent, representation monitoring) read the residual stream; they are research tools, not access controls.

**Common confusion.** "Each layer produces a new representation that replaces the old." In this architecture each layer adds a change; the old content is still in the sum.

**Teach back.** Explain how information accumulates in the residual stream across 36 blocks.
- [ ] one vector per position, width 4,096
- [ ] sub-layers read a normalized copy
- [ ] they write an update that is added
- [ ] final state is the embedding plus all updates
- [ ] this enables logit lens and probes at any depth

**Interview (level 2).** Why can a linear probe at layer 20 find information that was computed at layer 5?

### RMSNorm (and Q/K norm)

Route: `/latent/mastery/rmsnorm`

**In ten seconds.** RMSNorm rescales a vector to a standard size, keeping its direction, before a sub-layer reads it.

**Where.** Before attention, before the MLP, after the last block, and on each Q and K head vector.

**Mechanism.**
- RMSNorm(x) = g ⊙ x / sqrt(mean(x²) + ε). It divides by the root-mean-square and multiplies by a learned gain g per dimension.
- LayerNorm additionally subtracts the mean and has a bias: g ⊙ (x − μ) / sqrt(var + ε) + b. RMSNorm skips both.
- Scale invariance: RMSNorm(c·x) = RMSNorm(x) for c > 0 (up to ε). Adding a constant to every coordinate does change the output, unlike LayerNorm.
- Magnitude vs direction: after normalization the reader sees the direction of h (and the gain's emphasis), not how large h has grown. The stream itself keeps its magnitude.

```
RMSNorm(x) = g ⊙ x / √(mean(x²) + ε),  ε = 1e-6
LayerNorm(x) = g ⊙ (x − μ) / √(σ² + ε) + b
```

| Input | Operation | Output |
|---|---|---|
| `h [T, 4096]` | ÷ RMS per position, × g [4096] | `[T, 4096]` |
| `q heads [T, 32, 128]` | q_norm per head vector, × g [128] | `[T, 32, 128]` |

**Qwen connection.**
- (verified) Qwen3RMSNorm, ε = 1e-6, computed in float32: x · rsqrt(mean(x²) + ε), then a learned gain; no bias, no mean subtraction.
- (verified) Four kinds per model: input_layernorm and post_attention_layernorm in each block, q_norm and k_norm (over head_dim = 128, one head vector at a time), and a final model.norm.
- (verified) Glass Box: on real block-18 inputs RMSNorm reproduces the recorded output at bfloat16 precision; LayerNorm comes close (the mean is only 1 to 3% of the RMS) but fits measurably worse.

**Why it exists.** Keeps the scale of each sub-layer's input stable regardless of how large the residual stream has grown, which stabilizes training; RMSNorm is cheaper than LayerNorm and works as well in practice.

**Without it.** Without normalization, inputs to attention and the MLP drift in scale with depth, softmax saturates and training becomes unstable. Without Q/K norm, attention logits can grow very large.

**Training vs inference.** Identical computation; the gains are learned in training and fixed at inference. There are no running statistics (unlike batch norm).

**Security lens.** Activation-based monitors and probes must choose whether to read before or after normalization; pre-norm magnitude can carry information (for example outlier dimensions) that the normalized view hides.

**Common confusion.** "RMSNorm normalizes the residual stream." It normalizes the copy a sub-layer reads; the stream itself is never normalized until the final norm.

**Teach back.** Explain RMSNorm vs LayerNorm, where Qwen3 applies each RMSNorm, and why pre/post-norm states matter for research.
- [ ] formula with RMS and learned gain
- [ ] no mean subtraction, no bias
- [ ] scale invariance and what breaks it
- [ ] four places in Qwen3 including q_norm/k_norm per head
- [ ] magnitude vs direction for probes

**Interview (level 2).** Is RMSNorm(x + c) equal to RMSNorm(x)? Is RMSNorm(3x)?

### Linear projections (xW)

Route: `/latent/mastery/projections`

**In ten seconds.** Multiplying a vector by a learned matrix re-describes it in a new set of directions, possibly of a different size.

**Where.** Everywhere: Q/K/V/O in attention, gate/up/down in the MLP, the LM head.

**Mechanism.**
- For a row vector x ∈ ℝ^{d_in} and a matrix W ∈ ℝ^{d_in × d_out}, y = xW has d_out entries. Each output is a dot product of x with one column of W.
- So each column is a learned "detector" direction: y_j is large when x points along column j.
- Applied to all positions at once: X [T, d_in] × W [d_in, d_out] = Y [T, d_out]. The same W is used at every position (weight sharing across positions).
- Qwen3's projections have no bias term. A projection mixes information within one position only; mixing across positions needs attention.

```
Y = X W,   X ∈ ℝ^{T×d_in},  W ∈ ℝ^{d_in×d_out}
y_j = Σ_i x_i W_{ij}
```

| Input | Operation | Output |
|---|---|---|
| `X [T, 4096]` | × W_Q [4096, 4096] | `Q [T, 4096]` |
| `X [T, 4096]` | × W_K [4096, 1024] | `K [T, 1024]` |

**Qwen connection.**
- (verified) q_proj: 4096 → 4096 (32 heads × 128); k_proj and v_proj: 4096 → 1024 (8 heads × 128); o_proj: 4096 → 4096. No bias.
- (verified) MLP: gate_proj and up_proj 4096 → 12288, down_proj 12288 → 4096.
- (verified) Per block: 41,943,040 attention projection parameters and 150,994,944 MLP parameters, so the MLP holds about 78% of a block.

**Why it exists.** Linear maps are the cheapest learnable way to change representation; stacking them with nonlinearities gives expressive functions.

**Without it.** Without learned projections, attention would compare raw residual vectors with themselves and could not learn what to look for versus what to offer.

**Training vs inference.** Identical. The matrices are the bulk of the parameters and of the compute (matrix multiplications).

**Security lens.** Weights are the model. Access to weights (open models, stolen checkpoints) allows fine-tuning away safety behaviour and white-box adversarial optimization; this is a model-level asset.

**Common confusion.** "W_Q, W_K, W_V are computed from the input." They are fixed learned parameters; only Q, K, V (the products) depend on the input.

**Teach back.** Explain what xW does geometrically and the shapes of Qwen3's attention projections.
- [ ] dot products with columns
- [ ] columns as learned directions
- [ ] same W at every position
- [ ] d_in to d_out shape change
- [ ] Q 4096→4096, K/V 4096→1024

**Interview (level 2).** Why are Qwen3's K and V projections a quarter the size of Q?

### Queries, keys and values

Route: `/latent/mastery/qkv`

**In ten seconds.** Each position asks a question (query), advertises what it contains (key), and offers content to copy (value).

**Where.** Inside attention, right after input_layernorm.

**Mechanism.**
- Q = XW_Q, K = XW_K, V = XW_V, then each is reshaped into heads of 128 dimensions.
- Score between a query position i and key position j: s_ij = q_i · k_j / √d_head. High score = j is relevant to i, as judged by learned projections.
- Weights: a_ij = softmax_j(s_ij) over allowed j. Output for i: Σ_j a_ij v_j, a weighted average of values.
- Keys decide where to look; values decide what is moved. They are separate so that "being findable" and "what gets copied" can differ.

```
Q = XW_Q,  K = XW_K,  V = XW_V
Attn(Q,K,V) = softmax(QKᵀ / √d_head + mask) V
```

| Input | Operation | Output |
|---|---|---|
| `X [T, 4096]` | W_Q, reshape | `Q [T, 32, 128]` |
| `X [T, 4096]` | W_K, W_V, reshape | `K, V [T, 8, 128]` |
| `Q·Kᵀ per head` | scale, mask, softmax | `A [32, T, T]` |
| `A × V` | concat heads, o_proj | `[T, 4096]` |

**Qwen connection.**
- (verified) head_dim 128; 32 query heads; 8 key/value heads; scale 1/√128 ≈ 0.0884.
- (verified) Q and K go through q_norm/k_norm and RoPE; V is neither normalized nor rotated.
- (verified) Glass Box shows the real q, k and v head vectors for block 18 and re-derives the attention weights and the weighted sum.

**Why it exists.** Separating the roles lets the model learn content-based routing: what to search for, how to be found, and what to deliver.

**Without it.** Using the raw vectors for all three roles would force one representation to serve as question, address and payload at once.

**Training vs inference.** Same math. At inference, K and V of past tokens are cached and reused; Q is only needed for the new token.

**Security lens.** Attention is how injected text in the context influences other positions: if a malicious instruction's keys match what later positions query for, its values are copied into their representations.

**Common confusion.** "Q, K and V are three copies of the input." They are three different learned projections of the normalized input.

**Teach back.** Explain Q, K and V precisely, with Qwen3's shapes.
- [ ] three learned projections
- [ ] score = q·k/√d
- [ ] softmax over allowed positions
- [ ] output = weighted sum of values
- [ ] Q [T,32,128], K/V [T,8,128]
- [ ] V is not normalized or rotated

**Interview (level 2).** Walk through attention for one token in one Qwen3 block, with shapes.

### MHA, MQA and GQA

Route: `/latent/mastery/gqa`

**In ten seconds.** Grouped-query attention lets several query heads share one key/value head, cutting the memory that generation needs.

**Where.** The head layout inside attention; decides the size of the KV cache.

**Mechanism.**
- Multi-head attention (MHA): every query head has its own K and V head (H_q = H_kv).
- Multi-query attention (MQA): all query heads share a single K/V head (H_kv = 1). Smallest cache, some quality loss.
- Grouped-query attention (GQA): query heads are split into groups that share one K/V head (1 < H_kv < H_q). A middle point.
- KV-cache bytes per token = 2 (K and V) × layers × H_kv × d_head × bytes per number. Fewer KV heads means proportionally less memory and memory bandwidth per generated token.

```
KV bytes / token = 2 × L × H_kv × d_head × bytes
Qwen3-8B: 2 × 36 × 8 × 128 × 2 = 147,456 bytes (bf16)
```

| Input | Operation | Output |
|---|---|---|
| `K [T, 8, 128]` | repeat each KV head 4 times (or index by group) | `[T, 32, 128]` |
| `cache per layer` | 2 × 8 × 128 numbers per token | `2,048 numbers per token per layer` |

**Qwen connection.**
- (verified) 32 query heads, 8 KV heads: each K/V head is shared by 4 query heads (GQA).
- (verified) KV cache: 147,456 bytes per token in bfloat16, versus 589,824 if it were MHA: a 4x saving. At 32,768 tokens that is about 4.8 GB vs 19.3 GB per sequence.
- (verified) Glass Box tests the grouping: matching query head h to KV head ⌊h/4⌋ reproduces the recorded attention; the wrong (modulo) grouping does not.

**Why it exists.** Generation is often limited by moving the KV cache through memory, not by arithmetic. GQA keeps most of MHA's quality with a fraction of the cache.

**Without it.** With MHA at long context, the cache dominates GPU memory and limits batch size; with MQA, quality can drop because one K/V head serves every query head.

**Training vs inference.** The math is the same in training, but the benefit appears mostly at inference, where the cache is stored and read every step.

**Security lens.** Cache size drives cost; long-context requests are a resource-exhaustion vector. Shared prefix caches across users must never mix tenants' data.

**Common confusion.** "GQA reduces the number of attention heads." Qwen3 still has 32 query heads and 32 attention patterns; only K and V are shared.

**Teach back.** Explain MHA, MQA and GQA, and compute Qwen3's KV cache per token.
- [ ] the three head layouts
- [ ] KV heads shared by groups of query heads
- [ ] the bytes-per-token formula
- [ ] 147,456 bytes vs 589,824
- [ ] why memory bandwidth dominates decoding

**Interview (level 3).** Why does GQA reduce KV-cache memory, and what does it not reduce?

### RoPE: rotary position embedding

Route: `/latent/mastery/rope`

**In ten seconds.** RoPE rotates each query and key by an angle that grows with its position, so their dot product depends on how far apart they are.

**Where.** Inside attention, on Q and K after q_norm/k_norm, in every block.

**Mechanism.**
- Split a 128-number head vector into 64 pairs. Pair i is treated as a 2D point and rotated by angle m·θ_i, where m is the position and θ_i = base^(−2i/d).
- Rotation preserves length. For a query at position m and a key at n, (R_m q)·(R_n k) = q·(R_{n−m} k): the score depends on the offset n − m, not on absolute positions.
- Low i rotates fast (short wavelength, fine position detail); high i rotates slowly (long wavelength, coarse distance).
- Only Q and K are rotated; V and the residual stream carry no position signal from RoPE.

```
θ_i = base^{−2i/d_head},  i = 0..63,  base = 1,000,000
(R_m q) · (R_n k) = q · (R_{n−m} k)
```

| Input | Operation | Output |
|---|---|---|
| `q, k [T, H, 128]` | rotate 64 pairs by m·θ_i | `same shape, same length` |

**Qwen connection.**
- (verified) rope_theta = 1,000,000; 64 frequencies per head; wavelengths from about 6.3 to about 5.06 million tokens; no rope scaling in the base config.
- (verified) Rotate-half pairing: dimension i is paired with i + 64 (not adjacent pairs).
- (verified) Glass Box: rotating by the true position (5) reproduces the recorded q and k; position 4 or interleaved pairing does not.

**Why it exists.** Attention itself is order-blind (a weighted sum over a set). RoPE injects order in a way that naturally expresses relative distance and does not add anything to the stream.

**Without it.** Without position information, "dog bites man" and "man bites dog" would produce the same attention inputs. Wrong pairing or position shifts break the match with trained weights.

**Training vs inference.** Same rotation. At inference, cached keys were rotated at their own positions; the new query is rotated at its position. Context extension methods rescale θ.

**Security lens.** Very long contexts can dilute attention to early instructions; position does not confer authority (an instruction late in context is not more trusted, it may just be closer).

**Common confusion.** "RoPE adds a position vector to the embedding." It multiplies (rotates) Q and K inside attention; nothing is added to the embedding.

**Teach back.** Explain RoPE mathematically and why relative position emerges.
- [ ] pairs of dimensions rotated
- [ ] angle = position × frequency
- [ ] rotation preserves length
- [ ] dot product depends on offset
- [ ] only Q and K
- [ ] rotate-half pairing and base 1e6 in Qwen3

**Interview (level 3).** Why does RoPE encode relative position even though each vector is rotated by its absolute position?

### Causal attention, end to end

Route: `/latent/mastery/causal-attention`

**In ten seconds.** Each position mixes in information from itself and earlier positions, weighted by learned relevance, and never from the future.

**Where.** The first sub-layer of every block.

**Mechanism.**
- Scores S = QKᵀ/√d per head, shape [T, T]. Causal mask: set S_ij = −∞ for j > i, so softmax gives those positions zero weight.
- A = softmax(S) row by row; each row sums to 1. Output per head O = AV, shape [T, 128].
- Concatenate the 32 head outputs to [T, 4096] and apply o_proj (4096 → 4096). The result is the attention update added to the residual stream.
- Cost: computing S is O(T² · d) per layer, so time and memory for the score matrix grow quadratically with sequence length (fused kernels avoid storing all of S).

```
A = softmax(QKᵀ/√d_head + M),  M_ij = 0 if j ≤ i else −∞
out = concat_h(A_h V_{g(h)}) W_O
```

| Input | Operation | Output |
|---|---|---|
| `Q [32, T, 128], K [32, T, 128]` | QKᵀ/√128 + mask | `S [32, T, T]` |
| `S` | softmax over keys | `A [32, T, T]` |
| `A, V` | AV, concat, o_proj | `[T, 4096]` |

**Qwen connection.**
- (verified) Causal attention with scale head_dim^−0.5; 32 heads, 8 KV groups; o_proj 4096 → 4096 without bias.
- (verified) No sliding window in the base config: every position may attend to all earlier positions (max_position_embeddings 32,768).
- (verified) Glass Box re-derives softmax (relative error about 1.5e-2 at bf16) and the weighted sum of values for real block-18 tensors.

**Why it exists.** Attention is the only place where positions exchange information; the mask makes training on all positions at once consistent with left-to-right generation.

**Without it.** Without the mask, training positions could read their own targets (the loss would collapse while generation fails). Without attention, each token would be processed in isolation.

**Training vs inference.** Training computes the full masked T×T matrix. Inference with a KV cache computes one new row per step against cached keys.

**Security lens.** This is the mechanism by which any text in the window, including retrieved documents or tool output, can steer later tokens. There is no attention-level notion of "trusted" positions.

**Common confusion.** "Attention weights explain the model's decision." They show where information was read from in one head; they are not by themselves a faithful explanation.

**Teach back.** Explain causal attention from scores to the residual update, including cost.
- [ ] QKᵀ/√d
- [ ] causal mask with −∞
- [ ] row-wise softmax
- [ ] weighted sum of V
- [ ] concat heads and o_proj
- [ ] quadratic in T

**Interview (level 3).** Why is attention quadratic in sequence length, and what does a KV cache change?

### The MLP (SwiGLU)

Route: `/latent/mastery/swiglu`

**In ten seconds.** Attention moves information between positions; the MLP transforms the features within each position.

**Where.** The second sub-layer of every block.

**Mechanism.**
- SwiGLU: MLP(x) = W_down (SiLU(x W_gate) ⊙ (x W_up)). SiLU(z) = z · sigmoid(z).
- The gate branch decides how much of each of the 12,288 intermediate features passes; the up branch provides the values; the product is projected back to 4,096.
- It is applied to each position independently with the same weights: position 3's MLP never sees position 5.
- Most parameters live here (about 151M of 193M per Qwen3 block). Interpretability work often treats MLP neurons as key-value memories that write features into the stream.

```
MLP(x) = (SiLU(x W_gate) ⊙ x W_up) W_down
SiLU(z) = z · σ(z)
```

| Input | Operation | Output |
|---|---|---|
| `x [T, 4096]` | gate_proj, up_proj | `[T, 12288] each` |
| `SiLU(gate) ⊙ up` | down_proj | `[T, 4096] update` |

**Qwen connection.**
- (verified) gate_proj and up_proj 4096 → 12288, down_proj 12288 → 4096, activation SiLU, no bias.
- (verified) Glass Box reproduces the gate ⊙ up product from recorded tensors; ReLU or swapping gate and up does not fit.

**Why it exists.** Attention only takes weighted averages of values; a position-wise nonlinear network is needed to compute new features and store learned associations.

**Without it.** Without the MLP, the model is mostly linear mixing and loses most of its capacity and stored knowledge. Without gating, quality per parameter is lower (empirically).

**Training vs inference.** Identical computation. In mixture-of-experts models the MLP is replaced by several expert MLPs and a router.

**Security lens.** Knowledge edits, backdoors and fine-tuning changes often show up in MLP weights; model-poisoning research frequently targets them.

**Common confusion.** "The MLP lets tokens talk to each other." It never does; only attention mixes positions.

**Teach back.** Explain SwiGLU and the attention-versus-MLP division of labour.
- [ ] gate and up projections to 12,288
- [ ] SiLU gate times up
- [ ] down projection to 4,096
- [ ] per position, no mixing
- [ ] attention = between positions, MLP = within a position
- [ ] most of the parameters

**Interview (level 1).** Attention vs MLP: what does each do that the other cannot?

### Residual connections and depth

Route: `/latent/mastery/residual-connections`

**In ten seconds.** Adding each sub-layer's output to its input gives gradients and information a highway through 72 sub-layers.

**Where.** Around every attention and MLP sub-layer (two per block, 72 in Qwen3-8B).

**Mechanism.**
- y = x + F(x). The Jacobian is I + ∂F/∂x, so gradients always include an identity term and do not vanish just because F's gradient is small.
- At initialization, F is small, so the network starts near the identity and can learn refinements layer by layer.
- Pre-norm (normalize the input of F, not the sum) keeps this identity path clean; it is the norm in modern LLMs, including Qwen3.
- Depth gives more sequential computation steps; residual connections let some layers contribute little without harming the result.

```
y = x + F(Norm(x))
∂y/∂x = I + ∂F/∂x
```

| Input | Operation | Output |
|---|---|---|
| `x [T, 4096]` | x + F(Norm(x)) | `[T, 4096]` |

**Qwen connection.**
- (verified) Two residual additions per block, 36 blocks; pre-norm placement verified from the module source order.

**Why it exists.** Very deep networks without skip connections are hard to optimize: signals and gradients shrink or explode through many layers.

**Without it.** Remove residuals and a 36-block model trains poorly or not at all; ablation studies of single layers also become destructive instead of mild.

**Training vs inference.** Important mainly for training dynamics; at inference they define the computation (the sum).

**Security lens.** Because layers add rather than replace, a fine-tune or adapter that adds small updates (LoRA) can change behaviour substantially with few parameters, which is relevant to model poisoning via adapters.

**Common confusion.** "Residual connection" and "residual stream" are the same thing. The connection is the + operation; the stream is the vector it builds up.

**Teach back.** Explain why residual connections matter for optimization and information flow.
- [ ] y = x + F(x)
- [ ] identity term in the gradient
- [ ] near-identity at initialization
- [ ] pre-norm placement
- [ ] difference between connection and stream

**Interview (level 3).** Why do pre-norm transformers train more stably than post-norm ones at depth?

### Final norm and LM head

Route: `/latent/mastery/lm-head`

**In ten seconds.** After the last block, the final vector is normalized and compared with one output direction per vocabulary token to produce scores.

**Where.** After block 36: hidden [4096] → logits [151936].

**Mechanism.**
- z = RMSNorm_final(h_L) W_U, where W_U ∈ ℝ^{4096 × 151936}. Each logit is a dot product of the final state with one token's output vector.
- Logits are unnormalized log-scores; only differences matter (adding a constant to all logits does not change softmax).
- The logit lens applies the same final norm and W_U to intermediate layers to see which tokens they already point toward; these are diagnostic projections, not the model's outputs.

```
z = RMSNorm(h_36) W_U,   W_U ∈ ℝ^{4096×151936}
p = softmax(z)
```

| Input | Operation | Output |
|---|---|---|
| `h_36 [T, 4096]` | final RMSNorm | `[T, 4096]` |
| `[T, 4096]` | × W_U | `logits [T, 151936]` |

**Qwen connection.**
- (verified) model.norm (RMSNorm) then lm_head [4096 → 151936], untied from the input embedding (622,329,856 parameters).
- (verified) LatentLens's Recall Microscope projects intermediate layers through this head to track the true token's rank by depth.

**Why it exists.** Converts the internal representation into a score for every possible next token, which the loss and the decoder need.

**Without it.** Without the final norm, logit scale would depend on the stream's magnitude; without the head there is no token prediction.

**Training vs inference.** Training computes logits for all positions; inference usually needs only the last position's logits.

**Security lens.** Full logit or log-prob access leaks more information than text alone; APIs that expose top-k log-probs make model extraction and membership inference easier.

**Common confusion.** "Logits are probabilities." They are unnormalized scores; softmax turns them into probabilities.

**Teach back.** Explain how the final hidden vector becomes vocabulary scores, and what the logit lens does.
- [ ] final RMSNorm
- [ ] matrix W_U of shape 4096 × 151936
- [ ] dot product per token
- [ ] logits vs probabilities
- [ ] logit lens as a diagnostic on earlier layers

**Interview (level 4).** What does the logit lens tell you, and what can it not tell you?

### Softmax and decoding

Route: `/latent/mastery/decoding`

**In ten seconds.** Decoding is the policy that turns a probability distribution into one chosen token, repeated until the answer ends.

**Where.** Outside the network, after the logits, once per generated token.

**Mechanism.**
- Softmax with temperature: p_i = exp(z_i/T) / Σ_j exp(z_j/T). T < 1 sharpens, T > 1 flattens; T → 0 is greedy (argmax).
- Top-k keeps the k highest tokens; top-p (nucleus) keeps the smallest set whose probability reaches p; both renormalize before sampling.
- Repetition and frequency penalties lower logits of tokens already generated; stop conditions end generation (EOS token, length).
- Decoding never changes the model's weights; the same model can be cautious or creative depending only on this policy.

```
p_i(T) = exp(z_i/T) / Σ_j exp(z_j/T)
greedy: argmax_i z_i
```

| Input | Operation | Output |
|---|---|---|
| `logits [151936]` | ÷ T, top-k/top-p filter | `renormalized distribution` |
| `distribution` | sample one index | `next token id` |

**Qwen connection.**
- (verified) LatentLens recorded exact full-vocabulary normalizers at T = 0.25, 0.5, 0.7, 1.0, 1.5, 2.0 for the running example; at T = 1 the top token "." has p ≈ 0.144 and the top-20 cover 78% of the mass.
- (verified) The base model has no built-in chat template or stop policy beyond <|endoftext|>; these are application choices.

**Why it exists.** Different applications need different trade-offs: deterministic answers for extraction, diversity for brainstorming.

**Without it.** Pure greedy decoding often loops or repeats; high temperature produces incoherent text.

**Training vs inference.** Inference only. Training uses the logits directly in the loss; there is no sampling in pretraining.

**Security lens.** Sampling makes attack success probabilistic: a jailbreak may work 1 time in 20, so evaluations must use many samples and report rates, not single anecdotes.

**Common confusion.** "Temperature makes the model more or less knowledgeable." It only reshapes the same distribution.

**Teach back.** Explain greedy, temperature, top-k and top-p, and why sampling matters for evaluation.
- [ ] softmax with temperature
- [ ] greedy as T → 0
- [ ] top-k and top-p filtering then renormalize
- [ ] repetition penalties
- [ ] weights unchanged
- [ ] attack success as a rate

**Interview (level 4).** Why should a red-team report give an attack success rate rather than a single transcript?

## Level 2: Training and post-training

From corpus to gradient update to assistant.

### Pretraining data: from the web to token sequences

Route: `/latent/mastery/pretraining-data`

**In ten seconds.** A base model is shaped by what it reads, so most pretraining engineering is deciding which text to keep and how to pack it.

**Where.** Before any training step: corpus → filtered, deduplicated, tokenized, packed sequences.

**Mechanism.**
- Collection: web crawls, books, code, papers, multilingual and synthetic data, subject to licensing and policy.
- Filtering: language identification, quality classifiers, heuristic rules, removal of unsafe or personal data; deduplication (exact and near-duplicate, e.g. MinHash) to avoid memorization and wasted compute.
- Tokenization of the whole corpus, then packing documents into fixed-length sequences separated by an end-of-text token; a data mixture sets the sampling weight of each source.
- Batches of sequences feed the training loop; held-out sets measure loss on unseen data and contamination checks look for benchmark leakage.

| Input | Operation | Output |
|---|---|---|
| `documents` | filter, dedupe, tokenize | `token streams` |
| `token streams` | pack with <|endoftext|> | `sequences [N, L]` |

**Qwen connection.**
- (verified) Qwen3 was pretrained on about 36 trillion tokens covering 119 languages and dialects (Qwen's own report).
- (verified) Three pretraining stages per Qwen: over 30T tokens at 4K context, an additional 5T knowledge-intensive tokens, then high-quality long-context data extending context to 32K.
- (unknown) The exact data sources, filters and mixture weights are not fully disclosed.

**Why it exists.** Quality and diversity of data limit what the model can learn; duplicates cause memorization and overweight some text.

**Without it.** Unfiltered data teaches spam, toxicity and errors; duplicated data increases verbatim memorization (a privacy risk) and wastes compute.

**Training vs inference.** Training only. Inference never sees the corpus, but the corpus determines what the weights encode.

**Security lens.** This is where data poisoning happens: anyone who can place content in crawled sources can try to influence the model; memorized personal data can later be extracted.

**Common confusion.** "Pretraining data is a database the model queries." The data shapes weights and is then discarded; the model cannot cite or look it up.

**Teach back.** Explain the pipeline from raw corpus to training sequences and its security relevance.
- [ ] collection and licensing
- [ ] quality filtering
- [ ] deduplication and why
- [ ] tokenization and packing
- [ ] mixture weights
- [ ] poisoning and memorization risks

**Interview (level 3).** Why does deduplication matter for both quality and privacy?

### One training step: loss, backprop, optimizer

Route: `/latent/mastery/training-step`

**In ten seconds.** Run the batch forward, measure how surprised the model was by the true next tokens, compute how each weight contributed, and nudge every weight a little.

**Where.** The inner loop repeated millions of times during pretraining.

**Mechanism.**
- Forward: logits for every position. Targets: the same sequence shifted by one. Loss: mean cross-entropy −log p(true next token).
- Backward: backpropagation applies the chain rule from the loss through the LM head, all 36 blocks and the embedding, producing a gradient for every parameter.
- Optimizer: AdamW keeps running averages of gradients and squared gradients, takes a normalized step and applies decoupled weight decay. Gradient clipping caps the global gradient norm.
- Learning-rate schedule: warmup then decay (e.g. cosine). Mixed precision: bf16 activations and matmuls with fp32 master weights and optimizer state.

```
L = −(1/N) Σ log softmax(z)_{target}
∂L/∂z = softmax(z) − onehot(target)
θ ← θ − η · AdamW(∇θ L)
```

| Input | Operation | Output |
|---|---|---|
| `ids [B, L]` | forward | `logits [B, L, 151936]` |
| `logits, ids shifted` | cross-entropy | `scalar loss` |
| `loss` | backward | `gradients, same shapes as weights` |

**Qwen connection.**
- (verified) Qwen3-8B has 8,190,735,360 parameters, every one of which receives gradient updates during pretraining.
- (generic) Optimizer settings, batch sizes and schedules for Qwen3 are not fully disclosed; AdamW with warmup and decay is the generic modern default.

**Why it exists.** Gradient descent is the only practical way to fit billions of parameters to trillions of tokens.

**Without it.** Too high a learning rate diverges (loss spikes); no clipping lets rare huge gradients destroy training; fp16 without care overflows (bf16 avoids most of this).

**Training vs inference.** Only training computes gradients and changes weights. Inference runs the forward pass alone.

**Security lens.** Fine-tuning uses the same step: anyone with weights and a small dataset can change behaviour, including removing safety training. Poisoned examples act through exactly these gradients.

**Common confusion.** "The model learns from my chats as I use it." Inference does not update weights; any learning from usage requires a separate training run.

**Teach back.** Explain one training step end to end.
- [ ] forward with shifted targets
- [ ] cross-entropy
- [ ] backprop through all layers
- [ ] AdamW, clipping, schedule
- [ ] mixed precision
- [ ] weights change only here

**Interview (level 2).** What is the gradient of cross-entropy with respect to the logits, and why is it convenient?

### Scaling: distributed training, checkpoints, evaluation

Route: `/latent/mastery/distributed-training`

**In ten seconds.** A model too big for one GPU is split across many: copies of the model on different data, pieces of each layer, or groups of layers.

**Where.** How the training step is executed on a cluster.

**Mechanism.**
- Data parallelism: each GPU holds a replica and processes different data; gradients are averaged (all-reduce). Sharded variants (ZeRO / FSDP) split optimizer state, gradients and weights across GPUs.
- Tensor parallelism: one matrix multiplication is split across GPUs (for example columns of W_Q); needs fast interconnect.
- Pipeline parallelism: different layers live on different GPUs; micro-batches flow through the pipeline. Expert parallelism places MoE experts on different devices.
- Checkpointing saves weights and optimizer state regularly; evaluation tracks held-out loss and benchmarks. Scaling laws relate loss to parameters, data and compute and guide budget choices.

| Input | Operation | Output |
|---|---|---|
| `batch` | split across N replicas | `N micro-batches` |
| `W [4096, 4096]` | split columns over k GPUs | `k shards [4096, 4096/k]` |

**Qwen connection.**
- (unknown) Qwen's cluster layout and parallelism settings are not public in detail.
- (generic) Training an 8B model in bf16 with AdamW needs roughly 16 bytes per parameter for weights, gradients and optimizer state (about 130 GB) before activations, which is why sharding is needed.

**Why it exists.** Frontier models need more memory and compute than any single accelerator provides.

**Without it.** Without sharding, an 8B model's training state does not fit on common GPUs; without checkpoints, a hardware failure loses weeks of work.

**Training vs inference.** Parallelism exists at inference too (tensor parallelism for big models), but optimizer state and gradients exist only in training.

**Security lens.** Checkpoints and training clusters are high-value assets: stolen weights are model theft; tampered checkpoints are a supply-chain risk.

**Common confusion.** "Data parallelism splits the model." It replicates the model and splits the data; tensor and pipeline parallelism split the model.

**Teach back.** Explain data, tensor, pipeline and expert parallelism and why they are needed.
- [ ] memory per parameter in training
- [ ] replicas plus all-reduce
- [ ] splitting a matmul
- [ ] splitting layers with micro-batches
- [ ] experts on devices
- [ ] checkpoints and evaluation

**Interview (level 3).** Estimate the training memory for an 8B model with AdamW in mixed precision.

### Post-training: SFT, reward models, RLHF, DPO

Route: `/latent/mastery/post-training`

**In ten seconds.** A base model continues text; post-training reshapes it into an assistant by imitating good answers and then optimizing for preferred ones.

**Where.** After pretraining, before deployment: base model → assistant model.

**Mechanism.**
- Supervised fine-tuning (SFT): train on demonstration conversations (prompt → ideal response) with cross-entropy on the response tokens. Weights change; the format and behaviour shift toward the examples.
- Preference data: for a prompt, humans (or a model, RLAIF) choose the better of two responses. A reward model learns to score responses: Bradley-Terry loss −log σ(r(chosen) − r(rejected)).
- RLHF with PPO: generate responses, score them with the reward model, update the policy to increase reward while a KL penalty keeps it close to the SFT model.
- DPO: skips the explicit reward model and RL loop, directly increasing the log-probability ratio of chosen over rejected responses relative to a reference model. Also used: rejection sampling (keep best-of-n), distillation from a stronger model, and RL with verifiable rewards for reasoning.

```
Reward model: L = −log σ(r(x, y_w) − r(x, y_l))
PPO objective ≈ E[r(x, y)] − β KL(π ‖ π_ref)
DPO: L = −log σ(β[log π(y_w|x)/π_ref(y_w|x) − log π(y_l|x)/π_ref(y_l|x)])
```

| Input | Operation | Output |
|---|---|---|
| `(prompt, ideal answer)` | SFT cross-entropy | `SFT model` |
| `(prompt, chosen, rejected)` | reward model or DPO | `preference-tuned model` |

**Qwen connection.**
- (verified) Qwen3-8B-Base, the model LatentLens studies, is the pretrained base model, before post-training.
- (verified) Qwen describes a multi-stage post-training pipeline for its instruct and thinking models (long chain-of-thought cold start, reasoning RL, thinking-mode fusion, general RL) in its Qwen3 blog and report.

**Why it exists.** Next-token prediction on web text does not by itself produce helpful, honest, safe answers or follow instructions reliably.

**Without it.** Without post-training a base model may continue a question with more questions; over-optimizing a reward model leads to reward hacking (verbose, sycophantic answers).

**Training vs inference.** All of these change weights during training. Inference-time reasoning (thinking tokens) uses the trained model without changing it.

**Security lens.** Safety behaviours learned in post-training are statistical, so jailbreaks look for inputs outside the trained distribution; fine-tuning can remove them; poisoned preference data can implant behaviour.

**Common confusion.** Do not conflate: pretraining (next-token on a huge corpus), instruction tuning / SFT (imitate demonstrations), preference optimization (RLHF, DPO) and inference-time reasoning (no weight change).

**Teach back.** Explain base → SFT → preference optimization → assistant, and what changes in the weights at each stage.
- [ ] base model only continues text
- [ ] SFT imitates demonstrations
- [ ] reward model from comparisons
- [ ] PPO with KL penalty
- [ ] DPO without a reward model
- [ ] inference-time reasoning changes no weights

**Interview (level 3).** PPO vs DPO: what is the practical difference?

### Modern architectures: dense, MoE, long context, multimodal

Route: `/latent/mastery/architectures`

**In ten seconds.** Most modern LLMs are the same transformer recipe; the differences are where compute is spent per token, how attention scales, and what inputs are encoded.

**Where.** Variations on the block you already know.

**Mechanism.**
- Dense: every parameter is used for every token (Qwen3-8B).
- Mixture-of-experts (MoE): the MLP is replaced by many expert MLPs and a router that sends each token to a few. Total parameters grow; active parameters per token stay small.
- Attention variants: GQA/MQA shrink the KV cache; sliding-window or local attention limits how far back some layers look; compressed or sparse attention reduce long-context cost.
- Multimodal: an encoder (for images, audio) produces vectors that an adapter maps into the LLM's token space; the transformer then attends over text and image tokens together. Reasoning-oriented models differ mainly in post-training, not in block design.

| Input | Operation | Output |
|---|---|---|
| `x [4096]` | router scores over E experts, top-k | `k expert MLP outputs, weighted sum` |

**Qwen connection.**
- (verified) Qwen3-8B: dense, GQA (32/8), no sliding window in the base config, text-only.
- (verified) Qwen3 also released MoE models (Qwen3-235B-A22B, Qwen3-30B-A3B: total vs activated parameters).
- (verified) Qwen3.8-2.4T-A95B model card (August 2026): 512 experts, 10 routed + 1 shared active per token, 95B of 2.4T parameters active, text-only. Checked 17 October 2026.
- (verified) DeepSeek-V4-Pro model card (2026): MoE, 1.6T parameters with 49B activated, hybrid compressed attention, 1M context. Checked 17 October 2026.

**Why it exists.** MoE buys capacity without paying full compute per token; attention variants make long contexts affordable; adapters reuse strong encoders.

**Without it.** MoE adds routing instability and memory for all experts; aggressive local attention can lose long-range dependencies.

**Training vs inference.** MoE needs load-balancing losses in training; at inference all experts must be in memory even though few run per token.

**Security lens.** Open-weight vs closed changes the threat model (white-box attacks and fine-tuning vs black-box API attacks); multimodal inputs add new injection channels (text inside images).

**Common confusion.** "A 2.4T MoE model costs as much per token as a 2.4T dense model." Compute per token follows the active parameters (95B here); memory follows the total.

**Teach back.** Explain dense vs MoE, the attention variants for long context, and how images enter a multimodal LLM.
- [ ] active vs total parameters
- [ ] router and top-k experts
- [ ] GQA and sliding-window
- [ ] encoder plus adapter for images
- [ ] reasoning as post-training

**Interview (level 3).** Why do MoE models have high memory needs but modest per-token compute?

## Level 3: Inference and serving

From request to prefill, KV cache and decode.

### Inference: prefill, KV cache, decode

Route: `/latent/mastery/prefill-decode`

**In ten seconds.** Reading the prompt happens all at once (prefill); writing the answer happens one token at a time (decode), reusing stored keys and values.

**Where.** Inside the model server for every request.

**Mechanism.**
- Prefill: the whole prompt goes through the model in one parallel pass; every layer's K and V for every prompt token are stored in the KV cache. This is compute-bound and sets time to first token (TTFT).
- Decode: each step runs only the newest token, computes its Q, K, V, appends K and V to the cache, attends over all cached keys, and samples one token. This is usually memory-bandwidth-bound and sets inter-token latency.
- KV memory per sequence = bytes per token × tokens. It grows linearly with context and limits how many requests fit on a GPU.
- Without a cache, each step would recompute K and V for the whole prefix, multiplying work by the sequence length.

```
TTFT ≈ prefill time;  latency per output token ≈ decode step time
KV bytes = 147,456 × tokens  (Qwen3-8B, bf16)
```

| Input | Operation | Output |
|---|---|---|
| `prompt ids [T]` | prefill (parallel) | `KV cache [36 × 2 × T × 8 × 128] + first logits` |
| `new id [1]` | decode step | `cache grows by 1, next logits` |

**Qwen connection.**
- (verified) Qwen3-8B KV cache: 147,456 bytes per token (bf16): about 0.6 GB for a 4,096-token context, about 4.8 GB at 32,768.
- (verified) Weights alone: 16.38 GB in bf16, read once per decode step for each batch, which is why decoding is bandwidth-bound at small batch sizes.

**Why it exists.** Separating the phases explains almost every serving metric and optimization.

**Without it.** No cache: quadratic recomputation per token. A cache that does not fit: requests are queued or evicted.

**Training vs inference.** Inference only. Training processes full sequences with the causal mask and needs no cache.

**Security lens.** Long prompts make prefill expensive (resource exhaustion); caches shared between requests must be isolated per tenant (cache side channels have been studied).

**Common confusion.** "Agent memory is the KV cache." The KV cache lives only for one request's computation; agent memory is stored text reinserted into future prompts.

**Teach back.** Explain prefill vs decode and what the KV cache stores.
- [ ] prefill parallel, compute-bound, TTFT
- [ ] decode one token, bandwidth-bound
- [ ] cache stores K and V per layer per token
- [ ] bytes per token for Qwen3-8B
- [ ] why no cache is quadratic

**Interview (level 3).** Why is decoding usually memory-bandwidth-bound?

### Serving systems: batching, paged attention, prefix caching

Route: `/latent/mastery/serving`

**In ten seconds.** A model server is a scheduler that keeps the GPU busy by mixing many requests while managing KV-cache memory like an operating system manages pages.

**Where.** Between the API and the GPU.

**Mechanism.**
- Static batching waits for a batch and runs it to completion; short requests wait for long ones. Continuous (in-flight) batching adds and removes requests at every decode step.
- Paged attention stores the KV cache in fixed-size blocks with a block table, so memory is allocated on demand, fragmentation is low and blocks can be shared (vLLM introduced this).
- Prefix caching reuses the KV blocks of a shared prompt prefix (same system prompt) across requests. Chunked prefill interleaves long prefills with decodes to protect latency.
- Metrics: TTFT, inter-token latency, throughput (tokens per second across all users), and goodput under latency targets.

| Input | Operation | Output |
|---|---|---|
| `requests with different lengths` | scheduler: continuous batching | `one fused batch per step` |
| `KV cache` | blocks of e.g. 16 tokens + block table | `on-demand pages` |

**Qwen connection.**
- (generic) Serving Qwen3-8B is an application choice; nothing about these techniques is specific to Qwen.

**Why it exists.** GPU time is expensive; batching amortizes weight reads, and paging avoids reserving memory for the maximum length of every request.

**Without it.** Naive batching gives poor latency and low utilization; contiguous preallocated caches waste memory and cap concurrency.

**Training vs inference.** Inference only: training processes fixed-size batches of full sequences and keeps no KV cache, so continuous batching and paging do not apply there.

**Security lens.** Shared prefix caches must be scoped per tenant; request scheduling is a denial-of-service surface (very long prompts or outputs starve others) so quotas and limits are part of serving.

**Common confusion.** "Throughput and latency improve together." Larger batches raise throughput but can raise each user's latency; serving is a trade-off.

**Teach back.** Explain continuous batching, paged attention and prefix caching.
- [ ] static vs continuous batching
- [ ] KV blocks and block tables
- [ ] sharing prefix blocks
- [ ] chunked prefill
- [ ] TTFT, ITL, throughput trade-off

**Interview (level 4).** Why did paged attention increase serving throughput?

### Efficiency: FlashAttention, quantization, speculative decoding

Route: `/latent/mastery/efficiency`

**In ten seconds.** Make each token cheaper by moving fewer bytes (fused kernels, smaller numbers) or by guessing several tokens and verifying them at once.

**Where.** Kernels and model formats inside the server.

**Mechanism.**
- FlashAttention computes exact attention in tiles held in fast on-chip memory, never materializing the full T×T score matrix in GPU main memory. Same result, far less memory traffic.
- Quantization stores weights (and sometimes activations or the KV cache) in fewer bits: bf16 (16), INT8, INT4. Weight-only methods such as GPTQ (error-compensating rounding) and AWQ (protects activation-salient channels) keep quality close to bf16.
- Speculative decoding: a small draft model proposes several tokens; the large model scores them in one pass and accepts a prefix; with the standard acceptance rule the output distribution matches the large model exactly.
- Bottleneck reasoning: at small batch, decode is limited by memory bandwidth (bytes per step), so fewer bytes per weight speeds it up nearly proportionally.

| Input | Operation | Output |
|---|---|---|
| `W bf16 [4096, 4096] (32 MB)` | INT4 + scales | `≈ 8 MB` |

**Qwen connection.**
- (verified) Qwen3-8B stored weights: 16.38 GB in bf16; INT4 weight-only would be about a quarter of that (plus small overhead).
- (verified) LatentLens measured precision effects directly: bf16 vs fp32 recall on the Gettysburg passage (see the Recall page's precision check).

**Why it exists.** Latency and cost per token decide whether a model is usable in production.

**Without it.** Too aggressive quantization degrades quality, especially on reasoning and rare tokens; speculative decoding with a poor draft model gives no speedup.

**Training vs inference.** Mostly inference. FlashAttention is used in training too; quantization-aware training exists but post-training quantization is common.

**Security lens.** Downloaded quantized checkpoints are third-party artifacts (supply chain); quantization can change safety behaviour, so evals should be rerun on the deployed format.

**Common confusion.** "FlashAttention approximates attention." It computes exact attention; it only reorganizes the computation.

**Teach back.** Explain FlashAttention, quantization and speculative decoding, and which bottleneck each attacks.
- [ ] tiling, exact result, less memory traffic
- [ ] bits per weight and quality
- [ ] GPTQ and AWQ at a conceptual level
- [ ] draft-and-verify
- [ ] bandwidth vs compute bottleneck

**Interview (level 4).** Why does INT4 weight quantization speed up decoding more than prefill?

## Level 4: RAG and retrieval

Ground answers in retrieved text.

### Retrieval-augmented generation

Route: `/latent/mastery/rag`

**In ten seconds.** RAG looks up relevant passages at question time and pastes them into the prompt, so the model answers from provided text instead of memory alone.

**Where.** Application layer, before the LLM call.

**Mechanism.**
- Indexing: parse documents, split into chunks, embed each chunk with an embedding model (a separate encoder network) into a vector, store vectors with text and metadata in a vector index.
- Query: embed the question, find nearest chunks by cosine similarity (approximate nearest neighbour search), optionally combine with keyword search (hybrid, e.g. BM25), rerank with a cross-encoder, filter by metadata and permissions.
- Context construction: insert the top chunks into the prompt with source labels; the LLM generates an answer and ideally cites them.
- Evaluation: retrieval quality (recall@k, precision), groundedness / faithfulness (is the answer supported), answer relevance, and citation correctness.

```
cos(q, d) = q·d / (‖q‖ ‖d‖)
context = top-k chunks by score, after filters
```

| Input | Operation | Output |
|---|---|---|
| `question` | embedding model | `q ∈ ℝ^d` |
| `q, index of chunk vectors` | top-k similarity + filters | `k chunks` |
| `system + chunks + question` | LLM | `answer with citations` |

**Qwen connection.**
- (verified) Qwen3-8B-Base is a generative model; RAG would use a separate embedding model for retrieval and then put text into Qwen's context window (32,768 positions).
- (verified) Retrieved text is just more tokens in the context: the transformer has no separate channel for "documents".

**Why it exists.** Keeps answers current and private-data-aware without retraining, and allows citations.

**Without it.** Bad chunking or retrieval gives confident answers from the wrong passage; too many chunks dilute attention and cost tokens.

**Training vs inference.** Inference-time technique. The embedding model and LLM are trained separately; RAG changes no weights.

**Security lens.** Retrieved content is untrusted input entering the model's context: indirect prompt injection, poisoned documents, cross-tenant leakage if authorization is applied after retrieval, and embedding inversion if vectors leak.

**Common confusion.** "RAG vs fine-tuning": RAG supplies facts in the context at query time; fine-tuning changes weights (better for style or skills, worse for frequently changing facts).

**Teach back.** Explain a RAG pipeline end to end and where it becomes a security surface.
- [ ] chunking and embedding model
- [ ] vector search with cosine similarity
- [ ] hybrid search and reranking
- [ ] context construction with sources
- [ ] evaluation of retrieval and groundedness
- [ ] retrieved text is untrusted input

**Interview (level 6).** How would you secure a RAG system containing private documents?

## Level 5: Agents and tools

Loops, tools, memory and MCP.

### Agents and tool calling

Route: `/latent/mastery/agents`

**In ten seconds.** An agent is a loop: the model reads the goal and context, emits a structured tool call, the program runs the tool, and the result is appended for the next decision.

**Where.** Application layer: the program around the model.

**Mechanism.**
- Tool definitions (name, description, JSON schema) are placed in the context. The model is trained to emit a tool call in a structured format when useful.
- The application (not the model) parses the call, checks it, executes the tool with its own credentials, and appends the result to the context.
- Loop until the model produces a final answer or a limit is hit. State: the growing transcript (short-term), plus optional long-term memory stored outside and retrieved later.
- Planning is generated text (plans, sub-goals); multi-agent systems are several such loops exchanging messages. Permissions, approvals and limits are enforced by the application.

| Input | Operation | Output |
|---|---|---|
| `goal + tools + history` | LLM | `tool call JSON or final answer` |
| `tool call` | application validates + executes | `tool result appended to history` |

**Qwen connection.**
- (verified) Tool calling is a post-trained behaviour and a prompt format; the base model studied here has no special tool-calling training.
- (verified) Every tool result re-enters the context as tokens, through the same attention as everything else.

**Why it exists.** Lets a model act and gather information instead of only writing text.

**Without it.** Without step limits, loops run forever; without validation, a malformed or malicious call reaches a real system.

**Training vs inference.** Tool-calling ability comes from post-training; the agent loop runs at inference.

**Security lens.** A probabilistic text generator now controls deterministic capabilities. Any text that can steer the model (injection via documents, tool results, memory) can steer tools; impact is bounded by permissions, validation and approvals, not by the prompt.

**Common confusion.** "Tool vs agent": a tool is one function the application exposes; the agent is the loop that lets the model decide which tools to call and when.

**Teach back.** Explain an agent loop precisely and where control and authority live.
- [ ] tool schemas in context
- [ ] model emits a call, application executes
- [ ] results appended as untrusted data
- [ ] loop with limits
- [ ] short-term vs long-term memory
- [ ] permissions enforced outside the model

**Interview (level 6).** What controls would you put between an LLM and a destructive tool?

### Agent memory, state and multi-agent systems

Route: `/latent/mastery/memory-multiagent`

**In ten seconds.** Agent memory is text saved outside the model and pasted back into future prompts; nothing is remembered inside the weights.

**Where.** Application storage plus the prompt builder.

**Mechanism.**
- Short-term: the current conversation and tool results in the context window (bounded; old turns are dropped or summarized).
- Long-term: facts or summaries written to a store (database, vector index); later retrieved by key or similarity and inserted into the prompt.
- Multi-agent: separate loops (planner, worker, reviewer) exchange messages; each message is text in another agent's context. Inter-agent protocols (such as A2A) standardize this exchange.
- Failure handling: retries, timeouts, validation of intermediate results, and stopping conditions.

| Input | Operation | Output |
|---|---|---|
| `conversation` | memory writer (model or rule) | `stored entries` |
| `new session + query` | memory retrieval | `entries inserted into prompt` |

**Qwen connection.**
- (generic) Model weights never store a user's memories at inference; persistence is entirely application-level.

**Why it exists.** Lets assistants keep preferences and context across sessions within a bounded context window.

**Without it.** Unbounded memory grows stale and contradictory; memory without provenance cannot be audited.

**Training vs inference.** Inference and application only.

**Security lens.** Memory poisoning: an untrusted input that gets written to memory influences every future session. Inter-agent messages are another injection channel; one compromised agent can cascade.

**Common confusion.** "Agent memory vs KV cache": the KV cache is per-request numeric state inside the server; agent memory is stored text that is re-read in future requests.

**Teach back.** Explain short-term vs long-term agent memory and why memory is a security surface.
- [ ] context window as short-term
- [ ] external store as long-term
- [ ] retrieval back into the prompt
- [ ] multi-agent messages as context
- [ ] poisoning persists across sessions

**Interview (level 5).** What is the difference between data poisoning and memory (context) poisoning?

### MCP: the Model Context Protocol

Route: `/latent/mastery/mcp`

**In ten seconds.** MCP is a standard way for an AI application to discover and call external tools and data sources, so one integration works across many apps.

**Where.** Between the host application and external servers.

**Mechanism.**
- Roles: the host (the AI application) runs clients; each client keeps a connection to one server. Messages are JSON-RPC 2.0.
- Servers offer features: resources (context and data), prompts (templated messages and workflows), and tools (functions the model can ask to execute).
- Clients may offer features to servers; the current specification lists elicitation (a server asks the user for more information). Capabilities are negotiated per session.
- The specification states that MCP itself cannot enforce its security principles at the protocol level: consent, authorization and access control are the implementers' responsibility. Tool descriptions and annotations are untrusted unless the server is trusted.

| Input | Operation | Output |
|---|---|---|
| `host` | client ↔ server (JSON-RPC) | `tool list, resources, prompts` |
| `model's tool request` | host checks consent, client calls server | `result back into context` |

**Qwen connection.**
- (verified) MCP specification 2026-07-28 (checked 17 October 2026): hosts, clients, servers; server features resources, prompts, tools; client feature elicitation; security principles: user consent and control, data privacy, tool safety.

**Why it exists.** Standardizes integrations so tools and data sources are reusable across AI applications.

**Without it.** Without a standard, every app reimplements every integration; with a standard but no controls, every connected server widens the attack surface.

**Training vs inference.** Inference and application layer only.

**Security lens.** Each server is third-party code and content: malicious or compromised servers (supply chain), poisoned tool descriptions, injection through returned resources, over-broad credentials, and confused-deputy problems. Hosts must obtain consent before invoking tools.

**Common confusion.** "MCP client vs MCP server": the client lives inside the host application and initiates requests; the server exposes tools, resources and prompts.

**Teach back.** Explain MCP's roles, features and security model.
- [ ] host, client, server
- [ ] JSON-RPC
- [ ] resources, prompts, tools
- [ ] elicitation
- [ ] no protocol-level enforcement
- [ ] tool descriptions untrusted, consent required

**Interview (level 5).** What can go wrong when an agent connects to a third-party MCP server?

## Level 6: Interpretability and latent states

Read and test what is inside.

### Hidden states and linear probes

Route: `/latent/mastery/probes`

**In ten seconds.** A probe is a simple classifier trained on a layer's hidden states to test whether some property can be read out from them.

**Where.** On saved residual-stream vectors at chosen layers.

**Mechanism.**
- Run texts through the model; save hidden states at each layer (pooled over tokens or at a chosen position).
- Train a linear classifier (logistic regression) per layer on a training split; measure accuracy or AUC on a held-out split; compare across layers.
- Controls: shuffled-label baselines, simple-feature baselines (length, punctuation), and checks for leakage between splits.
- Interpretation: high probe accuracy shows that information is linearly decodable at that layer. It does not show the model uses it (that needs causal interventions such as activation patching or steering).

| Input | Operation | Output |
|---|---|---|
| `texts` | model forward, save layer l | `H_l [N, 4096]` |
| `H_l, labels` | logistic regression | `accuracy per layer` |

**Qwen connection.**
- (verified) LatentLens extracts pooled hidden states from all 36 layers of Qwen3-8B-Base and trains layerwise probes; the human-vs-AI result is pending because the EditLens data is gated.

**Why it exists.** A cheap, quantitative way to locate where information appears in a network.

**Without it.** Without controls, probes find shortcuts (length, topic) or leak test data; nonlinear probes can learn the task themselves.

**Training vs inference.** Uses a frozen model at inference; only the probe is trained.

**Security lens.** Activation probes are used as monitors (for example detecting harmful requests or deception signals); they can be evaded and are evidence, not guarantees.

**Common confusion.** "A successful probe proves the model computes the feature." It shows decodability; causation needs interventions.

**Teach back.** Explain what a layerwise probe measures and what it cannot prove.
- [ ] save hidden states per layer
- [ ] train simple classifier on train split
- [ ] held-out evaluation
- [ ] controls and baselines
- [ ] decodability vs use
- [ ] causal methods for use

**Interview (level 4).** What does a successful linear probe tell you, and what does it not tell you?

### Logit lens, attribution and causal methods

Route: `/latent/mastery/logit-lens`

**In ten seconds.** Read intermediate layers through the output head to see what the model is "leaning toward", then use interventions to test what actually matters.

**Where.** Between any layer and the LM head.

**Mechanism.**
- Logit lens: apply the final RMSNorm and LM head to an intermediate residual state h_l to get pseudo-logits; track the rank of the true token by depth.
- Limitations: intermediate layers were not trained to be read that way; tuned lenses learn a per-layer translator.
- Causal methods: activation patching (swap a component's activation from another input and measure the effect), ablation, steering vectors, and attribution of logits to components via the residual sum.
- Representation geometry: PCA of hidden states, distance between conditions, and how normalization changes these geometries.

| Input | Operation | Output |
|---|---|---|
| `h_l [4096]` | final RMSNorm, W_U | `pseudo-logits [151936]` |
| `clean vs corrupted run` | patch one activation | `change in output metric` |

**Qwen connection.**
- (verified) LatentLens's Recall Microscope tracks the rank of the true Gettysburg token through Qwen3-8B's layers using diagnostic projections through the final head.

**Why it exists.** Locates when predictions form and which components are responsible, which is the basis of mechanistic interpretability.

**Without it.** Over-reading the lens leads to false stories about early layers; skipping causal tests confuses correlation with mechanism.

**Training vs inference.** Analysis on a frozen model.

**Security lens.** Interpretability supports auditing (backdoor detection research, refusal directions), but the same tools can find directions to remove safety behaviour in open models.

**Common confusion.** "Hidden state vs latent representation": the hidden state is the concrete vector at a layer; a latent representation is a claim about what information or structure that vector encodes.

**Teach back.** Explain the logit lens and why causal interventions are needed.
- [ ] apply final norm and head to layer l
- [ ] rank of the true token by depth
- [ ] diagnostic, not the output
- [ ] tuned lens
- [ ] patching, ablation, steering

**Interview (level 5).** How would you test whether a direction found by a probe is used by the model?

## Follow one request end to end

1. **UI** (mixed). The user types the request in a web app. Risk: Direct prompt injection by the user. Control: Treat as untrusted for anything beyond the user's own permissions.
2. **API + authentication** (control). The request reaches the backend with a session token. Risk: Confused deputy: the agent acts with broader rights than the user. Control: Propagate the user's identity and scopes to every tool.
3. **System / developer / user messages** (mixed). The app assembles roles: system policy, developer instructions, the user's request. Risk: Assuming the system prompt is secret or authoritative. Control: No secrets in prompts; enforce rules in code.
4. **Retrieval** (control). The app embeds the query and searches the user's documents. Risk: Cross-tenant retrieval if filters are missing or applied after reading. Control: Authorize inside the retrieval query.
5. **Retrieved document** (untrusted). The latest project document is inserted into the prompt. Risk: Indirect prompt injection. Control: Mark as data, spotlight it, and never let it authorize tools.
6. **Tokenizer** (mixed). The whole prompt becomes token ids.
7. **Transformer** (mixed). Prefill runs the 36 blocks over all tokens and fills the KV cache. Risk: Instruction/data confusion inside one context.
8. **Decoding** (untrusted). The model writes the summary token by token, then a tool call. Risk: Model output is untrusted, even when the user is honest. Control: Parse structurally; validate every field.
9. **Tool decision** (control). The app parses the call: send_email(to=?, body=summary). Risk: Tool misuse, data exfiltration. Control: Recipient allowlist; data-flow check: recipients may not come from untrusted content.
10. **Authorization + confirmation** (control). The app checks policy and asks the user to confirm. Risk: Approval fatigue (users click yes). Control: Show the diff that matters (recipient); risk-based approvals.
11. **Email tool** (control). The email service sends with a scoped credential. Control: Scoped, short-lived credentials; audit log.
12. **Tool output** (untrusted). The tool returns "sent" with a message id. Risk: Injection through tool results.
13. **Final answer** (untrusted). The model tells the user what was sent. Risk: Improper output handling; unbounded loops. Control: Escape output; step and budget limits.

## Final mastery test

**A. Draw an LLM from memory.** List every stage from text to the next token, with Qwen3-8B's shapes.
- [ ] tokenizer and ids
- [ ] embedding [T, 4096]
- [ ] 36 pre-norm blocks with attention and MLP
- [ ] final norm and LM head to 151,936
- [ ] softmax and decoding

**B. Trace one token.** Trace the token " notebook" through one block: every operation and shape.
- [ ] RMSNorm with gain
- [ ] Q/K/V shapes and GQA
- [ ] q_norm/k_norm then RoPE
- [ ] masked softmax and weighted V
- [ ] o_proj and residual add
- [ ] SwiGLU and second residual add

**C. Explain training.** From corpus to one weight update to an assistant model.
- [ ] data filtering and dedup
- [ ] shifted targets and cross-entropy
- [ ] backprop and AdamW
- [ ] parallelism and checkpoints
- [ ] SFT then preference optimization

**D. Explain inference.** From an API request to the last token of the response.
- [ ] tokenize
- [ ] prefill and KV cache
- [ ] decode loop and sampling
- [ ] batching and paged KV
- [ ] TTFT vs inter-token latency

**E. Design a RAG system.** For a company's private documents with several teams.
- [ ] chunking and embedding model
- [ ] hybrid search and reranking
- [ ] permission filters inside retrieval
- [ ] context construction with citations
- [ ] evaluation of retrieval and groundedness

**F. Design an agent.** An assistant that reads a calendar and sends emails.
- [ ] tool schemas
- [ ] loop with limits
- [ ] validation of calls
- [ ] approval for sending
- [ ] memory policy

**G. Threat-model that agent.** Assets, trust boundaries, entry points, attack paths.
- [ ] assets
- [ ] trusted vs untrusted components
- [ ] entry points incl. incoming email and invites
- [ ] attack paths to send_email
- [ ] impact

**H. Find five attack surfaces.** Name five, each with the LLM property that makes it possible.
- [ ] direct injection
- [ ] indirect injection via email or documents
- [ ] memory poisoning
- [ ] tool or MCP supply chain
- [ ] output handling or resource exhaustion

**I. Design defenses.** Defense in depth with likelihood, impact, detection and verification controls.
- [ ] least privilege and scoped credentials
- [ ] approvals for irreversible actions
- [ ] validation and sandboxing
- [ ] logging and monitoring
- [ ] security evals and regression tests

**J. Explain Professor Regan's research direction.** What LatentLens measures inside Qwen3-8B-Base and why.
- [ ] hidden states by layer
- [ ] RMSNorm and pre/post-norm states
- [ ] layerwise probes and their limits
- [ ] Recall Microscope and the manuscript finding
- [ ] human-vs-AI question and what is pending
