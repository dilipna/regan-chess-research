# Methodology

> This is an independent reconstruction based on publicly documented concepts and is not Professor Regan's production analyzer.

Scope: what each component computes and where. The exhaustive description of the validated hybrid pipeline is in the README ("Exact methodology");
the evaluation protocol is in [experiment_protocol.md](experiment_protocol.md); caveats in [limitations.md](limitations.md).
Terminology used throughout: **observed data** (positions, moves played), **model prediction** (Maia / Qwen distributions), **engine evaluation**
(Stockfish), **derived feature** (aggregates, z-scores), **experimental result** (metrics with intervals), **interpretation** (text on the site, always
generated from the numbers by fixed rules or written here).

## Data
Lichess standard rated games, August 2026, rapid/classical, ratings in [1000, 2700), one game per player, 2,230 games (`experiments/01_select_games.py`).
Eligible decisions: ply >= 16, >= 2 legal moves, |Stockfish eval before the move| <= 3.00, >= 2 principal variations. Held-out test split: 321 source games,
605 original player-games, 12,863 eligible original decisions; 9,680 test rows including 9,075 controlled variants.

## Engine (`services/analyzer/stockfish/engine.py`)
Stockfish 19, Threads 1, Hash 64, fixed depth 12, MultiPV 5. Evaluations are centipawns from the side to move, clipped to +-1000 for loss computation.

## A. Regan-inspired statistical baseline (R) - `services/analyzer/models/projection.py`
Position difficulty from a logistic model of P(engine #1 match) on Stockfish position features and rating (trained on training-split clean decisions only);
an Elo-band x difficulty-decile table of match rates; per game, projected vs observed top-1 count with variance inflation kappa (calibrated on validation),
giving z(top-1) and analogues (top-3, EV-match, unscaled loss, hard-position top-1). Every feature is shown in the interface ("Technical details").
It outputs **no probability for individual legal moves**, so move-level metrics are "not defined" for R and it is compared on the engine-first-move and engine-top-3 events.
Relationship to Regan's documented work (what is verified public, what is an approximation, what we add): site, Methodology, "Relationship to Regan's work".

## B. Qwen3-8B-Base (Q) - `services/analyzer/qwen/`
| Item | Value |
|---|---|
| Model | `Qwen/Qwen3-8B-Base` revision `49e3418fbbbca6ecbdf9608b4d22e5a407081db4` (base model, not chat) |
| Prompt | frozen template, hash `7f4373cf34140539dfeb24c4a1aa3f2d50cfe16a91bf3ad0e5387a5dcaed377f` (`regan_aligned`); position-only ablation hash `ba79104a...`. Contains both ratings, side to move, FEN, all legal moves (lexicographic UCI) and Stockfish MultiPV values; the played move is never marked |
| Candidate representation | continuation `" <uci>\n"` appended after `Move:` |
| Scoring | L_i = sum_t log P(token_t given prompt and earlier candidate tokens) over every token of the continuation; no length normalization |
| Normalization | P(m_i) = exp(L_i) / sum_j exp(L_j) over the legal moves (log-sum-exp) |
| Decoding / temperature | none: nothing is generated, so temperature does not apply; no verdict or confidence is requested |
| Tokenization | the model's own tokenizer at the pinned revision; candidates scored through a shared prompt KV cache (verified against full-sequence scoring: 2.5e-5 nats in float32) |
| Numerics | bfloat16 weights, float32 log-softmax |
| Status | **not yet run on the 8B model** (needs a >= 24 GB GPU). Qwen3-0.6B-Base is used only for tests and pipeline checks and is never reported as a result |

**Demo-scope local run (MoveLens page only).** `experiments/23_qwen_local_demo.py` scored 7 fixed demo positions with the same checkpoint, frozen
prompt and `QwenScorer.score_position`, on a 4 GB laptop GPU machine with accelerate CPU/disk offload (bf16, candidate batch 4). A re-score of
the first position's candidates with independent full-sequence passes differed by at most 0.083 nats (bf16 rounding). These scores are labelled
"Precomputed Qwen3-8B result"; they are not an evaluation and support no accuracy or AUC claim.

The same 7 positions were also scored with the frozen position-only prompt (no engine lines; hash `ba79104a…`); the comparison is shown
on the site as a qualitative engine-echo check (`experiments/24_export_regan_checks.py`).

Qwen's output is a move-preference signal whose predictive value can be evaluated; it is not a cheating detector.

## C. Maia-3 (M) - `services/analyzer/maia/model.py`
A Chessformer-based human move model (not a language model), rating-conditioned. Primary comparator: Maia-3 79M (`UofTCSSLab/Maia3-79M` @ `a107d6ce...`); the 5M
checkpoint (`UofTCSSLab/Maia3-5M` @ `b6559de2...`) feeds the hybrid systems C/D and is reported as a secondary row. Policy logits are softmaxed over legal moves;
surprisal = -ln P(move) (floor 1e-6).

## Controlled substitutions
See [experiment_protocol.md](experiment_protocol.md).

## Hybrid classifier
Nested feature sets A (statistical) < B (+ Stockfish aggregates) < C (+ Maia-3 features) < D (+ sequence features) with logistic/ridge (A) and XGBoost (B-D),
fixed hyper-parameters, early stopping on validation. System E (D + Qwen features) is implemented in `experiments/17_hybrid_qwen.py` and produces output only
when real Qwen scores exist. The planned question - does Qwen add information after the statistical and Maia signals are known? - is a paired D to E comparison;
the Baseline / +Qwen / +Maia / +Maia+Qwen ablation grid needs the same scores.

## Metrics
ROC-AUC (primary), PR-AUC, recall at a target FPR with thresholds fixed on validation original games and the **realized** test FPR always shown; for
move distributions top-1/top-3 accuracy, NLL, multi-class Brier, rank. Uncertainty: source-game cluster bootstrap (2,000 resamples); paired differences use the same
resamples for both systems, with no refitting. Plan hash `58637622...` was frozen before test evaluation (`experiments/three_model_plan.py`).

## Artifacts and provenance
Every displayed number maps to a file listed on the site (Methodology, Research artifacts) or in `apps/web/src/components/three/summary.tsx`. Mapping of generic names to files:
`qwen_vs_maia.json` = `three_model_move_prediction.json` + `three_model_assistance_results.json`; `ablation.json` = `metrics.json` (A/B/C/D) and
`hybrid_E_results.json` (pending); `bootstrap_ci.json` = `paired_bootstrap.json` + `three_model_bootstrap.json`. The repository has no commit, so artifacts record
timestamps, generator scripts and SHA-256 hashes instead of a commit hash (`three_model_provenance.json`).
