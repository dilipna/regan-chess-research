"""Research figures (SVG + PNG) and ROC-curve data, from real test-set predictions.

Outputs: docs/figures/*.svg|png, apps/web/public/figures/* (downloadable), and
apps/web/public/data/roc_curves.json.
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import matplotlib
import matplotlib.ticker

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from sklearn.metrics import roc_curve  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services"))
from analyzer import config  # noqa: E402

MODELS = {"A0_zt1": ("z(top-1) only", "#9a9a9a", "z_t1"),
          "A_stat": ("Statistical baseline", "#5b5b5b", "score_A_stat"),
          "B_sf": ("Stockfish-XGB", "#2f5d8a", "score_B_sf"),
          "C_sf_maia": ("Stockfish+Maia-XGB", "#b7791f", "score_C_sf_maia"),
          "D_sf_maia_seq": ("Stockfish+Maia+Sequence-XGB", "#9b2c2c", "score_D_sf_maia_seq")}
FIG = config.ROOT / "docs" / "figures"
WEBFIG = config.ROOT / "apps" / "web" / "public" / "figures"

plt.rcParams.update({"font.family": "serif", "font.size": 9, "axes.spines.top": False,
                     "axes.spines.right": False, "axes.linewidth": 0.6, "figure.dpi": 150})


def save(fig, name):
    FIG.mkdir(parents=True, exist_ok=True)
    for ext in ("svg", "png"):
        fig.savefig(FIG / f"{name}.{ext}", bbox_inches="tight")
    plt.close(fig)


def main():
    te = pd.read_parquet(config.ARTIFACTS / "test_predictions.parquet")
    m = json.loads((config.ARTIFACTS / "metrics.json").read_text())
    y = te["label"].to_numpy()
    w = np.where(y == 1, 0.5 / y.mean(), 0.5 / (1 - y.mean()))

    # ROC curves (pooled, balanced weights) + JSON for the web
    curves = {}
    fig, ax = plt.subplots(figsize=(3.6, 3.4))
    for k, (lab, col, colname) in MODELS.items():
        fpr, tpr, _ = roc_curve(y, te[colname], sample_weight=w)
        idx = np.unique(np.r_[np.searchsorted(fpr, np.linspace(0, 1, 120)), len(fpr) - 1].clip(0, len(fpr) - 1))
        curves[k] = {"label": lab, "fpr": fpr[idx].round(4).tolist(), "tpr": tpr[idx].round(4).tolist(),
                     "auc": m["experiments"][k]["classifier"]["roc_auc"]}
        ax.plot(fpr, tpr, color=col, lw=1.1, label=f"{lab} ({curves[k]['auc']:.3f})")
    ax.plot([0, 1], [0, 1], color="#ccc", lw=0.6, ls="--")
    ax.set_xlabel("False-positive rate (clean games)"); ax.set_ylabel("True-positive rate (assisted)")
    ax.legend(frameon=False, fontsize=6.5, loc="lower right"); ax.set_title("Pooled test ROC", fontsize=9)
    save(fig, "roc_pooled")
    (config.WEB_DATA / "roc_curves.json").write_text(json.dumps(curves, separators=(",", ":")))

    # AUC by level, per strategy
    fig, axes = plt.subplots(1, 3, figsize=(8, 2.6), sharey=True)
    for ax, strat in zip(axes, config.STRATEGIES):
        for k, (lab, col, _) in MODELS.items():
            cells = [c for c in m["experiments"][k]["classifier"]["by_cell"] if c["strategy"] == strat]
            cells.sort(key=lambda c: c["level"])
            ax.plot([100 * c["level"] for c in cells], [c["roc_auc"] for c in cells], marker="o", ms=2.5,
                    color=col, lw=1, label=lab)
        ax.set_xscale("log"); ax.set_xticks([5, 10, 20, 40, 70]); ax.set_xticklabels(["5", "10", "20", "40", "70"])
        ax.xaxis.set_minor_formatter(matplotlib.ticker.NullFormatter()); ax.xaxis.set_minor_locator(matplotlib.ticker.NullLocator())
        ax.set_title(strat.upper(), fontsize=8.5); ax.set_xlabel("assistance (%)")
        ax.axhline(0.5, color="#ddd", lw=0.6)
    axes[0].set_ylabel("ROC-AUC (clean vs condition)")
    axes[-1].legend(frameon=False, fontsize=6.5, loc="center left", bbox_to_anchor=(1.02, 0.5))
    save(fig, "auc_by_level")

    # event power
    fig, axes = plt.subplots(1, 3, figsize=(8, 2.6), sharey=True)
    for ax, strat in zip(axes, config.STRATEGIES):
        for k in ("A0_zt1", "A_stat", "D_sf_maia_seq"):
            lab, col, _ = MODELS[k]
            for lvl, ls in ((0.05, ":"), (0.10, "--"), (0.20, "-")):
                rows = sorted([r for r in m["event_power"][k] if r["strategy"] == strat and abs(r["level"] - lvl) < 1e-9],
                              key=lambda r: r["k_games"])
                ax.plot([r["k_games"] for r in rows], [r["roc_auc"] for r in rows], color=col, ls=ls, lw=1,
                        label=f"{lab}, {int(lvl * 100)}%" if strat == "subtle" else None)
        ax.set_title(strat.upper(), fontsize=8.5); ax.set_xlabel("games per pseudo-event (k)")
        ax.set_xticks([1, 3, 5, 9])
    axes[0].set_ylabel("ROC-AUC")
    axes[-1].legend(frameon=False, fontsize=6, loc="center left", bbox_to_anchor=(1.02, 0.5))
    save(fig, "event_power")

    # clean-game z calibration
    cal = m["baseline_calibration"]["z_t1"]
    e = np.array(cal["hist_edges"]); h = np.array(cal["hist"], float)
    fig, ax = plt.subplots(figsize=(3.6, 2.6))
    ax.bar(e[:-1], h / h.sum() / np.diff(e), width=np.diff(e), align="edge", color="#2f5d8a", alpha=0.55, lw=0)
    xs = np.linspace(-5, 5, 300)
    ax.plot(xs, np.exp(-xs ** 2 / 2) / np.sqrt(2 * np.pi), color="#222", lw=0.9, label="N(0,1)")
    ax.set_xlabel("z(top-1) on held-out clean games"); ax.set_ylabel("density")
    ax.set_title(f"Baseline calibration (n={cal['n']}, mean {cal['mean']:.2f}, sd {cal['std']:.2f})", fontsize=8)
    ax.legend(frameon=False, fontsize=7)
    save(fig, "baseline_calibration")

    # regression
    fig, ax = plt.subplots(figsize=(3.6, 3.2))
    for k in ("A_stat", "C_sf_maia", "D_sf_maia_seq"):
        lab, col, _ = MODELS[k]
        rows = m["experiments"][k]["regressor"]["by_level"]
        ax.plot([r["mean_true"] for r in rows], [r["mean_estimate"] for r in rows], marker="o", ms=3, color=col,
                lw=1, label=f"{lab} (MAE {m['experiments'][k]['regressor']['mae']:.3f})")
    ax.plot([0, 0.7], [0, 0.7], color="#ccc", lw=0.6, ls="--")
    ax.set_xlabel("mean realized assistance"); ax.set_ylabel("mean synthetic-equivalent estimate")
    ax.legend(frameon=False, fontsize=6)
    save(fig, "regression_by_level")

    WEBFIG.mkdir(parents=True, exist_ok=True)
    for f in FIG.glob("*"):
        shutil.copy(f, WEBFIG / f.name)
    print("figures:", sorted(p.name for p in FIG.glob("*.svg")))


if __name__ == "__main__":
    main()
