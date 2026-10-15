"""Shared pipeline pieces used by both the offline experiment and the live API."""

from __future__ import annotations

import numpy as np
import pandas as pd

from . import config
from .features.aggregate import decision_series, features_from_series, rolling_series, LOW_HUMAN_P
from .models.projection import LOSS_CAP, ProjectionModel

MIN_DECISIONS = 10   # player-games with fewer eligible decisions are excluded from experiments


def decisions_frame(decs: list[dict]) -> pd.DataFrame:
    """Position-level frame for projection (one row per decision, played-move outcomes)."""
    rows = []
    for d in decs:
        c = d["cands"][d["played_idx"]]
        rows.append({
            "elo": d["elo"], "gap12": d["gap12"], "near_opt": d["near_opt"], "n_legal": d["n_legal"],
            "eval_before": d["eval_before"], "eval_swing": d["eval_swing"], "phase": d["phase"],
            "top1": int(c["sf_rank"] == 1), "top3": int(c["sf_rank"] <= 3), "loss": min(c["cpl"], LOSS_CAP),
            "ev": int(c["cpl"] <= 0.0),
        })
    return pd.DataFrame(rows)


def attach_expectations(decs: list[dict], proj: ProjectionModel) -> None:
    """Adds difficulty, p_t1, p_t3, mu_loss, var_loss to each decision dict (in place)."""
    if not decs:
        return
    df = decisions_frame(decs)
    ex = proj.expectations(df)
    for d, (_, r) in zip(decs, ex.iterrows()):
        d["difficulty"] = float(r["difficulty"])
        d["p_t1"] = float(r["p_t1"]); d["p_t3"] = float(r["p_t3"])
        d["mu_loss"] = float(r["mu_loss"]); d["var_loss"] = float(r["var_loss"])
        d["p_ev"] = float(r["p_ev"])


def player_games(decs_all: list[dict]) -> dict[tuple[str, str], list[dict]]:
    """Group ELIGIBLE decisions by (game_id, color) in ply order."""
    out: dict[tuple[str, str], list[dict]] = {}
    for d in decs_all:
        if d["eligible"]:
            out.setdefault((d["game_id"], d["color"]), []).append(d)
    for v in out.values():
        v.sort(key=lambda d: d["ply"])
    return out


def player_game_features(decs: list[dict], choice: list[int], proj: ProjectionModel) -> dict:
    s = decision_series(decs, choice)
    return features_from_series(s, proj, float(decs[0]["elo"]), float(decs[0]["opp_elo"]))


def projected_vs_observed(decs: list[dict], choice: list[int], proj: ProjectionModel) -> list[dict]:
    """Rows for the Projected-vs-Observed table (rates per decision; z from counts)."""
    import math
    s = decision_series(decs, choice)
    n = len(decs)
    raw = proj.raw_stats(s["top1"], s["top3"], s["loss"], s["p_t1"], s["p_t3"], s["mu_loss"],
                         s["var_loss"], s["difficulty"])
    z = proj.zscores(raw)
    hard = s["difficulty"] >= proj.hard_threshold
    easy = s["difficulty"] <= proj.easy_threshold
    num, var = float((s["surprisal"] - s["H"]).sum()), float(s["Hvar"].sum())
    k = proj.kappa

    def zz(o, p, v, kap):
        return float((o - p) / math.sqrt(kap * v)) if v > 0 else 0.0

    rows = [
        {"key": "t1", "metric": "Top-1 engine match", "unit": "rate", "n": n,
         "projected": raw["t1_proj"] / n, "observed": raw["t1_obs"] / n, "z": z["z_t1"],
         "note": "fraction of eligible decisions matching the first-listed Stockfish move (cf. Regan's T1-match)"},
    ]
    ev_obs, ev_proj = float(s["ev"].sum()), float(np.nansum(s["p_ev"]))
    ev_var = float(np.nansum(s["p_ev"] * (1 - s["p_ev"])))
    if np.isfinite(s["p_ev"]).all():
        rows.append({"key": "ev", "metric": "Equal-value engine match", "unit": "rate", "n": n,
                     "projected": ev_proj / n, "observed": ev_obs / n, "z": zz(ev_obs, ev_proj, ev_var, k.get("ev", 1.0)),
                     "note": "move's value equals the best line's value at depth 12, ties included (cf. Regan's EV-match)"})
    rows += [
        {"key": "t3", "metric": "Top-3 engine match", "unit": "rate", "n": n,
         "projected": raw["t3_proj"] / n, "observed": raw["t3_obs"] / n, "z": z["z_t3"],
         "note": "fraction matching one of Stockfish's top 3 lines (ChessAssistLens statistic)"},
        {"key": "loss", "metric": "Mean move loss", "unit": "cp", "n": n,
         "projected": raw["loss_proj"] / n, "observed": raw["loss_obs"] / n, "z": z["z_loss"],
         "note": f"unscaled centipawn loss capped at {int(LOSS_CAP)} - NOT Regan's scaled ASD; positive z = less loss than projected"},
    ]
    if hard.any():
        rows.append({"key": "t1_hard", "metric": "Top-1 match, hard positions", "unit": "rate", "n": int(hard.sum()),
                     "projected": raw["t1h_proj"] / max(hard.sum(), 1), "observed": raw["t1h_obs"] / max(hard.sum(), 1),
                     "z": z["z_t1_hard"], "note": "difficulty in top tercile of training positions"})
    if easy.any():
        o, p = float(s["top1"][easy].sum()), float(s["p_t1"][easy].sum())
        v = float((s["p_t1"][easy] * (1 - s["p_t1"][easy])).sum())
        rows.append({"key": "t1_easy", "metric": "Top-1 match, ordinary positions", "unit": "rate", "n": int(easy.sum()),
                     "projected": p / easy.sum(), "observed": o / easy.sum(), "z": zz(o, p, v, k["t1"]),
                     "note": "difficulty in bottom tercile of training positions"})
    rows.append({"key": "maia", "metric": "Human surprisal (Maia-3)", "unit": "nats/move", "n": n,
                 "projected": float(s["H"].mean()), "observed": float(s["surprisal"].mean()),
                 "z": zz(num, 0.0, var, k.get("maia", 1.0)),
                 "note": "expected = Maia entropy; positive z = less human-typical than projected (ChessAssistLens addition)"})
    return rows


def timeline(decs_all_plies: list[dict], color: str, proj: ProjectionModel,
             choice_by_ply: dict[int, int] | None = None) -> list[dict]:
    """Per-ply rows for one player (all plies with analysis), for the board/timeline UI."""
    rows = []
    mine = [d for d in decs_all_plies if d["color"] == color]
    # rolling stats over eligible decisions only
    elig = [d for d in mine if d["eligible"]]
    ch = [choice_by_ply.get(d["ply"], d["played_idx"]) if choice_by_ply else d["played_idx"] for d in elig]
    roll = {}
    if elig:
        s = decision_series(elig, ch)
        r_t1, r_loss, r_s = rolling_series(s["top1"]), rolling_series(s["loss"]), rolling_series(s["surprisal"])
        for i, d in enumerate(elig):
            roll[d["ply"]] = (float(r_t1[i]), float(r_loss[i]), float(r_s[i]))
    for d in mine:
        k = choice_by_ply.get(d["ply"], d["played_idx"]) if choice_by_ply else d["played_idx"]
        c = d["cands"][k]
        rows.append(_ply_row(d, c, k != d["played_idx"], roll.get(d["ply"]), proj.hard_threshold))
    return rows


def _ply_row(d: dict, c: dict, substituted: bool, roll, hard_thr: float) -> dict:
    p = c["maia_p"]
    diff = d.get("difficulty")
    return {
        "ply": d["ply"], "move_no": d["move_no"], "color": d["color"], "fen": d["fen"],
        "move": c["move"], "human_move": d["played"], "san": d["san"], "substituted": substituted,
        "eligible": d["eligible"], "phase": d["phase"], "n_legal": d["n_legal"],
        "eval_before": d["eval_before"], "eval_swing": d["eval_swing"], "gap12": d["gap12"],
        "near_opt": d["near_opt"],
        "sf_rank": c["sf_rank"], "sf_rank_censored": c["sf_rank"] > len(d["sf_lines"]),
        "cpl": round(c["cpl"], 1), "top1": c["sf_rank"] == 1,
        "maia_p": None if p != p else round(p, 5), "maia_rank": c["maia_rank"],
        "surprisal": None if p != p else round(c["surprisal"], 4),
        "maia_top": d["maia_top"], "maia_top_p": d.get("maia_top_p", []),
        "maia_entropy": round(d["maia_entropy"], 4),
        "sf_lines": d["sf_lines"], "sf_best": d["sf_best"],
        "sf_depth": d.get("sf_depth"), "sf_quick": d.get("sf_quick", False),
        "difficulty": None if diff is None else round(diff, 4),
        "p_t1": d.get("p_t1"),
        "flag_triple": bool(d["eligible"] and diff is not None and c["sf_rank"] == 1 and
                            diff >= hard_thr and p == p and p < LOW_HUMAN_P),
        "roll_t1": roll[0] if roll else None, "roll_loss": roll[1] if roll else None,
        "roll_surprisal": roll[2] if roll else None,
    }
