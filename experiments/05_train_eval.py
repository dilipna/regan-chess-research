"""Train and evaluate the four nested experiments on the leakage-safe split.

Experiments (nested feature groups, see analyzer/features/aggregate.py):
  A0  z_t1 alone (Regan-inspired statistic, no training on labels)
  A   logistic regression / ridge on aggregate statistics
  B   XGBoost on A + Stockfish aggregates
  C   XGBoost on B + Maia-3 aggregates
  D   XGBoost on C + sequence / criticality features
Tasks:
  classifier : clean (level 0) vs controlled-assisted (level > 0)
  regressor  : realized assistance fraction -> "synthetic-equivalent assistance estimate"
All hyper-parameters are fixed in advance; early stopping uses the validation split only.
Every number written to metrics.json is computed here from model outputs on the TEST split.
"""

from __future__ import annotations

import json
import pickle
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
import shap
import xgboost as xgb
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import (average_precision_score, brier_score_loss, mean_absolute_error,
                             mean_squared_error, roc_auc_score)
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services"))
from analyzer import config  # noqa: E402
from analyzer.features.aggregate import GROUPS  # noqa: E402

EXPS = {
    "A_stat": {"label": "Statistical baseline", "short": "Baseline", "kind": "linear"},
    "B_sf": {"label": "Stockfish-XGB", "short": "+ nonlinear engine", "kind": "xgb"},
    "C_sf_maia": {"label": "Stockfish+Maia-XGB", "short": "+ human model", "kind": "xgb"},
    "D_sf_maia_seq": {"label": "Stockfish+Maia+Sequence-XGB", "short": "+ sequence/criticality", "kind": "xgb"},
}
FPRS = [0.01, 0.05]
RNG = np.random.default_rng(config.SEED)
XGB_CLF = dict(n_estimators=1500, learning_rate=0.03, max_depth=4, subsample=0.8, colsample_bytree=0.8,
               min_child_weight=5, reg_lambda=1.0, eval_metric="logloss", early_stopping_rounds=100,
               tree_method="hist", random_state=config.SEED)
XGB_REG = dict(n_estimators=1500, learning_rate=0.03, max_depth=4, subsample=0.8, colsample_bytree=0.8,
               min_child_weight=5, reg_lambda=1.0, eval_metric="mae", early_stopping_rounds=100,
               tree_method="hist", random_state=config.SEED)


def balanced_weights(y: np.ndarray) -> np.ndarray:
    pos, neg = y.sum(), len(y) - y.sum()
    return np.where(y == 1, 0.5 / pos, 0.5 / neg) * len(y)


def tpr_at_fpr(neg_val: np.ndarray, test_scores: np.ndarray, y_test: np.ndarray, fpr: float) -> dict:
    """Threshold chosen on VALIDATION clean scores; TPR / realized FPR measured on TEST."""
    thr = float(np.quantile(neg_val, 1 - fpr))
    pos = test_scores[y_test == 1]
    neg = test_scores[y_test == 0]
    return {"target_fpr": fpr, "threshold": thr, "tpr": float((pos > thr).mean()),
            "test_fpr": float((neg > thr).mean())}


def calib_bins(y, p, w, n=10):
    edges = np.linspace(0, 1, n + 1)
    out = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (p >= lo) & (p < hi if hi < 1 else p <= hi)
        if m.sum() == 0:
            continue
        out.append({"bin_lo": lo, "bin_hi": hi, "mean_pred": float(np.average(p[m], weights=w[m])),
                    "frac_pos": float(np.average(y[m], weights=w[m])), "n": int(m.sum())})
    return out


def cluster_bootstrap_auc(df_test: pd.DataFrame, score: np.ndarray, n_boot=200) -> tuple[float, float]:
    """95% CI of balanced-weight ROC-AUC, resampling source games (clusters)."""
    games = df_test["game_id"].unique()
    idx_by_game = df_test.groupby("game_id").indices
    y = df_test["label"].to_numpy()
    aucs = []
    for _ in range(n_boot):
        pick = RNG.choice(games, len(games), replace=True)
        ix = np.concatenate([idx_by_game[g] for g in pick])
        yy = y[ix]
        if yy.min() == yy.max():
            continue
        aucs.append(roc_auc_score(yy, score[ix], sample_weight=balanced_weights(yy)))
    return float(np.percentile(aucs, 2.5)), float(np.percentile(aucs, 97.5))


def fit_classifier(name, feats, tr, va):
    Xtr, ytr = tr[feats].to_numpy(float), tr["label"].to_numpy()
    Xva, yva = va[feats].to_numpy(float), va["label"].to_numpy()
    if EXPS[name]["kind"] == "linear":
        m = make_pipeline(StandardScaler(), LogisticRegression(max_iter=5000, C=1.0))
        m.fit(Xtr, ytr, logisticregression__sample_weight=balanced_weights(ytr))
        return m
    m = xgb.XGBClassifier(**XGB_CLF)
    m.fit(Xtr, ytr, sample_weight=balanced_weights(ytr), eval_set=[(Xva, yva)],
          sample_weight_eval_set=[balanced_weights(yva)], verbose=False)
    return m


def fit_regressor(name, feats, tr, va):
    Xtr, ytr = tr[feats].to_numpy(float), tr["realized_alpha"].to_numpy()
    if EXPS[name]["kind"] == "linear":
        m = make_pipeline(StandardScaler(), Ridge(alpha=1.0))
        m.fit(Xtr, ytr)
        return m
    m = xgb.XGBRegressor(objective="reg:squarederror", **XGB_REG)
    m.fit(Xtr, ytr, eval_set=[(va[feats].to_numpy(float), va["realized_alpha"].to_numpy())], verbose=False)
    return m


def predict_score(m, X):
    return m.predict_proba(X)[:, 1]


def cell_metrics(te: pd.DataFrame, score: np.ndarray) -> list[dict]:
    """Clean test player-games vs each (strategy, level) cell of test variants."""
    out = []
    clean = te["level"] == 0
    for (strat, lvl), g in te[~clean].groupby(["strategy", "level"]):
        m = clean | ((te["strategy"] == strat) & (te["level"] == lvl))
        y = te.loc[m, "label"].to_numpy()
        s = score[m.to_numpy()]
        out.append({"strategy": strat, "level": lvl, "n_pos": int(y.sum()), "n_neg": int((1 - y).sum()),
                    "roc_auc": float(roc_auc_score(y, s)), "pr_auc": float(average_precision_score(y, s)),
                    "mean_realized_alpha": float(te.loc[m & (te["label"] == 1), "realized_alpha"].mean())})
    return out


def event_power(te: pd.DataFrame, score: np.ndarray, ks=(1, 3, 5, 9), n_events=2000) -> list[dict]:
    """Pseudo-events: k test player-games of one Elo band, either all clean or all assisted with the
    same (strategy, level). Event score = mean of per-game scores. Reports ROC-AUC vs k."""
    te = te.assign(_s=score)
    out = []
    for strat in config.STRATEGIES:
        for lvl in (0.05, 0.10, 0.20):
            for k in ks:
                pos_s, neg_s = [], []
                for band, gb in te.groupby("band"):
                    cl = gb.loc[gb["level"] == 0, "_s"].to_numpy()
                    asg = gb.loc[(gb["strategy"] == strat) & (gb["level"] == lvl), "_s"].to_numpy()
                    if len(cl) < k or len(asg) < k:
                        continue
                    n_b = max(1, n_events // 4)
                    neg_s += [RNG.choice(cl, k, replace=False).mean() for _ in range(n_b)]
                    pos_s += [RNG.choice(asg, k, replace=False).mean() for _ in range(n_b)]
                if pos_s:
                    y = np.r_[np.ones(len(pos_s)), np.zeros(len(neg_s))]
                    out.append({"strategy": strat, "level": lvl, "k_games": k,
                                "roc_auc": float(roc_auc_score(y, np.r_[pos_s, neg_s]))})
    return out


def main():
    t0 = time.time()
    df = pd.read_parquet(config.PROCESSED / "variants.parquet")
    tr, va, te = (df[df["split"] == s].reset_index(drop=True) for s in ("train", "val", "test"))
    # leakage assertion (also covered by tests/)
    for a, b in (("train", "val"), ("train", "test"), ("val", "test")):
        ga = set(df.loc[df["split"] == a, "game_id"]); gb = set(df.loc[df["split"] == b, "game_id"])
        assert not (ga & gb), f"game leakage {a}/{b}"
        pa = set(df.loc[df["split"] == a, "player"].str.lower()); pb = set(df.loc[df["split"] == b, "player"].str.lower())
        assert not (pa & pb), f"player leakage {a}/{b}"
    print({s: len(x) for s, x in (("train", tr), ("val", va), ("test", te))})

    ART = config.ARTIFACTS
    results = {"dataset": {
        "n_variants": {"train": len(tr), "val": len(va), "test": len(te)},
        "n_player_games": {s: int((x["level"] == 0).sum()) for s, x in (("train", tr), ("val", va), ("test", te))},
        "n_source_games": {s: int(x["game_id"].nunique()) for s, x in (("train", tr), ("val", va), ("test", te))},
        "mean_decisions_per_player_game": float(df.loc[df["level"] == 0, "n_dec"].mean()),
        "bands_test": te.loc[te["level"] == 0, "band"].value_counts().to_dict(),
        "levels": config.ASSIST_LEVELS, "strategies": config.STRATEGIES,
    }, "experiments": {}}

    # calibration of the Regan-inspired z statistics on held-out CLEAN games (should be ~N(0,1))
    te_clean = te[te["level"] == 0]
    edges = np.linspace(-5, 5, 41)
    results["baseline_calibration"] = {
        z: {"mean": float(te_clean[z].mean()), "std": float(te_clean[z].std()),
            "frac_gt2": float((te_clean[z] > 2).mean()), "frac_gt3": float((te_clean[z] > 3).mean()),
            "normal_frac_gt2": 0.02275, "normal_frac_gt3": 0.00135,
            "hist_edges": edges.tolist(), "hist": np.histogram(te_clean[z].clip(-5, 5), edges)[0].tolist(),
            "n": int(len(te_clean))}
        for z in ["z_t1", "z_t3", "z_loss", "z_t1_hard", "z_maia"]}

    y_te = te["label"].to_numpy()
    w_te = balanced_weights(y_te)
    test_scores = {}

    # A0: raw statistic, no training
    s0 = te["z_t1"].to_numpy()
    results["experiments"]["A0_zt1"] = {
        "label": "z(top-1) statistic only", "features": ["z_t1"], "n_features": 1,
        "classifier": {
            "roc_auc": float(roc_auc_score(y_te, s0, sample_weight=w_te)),
            "pr_auc": float(average_precision_score(y_te, s0, sample_weight=w_te)),
            "tpr_at_fpr": [tpr_at_fpr(va.loc[va["label"] == 0, "z_t1"].to_numpy(), s0, y_te, f) for f in FPRS],
            "by_cell": cell_metrics(te, s0),
        }}
    test_scores["A0_zt1"] = s0

    models = {}
    for name, meta in EXPS.items():
        feats = GROUPS[name]
        clf = fit_classifier(name, feats, tr, va)
        reg = fit_regressor(name, feats, tr, va)
        models[name] = (clf, reg)
        X_te = te[feats].to_numpy(float)
        s = predict_score(clf, X_te)
        s_val_neg = predict_score(clf, va.loc[va["label"] == 0, feats].to_numpy(float))
        alpha_hat = np.clip(reg.predict(X_te), 0, 1)
        test_scores[name] = s
        lo, hi = cluster_bootstrap_auc(te, s)
        res = {
            "label": meta["label"], "short": meta["short"], "features": feats, "n_features": len(feats),
            "model": "LogisticRegression / Ridge" if meta["kind"] == "linear" else "XGBoost",
            "classifier": {
                "roc_auc": float(roc_auc_score(y_te, s, sample_weight=w_te)),
                "roc_auc_ci95": [lo, hi],
                "pr_auc": float(average_precision_score(y_te, s, sample_weight=w_te)),
                "brier": float(brier_score_loss(y_te, s, sample_weight=w_te)),
                "tpr_at_fpr": [tpr_at_fpr(s_val_neg, s, y_te, f) for f in FPRS],
                "calibration": calib_bins(y_te, s, w_te),
                "by_cell": cell_metrics(te, s),
                "by_band": [
                    {"band": b, "roc_auc": float(roc_auc_score(te.loc[m, "label"], s[m.to_numpy()],
                                                               sample_weight=balanced_weights(te.loc[m, "label"].to_numpy())))}
                    for b in sorted(te["band"].unique()) for m in [te["band"] == b]
                ],
                "best_iteration": int(getattr(clf, "best_iteration", -1) or -1) if meta["kind"] == "xgb" else None,
            },
            "regressor": {
                "mae": float(mean_absolute_error(te["realized_alpha"], alpha_hat)),
                "rmse": float(np.sqrt(mean_squared_error(te["realized_alpha"], alpha_hat))),
                "by_level": [{"level": float(l), "mae": float(mean_absolute_error(g["realized_alpha"], alpha_hat[g.index])),
                              "mean_estimate": float(alpha_hat[g.index].mean()),
                              "mean_true": float(g["realized_alpha"].mean())}
                             for l, g in te.groupby("level")],
                "by_strategy": [{"strategy": st, "mae": float(mean_absolute_error(g["realized_alpha"], alpha_hat[g.index]))}
                                for st, g in te.groupby("strategy")],
            },
        }
        results["experiments"][name] = res
        te[f"score_{name}"] = s
        te[f"alpha_{name}"] = alpha_hat
        print(f"{name:16s} AUC {res['classifier']['roc_auc']:.3f} [{lo:.3f},{hi:.3f}]  "
              f"PR {res['classifier']['pr_auc']:.3f}  TPR@5% {res['classifier']['tpr_at_fpr'][1]['tpr']:.3f}  "
              f"MAE {res['regressor']['mae']:.4f}", flush=True)

    # reference distribution of scores on VALIDATION clean player-games (for percentiles in reports)
    va_clean = va[va["label"] == 0]
    ref = {"A0_zt1": np.quantile(va_clean["z_t1"], np.linspace(0, 1, 201)).tolist()}
    for name in EXPS:
        sc = predict_score(models[name][0], va_clean[GROUPS[name]].to_numpy(float))
        ref[name] = np.quantile(sc, np.linspace(0, 1, 201)).tolist()
    (ART / "reference_scores.json").write_text(json.dumps(ref))

    # event-level power (Regan aggregates over many games; we show how evidence accumulates)
    results["event_power"] = {n: event_power(te, test_scores[n]) for n in ["A0_zt1", "A_stat", "D_sf_maia_seq"]}

    # SHAP for the full model (classifier + regressor)
    feats = GROUPS["D_sf_maia_seq"]
    clf, reg = models["D_sf_maia_seq"]
    X_te = te[feats].to_numpy(float)
    sv = shap.TreeExplainer(clf).shap_values(X_te)
    sv_r = shap.TreeExplainer(reg).shap_values(X_te)
    results["shap_global"] = {
        "classifier": sorted([{"feature": f, "mean_abs": float(np.abs(sv[:, i]).mean())} for i, f in enumerate(feats)],
                             key=lambda r: -r["mean_abs"]),
        "regressor": sorted([{"feature": f, "mean_abs": float(np.abs(sv_r[:, i]).mean())} for i, f in enumerate(feats)],
                            key=lambda r: -r["mean_abs"]),
    }
    # gain from human model, also for C
    clfC = models["C_sf_maia"][0]
    svC = shap.TreeExplainer(clfC).shap_values(te[GROUPS["C_sf_maia"]].to_numpy(float))
    results["shap_global"]["classifier_C"] = sorted(
        [{"feature": f, "mean_abs": float(np.abs(svC[:, i]).mean())} for i, f in enumerate(GROUPS["C_sf_maia"])],
        key=lambda r: -r["mean_abs"])

    ART.mkdir(parents=True, exist_ok=True)
    for name, (clf, reg) in models.items():
        with open(ART / f"model_{name}.pkl", "wb") as fh:
            pickle.dump({"clf": clf, "reg": reg, "features": GROUPS[name]}, fh)
    te.to_parquet(ART / "test_predictions.parquet", index=False)
    results["elapsed_s"] = time.time() - t0
    (ART / "metrics.json").write_text(json.dumps(results, indent=1))
    print(f"wrote metrics.json ({time.time() - t0:.0f}s)")


if __name__ == "__main__":
    main()
