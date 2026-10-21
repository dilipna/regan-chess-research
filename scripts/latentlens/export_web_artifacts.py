"""Validate LatentLens artifacts, write explicit "pending" placeholders for experiments that have not run, build
metadata.json, and copy compact versions to apps/web/public/data/latent/<model>/ for the website.

Nothing is estimated or filled in: a research artifact is either the file an experiment script wrote, or a pending
placeholder that says which command produces it.

Usage:
    .venv-latent/Scripts/python scripts/latentlens/export_web_artifacts.py --model Qwen/Qwen3-8B-Base
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from latentlens.common import WEB_DATA, git_commit, model_slug, now_iso, read_json, results_dir, write_json  # noqa: E402
from latentlens.schema import validate  # noqa: E402

REPS = "data/latentlens/reps/qwen3-8b-editlens_iclr"
EXTRACT = ("python scripts/latentlens/extract_hidden_states.py --model Qwen/Qwen3-8B-Base --dataset hf:pangram/editlens_iclr "
           "--split {split} --limit {n} --loader full --device cuda --dtype bfloat16 --batch-size 8")
PENDING = {
    "layer_probe.json": {
        "schema": "latentlens.layer_probe/1",
        "reason": "Needs the EditLens dataset (pangram/editlens_iclr is gated: request access on Hugging Face, then "
                  "`hf auth login`) and a hidden-state extraction run with Qwen3-8B-Base.",
        "how_to_run": [EXTRACT.format(split="train", n=4000), EXTRACT.format(split="val", n=1000),
                       EXTRACT.format(split="test", n=2000), EXTRACT.format(split="test_llama", n=1000),
                       EXTRACT.format(split="test_enron", n=1000),
                       f"python scripts/latentlens/train_layer_probes.py --representations {REPS} --extra-test test_llama --extra-test test_enron"]},
    "rmsnorm_probe.json": {
        "schema": "latentlens.rmsnorm_probe/1",
        "reason": "Runs on the same extraction as the layer probes (component captures at the default layers).",
        "how_to_run": [f"python scripts/latentlens/probe_rmsnorm.py --representations {REPS}"]},
    "component_probe.json": {
        "schema": "latentlens.component_probe/1",
        "reason": "Runs on the same extraction as the layer probes (component captures at the default layers).",
        "how_to_run": [f"python scripts/latentlens/probe_components.py --representations {REPS}"]},
    "pca/index.json": {
        "schema": "latentlens.pca_index/1",
        "reason": "Runs on the same extraction as the layer probes; fitted on train, shows validation documents.",
        "how_to_run": [f"python scripts/latentlens/build_pca_artifacts.py --representations {REPS}"]},
}
LEARN = ("architecture.json", "tokenizer_examples.json", "token_trace.json", "recall_probe.json")


def compact_recall(a: dict) -> dict:
    """Columnar per-depth arrays (rank, top token id, log10 true-token probability) to keep the web file small."""
    import math
    out = {k: v for k, v in a.items() if k != "passages"}
    out["passages"] = []
    for p in a["passages"]:
        q = {k: v for k, v in p.items() if k not in ("depth", "positions")}
        q["positions"] = p["positions"]
        q["depth_summary"] = [{k: d[k] for k in ("depth", "relative_depth", "top1_rate", "top10_rate", "median_rank",
                                                 "mean_log10_rank", "mean_margin", "agree_with_final_top")} for d in p["depth"]]
        q["depth_rank"] = [d["rank"] for d in p["depth"]]
        q["depth_top_id"] = [d["top_id"] for d in p["depth"]] if p["depth"][0].get("top_id") is not None else None
        q["depth_log10_p_true"] = [[round(math.log10(max(x, 1e-30)), 2) for x in d["p_true"]] for d in p["depth"]]
        out["passages"].append(q)
    out["format"] = "web-compact/1"
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", default="Qwen/Qwen3-8B-Base")
    args = ap.parse_args()
    slug = model_slug(args.model)
    res = results_dir(args.model)
    web = WEB_DATA / slug
    (web / "pca").mkdir(parents=True, exist_ok=True)
    (res / "pca").mkdir(parents=True, exist_ok=True)

    status = {}
    for name, spec in PENDING.items():
        p = res / name
        old = read_json(p) if p.exists() else None
        unchanged = old is not None and old.get("status") == "pending" and old.get("reason") == spec["reason"] \
            and old.get("how_to_run") == spec["how_to_run"]
        if (old is None or old.get("status") == "pending") and not unchanged:
            write_json(p, {"schema": spec["schema"], "status": "pending", "model_id": args.model,
                           "reason": spec["reason"], "how_to_run": spec["how_to_run"], "written": now_iso()})
    if (res / "recall_probe.json").exists() and (res / "recall_probe_fp32.json").exists():
        a16, a32 = read_json(res / "recall_probe.json"), read_json(res / "recall_probe_fp32.json")
        rows = []
        for p, q in zip(a16["passages"], a32["passages"]):
            assert p["name"] == q["name"] and p["n_scored"] == q["n_scored"]
            flips = sum(x["top1"] != y["top1"] for x, y in zip(p["positions"], q["positions"]))
            rows.append({"name": p["name"], "n_scored": p["n_scored"], "top1_rate": {a16["dtype"]: p["summary"]["top1_rate"],
                         a32["dtype"]: q["summary"]["top1_rate"]}, "top1_flips": flips})
        write_json(res / "recall_precision_check.json", {
            "schema": "latentlens.recall_precision/1", "status": "ok", "model_id": a16["model_id"],
            "compared": [a16["dtype"], a32["dtype"]], "passages": rows,
            "note": "Same model, same text, same code; only the compute dtype differs. Top-1 decisions that flip are "
                    "near-ties, so recall rates of two models should be compared with this numerical noise in mind.",
            "provenance": a32["provenance"]})
    problems = {}
    for p in sorted(res.rglob("*.json")):
        rel = p.relative_to(res).as_posix()
        if rel in ("metadata.json", "recall_probe_fp32.json"):
            continue
        a = read_json(p)
        errs = validate(p.name, a)
        if errs:
            problems[rel] = errs
            continue
        status[rel] = a.get("status")
        dst = web / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        if rel == "recall_probe.json" and a.get("status") == "ok":
            write_json(dst, compact_recall(a), digits=5, compact=True)
        else:
            write_json(dst, a, digits=8, compact=True)
    if problems:
        for k, v in problems.items():
            print("INVALID", k, v)
        raise SystemExit("artifact validation failed; the invalid files above were not copied and metadata was not written")
    # Glass Box tensors are binary (float32); copy them byte for byte next to their manifest.
    for b in sorted((res / "glassbox").glob("*.bin")) if (res / "glassbox").exists() else []:
        (web / "glassbox").mkdir(parents=True, exist_ok=True)
        shutil.copyfile(b, web / "glassbox" / b.name)
        status[f"glassbox/{b.name}"] = "ok"
    for stale in [q for q in (web / "pca").glob("*.json") if not (res / "pca" / q.name).exists()]:
        stale.unlink()

    arch = read_json(res / "architecture.json")
    lp = read_json(res / "layer_probe.json")
    rc = read_json(res / "recall_probe.json") if (res / "recall_probe.json").exists() else None
    tr = read_json(res / "token_trace.json") if (res / "token_trace.json").exists() else None
    ok = lp.get("status") == "ok"
    pv = (rc or tr or arch)["provenance"]
    meta = {
        "schema": "latentlens.metadata/1", "experiment_id": f"latentlens-{slug}", "exported": now_iso(),
        "git_commit": git_commit(), "model_id": args.model, "model_revision": arch["revision"],
        "tokenizer_id": args.model, "tokenizer_revision": arch["revision"],
        "transformers_version": pv["versions"].get("transformers"), "torch_version": pv["versions"].get("torch"),
        "artifacts": status,
        "learn_mode": {"architecture": arch["status"], "tokenizer_examples": status.get("tokenizer_examples.json"),
                       "token_trace": status.get("token_trace.json"),
                       "trace_dtype": tr["dtype"] if tr else None, "trace_loader": tr["loader"] if tr else None},
        "recall": {"status": status.get("recall_probe.json"), "dtype": rc["dtype"] if rc else None,
                   "loader": rc["loader"] if rc else None, "passages": [p["name"] for p in rc["passages"]] if rc else []},
        "human_vs_ai": {
            "status": lp["status"],
            "dataset": lp.get("dataset") if ok else "pangram/editlens_iclr (access pending)",
            "train_count": lp["splits"]["train"]["n"] if ok else None,
            "validation_count": lp["splits"]["val"]["n"] if ok else None,
            "test_count": lp["splits"]["test"]["n"] if ok else None,
            "pooling_strategy": lp.get("pooling") if ok else "chosen on validation from {mean, last} (pending)",
            "probe_classifier": "StandardScaler + L2 logistic regression (class-balanced), C by grouped CV on train",
            "random_seed": 0,
        },
        "dtype": (rc or tr or {}).get("dtype"), "device": pv["hardware"].get("gpu"), "hardware": pv["hardware"],
        "timestamp": pv["timestamp"],
    }
    write_json(res / "metadata.json", meta)
    shutil.copyfile(res / "metadata.json", web / "metadata.json")
    for k, v in sorted(status.items()):
        print(f"{v:8s} {k}")
    print("->", web)


if __name__ == "__main__":
    main()
