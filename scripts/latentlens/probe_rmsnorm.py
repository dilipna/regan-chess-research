"""RMSNorm and activation magnitude: does normalization change how linearly accessible the human-vs-AI label is?

Inputs come from extract_hidden_states.py. Inside each component layer the extraction captured, at module boundaries:
  resid_pre  -> input_layernorm  -> attn_norm     (block RMSNorm #1: the input the attention sub-layer actually reads)
  resid_mid  -> post_attention_layernorm -> mlp_norm   (block RMSNorm #2: the input the MLP reads)
These are BLOCK RMSNorms over hidden_size. Qwen3's q_norm / k_norm act on 128-dimensional head vectors inside attention
and are a different operation; they are not studied here.

Comparisons (validation ROC-AUC; layer choices fixed by the extraction config, not by results):
  A. resid_pre vs attn_norm and resid_mid vs mlp_norm at each component layer (paired bootstrap of the difference)
  B. raw pooled residual vs the same vector scaled to unit L2 norm, at every depth
  C. magnitude only: a probe on log(mean per-token RMS) alone, at every depth
  D. class-conditioned RMS distributions (quantiles) at every depth

Interpretation is conservative: a change in separability between two representations shows that the information is
more or less linearly accessible there. It does not show that RMSNorm causes or removes the signal.

Usage:
    .venv-latent/Scripts/python scripts/latentlens/probe_rmsnorm.py --representations data/latentlens/reps/qwen3-8b-editlens_iclr
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from latentlens.common import RESULTS, model_slug, provenance, seed_everything, write_json  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--representations", required=True)
    ap.add_argument("--train-split", default="train")
    ap.add_argument("--val-split", default="val")
    ap.add_argument("--pooling", default="mean")
    ap.add_argument("--cs", default="0.01,0.1,1")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    import numpy as np
    from latentlens.probes import bootstrap_auc_diff, fit_probe, metrics
    from latentlens.reps import load_run

    seed_everything(args.seed)
    run, S = load_run(args.representations)
    cfg = run["config"]
    tr, va = S[args.train_split], S[args.val_split]
    ytr, yva = tr.y, va.y
    Cs = tuple(float(c) for c in args.cs.split(","))

    def probe(Xtr, Xva):
        p = fit_probe(np.asarray(Xtr), ytr, tr.groups, Cs=Cs, seed=args.seed)
        pv = p.predict(np.asarray(Xva))
        return pv, metrics(yva, pv)

    # A. block RMSNorm input vs output
    block = []
    if cfg["component_layers"] and tr.has("comp_resid_pre"):
        A = {s: (tr.array(f"comp_{s}"), va.array(f"comp_{s}")) for s in ("resid_pre", "attn_norm", "resid_mid", "mlp_norm")}
        for k, layer in enumerate(cfg["component_layers"]):
            row = {"layer": layer}
            preds = {}
            for s, (xt, xv) in A.items():
                preds[s], row[s] = probe(xt[:, k], xv[:, k])
            row["attn_norm_minus_resid_pre"] = bootstrap_auc_diff(yva, preds["resid_pre"], preds["attn_norm"], seed=args.seed)
            row["mlp_norm_minus_resid_mid"] = bootstrap_auc_diff(yva, preds["resid_mid"], preds["mlp_norm"], seed=args.seed)
            block.append(row)
            print(f"layer {layer}: resid_pre {row['resid_pre']['roc_auc']:.4f} -> attn_norm {row['attn_norm']['roc_auc']:.4f}; "
                  f"resid_mid {row['resid_mid']['roc_auc']:.4f} -> mlp_norm {row['mlp_norm']['roc_auc']:.4f}", flush=True)

    # B, C, D across depths
    Xtr_all, Xva_all = tr.array(f"resid_{args.pooling}"), va.array(f"resid_{args.pooling}")
    Rtr, Rva = tr.array("resid_rms"), va.array("resid_rms")
    depth_rows = []
    for k, d in enumerate(cfg["depths"]):
        xt, xv = np.asarray(Xtr_all[:, k], dtype=np.float64), np.asarray(Xva_all[:, k], dtype=np.float64)
        p_raw, m_raw = probe(xt, xv)
        unit = lambda x: x / np.linalg.norm(x, axis=1, keepdims=True).clip(1e-12)  # noqa: E731
        p_unit, m_unit = probe(unit(xt), unit(xv))
        _, m_mag = probe(np.log(Rtr[:, k:k + 1].astype(np.float64)), np.log(Rva[:, k:k + 1].astype(np.float64)))
        q = (0.1, 0.25, 0.5, 0.75, 0.9)
        dist = {name: [float(v) for v in np.quantile(np.asarray(Rva[yva == lab, k]), q)] for name, lab in (("human", 0), ("ai", 1))}
        depth_rows.append({"depth": d, "raw": m_raw, "unit_l2": m_unit, "magnitude_only": m_mag,
                           "unit_minus_raw": bootstrap_auc_diff(yva, p_raw, p_unit, seed=args.seed),
                           "rms_quantiles_val": {"q": list(q), **dist},
                           "pooled_l2_mean_val": {name: float(np.linalg.norm(xv[yva == lab], axis=1).mean()) for name, lab in (("human", 0), ("ai", 1))}})
        print(f"depth {d}: raw {m_raw['roc_auc']:.4f}, unit-L2 {m_unit['roc_auc']:.4f}, magnitude-only {m_mag['roc_auc']:.4f}", flush=True)

    res = {"schema": "latentlens.rmsnorm_probe/1", "status": "ok", "model_id": cfg["model_id"], "revision": cfg["revision"],
           "evaluation_split": args.val_split, "pooling": args.pooling, "component_layers": cfg["component_layers"],
           "block_rmsnorm": block, "depths": depth_rows,
           "note": "Block RMSNorm (input_layernorm, post_attention_layernorm; over hidden_size). Q/K RMSNorm is a "
                   "separate per-head operation and is not part of this comparison.",
           "interpretation": "Differences in validation ROC-AUC describe linear accessibility of label-correlated "
                             "information in each representation; they do not establish a causal role for normalization.",
           "provenance": provenance(script="scripts/latentlens/probe_rmsnorm.py", representations=str(args.representations))}
    out = Path(args.out) if args.out else RESULTS / model_slug(cfg["model_id"]) / "rmsnorm_probe.json"
    write_json(out, res)
    print("->", out)


if __name__ == "__main__":
    main()
