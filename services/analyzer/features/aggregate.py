"""Player-game feature vectors for the four nested ablation groups.

    A  STAT  : Regan-inspired aggregate statistics (rates + projected-vs-observed z-scores)
    B  SF    : A + further Stockfish aggregates               (nonlinear engine features)
    C  MAIA  : B + Maia-3 human-likelihood aggregates         (human model)
    D  SEQ   : C + sequence / criticality features

Every feature is a deterministic function of the chosen move at each eligible decision plus
position-level quantities that do not depend on the move chosen.
"""

from __future__ import annotations

import math

import numpy as np

from ..models.projection import LOSS_CAP, ProjectionModel

ROLL_W = 8
LOW_HUMAN_P = 0.10          # "low human likelihood": Maia P(move) < 10%

STAT_FEATURES = ["n_dec", "elo", "opp_elo", "t1_rate", "t3_rate", "mean_loss",
                 "z_t1", "z_t3", "z_loss", "z_t1_hard"]
SF_FEATURES = ["t5_rate", "median_loss", "std_loss", "frac_loss_ge100", "frac_loss_ge300",
               "mean_rank", "frac_near_opt", "mean_abs_eval", "mean_gap12"]
MAIA_FEATURES = ["mean_surprisal", "median_surprisal", "mean_maia_p", "maia_t1_rate", "maia_t3_rate",
                 "frac_maia_p_lt05", "frac_maia_p_lt02", "excess_surprisal", "z_maia",
                 "nonhuman_engine_rate", "mean_log_ratio_maia_top1"]
SEQ_FEATURES = ["longest_t1_streak", "longest_t1_streak_frac", "roll_t1_max", "roll_t1_std",
                "roll_loss_min", "roll_surprisal_max", "acc_easy", "acc_hard", "crit_lift",
                "corr_diff_t1", "corr_diff_loss", "triple_rate", "triple_count",
                "longest_nonhuman_streak"]

GROUPS = {
    "A_stat": STAT_FEATURES,
    "B_sf": STAT_FEATURES + SF_FEATURES,
    "C_sf_maia": STAT_FEATURES + SF_FEATURES + MAIA_FEATURES,
    "D_sf_maia_seq": STAT_FEATURES + SF_FEATURES + MAIA_FEATURES + SEQ_FEATURES,
}
ALL_FEATURES = GROUPS["D_sf_maia_seq"]


def decision_series(decs: list[dict], choice: list[int]) -> dict[str, np.ndarray]:
    """Per-decision arrays for a given choice of candidate at each decision."""
    c = [d["cands"][k] for d, k in zip(decs, choice)]
    sf_rank = np.array([x["sf_rank"] for x in c], dtype=float)
    maia_p = np.array([x["maia_p"] for x in c], dtype=float)
    maia_p = np.nan_to_num(maia_p, nan=1e-6)
    top_p = np.array([d["maia_p_top1"] for d in decs], dtype=float)
    return {
        "sf_rank": sf_rank,
        "top1": (sf_rank == 1).astype(float),
        "top3": (sf_rank <= 3).astype(float),
        "top5": (sf_rank <= 5).astype(float),
        "loss": np.minimum(np.array([x["cpl"] for x in c], dtype=float), LOSS_CAP),
        "maia_p": maia_p,
        "maia_rank": np.array([x["maia_rank"] for x in c], dtype=float),
        "surprisal": -np.log(np.maximum(maia_p, 1e-6)),
        "maia_top1_p": top_p,
        "difficulty": np.array([d["difficulty"] for d in decs], dtype=float),
        "p_t1": np.array([d["p_t1"] for d in decs], dtype=float),
        "p_t3": np.array([d["p_t3"] for d in decs], dtype=float),
        "p_ev": np.array([d.get("p_ev", np.nan) for d in decs], dtype=float),
        "ev": (np.array([x["cpl"] for x in c], dtype=float) <= 0.0).astype(float),
        "mu_loss": np.array([d["mu_loss"] for d in decs], dtype=float),
        "var_loss": np.array([d["var_loss"] for d in decs], dtype=float),
        "H": np.array([d["maia_entropy"] for d in decs], dtype=float),
        "Hvar": np.array([d["maia_svar"] for d in decs], dtype=float),
        "nonhuman_pos": np.array([d["maia_top1"] != d["sf_best"] for d in decs], dtype=bool),
        "abs_eval": np.abs(np.array([d["eval_before"] for d in decs], dtype=float)),
        "gap12": np.array([d["gap12"] for d in decs], dtype=float),
    }


def _rolling_mean(x: np.ndarray, w: int) -> np.ndarray:
    if len(x) == 0:
        return np.array([0.0])
    if len(x) <= w:
        return np.array([x.mean()])
    cs = np.cumsum(np.insert(x, 0, 0.0))
    return (cs[w:] - cs[:-w]) / w


def rolling_series(x: np.ndarray, w: int = ROLL_W) -> np.ndarray:
    """Trailing rolling mean aligned to each decision (for timelines)."""
    out = np.empty(len(x))
    for i in range(len(x)):
        lo = max(0, i - w + 1)
        out[i] = x[lo:i + 1].mean()
    return out


def _longest_run(mask: np.ndarray) -> int:
    best = cur = 0
    for v in mask:
        cur = cur + 1 if v else 0
        best = max(best, cur)
    return best


def _corr(a: np.ndarray, b: np.ndarray) -> float:
    if len(a) < 3 or a.std() == 0 or b.std() == 0:
        return 0.0
    return float(np.corrcoef(a, b)[0, 1])


def maia_raw(s: dict) -> tuple[float, float]:
    return float((s["surprisal"] - s["H"]).sum()), float(s["Hvar"].sum())


def features_from_series(s: dict, proj: ProjectionModel, elo: float, opp_elo: float) -> dict:
    n = len(s["top1"])
    raw = proj.raw_stats(s["top1"], s["top3"], s["loss"], s["p_t1"], s["p_t3"], s["mu_loss"],
                         s["var_loss"], s["difficulty"])
    z = proj.zscores(raw)
    hard = s["difficulty"] >= proj.hard_threshold
    easy = s["difficulty"] <= proj.easy_threshold
    low_h = s["maia_p"] < LOW_HUMAN_P
    triple = (s["top1"] == 1) & hard & low_h
    num, var = maia_raw(s)
    nonhuman_match = s["nonhuman_pos"] & (s["top1"] == 1)
    acc_hard = float(s["top1"][hard].mean()) if hard.any() else float(raw["t1_proj"] / max(n, 1))
    acc_easy = float(s["top1"][easy].mean()) if easy.any() else float(raw["t1_proj"] / max(n, 1))
    roll_t1 = _rolling_mean(s["top1"], ROLL_W)
    f = {
        # A
        "n_dec": n, "elo": elo, "opp_elo": opp_elo,
        "t1_rate": float(s["top1"].mean()), "t3_rate": float(s["top3"].mean()),
        "mean_loss": float(s["loss"].mean()),
        **z,
        # B
        "t5_rate": float(s["top5"].mean()), "median_loss": float(np.median(s["loss"])),
        "std_loss": float(s["loss"].std()), "frac_loss_ge100": float((s["loss"] >= 100).mean()),
        "frac_loss_ge300": float((s["loss"] >= LOSS_CAP).mean()),
        "mean_rank": float(s["sf_rank"].mean()), "frac_near_opt": float((s["loss"] <= 25).mean()),
        "mean_abs_eval": float(s["abs_eval"].mean()), "mean_gap12": float(s["gap12"].mean()),
        # C
        "mean_surprisal": float(s["surprisal"].mean()), "median_surprisal": float(np.median(s["surprisal"])),
        "mean_maia_p": float(s["maia_p"].mean()), "maia_t1_rate": float((s["maia_rank"] == 1).mean()),
        "maia_t3_rate": float((s["maia_rank"] <= 3).mean()),
        "frac_maia_p_lt05": float((s["maia_p"] < 0.05).mean()),
        "frac_maia_p_lt02": float((s["maia_p"] < 0.02).mean()),
        "excess_surprisal": float(num / max(n, 1)),
        "z_maia": float(num / math.sqrt(proj.kappa.get("maia", 1.0) * var)) if var > 0 else 0.0,
        "nonhuman_engine_rate": float(nonhuman_match.sum() / max(s["nonhuman_pos"].sum(), 1)),
        "mean_log_ratio_maia_top1": float(np.mean(np.log(np.maximum(s["maia_p"], 1e-6))
                                                  - np.log(np.maximum(np.nan_to_num(s["maia_top1_p"], nan=1.0), 1e-6)))),
        # D
        "longest_t1_streak": _longest_run(s["top1"] == 1),
        "longest_t1_streak_frac": _longest_run(s["top1"] == 1) / max(n, 1),
        "roll_t1_max": float(roll_t1.max()), "roll_t1_std": float(roll_t1.std()),
        "roll_loss_min": float(_rolling_mean(s["loss"], ROLL_W).min()),
        "roll_surprisal_max": float(_rolling_mean(s["surprisal"], ROLL_W).max()),
        "acc_easy": acc_easy, "acc_hard": acc_hard, "crit_lift": acc_hard - acc_easy,
        "corr_diff_t1": _corr(s["difficulty"], s["top1"]),
        "corr_diff_loss": _corr(s["difficulty"], -s["loss"]),
        "triple_rate": float(triple.mean()), "triple_count": int(triple.sum()),
        "longest_nonhuman_streak": _longest_run(nonhuman_match),
    }
    return f
