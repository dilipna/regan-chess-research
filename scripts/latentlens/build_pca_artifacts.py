"""PCA views of pooled representations at selected depths (exploratory visualization only).

For each depth: standardize with TRAIN statistics, fit a 2-component PCA on TRAIN only, then project VALIDATION
documents. The test split is never touched. Up to --max-points documents per class are written for display.

"PCA is an exploratory visualization. Quantitative evidence comes from held-out classifier metrics." Visible clusters do
not prove separation, and an absence of visible clusters does not prove its absence (the label may be linearly readable
along a direction that is not among the top two principal components).

Usage:
    .venv-latent/Scripts/python scripts/latentlens/build_pca_artifacts.py --representations data/latentlens/reps/qwen3-8b-editlens_iclr
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from latentlens.common import RESULTS, model_slug, provenance, read_json, seed_everything, write_json  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--representations", required=True)
    ap.add_argument("--train-split", default="train")
    ap.add_argument("--val-split", default="val")
    ap.add_argument("--pooling", default=None, help="default: the pooling chosen in layer_probe.json, else mean")
    ap.add_argument("--depths", default=None, help="comma list; default: 0, L/4, L/2, 3L/4, L and the selected depth")
    ap.add_argument("--max-points", type=int, default=300)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out-dir", default=None)
    ap.add_argument("--layer-probe", default=None, help="layer_probe.json to read the pooling / selected depth from")
    args = ap.parse_args()

    import numpy as np
    from sklearn.decomposition import PCA
    from latentlens.reps import load_run

    seed_everything(args.seed)
    run, S = load_run(args.representations)
    cfg = run["config"]
    out_dir = Path(args.out_dir) if args.out_dir else RESULTS / model_slug(cfg["model_id"]) / "pca"
    lp_path = Path(args.layer_probe) if args.layer_probe else RESULTS / model_slug(cfg["model_id"]) / "layer_probe.json"
    lp = read_json(lp_path) if lp_path.exists() else None
    pooling = args.pooling or (lp["pooling"] if lp else "mean")
    L = cfg["n_layers"]
    if args.depths:
        want = [int(x) for x in args.depths.split(",")]
    else:
        want = sorted({0, L // 4, L // 2, (3 * L) // 4, L} | ({lp["selected_depth"]} if lp else set()))
    want = [d for d in want if d in cfg["depths"]]
    tr, va = S[args.train_split], S[args.val_split]
    rng = np.random.default_rng(args.seed)
    pick = np.concatenate([rng.permutation(np.where(va.y == lab)[0])[: args.max_points] for lab in (0, 1)])
    index = []
    for d in want:
        k = cfg["depths"].index(d)
        Xtr = np.asarray(tr.array(f"resid_{pooling}")[:, k], dtype=np.float64)
        Xva = np.asarray(va.array(f"resid_{pooling}")[:, k], dtype=np.float64)
        mu, sd = Xtr.mean(0), Xtr.std(0) + 1e-8
        pca = PCA(n_components=2, random_state=args.seed).fit((Xtr - mu) / sd)
        Z = pca.transform((Xva[pick] - mu) / sd)
        gen = va.col("generator")
        pts = [{"x": float(z[0]), "y": float(z[1]), "label": int(va.y[i]), "generator": gen[i] if gen[i] else None}
               for z, i in zip(Z, pick)]
        name = f"depth_{d:02d}.json"
        write_json(out_dir / name, {"schema": "latentlens.pca/1", "status": "ok", "model_id": cfg["model_id"], "depth": d,
                                    "pooling": pooling, "fit_split": tr.name, "shown_split": va.name,
                                    "explained_variance_ratio": [float(v) for v in pca.explained_variance_ratio_],
                                    "points": pts}, digits=4)
        index.append({"depth": d, "file": name, "explained_variance_ratio": [float(v) for v in pca.explained_variance_ratio_]})
        print(f"depth {d}: explained variance {pca.explained_variance_ratio_.round(3).tolist()}")
    write_json(out_dir / "index.json", {"schema": "latentlens.pca_index/1", "status": "ok", "model_id": cfg["model_id"],
                                        "pooling": pooling, "depths": index,
                                        "note": "PCA is an exploratory visualization. Quantitative evidence comes from "
                                                "held-out classifier metrics.",
                                        "provenance": provenance(script="scripts/latentlens/build_pca_artifacts.py")})


if __name__ == "__main__":
    main()
