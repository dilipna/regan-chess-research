# MoveLens

**Three ways to understand a chess move.** Statistics, language models, and human chess behavior on the same positions.
(Repository and package names still say ChessAssistLens; only the public-facing name changed.)

> MoveLens is an independent research prototype. Its statistical model is reconstructed from publicly documented concepts and is not
> Kenneth W. Regan's production cheating-detection system. Scores are not proof that any player cheated.

**Live:** https://chessassistlens.vercel.app is one page with four sections: **Statistical model**, **Qwen3-8B**, **Maia-3 79M** and **Compare**,
plus a *Start the 7-minute demo* mode that steps through them. Three curated real positions are selectable. Everything else (methods, full
results, provenance, the earlier detailed views) is behind **Methods**, **Full results** and **Earlier views**. Demo script: `docs/DEMO_SCRIPT.md`. Preparation guide and expected questions: `docs/STUDY_GUIDE.md`.

Below the four sections: **5 Whole game** (projected vs actual engine matches over one held-out game, z by substitution level) and
**6 Can these numbers be trusted?** (held-out calibration, clean-game z distribution, screening power, Maia by rating band, and a Qwen
engine-echo check with and without the Stockfish lines in the prompt). Data: `experiments/22_*` and `experiments/24_*`.

**What the statistical model is:** a logistic-regression difficulty model plus an Elo-band x difficulty-decile projection table with
kappa-scaled z-scores (`services/analyzer/models/projection.py`). It is **not** a k-nearest-neighbor model.

## 1. Research question

When the same chess position is evaluated by (a) a Regan-inspired statistical reconstruction, (b) a general-purpose language model
(Qwen3-8B-Base) and (c) a chess-specific human move model (Maia-3), what does each capture — and does combining them add predictive value?

## 2. Three different things

| | Statistical baseline (R) | Qwen3-8B-Base (Q) | Maia-3 (M) |
|---|---|---|---|
| Question | what looks unusual statistically? | what does a general LLM prefer? | what would a human of this rating play? |
| Input | rating, Stockfish MultiPV, position difficulty | frozen text prompt with FEN, ratings, legal moves, engine lines | board + recent positions + both ratings |
| Output | projected P(engine #1 / top-3 match), z-score; **no per-move probability** | summed token log-likelihood per legal move → softmax over legal moves | probability of every legal move |
| Nature | transparent statistics (public reconstruction, not Regan's analyzer) | general-purpose language model | Chessformer-based human-move transformer — **not an LLM** |

## 3. Experimental protocol (summary; details in [docs/experiment_protocol.md](docs/experiment_protocol.md))

Lichess rapid/classical games (Aug 2026), Stockfish 19 depth 12 MultiPV 5. Source games are split 60/20/20 by connected components of
players (no game or player crosses splits). Original (presumed-human) test decisions are negatives; controlled decision-level substitutions
(Stockfish lines inserted into selected human decisions, evaluated in the original positions) are positives. Task 1 predicts genuine human
moves; Task 2 measures how each score responds to substitutions; the hybrid experiment fits nested feature sets A ⊂ B ⊂ C ⊂ D.
Uncertainty: paired source-game cluster bootstrap, 2,000 resamples, held-out predictions, no refitting.

## 4. Verified findings (recomputed from stored artifacts — see `docs/THREE_MODEL_RESULTS.md`)

* **Task 1, 12,863 original test decisions.** Maia-3 79M top-1 accuracy 56.9% [56.0, 57.9]. On the engine-first-move event the reconstruction's
  log-loss is 0.588 vs Maia-3's 0.422 (paired difference −0.165 [−0.178, −0.152]).
* **Task 2, 9,680 test rows.** ROC-AUC: reconstruction z(top-1) 0.785 [0.776, 0.793]; Maia-3 79M mean surprisal 0.689 [0.675, 0.704]
  (paired difference −0.096 [−0.112, −0.078]). Substitutes are engine first lines by construction, which favours engine-match statistics.
* **Hybrid A→B→C→D** (`paired_bootstrap.json`, reproduced from `test_predictions.parquet`): ΔAUC A→B +0.0066 [+0.0026, +0.0105];
  **B→C (Maia features) +0.0468 [+0.0395, +0.0536]**; C→D +0.0067 [+0.0025, +0.0110].
* **Qwen3-8B-Base: no held-out result exists yet.** (Only the 7 MoveLens demo positions were scored locally, see `docs/methodology.md`; that is not an evaluation.) The scorer (`services/analyzer/qwen/`), frozen prompt, evaluation, hybrid system E and website
  slots are implemented and tested, but the 8B scoring run needs a ≥24 GB GPU (Modal GPUs require a payment method; see
  `docs/CONTINUE_SESSION.md`). Everything Qwen-related shows *pending*; nothing is estimated. Whether Qwen adds value beyond the statistical
  and Maia signals is therefore **unanswered**.

## 5. Reproduce

```bash
py -3.13 -m venv .venv && .venv/Scripts/pip install -r services/analyzer/requirements.txt pytest zstandard matplotlib
python experiments/01_select_games.py ... 10_provenance.py          # validated hybrid pipeline (see Reproduce below)
python experiments/11_export_positions.py && python experiments/12_maia79.py   # three-model positions + Maia-3 79M
modal run deploy/modal_app.py::score --split test|val|train        # Qwen3-8B-Base scoring (GPU; pending)
python experiments/15_qwen_artifacts.py && python experiments/14_three_model_eval.py && python experiments/16_export_three_model_demo.py
python experiments/17_hybrid_qwen.py && python experiments/18_three_model_provenance.py && python experiments/19_three_model_results_md.py
python experiments/20_export_curated_examples.py                   # curated examples (Qwen slots fill automatically)
python experiments/21_export_results_csv.py                        # CSV summary
python experiments/22_export_movelens_demo.py                      # MoveLens home-page positions (Qwen fields filled only if 23 has run)
.venv-qwen/Scripts/python experiments/23_qwen_local_demo.py        # local Qwen3-8B-Base on the 7 demo positions (CPU/disk offload, ~3 min/position)
QWEN_CONDITION=position_only .venv-qwen/Scripts/python experiments/23_qwen_local_demo.py   # same, without engine lines
python experiments/22_export_movelens_demo.py && python experiments/24_export_regan_checks.py   # re-export; whole game, checks, raw Qwen scores
pytest tests                                                       # 40 tests (+ .venv-qwen for tests/test_qwen.py)
```

## 6. Run locally

```bash
cd apps/web && npm install && npm test && npx tsc --noEmit -p . && npx eslint . && npm run build && npm start
```

Python environments are kept separate: `.venv` (pinned research env, never install `transformers` there), `.venv-qwen` (torch + transformers, Qwen tests),
`.venv-modal` (Modal client).

## 7. Architecture

`experiments/*.py` (offline, deterministic) → `data/artifacts/*.json` → copied to `apps/web/public/data/` → static Next.js pages that only read those files.
Provider boundaries: statistical (`services/analyzer/models/projection.py`), engine (`stockfish/`), Qwen (`qwen/`), Maia (`maia/`), evaluation
(`experiments/14`, `09`). An optional live GPU service (`deploy/modal_app.py`, `NEXT_PUBLIC_LIVE_API_URL`) can re-score a position; the page health-checks it
with a timeout and otherwise serves the precomputed outputs, so a dead endpoint cannot break any page. Every result file carries its generator script,
timestamp and (for evaluation) the frozen analysis-plan hash; the repository has no git commit yet, so no commit hash can be recorded.

## 8. Limitations

See [docs/limitations.md](docs/limitations.md): the baseline is not Regan's system; controlled substitutions are not real cheating; Maia models human preference, not
cheating; Qwen is a general LLM and its likelihoods depend on tokenization/prompt; results depend on dataset and engine settings; classification performance is
not proof of misconduct.

Docs: [methodology](docs/methodology.md) · [experiment protocol](docs/experiment_protocol.md) · [limitations](docs/limitations.md) · [demo script](docs/DEMO_SCRIPT.md) ·
[results](docs/THREE_MODEL_RESULTS.md) · [status](docs/STATUS.md).

---

# Hybrid extension (validated A/B/C/D experiment — unchanged)

## Research question

*Can rating-conditioned human move probabilities, engine-optimality signals, and sequential behavior
add useful information beyond traditional aggregate chess statistics?*

The work is inspired by Kenneth W. Regan's publicly documented IR (Intrinsic Ratings) framework: Multi-PV
engine utilities across depths (AIF input), scaled values, Elo-trained parameters (s, c, h in his
8 April 2026 talk, pp. 10–12), a probability for every legal move, actual-versus-projected z-scores with
dependence correction, T1-match, EV-match, ASD and IPR (talk p. 12), position difficulty accounted for by
the model (IR user guide p. 10), optional EWN weighting of complex positions (guide pp. 1, 11 — unit
weighting is used over 99% of the time), and projection-hit rows Proj1…Proj7+ (CSE 702 Week 6A, p. 5).
Full references are in [Sources](#sources). ChessAssistLens does **not** reproduce that system; its
statistical component is an explicitly labeled **Regan-inspired baseline** (an empirical approximation —
see Methodology › "Relationship to Regan's work"). It was developed independently from public material,
uses no private Regan data or calibration, and was not compared against his analyzer.

Each eligible decision is seen through three complementary views (they share inputs, so they are not
independent):

| View | Question | Implementation |
|---|---|---|
| Stockfish | What is objectively strong? | Stockfish 19, MultiPV 5, fixed depth 12, Threads = 1 |
| Maia-3 | How probable is this move for a player of this rating (model-estimated human plausibility)? | official `CSSLab/maia3` 5M model — a Chessformer-based transformer for rating-conditioned human move prediction (not a language model); predicted probability over all legal moves |
| Regan-inspired statistics | What behavior do we expect from this level? | empirical projection model + standardized deviations |

**Defensible contribution:** added predictive signal from learned human-move features on our documented
controlled benchmark. No claim is made to outperform Regan's analyzer.

The signals are fused with interpretable ML (XGBoost + SHAP). No LLM produces or modifies any score;
the explanation text is a deterministic template filled with already-computed values
(`services/analyzer/explain/narrative.py`).

Results: **[docs/RESULTS.md](docs/RESULTS.md)** (generated from `data/artifacts/metrics.json`).
Status: [docs/STATUS.md](docs/STATUS.md). Deployment: [docs/DEPLOY.md](docs/DEPLOY.md).

---

## Exact methodology

### 1. Data
* Source: Lichess open database, standard rated games, August 2026 (first ≈420 MB of the monthly
  dump; `experiments/01_select_games.py`). Recent data, i.e. after the data used to train Maia-3.
* Filters: estimated duration `base + 40·inc ≥ 480 s` (rapid/classical); termination `Normal` or
  `Time forfeit` (excludes `Rules infraction` and `Abandoned`); both ratings in [1000, 2700);
  ≥ 50 plies; **at most one game per player** across the whole sample.
* Stratified by mean rating into bands 1000–1399, 1400–1799, 1800–2199, 2200–2699
  (600 games each where available; the 2200+ band yields 430). Total 2,230 games.
* Player names are anonymized in all exported demo data.

### 2. Stockfish analysis (`services/analyzer/stockfish/engine.py`)
* Stockfish 19, `Threads=1`, `Hash=64`, fixed depth 12, MultiPV 5, `ucinewgame` per game →
  bit-reproducible; live analysis reproduces offline scores exactly (verified).
* Scores are centipawns from the side to move; mates map to ±10000 and all evaluations are clipped to
  ±1000 cp before losses are computed. Move loss used in statistics is additionally capped at 300 cp.
* **Decided-position prefilter:** each position is first searched at depth 8 (single PV); if
  |eval| > 5.00 only that line is stored (such positions are ineligible anyway).
* If the played move is not among the 5 lines, its value is −(best value of the resulting position),
  capped to be no better than the 5th line, and its rank is censored as "6+".

### 3. Maia-3 (`services/analyzer/maia/model.py`)
* Official inference package `CSSLab/maia3` (pinned commit `1e13597`), model **Maia3 5M**
  (`UofTCSSLab/Maia3-5M`). Input construction reproduces the official UCI engine in
  `--use-uci-history` mode: current position + up to 7 previous positions, conditioned on the
  side-to-move Elo and the opponent Elo.
* We read the policy logits directly and softmax over all legal moves, so the **played-move
  likelihood P(move)**, **human surprisal −ln P(move)**, Maia rank, entropy and the variance of
  surprisal are exact model outputs.

### 4. Eligible decisions
A player decision is eligible iff: ply ≥ 16 (first 8 moves per side skipped), ≥ 2 legal moves,
|Stockfish eval before the move| ≤ 3.00, and ≥ 2 principal variations available. Player-games with
fewer than 10 eligible decisions are excluded from the experiments.

### 5. Regan-inspired projection (`services/analyzer/models/projection.py`)
1. **Difficulty model:** logistic regression P(top-1 match | Stockfish position features, Elo), trained
   on clean human decisions of the training split only. *Position difficulty* = 1 − P̂.
   Features: Elo (and square), log best-vs-second gap (and square, and × Elo), log #legal moves,
   |eval|, log eval swing, near-optimal-move count, game phase. No move-choice information.
2. **Projection table:** Elo band × difficulty decile; per cell, the training mean of top-1, top-3 and
   capped move loss and the variance of move loss (cells with < 30 decisions use the pooled decile).
3. **Projected vs observed:** projected T1 = Σ pᵢ, Var = Σ pᵢ(1−pᵢ);
   z = (observed − projected) / √(κ·Var). κ is a variance-inflation factor estimated on
   **validation** clean player-games (decisions within a game are not independent).
   The same construction is used for an EV-match analogue (move value equal to the best line's value
   at depth 12, ties counted; display only, not a model feature), top-3, capped move loss (sign
   flipped: positive = less loss; unscaled, so **not** ASD), top-1 in hard positions (top difficulty
   tercile; **not** EWN), and Maia-3 surprisal (expected = entropy).

### 6. Controlled decision-level substitutions (`services/analyzer/synthetic/assist.py`)
*Alternative moves are evaluated in the original positions. Later positions remain those of the
original game; these are not replayed assisted games.* Ground truth = the intervention label and the
realized substituted fraction. Source games are presumed human (no assistance injected by us); their
actual absence of cheating is not established.
* Unit: one player's eligible decisions in one game (n decisions).
* Levels α ∈ {0, 5, 10, 20, 40, 70}%. **Assistance percentage = fraction of eligible decisions
  altered:** m = max(1, round(α·n)) decisions get a *different*, engine-chosen move (a decision
  where the human already played the engine's choice cannot be altered). If fewer than m decisions
  are alterable, all are altered; the **realized** fraction m/n is the regression target.
* **RANDOM:** alterable = human ≠ Stockfish #1; choose uniformly; substitute Stockfish #1.
* **SELECTIVE:** same, but choose the m decisions of highest position difficulty.
* **SUBTLE:** substitute drawn uniformly from Stockfish top-3 lines within 30 cp of the best line
  (excluding the human move); decisions chosen uniformly.
* Selections are nested across levels and deterministic (seeded by game, colour and strategy).
* **Decision-level substitution:** the substitute replaces the move choice in the original position;
  the remainder of the game is not re-simulated (same per-position independence assumption as
  projection models).

### 7. Leakage-safe split (`services/analyzer/synthetic/splits.py`)
Original games are split 60/20/20 **before any variant exists**. Games sharing a player are joined
into connected components (union–find) and whole components are assigned to a split, so no game and
no player crosses splits; variants inherit their source game's split. The difficulty model is fitted
on train only; κ is calibrated on validation only. Automated tests: `tests/test_leakage.py`
(algorithm + the dataset on disk) and assertions inside the build and training scripts.

### 8. Features and experiments (`services/analyzer/features/aggregate.py`)
Nested groups A ⊂ B ⊂ C ⊂ D:
* **A — statistical baseline:** #decisions, Elo, opponent Elo, top-1 / top-3 rates, mean move loss,
  z(top-1), z(top-3), z(loss), z(top-1 | hard). Model: logistic regression / ridge.
  **A0** = z(top-1) alone, no training.
* **B — + Stockfish aggregates:** top-5 rate, median/std loss, shares of ≥100 / ≥300 cp losses,
  mean rank, near-optimal share, mean |eval|, mean gap. XGBoost.
* **C — + Maia-3:** mean/median surprisal, mean P(move), Maia top-1/top-3 agreement, shares of
  P < 5% / 2%, excess surprisal and its z, *non-human engine rate* (share of engine-best choices where
  Maia's top human move differs), log-likelihood vs Maia's top move. XGBoost.
* **D — + sequence / criticality:** longest top-1 streak (absolute, relative), peak and variability of
  rolling top-1 (window 8), minimum rolling loss, peak rolling surprisal, accuracy on easy / hard
  positions, **critical accuracy lift = acc_hard − acc_easy**, correlation of difficulty with engine
  agreement and with move quality, rate/count of decisions that are simultaneously engine-best,
  hard and low human likelihood (P < 10%), longest run of non-human engine matches. XGBoost.

Tasks: classifier (original vs substituted) and regressor (realized α →
**"synthetic-equivalent assistance intensity"** — never a probability of cheating).
Fixed hyper-parameters; early stopping on validation; balanced class weights.

### 9. Evaluation (`experiments/05_train_eval.py`)
TEST split only: ROC-AUC with 95% cluster-bootstrap CI (resampling source games), PR-AUC and Brier
(balanced weighting), reliability bins, TPR at 1% / 5% target FPR with thresholds fixed on validation
original games (**realized test FPR differs by system** — at the 1% target: A 32.1% recall at 1.0% FPR,
B 37.1% at 1.7%, C 40.9% at 1.0%, D 40.4% at 0.7%; recall alone does not rank them), ROC/PR-AUC per
strategy × level, ROC-AUC per Elo band, regression MAE / RMSE per level and strategy, global SHAP.

**Paired differences** (`experiments/09_paired_bootstrap.py`, post hoc on the saved test predictions,
no refitting or tuning): 2,000 paired cluster-bootstrap resamples of the 321 test source games.
B→C +0.0468 AUC [+0.0395, +0.0536]; C→D +0.0067 [+0.0025, +0.0110]; A→B +0.0066 [+0.0026, +0.0105].
Overlapping individual intervals do not prove no gain; non-overlapping ones are not a paired test.
No multiplicity correction; refit variance is not captured.

**Baseline z on original test games:** mean ≈ 0 and SD ≈ 1 (largely implied by κ), but z(top-1, hard)
exceeds 3 for 0.99% of games vs 0.14% under N(0,1) — tails are not validated.

**Exploratory pseudo-events:** k ∈ {1, 3, 5, 9} test player-games by *different* players of one Elo band
(event score = mean game score). This does **not** validate longitudinal detection for a single player.

### 10. Explanations
Game-level SHAP (TreeExplainer on model D) and a decision-level XGBoost model (trained on train-split
variant decisions; label = decision was altered) with per-move SHAP. The decision-level model is
separate: its SHAP values are not a decomposition of the game-level classifier. Narrative text only
verbalizes these numbers.

### 11. AIF
Experimental AIF-format export (`services/analyzer/aif/export.py`) based only on the public v0.5
description (Regan & Biswas; Gödel's Lost Letter, 2015-01-20). *Experimental AIF-format export.
Compatibility with the current IR Analyzer has not yet been independently validated.* Internal
storage is JSON/Parquet; only final-depth values exist, so shallower grid columns are `n.a.`.

### Limitations
* Synthetic assistance is a model of cheating, not real cheating; real assistance may differ.
* The assisting engine is the analysis engine at the same depth, which makes RANDOM/SELECTIVE
  substitutions match Stockfish #1 by construction (optimistic for engine-match statistics);
  SUBTLE partially addresses this.
* Decision-level substitution does not re-simulate the game.
* Online rapid games, not over-the-board classical; per-game samples are small (most positions after
  move 8 in amateur online games are already decided).
* Original ("clean") Lichess games are presumed human and may contain undetected assistance.
* Depth 12 / MultiPV 5 is a compute-constrained choice (≈0.34 s per position on one core).
* Each player contributes one game; nothing here validates detection across one player's games.
* Maia-3 was trained on Lichess games Jan 2023 – Jul 2025 (model card); our games are Aug 2026.

### Sources
* K. W. Regan, “Chess Research and Public Interests”, UB New Faculty Academy, 8 Apr 2026 —
  https://cse.buffalo.edu/~regan/Talks/ChessResearchApr2026np.pdf (pp. 10–12)
* K. W. Regan, “User Guide for IR Chess Statistical Analyzer” —
  https://cse.buffalo.edu/~regan/ChessSeminar/UserGuideIRlite.pdf (pp. 1, 3–4, 10–14)
* K. W. Regan, CSE 702 Week 6A seminar notes — https://cse.buffalo.edu/~regan/ChessSeminar/CSE702Week6A.pdf (pp. 1–2, 5)
* K. W. Regan & T. Biswas, AIF v0.5 (2015) — https://rjlipton.com/2015/01/20/a-computer-chess-analysis-interchange-format/
* Monroe, Eilender, Chalmers, Tang & Anderson, “Chessformer: A Unified Architecture for Chess Modeling”,
  ICLR 2026 — https://arxiv.org/abs/2605.19091 ; code https://github.com/CSSLab/maia3 ;
  model card https://huggingface.co/UofTCSSLab/Maia3-5M

### Provenance
`experiments/10_provenance.py` writes `data/artifacts/provenance.json` (also served at
`/data/provenance.json`): file SHA-256 hashes and timestamps, split counts (448 test games assigned →
321 source games → 605 player-games → 9,075 injected variants; 9,680 rows incl. originals), Maia
checkpoint revision, engine binary hash, lockfile hash and four recomputed consistency checks. The
repository has no git commit and the pipeline records no run ID; both are reported as unavailable.
`services/analyzer/requirements-lock.txt` is a pip-freeze snapshot of the research environment.

---

## Repository

```
apps/web/                 Next.js 16 frontend (static demos + live analysis client)
services/analyzer/        Python package
  chesscore/ stockfish/ maia/ features/ synthetic/ models/ explain/ aif/ api/
  pipeline.py report.py config.py
experiments/              01 select → 02 Stockfish → 03 Maia → 04 dataset → 05 train/eval
                          → 05b decision model → 06 export web data → 07 results markdown
                          → 08 figures → 09 paired bootstrap → 10 provenance
tests/                    pytest (leakage, synthetic generator, PGN, AIF, features)
data/                     raw / interim / processed / artifacts (git-ignored except artifacts)
docs/                     STATUS, RESULTS, DEPLOY
Dockerfile                backend image (Stockfish 19 + Maia-3 5M + trained models, CPU)
```

## Reproduce

```bash
py -3.13 -m venv .venv && .venv/Scripts/pip install torch --index-url https://download.pytorch.org/whl/cu126
.venv/Scripts/pip install -r services/analyzer/requirements.txt pytest zstandard matplotlib
# Stockfish 19 binary in tools/stockfish/... or set STOCKFISH_PATH
curl -r 0-419430399 -o data/raw/lichess_2026-08_head.pgn.zst https://database.lichess.org/standard/lichess_db_standard_rated_2026-08.pgn.zst
python experiments/01_select_games.py --per-band 600 --max-bytes 4000000000
python experiments/02_stockfish.py --workers 16      # ~2 h on a 14-core laptop
python experiments/03_maia.py                        # ~30 min (GPU)
python experiments/04_build_dataset.py
python experiments/05_train_eval.py
python experiments/05b_decision_model.py
python experiments/06_export_web.py
python experiments/07_results_md.py
python experiments/08_figures.py
python experiments/09_paired_bootstrap.py           # post hoc, saved test predictions only
python experiments/10_provenance.py
pytest tests
```

Run locally:

```bash
uvicorn analyzer.api.main:app --app-dir services --port 8077
cd apps/web && echo NEXT_PUBLIC_API_URL=http://localhost:8077 > .env.local && npm run dev
```

## Version 2: LatentLens

**Website:** `/latent` (Overview, Learn, Research, Recall, Methods, Professor Demo), linked from the main navigation as
"V2 · Model Internals". Version 1 above is unchanged; its routes, data and results are preserved (snapshot tag
`v1-baseline`).

### Motivation and relation to Version 1

Version 1 asked *what does the model output?*: it compared a Regan-inspired statistical baseline, Maia-3 and
Qwen3-8B-Base through their output probabilities on chess decisions. LatentLens asks the next question: *what is
happening inside the model that produces those outputs?* It opens the same Qwen3-8B-Base checkpoint
(`Qwen/Qwen3-8B-Base @ 49e3418f`) and studies its residual stream, normalization, attention and MLP computations.

### What is in it

- **Verified architecture.** `scripts/latentlens/inspect_qwen_architecture.py` instantiates the model on the meta device,
  compares every parameter shape with the safetensors headers, checks 13 order-of-operation facts in the installed
  transformers source, and reads the learned RMSNorm gains. Result: 36 blocks, d = 4096, MLP 12288, 32 query / 8 KV
  heads of 128, RMSNorm eps 1e-6 plus Q/K RMSNorm, RoPE theta 1e6, SwiGLU, no biases, untied LM head, 8,190,735,360
  parameters (`results/latentlens/qwen3-8b/architecture.json`).
- **Learn Mode.** Follow one token from text to next token (real tokenizer, real embedding rows, one real forward pass),
  an interactive transformer block, labs for RMSNorm, Q/K/V, GQA, Q/K RMSNorm, RoPE, causal attention, SwiGLU, logits
  and decoding, the KV cache, training and backpropagation, and teach-back questions. Toy examples are labelled.
- **Recall Microscope.** Teacher-forced next-token recall with the true token's rank traced through all 37 depths by an
  intermediate diagnostic projection. Measured on Qwen3-8B-Base (bf16): Gettysburg Address top-1 recall 76.9%
  (316 tokens), an unpublished control paragraph 34.6% (162 tokens). In fp32: 76.6% and 31.5% (1 and 5 top-1 decisions
  flip).
- **Research Mode: human vs AI.** Where inside Qwen does information that distinguishes human-written from fully
  AI-generated text become linearly accessible? Hidden-state extraction at every depth and at seven sites inside
  selected blocks, layerwise logistic-regression probes with validation-only selection and a one-time test, shuffled
  labels, length, token-count, perplexity and stylometry controls, held-out generator and domain splits, block RMSNorm
  and magnitude studies, attention-vs-MLP comparisons, PCA. **Status: pending.** The EditLens dataset
  (`pangram/editlens_iclr`) is gated and access has not been granted yet; no human-vs-AI number exists, and the site
  shows "Experiment pending".

### How the 8B model runs on a 4 GB laptop GPU

`latentlens/streaming.py` builds each real `Qwen3DecoderLayer` from the checkpoint config, loads only that layer's
weights, runs every sequence through it and frees it. Tests show it reproduces the ordinary forward pass within 1e-4 in
float32 (Qwen3-0.6B-Base). On Qwen3-8B in bf16 it was compared with an independent offloaded transformers run: 18 of 20
top-1 tokens agreed and log-probabilities differed by up to 0.46 nats. That is agreement within bf16 noise on a small check,
not proof of numerical equivalence; the runner is still being validated. Hidden states are read with explicit hooks because in
transformers 5.18 `output_hidden_states[-1]` is post-final-norm while the other entries are pre-norm.

### Scripts (`scripts/latentlens/`)

| Script | Purpose |
|---|---|
| `inspect_qwen_architecture.py` | verified architecture JSON |
| `build_tokenizer_examples.py` | real tokenizations and embedding-row statistics |
| `trace_one_token.py` | one forward pass for Learn Mode |
| `run_recall_analysis.py` | Recall Microscope (any text file; `--no-store-text` for copyrighted inputs) |
| `compare_recall_models.py` | compare recall artifacts of different models by relative depth |
| `extract_hidden_states.py` | pooled hidden states for a dataset split (resumable) |
| `train_layer_probes.py` | layerwise probes, controls, one-time test |
| `probe_rmsnorm.py`, `probe_components.py`, `build_pca_artifacts.py` | normalization, attention-vs-MLP, PCA |
| `verify_streaming.py` | streamed vs offloaded full-model check on the real 8B |
| `record_generation_steps.py` | two recorded generation steps (top candidates and the step after each) for the journey |
| `capture_glassbox.py` | Glass Box: every intermediate tensor of blocks 1, 18 and 36 for one token (float32 copies of bfloat16 values, 0.4 MB per block) plus a Python re-derivation ledger |
| `analyze_recall_versions.py` | "Mistake, or another version?": classifies Gettysburg recall misses against the five Lincoln manuscripts (no model run; reads the recorded recall artifact) |
| `export_web_artifacts.py` | validate, write pending placeholders, copy compact JSON to the website |

Environment: `uv venv .venv-latent` and `pip install -r scripts/latentlens/requirements.txt` (torch 2.14.1 first). The
V1 environments are untouched.

### Reproduce (laptop)

```bash
.venv-latent/Scripts/python scripts/latentlens/inspect_qwen_architecture.py --model Qwen/Qwen3-8B-Base
.venv-latent/Scripts/python scripts/latentlens/build_tokenizer_examples.py
.venv-latent/Scripts/python scripts/latentlens/trace_one_token.py --loader stream
.venv-latent/Scripts/python scripts/latentlens/run_recall_analysis.py --loader stream \
  --input scripts/latentlens/passages/gettysburg_address.txt --name "Gettysburg Address (public domain)" \
  --input scripts/latentlens/passages/control_original.txt --name "Original control paragraph (unpublished)"
.venv-latent/Scripts/python scripts/latentlens/export_web_artifacts.py
.venv-latent/Scripts/python -m pytest tests/latentlens && (cd apps/web && npm test && npm run build)
```

GPU workflow on the CSE machines: [docs/LATENTLENS_CSE_RUNBOOK.md](docs/LATENTLENS_CSE_RUNBOOK.md).

### Documentation

- [docs/QWEN3_FROM_ZERO_TO_INTERNALS.md](docs/QWEN3_FROM_ZERO_TO_INTERNALS.md): 42-topic study guide
- [docs/LLM_MASTERY_CHECKLIST.md](docs/LLM_MASTERY_CHECKLIST.md) and [answers](docs/LLM_MASTERY_ANSWERS.md)
- [docs/LATENTLENS_PROFESSOR_DEMO.md](docs/LATENTLENS_PROFESSOR_DEMO.md): 5- and 10-minute demo scripts, likely questions
- [docs/LATENTLENS_IMPLEMENTATION_PLAN.md](docs/LATENTLENS_IMPLEMENTATION_PLAN.md): audit and design

### Limitations

One model so far. The trace and the two recall passages are illustrations on real data, not samples for general
claims. Diagnostic projections show linear readability, not intermediate decisions. Probe results, when they exist,
will describe linear accessibility of label-correlated information in one dataset; they cannot establish causal
mechanisms or authorship. Black-box API models are never internally probed.

### Future work

Run the human-vs-AI study on EditLens (CSE GPU); compare recall trajectories of the 14B and ~27B Qwen models Professor
Regan used (same text, same script, bf16 and fp32); add adapters for further open-weight families only after the Qwen
pipeline has produced results.

### Learning redesign (branch `latentlens-redesign`)

`/latent/journey` is a guided, roughly 10-minute path built around one question, *How does this piece of text become the
next token?*, with three explanation levels (Story, Mechanics, Research) that keep the same example and step. Six labs
(`/latent/labs`) cover RMSNorm vs LayerNorm, an attention microscope, RoPE, temperature and sampling, the KV cache and one
training step. `/latent/demo` is a keyboard-controlled five-step presentation. Design, provenance rules and the learner
tasks that still need real user testing: [docs/LATENTLENS_REDESIGN.md](docs/LATENTLENS_REDESIGN.md).

**Branches.** `main` = the Version 1 snapshot (tag `v1-baseline`); `latentlens-v2` = Version 1 + the first LatentLens
release (currently deployed); `latentlens-redesign` = this learning redesign, not deployed and not merged. Version 1 stays
the stable reference; no LatentLens branch is meant to be merged into `main` without a separate decision.
