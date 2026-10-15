"""Inspect and verify the architecture of a Qwen3 checkpoint; write results/latentlens/<model>/architecture.json.

Every fact in the output records where it was verified, in this priority:
  1. the instantiated model object (built on the 'meta' device: exact module tree and parameter shapes, no weight memory)
  2. the installed transformers Qwen3 implementation (source of the forward functions, checked programmatically)
  3. the checkpoint's config.json and safetensors headers (stored tensor names and shapes)
  4. the model card shipped with the checkpoint (README.md)
Learned RMSNorm gains are read from the stored weights (small vectors only).

Usage:
    .venv-latent/Scripts/python scripts/latentlens/inspect_qwen_architecture.py --model Qwen/Qwen3-8B-Base
"""

from __future__ import annotations

import argparse
import hashlib
import inspect
import json
import math
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from latentlens.common import PINNED_REVISIONS, provenance, results_dir, write_json  # noqa: E402


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source_checks(mod) -> list[dict]:
    """Verify operation order directly in the installed implementation. Each check stores the evidence lines."""
    att = inspect.getsource(mod.Qwen3Attention.forward)
    att_init = inspect.getsource(mod.Qwen3Attention.__init__)
    layer = inspect.getsource(mod.Qwen3DecoderLayer.forward)
    mlp = inspect.getsource(mod.Qwen3MLP.forward)
    norm = inspect.getsource(mod.Qwen3RMSNorm.forward)
    rot = inspect.getsource(mod.rotate_half)
    model_fwd = inspect.getsource(mod.Qwen3Model.forward)

    def lines(src, *pats):
        return [l.strip() for l in src.splitlines() if any(p in l for p in pats)]

    def pos(src, s):
        i = src.find(s)
        assert i >= 0, f"pattern not found in installed source: {s!r}"
        return i

    checks = []

    def add(fact, ok, evidence):
        checks.append({"fact": fact, "verified": bool(ok), "evidence": evidence})

    add("Block is pre-norm: input_layernorm is applied before self_attn, and the residual is added after it",
        pos(layer, "self.input_layernorm(") < pos(layer, "self.self_attn(") < pos(layer, "hidden_states = residual + hidden_states"),
        lines(layer, "residual =", "input_layernorm(", "self.self_attn(", "residual + hidden_states", "post_attention_layernorm(", "self.mlp("))
    add("Second sub-layer: post_attention_layernorm, then MLP, then the second residual addition",
        pos(layer, "self.post_attention_layernorm(") < pos(layer, "self.mlp(") < layer.rfind("residual + hidden_states"),
        lines(layer, "post_attention_layernorm(", "self.mlp("))
    add("q_norm and k_norm are RMSNorms over head_dim (one head vector at a time), not over hidden_size",
        "Qwen3RMSNorm(self.head_dim" in att_init, lines(att_init, "q_norm", "k_norm"))
    add("q_norm / k_norm are applied after the projection and reshape to heads, and before RoPE",
        pos(att, "self.q_norm(") < pos(att, "apply_rotary_pos_emb(") and pos(att, "self.k_norm(") < pos(att, "apply_rotary_pos_emb("),
        lines(att, "q_norm(", "k_norm(", "v_proj(", "apply_rotary_pos_emb("))
    add("V is not normalized and not rotated", "v_norm" not in att and "value_states = self.v_proj(hidden_states).view(hidden_shape)" in att,
        lines(att, "value_states ="))
    add("RoPE rotates Q and K only (applied inside attention, not added to the residual stream)",
        "query_states, key_states = apply_rotary_pos_emb(" in att and "rotary" not in layer,
        lines(att, "apply_rotary_pos_emb("))
    add("RoPE uses the rotate-half pairing (dimension i with i + head_dim/2), not interleaved pairs",
        "x[..., : x.shape[-1] // 2]" in rot and "torch.cat((-x2, x1)" in rot, lines(rot, "x1 =", "x2 =", "torch.cat"))
    add("Attention scores are scaled by head_dim ** -0.5", "self.scaling = self.head_dim**-0.5" in att_init,
        lines(att_init, "self.scaling"))
    add("Grouped-query attention: K/V heads are shared by num_attention_heads // num_key_value_heads query heads",
        "self.num_key_value_groups = config.num_attention_heads // config.num_key_value_heads" in att_init,
        lines(att_init, "num_key_value_groups"))
    add("Attention is causal", "self.is_causal = True" in att_init, lines(att_init, "is_causal"))
    add("MLP is SwiGLU: down_proj(act(gate_proj(x)) * up_proj(x))",
        "self.down_proj(self.act_fn(self.gate_proj(x)) * self.up_proj(x))" in mlp, lines(mlp, "down_proj"))
    add("RMSNorm computes in float32: x * rsqrt(mean(x^2) + eps), then multiplies by a learned gain (no bias, no mean subtraction)",
        "pow(2).mean(-1, keepdim=True)" in norm and "torch.rsqrt(variance + self.variance_epsilon)" in norm
        and "self.weight * hidden_states" in norm and ".mean(-1, keepdim=True)" in norm and "- hidden_states.mean" not in norm,
        lines(norm, "float32", "variance", "rsqrt", "self.weight"))
    add("A final RMSNorm (model.norm) follows the last decoder layer", "hidden_states = self.norm(hidden_states)" in model_fwd,
        lines(model_fwd, "self.norm("))
    return checks


def norm_gain_stats(root: Path, weight_map: dict, n_layers: int) -> dict:
    """Summary statistics of the learned RMSNorm gain vectors g (read from the stored weights)."""
    from safetensors import safe_open

    def get(name):
        with safe_open(str(root / weight_map[name]), framework="pt") as fh:
            return fh.get_tensor(name).float()

    def stats(t):
        return {"mean": t.mean().item(), "std": t.std().item(), "min": t.min().item(), "max": t.max().item(),
                "abs_max": t.abs().max().item(), "dim": int(t.numel())}

    out = {"input_layernorm": [], "post_attention_layernorm": [], "q_norm": [], "k_norm": []}
    for i in range(n_layers):
        for k, name in (("input_layernorm", f"model.layers.{i}.input_layernorm.weight"),
                        ("post_attention_layernorm", f"model.layers.{i}.post_attention_layernorm.weight"),
                        ("q_norm", f"model.layers.{i}.self_attn.q_norm.weight"),
                        ("k_norm", f"model.layers.{i}.self_attn.k_norm.weight")):
            out[k].append({"layer": i, **stats(get(name))})
    out["final_norm"] = stats(get("model.norm.weight"))
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", default="Qwen/Qwen3-8B-Base")
    ap.add_argument("--revision", default=None)
    ap.add_argument("--local-files-only", action="store_true")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    import torch
    import transformers
    from huggingface_hub import snapshot_download
    from transformers import AutoConfig, AutoModelForCausalLM, AutoTokenizer
    from transformers.models.qwen3 import modeling_qwen3

    rev = args.revision or PINNED_REVISIONS.get(args.model)
    root = Path(snapshot_download(args.model, revision=rev, local_files_only=args.local_files_only,
                                  allow_patterns=["*.json", "*.txt", "README.md"]))
    cfg_path = root / "config.json"
    raw_cfg = json.loads(cfg_path.read_text())
    cfg = AutoConfig.from_pretrained(root)
    assert cfg.model_type == "qwen3", cfg.model_type

    # 1. instantiate on the meta device: exact parameter shapes without allocating weights
    with torch.device("meta"):
        model = AutoModelForCausalLM.from_config(cfg)
    named = dict(model.named_parameters())
    tied = model.lm_head.weight is model.model.embed_tokens.weight
    n_layers = len(model.model.layers)
    L0 = model.model.layers[0]

    def count(prefix):
        return sum(p.numel() for n, p in named.items() if n.startswith(prefix))

    total_unique = sum(p.numel() for p in {id(p): p for p in model.parameters()}.values())
    embed = model.model.embed_tokens.weight.numel()
    lm_head = 0 if tied else model.lm_head.weight.numel()
    per_layer = {
        "attention_projections": sum(p.numel() for n, p in L0.self_attn.named_parameters() if n.endswith("proj.weight")),
        "qk_norm": L0.self_attn.q_norm.weight.numel() + L0.self_attn.k_norm.weight.numel(),
        "mlp": sum(p.numel() for p in L0.mlp.parameters()),
        "block_norms": L0.input_layernorm.weight.numel() + L0.post_attention_layernorm.weight.numel(),
    }
    per_layer["total"] = sum(per_layer.values())
    layer_params = [{"name": n, "shape": list(p.shape), "numel": p.numel()} for n, p in L0.named_parameters()]
    module_tree = [{"name": n, "type": type(m).__name__, "repr": m.extra_repr()} for n, m in L0.named_modules() if n]

    # 3. compare with the stored tensors (safetensors headers only)
    idx_path = root / "model.safetensors.index.json"
    if idx_path.exists():
        idx = json.loads(idx_path.read_text())
        weight_map, stored_bytes = idx["weight_map"], idx["metadata"].get("total_size")
    else:
        weight_map, stored_bytes = None, None
    root_w = Path(snapshot_download(args.model, revision=rev, local_files_only=args.local_files_only,
                                    allow_patterns=["*.safetensors", "*.json"]))
    from safetensors import safe_open
    if weight_map is None:
        with safe_open(str(root_w / "model.safetensors"), framework="pt") as fh:
            weight_map = {k: "model.safetensors" for k in fh.keys()}
    stored_shapes = {}
    for f in sorted(set(weight_map.values())):
        with safe_open(str(root_w / f), framework="pt") as fh:
            for k in fh.keys():
                stored_shapes[k] = list(fh.get_slice(k).get_shape())
    mismatches = [n for n, p in named.items() if n in stored_shapes and stored_shapes[n] != list(p.shape)]
    missing = [n for n in named if n not in stored_shapes and not (tied and n == "lm_head.weight")]
    stored_params = sum(math.prod(s) for s in stored_shapes.values())

    tok = AutoTokenizer.from_pretrained(root)
    head_dim = getattr(cfg, "head_dim", None) or cfg.hidden_size // cfg.num_attention_heads
    rope_params = getattr(cfg, "rope_parameters", None) or {}
    theta = rope_params.get("rope_theta", raw_cfg.get("rope_theta"))
    inv_freq = 1.0 / (theta ** (torch.arange(0, head_dim, 2, dtype=torch.float64) / head_dim))
    wavelengths = (2 * math.pi / inv_freq)

    card = (root / "README.md").read_text(encoding="utf-8") if (root / "README.md").exists() else ""

    def card_value(label):
        m = re.search(rf"{label}:\s*([^\n]+)", card)
        return m.group(1).strip() if m else None

    bytes_per = {"bfloat16": 2, "float16": 2, "float32": 4}
    dt = raw_cfg.get("torch_dtype") or raw_cfg.get("dtype") or "bfloat16"
    kv_bytes_token = 2 * cfg.num_key_value_heads * head_dim * n_layers * bytes_per.get(dt, 2)
    mha_kv_bytes_token = 2 * cfg.num_attention_heads * head_dim * n_layers * bytes_per.get(dt, 2)

    arch = {
        "schema": "latentlens.architecture/1",
        "status": "ok",
        "model_id": args.model,
        "revision": rev,
        "model_type": cfg.model_type,
        "architectures": raw_cfg.get("architectures"),
        "config": {k: raw_cfg[k] for k in sorted(raw_cfg)},
        "config_sha256": sha256(cfg_path),
        "verified": {
            "num_hidden_layers": n_layers,
            "hidden_size": cfg.hidden_size,
            "intermediate_size": cfg.intermediate_size,
            "vocab_size": cfg.vocab_size,
            "tokenizer_size": len(tok),
            "num_attention_heads": cfg.num_attention_heads,
            "num_key_value_heads": cfg.num_key_value_heads,
            "query_heads_per_kv_head": cfg.num_attention_heads // cfg.num_key_value_heads,
            "head_dim": head_dim,
            "q_proj_out": L0.self_attn.q_proj.out_features,
            "kv_proj_out": L0.self_attn.k_proj.out_features,
            "attention_bias": bool(raw_cfg.get("attention_bias", False)),
            "attention_scaling": head_dim ** -0.5,
            "norm_type": type(L0.input_layernorm).__name__,
            "rms_norm_eps": cfg.rms_norm_eps,
            "qk_norm": True,
            "qk_norm_dim": L0.self_attn.q_norm.weight.numel(),
            "positional_mechanism": "rotary (RoPE) on Q and K, rotate-half pairing",
            "rope_theta": theta,
            "rope_scaling": raw_cfg.get("rope_scaling"),
            "rope_frequencies": head_dim // 2,
            "rope_wavelength_min_tokens": float(wavelengths.min()),
            "rope_wavelength_max_tokens": float(wavelengths.max()),
            "activation": raw_cfg.get("hidden_act"),
            "mlp_type": "SwiGLU (gate_proj, up_proj, down_proj; no bias)",
            "tie_word_embeddings": bool(tied),
            "max_position_embeddings": raw_cfg.get("max_position_embeddings"),
            "sliding_window": raw_cfg.get("sliding_window"),
            "use_sliding_window": raw_cfg.get("use_sliding_window"),
            "stored_dtype": dt,
            "bos_token_id": raw_cfg.get("bos_token_id"),
            "eos_token_id": raw_cfg.get("eos_token_id"),
            "tokenizer_adds_bos": bool(getattr(tok, "add_bos_token", False)),
            "endoftext_id": tok.convert_tokens_to_ids("<|endoftext|>"),
        },
        "parameters": {
            "total": total_unique,
            "embedding": embed,
            "lm_head": lm_head,
            "non_embedding": total_unique - embed - lm_head,
            "per_layer": per_layer,
            "all_layers": per_layer["total"] * n_layers,
            "final_norm": model.model.norm.weight.numel(),
            "stored_tensor_params": stored_params,
            "stored_bytes": stored_bytes,
        },
        "kv_cache": {"bytes_per_token_all_layers": kv_bytes_token, "bytes_per_token_if_mha": mha_kv_bytes_token,
                     "dtype": dt},
        "layer0_parameters": layer_params,
        "layer0_modules": module_tree,
        "checks": {
            "source_order": source_checks(modeling_qwen3),
            "meta_vs_stored_shape_mismatches": mismatches,
            "meta_params_missing_from_checkpoint": missing,
            "stored_lm_head_separate": "lm_head.weight" in stored_shapes,
        },
        "model_card": {"parameters": card_value("Number of Parameters"),
                       "non_embedding": card_value(r"Number of Paramaters \(Non-Embedding\)") or card_value("Non-Embedding"),
                       "layers": card_value("Number of Layers"), "heads": card_value(r"Number of Attention Heads \(GQA\)"),
                       "context_length": card_value("Context Length"), "training_stage": card_value("Training Stage")},
        "norm_gains": norm_gain_stats(root_w, weight_map, n_layers),
        "sources": {"transformers_modeling_file": Path(modeling_qwen3.__file__).name,
                    "transformers_version": transformers.__version__,
                    "technical_report": "Qwen3 Technical Report, arXiv:2505.09388"},
        "provenance": provenance(script="scripts/latentlens/inspect_qwen_architecture.py"),
    }
    bad = [c["fact"] for c in arch["checks"]["source_order"] if not c["verified"]]
    if bad or mismatches or missing:
        print("VERIFICATION FAILED:", bad, mismatches[:5], missing[:5])
        arch["status"] = "failed"
    out = Path(args.out) if args.out else results_dir(args.model) / "architecture.json"
    write_json(out, arch, digits=8)
    v = arch["verified"]
    print(f"{args.model} @ {rev}: {v['num_hidden_layers']} layers, d={v['hidden_size']}, mlp={v['intermediate_size']}, "
          f"heads {v['num_attention_heads']}q/{v['num_key_value_heads']}kv x {v['head_dim']}, vocab {v['vocab_size']} "
          f"(tokenizer {v['tokenizer_size']}), tied={v['tie_word_embeddings']}, params {arch['parameters']['total']:,}")
    print(f"source checks: {sum(c['verified'] for c in arch['checks']['source_order'])}/{len(arch['checks']['source_order'])} verified -> {out}")
    return 0 if arch["status"] == "ok" else 1


if __name__ == "__main__":
    raise SystemExit(main())
