"""Attention vs MLP: at which transformation inside a block does human-vs-AI linear separability change?

At each component layer, probes are trained on the seven pooled sites (see capture.py):
  resid_pre -> [attention sub-layer] -> resid_mid -> [MLP sub-layer] -> resid_post
plus the update vectors themselves (attn_out, mlp_out) and the normalized sub-layer inputs (attn_norm, mlp_norm).

The comparisons that are mathematically meaningful are between residual-stream states, because they live in the same
space and differ by exactly one additive update:
  attention step: AUROC(resid_mid) - AUROC(resid_pre)
  MLP step:       AUROC(resid_post) - AUROC(resid_mid)
Probes on attn_out / mlp_out ask a different question (is the label readable from the update alone?).
Evaluation on validation; paired bootstrap over documents for the differences (fixed predictions, no refitting).

Usage:
    .venv-latent/Scripts/python scripts/latentlens/probe_components.py --representations data/latentlens/reps/qwen3-8b-editlens_iclr
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from latentlens.common import RESULTS, model_slug, provenance, seed_everything, write_json  # noqa: E402

SITES = ("resid_pre", "attn_norm", "attn_out", "resid_mid", "mlp_norm", "mlp_out", "resid_post")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--representations", required=True)
    ap.add_argument("--train-split", default="train")
    ap.add_argument("--val-split", default="val")
    ap.add_argument("--cs", default="0.01,0.1,1")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    from latentlens.probes import bootstrap_auc_diff, fit_probe, metrics
    from latentlens.reps import load_run

    seed_everything(args.seed)
    run, S = load_run(args.representations)
    cfg = run["config"]
    tr, va = S[args.train_split], S[args.val_split]
    if not cfg["component_layers"] or not tr.has("comp_resid_pre"):
        raise SystemExit("no component captures in this run (extract with --component-layers)")
    Cs = tuple(float(c) for c in args.cs.split(","))
    rows = []
    for k, layer in enumerate(cfg["component_layers"]):
        preds, row = {}, {"layer": layer}
        for s in SITES:
            p = fit_probe(tr.array(f"comp_{s}")[:, k], tr.y, tr.groups, Cs=Cs, seed=args.seed)
            preds[s] = p.predict(va.array(f"comp_{s}")[:, k])
            row[s] = {**metrics(va.y, preds[s]), "C": p.C,
                      "mean_rms_val": float(va.array(f"comp_{s}_rms")[:, k].mean())}
        row["attention_step"] = bootstrap_auc_diff(va.y, preds["resid_pre"], preds["resid_mid"], seed=args.seed)
        row["mlp_step"] = bootstrap_auc_diff(va.y, preds["resid_mid"], preds["resid_post"], seed=args.seed)
        rows.append(row)
        print(f"layer {layer}: " + ", ".join(f"{s} {row[s]['roc_auc']:.4f}" for s in SITES), flush=True)
    res = {"schema": "latentlens.component_probe/1", "status": "ok", "model_id": cfg["model_id"], "revision": cfg["revision"],
           "evaluation_split": args.val_split, "pooling": "mean", "sites": list(SITES), "layers": rows,
           "interpretation": "A positive attention (MLP) step means the label is more linearly accessible after that "
                             "sub-layer's update has been added. It does not show what the sub-layer computes.",
           "provenance": provenance(script="scripts/latentlens/probe_components.py", representations=str(args.representations))}
    out = Path(args.out) if args.out else RESULTS / model_slug(cfg["model_id"]) / "component_probe.json"
    write_json(out, res)
    print("->", out)


if __name__ == "__main__":
    main()
