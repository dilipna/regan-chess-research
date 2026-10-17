"""Glass Box: record every intermediate tensor of a few real Qwen3 blocks for one token, so the website can show the real
numbers and re-derive each operation that does not need the large weight matrices.

One forward pass (eager attention, teacher forcing) of a short sentence. At each chosen block, forward hooks read, at
module boundaries and for the QUERY position (the last token):
  resid_pre -> input_layernorm -> attn_norm
  q_proj -> view(heads) -> q_norm -> RoPE -> q_rope        (and the same for k at the query position)
  k_rope and v for EVERY position (needed to recompute the scores and the weighted sum)
  attention probabilities (eager) -> per-head weighted sum (o_proj input) -> o_proj output
  resid_mid -> post_attention_layernorm -> mlp_norm -> gate_proj, up_proj -> SiLU(gate)*up (down_proj input) -> down_proj
  resid_post
plus the learned gains of the four RMSNorms in that block. RoPE is applied with transformers' own apply_rotary_pos_emb
to the recorded cos/sin; the browser recomputes cos/sin independently from theta.

Output: results/latentlens/<model>/glassbox/manifest.json + layer_<k>.bin (little-endian float32, offsets in the manifest).
The manifest also stores the same verification ledger computed here in Python, so the browser's re-derivation can be
compared with it.

Usage:
    .venv-latent/Scripts/python scripts/latentlens/capture_glassbox.py --loader stream --device cuda --layers 0,17,35
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from latentlens.common import provenance, results_dir, seed_everything, write_json  # noqa: E402


def verify(arrs: dict, eps: float, n_heads: int, kv_heads: int, head_dim: int, theta: float, qpos: int) -> list[dict]:
    """The same checks the browser runs, in numpy float64. Each returns max |a-b| / max|b| and the median relative error."""
    import numpy as np

    def cmp(name, got, ref, needs):
        got, ref = np.asarray(got, np.float64).ravel(), np.asarray(ref, np.float64).ravel()
        scale = np.abs(ref).max() + 1e-12
        rel = np.abs(got - ref) / (np.abs(ref) + 1e-3 * scale)
        return {"check": name, "max_err_rel_to_max": float(np.abs(got - ref).max() / scale), "median_rel_err": float(np.median(rel)), "uses": needs}

    def rmsn(x, g):
        x = np.asarray(x, np.float64)
        return np.asarray(g, np.float64) * x / np.sqrt((x * x).mean(-1, keepdims=True) + eps)

    out = [cmp("RMSNorm #1 (input_layernorm)", rmsn(arrs["resid_pre"], arrs["gain_in"]), arrs["attn_norm"], "resid_pre, learned gain")]
    q = np.asarray(arrs["q_raw"], np.float64).reshape(n_heads, head_dim)
    out.append(cmp("Q RMSNorm (q_norm, per head)", rmsn(q, arrs["gain_q"]), np.asarray(arrs["q_normed"]).reshape(n_heads, head_dim), "q_proj output, q_norm gain"))
    k = np.asarray(arrs["k_raw"], np.float64).reshape(kv_heads, head_dim)
    out.append(cmp("K RMSNorm (k_norm, per head)", rmsn(k, arrs["gain_k"]), np.asarray(arrs["k_normed"]).reshape(kv_heads, head_dim), "k_proj output, k_norm gain"))
    inv = theta ** (-np.arange(0, head_dim, 2) / head_dim)
    ang = np.concatenate([qpos * inv, qpos * inv])
    qn = np.asarray(arrs["q_normed"], np.float64).reshape(n_heads, head_dim)
    rot = np.concatenate([-qn[:, head_dim // 2:], qn[:, :head_dim // 2]], -1)
    out.append(cmp("RoPE on Q (rotate-half, theta)", qn * np.cos(ang) + rot * np.sin(ang), np.asarray(arrs["q_rope"]).reshape(n_heads, head_dim), "q after q_norm, position, theta"))
    T = qpos + 1
    kr = np.asarray(arrs["k_rope_all"], np.float64).reshape(T, kv_heads, head_dim)
    vv = np.asarray(arrs["v_all"], np.float64).reshape(T, kv_heads, head_dim)
    qr = np.asarray(arrs["q_rope"], np.float64).reshape(n_heads, head_dim)
    g = n_heads // kv_heads
    scores = np.einsum("hd,thd->ht", qr, kr[:, np.arange(n_heads) // g, :]) / np.sqrt(head_dim)
    probs = np.exp(scores - scores.max(-1, keepdims=True))
    probs /= probs.sum(-1, keepdims=True)
    out.append(cmp("scores, scaling and softmax (causal: all keys up to the query)", probs, np.asarray(arrs["attn_probs"]).reshape(n_heads, T), "q_rope, k_rope of every position"))
    rec_p = np.asarray(arrs["attn_probs"], np.float64).reshape(n_heads, T)
    ws = np.einsum("ht,thd->hd", rec_p, vv[:, np.arange(n_heads) // g, :])
    out.append(cmp("weighted sum of values (per head, grouped KV)", ws, np.asarray(arrs["attn_concat"]).reshape(n_heads, head_dim), "attention probabilities, v of every position"))
    out.append(cmp("residual addition #1", np.asarray(arrs["resid_pre"], np.float64) + arrs["o_out"], arrs["resid_mid"], "resid_pre, o_proj output"))
    out.append(cmp("RMSNorm #2 (post_attention_layernorm)", rmsn(arrs["resid_mid"], arrs["gain_post"]), arrs["mlp_norm"], "resid_mid, learned gain"))
    gate = np.asarray(arrs["gate"], np.float64)
    out.append(cmp("SwiGLU: SiLU(gate) x up", gate / (1 + np.exp(-gate)) * arrs["up"], arrs["act_prod"], "gate_proj and up_proj outputs"))
    out.append(cmp("residual addition #2", np.asarray(arrs["resid_mid"], np.float64) + arrs["down"], arrs["resid_post"], "resid_mid, down_proj output"))
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", default="Qwen/Qwen3-8B-Base")
    ap.add_argument("--text", default="The researcher opened the notebook")
    ap.add_argument("--layers", default="0,17,35")
    ap.add_argument("--loader", default="stream", choices=["stream", "full"])
    ap.add_argument("--device", default="cuda")
    ap.add_argument("--dtype", default="bfloat16")
    ap.add_argument("--out", default=None)
    ap.add_argument("--local-files-only", action="store_true")
    args = ap.parse_args()

    import numpy as np
    import torch
    from transformers.models.qwen3.modeling_qwen3 import apply_rotary_pos_emb
    from latentlens.adapter import Qwen3Adapter, make_batches

    seed_everything(0)
    t0 = time.time()
    a = Qwen3Adapter(args.model, device=args.device, dtype=args.dtype, loader=args.loader, attn_implementation="eager",
                     local_files_only=args.local_files_only)
    a.load_model()
    cfg = a.config
    H, KV, D = cfg.num_attention_heads, cfg.num_key_value_heads, getattr(cfg, "head_dim", cfg.hidden_size // cfg.num_attention_heads)
    theta = (getattr(cfg, "rope_parameters", None) or {}).get("rope_theta", getattr(cfg, "rope_theta", None))
    want = [int(x) for x in args.layers.split(",")]
    want = [l if l >= 0 else a.get_layer_count() + l for l in want]
    ids = [a.doc_prefix_id] + a.tokenize(args.text)
    T, qp = len(ids), len(ids) - 1
    rec: dict[int, dict] = {l: {} for l in want}
    f32 = lambda t: t.detach().float().cpu()  # noqa: E731

    def cb(i, layer, _ref):
        if i not in rec:
            return []
        R, sa, hs = rec[i], layer.self_attn, []
        R["gain_in"] = f32(layer.input_layernorm.weight); R["gain_post"] = f32(layer.post_attention_layernorm.weight)
        R["gain_q"] = f32(sa.q_norm.weight); R["gain_k"] = f32(sa.k_norm.weight)

        def keep(name, fn):
            def h(_m, inp, out):
                R[name] = fn(inp, out)
            return h
        hs.append(layer.input_layernorm.register_forward_hook(keep("ln1", lambda i_, o: (f32(i_[0][0]), f32(o[0])))))
        hs.append(sa.q_proj.register_forward_hook(keep("q_proj", lambda i_, o: f32(o[0]))))
        hs.append(sa.k_proj.register_forward_hook(keep("k_proj", lambda i_, o: f32(o[0]))))
        hs.append(sa.v_proj.register_forward_hook(keep("v_proj", lambda i_, o: f32(o[0]))))
        hs.append(sa.q_norm.register_forward_hook(keep("q_norm", lambda i_, o: o[0].detach())))
        hs.append(sa.k_norm.register_forward_hook(keep("k_norm", lambda i_, o: o[0].detach())))

        def attn_hook(_m, _args, kwargs, out):
            cos, sin = kwargs["position_embeddings"]
            R["cos_sin"] = (cos.detach(), sin.detach())
            R["probs"] = f32(out[1][0])
            R["o_out"] = f32(out[0][0])
        hs.append(sa.register_forward_hook(attn_hook, with_kwargs=True))
        hs.append(sa.o_proj.register_forward_pre_hook(lambda _m, inp: R.__setitem__("concat", f32(inp[0][0]))))
        hs.append(layer.post_attention_layernorm.register_forward_hook(keep("ln2", lambda i_, o: (f32(i_[0][0]), f32(o[0])))))
        hs.append(layer.mlp.gate_proj.register_forward_hook(keep("gate", lambda i_, o: f32(o[0]))))
        hs.append(layer.mlp.up_proj.register_forward_hook(keep("up", lambda i_, o: f32(o[0]))))
        hs.append(layer.mlp.down_proj.register_forward_pre_hook(lambda _m, inp: R.__setitem__("act_prod", f32(inp[0][0]))))
        hs.append(layer.mlp.down_proj.register_forward_hook(keep("down", lambda i_, o: f32(o[0]))))
        hs.append(layer.register_forward_hook(keep("post", lambda i_, o: f32((o[0] if isinstance(o, tuple) else o)[0]))))
        return hs

    a.forward_hidden_states(make_batches([ids], 1, a.doc_prefix_id), {}, lambda *x: None, layer_callback=cb)

    out_dir = Path(args.out) if args.out else results_dir(a.model_id) / "glassbox"
    out_dir.mkdir(parents=True, exist_ok=True)
    layers_meta = []
    for l in want:
        R = rec[l]
        qn, kn = R["q_norm"], R["k_norm"]                   # [T, H, D], [T, KV, D] in model dtype
        cos, sin = R["cos_sin"]
        q_rope, k_rope = apply_rotary_pos_emb(qn[None].transpose(1, 2), kn[None].transpose(1, 2), cos, sin)
        q_rope, k_rope = f32(q_rope[0].transpose(0, 1)), f32(k_rope[0].transpose(0, 1))   # [T, H, D], [T, KV, D]
        arrs = {
            "resid_pre": R["ln1"][0][qp], "gain_in": R["gain_in"], "attn_norm": R["ln1"][1][qp],
            "q_raw": R["q_proj"][qp], "gain_q": R["gain_q"], "q_normed": f32(qn[qp]).reshape(-1), "q_rope": q_rope[qp].reshape(-1),
            "k_raw": R["k_proj"][qp], "gain_k": R["gain_k"], "k_normed": f32(kn[qp]).reshape(-1),
            "k_rope_all": k_rope.reshape(-1), "v_all": R["v_proj"].reshape(-1),
            "attn_probs": R["probs"][:, qp, :T].reshape(-1), "attn_concat": R["concat"][qp], "o_out": R["o_out"][qp],
            "resid_mid": R["ln2"][0][qp], "gain_post": R["gain_post"], "mlp_norm": R["ln2"][1][qp],
            "gate": R["gate"][qp], "up": R["up"][qp], "act_prod": R["act_prod"][qp], "down": R["down"][qp], "resid_post": R["post"][qp],
        }
        shapes = {"resid_pre": [cfg.hidden_size], "gain_in": [cfg.hidden_size], "attn_norm": [cfg.hidden_size], "q_raw": [H, D], "gain_q": [D],
                  "q_normed": [H, D], "q_rope": [H, D], "k_raw": [KV, D], "gain_k": [D], "k_normed": [KV, D], "k_rope_all": [T, KV, D],
                  "v_all": [T, KV, D], "attn_probs": [H, T], "attn_concat": [H, D], "o_out": [cfg.hidden_size], "resid_mid": [cfg.hidden_size],
                  "gain_post": [cfg.hidden_size], "mlp_norm": [cfg.hidden_size], "gate": [cfg.intermediate_size], "up": [cfg.intermediate_size],
                  "act_prod": [cfg.intermediate_size], "down": [cfg.hidden_size], "resid_post": [cfg.hidden_size]}
        np_arrs = {k: v.numpy().astype(np.float32).ravel() for k, v in arrs.items()}
        for k, v in np_arrs.items():
            assert v.size == int(np.prod(shapes[k])), (k, v.size, shapes[k])
        blob, index, off = [], [], 0
        for k in shapes:
            blob.append(np_arrs[k]); index.append({"name": k, "shape": shapes[k], "offset": off}); off += np_arrs[k].size
        fname = f"layer_{l:02d}.bin"
        np.concatenate(blob).astype("<f4").tofile(out_dir / fname)
        ledger = verify(np_arrs, cfg.rms_norm_eps, H, KV, D, theta, qp)
        layers_meta.append({"layer": l, "file": fname, "floats": off, "arrays": index, "python_ledger": ledger})
        print(f"block {l + 1}: " + "; ".join(f"{c['check'].split(' (')[0]} {c['max_err_rel_to_max']:.1e}" for c in ledger), flush=True)

    tok = a.tokenizer
    manifest = {
        "schema": "latentlens.glassbox/1", "status": "ok", "model_id": a.model_id, "revision": a.revision, "dtype": args.dtype,
        "loader": args.loader, "attn_implementation": "eager", "text": args.text,
        "tokens": [{"pos": p, "id": int(i), "text": tok.decode([int(i)]), "prefix": p == 0} for p, i in enumerate(ids)],
        "query_position": qp, "n_heads": H, "n_kv_heads": KV, "head_dim": D, "hidden_size": cfg.hidden_size,
        "intermediate_size": cfg.intermediate_size, "rms_norm_eps": cfg.rms_norm_eps, "rope_theta": theta, "n_layers": a.get_layer_count(),
        "layers": layers_meta, "byte_order": "little-endian float32",
        "notes": ["All tensors are for the query position (the last token) except k_rope_all and v_all, which hold every position.",
                  "The model computed in bfloat16; values were converted to float32 for storage, so re-derivations agree to bfloat16 precision.",
                  "Matrix multiplications by q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj and the LM head need the weight "
                  "matrices (about 16 GB) and are shown as recorded inputs and outputs, not re-derived."],
        "runtime_s": round(time.time() - t0, 1),
        "provenance": provenance(script="scripts/latentlens/capture_glassbox.py", loader=args.loader),
    }
    write_json(out_dir / "manifest.json", manifest)
    print("->", out_dir)
    a.cleanup()


if __name__ == "__main__":
    main()
