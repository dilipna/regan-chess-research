"""Pre-registered analysis plan for the direct three-model comparison.

Frozen BEFORE any held-out test evaluation of the new comparators (Qwen3-8B-Base, Maia-3 79M).
14_three_model_eval.py hashes this PLAN and records the hash in every output; editing the plan after
results exist changes the hash and is therefore visible in provenance.
"""

PLAN = {
    "version": "three-model-plan.v1",
    "frozen_utc": "2026-10-05T02:40:00Z",
    "models": {
        "R": {"name": "Regan-inspired public reconstruction",
              "outputs": "per-decision projected P(top-1 engine match), P(top-3 engine match) from the existing "
                         "Elo-band x difficulty-decile projection (projection.json, fitted on train, kappa on val); "
                         "game-level z(top-1). It does NOT output a probability for every legal move.",
              "move_distribution": False},
        "Q": {"name": "Qwen3-8B-Base", "condition": "regan_aligned",
              "outputs": "softmax over legal moves of summed candidate-token log-likelihoods", "move_distribution": True},
        "M": {"name": "Maia-3 79M (primary chess-specific comparator)", "move_distribution": True},
        "M5": {"name": "Maia-3 5M (checkpoint of the existing hybrid pipeline; secondary row)", "move_distribution": True},
    },
    "task1": {
        "data": "eligible decisions of ORIGINAL (presumed-human) test player-games only; no synthetic variants",
        "metrics_distribution_models": ["top1_accuracy", "top3_accuracy", "mean_nll", "brier_multiclass",
                                        "mean_rank", "median_rank"],
        "metrics_all_models": ["t1_event_logloss", "t1_event_brier", "t3_event_logloss", "t3_event_brier"],
        "t1_event": "played move == Stockfish MultiPV line 1; model prediction = P_model(that move) (R: p_t1)",
        "t3_event": "played move among Stockfish MultiPV lines 1-3; prediction = sum of P_model over those moves (R: p_t3)",
        "rank_rule": "1 + number of legal moves with strictly higher probability",
        "probability_floor": 1e-6,
        "brier_definition": "sum over legal moves of (p_i - y_i)^2 per position, then mean (valid for varying legal sets)",
    },
    "task2": {
        "data": "all 9,680 test rows of the existing controlled benchmark (605 originals + 9,075 decision-level substitutions)",
        "label": "intervention label (level > 0)",
        "score_distribution_models": "mean surprisal -log max(P_model(chosen move), 1e-6) over the player-game's eligible "
                                     "decisions; higher = flagged (orientation fixed a priori)",
        "secondary_score_distribution_models": "mean excess surprisal (surprisal - model entropy at that position); higher = flagged",
        "score_R": "z(top-1) of the existing reconstruction (A0 column z_t1); higher = flagged",
        "metrics": ["roc_auc (balanced weights, as in the existing evaluation)", "pr_auc (balanced weights)",
                    "recall at 1% and 5% target FPR with thresholds from VALIDATION original player-games; realized test FPR reported",
                    "roc_auc per strategy x level"],
        "calibration": "not reported: none of these scores is a probability of intervention",
    },
    "bootstrap": {"type": "paired source-game cluster bootstrap", "n_boot": 2000, "seed": 20261003 + 14,
                  "interval": "percentile 95%", "refit": False,
                  "task1_pairs": [["Q", "M"], ["Q", "M5"], ["M5", "M"]],
                  "task1_event_pairs": [["R", "Q"], ["R", "M"], ["Q", "M"]],
                  "task2_pairs": [["R", "Q"], ["R", "M"], ["Q", "M"], ["M5", "M"]],
                  "multiplicity": "none applied; comparisons are multiple"},
    "qwen_pending_rule": "if no Qwen3-8B-Base scores exist, every Qwen metric is reported as pending (null); nothing is imputed",
}
