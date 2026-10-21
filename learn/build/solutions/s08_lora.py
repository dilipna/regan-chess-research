"""Step 8 · LoRA: fine-tune a model by training a tiny add-on instead of the whole thing.

Full fine-tuning updates every weight (8.19 billion numbers for Qwen3-8B). LoRA freezes them and learns a
low-rank CORRECTION for chosen matrices: W' = W + (alpha / r) · B A, where A is [r, in] and B is [out, r] with r
small (8 or 16). B starts at zero, so at the start the model is exactly the original. Only A and B train, and
afterwards B A can be merged into W so inference costs nothing extra.

For one 4,096 x 4,096 q_proj in Qwen3-8B with r = 16: 16.8 million frozen weights vs 131,072 trainable.

Atlas link: Wq → Q and Wv → V (Inside attention) are the classic LoRA targets.
Run the checks:  python -m pytest -k s08
"""
from __future__ import annotations

import math

import torch
from torch import nn


class LoRALinear(nn.Module):
    def __init__(self, base: nn.Linear, r: int = 8, alpha: float = 16.0):
        super().__init__()
        self.base, self.r, self.scale = base, r, alpha / r
        # TODO(8.1): freeze every parameter of base (requires_grad = False). Create
        # A = nn.Parameter of shape [r, in_features], initialised like nn.Linear (kaiming_uniform_ with a=sqrt(5)),
        # B = nn.Parameter of zeros, shape [out_features, r].
        for p in base.parameters():
            p.requires_grad_(False)
        self.A = nn.Parameter(torch.empty(r, base.in_features))
        nn.init.kaiming_uniform_(self.A, a=math.sqrt(5))
        self.B = nn.Parameter(torch.zeros(base.out_features, r))
        # END TODO

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # TODO(8.2): base(x) + scale * (x Aᵀ) Bᵀ. Never build the full [out, in] matrix here: two thin matmuls are cheaper.
        return self.base(x) + self.scale * ((x @ self.A.T) @ self.B.T)
        # END TODO

    def merged_weight(self) -> torch.Tensor:
        """The single weight matrix that behaves exactly like base + LoRA (what you ship after training)."""
        # TODO(8.3): W + scale * B @ A
        return self.base.weight + self.scale * (self.B @ self.A)
        # END TODO


def add_lora(model: nn.Module, targets: tuple[str, ...] = ("q_proj", "v_proj"), r: int = 8, alpha: float = 16.0) -> nn.Module:
    """Wrap every nn.Linear whose attribute name is in targets; freeze everything else. Returns the model."""
    # TODO(8.4): first set requires_grad = False on ALL of the model's parameters. Then, for every module and every
    # direct child (module.named_children()) that is an nn.Linear named in targets, replace it with
    # LoRALinear(child, r, alpha) using setattr. Collect the replacements first, then set them, so you do not
    # modify the model while iterating over it.
    for p in model.parameters():
        p.requires_grad_(False)
    swaps = [(parent, name, child) for parent in model.modules() for name, child in parent.named_children()
             if name in targets and isinstance(child, nn.Linear)]
    for parent, name, child in swaps:
        setattr(parent, name, LoRALinear(child, r, alpha))
    return model
    # END TODO


def trainable(model: nn.Module) -> int:
    return sum(p.numel() for p in model.parameters() if p.requires_grad)
