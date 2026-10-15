# LatentLens: professor demo guide

For the meeting with Professor Kenneth W. Regan. Open `/latent/demo` (locally: `cd apps/web && npm run build && npx next start`,
then http://localhost:3000/latent/demo; or the deployed site's `/latent/demo`). Keyboard: right and left arrows move between
steps. "Presenter notes" shows the cues below on screen.

## Exact order and clicks (5 minutes)

| Time | Step on screen | Say (verbatim) | Click / point at |
|---|---|---|---|
| 0:00 | 1 From outputs to internals | "Last time I analyzed Qwen mainly from its outputs. After our discussion, I wanted to understand what is happening inside the model." | The pipeline strip, then the numbers: 36 blocks, 4,096-wide residual stream, 32 query heads and 8 KV heads. "Every number is verified against the checkpoint and the transformers code, not taken from memory." |
| 0:45 | 2 One complete block | "Here is one complete Qwen transformer block." | Let the walk-through run (RMSNorm, Q/K/V, Q/K normalization, RoPE, attention, residual, RMSNorm, MLP, residual). Point at the rail: "the residual stream is only ever added to." Pause on Q/K RMSNorm: "128 numbers per head, before RoPE." |
| 2:00 | 3 Normalization | "This is the normalization operation we discussed." | Walk the toy vector [2, −1, 4, 1]: squares, mean 5.5, RMS 2.345, divide, gain. Click **Scale x by 10** (no change), then **Add 5 to every entry** (changes, unlike LayerNorm). |
| 3:00 | 4 Freezing Qwen and probing | "Now I freeze Qwen and inspect what information is available at each layer." | If the panel says *Experiment pending*: "The pipeline is built and tested; the run waits for access to Pangram's EditLens data. I am not showing a curve because none has been measured." |
| 3:45 | 5 Recall | "This connects directly to the recall experiments. Rather than only measuring whether the final next token is correct, we can trace how the true token's rank changes through the model." | Gettysburg 76.9% vs unpublished control paragraph 34.6% (bf16). The rank-by-depth chart: the true token reaches median rank 1 around depth 34 on Gettysburg. |
| 4:40 | 6 Closing | "The goal is not merely to classify AI text. I want to understand where the distinction becomes encoded inside the transformer and which computations strengthen it." | Then ask about his recall scripts on turing/cerf. |

## 10-minute expanded version

Add these between the steps above:

1. After step 1, open **Overview** and show the "Order of operations, checked in the installed source (13/13)" panel;
   expand one item to show the evidence lines.
2. After step 2, open **Learn → Follow one token** and click **Residual stream**: the measured chart shows the residual
   growing from RMS 0.027 to about 33, with a massive activation at position 0 (one coordinate near 1,800).
3. After step 3, **Learn → RMSNorm lab**: "the stream grows by orders of magnitude; the normalized copy follows the
   learned gain". Then the table that separates block RMSNorm from Q/K RMSNorm.
4. After step 5, **Recall** page: click a token in the Gettysburg text and show its rank trajectory and the top
   projected token at each depth. Mention the precision check: changing bf16 to fp32 flips 1 of 316 top-1 decisions on
   Gettysburg and 5 of 162 on the control paragraph, so two recall rates near 86.3% should be compared with that noise
   in mind.
5. End on **Recall → Comparing model sizes**: the 14B vs ~27B comparison is prepared, not run.

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
