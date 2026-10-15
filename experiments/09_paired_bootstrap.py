"""Paired source-game cluster bootstrap for incremental ROC-AUC differences (post hoc, test split only).

Uses ONLY the saved held-out predictions in data/artifacts/test_predictions.parquet (written by
05_train_eval.py). No model is refitted, no threshold is chosen, nothing is tuned on test data.

Method
  * Cluster = source game (game_id). A source game contributes both players' player-games and all
    16 variants of each (clean original + 3 strategies x 5 levels), so variants of the same game are
    never split across resamples.
  * Each resample draws the 321 test source games with replacement; the SAME resample is used for every
    model, so each difference is paired.
  * Within a resample: balanced-weight ROC-AUC (same weighting as 05_train_eval.py) for every model,
    then the difference for each comparison.
  * Reported: point difference on the full test split, 2.5/97.5 percentiles of the bootstrap
    differences, and the share of resamples with difference <= 0 (descriptive, not a p-value).
  * The script first checks that the saved predictions reproduce the exported ROC-AUC values and
    aborts otherwise.

Writes data/artifacts/paired_bootstrap.json and merges the same object into
apps/web/public/data/metrics.json under "paired_auc_bootstrap" (no other key is touched).
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services"))
from analyzer import config  # noqa: E402

N_BOOT = 2000
SEED = config.SEED + 9  # distinct stream from the per-model bootstrap in 05_train_eval.py
SCORE_COL = {"A0_zt1": "z_t1", "A_stat": "score_A_stat", "B_sf": "score_B_sf",
             "C_sf_maia": "score_C_sf_maia", "D_sf_maia_seq": "score_D_sf_maia_seq"}
COMPARISONS = [("A0_zt1", "A_stat"), ("A_stat", "B_sf"), ("B_sf", "C_sf_maia"), ("C_sf_maia", "D_sf_maia_seq"),
               ("A_stat", "C_sf_maia"), ("A_stat", "D_sf_maia_seq"), ("B_sf", "D_sf_maia_seq")]


def balanced_weights(y: np.ndarray) -> np.ndarray:
    pos, neg = y.sum(), len(y) - y.sum()
    return np.where(y == 1, 0.5 / pos, 0.5 / neg) * len(y)


def auc(y: np.ndarray, s: np.ndarray) -> float:
    return float(roc_auc_score(y, s, sample_weight=balanced_weights(y)))


def main():
    t0 = time.time()
    te = pd.read_parquet(config.ARTIFACTS / "test_predictions.parquet")
    metrics = json.loads((config.ARTIFACTS / "metrics.json").read_text())
    y = te["label"].to_numpy()
    scores = {k: te[c].to_numpy(dtype=float) for k, c in SCORE_COL.items()}

    full = {k: auc(y, s) for k, s in scores.items()}
    for k, v in full.items():
        exported = metrics["experiments"][k]["classifier"]["roc_auc"]
        assert abs(v - exported) < 1e-9, f"{k}: saved predictions give {v}, export says {exported}"

    games = te["game_id"].unique()
    idx_by_game = te.groupby("game_id").indices
    rng = np.random.default_rng(SEED)
    boot = {k: np.empty(N_BOOT) for k in scores}
    for b in range(N_BOOT):
        pick = rng.choice(games, len(games), replace=True)
        ix = np.concatenate([idx_by_game[g] for g in pick])
        yy = y[ix]
        for k, s in scores.items():
            boot[k][b] = auc(yy, s[ix])

    rows = []
    for a, b in COMPARISONS:
        d = boot[b] - boot[a]
        rows.append({"from": a, "to": b, "delta": full[b] - full[a],
                     "ci95": [float(np.percentile(d, 2.5)), float(np.percentile(d, 97.5))],
                     "share_le_0": float((d <= 0).mean())})
        print(f"{a:>14} -> {b:<14} dAUC {rows[-1]['delta']:+.4f}  95% [{rows[-1]['ci95'][0]:+.4f}, "
              f"{rows[-1]['ci95'][1]:+.4f}]  share<=0 {rows[-1]['share_le_0']:.4f}")

    ds = metrics["dataset"]
    out = {
        "method": ("Paired cluster bootstrap over test source games (resampled with replacement; the same resample "
                   "for every model). Balanced-weight ROC-AUC as in the main evaluation. Percentile 95% interval of "
                   "the paired difference. Post hoc analysis of saved held-out predictions; no refitting or tuning."),
        "n_boot": N_BOOT, "seed": SEED, "cluster": "game_id (source game)",
        "n_clusters": int(len(games)), "n_rows": int(len(te)),
        "n_player_games": int(ds["n_player_games"]["test"]), "n_positive_rows": int(y.sum()),
        "source": "data/artifacts/test_predictions.parquet",
        "reproduced_auc": full, "comparisons": rows,
        "generated_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    (config.ARTIFACTS / "paired_bootstrap.json").write_text(json.dumps(out, indent=1))
    web = config.WEB_DATA / "metrics.json"
    wm = json.loads(web.read_text())
    wm["paired_auc_bootstrap"] = out
    web.write_text(json.dumps(wm, separators=(",", ":")))
    print(f"wrote paired_bootstrap.json and merged into web metrics ({time.time() - t0:.0f}s)")


if __name__ == "__main__":
    main()
