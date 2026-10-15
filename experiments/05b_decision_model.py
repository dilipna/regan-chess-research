"""Train the decision-level explanation model (train split only; evaluated on test)."""

from __future__ import annotations

import json
import pickle
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import average_precision_score, roc_auc_score

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services"))
from analyzer import config  # noqa: E402
from analyzer.models.decision_model import DEC_FEATURES, decision_row  # noqa: E402
from analyzer.models.projection import ProjectionModel  # noqa: E402
from analyzer.pipeline import attach_expectations  # noqa: E402

LEVELS_USED = {0.0, 0.2, 0.4}
DM_PARAMS = dict(n_estimators=800, learning_rate=0.05, max_depth=5, subsample=0.8, colsample_bytree=0.8,
                 min_child_weight=10, eval_metric="logloss", early_stopping_rounds=50, tree_method="hist",
                 random_state=config.SEED)


def build(split_name, variants, choices, decs_by_key):
    X, y, strat = [], [], []
    for _, v in variants[(variants["split"] == split_name) & (variants["level"].isin(LEVELS_USED))].iterrows():
        ch = choices[v["variant_id"]]
        decs = decs_by_key[(v["game_id"], v["color"])]
        for d, k, a in zip(decs, ch["choice"], ch["altered"]):
            X.append(decision_row(d, k)); y.append(int(a)); strat.append(v["strategy"])
    return np.array(X), np.array(y), np.array(strat)


def main():
    variants = pd.read_parquet(config.PROCESSED / "variants.parquet")
    with open(config.PROCESSED / "variant_choices.pkl", "rb") as fh:
        choices = pickle.load(fh)
    with open(config.PROCESSED / "decisions.pkl", "rb") as fh:
        all_decs = pickle.load(fh)
    proj = ProjectionModel.load(config.ARTIFACTS / "projection.json")
    decs_by_key = {}
    for gid, ds in all_decs.items():
        el = [d for d in ds if d["eligible"]]
        attach_expectations(el, proj)
        for color in ("white", "black"):
            decs_by_key[(gid, color)] = [d for d in el if d["color"] == color]
    Xtr, ytr, _ = build("train", variants, choices, decs_by_key)
    Xva, yva, _ = build("val", variants, choices, decs_by_key)
    Xte, yte, ste = build("test", variants, choices, decs_by_key)
    print("decision rows", len(ytr), len(yva), len(yte), "pos rate", ytr.mean())
    w = np.where(ytr == 1, 0.5 / ytr.mean(), 0.5 / (1 - ytr.mean()))
    wv = np.where(yva == 1, 0.5 / yva.mean(), 0.5 / (1 - yva.mean()))
    m = xgb.XGBClassifier(**DM_PARAMS)
    m.fit(Xtr, ytr, sample_weight=w, eval_set=[(Xva, yva)], sample_weight_eval_set=[wv], verbose=False)
    p = m.predict_proba(Xte)[:, 1]
    res = {"features": DEC_FEATURES, "levels_used": sorted(LEVELS_USED),
           "test_roc_auc": float(roc_auc_score(yte, p)), "test_pr_auc": float(average_precision_score(yte, p)),
           "test_pos_rate": float(yte.mean()),
           "by_strategy": {s: float(roc_auc_score(yte[(ste == s) | (ste == "none")], p[(ste == s) | (ste == "none")]))
                           for s in config.STRATEGIES}}
    print(json.dumps(res, indent=1))
    with open(config.ARTIFACTS / "decision_model.pkl", "wb") as fh:
        pickle.dump({"model": m, "features": DEC_FEATURES}, fh)
    (config.ARTIFACTS / "decision_model_metrics.json").write_text(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
