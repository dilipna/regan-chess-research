"""Export precomputed JSON for the web app (works with zero backend).

Demo selection rule (not cherry-picked on model output):
  among TEST-split clean player-games in the 1800-2199 band with >= 28 eligible decisions,
  take the one whose baseline z(top-1) is closest to the median of that group.
Demos are three versions of that same player-game:
  1. human-baseline       : the original human moves (0%)
  2. obvious-assistance   : RANDOM strategy, 40%
  3. selective-critical   : SELECTIVE strategy, 20%
Simulator: 8 test player-games (2 per Elo band, seeded random choice among n_dec >= 25) plus the
demo game, with all 16 precomputed variants and the real test-set scores of every model.
"""

from __future__ import annotations

import json
import pickle
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services"))
from analyzer import config  # noqa: E402
from analyzer.aif.export import report_to_aif  # noqa: E402
from analyzer.report import game_report, load_artifacts  # noqa: E402

OUT = config.WEB_DATA
MODELS = ["A_stat", "B_sf", "C_sf_maia", "D_sf_maia_seq"]


def _clean(o):
    """JSON-safe: NaN -> None, numpy -> python."""
    if isinstance(o, dict):
        return {str(k): _clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_clean(v) for v in o]
    if isinstance(o, (np.floating, float)):
        f = float(o)
        return None if f != f or f in (float("inf"), float("-inf")) else round(f, 6)
    if isinstance(o, np.integer):
        return int(o)
    if isinstance(o, np.bool_):
        return bool(o)
    return o


def dump(name, obj):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(_clean(obj), separators=(",", ":")))
    print("wrote", name, f"{(OUT / name).stat().st_size / 1024:.0f} KB")


def main():
    art = load_artifacts()
    games = {json.loads(l)["game_id"]: json.loads(l)
             for l in (config.INTERIM / "games.jsonl").read_text(encoding="utf-8").splitlines()}
    with open(config.PROCESSED / "decisions.pkl", "rb") as fh:
        all_decs = pickle.load(fh)
    with open(config.PROCESSED / "variant_choices.pkl", "rb") as fh:
        choices = pickle.load(fh)
    te = pd.read_parquet(config.ARTIFACTS / "test_predictions.parquet")
    sf_meta = json.loads(next((config.INTERIM / "sf").glob("*.json")).read_text())
    maia_meta = json.loads(next((config.INTERIM / "maia").glob("*.json")).read_text())
    analysis_meta = {"engine": sf_meta["engine"], "depth": sf_meta["depth"], "multipv": sf_meta["multipv"],
                     "maia_model": maia_meta["model"]}

    clean = te[te["level"] == 0]
    grp = clean[(clean["band"] == "1800-2199") & (clean["n_dec"] >= 28)]
    med = grp["z_t1"].median()
    pick = grp.iloc[(grp["z_t1"] - med).abs().argsort().iloc[0]]
    gid, color = pick["game_id"], pick["color"]
    print("demo player-game:", gid, color, "z_t1", pick["z_t1"], "n_dec", pick["n_dec"])

    demos = [("human-baseline", "Original game (no injected assistance)", "none", 0.0),
             ("obvious-assistance", "Random substitution (heavy)", "random", 0.40),
             ("selective-critical", "Selective substitution in hard positions", "selective", 0.20)]
    index = []
    for did, title, strat, lvl in demos:
        vid = f"{gid}:{color}:{strat}:{int(round(lvl * 100))}"
        ch = choices[vid]
        syn = None
        if strat != "none":
            syn = {"strategy": strat, "level": lvl, "color": color,
                   "realized_alpha": float(te.loc[te["variant_id"] == vid, "realized_alpha"].iloc[0]),
                   "choice_by_ply": dict(zip(ch["plies"], ch["choice"]))}
        rep = game_report(art, games[gid], all_decs[gid], report_id=did, title=title, kind="demo",
                          focus=color, synthetic=syn, anonymize=True, analysis_meta=analysis_meta)
        rep["selection_rule"] = ("Test-split player-game, 1800-2199 band, >= 28 eligible decisions, baseline "
                                 "z(top-1) closest to the group median. Not selected on model output.")
        dump(f"demo-{did}.json", rep)
        (OUT / f"demo-{did}.aif").write_text(report_to_aif(_clean(rep), color), encoding="utf-8")
        p = rep["players"][color]
        index.append({"id": did, "title": title, "strategy": strat, "level": lvl,
                      "realized_alpha": syn["realized_alpha"] if syn else 0.0,
                      "scores": p.get("scores"), "alpha_estimate": p.get("alpha_estimate"),
                      "n_decisions": p["n_decisions"], "elo": p["elo"]})
    dump("demos.json", {"demos": index, "color": color})

    # ---- simulator
    rng = np.random.default_rng(config.SEED)
    sel = [(gid, color)]
    for band in sorted(clean["band"].unique()):
        cands = clean[(clean["band"] == band) & (clean["n_dec"] >= 25)]
        for i in rng.choice(len(cands), min(2, len(cands)), replace=False):
            key = (cands.iloc[i]["game_id"], cands.iloc[i]["color"])
            if key not in sel:
                sel.append(key)
    sims = []
    for k, (g, c) in enumerate(sel):
        rows = te[(te["game_id"] == g) & (te["color"] == c)]
        decs = [d for d in all_decs[g] if d["eligible"] and d["color"] == c]
        variants = []
        for _, r in rows.iterrows():
            ch = choices[r["variant_id"]]
            variants.append({
                "strategy": r["strategy"], "level": r["level"], "realized_alpha": r["realized_alpha"],
                "n_altered": int(r["n_altered"]),
                "altered_plies": [p for p, a in zip(ch["plies"], ch["altered"]) if a],
                "z_t1": r["z_t1"], "t1_rate": r["t1_rate"], "mean_loss": r["mean_loss"],
                "mean_surprisal": r["mean_surprisal"], "crit_lift": r["crit_lift"],
                "scores": {m: r[f"score_{m}"] for m in MODELS},
                "alpha_estimate": {m: r[f"alpha_{m}"] for m in MODELS},
            })
        sims.append({
            "key": f"pg{k + 1}", "label": f"Player-game {k + 1}" + (" (demo game)" if k == 0 else ""),
            "elo": int(decs[0]["elo"]), "opp_elo": int(decs[0]["opp_elo"]), "band": rows["band"].iloc[0],
            "color": c, "n_decisions": len(decs),
            "decisions": [{"ply": d["ply"], "move_no": d["move_no"], "difficulty": d["difficulty"],
                           "human_top1": d["played_idx"] == 0} for d in decs],
            "variants": variants,
        })
    ref = json.loads((config.ARTIFACTS / "reference_scores.json").read_text())
    dump("simulator.json", {"player_games": sims, "levels": config.ASSIST_LEVELS,
                            "strategies": config.STRATEGIES, "reference_val_clean": ref})

    # ---- metrics for the comparison lab
    metrics = json.loads((config.ARTIFACTS / "metrics.json").read_text())
    dm = json.loads((config.ARTIFACTS / "decision_model_metrics.json").read_text())
    proj = json.loads((config.ARTIFACTS / "projection.json").read_text())
    metrics["decision_model"] = dm
    metrics["projection"] = {"kappa": proj["kappa"], "hard_threshold": proj["hard_threshold"],
                             "easy_threshold": proj["easy_threshold"], "n_cells": sum(1 for k in proj["table"] if not k.startswith("pooled|"))}
    metrics["analysis"] = analysis_meta
    metrics["config"] = {
        "opening_skip_plies": config.OPENING_SKIP_PLIES, "decided_eval_cp": config.DECIDED_EVAL_CP,
        "near_optimal_cp": config.NEAR_OPTIMAL_CP, "subtle_max_loss_cp": config.SUBTLE_MAX_LOSS_CP,
        "prefilter_depth": config.SF_PREFILTER_DEPTH, "prefilter_decided_cp": config.SF_PREFILTER_DECIDED_CP,
        "split_fractions": config.SPLIT_FRACTIONS, "seed": config.SEED, "levels": config.ASSIST_LEVELS,
        "eval_cap_cp": config.EVAL_CAP_CP, "max_analyzed_ply": config.MAX_ANALYZED_PLY,
    }
    # exact hyper-parameters and versions (read from the training scripts / installed packages)
    import importlib.util, platform, sklearn, xgboost, shap as _shap, torch, chess as _chess

    def _mod(name):
        spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + ".py"))
        mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
        return mod
    m05, m05b = _mod("05_train_eval"), _mod("05b_decision_model")
    from analyzer.features.aggregate import GROUPS, LOW_HUMAN_P, ROLL_W
    from analyzer.pipeline import MIN_DECISIONS
    metrics["hyperparameters"] = {
        "xgb_classifier": m05.XGB_CLF, "xgb_regressor": {**m05.XGB_REG, "objective": "reg:squarederror"},
        "baseline_classifier": "StandardScaler + LogisticRegression(C=1.0, max_iter=5000), balanced sample weights",
        "baseline_regressor": "StandardScaler + Ridge(alpha=1.0)",
        "decision_model": m05b.DM_PARAMS, "decision_model_levels": sorted(m05b.LEVELS_USED),
        "class_weighting": "balanced: each class carries half of the total sample weight",
        "early_stopping": "validation split only", "bootstrap": "200 resamples of test source games (cluster bootstrap)",
        "rolling_window": ROLL_W, "low_human_likelihood": LOW_HUMAN_P, "min_decisions_per_player_game": MIN_DECISIONS,
        "projection_min_cell": 30, "loss_cap_cp": 300,
    }
    metrics["feature_groups"] = GROUPS
    metrics["versions"] = {
        "python": platform.python_version(), "xgboost": xgboost.__version__, "scikit_learn": sklearn.__version__,
        "shap": _shap.__version__, "torch": torch.__version__.split("+")[0], "python_chess": _chess.__version__,
        "maia3_commit": "1e13597c42d4858b7cfd7cfdae01e297263364b2", "maia3_checkpoint": "UofTCSSLab/Maia3-5M",
        "data": "Lichess open database, standard rated, August 2026 (first ~420 MB of the dump)",
    }
    # per-game test score distribution (clean vs assisted) for histograms
    hist = {}
    for m in MODELS:
        edges = np.linspace(0, 1, 26)
        hist[m] = {"edges": edges.tolist(),
                   "clean": np.histogram(te.loc[te["level"] == 0, f"score_{m}"], edges)[0].tolist(),
                   "by_level": {str(l): np.histogram(te.loc[te["level"] == l, f"score_{m}"], edges)[0].tolist()
                                for l in config.ASSIST_LEVELS[1:]}}
    metrics["score_histograms"] = hist
    # paired AUC differences (experiments/09_paired_bootstrap.py), if computed
    pb = config.ARTIFACTS / "paired_bootstrap.json"
    if pb.exists():
        metrics["paired_auc_bootstrap"] = json.loads(pb.read_text())
    dump("metrics.json", metrics)


if __name__ == "__main__":
    main()
