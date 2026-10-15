"""Generate docs/RESULTS.md from data/artifacts/metrics.json (no hand-typed numbers)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services"))
from analyzer import config  # noqa: E402

ORDER = ["A0_zt1", "A_stat", "B_sf", "C_sf_maia", "D_sf_maia_seq"]


def f3(x):
    return "—" if x is None else f"{x:.3f}"


def main():
    m = json.loads((config.ARTIFACTS / "metrics.json").read_text())
    dm = json.loads((config.ARTIFACTS / "decision_model_metrics.json").read_text())
    ds = m["dataset"]
    L = ["# Results (generated from `data/artifacts/metrics.json`)", "",
         "All numbers below are computed on the held-out TEST split (source games and players disjoint "
         "from training and validation). Classifier: original (0%) vs substituted (5–70%) player-games (controlled decision-level substitutions), "
         "with balanced class weighting. TPR thresholds are chosen on VALIDATION original games.", "",
         f"- Source games: train {ds['n_source_games']['train']}, val {ds['n_source_games']['val']}, "
         f"test {ds['n_source_games']['test']}",
         f"- Original player-games: train {ds['n_player_games']['train']}, val {ds['n_player_games']['val']}, "
         f"test {ds['n_player_games']['test']}",
         f"- Rows incl. originals (player-games x 16 conditions): train {ds['n_variants']['train']}, val {ds['n_variants']['val']}, "
         f"test {ds['n_variants']['test']}",
         f"- Mean eligible decisions per player-game: {ds['mean_decisions_per_player_game']:.1f}",
         f"- Injected (substituted) variants: test {ds['n_variants']['test'] - ds['n_player_games']['test']}; "
         "rows of one source game are dependent, so intervals resample source games.",
         "- Original player-games are presumed human (no assistance injected by us); their absence of real assistance "
         "is not established.", "",
         "## Ablation", "",
         "TPR columns: recall on substituted test variants at a threshold set on validation original games for the target "
         "FPR; the realized test FPR is in parentheses and differs by system, so recall alone does not rank systems.", "",
         "| Experiment | Features | ROC-AUC [95% CI] | PR-AUC | TPR @1% target (test FPR) | TPR @5% target (test FPR) | Brier | α MAE (pp) | α RMSE (pp) |",
         "|---|---:|---|---:|---:|---:|---:|---:|---:|"]
    pp = lambda x: "—" if x is None else f"{100 * x:.1f}"  # noqa: E731
    for k in ORDER:
        e = m["experiments"][k]
        c = e["classifier"]
        ci = c.get("roc_auc_ci95")
        auc = f3(c["roc_auc"]) + (f" [{ci[0]:.3f}, {ci[1]:.3f}]" if ci else "")
        t = {round(x["target_fpr"], 2): x for x in c["tpr_at_fpr"]}
        r = e.get("regressor", {})
        L.append(f"| {e['label']} | {e['n_features']} | {auc} | {f3(c['pr_auc'])} | "
                 f"{f3(t[0.01]['tpr'])} ({100 * t[0.01]['test_fpr']:.1f}%) | {f3(t[0.05]['tpr'])} ({100 * t[0.05]['test_fpr']:.1f}%) | "
                 f"{f3(c.get('brier'))} | {pp(r.get('mae'))} | {pp(r.get('rmse'))} |")
    pb_path = config.ARTIFACTS / "paired_bootstrap.json"
    if pb_path.exists():
        pb = json.loads(pb_path.read_text())
        lab = {k: m["experiments"][k]["label"] for k in ORDER}
        L += ["", "## Paired differences in ROC-AUC (post hoc, saved test predictions)", "",
              f"Paired cluster bootstrap: {pb['n_boot']} resamples of {pb['n_clusters']} test source games, the same resample "
              "for both systems; percentile 95% interval. No refitting or tuning; no multiplicity correction; refit variance "
              "not captured. Overlap of the individual intervals above is a visual comparison only.", "",
              "| From | To | Δ ROC-AUC | Paired 95% CI | Share of resamples ≤ 0 |", "|---|---|---:|---|---:|"]
        for c in pb["comparisons"]:
            L.append(f"| {lab[c['from']]} | {lab[c['to']]} | {c['delta']:+.4f} | [{c['ci95'][0]:+.4f}, {c['ci95'][1]:+.4f}] | "
                     f"{c['share_le_0']:.4f} |")
    else:
        L += ["", "Paired differences were not tested (run experiments/09_paired_bootstrap.py)."]
    L += ["", "## ROC-AUC by strategy and assistance level (original test player-games vs that condition)", "",
          "| Experiment | Strategy | " + " | ".join(f"{int(l*100)}%" for l in config.ASSIST_LEVELS[1:]) + " |",
          "|---|---|" + "---:|" * (len(config.ASSIST_LEVELS) - 1)]
    for k in ORDER:
        cells = m["experiments"][k]["classifier"]["by_cell"]
        for s in config.STRATEGIES:
            vals = {round(c["level"], 2): c["roc_auc"] for c in cells if c["strategy"] == s}
            L.append(f"| {m['experiments'][k]['label']} | {s} | " +
                     " | ".join(f3(vals.get(round(l, 2))) for l in config.ASSIST_LEVELS[1:]) + " |")
    L += ["", "## ROC-AUC by Elo band", "", "| Experiment | " +
          " | ".join(b["band"] for b in m["experiments"]["D_sf_maia_seq"]["classifier"]["by_band"]) + " |",
          "|---|" + "---:|" * len(m["experiments"]["D_sf_maia_seq"]["classifier"]["by_band"])]
    for k in ORDER[1:]:
        L.append(f"| {m['experiments'][k]['label']} | " +
                 " | ".join(f3(b["roc_auc"]) for b in m["experiments"][k]["classifier"]["by_band"]) + " |")
    L += ["", "## Exploratory pooling of different-player games (pseudo-events)", "",
          "Each pseudo-event pools k test player-games by k different players of one Elo band (all original or all "
          "substituted at the same strategy and level); event score = mean game score. This does NOT validate "
          "longitudinal detection for a single player.", "",
          "| Model | Strategy | Level | " + " | ".join(f"k={k}" for k in (1, 3, 5, 9)) + " |", "|---|---|---|---:|---:|---:|---:|"]
    for k, rows in m["event_power"].items():
        for s in config.STRATEGIES:
            for lvl in (0.05, 0.10, 0.20):
                v = {r["k_games"]: r["roc_auc"] for r in rows if r["strategy"] == s and abs(r["level"] - lvl) < 1e-9}
                if v:
                    L.append(f"| {m['experiments'][k]['label']} | {s} | {int(lvl*100)}% | " +
                             " | ".join(f3(v.get(n)) for n in (1, 3, 5, 9)) + " |")
    cal = m["baseline_calibration"]
    L += ["", "## Baseline z-statistics on original test player-games", "",
          "Mean ≈ 0 and SD ≈ 1 are largely implied by the κ estimation; they do not validate normal tails.", "",
          "| Statistic | n | Mean | SD | z > 2 (N(0,1)) | z > 3 (N(0,1)) |", "|---|---:|---:|---:|---:|---:|"]
    for z, c in cal.items():
        L.append(f"| `{z}` | {c['n']} | {c['mean']:.2f} | {c['std']:.2f} | {100 * c['frac_gt2']:.2f}% ({100 * c['normal_frac_gt2']:.2f}%) | "
                 f"{100 * c['frac_gt3']:.2f}% ({100 * c['normal_frac_gt3']:.2f}%) |")
    L += ["", "## Regression: synthetic-equivalent assistance estimate by true level (full model D)", "",
          "| Nominal level | Mean realized α | Mean estimate | MAE (pp) |", "|---:|---:|---:|---:|"]
    for r in m["experiments"]["D_sf_maia_seq"]["regressor"]["by_level"]:
        L.append(f"| {int(r['level']*100)}% | {f3(r['mean_true'])} | {f3(r['mean_estimate'])} | {100 * r['mae']:.1f} |")
    L += ["", "## Top global SHAP features (model D classifier, mean |SHAP| on test)", "",
          "| Feature | mean abs SHAP |", "|---|---:|"]
    for r in m["shap_global"]["classifier"][:15]:
        L.append(f"| `{r['feature']}` | {r['mean_abs']:.4f} |")
    L += ["", "## Decision-level explanation model", "",
          f"Test ROC-AUC {dm['test_roc_auc']:.3f}, PR-AUC {dm['test_pr_auc']:.3f} (positive rate "
          f"{dm['test_pos_rate']:.3f}); by strategy: " +
          ", ".join(f"{k} {v:.3f}" for k, v in dm["by_strategy"].items()) + ".", ""]
    out = config.ROOT / "docs" / "RESULTS.md"
    out.write_text("\n".join(L), encoding="utf-8")
    print("wrote", out)


if __name__ == "__main__":
    main()
