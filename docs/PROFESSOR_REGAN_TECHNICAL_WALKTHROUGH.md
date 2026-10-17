# Professor Regan technical walkthrough

For the meeting. Route: `/latent/professor` (seven sections, arrow keys to move). Interactive alternative:
`/latent/demo`. Every number on screen is labelled recorded, toy, or pending.

## 60-second version

"After our discussion, I realized I had been treating Qwen mostly from the outside. I therefore rebuilt the next
phase around understanding the computation inside the model. I can now record the hidden states of Qwen3-8B-Base at
every one of its 36 layers on my laptop, and I have checked that I reproduce its internal operations, including
RMSNorm, exactly at bfloat16 precision. With that instrumentation, the recall experiments become a question of where
inside the network the correct token begins to win, and the human-versus-AI question becomes a layerwise
representation question. The human-versus-AI data needs approved access, which is pending, so that part is a plan,
not a result."

## 5-minute version (follows the sections)

1. **Why Version 2 exists.** "Version 1 measured Qwen through its outputs. After our discussion, I wanted to move
   inside the model and understand how those outputs are constructed."
2. **Qwen3-8B-Base end to end.** "Text becomes token ids, each id selects an embedding of 4,096 numbers, and that
   vector travels through 36 blocks. This is the residual stream. A final RMSNorm and the LM head turn it into a
   score for each of 151,936 vocabulary entries."
3. **One transformer block.** "This is where RMSNorm operates: on the copy each sub-layer reads. These are the Q, K
   and V projections: 32 query heads sharing 8 key-value heads. Qwen applies a second RMSNorm to each Q and K head,
   then positional information through RoPE, which rotates Q and K. Attention mixes information across positions.
   The MLP transforms each token's features. These updates are added back into the residual stream." Point at the
   Glass Box line: every operation that needs no weights is reproduced from recorded tensors.
4. **RMSNorm.** Show the formula. "It divides by the root mean square and multiplies by a learned gain; no mean
   subtraction. On real block-18 inputs, RMSNorm reproduces Qwen's output and LayerNorm fits measurably worse,
   because the mean is only a few percent of the RMS." Then the open questions: pre- versus post-normalization
   representations, and whether activation magnitude, which the norm removes from the reader's view, carries signal.
5. **Latent states.** "Once this is instrumented, I can stop asking only what the final model predicted and start
   asking where inside the network a signal becomes accessible."
6. **Recall Microscope.** Show the rank of the true Gettysburg token by depth, and the finding that several 'misses'
   are another Lincoln manuscript's wording.
7. **Human vs AI, layer by layer.** "The human-vs-AI question becomes a layerwise representation question rather than
   only a black-box classifier." Say clearly that this result is pending data access.

## 10-minute version

Add to the 5-minute version:

- **Latent states, precisely.** For B texts of length T, the hidden states at a layer have shape [B, T, 4096]; there
  are 37 such points. Because blocks add to a running sum, a linear probe can read information at any depth, but a
  successful probe shows decodability, not use; causal tests (patching, ablation) are the follow-up.
- **Recall method.** Teacher forcing: feed the true text, record the true token's rank at each layer through the
  final norm and LM head. These are diagnostic projections, not the model's outputs at those depths. Recorded top-1
  recall and the manuscript-variant analysis are on `/latent/recall`.
- **Human vs AI design.** Frozen Qwen; the same logistic-regression probe at every layer; held-out evaluation,
  shuffled-label and surface-feature baselines, leakage checks. Never "this layer detects AI"; the claim is where the
  information becomes linearly accessible.
- **Next experiments.** Pre- vs post-RMSNorm probes; attention vs MLP contributions; generalization across AI
  generators and domains; comparison with a dedicated detector.

## Likely questions and short answers

- **"How do you know your extracted states are right?"** The layer-streaming runner was checked against a full
  offloaded run, and the Glass Box re-derives each weight-free operation from recorded inputs and matches the
  recorded outputs at bfloat16 precision in blocks 1, 18 and 36.
- **"Why a base model?"** It has not been post-trained, so its representations reflect pretraining, and it is the
  model Version 1 already studied.
- **"Is the logit lens reliable at early layers?"** It is diagnostic; early layers were not trained to be read that
  way. I use it to see when the true token becomes favoured, not as the model's output.
- **"What would a positive human-vs-AI result mean?"** That information distinguishing the two is linearly
  accessible at some depth on this data. It would not show the model uses it, or that it generalizes to other
  generators, without the controls and follow-ups above.
- **"What is not done yet?"** The human-vs-AI probe results (data access pending) and the pre/post-normalization
  probe. No result is shown for either until it is run.

## What not to say

- That a layer "detects" AI writing.
- That a probe proves a mechanism.
- Any number that is not on screen with its provenance label.
