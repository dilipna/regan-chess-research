# LatentLens: professor demo guide

For the meeting with Professor Kenneth W. Regan. Open `/latent/demo`
(locally: `cd apps/web && npm run build && npx next start`, then http://localhost:3000/latent/demo).

**Controls.** ← / → (or PageUp / PageDown, or the Back and Next buttons) move between the five steps. **N** shows presenter
notes, **D** opens the optional deeper sections, **↺ Reset** returns to step 1. Nothing advances automatically, so you can
stop at any point for questions; "Motion: off" removes transitions. Every panel carries a label: *Toy calculation*,
*Recorded Qwen measurement* or *Experiment pending*.

## Five-minute route

| Time | Step | Say | Do |
|---|---|---|---|
| 0:00 | 1 Follow one token | "Last time I analyzed Qwen mainly from its outputs. After our discussion, I wanted to understand what is happening inside the model. Here is one sentence, followed token by token." | Click "␣notebook" (pos 5): id 37166, real tokenizer output. Point at the starting vector: a toy 8-number stand-in for 4,096 numbers. |
| 0:50 | 2 One complete block | "Here is one complete Qwen transformer block, step by step." | Press "Next step" six times: RMSNorm copy, attention update, add, RMSNorm copy, MLP update, add. "The blue line, the residual stream, is only ever added to." |
| 1:50 | 3 RMSNorm vs LayerNorm | "This is the normalization operation we discussed." | Scale × 10: RMSNorm output unchanged. Offset +2: RMSNorm changes, LayerNorm does not. Point at the gains: learned weights, separate from the input-dependent denominator. |
| 3:00 | 4 Recall evidence | "This connects to the recall experiments. Instead of only checking the final next token, we can trace the true token's rank through the model." | 76.9% vs 34.6% (bfloat16, teacher forcing). Rank-by-depth chart: "diagnostic projections, not the model's output at those layers." |
| 4:00 | 5 Human vs AI | "Next, I want to measure whether these representations carry information that separates human from AI writing, and where. The plan is ready; the data access is pending." | Point at "Experiment pending" and the commands. Close with the final sentence on screen. |

## Optional deeper sections (10-minute version)

- Step 2, **D**: the exact verified Qwen3 block order (input_layernorm → q/k/v → q_norm/k_norm → RoPE → causal GQA →
  o_proj → add → post_attention_layernorm → SwiGLU → add).
- Step 3, **D**: the recorded Qwen RMSNorm gains by block appear in the RMSNorm lab (`/latent/labs/rmsnorm`).
- Step 5, **D**: the full research plan (question, hypothesis, data access, representation, leakage controls, probes and
  baselines, metrics, limitations).
- Outside the demo: `/latent/journey?s=4&level=research` (real attention probabilities for one head),
  `/latent/journey?s=6&level=research` (any of the 36 blocks, recorded values), `/latent/recall` (click any token of the
  Gettysburg Address for its rank trajectory), `/latent/labs/kv-cache` (cache size by dtype, batch and length).

## Likely questions and short answers

**What is RMSNorm?** Divide a vector by its root-mean-square, sqrt(mean(x²) + ε), then multiply by a learned gain. No
mean subtraction, no bias. Qwen3 uses ε = 1e-6 and computes it in float32.

**Why use RMSNorm?** It stabilizes the scale of each sub-layer's input like LayerNorm does, is cheaper, and in practice
works as well for large language models.

**LayerNorm vs RMSNorm?** LayerNorm centers (subtracts the mean) and divides by the standard deviation, then gain and
bias. RMSNorm only divides by the RMS, then gain. Shifting every entry by a constant changes the RMSNorm output but not
the LayerNorm output.

**What is the residual stream?** The 4,096-number vector per position that runs through all 36 blocks. Each attention and
MLP sub-layer reads a normalized copy and adds an update to it.

**What are Q, K and V?** Three learned linear projections of the normalized input. Informally: what a position looks for,
what it advertises, and what it passes on. Scores come from Q·K; outputs are weighted sums of V.

**Why GQA?** 32 query heads share 8 key/value heads, so the KV cache is 4 times smaller (144 KiB instead of 576 KiB per
token in bf16) while keeping 32 attention patterns.

**Why RoPE?** Rotating Q and K by position-dependent angles makes attention scores depend on relative position, without
adding anything to the token vectors.

**Why causal masking?** The model predicts token t+1 from tokens up to t; without the mask a position could read its own
target during training.

**What does the MLP do?** A per-position SwiGLU transformation (4,096 → 12,288 → 4,096). It does not mix positions; it
holds 78% of each block's parameters.

**What is a hidden state?** Any intermediate vector in the forward pass; here mostly the residual stream after each block,
plus the values entering and leaving RMSNorm, attention and the MLP.

**What is a latent representation?** What such a vector encodes, studied through its geometry: what a probe can read
from it, how it changes with depth.

**What is a linear probe?** A logistic regression trained on frozen hidden states. It tests whether information is
linearly accessible, not whether the model uses it.

**Why logistic regression?** Simple, well understood, hard to overfit with regularization, and its success means the
information is linearly readable. A deep classifier could learn the task itself from almost any representation.

**Why not fine-tune Qwen?** Fine-tuning changes the representations we want to study. The question is what the
pretrained model already contains.

**What is AUROC?** The probability that a randomly chosen AI text gets a higher score than a randomly chosen human
text. 0.5 is chance; it does not depend on a threshold.

**What does PCA show?** The two directions of largest variance, fitted on training documents and shown on validation
documents. Exploratory only; held-out classifier metrics are the evidence.

**What does a logit lens show?** What the model's own final norm and LM head would read from an intermediate residual:
when the true continuation becomes linearly readable in that direction.

**What can a logit lens NOT prove?** That the model "predicts" or "decides" anything at that layer. The head was trained
for the last layer only; only the last depth equals the actual output (we test this).

**How is this different from Pangram / EditLens?** Pangram builds detectors and EditLens measures how much AI editing a
text has. LatentLens uses their data to study where inside a frozen open model the human-vs-AI distinction becomes
linearly accessible, and which computations change it. It is not a detector.

**What does human-vs-AI separability actually mean?** That a linear classifier on a given representation can tell the
two labelled groups apart on held-out documents of this dataset, above controls such as length and shuffled labels.

**Can this prove text was written by AI?** No. Probe scores describe statistical properties of a text in one dataset;
they are not proof of authorship.

**Can you inspect GPT, Claude or Gemini internals?** No. Their APIs return text only. Their outputs can be data in a
human-vs-AI dataset, but residual streams, normalization states and attention are not accessible.

**What experiment comes next?** Run the layerwise probe on EditLens once access is granted, then run the recall
microscope on his 14B and ~27B models with the same text to compare depth trajectories, with a bf16 vs fp32 check.

**How does this connect to the professor's Qwen recall work?** His measurement is the final top-1 recall rate.
LatentLens adds the depth dimension: at which block the true token becomes top-ranked, how stable that is, and whether
two models with equal final recall (about 86.3%) get there the same way.

## What not to say

- "Layer k detects AI" / "Qwen knows this text is AI". Say: a linear classifier can access label-correlated information.
- "RMSNorm causes the signal". Say: separability changed across these representations.
- "This is Qwen's prediction at layer 20". Say: the diagnostic projection at depth 20.
- "We have human-vs-AI results". We do not yet; it is pending.
- Any claim about Professor Regan's exact models: LatentLens has run only Qwen3-8B-Base.
