# LLM mastery checklist

Forty questions that test understanding, not vocabulary. Answer each out loud or on paper before opening
[LLM_MASTERY_ANSWERS.md](LLM_MASTERY_ANSWERS.md). Numbers refer to Qwen3-8B-Base (36 blocks, d = 4096, 32 query heads,
8 KV heads, head dimension 128, MLP width 12288, vocabulary 151,936).

## A. Tokens and embeddings
1. Why can the same English word map to two different token ids in one sentence?
2. The embedding table has 151,936 rows but the tokenizer has 151,669 entries. What happens to the extra rows during inference?
3. Why is an embedding lookup mathematically the same as multiplying a one-hot vector by a matrix, and why is it not implemented that way?
4. Qwen's tokenizer adds no beginning-of-sequence token. Why might it still matter what the first token of a document is?

## B. Residual stream and normalization
5. If RMSNorm rescales vectors, what information can it alter and what does it preserve?
6. Give a vector for which RMSNorm and LayerNorm (both with unit gain and zero bias) produce the same output, and one for which they differ.
7. In a pre-norm block, why can the residual stream grow by orders of magnitude without destabilizing the sub-layers?
8. The learned RMSNorm gain of block 1 averages about 0.011. What does that do to the scale of attention's input?
9. Why is Q/K RMSNorm a different operation from block RMSNorm even though both use the same formula?
10. If you deleted one block's attention and MLP (set their outputs to zero), would the model still run? What would change?

## C. Attention
11. Why does GQA reduce KV-cache size, and by exactly what factor in Qwen3-8B?
12. Does GQA reduce the number of distinct attention patterns? Explain.
13. Why are scores divided by sqrt(head_dim) before softmax?
14. Why is V neither normalized nor rotated?
15. Prove (or argue) that with RoPE the dot product of a rotated query and key depends only on their relative position.
16. Why does right-padding a batch not change the computation for real tokens under a causal mask, while left-padding would need position adjustments?
17. If I double the sequence length, which parts of attention become more expensive, and by how much?
18. What is the attention output of the very first position, and why?

## D. MLP
19. Why doesn't the MLP require attention masking?
20. Why can an MLP still change the meaning of a token representation if it does not communicate across token positions?
21. What does the multiplicative gate in SwiGLU allow that a plain ReLU MLP of the same width does not?
22. Roughly what fraction of Qwen3-8B's parameters are in MLPs, and what does that suggest about where per-token computation happens?

## E. Output and decoding
23. Why is "logit = 32" meaningless on its own?
24. What changes in the output distribution if the final RMSNorm gain is multiplied by 2?
25. Explain how temperature, top-k and top-p differ in what they change.
26. Why can top-p with p = 0.9 keep 2 tokens in one step and 2,000 in another?

## F. Training and inference
27. What changes between training and inference? List at least five differences.
28. In teacher forcing, what does position t see, and what is its target?
29. Why does one forward pass over a sequence give T training examples?
30. Why is cross-entropy, and not accuracy, the training objective?
31. What exactly does the KV cache store, per layer and per token, and why are queries not stored?
32. Does the model store its training documents? How can it still reproduce the Gettysburg Address almost verbatim?

## G. Measurement and interpretation
33. Why are intermediate logit-lens predictions not equivalent to actual final model predictions?
34. If a linear classifier succeeds at layer 20, what can we conclude, and what can we NOT conclude?
35. Why must the best layer be chosen on validation data rather than on test data?
36. What does a shuffled-label probe test, and what result would worry you?
37. If a length-only baseline matches the best hidden-state probe, how should the probe result be reinterpreted?
38. Why can PCA show no visible clusters while a linear probe reaches high accuracy?
39. Two models reach the same final recall rate (86.3%). Give three internal measurements that could still differ, and one reason the recall rates themselves might not be directly comparable.
40. Why can GPT, Claude or Gemini texts be used in a human-vs-AI dataset, but their internals cannot be studied with LatentLens?
