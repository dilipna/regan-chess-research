"""Extract pooled hidden states from a frozen model for the human-vs-AI study.

For every document: tokens = [<|endoftext|>] + tokenizer(text)[:max_tokens]. The document-start token is excluded from
pooling. For each requested depth (0 = embeddings, k = residual stream after block k) we store
  * mean pooling over the document's tokens and last-token pooling (the probe script chooses ONE on validation)
  * the mean per-token RMS (activation magnitude, measured before pooling)
For --component-layers we also store mean-pooled vectors at the seven sites of the block (see capture.py):
  resid_pre, attn_norm (block RMSNorm #1 output), attn_out, resid_mid, mlp_norm (block RMSNorm #2 output), mlp_out,
  resid_post.
We also store each document's mean next-token negative log-likelihood under the model (the perplexity baseline).

Nothing is kept per token. The model is frozen (eval mode, torch.inference_mode, tensors detached immediately).
Work is written in chunks; rerunning the same command resumes after the last finished chunk.

Examples:
    # laptop (4 GB GPU): layer streaming
    .venv-latent/Scripts/python scripts/latentlens/extract_hidden_states.py --dataset hf:pangram/editlens_iclr \
        --split val --limit 200 --loader stream --batch-size 4 --device cuda --dtype bfloat16
    # CSE GPU
    python scripts/latentlens/extract_hidden_states.py --model Qwen/Qwen3-8B-Base --dataset hf:pangram/editlens_iclr \
        --split train --limit 4000 --loader full --batch-size 8 --device cuda --dtype bfloat16
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from latentlens.common import (
    DATA,
    model_slug,
    provenance,
    read_json,
    seed_everything,
)

COMPONENT_SITES = (
    "resid_pre",
    "attn_norm",
    "attn_out",
    "resid_mid",
    "mlp_norm",
    "mlp_out",
    "resid_post",
)


def parse_list(s: str | None, n: int) -> list[int]:
    if s is None or s == "all":
        return list(range(n))
    if s == "none":
        return []
    return sorted({int(x) for x in s.split(",") if x.strip()})


def default_component_layers(L: int) -> list[int]:
    return sorted({max(0, round(L * f) - 1) for f in (0.1, 0.25, 0.5, 0.75)} | {L - 1})


def load_docs(args):
    from latentlens.data import load_editlens, load_jsonl, sample_balanced

    if args.dataset_format == "editlens":
        docs, report = load_editlens(
            args.dataset,
            args.split,
            tuple(args.human_types.split(",")),
            tuple(args.ai_types.split(",")),
            local_files_only=args.local_files_only,
        )
    else:
        docs, report = load_jsonl(args.dataset, args.split)
    docs = sample_balanced(docs, args.limit, args.seed)
    report["sampled"] = len(docs)
    return docs, report


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--model", default="Qwen/Qwen3-8B-Base")
    ap.add_argument("--revision", default=None)
    ap.add_argument(
        "--dataset",
        required=True,
        help="hf:pangram/editlens_iclr, a local EditLens folder, or a .jsonl file",
    )
    ap.add_argument(
        "--dataset-format", default="editlens", choices=["editlens", "jsonl"]
    )
    ap.add_argument("--split", required=True)
    ap.add_argument(
        "--limit",
        type=int,
        default=None,
        help="class-balanced sample size for this split",
    )
    ap.add_argument("--human-types", default="human_written,human")
    ap.add_argument("--ai-types", default="ai_generated,fully_ai_generated,ai")
    ap.add_argument("--max-tokens", type=int, default=512)
    ap.add_argument(
        "--depths", default="all", help="'all' or comma list of residual depths 0..L"
    )
    ap.add_argument(
        "--component-layers",
        default="default",
        help="'default', 'none' or comma list of block indices",
    )
    ap.add_argument("--pooling", default="mean,last")
    ap.add_argument("--batch-size", type=int, default=4)
    ap.add_argument(
        "--chunk-size", type=int, default=64, help="documents per resumable chunk"
    )
    ap.add_argument("--loader", default="full", choices=["full", "stream"])
    ap.add_argument("--device", default="cuda")
    ap.add_argument(
        "--dtype", default="bfloat16", choices=["bfloat16", "float16", "float32"]
    )
    ap.add_argument("--store-dtype", default="float16", choices=["float16", "float32"])
    ap.add_argument("--no-nll", action="store_true")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument(
        "--out",
        default=None,
        help="output folder (default data/latentlens/reps/<model>-<dataset-tag>)",
    )
    ap.add_argument("--local-files-only", action="store_true")
    args = ap.parse_args()

    from latentlens.adapter import Qwen3Adapter

    if (
        args.chunk_size < 1
        or args.batch_size < 1
        or args.max_tokens < 1
        or not args.split
        or Path(args.split).name != args.split
        or args.split in (".", "..")
    ):
        ap.error("Use positive chunk/batch/token sizes and a plain split name")
    seed_everything(args.seed)
    docs, report = load_docs(args)
    print(f"[{args.split}] dataset report: {json.dumps(report)}", flush=True)
    tag = Path(args.dataset.replace("hf:", "")).name.replace(".jsonl", "")
    out = (
        Path(args.out)
        if args.out
        else DATA / "reps" / f"{model_slug(args.model)}-{tag}"
    )
    sdir = out / args.split

    a = Qwen3Adapter(
        args.model,
        revision=args.revision,
        device=args.device,
        dtype=args.dtype,
        loader=args.loader,
        local_files_only=args.local_files_only,
    )
    from latentlens.checkpoint import output_lock

    with output_lock(out):
        try:
            extract(args, docs, report, out, sdir, a)
        finally:
            a.cleanup()


def extract(args, docs, report, out, sdir, a):
    import hashlib

    import numpy as np
    import torch
    from latentlens.adapter import make_batches
    from latentlens.capture import PooledStore
    from latentlens.checkpoint import (
        SplitCheckpoint,
        atomic_json,
        atomic_write,
        digest,
        file_hash,
    )
    from latentlens.common import library_versions

    a.load_model()
    L, D = a.get_layer_count(), a.get_hidden_size()
    depths = parse_list(args.depths, L + 1)
    comp = (
        default_component_layers(L)
        if args.component_layers == "default"
        else parse_list(args.component_layers, L)
    )
    poolings = tuple(args.pooling.split(","))
    if (
        not docs
        or not depths
        or any(d < 0 or d > L for d in depths)
        or any(c < 0 or c >= L for c in comp)
        or len(set(poolings)) != len(poolings)
        or not set(poolings) <= {"mean", "last"}
        or not poolings
    ):
        raise ValueError("Invalid depth/component/pooling selection or empty documents")
    cfg = {
        "model_id": a.model_id,
        "revision": a.revision,
        "n_layers": L,
        "hidden_size": D,
        "depths": depths,
        "component_layers": comp,
        "component_sites": list(COMPONENT_SITES),
        "poolings": list(poolings),
        "max_tokens": args.max_tokens,
        "prefix": "<|endoftext|>",
        "prefix_in_pooling": False,
        "dtype": args.dtype,
        "store_dtype": args.store_dtype,
        "loader": args.loader,
        "seed": args.seed,
        "dataset": args.dataset,
        "dataset_format": args.dataset_format,
        "human_types": args.human_types,
        "ai_types": args.ai_types,
        "no_nll": args.no_nll,
    }
    run_path = out / "run.json"
    run = read_json(run_path) if run_path.exists() else {"config": cfg, "splits": {}}
    if run_path.exists() and run.get("checkpoint_schema") != 1:
        raise ValueError(
            "Legacy output lacks verified checkpoint identity; use a new --out"
        )
    for k in sorted(set(cfg) - {"loader"}):
        if run["config"].get(k) != cfg[k]:
            raise SystemExit(
                f"{run_path} was written with {k}={run['config'].get(k)!r}, this run has {cfg[k]!r}; "
                "use another --out"
            )

    # metadata (tokenize once, deterministic order)
    toks, metas = [], []
    for d in docs:
        body = a.tokenize(d.text)
        m = d.meta()
        m["n_tokens_full"] = len(body)
        m["n_tokens"] = min(len(body), args.max_tokens)
        m["truncated"] = len(body) > args.max_tokens
        toks.append([a.doc_prefix_id] + body[: args.max_tokens])
        metas.append(m)
    # Freeze the selected content/order and tokenization before writing metadata.
    identity = {
        "config": cfg,
        "split": args.split,
        "chunk_size": args.chunk_size,
        "batch_size": args.batch_size,
        "device": str(getattr(a, "device", args.device)),
        "runtime": library_versions(),
        "documents": [
            {
                "meta": m,
                "text_sha256": hashlib.sha256(d.text.encode()).hexdigest(),
                "tokens_sha256": digest(t),
            }
            for d, m, t in zip(docs, metas, toks)
        ],
        "implementation": {
            name: file_hash(Path(__file__).parent / name)
            for name in (
                "extract_hidden_states.py",
                "latentlens/adapter.py",
                "latentlens/capture.py",
                "latentlens/streaming.py",
                "latentlens/data.py",
                "latentlens/checkpoint.py",
            )
        },
    }
    n_chunks = (len(toks) + args.chunk_size - 1) // args.chunk_size
    checkpoint = SplitCheckpoint(sdir, identity, n_chunks)
    checkpoint.invalidate_completion()
    run["checkpoint_schema"] = 1
    atomic_json(run_path, run)  # identify interrupted first extraction
    encoded_meta = "".join(
        json.dumps(m, ensure_ascii=False) + "\n" for m in metas
    ).encode("utf-8")
    atomic_write(sdir / "meta.jsonl", lambda fh: fh.write(encoded_meta))
    from latentlens.data import stylometric_features

    atomic_write(
        sdir / "stylometry.npy",
        lambda fh: np.save(
            fh, np.array([stylometric_features(d.text) for d in docs], dtype=np.float32)
        ),
    )

    sdt = np.float16 if args.store_dtype == "float16" else np.float32
    resid_layers = sorted({d - 1 for d in depths if d >= 1})
    n_chunks = (len(toks) + args.chunk_size - 1) // args.chunk_size
    t0 = time.time()
    for c in range(n_chunks):
        lo, hi = c * args.chunk_size, min(len(toks), (c + 1) * args.chunk_size)
        schema = chunk_schema(
            hi - lo, D, depths, comp, poolings, args.store_dtype, args.no_nll
        )
        if checkpoint.load(c, schema) is not None:
            continue
        ctoks = toks[lo:hi]
        store = PooledStore(
            len(ctoks),
            D,
            {"resid_post": resid_layers, "resid_pre": [0] if 0 in depths else []},
            poolings=poolings,
        )
        cstore = (
            PooledStore(
                len(ctoks), D, {s: comp for s in COMPONENT_SITES}, poolings=("mean",)
            )
            if comp
            else None
        )
        nll = np.full(len(ctoks), np.nan, dtype=np.float32)

        def collector(site, layer, h, b, store=store, cstore=cstore, nll=nll):
            store(site, layer, h, b)
            if cstore is not None:
                cstore(site, layer, h, b)
            if site == "resid_post" and layer == L - 1 and not args.no_nll:
                for r, gi in enumerate(b.index):
                    n = int(b.mask[r].sum())
                    tgt = b.ids[r, 1:n].to(h.device)
                    tot = 0.0
                    for s in range(0, n - 1, 128):
                        lg = a.project_to_logits(h[r, s : min(s + 128, n - 1)])
                        tot += (
                            -torch.log_softmax(lg, -1)
                            .gather(1, tgt[s : s + 128, None])
                            .sum()
                            .item()
                        )
                    nll[gi] = tot / max(n - 1, 1)

        sites = {}
        for i in range(L):
            s = set()
            if i in resid_layers or (i == L - 1 and not args.no_nll):
                s.add("resid_post")
            if i == 0 and 0 in depths:
                s.add("resid_pre")
            if i in comp:
                s |= set(COMPONENT_SITES)
            if s:
                sites[i] = s
        batches = make_batches(
            ctoks, args.batch_size, pad_id=a.doc_prefix_id, skip_prefix=1
        )
        a.forward_hidden_states(batches, sites, collector)

        # residual depths in the order of `depths`: depth 0 -> resid_pre@0, depth k -> resid_post of block k-1
        arrays = {}
        for p in poolings:
            parts = []
            for dpt in depths:
                if dpt == 0:
                    parts.append(store.arrays[("resid_pre", p)][:, 0])
                else:
                    parts.append(
                        store.arrays[("resid_post", p)][:, resid_layers.index(dpt - 1)]
                    )
            arrays[f"resid_{p}"] = np.stack(parts, 1).astype(sdt)
        rms_parts = [
            store.rms["resid_pre"][:, 0]
            if dpt == 0
            else store.rms["resid_post"][:, resid_layers.index(dpt - 1)]
            for dpt in depths
        ]
        arrays["resid_rms"] = np.stack(rms_parts, 1).astype(np.float32)
        if cstore is not None:
            for s in COMPONENT_SITES:
                arrays[f"comp_{s}"] = cstore.arrays[(s, "mean")].astype(sdt)
                arrays[f"comp_{s}_rms"] = cstore.rms[s].astype(np.float32)
        arrays["nll"] = nll
        for k, v in arrays.items():
            if v.dtype == np.float16 and not np.isfinite(v).all():
                raise SystemExit(
                    f"float16 overflow in {k}; rerun with --store-dtype float32"
                )
        checkpoint.publish(c, arrays, schema)
        el = time.time() - t0
        print(
            f"[{args.split}] chunk {c + 1}/{n_chunks} ({hi} docs) {el:.0f}s", flush=True
        )

    # consolidate
    keys = None
    merged: dict = {}
    for c in range(n_chunks):
        n = min(args.chunk_size, len(toks) - c * args.chunk_size)
        z = checkpoint.load(
            c, chunk_schema(n, D, depths, comp, poolings, args.store_dtype, args.no_nll)
        )
        if z is None:
            raise ValueError("Missing completed chunk during consolidation")
        keys = keys or list(z)
        for k in keys:
            merged.setdefault(k, []).append(z[k])
    for k in keys or []:
        atomic_write(
            sdir / f"{k}.npy",
            lambda fh, values=merged[k]: np.save(fh, np.concatenate(values, 0)),
        )
    atomic_write(
        sdir / "labels.npy",
        lambda fh: np.save(fh, np.array([m["label"] for m in metas], dtype=np.int8)),
    )
    run["splits"][args.split] = {
        "n": len(metas),
        "n_human": sum(m["label"] == 0 for m in metas),
        "n_ai": sum(m["label"] == 1 for m in metas),
        "truncated": sum(m["truncated"] for m in metas),
        "dataset_report": report,
        "seconds": round(time.time() - t0, 1),
    }
    run["provenance"] = provenance(script="scripts/latentlens/extract_hidden_states.py")
    atomic_json(run_path, run)
    checkpoint.mark_complete([sdir / "meta.jsonl", *sorted(sdir.glob("*.npy"))])
    print(f"[{args.split}] {len(metas)} documents -> {sdir}")


def chunk_schema(n, hidden, depths, comp, poolings, store_dtype, no_nll):
    schema = {
        f"resid_{p}": {"shape": [n, len(depths), hidden], "dtype": store_dtype}
        for p in poolings
    }
    schema["resid_rms"] = {"shape": [n, len(depths)], "dtype": "float32"}
    schema["nll"] = {"shape": [n], "dtype": "float32", "all_nan": no_nll}
    if comp:
        for site in COMPONENT_SITES:
            schema[f"comp_{site}"] = {
                "shape": [n, len(comp), hidden],
                "dtype": store_dtype,
            }
            schema[f"comp_{site}_rms"] = {"shape": [n, len(comp)], "dtype": "float32"}
    return schema


if __name__ == "__main__":
    main()
