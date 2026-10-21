"""Step 6 · A tiny GPT with Qwen3's exact block design, trained on your laptop.

Everything from steps 4 and 5 snaps together here, using the same module names as Hugging Face's Qwen3 code:

  embed_tokens -> [ input_layernorm -> self_attn (q/k/v_proj, q_norm/k_norm, RoPE, GQA, o_proj) -> + residual
                    post_attention_layernorm -> mlp (SwiGLU) -> + residual ] x n_layers -> norm -> lm_head

Qwen3-8B is this model with d_model 4096, 36 layers, 32 query heads, 8 KV heads and a 151,936-token vocabulary.
Ours is about 100,000 times smaller, so it trains in a minute on a CPU.

Atlas link: the whole diagram. One block = "Inside one block".
Run the checks:  python -m pytest -k s06        Train it:  python train_tiny_gpt.py
"""
from __future__ import annotations

from dataclasses import dataclass

import torch
from torch import nn
from torch.nn import functional as F

from s04_attention import attention, repeat_kv
from s05_parts import RMSNorm, SwiGLU, apply_rope, rope_cos_sin


@dataclass
class Config:
    vocab_size: int = 64
    d_model: int = 96
    n_layers: int = 3
    n_heads: int = 4
    n_kv_heads: int = 2          # grouped-query attention: 2 query heads share each key/value head
    d_ff: int = 288              # 3x d_model, the same ratio as Qwen3-8B (12,288 / 4,096)
    max_len: int = 128
    rope_theta: float = 10_000.0
    eps: float = 1e-6

    @property
    def head_dim(self) -> int:
        return self.d_model // self.n_heads


class Attention(nn.Module):
    def __init__(self, c: Config):
        super().__init__()
        self.n_heads, self.n_kv, self.hd = c.n_heads, c.n_kv_heads, c.head_dim
        self.q_proj = nn.Linear(c.d_model, c.n_heads * self.hd, bias=False)
        self.k_proj = nn.Linear(c.d_model, c.n_kv_heads * self.hd, bias=False)
        self.v_proj = nn.Linear(c.d_model, c.n_kv_heads * self.hd, bias=False)
        self.o_proj = nn.Linear(c.n_heads * self.hd, c.d_model, bias=False)
        self.q_norm = RMSNorm(self.hd, c.eps)
        self.k_norm = RMSNorm(self.hd, c.eps)

    def project(self, x: torch.Tensor, cos: torch.Tensor, sin: torch.Tensor):
        """x [B, T, d_model] -> q [B, H, T, hd], k and v [B, Hkv, T, hd]; q and k normalized and rotated."""
        B, T, _ = x.shape
        # TODO(6.1): project, reshape to [B, T, heads, hd], apply q_norm / k_norm (on the hd dimension),
        # transpose to [B, heads, T, hd], then apply_rope to q and k (not v).
        raise NotImplementedError("TODO(6.1)")

    def forward(self, x: torch.Tensor, cos: torch.Tensor, sin: torch.Tensor) -> torch.Tensor:
        B, T, _ = x.shape
        # TODO(6.2): q, k, v = project(...); repeat k and v so every query head has one (repeat_kv);
        # causal attention; transpose back to [B, T, H, hd], flatten the heads, o_proj.
        raise NotImplementedError("TODO(6.2)")


class Block(nn.Module):
    def __init__(self, c: Config):
        super().__init__()
        self.input_layernorm = RMSNorm(c.d_model, c.eps)
        self.self_attn = Attention(c)
        self.post_attention_layernorm = RMSNorm(c.d_model, c.eps)
        self.mlp = SwiGLU(c.d_model, c.d_ff)

    def forward(self, x: torch.Tensor, cos: torch.Tensor, sin: torch.Tensor) -> torch.Tensor:
        # TODO(6.3): the residual stream. Each sub-layer reads a NORMALIZED COPY and its output is ADDED:
        # x = x + attention(norm1(x)); x = x + mlp(norm2(x)).
        raise NotImplementedError("TODO(6.3)")


class TinyGPT(nn.Module):
    def __init__(self, c: Config):
        super().__init__()
        self.config = c
        self.embed_tokens = nn.Embedding(c.vocab_size, c.d_model)
        self.layers = nn.ModuleList(Block(c) for _ in range(c.n_layers))
        self.norm = RMSNorm(c.d_model, c.eps)
        self.lm_head = nn.Linear(c.d_model, c.vocab_size, bias=False)   # not tied, like Qwen3-8B
        cos, sin = rope_cos_sin(c.max_len, c.head_dim, c.rope_theta)
        self.register_buffer("cos", cos, persistent=False)
        self.register_buffer("sin", sin, persistent=False)
        self.apply(self._init)

    @staticmethod
    def _init(m: nn.Module) -> None:
        if isinstance(m, (nn.Linear, nn.Embedding)):
            nn.init.normal_(m.weight, std=0.02)

    def forward(self, idx: torch.Tensor, targets: torch.Tensor | None = None):
        """idx [B, T] token ids -> (logits [B, T, vocab], loss or None). logits[:, t] predicts token t + 1."""
        T = idx.shape[1]
        assert T <= self.config.max_len
        # TODO(6.4): embed; run every block with the first T rows of cos/sin; final norm; lm_head.
        # If targets are given, loss = cross-entropy between logits and targets, averaged over all positions.
        raise NotImplementedError("TODO(6.4)")


def count_params(c: Config) -> int:
    """The parameter count, from the config alone. Compare with sum(p.numel() for p in model.parameters())."""
    hd = c.head_dim
    attn = c.d_model * c.n_heads * hd + 2 * c.d_model * c.n_kv_heads * hd + c.n_heads * hd * c.d_model + 2 * hd
    mlp = 3 * c.d_model * c.d_ff
    block = attn + mlp + 2 * c.d_model
    return c.vocab_size * c.d_model * 2 + c.n_layers * block + c.d_model


# ---- training (given) ----

class CharTokenizer:
    def __init__(self, text: str):
        self.itos = sorted(set(text))
        self.stoi = {ch: i for i, ch in enumerate(self.itos)}

    def encode(self, s: str) -> list[int]: return [self.stoi[ch] for ch in s]
    def decode(self, ids) -> str: return "".join(self.itos[int(i)] for i in ids)


def train(model: TinyGPT, data: torch.Tensor, steps: int = 300, batch: int = 32, block: int = 64, lr: float = 3e-3,
          seed: int = 0, log_every: int = 0) -> list[float]:
    """Next-token training on random windows of `data` (a 1-D tensor of ids). Returns the loss per step."""
    g = torch.Generator().manual_seed(seed)
    opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=0.1, betas=(0.9, 0.95))
    device = next(model.parameters()).device
    losses = []
    model.train()
    for step in range(steps):
        ix = torch.randint(len(data) - block - 1, (batch,), generator=g)
        x = torch.stack([data[i:i + block] for i in ix]).to(device)
        y = torch.stack([data[i + 1:i + block + 1] for i in ix]).to(device)   # the same text, shifted by one
        _, loss = model(x, y)
        opt.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        losses.append(loss.item())
        if log_every and (step % log_every == 0 or step == steps - 1):
            print(f"step {step:4d}  loss {loss.item():.3f}")
    return losses
