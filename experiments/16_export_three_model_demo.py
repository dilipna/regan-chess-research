"""Static three-model data for the prepared professor studies (works with no backend at all).

Same player-game as the existing prepared studies (06_export_web.py selection rule: test split,
1800-2199 band, >= 28 eligible decisions, baseline z(top-1) closest to the group median). For every
eligible decision of that player: the original position, every legal move with each model's output,
Stockfish MultiPV lines, the Regan-inspired reconstruction's per-decision projections, and, where a
prepared study substituted the decision, the controlled engine substitute -- evaluated in the SAME
original position (decision-level counterfactual; the game is not replayed).

Featured position: the existing rule (lib/featured.ts): in the selective study, the substituted
engine-best move that Maia-3 5M ranks lowest. Not chosen on any Qwen or Maia-3 79M output.

Output: apps/web/public/data/prepared_three_model_demo.json (+ copy in data/artifacts/)
"""

from __future__ import annotations

import json
import math
import pickle
import sys
import time
from pathlib import Path

import chess
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services"))
from analyzer import config  # noqa: E402
from analyzer.compare.dists import entropy, load_qwen, maia_dist, rank_of, surprisal, validate  # noqa: E402
from analyzer.qwen.prompt import PROMPT_HASH, build_prompt, position_from_decision, prompt_spec  # noqa: E402
from analyzer.qwen.scorer import QWEN_MODEL_ID, QWEN_REVISION  # noqa: E402

SCRIPT = "experiments/16_export_three_model_demo.py"
STUDIES = [("human-baseline", "none", 0.0), ("obvious-assistance", "random", 0.40), ("selective-critical", "selective", 0.20)]


def r6(x):
    return None if x is None or (isinstance(x, float) and (math.isnan(x) or math.isinf(x))) else round(float(x), 6)


def san(fen, uci):
    return chess.Board(fen).san(chess.Move.from_uci(uci))


def main():
    te = pd.read_parquet(config.ARTIFACTS / "test_predictions.parquet")
    clean = te[te["level"] == 0]
    grp = clean[(clean["band"] == "1800-2199") & (clean["n_dec"] >= 28)]
    pick = grp.iloc[(grp["z_t1"] - grp["z_t1"].median()).abs().argsort().iloc[0]]
    gid, color = pick["game_id"], pick["color"]
    demos = json.loads((config.WEB_DATA / "demos.json").read_text())
    assert demos["color"] == color
    with open(config.PROCESSED / "decisions.pkl", "rb") as fh:
        decs = pickle.load(fh)[gid]
    with open(config.PROCESSED / "variant_choices.pkl", "rb") as fh:
        choices = pickle.load(fh)
    elig = [d for d in decs if d["eligible"] and d["color"] == color]
    by_ply = {d["ply"]: d for d in elig}
    q = load_qwen("regan_aligned", "test")
    q0 = load_qwen("position_only", "test")
    asr = json.loads((config.ARTIFACTS / "three_model_assistance_results.json").read_text())

    # substitutions per study
    studies, subs = [], {}
    for sid, strat, lvl in STUDIES:
        vid = f"{gid}:{color}:{strat}:{int(round(lvl * 100))}"
        row = te[te["variant_id"] == vid].iloc[0]
        ch = choices[vid]
        sub_plies = []
        for ply, k, alt in zip(ch["plies"], ch["choice"], ch["altered"]):
            if alt:
                mv = by_ply[ply]["cands"][k]["move"]
                subs.setdefault(ply, {"move": mv, "studies": []})
                assert subs[ply]["move"] == mv
                subs[ply]["studies"].append(sid)
                sub_plies.append(ply)
        dm = next(x for x in demos["demos"] if x["id"] == sid)
        assert abs(dm["realized_alpha"] - float(row["realized_alpha"])) < 1e-6
        game = {"R_z_t1": r6(row["z_t1"])}
        for m, D in (("M", "M"), ("M5", "M5"), ("Q", q), ("Q0", q0)):
            if m in ("Q", "Q0") and D is None:
                game[f"{m}_mean_surprisal"] = None
                continue
            vals = []
            for ply, k in zip(ch["plies"], ch["choice"]):
                mv = by_ply[ply]["cands"][k]["move"]
                dist = maia_dist(m, gid, ply) if m in ("M", "M5") else D[f"{gid}:{ply}"]["prob"]
                vals.append(surprisal(dist[mv]))
            game[f"{m}_mean_surprisal"] = r6(np.mean(vals))
        studies.append({"id": sid, "strategy": strat, "target_level": lvl, "realized_alpha": r6(row["realized_alpha"]),
                        "n_decisions": len(elig), "substituted_plies": sub_plies, "game_scores": game,
                        "existing_hybrid_D_estimate": dm["alpha_estimate"]["D_sf_maia_seq"],
                        "existing_hybrid_D_score": dm["scores"]["D_sf_maia_seq"]})

    positions = []
    for d in elig:
        pid = f"{gid}:{d['ply']}"
        legal = sorted(m.uci() for m in chess.Board(d["fen"]).legal_moves)
        M = validate(maia_dist("M", gid, d["ply"]), d["fen"], "M")
        M5 = validate(maia_dist("M5", gid, d["ply"]), d["fen"], "M5")
        Q = validate(q[pid]["prob"], d["fen"], "Q") if q else None
        Q0 = validate(q0[pid]["prob"], d["fen"], "Q0") if q0 else None
        sf = {l["move"]: (i + 1, l["cp"]) for i, l in enumerate(d["sf_lines"])}
        cands = []
        for mv in legal:
            cands.append({"move": mv, "san": san(d["fen"], mv),
                          "sf_rank": sf[mv][0] if mv in sf else None, "sf_cp": sf[mv][1] if mv in sf else None,
                          "maia": r6(M[mv]), "maia_rank": rank_of(M, mv), "maia5": r6(M5[mv]), "maia5_rank": rank_of(M5, mv),
                          "qwen": r6(Q[mv]) if Q else None, "qwen_rank": rank_of(Q, mv) if Q else None,
                          "qwen_logprob": r6(q[pid]["logprob"][mv]) if q else None,
                          "qwen_n_tokens": q[pid]["n_tokens"][mv] if q else None,
                          "qwen_position_only": r6(Q0[mv]) if Q0 else None})
        prompt, _ = build_prompt(position_from_decision(d))
        positions.append({
            "position_id": pid, "ply": d["ply"], "move_no": d["move_no"], "color": d["color"], "fen": d["fen"],
            "elo": int(d["elo"]), "opp_elo": int(d["opp_elo"]), "n_legal": len(legal),
            "original_move": d["played"], "original_san": d["san"],
            "substitute_move": subs[d["ply"]]["move"] if d["ply"] in subs else None,
            "substitute_san": san(d["fen"], subs[d["ply"]]["move"]) if d["ply"] in subs else None,
            "substituted_in": subs[d["ply"]]["studies"] if d["ply"] in subs else [],
            "sf_lines": [{"move": l["move"], "cp": l["cp"], "san": san(d["fen"], l["move"])} for l in d["sf_lines"]],
            "eval_before": d["eval_before"], "phase": d["phase"],
            "regan": {"difficulty": r6(d["difficulty"]), "p_t1": r6(d["p_t1"]), "p_t3": r6(d["p_t3"]),
                      "p_ev": r6(d.get("p_ev")), "expected_loss_cp": r6(d["mu_loss"]), "engine_first_move": d["sf_lines"][0]["move"]},
            "entropy": {"maia": r6(entropy(M)), "maia5": r6(entropy(M5)), "qwen": r6(entropy(Q)) if Q else None},
            "qwen_prompt": prompt, "candidates": cands})

    # featured position: existing rule (selective study, substituted engine-best move ranked lowest by Maia-3 5M)
    sel = [p for p in positions if "selective-critical" in p["substituted_in"]]
    sel = [p for p in sel if next(c for c in p["candidates"] if c["move"] == p["substitute_move"])["sf_rank"] == 1]
    featured = max(sel, key=lambda p: next(c for c in p["candidates"] if c["move"] == p["substitute_move"])["maia5_rank"])

    out = {
        "schema": "chessassistlens.three_model_demo.v1", "generator": SCRIPT,
        "generated_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "player": {"color": color, "elo": int(elig[0]["elo"]), "opp_elo": int(elig[0]["opp_elo"]), "band": "1800-2199"},
        "selection_rule": "Same player-game as the existing prepared studies (test split, 1800-2199, >= 28 eligible decisions, "
                          "baseline z(top-1) closest to the group median). Not selected on any model output.",
        "featured_ply": featured["ply"],
        "featured_rule": "In the selective study, the substituted engine-best move that Maia-3 5M ranks lowest (existing rule).",
        "models": {
            "R": {"label": "Regan-inspired reconstruction", "status": "ok", "move_distribution": False,
                  "outputs": "projected P(top-1 engine match), P(top-3), difficulty, expected loss per decision; z(top-1) per game"},
            "Q": {"label": "Qwen3-8B-Base", "status": "ok" if q else "pending", "model_id": QWEN_MODEL_ID,
                  "revision": QWEN_REVISION, "prompt_hash": PROMPT_HASH["regan_aligned"], "prompt": prompt_spec("regan_aligned"),
                  "position_only_status": "ok" if q0 else "pending", "move_distribution": True},
            "M": {"label": "Maia-3 79M", "status": "ok", "checkpoint": "UofTCSSLab/Maia3-79M",
                  "revision": "a107d6ceb7b298cb04ae1da4edffe2939858b894", "move_distribution": True},
            "M5": {"label": "Maia-3 5M", "status": "ok", "checkpoint": "UofTCSSLab/Maia3-5M",
                   "revision": "b6559de2398d7140b985f28fd2c19fb5e47ddabe", "move_distribution": True},
        },
        "studies": studies, "positions": positions,
        "benchmark_auc": {m: asr["models"][m].get("roc_auc") for m in asr["models"]},
        "note": "Substitutes are controlled decision-level substitutions evaluated in the original position; later "
                "positions are those of the original game (not replayed).",
    }
    txt = json.dumps(out, separators=(",", ":"))
    (config.WEB_DATA / "prepared_three_model_demo.json").write_text(txt, encoding="utf-8")
    (config.ARTIFACTS / "prepared_three_model_demo.json").write_text(txt, encoding="utf-8")
    print(f"wrote prepared_three_model_demo.json: {len(positions)} positions, featured ply {featured['ply']}, "
          f"{len(txt) / 1024:.0f} KB, qwen {'ok' if q else 'pending'}")


if __name__ == "__main__":
    main()
