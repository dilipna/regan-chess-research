"""Build the JSON report consumed by the web app (same schema for demos and live analysis)."""

from __future__ import annotations

import json
import pickle
from functools import lru_cache

import chess
import numpy as np
import pandas as pd

from . import config
from .explain.narrative import game_explanation, move_explanation
from .features.aggregate import GROUPS
from .models.decision_model import DEC_FEATURES, decision_matrix
from .models.projection import ProjectionModel
from .pipeline import attach_expectations, player_game_features, projected_vs_observed, timeline

SCHEMA = "chessassistlens.report.v1"
MODEL_NAMES = ["A_stat", "B_sf", "C_sf_maia", "D_sf_maia_seq"]


class Artifacts:
    def __init__(self, root=config.ARTIFACTS):
        self.proj = ProjectionModel.load(root / "projection.json")
        self.models = {}
        for n in MODEL_NAMES:
            with open(root / f"model_{n}.pkl", "rb") as fh:
                self.models[n] = pickle.load(fh)
        with open(root / "decision_model.pkl", "rb") as fh:
            self.dm = pickle.load(fh)
        self.reference = json.loads((root / "reference_scores.json").read_text())
        self._shap = {}
        self._dm_shap = None

    def explainer(self, name):
        import shap
        if name not in self._shap:
            self._shap[name] = shap.TreeExplainer(self.models[name]["clf"])
        return self._shap[name]

    def dm_explainer(self):
        import shap
        if self._dm_shap is None:
            self._dm_shap = shap.TreeExplainer(self.dm["model"])
        return self._dm_shap

    def percentile(self, name: str, score: float) -> float:
        ref = np.asarray(self.reference[name])
        return float((ref < score).mean())


@lru_cache(maxsize=1)
def load_artifacts() -> Artifacts:
    return Artifacts()


def _san(fen: str, uci: str) -> str:
    b = chess.Board(fen)
    try:
        return b.san(chess.Move.from_uci(uci))
    except Exception:
        return uci


def player_report(art: Artifacts, decs_all: list[dict], color: str, choice_by_ply: dict[int, int] | None,
                  min_decisions: int = 5) -> dict | None:
    mine = [d for d in decs_all if d["color"] == color]
    elig = [d for d in mine if d["eligible"]]
    if not mine:
        return None
    attach_expectations(elig, art.proj)
    tl = timeline(decs_all, color, art.proj, choice_by_ply)
    for r in tl:
        r["display_san"] = _san(r["fen"], r["move"]) if r["substituted"] else r["san"]
    out = {"color": color, "elo": mine[0]["elo"], "opp_elo": mine[0]["opp_elo"],
           "n_decisions": len(elig), "n_plies": len(mine), "timeline": tl,
           "hard_threshold": art.proj.hard_threshold, "easy_threshold": art.proj.easy_threshold,
           "sufficient": len(elig) >= min_decisions}
    if len(elig) < min_decisions:
        out["note"] = f"Only {len(elig)} eligible decisions (minimum {min_decisions}); no scores computed."
        return out
    choice = [choice_by_ply.get(d["ply"], d["played_idx"]) if choice_by_ply else d["played_idx"] for d in elig]
    feats = player_game_features(elig, choice, art.proj)
    scores, alphas, pct = {}, {}, {}
    for n in MODEL_NAMES:
        m = art.models[n]
        X = np.array([[feats[f] for f in m["features"]]], dtype=float)
        scores[n] = float(m["clf"].predict_proba(X)[0, 1])
        alphas[n] = float(np.clip(m["reg"].predict(X)[0], 0, 1))
        pct[n] = art.percentile(n, scores[n])
    scores["A0_zt1"] = feats["z_t1"]
    pct["A0_zt1"] = art.percentile("A0_zt1", feats["z_t1"])

    fD = GROUPS["D_sf_maia_seq"]
    XD = np.array([[feats[f] for f in fD]], dtype=float)
    ex = art.explainer("D_sf_maia_seq")
    sv = np.asarray(ex.shap_values(XD))[0]
    base = float(np.ravel(ex.expected_value)[0])
    shap_rows = sorted([{"feature": f, "value": float(feats[f]), "contribution": float(sv[i])}
                        for i, f in enumerate(fD)], key=lambda r: -abs(r["contribution"]))

    # decision-level model
    Xd = decision_matrix(elig, choice)
    dm_p = art.dm["model"].predict_proba(Xd)[:, 1]
    dm_sv = np.asarray(art.dm_explainer().shap_values(Xd))
    dm_by_ply = {}
    for i, d in enumerate(elig):
        dm_by_ply[d["ply"]] = {
            "score": float(dm_p[i]),
            "shap": [{"feature": f, "value": float(Xd[i, j]), "contribution": float(dm_sv[i, j])}
                     for j, f in enumerate(DEC_FEATURES)],
        }
    for r in tl:
        if r["ply"] in dm_by_ply:
            r["dm_score"] = dm_by_ply[r["ply"]]["score"]
            r["dm_shap"] = sorted(dm_by_ply[r["ply"]]["shap"], key=lambda x: -abs(x["contribution"]))
            r["explanation"] = move_explanation(r)
    unusual = sorted(dm_by_ply, key=lambda p: -dm_by_ply[p]["score"])[:6]

    pvo = projected_vs_observed(elig, choice, art.proj)
    narrative = game_explanation({
        "pvo": pvo,
        "scores": {"baseline": scores["A_stat"], "human-aware": scores["C_sf_maia"],
                   "sequence-aware": scores["D_sf_maia_seq"]},
        "alpha_est": alphas["D_sf_maia_seq"],
        "shap_top": [(r["feature"], r["value"], r["contribution"]) for r in shap_rows[:8]],
    })
    out.update({"features": feats, "scores": scores, "score_percentile_vs_clean": pct,
                "alpha_estimate": alphas, "pvo": pvo,
                "shap": {"model": "D_sf_maia_seq", "base_value_logit": base, "rows": shap_rows},
                "unusual_plies": sorted(unusual), "narrative": narrative})
    return out


def game_report(art: Artifacts, game: dict, decs_all: list[dict], *, report_id: str, title: str,
                kind: str, focus: str | None = None, synthetic: dict | None = None,
                anonymize: bool = True, analysis_meta: dict | None = None) -> dict:
    """synthetic: {strategy, level, realized_alpha, color, choice_by_ply} or None."""
    choice_by_ply = synthetic["choice_by_ply"] if synthetic else None
    labels = {"white": f"White ({game['white_elo'] or '?'})", "black": f"Black ({game['black_elo'] or '?'})"} \
        if anonymize else {"white": game["white"], "black": game["black"]}
    players = {}
    for color in ("white", "black"):
        ch = choice_by_ply if (synthetic and synthetic["color"] == color) else None
        players[color] = player_report(art, decs_all, color, ch)
    subs = []
    if synthetic:
        by_ply = {d["ply"]: d for d in decs_all}
        for ply, k in sorted(synthetic["choice_by_ply"].items()):
            d = by_ply[ply]
            if k != d["played_idx"]:
                c = d["cands"][k]
                subs.append({"ply": ply, "move_no": d["move_no"], "color": d["color"],
                             "human_move": d["played"], "human_san": d["san"],
                             "engine_move": c["move"], "engine_san": _san(d["fen"], c["move"]),
                             "engine_rank": c["sf_rank"]})
    moves = [{"ply": i, "uci": u, "san": s, "fen_before": f}
             for i, (u, s, f) in enumerate(zip(game["moves_uci"], game["moves_san"], game["fens"]))]
    return {
        "schema": SCHEMA, "id": report_id, "title": title, "kind": kind, "disclaimer": config.DISCLAIMER,
        "focus": focus or (synthetic["color"] if synthetic else "white"),
        "game": {"white": labels["white"], "black": labels["black"], "white_elo": game["white_elo"],
                 "black_elo": game["black_elo"], "result": game["result"], "time_control": game["time_control"],
                 "start_fen": game["start_fen"], "final_fen": game["fens"][-1], "moves": moves},
        "analysis": analysis_meta or {},
        "synthetic": None if not synthetic else {
            "strategy": synthetic["strategy"], "level": synthetic["level"],
            "realized_alpha": synthetic["realized_alpha"], "color": synthetic["color"],
            "n_altered": len(subs), "substitutions": subs},
        "players": players,
    }
