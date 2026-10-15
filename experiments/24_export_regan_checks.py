"""Evidence a statistician of chess would ask for, exported from stored artifacts (no refitting, nothing typed by hand).

1. game          Projected vs actual engine-first-move matches over one whole held-out player-game (the featured
                 MoveLens game), for the original moves and for every controlled substitution level. z(top-1) is
                 RECOMPUTED here from the per-decision projections and kappa, and asserted equal to the stored value
                 in test_predictions.parquet.
2. calibration   Held-out original test decisions: projected P(engine #1) vs observed rate, by projection bin (width 0.1) and
                 by rating band (the projection table was fitted on the training split only).
3. clean_z       z(top-1) on the 605 held-out original player-games: mean, SD, tail fractions vs N(0,1).
4. screening     Share of player-games with z(top-1) above 2 and 3, for originals and for each substitution
                 strategy x level (what a z-threshold alone would flag).
5. maia_by_band  Maia-3 79M top-1 accuracy by rating band (copied from three_model_move_prediction.json).
6. qwen_ablation Qwen3-8B-Base on the 7 MoveLens demo positions with and without the Stockfish lines in the prompt
                 (only if both local score files exist; demo scope, not an evaluation).

Output: apps/web/public/data/regan_checks.json (+ copy in data/artifacts/)
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

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services"))
from analyzer import config  # noqa: E402
from analyzer.compare.dists import maia_dist, rank_of, validate  # noqa: E402
from analyzer.features.aggregate import decision_series  # noqa: E402
from analyzer.qwen.prompt import PROMPT_HASH  # noqa: E402
from analyzer.qwen.scorer import QWEN_MODEL_ID, QWEN_REVISION, normalize  # noqa: E402

SCRIPT = "experiments/24_export_regan_checks.py"
LOCAL = config.INTERIM / "qwen_local_demo"


def r6(x):
    return None if x is None or (isinstance(x, float) and (math.isnan(x) or math.isinf(x))) else round(float(x), 6)


def normal_sf(z: float) -> float:
    return 0.5 * math.erfc(z / math.sqrt(2))


def game_block(te: pd.DataFrame, decs: dict, choices: dict, kappa: float) -> dict:
    demo = json.loads((config.ARTIFACTS / "prepared_three_model_demo.json").read_text())
    gid = demo["positions"][0]["position_id"].split(":")[0]
    color = demo["player"]["color"]
    elig = [d for d in decs[gid] if d["eligible"] and d["color"] == color]
    rows = te[(te["game_id"] == gid) & (te["color"] == color)].sort_values(["strategy", "level"])
    out_variants = []
    for r in rows.itertuples():
        if r.level == 0:
            choice = [d["played_idx"] for d in elig]
            altered = [False] * len(elig)
        else:
            ch = choices[r.variant_id]
            assert list(ch["plies"]) == [d["ply"] for d in elig]
            choice, altered = list(ch["choice"]), list(ch["altered"])
        s = decision_series(elig, choice)
        proj, var, obs = float(s["p_t1"].sum()), float((s["p_t1"] * (1 - s["p_t1"])).sum()), float(s["top1"].sum())
        z = (obs - proj) / math.sqrt(kappa * var)
        assert abs(z - r.z_t1) < 1e-6, (r.variant_id, z, r.z_t1)
        out_variants.append({"strategy": r.strategy, "level": float(r.level), "realized_alpha": r6(r.realized_alpha),
                             "n_altered": int(r.n_altered), "projected_t1": r6(proj), "actual_t1": int(obs), "var_t1": r6(var),
                             "z_t1": r6(z), "mean_maia_surprisal": r6(r.mean_surprisal),
                             "altered_plies": [d["ply"] for d, a in zip(elig, altered) if a],
                             "t1": [int(x) for x in s["top1"]]})
    decisions = []
    for d in elig:
        c = d["cands"][d["played_idx"]]
        decisions.append({"ply": d["ply"], "move_no": d["move_no"], "san": d["san"], "p_t1": r6(d["p_t1"]),
                          "engine_match": c["sf_rank"] == 1, "engine_first": chess.Board(d["fen"]).san(chess.Move.from_uci(d["sf_lines"][0]["move"])),
                          "maia_p": r6(c["maia_p"])})
    return {"game_id": gid, "color": color, "elo": int(elig[0]["elo"]), "n_decisions": len(elig), "kappa_t1": r6(kappa),
            "formula": "z = (actual - projected) / sqrt(kappa * sum p(1-p)); kappa estimated on validation original games",
            "decisions": decisions, "variants": out_variants,
            "check": "z(top-1) recomputed from the per-decision projections equals the stored value for every variant (|diff| < 1e-6)"}


def calibration_block(decs: dict) -> dict:
    tg = pd.read_parquet(config.INTERIM / "three_model" / "targets_test.parquet", columns=["position_id", "source_game_id"])
    ids = set(tg["position_id"])
    p, y, band = [], [], []
    for gid in sorted(set(tg["source_game_id"])):
        for d in decs[gid]:
            if d["eligible"] and f"{gid}:{d['ply']}" in ids:
                p.append(d["p_t1"]); y.append(float(d["cands"][d["played_idx"]]["sf_rank"] == 1)); band.append(config.elo_band(d["elo"]))
    p, y = np.array(p), np.array(y)
    idx = np.clip((p * 10).astype(int), 0, 9)      # fixed bins of width 0.1 (projections take few distinct values)
    bins = [{"bin": f"{k / 10:.1f}-{(k + 1) / 10:.1f}", "n": int((idx == k).sum()), "projected": r6(p[idx == k].mean()), "actual": r6(y[idx == k].mean())}
            for k in range(10) if (idx == k).sum() >= 30]
    bands = []
    for b in sorted(set(band)):
        m = np.array([x == b for x in band])
        bands.append({"band": b, "n": int(m.sum()), "projected": r6(p[m].mean()), "actual": r6(y[m].mean())})
    return {"n": int(len(p)), "projected_mean": r6(p.mean()), "actual_mean": r6(y.mean()), "by_bin": bins, "by_band": bands,
            "brier": r6(((p - y) ** 2).mean()),
            "note": "Held-out test split, original moves only; the projection table was fitted on training decisions."}


def clean_z_block(te: pd.DataFrame) -> dict:
    z = te.loc[te["level"] == 0, "z_t1"].to_numpy()
    edges = np.arange(-4, 4.01, 0.5)
    return {"n": int(len(z)), "mean": r6(z.mean()), "sd": r6(z.std(ddof=1)),
            "hist_edges": [float(e) for e in edges], "hist": np.histogram(np.clip(z, -3.999, 3.999), edges)[0].tolist(),
            "tails": [{"threshold": t, "observed": r6((z > t).mean()), "count": int((z > t).sum()), "normal": r6(normal_sf(t))} for t in (2.0, 2.5, 3.0)],
            "note": "Source games are presumed human; kappa was calibrated on validation games so that clean z has about unit variance."}


def screening_block(te: pd.DataFrame) -> dict:
    out = []
    for (s, l), g in te.groupby(["strategy", "level"]):
        out.append({"strategy": s, "level": float(l), "n": int(len(g)), "mean_realized_alpha": r6(g["realized_alpha"].mean()),
                    "share_z_gt2": r6((g["z_t1"] > 2).mean()), "share_z_gt3": r6((g["z_t1"] > 3).mean()), "median_z": r6(g["z_t1"].median())})
    return {"rows": out, "note": "Each row: held-out player-games (605 per cell). Substitutions are evaluated in the original positions."}


def qwen_ablation_block(decs: dict) -> dict:
    files = {c: LOCAL / ("scores.jsonl" if c == "regan_aligned" else f"scores_{c}.jsonl") for c in ("regan_aligned", "position_only")}
    if not all(f.exists() for f in files.values()):
        return {"status": "not-evaluated"}
    sc = {}
    for c, f in files.items():
        for line in f.read_text(encoding="utf-8").splitlines():
            r = json.loads(line)
            assert r["model_id"] == QWEN_MODEL_ID and r["revision"] == QWEN_REVISION and r["prompt_hash"] == PROMPT_HASH[c]
            sc.setdefault(r["position_id"], {})[c] = normalize(r["logprob"])
    pool = json.loads((config.ARTIFACTS / "movelens_demo.json").read_text())["pool"]
    pids = sorted(p for p in sc if len(sc[p]) == 2)
    if set(pids) != set(pool):
        return {"status": "not-evaluated", "note": f"position-only scores exist for {len(pids)} of {len(pool)} demo positions"}
    rows = []
    for pid in pids:
        gid, ply = pid.split(":")
        d = next(x for x in decs[gid] if x["ply"] == int(ply))
        b = chess.Board(d["fen"])
        san = lambda m: b.san(chess.Move.from_uci(m))  # noqa: E731
        sf1 = d["sf_lines"][0]["move"]
        M = validate(maia_dist("M", gid, int(ply)), d["fen"], "M")
        row = {"position_id": pid, "played_san": d["san"], "engine_first_san": san(sf1), "maia_top_san": san(max(M, key=lambda k: (M[k], k)))}
        for c in ("regan_aligned", "position_only"):
            Q = validate(sc[pid][c], d["fen"], "Q")
            top = max(Q, key=lambda k: (Q[k], k))
            row[c] = {"top_san": san(top), "top_p": r6(Q[top]), "top_is_engine_first": top == sf1,
                      "p_engine_first": r6(Q[sf1]), "rank_engine_first": rank_of(Q, sf1), "played_rank": rank_of(Q, d["played"]),
                      "played_p": r6(Q[d["played"]]), "maia_rank_of_top": rank_of(M, top)}
        rows.append(row)
    agg = {c: {"top_is_engine_first": sum(r[c]["top_is_engine_first"] for r in rows),
               "median_rank_engine_first": r6(float(np.median([r[c]["rank_engine_first"] for r in rows]))),
               "median_played_rank": r6(float(np.median([r[c]["played_rank"] for r in rows])))} for c in ("regan_aligned", "position_only")}
    rt = LOCAL / "runtime_position_only.json"
    return {"status": "precomputed-local", "n_positions": len(rows), "rows": rows, "summary": agg,
            "runtime_position_only": json.loads(rt.read_text()) if rt.exists() else None,
            "note": f"{len(rows)} demo positions only, scored locally; a qualitative check, not a test."}


def main():
    te = pd.read_parquet(config.ARTIFACTS / "test_predictions.parquet")
    with open(config.PROCESSED / "decisions.pkl", "rb") as fh:
        decs = pickle.load(fh)
    with open(config.PROCESSED / "variant_choices.pkl", "rb") as fh:
        choices = pickle.load(fh)
    kappa = json.loads((config.ARTIFACTS / "projection.json").read_text())["kappa"]["t1"]
    mp = json.loads((config.ARTIFACTS / "three_model_move_prediction.json").read_text())
    out = {
        "schema": "movelens.regan_checks.v1", "generator": SCRIPT, "generated_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "game": game_block(te, decs, choices, kappa),
        "calibration": calibration_block(decs),
        "clean_z": clean_z_block(te),
        "screening": screening_block(te),
        "maia_by_band": mp["models"]["M"]["by_band"],
        "qwen_ablation": qwen_ablation_block(decs),
    }
    txt = json.dumps(out, separators=(",", ":"))
    for p in (config.WEB_DATA / "regan_checks.json", config.ARTIFACTS / "regan_checks.json"):
        p.write_text(txt, encoding="utf-8")
    g, c, z = out["game"], out["calibration"], out["clean_z"]
    v0 = next(v for v in g["variants"] if v["level"] == 0)
    print(f"game {g['game_id']} {g['n_decisions']} decisions: original projected {v0['projected_t1']:.2f} actual {v0['actual_t1']} z {v0['z_t1']:+.2f}")
    print(f"calibration n={c['n']}: projected {c['projected_mean']:.3f} actual {c['actual_mean']:.3f}")
    print(f"clean z: mean {z['mean']:+.3f} sd {z['sd']:.3f} tails {z['tails']}")
    print("qwen ablation:", out["qwen_ablation"]["status"])
    print(f"wrote regan_checks.json ({len(txt) / 1024:.0f} KB)")
    export_local_qwen_raw()


def export_local_qwen_raw():
    """Raw local Qwen3-8B-Base outputs (summed log-probabilities per legal move) + run records, for download/audit."""
    raw = {"schema": "movelens.qwen_local_scores.v1", "generator": SCRIPT,
           "note": "Demo-scope local runs on the MoveLens positions; not a held-out evaluation. Probabilities = softmax of logprob over the legal moves.",
           "conditions": {}}
    for cond, sfx in (("regan_aligned", ""), ("position_only", "_position_only")):
        f, rt = LOCAL / f"scores{sfx}.jsonl", LOCAL / f"runtime{sfx}.json"
        if not f.exists():
            continue
        recs = [json.loads(line) for line in f.read_text(encoding="utf-8").splitlines()]
        for r in recs:
            r.pop("cache_key", None)
        raw["conditions"][cond] = {"prompt_hash": PROMPT_HASH[cond], "runtime": json.loads(rt.read_text()) if rt.exists() else None, "records": recs}
    txt = json.dumps(raw, separators=(",", ":"))
    for p in (config.WEB_DATA / "qwen_local_scores.json", config.ARTIFACTS / "qwen_local_scores.json"):
        p.write_text(txt, encoding="utf-8")
    print(f"wrote qwen_local_scores.json ({len(txt) / 1024:.0f} KB): {[(c, len(v['records'])) for c, v in raw['conditions'].items()]}")


if __name__ == "__main__":
    main()
