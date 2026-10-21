"""Step 4 · Attention, written by hand.

Attention is the only place in a transformer where positions exchange information. Every position makes a query;
it is compared with the keys of itself and earlier positions; the matches become weights through softmax; the
output is the weighted average of those positions' values.

Shapes follow PyTorch and Hugging Face: [batch B, heads H, positions T, head size d].
Qwen3-8B: H = 32 query heads and 8 key/value heads (grouped-query attention), d = 128.

Atlas link: Inside attention (Q·Kᵀ/√d, causal mask, softmax over keys, A·V).
Run the checks:  python -m pytest -k s04
"""
from __future__ import annotations

import math

import torch


def softmax(x: torch.Tensor, dim: int = -1) -> torch.Tensor:
    """exp(x) / sum(exp(x)) along dim, computed so that huge inputs do not overflow."""
    # TODO(4.1): subtract the max along dim first (this changes nothing mathematically, since softmax
    # ignores a constant shift, but keeps exp() finite). Masked entries are -inf and must come out as exactly 0.
    z = x - x.amax(dim=dim, keepdim=True)
    e = torch.exp(z)
    return e / e.sum(dim=dim, keepdim=True)
    # END TODO


def causal_mask(T: int, device=None) -> torch.Tensor:
    """[T, T] boolean: True where query position i may look at key position j (that is, j <= i)."""
    # TODO(4.2): a lower-triangular matrix of True values, including the diagonal.
    return torch.ones(T, T, dtype=torch.bool, device=device).tril()
    # END TODO


def attention(q: torch.Tensor, k: torch.Tensor, v: torch.Tensor, causal: bool = True) -> tuple[torch.Tensor, torch.Tensor]:
    """q, k, v: [B, H, T, d]. Returns (output [B, H, T, d], weights [B, H, T, T])."""
    d = q.shape[-1]
    # TODO(4.3): scores = q @ kᵀ / sqrt(d); if causal, set disallowed scores to -inf (masked_fill);
    # weights = softmax over the last dim (the keys); output = weights @ v.
    scores = q @ k.transpose(-2, -1) / math.sqrt(d)
    if causal:
        T = q.shape[-2]
        scores = scores.masked_fill(~causal_mask(T, q.device), float("-inf"))
    w = softmax(scores, dim=-1)
    return w @ v, w
    # END TODO


def repeat_kv(x: torch.Tensor, n_rep: int) -> torch.Tensor:
    """Grouped-query attention: [B, Hkv, T, d] -> [B, Hkv * n_rep, T, d].

    Key/value head j serves query heads j*n_rep ... j*n_rep + n_rep - 1, so each KV head is repeated n_rep
    times IN PLACE (k0 k0 k0 k0 k1 k1 ...), not tiled (k0 k1 ... k0 k1 ...).
    """
    # TODO(4.4): one line with torch.repeat_interleave, or expand + reshape as Hugging Face does.
    return x.repeat_interleave(n_rep, dim=1)
    # END TODO


if __name__ == "__main__":
    torch.manual_seed(0)
    q, k, v = (torch.randn(1, 2, 5, 8) for _ in range(3))
    out, w = attention(q, k, v)
    print("weights of head 0 (rows are queries, each sums to 1):")
    print(w[0, 0].round(decimals=2))
