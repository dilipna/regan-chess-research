"""Layerwise linear probes: where does human-vs-AI information become linearly accessible?

For each residual depth: frozen pooled representation -> StandardScaler + logistic regression -> human / AI.

Protocol (fixed in advance; see latentlens/probes.py):
  1. leakage audit across splits (ids, identical texts, EditLens source_id groups); the run stops on leakage
  2. pooling: mean vs last-token, chosen by the best VALIDATION ROC-AUC over depths (ties -> mean)
  3. per depth: C chosen by grouped CV inside TRAIN; ROC-AUC, PR-AUC, balanced accuracy and F1 on VALIDATION
  4. best depth = argmax validation ROC-AUC
  5. TEST is evaluated once: at the validation-selected depth and at the final depth (pre-specified comparison);
     extra held-out splits (unseen generator, domain shift) are evaluated at the selected depth only
  6. negative controls and baselines: random-label probe, length, token count, perplexity, stylometry;
     length-matched test subset; per-generator test AUROC

Usage:
    .venv-latent/Scripts/python scripts/latentlens/train_layer_probes.py \
        --representations data/latentlens/reps/qwen3-8b-editlens_iclr --extra-test test_llama --extra-test test_enron
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from latentlens.common import RESULTS, model_slug, provenance, seed_everything, write_json  # noqa: E402


def scalar_baseline(Xtr, ytr, Xev, seed):
    from latentlens.probes import fit_probe
    p = fit_probe(Xtr, ytr, Cs=(1.0,), folds=3, seed=seed)
    return p.predict(Xev)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--representations", required=True)
    ap.add_argument("--train-split", default="train")
    ap.add_argument("--val-split", default="val")
    ap.add_argument("--test-split", default="test")
    ap.add_argument("--extra-test", action="append", default=[], help="additional held-out split(s), e.g. test_llama")
    ap.add_argument("--pooling", default="auto", choices=["auto", "mean", "last"])
    ap.add_argument("--cs", default="0.001,0.01,0.1,1")
    ap.add_argument("--folds", type=int, default=3)
    ap.add_argument("--random-label-seeds", type=int, default=3)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    import numpy as np
    from latentlens.data import STYLO_NAMES, check_splits
    from latentlens.probes import bootstrap_auc_ci, fit_probe, length_matched_indices, metrics
    from latentlens.reps import load_run

    seed_everything(args.seed)
    run, S = load_run(args.representations)
    cfg = run["config"]
    tr, va, te = S[args.train_split], S[args.val_split], S[args.test_split]
    extras = [S[x] for x in args.extra_test if x in S]
    leak = check_splits({s.name: s.meta for s in [tr, va, te, *extras]})
    if not leak["leakage_free"]:
        raise SystemExit(f"split leakage detected, refusing to train: {leak}")
    Cs = tuple(float(c) for c in args.cs.split(","))
    depths = cfg["depths"]
    ytr, yva, yte = tr.y, va.y, te.y

    def sweep(pooling):
        Xtr_all, Xva_all = tr.array(f"resid_{pooling}"), va.array(f"resid_{pooling}")
        rows, probes = [], {}
        for k, d in enumerate(depths):
            p = fit_probe(Xtr_all[:, k], ytr, tr.groups, Cs=Cs, folds=args.folds, seed=args.seed)
            pv = p.predict(Xva_all[:, k])
            rows.append({"depth": d, "relative_depth": d / cfg["n_layers"], "C": p.C, "cv_auc": p.cv_auc,
                         "val": metrics(yva, pv)})
            probes[d] = p
            print(f"  [{pooling}] depth {d:2d}: val ROC-AUC {rows[-1]['val']['roc_auc']:.4f} (C={p.C})", flush=True)
        return rows, probes

    pool_results = {}
    for pooling in (["mean", "last"] if args.pooling == "auto" else [args.pooling]):
        if pooling in cfg["poolings"]:
            pool_results[pooling] = sweep(pooling)
    best_val = {p: max(r["val"]["roc_auc"] for r in rows) for p, (rows, _) in pool_results.items()}
    pooling = max(best_val, key=lambda p: (best_val[p], p == "mean"))
    rows, probes = pool_results[pooling]
    best = max(rows, key=lambda r: (r["val"]["roc_auc"], -r["depth"]))
    best_d, final_d = best["depth"], depths[-1]
    Xte = te.array(f"resid_{pooling}")

    def test_at(d, split, X=None):
        X = split.array(f"resid_{pooling}") if X is None else X
        p = probes[d].predict(X[:, depths.index(d)])
        return p, {**metrics(split.y, p), "roc_auc_ci95": bootstrap_auc_ci(split.y, p, seed=args.seed)}

    p_best, test_best = test_at(best_d, te, Xte)
    _, test_final = test_at(final_d, te, Xte)
    extra = {}
    for s in extras:
        _, extra[s.name] = test_at(best_d, s)

    # per-generator AUROC on test (each generator's AI documents vs all human test documents)
    gens = {}
    gcol = te.col("generator")
    for g in sorted({x for x in gcol if x}):
        idx = np.where((yte == 0) | (gcol == g))[0]
        if (yte[idx] == 1).sum() >= 10:
            gens[g] = metrics(yte[idx], p_best[idx])

    # length-matched test subset
    ntok = te.col("n_tokens").astype(float)
    lm = length_matched_indices(ntok, yte, seed=args.seed)
    length_matched = metrics(yte[lm], p_best[lm]) if len(lm) else None

    # random-label control at the selected depth (labels shuffled within TRAIN only)
    rng = np.random.default_rng(args.seed)
    k = depths.index(best_d)
    Xtr_b, Xva_b = tr.array(f"resid_{pooling}")[:, k], va.array(f"resid_{pooling}")[:, k]
    rand = []
    for s in range(args.random_label_seeds):
        yperm = rng.permutation(ytr)
        pr = fit_probe(Xtr_b, yperm, None, Cs=Cs, folds=args.folds, seed=args.seed + s)
        rand.append({"seed": s, "val_roc_auc": metrics(yva, pr.predict(Xva_b))["roc_auc"],
                     "test_roc_auc": metrics(yte, pr.predict(Xte[:, k]))["roc_auc"]})

    # simple baselines (fit on train, reported on validation and test)
    def feat(split, kind):
        if kind == "length":
            return np.stack([np.log1p(split.col("n_chars").astype(float)), np.log1p(split.col("n_words").astype(float))], 1)
        if kind == "token_count":
            return np.log1p(split.col("n_tokens_full").astype(float))[:, None]
        if kind == "perplexity":
            return split.array("nll")[:, None].astype(float)
        raise KeyError(kind)

    baselines = {}
    for kind in ("length", "token_count", "perplexity"):
        try:
            Ftr, Fva, Fte = feat(tr, kind), feat(va, kind), feat(te, kind)
            if not (np.isfinite(Ftr).all() and np.isfinite(Fva).all() and np.isfinite(Fte).all()):
                baselines[kind] = {"status": "unavailable", "reason": "missing values"}
                continue
            baselines[kind] = {"val": metrics(yva, scalar_baseline(Ftr, ytr, Fva, args.seed)),
                               "test": metrics(yte, scalar_baseline(Ftr, ytr, Fte, args.seed))}
        except FileNotFoundError:
            baselines[kind] = {"status": "unavailable", "reason": "not extracted"}
    sty = {s.name: s.root / "stylometry.npy" for s in (tr, va, te)}
    if all(p.exists() for p in sty.values()):
        Ftr, Fva, Fte = (np.load(sty[n]) for n in (tr.name, va.name, te.name))
        baselines["stylometry"] = {"features": STYLO_NAMES, "val": metrics(yva, scalar_baseline(Ftr, ytr, Fva, args.seed)),
                                   "test": metrics(yte, scalar_baseline(Ftr, ytr, Fte, args.seed))}
    else:
        baselines["stylometry"] = {"status": "unavailable", "reason": "stylometry.npy missing from a split"}

    res = {
        "schema": "latentlens.layer_probe/1", "status": "ok", "model_id": cfg["model_id"], "revision": cfg["revision"],
        "n_layers": cfg["n_layers"], "task": "human-written vs fully AI-generated",
        "dataset": cfg["dataset"], "splits": run["splits"], "leakage_audit": leak,
        "protocol": {"classifier": "StandardScaler + L2 logistic regression (class-balanced)", "C_grid": list(Cs),
                     "C_selection": f"{args.folds}-fold grouped CV on train", "layer_selection": "max validation ROC-AUC",
                     "pooling_selection": "max validation ROC-AUC over depths (auto)" if args.pooling == "auto" else "fixed",
                     "test_policy": "evaluated once at the validation-selected depth and the final depth"},
        "pooling": pooling, "pooling_val_best": best_val,
        "pooling_sweeps": {p: [{"depth": r["depth"], "val_roc_auc": r["val"]["roc_auc"]} for r in rr] for p, (rr, _) in pool_results.items()},
        "layers": rows, "selected_depth": best_d, "final_depth": final_d,
        "test": {"selected_depth": test_best, "final_depth": test_final},
        "extra_tests": extra, "per_generator_test": gens, "length_matched_test": length_matched,
        "controls": {"random_labels": rand, "baselines": baselines},
        "chance_roc_auc": 0.5,
        "interpretation": "A linear classifier can access information correlated with the human-vs-AI label from these "
                          "representations. This does not show that any layer detects AI or why the information is there.",
        "provenance": provenance(script="scripts/latentlens/train_layer_probes.py", representations=str(args.representations)),
    }
    out = Path(args.out) if args.out else RESULTS / model_slug(cfg["model_id"]) / "layer_probe.json"
    write_json(out, res)
    print(f"pooling={pooling}; selected depth {best_d}: val {best['val']['roc_auc']:.4f}, test {test_best['roc_auc']:.4f}; "
          f"final depth test {test_final['roc_auc']:.4f} -> {out}")


if __name__ == "__main__":
    main()
