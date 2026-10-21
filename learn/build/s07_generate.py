"""Step 7 · Generation: sampling rules and the KV cache.

Generation is a loop: run the model, turn the last position's logits into one token, append it, repeat.

Two separate ideas live here:
  * Decoding rules (temperature, top-k, top-p) decide HOW a token is picked from the distribution.
    They are inference choices; the model was never trained with them.
  * The KV cache makes the loop fast. A token's keys and values never change once computed (causal attention means
    later tokens cannot affect earlier ones), so we store them and only compute the NEW token each step.
    Without a cache, step n redoes the work for all n previous tokens.

Atlas link: Softmax → sample (The model); Wk → K and Wv → V (Inside attention).
Run the checks:  python -m pytest -k s07
"""
from __future__ import annotations

import math

import torch

from s04_attention import repeat_kv, softmax
from s06_tiny_gpt import TinyGPT


def sample_next(logits: torch.Tensor, temperature: float = 1.0, top_k: int | None = None, top_p: float | None = None,
                generator: torch.Generator | None = None) -> torch.Tensor:
    """logits [B, V] -> next ids [B]. temperature 0 means greedy (always the most likely token)."""
    # TODO(7.1): greedy if temperature == 0. Otherwise divide by temperature;
    # top_k: keep only the k largest logits (others -> -inf);
    # top_p: sort probabilities descending and keep the smallest set whose total reaches top_p
    #        (always keep the first token); others -> -inf;
    # then sample one id per row from softmax with torch.multinomial(..., generator=generator).
    raise NotImplementedError("TODO(7.1)")


class KVCache:
    """Per layer: keys and values of every token processed so far, [B, Hkv, T_so_far, hd]."""

    def __init__(self, n_layers: int):
        self.k: list[torch.Tensor | None] = [None] * n_layers
        self.v: list[torch.Tensor | None] = [None] * n_layers

    def __len__(self) -> int:
        return 0 if self.k[0] is None else self.k[0].shape[2]


def forward_cached(model: TinyGPT, idx_new: torch.Tensor, cache: KVCache) -> torch.Tensor:
    """Run only the NEW tokens idx_new [B, T_new], reading earlier keys/values from the cache. Returns their logits."""
    start, T_new = len(cache), idx_new.shape[1]
    cos, sin = model.cos[start:start + T_new], model.sin[start:start + T_new]   # the new tokens' real positions
    x = model.embed_tokens(idx_new)
    for i, layer in enumerate(model.layers):
        attn = layer.self_attn
        q, k, v = attn.project(layer.input_layernorm(x), cos, sin)
        # TODO(7.2): append k and v to cache.k[i] / cache.v[i] along the positions dim (dim 2), or store them if
        # the cache is empty. Then attend from the new queries to ALL cached keys/values (repeat_kv for GQA).
        # Mask: new query number r sits at position start + r and may see key positions 0 .. start + r.
        raise NotImplementedError("TODO(7.2)")
        B = x.shape[0]
        x = x + attn.o_proj(out.transpose(1, 2).reshape(B, T_new, attn.n_heads * attn.hd))
        x = x + layer.mlp(layer.post_attention_layernorm(x))
    return model.lm_head(model.norm(x))


@torch.no_grad()
def generate(model: TinyGPT, idx: torch.Tensor, n: int, temperature: float = 1.0, top_k: int | None = None,
             top_p: float | None = None, use_cache: bool = True, generator: torch.Generator | None = None) -> torch.Tensor:
    """Append n tokens to idx [B, T]."""
    model.eval()
    if not use_cache:
        for _ in range(n):
            logits, _ = model(idx[:, -model.config.max_len:])
            idx = torch.cat([idx, sample_next(logits[:, -1], temperature, top_k, top_p, generator)[:, None]], dim=1)
        return idx
    cache = KVCache(len(model.layers))
    logits = forward_cached(model, idx, cache)          # prefill: the whole prompt at once
    for _ in range(n):
        nxt = sample_next(logits[:, -1], temperature, top_k, top_p, generator)[:, None]
        idx = torch.cat([idx, nxt], dim=1)
        if idx.shape[1] > model.config.max_len:
            break
        logits = forward_cached(model, nxt, cache)       # decode: one new token per step
    return idx
