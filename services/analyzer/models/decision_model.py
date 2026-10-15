"""Decision-level model: does this single move resemble a synthetic engine substitution?

Used only for per-move explanations (SHAP) on the Position Explanation page. Trained on
decisions of TRAIN-split variants; label = this decision was altered by the generator.
"""

from __future__ import annotations

import math

import numpy as np

DEC_FEATURES = ["sf_rank", "cpl", "gap12", "near_opt", "difficulty", "n_legal", "abs_eval",
                "maia_p", "maia_rank", "surprisal", "maia_entropy", "maia_p_best", "maia_sf_agree", "elo"]


def decision_row(d: dict, cand_idx: int) -> list[float]:
    c = d["cands"][cand_idx]
    p = c["maia_p"] if c["maia_p"] == c["maia_p"] else 1e-6
    pb = d["maia_p_best"] if d["maia_p_best"] == d["maia_p_best"] else 0.0
    return [float(c["sf_rank"]), float(min(c["cpl"], 300.0)), float(d["gap12"]), float(d["near_opt"]),
            float(d["difficulty"]), float(d["n_legal"]), abs(float(d["eval_before"])), float(p),
            float(c["maia_rank"]), -math.log(max(p, 1e-6)), float(d["maia_entropy"]), float(pb),
            float(d["maia_sf_agree"]), float(d["elo"])]


def decision_matrix(decs: list[dict], choice: list[int]) -> np.ndarray:
    return np.array([decision_row(d, k) for d, k in zip(decs, choice)], dtype=float)
