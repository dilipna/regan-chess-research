# How to ace the MoveLens demo: what to learn, in order

Site: https://chessassistlens.vercel.app. Script with timings: `docs/DEMO_SCRIPT.md`. Every number below comes from the files on the site
(`movelens_demo.json`, `regan_checks.json`, `three_model_*.json`, `paired_bootstrap.json`). Study in this order; each step builds on the last.

---

## Step 1 (15 min): the story in four sentences. Memorize it.

1. "I took the same chess positions and looked at each move three ways: a statistical model in the style of your public work, a general-purpose
   language model (Qwen3-8B), and a model built to predict human moves (Maia-3)."
2. "They measure different things: how unusual the move is relative to engine evidence, what a language model prefers, and what a human of that
   rating would play."
3. "The research question is whether the language model carries information that the statistics and the human-move model do not."
4. "So far: the statistical model and Maia are fully evaluated on held-out games; Qwen is built and tested and scored on seven demo positions,
   but its held-out evaluation still needs a cloud GPU."

**Say the last sentence early.** Your earlier email described the Qwen comparison as done. Correct it yourself in the first minute.

## Step 2 (45 min): Regan's framework, at the level he will expect you to know

Read the three public sources cited in the README (2026 talk pp. 10–12, IR user guide, CSE 702 Week 6A notes). Know these terms:

| Term | Meaning | In MoveLens? |
|---|---|---|
| Multi-PV analysis | engine values for several candidate moves per position | yes: Stockfish 19, depth 12, top 5 lines |
| T1-match (MM) | share of moves equal to the engine's first choice | yes: "engine-first-move match" |
| EV-match | share of moves with the same value as the first choice (ties count) | analogue computed, display only |
| ASD | average scaled difference (scaled centipawn loss) | **no**: only unscaled loss is used |
| Projected vs actual | the model predicts how many matches a player of this rating should have; compare with what happened | yes: section 5 |
| z-score | (actual − projected) / standard deviation, with a correction for dependence between moves | yes, with κ |
| Skill parameters (s, c; h in the 2026 talk) | fitted per rating; generate a probability for **every** legal move | **no**: the reconstruction has no per-move probabilities |
| IPR | Intrinsic Performance Rating: the rating whose projection best fits the moves played | **no** |

Key honest line: "My reconstruction projects match rates from a difficulty model; yours models every legal move with fitted skill parameters.
That is why mine can be compared only on the engine-match events, not move by move."

## Step 3 (30 min): your statistical model, exactly (`services/analyzer/models/projection.py`)

1. **Difficulty model:** logistic regression for P(player plays Stockfish's first move), fitted on clean training decisions. Features: rating
   (and its square), log gap between the best two moves (and its square, and × rating), log number of legal moves, |evaluation|, log
   evaluation swing, number of near-optimal moves (within 25 cp), game phase. Difficulty = 1 − predicted probability.
2. **Projection table:** rating band (1000–1399, 1400–1799, 1800–2199, 2200+) × difficulty decile → training mean of top-1, top-3, loss.
3. **z over a game:** projected = Σp, variance = Σp(1−p), z = (actual − projected) / √(κ·variance). **κ = 1.289** (top-1), estimated on
   validation clean games, so that clean z has unit variance. κ > 1 because moves in one game are not independent.
4. **Not KNN.** "Similar positions" means the same rating band and difficulty decile.

Example 1 numbers (24… h6, rated 1956): difficulty 0.82, projected P(engine #1) 17.0%, P(top 3) 42.4%; h6 is outside Stockfish's top 5 →
the model expected "no engine match" with 83% → "statistically normal".

## Step 4 (20 min): Maia-3

- Paper: Monroe et al., "Chessformer: A Unified Architecture for Chess Modeling", ICLR 2026; code CSSLab/maia3.
- Checkpoint: Maia-3 79M (`UofTCSSLab/Maia3-79M`). The hybrid experiment used the smaller 5M checkpoint; 79M is better on every move metric
  (top-1 56.9% vs 55.5%).
- Input: board, up to 7 previous positions, **both** ratings. Output: a probability for every legal move.
- It is a transformer trained on human games, **not a language model**. Its training data (Lichess, Jan 2023 – Jul 2025 per the model card)
  ends a year before the test games (Aug 2026).
- Held-out accuracy by rating: 53.4% (1000–1399), 56.3%, 58.1%, 58.8% (2200+).

## Step 5 (30 min): Qwen, the part most likely to be probed

- Model: `Qwen/Qwen3-8B-Base` (base, not chat), one pinned revision.
- **How it is scored:** a fixed text prompt (FEN, both ratings, side to move, Stockfish's top-5 evaluations, all legal moves). For each legal
  move, the text " <move>\n" is appended and Qwen's log-probability of those tokens is summed; a softmax over legal moves turns these into a
  ranking. Nothing is generated, no temperature, no "is this cheating?" question.
- **What was run:** only the 7 MoveLens positions, on your laptop (CPU and disk offload, about 3 minutes per position). Consistency check:
  cached vs full scoring differ by at most 0.083 nats (bf16 rounding).
- **Engine-echo check (important):** with the engine lines in the prompt, Qwen's top move was Stockfish's first choice in 3 of 7 positions;
  without them, 0 of 7. The human move's median rank went from 4 to 13. Interpretation: on these positions, the engine numbers drive much of
  Qwen's ranking. Seven positions are not a test.
- **What is not done:** the held-out run (12,863 positions; locally that would take weeks at ~3 min per position; on a cloud GPU an estimated few hours and ~$5–10 for test + validation, not yet measured), and the
  paired test of whether adding Qwen features to statistical + Maia features improves held-out ROC-AUC.

## Step 6 (30 min): the experiment and the numbers to quote

Protocol: 2,230 Lichess rapid/classical games (Aug 2026), one game per player, split 60/20/20 by connected components of players. Test split:
321 source games, 605 player-games, 12,863 decisions. Controlled substitutions: replace a share (5–70%) of a player's moves with
engine-chosen moves (random, selective = hardest positions, subtle = near-best within 30 cp), evaluated in the original positions (games not
replayed). Uncertainty: 2,000 bootstrap resamples **of source games** (moves within a game are dependent), paired, no refitting.

| Result | Value |
|---|---|
| Engine-first-move prediction (log-loss, lower better) | reconstruction 0.588, Maia-3 79M 0.422; paired diff −0.165 [−0.178, −0.152] |
| Maia-3 79M exact-move accuracy | 56.9% [56.0, 57.9] |
| ROC-AUC, original vs substituted games | reconstruction z(top-1) 0.785 [0.776, 0.793]; Maia surprisal 0.689 [0.675, 0.704] |
| Hybrid, adding Maia features (earlier experiment) | +0.047 ROC-AUC [+0.040, +0.054] (Stockfish-aggregate → + Maia features) |
| Calibration (held-out) | projected 38.8% vs actual 39.3% engine matches; every bin within 1.7 points |
| Clean-game z | mean +0.02, SD 1.04; 20 of 605 above z = 2 (≈ 14 expected under a normal) |
| Screening power at z > 2 | 20% engine substitutes → 39.7% of games; 20% subtle → 6.6%; untouched → 3.3% |
| Whole game (section 5) | expected 13.4, actual 14, z +0.20; 20% replaced → z +2.60; 40% → z +5.00; 20% subtle → z +0.55 |

## Step 7 (20 min): rehearse the click path twice

`docs/DEMO_SCRIPT.md`. Practise switching examples in the Compare step (Example 2 and 3) and the 20% / 40% / subtle buttons in step 5.
If the internet fails: on your laptop, `cd apps/web && npm run build && npm start`, then open http://localhost:3000 (everything is static).

---

## Questions to expect, with answers

**"Is this my method?"** No. It reconstructs the projected-vs-actual idea from your public material, without your skill parameters, per-move
probabilities, scaled differences or IPR. It was not compared with your analyzer.

**"Why only engine-match counts?"** Because the reconstruction has no per-move model. That is also why random and selective substitution give
identical z here: each replacement adds exactly one match. A model with a probability for every move could, in principle, weigh which moves were replaced.

**"Your clean games exceed z = 2 too often."** 20 of 605 versus about 14 expected; the tail is a little heavier than normal. The source games are
presumed human, not verified, and κ was fitted on validation games. Thresholds would need margin.

**"Example 2's original game has z = +2.49. Is that player cheating?"** No claim is made. It is one of the 20 presumed-clean games above 2, which
is the false-alarm rate in action, and why one game is not evidence.

**"Why does the Qwen prompt contain engine evaluations? Isn't that leakage?"** The evaluations are known before the move and the statistical
model uses the same evidence. The played move is never marked; moves outside the top 5 are shown as "n/a" for every move alike. The concern is
not leakage but echo, and the position-only check shows Qwen leans on those numbers.

**"How do you know Qwen understands chess at all?"** We don't claim it does. Without engine lines its top move was never Stockfish's first choice
in the 7 positions. The held-out ablation will measure how much signal remains.

**"Why log-likelihood instead of asking Qwen for a move?"** Generated answers are single samples and can be illegal; likelihoods give a full,
reproducible distribution over exactly the legal moves.

**"Tokenization?"** Moves are UCI strings; multi-token moves are summed without length normalization. Different notation or ordering could change
the ranking; only one frozen prompt was used.

**"Why Maia-3 and not Stockfish as the third model?"** Stockfish answers "what is best"; the question here is "what would this human play".
Stockfish stays as the objective reference.

**"Why depth 12?"** Compute. All analysis and substitution use the same engine and depth, which favours engine-match statistics; sensitivity to
depth is untested.

**"Why Lichess online games?"** Public, large, rated. Not over-the-board; time pressure and behaviour differ.

**"What would convince you Qwen adds information?"** A positive paired difference, with a confidence interval excluding zero, when Qwen features are
added to statistical + Maia features on the held-out games (the B → D test).

**"What next?"** (1) Run Qwen on the held-out split on a cloud GPU; (2) the position-only ablation at scale; (3) the B → D test; (4) depth
sensitivity; (5) if you are willing, run your analyzer on the same games so the reconstruction can be replaced by the real baseline.

## Never say
"KNN"; "my implementation of your detector"; "Qwen detects cheating"; "Qwen beats your method"; "Maia detects cheating"; any Qwen accuracy or AUC;
"live inference"; that any specific player cheated.
