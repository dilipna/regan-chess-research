"""Recall Microscope: next-token recall of a passage, and how the true token's rank changes with depth.

For every position t of each passage (teacher forcing: the model always conditions on the true prefix), record
  context position, true next token, the model's top predicted token, true-token probability and rank,
  top-token probability, top-1 correct, entropy and margin (true-token logit minus the best other logit).
Then, for every depth k (0 = embeddings, k = after block k), apply the model's own final RMSNorm and LM head to the
residual stream ("intermediate diagnostic projection") and record the true token's rank, the top projected token and
the margin. Only depth L is the model's actual prediction.

The passage is preceded by <|endoftext|> (the document separator of Qwen base models), so the first real token is
scored too. Recall rate = fraction of scored positions whose true next token is the model's top-1 token.

Usage:
    .venv-latent/Scripts/python scripts/latentlens/run_recall_analysis.py --loader stream \
        --input scripts/latentlens/passages/gettysburg_address.txt --name "Gettysburg Address" \
        --input scripts/latentlens/passages/control_original.txt --name "Original control paragraph"
    python scripts/latentlens/run_recall_analysis.py --model Qwen/Qwen3-8B-Base --loader full --input speech.txt --no-store-text
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from latentlens.common import model_slug, provenance, results_dir, seed_everything, write_json  # noqa: E402


def analyze(adapter, text: str, name: str, store_text: bool, max_tokens: int) -> dict:
    import torch
    from latentlens.adapter import make_batches
    from latentlens.recall import project_and_score, stabilization_depth, summarize

    tok = adapter.tokenizer
    body = adapter.tokenize(text)[: max_tokens]
    ids = [adapter.doc_prefix_id] + body
    T, L = len(ids), adapter.get_layer_count()
    store: dict = {}

    def collect(site, layer, h, b):
        store[(site, layer)] = h[0].float().cpu()

    adapter.forward_hidden_states(make_batches([ids], 1, adapter.doc_prefix_id, skip_prefix=1),
                                  {i: {"resid_post"} for i in range(L)}, collect, embed_collector=collect)
    resid = [store[("embed", -1)]] + [store[("resid_post", i)] for i in range(L)]
    targets = torch.tensor(ids[1:])
    by_depth = [project_and_score(adapter, r[:-1], targets) for r in resid]           # depth 0..L
    final = by_depth[-1]
    n = T - 1

    vocab_used: dict[int, str] = {}

    def txt(i: int) -> str | None:
        if not store_text:
            return None
        vocab_used.setdefault(int(i), tok.decode([int(i)]))
        return vocab_used[int(i)]

    positions = []
    for t in range(n):
        positions.append({"t": t, "true_id": int(targets[t]) if store_text else None, "true": txt(targets[t]),
                          "top_id": int(final["top_id"][t]) if store_text else None, "top": txt(final["top_id"][t]),
                          "rank": int(final["rank"][t]), "p_true": float(final["p_true"][t]), "p_top": float(final["p_top"][t]),
                          "top1": bool(final["rank"][t] == 1), "entropy": float(final["entropy"][t]),
                          "margin": float(final["margin"][t]),
                          "stabilization_depth": stabilization_depth([int(d["top_id"][t]) for d in by_depth], int(final["top_id"][t]))})
    depth = []
    for k, d in enumerate(by_depth):
        r = d["rank"].float()
        depth.append({"depth": k, "relative_depth": k / L, "top1_rate": float((r == 1).float().mean()),
                      "top10_rate": float((r <= 10).float().mean()), "median_rank": float(r.median()),
                      "mean_log10_rank": float(r.log10().mean()), "mean_margin": float(d["margin"].mean()),
                      "agree_with_final_top": float((d["top_id"] == final["top_id"]).float().mean()),
                      "rank": [int(x) for x in d["rank"]],
                      "top_id": [int(x) for x in d["top_id"]] if store_text else None,
                      "p_true": [round(float(x), 5) for x in d["p_true"]]})
    if store_text:
        for d in depth:
            for j in d["top_id"]:
                txt(j)
    stab = [p["stabilization_depth"] for p in positions if p["stabilization_depth"] is not None]
    return {"name": name, "n_tokens": len(body), "n_scored": n, "truncated": len(adapter.tokenize(text)) > max_tokens,
            "summary": summarize(final), "positions": positions, "depth": depth,
            "median_stabilization_depth": float(torch.tensor(stab, dtype=torch.float).median()) if stab else None,
            "token_text": {str(k): v for k, v in vocab_used.items()} if store_text else None,
            "text_stored": store_text}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", default="Qwen/Qwen3-8B-Base")
    ap.add_argument("--revision", default=None)
    ap.add_argument("--input", action="append", required=True, help="text file (repeatable)")
    ap.add_argument("--name", action="append", help="display name for each --input, in order")
    ap.add_argument("--loader", default="stream", choices=["stream", "full"])
    ap.add_argument("--device", default="cuda")
    ap.add_argument("--dtype", default="bfloat16")
    ap.add_argument("--max-tokens", type=int, default=1024)
    ap.add_argument("--no-store-text", action="store_true", help="store statistics only (for copyrighted inputs)")
    ap.add_argument("--out", default=None)
    ap.add_argument("--local-files-only", action="store_true")
    args = ap.parse_args()

    from latentlens.adapter import Qwen3Adapter
    seed_everything(0)
    names = args.name or []
    t0 = time.time()
    a = Qwen3Adapter(args.model, revision=args.revision, device=args.device, dtype=args.dtype, loader=args.loader,
                     local_files_only=args.local_files_only)
    a.load_model()
    passages = []
    for k, path in enumerate(args.input):
        text = Path(path).read_text(encoding="utf-8").strip()
        name = names[k] if k < len(names) else Path(path).stem
        res = analyze(a, text, name, store_text=not args.no_store_text, max_tokens=args.max_tokens)
        res["source_file"] = Path(path).name
        passages.append(res)
        s = res["summary"]
        print(f"{name}: {res['n_scored']} positions, top-1 recall {s['top1_rate']:.3f}, top-5 {s['top5_rate']:.3f}, "
              f"median rank {s['median_rank']:.0f}, median stabilization depth {res['median_stabilization_depth']}")
    out = {"schema": "latentlens.recall/1", "status": "ok", "model_id": a.model_id, "revision": a.revision,
           "model_slug": model_slug(a.model_id), "n_layers": a.get_layer_count(), "dtype": args.dtype, "loader": args.loader,
           "prefix": "<|endoftext|>", "scoring": "teacher forcing; every token after the prefix is scored",
           "diagnostic_projection": "final RMSNorm (model.norm) + LM head applied to the residual stream after each block",
           "passages": passages, "runtime_s": round(time.time() - t0, 1),
           "provenance": provenance(script="scripts/latentlens/run_recall_analysis.py")}
    path = Path(args.out) if args.out else results_dir(a.model_id) / "recall_probe.json"
    write_json(path, out, digits=5)
    print("->", path)
    a.cleanup()


if __name__ == "__main__":
    main()
