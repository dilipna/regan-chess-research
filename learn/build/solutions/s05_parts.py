"""Step 5 · The three parts that make a 2017 transformer into a Qwen3 transformer: RMSNorm, RoPE, SwiGLU.

  RMSNorm   rescale each vector to a standard size, times a learned gain (no mean subtraction, no bias)
  RoPE      encode position by ROTATING pairs of query/key coordinates; the Q·K match then depends on distance
  SwiGLU    the MLP: two wide projections, one gated by SiLU, multiplied, then projected back down

Written to match Hugging Face's Qwen3 code (rotate-half pairing: dimension i pairs with i + d/2).

Atlas link: RMSNorm #1/#2 and QK-norm, RoPE (Inside attention), SwiGLU MLP (Inside the MLP).
Run the checks:  python -m pytest -k s05
"""
from __future__ import annotations

import torch
from torch import nn
from torch.nn import functional as F


class RMSNorm(nn.Module):
    def __init__(self, dim: int, eps: float = 1e-6):
        super().__init__()
        self.eps = eps
        self.weight = nn.Parameter(torch.ones(dim))   # the learned gain g, one number per dimension

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # TODO(5.1): in float32: x / sqrt(mean(x², over the last dim) + eps); cast back to x's dtype; times weight.
        dtype = x.dtype
        h = x.float()
        h = h * torch.rsqrt(h.pow(2).mean(-1, keepdim=True) + self.eps)
        return self.weight * h.to(dtype)
        # END TODO


def rope_cos_sin(T: int, dim: int, theta: float = 1_000_000.0, device=None) -> tuple[torch.Tensor, torch.Tensor]:
    """cos and sin tables of shape [T, dim] for positions 0..T-1 (Qwen3: dim = 128, theta = 1,000,000)."""
    # TODO(5.2): inv_freq[i] = theta ** (-2i / dim) for i in 0 .. dim/2 - 1; angles = outer(positions, inv_freq);
    # duplicate them along the last dim (cat([angles, angles])) so dimension i and i + dim/2 share an angle.
    inv_freq = theta ** (-torch.arange(0, dim, 2, dtype=torch.float32, device=device) / dim)
    pos = torch.arange(T, dtype=torch.float32, device=device)
    angles = torch.outer(pos, inv_freq)
    emb = torch.cat([angles, angles], dim=-1)
    return emb.cos(), emb.sin()
    # END TODO


def rotate_half(x: torch.Tensor) -> torch.Tensor:
    """[x1, x2] -> [-x2, x1], where x1 and x2 are the two halves of the last dimension."""
    # TODO(5.3)
    x1, x2 = x.chunk(2, dim=-1)
    return torch.cat([-x2, x1], dim=-1)
    # END TODO


def apply_rope(x: torch.Tensor, cos: torch.Tensor, sin: torch.Tensor) -> torch.Tensor:
    """Rotate x ([..., T, dim]) by its positions' angles. Each pair (i, i + dim/2) turns as a 2-D vector."""
    # TODO(5.4): x * cos + rotate_half(x) * sin
    return x * cos + rotate_half(x) * sin
    # END TODO


class SwiGLU(nn.Module):
    def __init__(self, dim: int, hidden: int):
        super().__init__()
        self.gate_proj = nn.Linear(dim, hidden, bias=False)
        self.up_proj = nn.Linear(dim, hidden, bias=False)
        self.down_proj = nn.Linear(hidden, dim, bias=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # TODO(5.5): down_proj( SiLU(gate_proj(x)) * up_proj(x) )
        return self.down_proj(F.silu(self.gate_proj(x)) * self.up_proj(x))
        # END TODO


if __name__ == "__main__":
    torch.manual_seed(0)
    cos, sin = rope_cos_sin(16, 8, theta=10_000)
    q, k = torch.randn(8), torch.randn(8)
    for m, n in [(3, 1), (9, 7), (14, 12)]:
        s = apply_rope(q, cos[m], sin[m]) @ apply_rope(k, cos[n], sin[n])
        print(f"query at {m:2d}, key at {n:2d} (distance {m - n}): score {s:.5f}")
    print("same distance, same score: RoPE makes attention depend on relative position.")
