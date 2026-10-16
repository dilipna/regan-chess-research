# LatentLens learning redesign

Branch `latentlens-redesign` (from `latentlens-v2`). Not deployed and not merged; Version 1 (`main`, tag `v1-baseline`) is
unchanged.

## Central question and learning loop

Everything is organised around one question: **How does this piece of text become the next token?** One example sentence,
*The researcher opened the notebook*, tokenized by the real Qwen3 tokenizer, is followed from start to finish. A tracker
at the top keeps the selected token, its position and its current (toy) representation visible in every scene.

Each scene follows **See → predict → change something → observe → explain**:

| Element | Where it appears |
|---|---|
| a short question | under the scene title |
| one meaningful manipulation | "Try this" card next to the main visual |
| a visible consequence | "What changed" card, recomputed live |
| a concise explanation | a few sentences, written separately for each level |
| optional deeper inspection | tensor cards (Research level) and disclosure panels |
| a prediction check | "Predict first" with feedback for wrong answers and retries |

Design references reviewed: Transformer Explainer (stage-by-stage flow, temperature control), Distill's
*Communicating with Interactive Articles* (prediction before reveal, details on demand, multiple linked representations,
learner-controlled pacing). No code, branding or illustrations were reused.

## Three levels, one experience

| Level | Content |
|---|---|
| Story | plain language first, technical term second ("turn scores into shares of the total" → softmax); every analogy has a "where this analogy stops working" note |
| Mechanics | vectors, shapes, formulas, the numbers of the toy calculation |
| Research | the verified Qwen3-8B-Base architecture, recorded measurements with where they were captured, their shape and which dimensions are shown |

The scene, level, selected token, chosen block and sub-step live in the URL (`/latent/journey?s=4&level=research&tok=3`).
Changing the scene adds a browser history entry; changing level, token, block or sub-step replaces it. "Reset this
scene's choices" restores the defaults without changing scene or level.

## Scenes

1. Text becomes tokens: recorded tokenizer splits; selecting a piece shows its id and position.
2. Tokens become vectors: an id selects a row of the (toy) embedding table; Research shows the real row's first 8 of 4,096 numbers.
3. A block updates the representation: seven ordered steps with before / update / after vectors; switch a branch off to see the residual path alone.
4. Attention mixes information: choose a query; arcs show shares; future positions are locked; scores → scaling → mask → softmax → weighted sum; Research shows one real head.
5. The MLP transforms each token: gate, up, SiLU, product, down; push one gate to see it switch off.
6. Blocks repeat: choose any of the 36 blocks; recorded sizes and gains; diagnostic projection for the last token.
7. Scores become the next token: recorded logits and exact shares; greedy vs seeded sampling; append a token and see the recorded next step.
8. Learning versus using: one toy training update with a prediction first; inference keeps weights fixed; pretraining vs SFT vs preference optimisation; the bridge to the research question.

## Labs

RMSNorm vs LayerNorm (scale, offset, ε, learned gains; recorded Qwen gains), attention microscope (editable toy; recorded
view-only mode), position and RoPE (2D pair; real frequency set), temperature and sampling (continuous toy temperature with
T = 0 handled as greedy; recorded Qwen at its recorded temperatures only), KV cache (prefill and decode, cached vs new vs
recomputed, illustrative operation counts, size estimate with dtype / batch / length and overhead excluded), one training
step (prediction, loss, gradient, update).

## Data honesty rules (enforced by tests)

- Every visual carries one of: **Toy calculation**, **Recorded Qwen measurement**, **Live model computation** (not used:
  nothing runs a model here), **Experiment pending**.
- Controls on recorded data only select among recorded values; new text is never simulated. Typing arbitrary text into
  the tokenizer is not offered because the tokenizer does not run in the page.
- Recorded temperatures use exact full-vocabulary normalizers; other temperatures are refused rather than approximated.
- Intermediate vocabulary projections are labelled diagnostic projections.
- The human-vs-AI results remain pending; no placeholder charts are drawn.
- New recording made for this redesign: `generation_steps.json` (one forward pass over the sentence and its top-3
  continuations, bfloat16, sdpa). It differs slightly from the earlier eager-attention trace (p(".") 0.144 vs 0.162); the
  journey says so instead of mixing the two.

## Observable tasks a novice should be able to complete

These are design targets. **No learner study has been run**, so there is no claim that any group of learners can do them.

1. Say how many tokens the model reads for "unbelievably", and why it is not one.
2. Point to the row of the embedding table a token selects, and say whether two different tokens share a row.
3. Say what leaves a block's first + sign when the attention update is zero.
4. Given a query position, list the positions it may attend to.
5. Say whether the MLP at one position reads another position's vector.
6. Say whether block 3 and block 30 have the same weights.
7. Predict what raising the temperature does to the shares, and whether it makes answers more reliable.
8. Predict whether one training update raises the target's probability, and whether generation changes weights.
9. In the RMSNorm lab, predict the effect of multiplying the input by ten, and of adding a constant.
10. In the KV-cache lab, say what is stored and why the work grows without a cache.

## User testing still required

- Short sessions with a few true novices (no ML background), recording task success on the list above and where they get
  stuck; revise Story text and the order of scenes from what is observed.
- A session with ML-literate users to check that the Mechanics and Research levels are accurate and sufficient.
- Screen-reader pass (VoiceOver and NVDA) over the journey and labs; the automated checks cover labels and keyboard
  operation but not the full listening experience.
- Timing of the "about 10 minutes" estimate, which is a design target, not a measurement.
