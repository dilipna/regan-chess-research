"""Follow one short sentence through the real model and record what Learn Mode shows.

One forward pass (teacher forcing, no generation). Recorded, all measured:
  * tokens, ids and the <|endoftext|> document-start token placed in front (position 0)
  * residual-stream RMS at every block boundary and every position; attention and MLP update sizes
  * attention weights for a few layers (eager attention, all heads)
  * q_norm / k_norm inputs and outputs (per head, last position) at a few layers
  * per-position next-token statistics (the training objective on this sentence, without any gradient)
  * the final next-token distribution after the sentence (top 50 logits, exact normalizers for several temperatures)
  * intermediate diagnostic projections of the last position at every depth (final norm + LM head)

Usage (laptop: one layer on the GPU at a time):
    .venv-latent/Scripts/python scripts/latentlens/trace_one_token.py --loader stream --device cuda
CSE GPU:
    python scripts/latentlens/trace_one_token.py --loader full --device cuda
"""

from __future__ import annotations

import argparse
import math
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from latentlens.common import provenance, results_dir, seed_everything, write_json  # noqa: E402

ATTN_LAYERS = (0, 1, 2, 8, 17, 26, 34, 35)
QK_LAYERS = (0, 17, 35)
TEMPERATURES = (0.25, 0.5, 0.7, 1.0, 1.5, 2.0)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", default="Qwen/Qwen3-8B-Base")
    ap.add_argument("--text", default="The researcher opened the notebook")
    ap.add_argument("--loader", default="stream", choices=["stream", "full"])
    ap.add_argument("--device", default="cuda")
    ap.add_argument("--dtype", default="bfloat16")
    ap.add_argument("--top", type=int, default=50)
    ap.add_argument("--local-files-only", action="store_true")
    args = ap.parse_args()

    import torch
    from latentlens.adapter import Qwen3Adapter, make_batches
    from latentlens.capture import ATTN_WEIGHTS
    from latentlens.recall import score_logits

    seed_everything(0)
    t0 = time.time()
    a = Qwen3Adapter(args.model, device=args.device, dtype=args.dtype, loader=args.loader,
                     attn_implementation="eager", local_files_only=args.local_files_only)
    a.load_model()
    tok = a.tokenizer
    ids = [a.doc_prefix_id] + a.tokenize(args.text)
    T, L = len(ids), a.get_layer_count()
    batch = make_batches([ids], 1, pad_id=a.doc_prefix_id, skip_prefix=1)

    store: dict = {}

    def collect(site, layer, h, b):
        store[(site, layer)] = h[0].float().cpu()

    qk: dict = {}

    def layer_cb(i, layer, _ref):
        if i not in QK_LAYERS:
            return []
        hs = []
        for name in ("q_norm", "k_norm"):
            mod = getattr(layer.self_attn, name)

            def hook(_m, inp, out, name=name):
                qk[(name, i)] = (inp[0][0, -1].float().cpu(), out[0, -1].float().cpu())   # [heads, head_dim]
            hs.append(mod.register_forward_hook(hook))
        return hs

    sites = {i: {"resid_pre", "attn_norm", "attn_out", "resid_mid", "mlp_norm", "mlp_out", "resid_post"} for i in range(L)}
    for i in ATTN_LAYERS:
        if i < L:
            sites[i].add(ATTN_WEIGHTS)
    a.forward_hidden_states(batch, sites, collect, embed_collector=collect, layer_callback=layer_cb)

    def rms(x):
        return x.pow(2).mean(-1).sqrt()

    # residual stream: depth 0 = embeddings, depth k = output of block k-1
    resid = [store[("embed", -1)]] + [store[("resid_post", i)] for i in range(L)]
    layers = []
    for i in range(L):
        pre, att, mid, mlp, post = (store[(s, i)] for s in ("resid_pre", "attn_out", "resid_mid", "mlp_out", "resid_post"))
        last = T - 1
        layers.append({
            "layer": i,
            "resid_pre_rms": rms(pre).tolist(), "attn_out_rms": rms(att).tolist(), "resid_mid_rms": rms(mid).tolist(),
            "mlp_out_rms": rms(mlp).tolist(), "resid_post_rms": rms(post).tolist(),
            "attn_norm_rms": rms(store[("attn_norm", i)]).tolist(), "mlp_norm_rms": rms(store[("mlp_norm", i)]).tolist(),
            "last": {"resid_pre_l2": pre[last].norm().item(), "attn_out_l2": att[last].norm().item(),
                     "mlp_out_l2": mlp[last].norm().item(), "resid_post_l2": post[last].norm().item(),
                     "cos_pre_post": torch.nn.functional.cosine_similarity(pre[last], post[last], dim=0).item(),
                     "max_abs_coord": post[last].abs().max().item(), "argmax_abs_coord": int(post[last].abs().argmax())},
            "pos0_max_abs_coord": post[0].abs().max().item(),
            "pos0_argmax_abs_coord": int(post[0].abs().argmax()),
        })

    attn = {}
    for i in ATTN_LAYERS:
        w = store.get((ATTN_WEIGHTS, i))
        if w is not None:
            attn[str(i)] = [[[round(v, 4) for v in row] for row in head] for head in w.tolist()]   # [H][T][T]

    qk_out = {}
    for (name, i), (x_in, x_out) in sorted(qk.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        qk_out.setdefault(str(i), {})[name] = {
            "shape_per_token": list(x_in.shape), "rms_in": rms(x_in).tolist(), "rms_out": rms(x_out).tolist()}

    # per-position next-token statistics (positions 0..T-2 predict ids[1..T-1])
    final_resid = resid[-1]
    logits_all = a.project_to_logits(final_resid)                        # [T, V], real model output
    tgt = torch.tensor(ids[1:])
    st = score_logits(logits_all[:-1], tgt.to(logits_all.device))
    positions = []
    for t in range(T - 1):
        top5 = logits_all[t].topk(5)
        pr = torch.softmax(logits_all[t], -1)
        positions.append({
            "context": tok.decode(ids[1:t + 1]), "true_next": tok.decode([ids[t + 1]]), "true_id": ids[t + 1],
            "rank": int(st["rank"][t]), "p_true": float(st["p_true"][t]), "loss_nats": float(-st["logp_true"][t]),
            "entropy": float(st["entropy"][t]),
            "top": [{"id": int(j), "text": tok.decode([int(j)]), "p": float(pr[j])} for j in top5.indices.tolist()]})

    # final distribution after the whole sentence
    z = logits_all[-1].float()
    order = z.topk(args.top)
    lse = {str(tau): float(torch.logsumexp(z / tau, 0)) for tau in TEMPERATURES}
    p1 = torch.softmax(z, 0)
    final = {"top": [{"id": int(j), "text": tok.decode([int(j)]), "piece": tok.convert_ids_to_tokens(int(j)),
                      "logit": float(z[j]), "p": float(p1[j])} for j in order.indices.tolist()],
             "logsumexp_by_temperature": lse, "entropy": float(-(p1 * p1.clamp_min(1e-30).log()).sum()),
             "vocab_rows": int(z.numel()), "top_mass": float(p1[order.indices].sum())}

    # diagnostic projection of the last position at every depth
    final_top = int(z.argmax())
    lens = []
    for k, r in enumerate(resid):
        zk = a.project_to_logits(r[-1:])[0]
        pk = torch.softmax(zk, 0)
        top = zk.topk(5).indices.tolist()
        lens.append({"depth": k, "top": [{"id": int(j), "text": tok.decode([int(j)]), "p": float(pk[j])} for j in top],
                     "final_top_rank": int((zk > zk[final_top]).sum()) + 1, "final_top_p": float(pk[final_top])})

    res = {
        "schema": "latentlens.token_trace/1", "status": "ok", "model_id": a.model_id, "revision": a.revision,
        "text": args.text, "dtype": args.dtype, "loader": args.loader, "attn_implementation": "eager",
        "tokens": [{"pos": p, "id": int(i), "piece": tok.convert_ids_to_tokens(int(i)), "text": tok.decode([int(i)]),
                    "prefix": p == 0} for p, i in enumerate(ids)],
        "n_layers": L, "hidden_size": a.get_hidden_size(),
        "embedding_rms": rms(resid[0]).tolist(),
        "layers": layers, "attention": {"layers": list(attn), "weights": attn}, "qk_norm": qk_out,
        "positions": positions, "sentence_loss_nats": float(-st["logp_true"].mean()),
        "final": final, "diagnostic_lens_last_position": lens,
        "notes": ["Position 0 is <|endoftext|>, the document-start token added by LatentLens (the tokenizer adds none).",
                  "Depth 0 is the embedding output; depth k is the residual stream after block k.",
                  "Diagnostic projections apply the final RMSNorm and LM head to earlier residuals. Only depth "
                  f"{L} is the model's actual output."],
        "runtime_s": round(time.time() - t0, 1),
        "provenance": provenance(script="scripts/latentlens/trace_one_token.py", loader=args.loader),
    }
    out = results_dir(a.model_id) / "token_trace.json"
    write_json(out, res, digits=6)
    print(f"next-token top 5 after {args.text!r}: {[(d['text'], round(d['p'], 4)) for d in final['top'][:5]]}")
    print(f"sentence loss {res['sentence_loss_nats']:.3f} nats; {res['runtime_s']}s -> {out}")
    a.cleanup()
    _ = math


if __name__ == "__main__":
    main()
