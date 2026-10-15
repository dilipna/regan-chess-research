"""Flat CSV of the three-model result tables (no number typed by hand; read from the JSON result files).

Rows: task, model/comparison, metric, estimate, ci_low, ci_high, status, source file.
Pending models are written with status "pending" and EMPTY values; metrics a model cannot produce are "not_defined" -- nothing is filled in.
Output: apps/web/public/data/three_model_results_summary.csv (+ copy in data/artifacts/)
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services"))
from analyzer import config  # noqa: E402

A = config.ARTIFACTS
HEAD = ["table", "model_or_comparison", "metric", "estimate", "ci95_low", "ci95_high", "status", "source"]


def blank(x):
    return "" if x is None else repr(float(x))


def main():
    mp = json.loads((A / "three_model_move_prediction.json").read_text())
    ar = json.loads((A / "three_model_assistance_results.json").read_text())
    bs = json.loads((A / "three_model_bootstrap.json").read_text())
    rows = []
    for k, m in mp["models"].items():
        for metric, v in (m.get("metrics") or {}).items():
            ci = (m.get("ci95") or {}).get(metric) or [None, None]
            rows.append(["task1_move_prediction", m["label"], metric, blank(v), blank(ci[0]), blank(ci[1]), m["status"] if v is not None else ("not_defined" if m["status"] == "ok" else m["status"]), "three_model_move_prediction.json"])
        if m["status"] != "ok":
            rows.append(["task1_move_prediction", m["label"], "", "", "", "", "pending", "three_model_move_prediction.json"])
    for k, m in ar["models"].items():
        if m["status"] != "ok":
            rows.append(["task2_substitutions", m["label"], "roc_auc", "", "", "", "pending", "three_model_assistance_results.json"])
            continue
        ci = m.get("roc_auc_ci95") or [None, None]
        rows.append(["task2_substitutions", m["label"], "roc_auc", blank(m["roc_auc"]), blank(ci[0]), blank(ci[1]), "ok", "three_model_assistance_results.json"])
        rows.append(["task2_substitutions", m["label"], "pr_auc", blank(m.get("pr_auc")), "", "", "ok", "three_model_assistance_results.json"])
        for t in m.get("tpr_at_fpr", []):
            rows.append(["task2_substitutions", m["label"], f"recall_at_target_fpr_{t['target_fpr']}_realized_fpr_{t['test_fpr']:.4f}", blank(t["tpr"]), "", "", "ok", "three_model_assistance_results.json"])
    for c in bs["comparisons"]:
        ci = c.get("ci95") or [None, None]
        rows.append([f"paired_difference_{c['task']}", f"{c['from']} -> {c['to']}", c["metric"], blank(c.get("delta")), blank(ci[0]), blank(ci[1]), c["status"], "three_model_bootstrap.json"])
    hb = json.loads((A / "paired_bootstrap.json").read_text())
    for c in hb["comparisons"]:
        rows.append(["paired_difference_hybrid_abcd", f"{c['from']} -> {c['to']}", "roc_auc", blank(c["delta"]), blank(c["ci95"][0]), blank(c["ci95"][1]), "ok", "paired_bootstrap.json"])
    for out in (config.WEB_DATA / "three_model_results_summary.csv", A / "three_model_results_summary.csv"):
        with open(out, "w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh); w.writerow(HEAD); w.writerows(rows)
    print(f"wrote three_model_results_summary.csv: {len(rows)} rows")


if __name__ == "__main__":
    main()
