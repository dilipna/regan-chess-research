"""Compare recall artifacts from two or more models on the same passage(s), aligned by RELATIVE depth.

Each input is a recall JSON written by run_recall_analysis.py (one model each). Models may differ in depth and
tokenizer, so depths are mapped to relative depth = block / number of blocks and resampled onto a common grid.
Per passage and model we report final recall, median stabilization depth (relative), and the median true-token rank
on the common grid. Writes a JSON comparison; nothing is downloaded or run here.

Usage:
    python scripts/latentlens/compare_recall_models.py A.json B.json --out results/latentlens/recall_comparison.json
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from latentlens.common import provenance, read_json, write_json  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inputs", nargs="+")
    ap.add_argument("--grid", type=int, default=21, help="number of relative-depth grid points in [0, 1]")
    ap.add_argument("--out", default="results/latentlens/recall_comparison.json")
    args = ap.parse_args()

    import numpy as np
    runs = [read_json(p) for p in args.inputs]
    grid = np.linspace(0, 1, args.grid)
    names = sorted(set.intersection(*[{p["name"] for p in r["passages"]} for r in runs]))
    if not names:
        raise SystemExit("the inputs share no passage names; pass --name identically to run_recall_analysis.py")
    out = []
    for name in names:
        row = {"passage": name, "models": []}
        for r in runs:
            p = next(q for q in r["passages"] if q["name"] == name)
            L = r["n_layers"]
            depth = p.get("depth") or p.get("depth_summary")
            rel = np.array([d["depth"] / L for d in depth])
            med = np.array([d["median_rank"] for d in depth], dtype=float)
            top1 = np.array([d["top1_rate"] for d in depth], dtype=float)
            stab = [x["stabilization_depth"] / L for x in p["positions"] if x["stabilization_depth"] is not None]
            row["models"].append({
                "model_id": r["model_id"], "revision": r.get("revision"), "dtype": r.get("dtype"), "n_layers": L,
                "n_tokens": p["n_tokens"], "top1_rate": p["summary"]["top1_rate"], "top5_rate": p["summary"]["top5_rate"],
                "median_relative_stabilization_depth": float(np.median(stab)) if stab else None,
                "median_rank_on_grid": np.exp(np.interp(grid, rel, np.log(med))).tolist(),
                "diagnostic_top1_rate_on_grid": np.interp(grid, rel, top1).tolist()})
        out.append(row)
    res = {"schema": "latentlens.recall_comparison/1", "status": "ok", "relative_depth_grid": grid.tolist(), "passages": out,
           "notes": ["Different tokenizers split the same text differently: compare n_tokens before comparing rates.",
                     "Relative depth aligns blocks proportionally; it does not imply that block k of one model does the "
                     "same job as block k' of another.",
                     "Intermediate values are diagnostic projections through each model's own final norm and LM head."],
           "provenance": provenance(script="scripts/latentlens/compare_recall_models.py", inputs=args.inputs)}
    write_json(Path(args.out), res)
    for row in out:
        print(row["passage"])
        for m in row["models"]:
            print(f"  {m['model_id']}: recall {m['top1_rate']:.3f} over {m['n_tokens']} tokens, "
                  f"median stabilization at relative depth {m['median_relative_stabilization_depth']}")


if __name__ == "__main__":
    main()
