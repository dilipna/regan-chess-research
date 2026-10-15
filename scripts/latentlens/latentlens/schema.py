"""Validators for every LatentLens artifact read by the website. Each returns a list of problems (empty = valid).

An artifact is either `status: "ok"` with measured values, or `status: "pending"` with a reason and the command that
produces it. Pending artifacts must not contain result fields.
"""

from __future__ import annotations

from typing import Any

RESULT_FIELDS = {"layers", "test", "depths", "passages", "points", "block_rmsnorm", "verified", "examples", "final"}


def _need(a: dict, keys, errs: list, where: str = "") -> None:
    for k in keys:
        if k not in a:
            errs.append(f"{where}missing {k!r}")


def validate_pending(a: dict) -> list[str]:
    errs = []
    _need(a, ("schema", "status", "reason", "how_to_run"), errs)
    leaked = RESULT_FIELDS & set(a)
    if leaked:
        errs.append(f"pending artifact carries result fields {sorted(leaked)}")
    return errs


def validate_architecture(a: dict) -> list[str]:
    errs: list[str] = []
    _need(a, ("schema", "status", "model_id", "revision", "verified", "parameters", "checks", "norm_gains"), errs)
    if errs:
        return errs
    v = a["verified"]
    _need(v, ("num_hidden_layers", "hidden_size", "intermediate_size", "vocab_size", "num_attention_heads",
              "num_key_value_heads", "head_dim", "rms_norm_eps", "rope_theta", "activation", "tie_word_embeddings"), errs, "verified.")
    if errs:
        return errs
    if v["num_attention_heads"] % v["num_key_value_heads"]:
        errs.append("query heads not divisible by KV heads")
    if v["query_heads_per_kv_head"] != v["num_attention_heads"] // v["num_key_value_heads"]:
        errs.append("query_heads_per_kv_head inconsistent")
    if v["q_proj_out"] != v["num_attention_heads"] * v["head_dim"]:
        errs.append("q_proj_out != heads * head_dim")
    if v["kv_proj_out"] != v["num_key_value_heads"] * v["head_dim"]:
        errs.append("kv_proj_out != kv_heads * head_dim")
    if len(a["norm_gains"]["input_layernorm"]) != v["num_hidden_layers"]:
        errs.append("norm_gains length != layers")
    p = a["parameters"]
    if p["stored_tensor_params"] != p["total"]:
        errs.append("instantiated parameter count != stored tensor parameter count")
    bad = [c["fact"] for c in a["checks"]["source_order"] if not c["verified"]]
    if bad:
        errs.append(f"unverified source facts: {bad}")
    return errs


def validate_tokenizer(a: dict) -> list[str]:
    errs: list[str] = []
    _need(a, ("examples", "embedding", "special_tokens"), errs)
    for e in a.get("examples", []):
        if e["n_tokens"] != len(e["tokens"]):
            errs.append(f"n_tokens mismatch for {e['text'][:30]!r}")
        for t in e["tokens"]:
            if not isinstance(t["id"], int) or t["id"] < 0:
                errs.append("bad token id")
    return errs


def validate_trace(a: dict) -> list[str]:
    errs: list[str] = []
    _need(a, ("tokens", "layers", "final", "diagnostic_lens_last_position", "n_layers", "positions"), errs)
    if errs:
        return errs
    T, L = len(a["tokens"]), a["n_layers"]
    if len(a["layers"]) != L:
        errs.append("layers length != n_layers")
    if len(a["diagnostic_lens_last_position"]) != L + 1:
        errs.append("diagnostic lens should cover depths 0..L")
    if a["diagnostic_lens_last_position"][-1]["final_top_rank"] != 1:
        errs.append("diagnostic projection at the last depth must equal the model output (rank 1)")
    for l in a["layers"]:
        if len(l["resid_post_rms"]) != T:
            errs.append("per-position arrays must have one value per token")
            break
    ps = [t["p"] for t in a["final"]["top"]]
    if any(x < y - 1e-9 for x, y in zip(ps, ps[1:])):
        errs.append("final top tokens not sorted by probability")
    if sum(ps) > 1 + 1e-6:
        errs.append("top probabilities sum above 1")
    return errs


def validate_recall(a: dict) -> list[str]:
    errs: list[str] = []
    _need(a, ("n_layers", "passages"), errs)
    for p in a.get("passages", []):
        if len(p["positions"]) != p["n_scored"]:
            errs.append(f"{p['name']}: positions != n_scored")
        if len(p["depth"]) != a["n_layers"] + 1:
            errs.append(f"{p['name']}: depth entries != n_layers + 1")
        top1 = sum(x["top1"] for x in p["positions"]) / max(len(p["positions"]), 1)
        if abs(top1 - p["summary"]["top1_rate"]) > 1e-4:          # artifacts store 5 decimals
            errs.append(f"{p['name']}: top1_rate inconsistent with positions")
        if any((x["rank"] == 1) != x["top1"] for x in p["positions"]):
            errs.append(f"{p['name']}: rank/top1 inconsistent")
        last = p["depth"][-1]["rank"]
        if [x["rank"] for x in p["positions"]] != last:
            errs.append(f"{p['name']}: last-depth diagnostic ranks differ from the model's actual ranks")
    return errs


def validate_layer_probe(a: dict) -> list[str]:
    errs: list[str] = []
    _need(a, ("layers", "selected_depth", "final_depth", "test", "leakage_audit", "controls", "pooling"), errs)
    if errs:
        return errs
    if not a["leakage_audit"]["leakage_free"]:
        errs.append("leakage audit failed")
    best = max(a["layers"], key=lambda r: (r["val"]["roc_auc"], -r["depth"]))
    if best["depth"] != a["selected_depth"]:
        errs.append("selected depth is not the validation argmax")
    for r in a["layers"]:
        if "test" in r:
            errs.append("per-layer test metrics found: test must only be evaluated at the selected and final depths")
            break
    return errs


def validate_pca(a: dict) -> list[str]:
    errs: list[str] = []
    _need(a, ("depth", "points", "explained_variance_ratio", "fit_split", "shown_split"), errs)
    if not errs and a["shown_split"] == "test":
        errs.append("PCA must not display the test split")
    if not errs and a["fit_split"] == a["shown_split"]:
        errs.append("PCA must be fitted on a different split than the one shown")
    return errs


def validate_rmsnorm(a: dict) -> list[str]:
    errs: list[str] = []
    _need(a, ("depths", "block_rmsnorm", "evaluation_split"), errs)
    if not errs and a["evaluation_split"] == "test":
        errs.append("exploratory comparisons must not use the test split")
    return errs


def validate_component(a: dict) -> list[str]:
    errs: list[str] = []
    _need(a, ("layers", "sites", "evaluation_split"), errs)
    if not errs and a["evaluation_split"] == "test":
        errs.append("exploratory comparisons must not use the test split")
    return errs


VALIDATORS = {
    "architecture.json": validate_architecture, "tokenizer_examples.json": validate_tokenizer,
    "token_trace.json": validate_trace, "recall_probe.json": validate_recall, "layer_probe.json": validate_layer_probe,
    "rmsnorm_probe.json": validate_rmsnorm, "component_probe.json": validate_component,
}


def validate(name: str, a: Any) -> list[str]:
    if not isinstance(a, dict):
        return ["artifact is not an object"]
    if a.get("status") == "pending":
        return validate_pending(a)
    if a.get("status") != "ok":
        return [f"status must be 'ok' or 'pending', got {a.get('status')!r}"]
    if name.startswith("depth_"):
        return validate_pca(a)
    fn = VALIDATORS.get(name)
    return fn(a) if fn else []
