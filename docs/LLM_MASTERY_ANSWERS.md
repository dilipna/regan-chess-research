# LLM mastery checklist: answer key

Answers to [LLM_MASTERY_CHECKLIST.md](LLM_MASTERY_CHECKLIST.md). Each one should be explainable in your own words; if an
answer surprises you, return to the matching topic in [QWEN3_FROM_ZERO_TO_INTERNALS.md](QWEN3_FROM_ZERO_TO_INTERNALS.md).

<details><summary>A. Tokens and embeddings</summary>

1. Byte-level BPE includes the leading space in the token: "the" at the start of a text and " the" after a space are
   different tokens; capitalisation changes tokens too.
2. They are rows of both the embedding table and the LM head. No tokenizer id ever selects them as input, but the LM
   head still produces a logit for each, so they take part in the softmax (normally with negligible probability; not
   measured here).
3. E[id] equals one_hot(id) · E because the one-hot vector selects one row. A real matrix product would multiply 151,936
   numbers (mostly zeros) by every column; indexing just copies 4096 numbers.
4. The first position has nothing to attend to except itself and tends to develop very large activations that many
   heads attend to ("attention sink"). Which token sits there changes that state; LatentLens uses `<|endoftext|>`, the
   document separator seen in pretraining, and excludes it from pooling.
</details>

<details><summary>B. Residual stream and normalization</summary>

5. It removes the vector's overall scale (its RMS); it preserves direction when the gain is uniform, the sign pattern
   and the ratios between coordinates. A learned, non-uniform gain then reweights coordinates (and could flip a sign
   where a gain entry is negative).
6. Same output: any vector with mean 0, e.g. [1, −1, 2, −2] (then RMS equals the standard deviation). Different:
   [2, −1, 4, 1] (mean 1.5).
7. Each sub-layer reads RMSNorm(x), whose scale is fixed by the learned gain, not by ‖x‖. Updates are added to x without
   normalizing x itself.
8. After normalization each position has RMS 1; multiplying by a gain of about 0.011 makes attention's input very
   small (measured RMS about 0.012 for the example's last token), so the projections act on small inputs in block 1.
9. Block RMSNorm normalizes a whole 4096-dimensional position vector before a sub-layer. Q/K RMSNorm normalizes each
   128-dimensional query or key head vector inside attention, before RoPE, with a 128-dimensional gain shared across
   heads. Different input, place and parameters.
10. Yes: the residual connection passes x through unchanged, so the block becomes the identity. Later blocks receive a
    stream missing that block's two updates; outputs change, more or less depending on the block.
</details>

<details><summary>C. Attention</summary>

11. Only K and V are cached. With 8 instead of 32 KV heads each cached token needs 2 × 8 × 128 numbers per layer
    instead of 2 × 32 × 128: a factor of 4 (144 KiB vs 576 KiB per token over 36 layers in bf16).
12. No. Each of the 32 query heads still computes its own scores and softmax; four heads share the same keys and values
    but use different queries.
13. With independent unit-variance entries the dot product of two d-dimensional vectors has variance d; dividing by
    sqrt(d) keeps scores in a range where softmax is not saturated.
14. Values are only averaged with attention weights; their scale is controlled downstream by o_proj and the residual
    structure. Position is meant to influence which tokens are attended to (Q·K), not what is passed on.
15. (R(t)q)ᵀ(R(s)k) = qᵀR(t)ᵀR(s)k = qᵀR(s − t)k, because rotations are orthogonal and compose by adding angles; this
    holds for each 2D pair, hence for the sum.
16. With right padding, every real token's earlier positions are real; pads come later and the causal mask hides them.
    With left padding, real tokens see pads before them and their position indices shift, so masks and position ids
    must be adjusted.
17. Score and weighted-sum computation (and attention-weight memory if materialised) scale with T²: doubling T
    quadruples them. Projections and MLP scale linearly in T (they double). The KV cache doubles.
18. Its own value vector (after o_proj): with only itself visible, the softmax weight is 1.
</details>

<details><summary>D. MLP</summary>

19. It is applied to each position separately; no position reads another, so there is nothing to mask.
20. Attention has already written information from earlier positions into this position's vector. The MLP applies a
    nonlinear function to that combined vector, which can change how it is represented (for example resolving a word
    sense using context that attention brought in).
21. Each intermediate feature is the product of two learned projections, one passed through SiLU. The gate can switch a
    feature on or off depending on the input, and products allow multiplicative interactions a single ReLU layer lacks.
22. 150,994,944 of 192,946,432 parameters per block (78%), about 5.4 billion in total. Most per-token transformation
    capacity is in MLPs; attention mostly decides what to move between positions.
</details>

<details><summary>E. Output and decoding</summary>

23. Softmax depends only on differences between logits. 32 could be very likely or unlikely depending on the others.
24. The normalized vector doubles, so all logits double: equivalent to temperature 0.5. The distribution sharpens; the
    ranking does not change.
25. Temperature rescales all logits (changes the shape of the whole distribution). Top-k keeps a fixed number of
    candidates. Top-p keeps the smallest set whose probabilities sum to p. The last two then renormalize and sample.
26. When the model is confident a couple of tokens reach 0.9; when it is uncertain, probability is spread thinly and
    many tokens are needed.
</details>

<details><summary>F. Training and inference</summary>

27. Training: weights change, gradients and optimizer state exist, teacher forcing, all positions in parallel, loss at
    every position, dropout possible. Inference: frozen weights, no gradients, model's own outputs fed back, one token
    per step, only the last position used, KV cache, decoding rule.
28. Tokens 1 … t of the true text (its own position included); its target is the true token t+1.
29. The causal mask lets every position be predicted from its own prefix without seeing later tokens, so each position
    is a separate prediction problem computed in the same pass.
30. Cross-entropy is differentiable and rewards putting probability on the right token even when it is not the top-1;
    accuracy is piecewise constant and has zero gradient almost everywhere.
31. For each layer and token: one key and one value vector per KV head (8 × 128 each; keys after RoPE). Queries are only
    needed to compute the current token's attention, never again.
32. No database of documents exists; everything is in the weights. Text seen very many times can be reconstructed
    because the weights make each next token highly probable given the previous ones (measured: 76.9% top-1 recall on
    the Gettysburg Address vs 34.6% on an unseen paragraph).
</details>

<details><summary>G. Measurement and interpretation</summary>

33. The final norm and LM head were trained to read the last residual. Earlier residuals live in a stream that later
    blocks still transform, so reading them through the final head is a diagnostic that can mislead (for example it can
    show the current token rather than the next one). Only the last depth equals the actual prediction (tested).
34. We can conclude that information correlated with the label is linearly accessible in that representation, on this
    dataset. We cannot conclude that the model uses it, that layer 20 computes it, that it is causal, that it is not a
    proxy (length, topic, generator style), or that it generalizes to other generators or domains.
35. Choosing on test turns the test set into a selection set and inflates the reported number (selection bias). The
    test must be an untouched estimate of performance.
36. Whether the probe and pipeline can "find" signal where none exists (leakage, overfitting, bugs). Shuffled-label
    ROC-AUC well above 0.5 on held-out data would indicate leakage or a bug.
37. The probe may be reading length (or a correlate) rather than anything specific to authorship. Report length-matched
    results and treat the probe's advantage over the baseline as the interesting quantity.
38. PCA shows directions of largest variance, which may be dominated by topic, length or position effects; the label
    can sit in a low-variance direction that a probe finds but the top two components do not show.
39. Internal: depth at which the true token becomes rank 1 (stabilization), median rank by relative depth, margins and
    entropies, activation RMS by depth, agreement of top projected tokens. Comparability: different tokenizers split the
    text into different numbers of tokens, and numerical precision (bf16 vs fp32) can flip near-tie top-1 decisions
    (measured: up to 5 of 162 positions on the control text).
40. Their outputs (text) are available and can be data. Their weights and activations are not exposed by their APIs, so
    there is no residual stream, normalization state or attention to read.
</details>
