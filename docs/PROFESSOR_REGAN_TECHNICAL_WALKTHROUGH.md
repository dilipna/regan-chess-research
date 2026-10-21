# Professor Regan technical walkthrough

For the meeting on 2026-10-20. Route: `/latent/professor` (nine sections, arrow keys to move). The spoken script
is in `REGAN_5_MINUTE_DEMO.md`; the meeting checklist is in `REGAN_MEETING_2026-10-20.md`. Every number on screen
is labelled recorded, professor-reported, hypothesis, or pending.

## 60-second version

See `REGAN_5_MINUTE_DEMO.md` (60-second version). In short: after our last meeting I studied Qwen's internals; I can
now name the exact capture points for a latent state (the residual stream after each block, before or after
RMSNorm); I instrumented one real Qwen3-8B trace; your 14B vs ~27B result suggests a layerwise comparison; I want to
reproduce your scripts first.

## 5-minute version (follows the sections)

1. **From outputs to internals.** Text, tokenizer, token ids, embeddings, 36 blocks, final RMSNorm, LM head,
   logits, next token.
2. **One Qwen transformer block.** Pre-norm: RMSNorm, Q/K/V, q_norm and k_norm per head, RoPE on Q and K, causal
   grouped-query attention, o_proj, residual addition, RMSNorm, SwiGLU MLP, second residual addition.
3. **The latent state.** The residual stream after each block, [B, T, 4096], 37 capture points (embedding plus 36
   blocks). The recorded RMS table shows the same token's vector changing across depth.
4. **RMSNorm.** Formula; no mean subtraction; block RMSNorm (4,096-dimensional residual) vs Q/K RMSNorm (each
   128-dimensional head). Which representation is captured must be stated.
5. **One real Qwen internal trace.** "The researcher opened the notebook": output ranks per position, the last
   position through depth, the logit-lens caveat, full provenance.
6. **Professor Regan's 14B → ~27B observation.** His numbers, labelled as professor-reported. Same final recall; are
   the internal trajectories the same?
7. **Three hypotheses.** Tokenization effect, task saturation, same score by a different internal path (H3 is the one
   LatentLens can test directly). Tokenization is a first-class question.
8. **Proposed first experiment.** True-next-token rank vs depth in both models, by relative depth. The same
   measurement already runs on Qwen3-8B-Base in the Recall Microscope. The will-vs-shall case is a planned analysis.
9. **What I need from this meeting.** Checkpoints, tokenizer, input file, script, recall definition, output format,
   location, latent state of interest, copy permission, privacy, next deliverable. Human-vs-AI only as a future
   extension.

## 10-minute version

Add to the 5-minute version:

- **Latent states, precisely.** For B texts of length T, the hidden states at a layer have shape [B, T, 4096]; there
  are 37 such points. Because blocks add to a running sum, a linear probe can read information at any depth, but a
  successful probe shows decodability, not use; causal tests (patching, ablation) are the follow-up.
- **Recall method.** Teacher forcing: feed the true text, record the true token's rank at each layer through the
  final norm and LM head. These are diagnostic projections, not the model's outputs at those depths. Recorded top-1
  recall and the manuscript-variant analysis are on `/latent/recall`.
- **Human vs AI design (future extension, not for this meeting).** Frozen Qwen; the same logistic-regression probe at every layer; held-out evaluation,
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
