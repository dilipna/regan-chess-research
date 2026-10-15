"""Forward hooks that read named sites inside a Qwen3 decoder layer.

Qwen3DecoderLayer.forward (transformers 5.18, pre-norm):

    residual = x                                   # site "resid_pre"
    h = input_layernorm(x)                         # site "attn_norm"   (block RMSNorm #1, over hidden_size)
    h = self_attn(h, ...)[0]                       # site "attn_out"    (after o_proj; q_norm/k_norm live inside)
    x = residual + h                               # site "resid_mid"   (residual addition #1)
    h = post_attention_layernorm(x)                # site "mlp_norm"    (block RMSNorm #2)
    h = mlp(h)                                     # site "mlp_out"     (SwiGLU)
    x = x + h                                      # site "resid_post"  (residual addition #2)

Every site is read from a module boundary, so nothing is recomputed: "resid_pre" and "attn_norm" are the input and output
of input_layernorm, "resid_mid" and "mlp_norm" the input and output of post_attention_layernorm, "attn_out" the first
output of self_attn, "mlp_out" the output of mlp and "resid_post" the output of the whole layer.

Hooks are always removed when the HookSet context exits, including on exceptions.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import dataclass, field

import torch

SITES = ("resid_pre", "attn_norm", "attn_out", "resid_mid", "mlp_norm", "mlp_out", "resid_post")
ATTN_WEIGHTS = "attn_weights"      # only produced when the eager attention implementation is active


@dataclass
class Batch:
    """One right-padded minibatch. `mask` marks real tokens; `pool_mask` marks tokens included in pooling."""
    ids: torch.Tensor                  # [B, T] int64
    mask: torch.Tensor                 # [B, T] bool
    pool_mask: torch.Tensor            # [B, T] bool
    index: list[int]                   # global document index for each row


# A collector receives (site, layer_idx, tensor, batch). Tensors are on the compute device, shape [B, T, D]
# (or [B, H, T, T] for attention weights). Collectors must not keep references to the tensors they receive.
Collector = Callable[[str, int, torch.Tensor, Batch], None]


def _first(x):
    return x[0] if isinstance(x, (tuple, list)) else x


class HookSet:
    """Registers hooks for the requested sites of one decoder layer; removes them on exit."""

    def __init__(self, layer: torch.nn.Module, layer_idx: int, sites: Iterable[str], collector: Collector,
                 batch_ref: Callable[[], Batch]):
        self.layer, self.idx, self.sites = layer, layer_idx, set(sites)
        unknown = self.sites - set(SITES) - {ATTN_WEIGHTS}
        if unknown:
            raise ValueError(f"unknown capture sites: {sorted(unknown)}")
        self.collector, self.batch_ref = collector, batch_ref
        self.handles: list = []

    def _emit(self, site: str, t: torch.Tensor | None) -> None:
        if t is not None:
            self.collector(site, self.idx, t.detach(), self.batch_ref())

    def __enter__(self) -> "HookSet":
        L, s = self.layer, self.sites
        if s & {"resid_pre", "attn_norm"}:
            def h_in(_m, inp, out):
                if "resid_pre" in s:
                    self._emit("resid_pre", inp[0])
                if "attn_norm" in s:
                    self._emit("attn_norm", out)
            self.handles.append(L.input_layernorm.register_forward_hook(h_in))
        if s & {"attn_out", ATTN_WEIGHTS}:
            def h_attn(_m, _inp, out):
                if "attn_out" in s:
                    self._emit("attn_out", _first(out))
                if ATTN_WEIGHTS in s and isinstance(out, (tuple, list)) and len(out) > 1:
                    self._emit(ATTN_WEIGHTS, out[1])
            self.handles.append(L.self_attn.register_forward_hook(h_attn))
        if s & {"resid_mid", "mlp_norm"}:
            def h_post(_m, inp, out):
                if "resid_mid" in s:
                    self._emit("resid_mid", inp[0])
                if "mlp_norm" in s:
                    self._emit("mlp_norm", out)
            self.handles.append(L.post_attention_layernorm.register_forward_hook(h_post))
        if "mlp_out" in s:
            self.handles.append(L.mlp.register_forward_hook(lambda _m, _i, out: self._emit("mlp_out", _first(out))))
        if "resid_post" in s:
            self.handles.append(L.register_forward_hook(lambda _m, _i, out: self._emit("resid_post", _first(out))))
        return self

    def __exit__(self, *exc) -> None:
        for h in self.handles:
            h.remove()
        self.handles.clear()


def count_hooks(module: torch.nn.Module) -> int:
    """Number of forward hooks registered anywhere under `module` (used by tests to prove cleanup)."""
    return sum(len(m._forward_hooks) + len(m._forward_pre_hooks) for m in module.modules())


# --------------------------------------------------------------------------------------------- pooling
POOLINGS = ("mean", "last")


def pool(h: torch.Tensor, pool_mask: torch.Tensor, how: str) -> torch.Tensor:
    """[B, T, D] -> [B, D] in float32. 'mean' averages pool_mask tokens; 'last' takes the last pool_mask token."""
    h = h.float()
    m = pool_mask.to(h.device)
    if how == "mean":
        w = m.float().unsqueeze(-1)
        return (h * w).sum(1) / w.sum(1).clamp_min(1.0)
    if how == "last":
        T = m.shape[1]
        pos = torch.arange(T, device=h.device).expand_as(m)
        last = torch.where(m, pos, torch.full_like(pos, -1)).max(1).values.clamp_min(0)
        return h[torch.arange(h.shape[0], device=h.device), last]
    raise ValueError(f"unknown pooling {how!r}")


def token_rms_mean(h: torch.Tensor, pool_mask: torch.Tensor) -> torch.Tensor:
    """Mean over pooled tokens of the per-token RMS sqrt(mean_d h^2). [B, T, D] -> [B]."""
    rms = h.float().pow(2).mean(-1).sqrt()
    w = pool_mask.to(h.device).float()
    return (rms * w).sum(1) / w.sum(1).clamp_min(1.0)


@dataclass
class PooledStore:
    """Accumulates pooled vectors for (site, layer) pairs into preallocated float32 arrays.

    arrays[(site, pooling)] has shape [N, n_slots, D]; slot order follows `layers[site]`.
    rms[site] has shape [N, n_slots] (mean per-token RMS, computed before pooling).
    """
    n_docs: int
    hidden: int
    layers: dict[str, list[int]]
    poolings: tuple[str, ...] = ("mean", "last")
    arrays: dict = field(default_factory=dict)
    rms: dict = field(default_factory=dict)

    def __post_init__(self):
        import numpy as np
        for site, ls in self.layers.items():
            for p in self.poolings:
                self.arrays[(site, p)] = np.zeros((self.n_docs, len(ls), self.hidden), dtype=np.float32)
            self.rms[site] = np.zeros((self.n_docs, len(ls)), dtype=np.float32)
        self._slot = {site: {l: k for k, l in enumerate(ls)} for site, ls in self.layers.items()}

    def wants(self, layer: int) -> set[str]:
        return {s for s, ls in self.layers.items() if layer in self._slot[s]}

    def __call__(self, site: str, layer: int, h: torch.Tensor, batch: Batch) -> None:
        if site not in self._slot or layer not in self._slot[site]:
            return
        k = self._slot[site][layer]
        rows = batch.index
        for p in self.poolings:
            self.arrays[(site, p)][rows, k] = pool(h, batch.pool_mask, p).cpu().numpy()
        self.rms[site][rows, k] = token_rms_mean(h, batch.pool_mask).cpu().numpy()
