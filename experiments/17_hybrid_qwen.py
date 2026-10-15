"""Hybrid extension (P1): System E = existing System D features + Qwen3-8B-Base move-probability features.

Not the main LLM comparison (that is 14_three_model_eval.py). Additive: the A/B/C/D models, predictions
and metrics are read, never refitted or overwritten. E uses exactly the XGBoost hyper-parameters,
balanced weights and validation-only early stopping of 05_train_eval.py; it is trained on TRAIN rows,
early-stopped on VAL rows, and evaluated ONCE on TEST rows. Requires Qwen scores for all three splits.

Qwen features per row (computed from the move evaluated at each eligible decision of that row):
  qwen_mean_surprisal, qwen_mean_rank, qwen_mean_entropy, qwen_excess_surprisal,
  qwen_maia_top1_disagree (share of decisions where Qwen's and Maia-3 5M's top moves differ),
  qwen_maia_abs_logratio (mean |log P_Q(move) - log P_M5(move)|),
  qwen_regan_t1_gap (mean P_Q(engine first move) - projected p_t1),
  qwen_sf_top1_agree (share of decisions where Qwen's top move is Stockfish's first line),
  qwen_mean_p_sfbest (mean P_Q(engine first move))
Outputs: data/artifacts/hybrid_E_results.json, data/artifacts/hybrid_E_test_predictions.parquet
"""

from __future__ import annotations

import importlib.util
import json
import math
import pickle
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import average_precision_score, roc_auc_score

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services"))
from analyzer import config  # noqa: E402
from analyzer.compare.dists import entropy, load_qwen, maia_dist, rank_of, surprisal, top_k  # noqa: E402
from analyzer.features.aggregate import GROUPS  # noqa: E402

HERE = Path(__file__).resolve().parent
SCRIPT = "experiments/17_hybrid_qwen.py"
QF = ["qwen_mean_surprisal", "qwen_mean_rank", "qwen_mean_entropy", "qwen_excess_surprisal", "qwen_maia_top1_disagree",
      "qwen_maia_abs_logratio", "qwen_regan_t1_gap", "qwen_sf_top1_agree", "qwen_mean_p_sfbest"]


def _m05():
    spec = importlib.util.spec_from_file_location("m05", HERE / "05_train_eval.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def qwen_features(rows: pd.DataFrame, choices, decs, Q) -> pd.DataFrame:
    feats = {k: np.empty(len(rows)) for k in QF}
    stats_cache = {}
    for i, vid in enumerate(rows["variant_id"]):
        gid = vid.split(":")[0]
        by = {d["ply"]: d for d in decs[gid]}
        ch = choices[vid]
        acc = {k: [] for k in QF}
        for ply, k in zip(ch["plies"], ch["choice"]):
            pid, d = f"{gid}:{ply}", by[ply]
            mv = d["cands"][k]["move"]
            if pid not in stats_cache:
                q = Q[pid]["prob"]
                m5 = maia_dist("M5", gid, ply)
                sfb = d["sf_lines"][0]["move"]
                stats_cache[pid] = (q, m5, entropy(q), top_k(q, 1)[0][0], top_k(m5, 1)[0][0], sfb, d["p_t1"])
            q, m5, h, qtop, mtop, sfb, pt1 = stats_cache[pid]
            s = surprisal(q[mv])
            acc["qwen_mean_surprisal"].append(s)
            acc["qwen_mean_rank"].append(rank_of(q, mv))
            acc["qwen_mean_entropy"].append(h)
            acc["qwen_excess_surprisal"].append(s - h)
            acc["qwen_maia_top1_disagree"].append(float(qtop != mtop))
            acc["qwen_maia_abs_logratio"].append(abs(math.log(max(q[mv], 1e-6)) - math.log(max(m5[mv], 1e-6))))
            acc["qwen_regan_t1_gap"].append(q[sfb] - pt1)
            acc["qwen_sf_top1_agree"].append(float(qtop == sfb))
            acc["qwen_mean_p_sfbest"].append(q[sfb])
        for k in QF:
            feats[k][i] = float(np.mean(acc[k]))
    return rows.assign(**feats)


def main():
    t0 = time.time()
    Q = {}
    for s in ("train", "val", "test"):
        q = load_qwen("regan_aligned", s)
        if q is None:
            print(f"Qwen3-8B-Base scores for '{s}' are missing -> hybrid extension not run (pending)")
            pending = {"status": "pending", "generator": SCRIPT,
                       "reason": f"Qwen3-8B-Base scores for the '{s}' split do not exist yet; nothing was trained or evaluated."}
            (config.WEB_DATA / "hybrid_E_results.json").write_text(json.dumps(pending, separators=(",", ":")))
            return
        Q.update(q)
    m05 = _m05()
    with open(config.PROCESSED / "decisions.pkl", "rb") as fh:
        decs = pickle.load(fh)
    with open(config.PROCESSED / "variant_choices.pkl", "rb") as fh:
        choices = pickle.load(fh)
    df = pd.read_parquet(config.PROCESSED / "variants.parquet")
    df = qwen_features(df, choices, decs, Q)
    tr, va, te = (df[df["split"] == s].reset_index(drop=True) for s in ("train", "val", "test"))
    featsE = GROUPS["D_sf_maia_seq"] + QF
    clf = xgb.XGBClassifier(**m05.XGB_CLF)
    clf.fit(tr[featsE].to_numpy(float), tr["label"].to_numpy(), sample_weight=m05.balanced_weights(tr["label"].to_numpy()),
            eval_set=[(va[featsE].to_numpy(float), va["label"].to_numpy())],
            sample_weight_eval_set=[m05.balanced_weights(va["label"].to_numpy())], verbose=False)
    sE = clf.predict_proba(te[featsE].to_numpy(float))[:, 1]
    sE_val_neg = clf.predict_proba(va.loc[va["label"] == 0, featsE].to_numpy(float))[:, 1]
    old = pd.read_parquet(config.ARTIFACTS / "test_predictions.parquet", columns=["variant_id", "score_D_sf_maia_seq", "label", "game_id"])
    te = te.merge(old[["variant_id", "score_D_sf_maia_seq"]], on="variant_id", validate="1:1")
    y = te["label"].to_numpy()
    w = m05.balanced_weights(y)
    sD = te["score_D_sf_maia_seq"].to_numpy()
    metrics = json.loads((config.ARTIFACTS / "metrics.json").read_text())
    assert abs(roc_auc_score(y, sD, sample_weight=w) - metrics["experiments"]["D_sf_maia_seq"]["classifier"]["roc_auc"]) < 1e-12
    # paired bootstrap D -> E
    rng = np.random.default_rng(config.SEED + 17)
    games, idx = te["game_id"].unique(), te.groupby("game_id").indices
    d = np.empty(2000)
    for b in range(2000):
        ix = np.concatenate([idx[g] for g in rng.choice(games, len(games), replace=True)])
        yy = y[ix]
        d[b] = roc_auc_score(yy, sE[ix], sample_weight=m05.balanced_weights(yy)) - roc_auc_score(yy, sD[ix], sample_weight=m05.balanced_weights(yy))
    aucE, aucD = roc_auc_score(y, sE, sample_weight=w), roc_auc_score(y, sD, sample_weight=w)
    out = {"status": "ok", "generator": SCRIPT, "generated_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
           "label": "System E-Hybrid (D + Qwen move-probability features) — hybrid extension, not the main LLM comparison",
           "features_added": QF, "n_features": len(featsE), "best_iteration": int(clf.best_iteration),
           "roc_auc": aucE, "pr_auc": float(average_precision_score(y, sE, sample_weight=w)),
           "tpr_at_fpr": [m05.tpr_at_fpr(sE_val_neg, sE, y, f) for f in (0.01, 0.05)],
           "paired_vs_D": {"delta": aucE - aucD, "ci95": [float(np.percentile(d, 2.5)), float(np.percentile(d, 97.5))],
                           "share_le_0": float((d <= 0).mean()), "n_boot": 2000},
           "caveat": "Trained once on train, early-stopped on validation, evaluated once on test; refit variance not captured."}
    (config.ARTIFACTS / "hybrid_E_results.json").write_text(json.dumps(out, indent=1))
    (config.WEB_DATA / "hybrid_E_results.json").write_text(json.dumps(out, separators=(",", ":")))
    te.assign(score_E=sE)[["variant_id", "game_id", "label", "score_E"]].to_parquet(config.ARTIFACTS / "hybrid_E_test_predictions.parquet", index=False)
    print(json.dumps({k: out[k] for k in ("roc_auc", "pr_auc", "paired_vs_D")}, indent=1), f"{time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
