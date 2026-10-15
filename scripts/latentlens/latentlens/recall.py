"""Next-token recall scoring and intermediate diagnostic projections.

For a text x_0..x_{T-1} and every position t, the model's output at t is a distribution over x_{t+1}. We record the
rank, probability and margin of the TRUE next token (teacher forcing: the model always sees the true prefix).

Diagnostic projection ("logit lens"): the residual stream after block k is passed through the model's own final RMSNorm
and LM head, unchanged. Only at the last block is this the model's actual output distribution. At earlier blocks it is a
diagnostic: the final norm and LM head were trained to read the LAST residual, so earlier residuals are read through a
lens they were not trained for. Results are labelled "intermediate diagnostic projection", never "the model's
prediction at layer k".
"""

from __future__ import annotations

import math

import torch


@torch.inference_mode()
def score_logits(logits: torch.Tensor, targets: torch.Tensor) -> dict[str, torch.Tensor]:
    """logits [T, V] float32, targets [T] int64 -> per-position statistics (all [T])."""
    logits = logits.float()
    logp = torch.log_softmax(logits, dim=-1)
    true_logit = logits.gather(1, targets[:, None])[:, 0]
    rank = (logits > true_logit[:, None]).sum(1) + 1
    top2 = logits.topk(2, dim=-1)
    other_best = torch.where(top2.indices[:, 0] == targets, top2.values[:, 1], top2.values[:, 0])
    p = logp.exp()
    return {
        "rank": rank,
        "p_true": logp.gather(1, targets[:, None])[:, 0].exp(),
        "logp_true": logp.gather(1, targets[:, None])[:, 0],
        "top_id": top2.indices[:, 0],
        "p_top": p.gather(1, top2.indices[:, :1])[:, 0],
        "margin": true_logit - other_best,          # > 0 exactly when the true token is ranked first
        "top_margin": top2.values[:, 0] - top2.values[:, 1],
        "entropy": -(p * logp).sum(-1),
    }


@torch.inference_mode()
def project_and_score(adapter, resid: torch.Tensor, targets: torch.Tensor, chunk: int = 128) -> dict[str, torch.Tensor]:
    """resid [T, D] residual-stream vectors at one depth; returns score_logits over positions, in chunks."""
    parts = []
    for s in range(0, resid.shape[0], chunk):
        logits = adapter.project_to_logits(resid[s:s + chunk])
        parts.append({k: v.cpu() for k, v in score_logits(logits, targets[s:s + chunk].to(logits.device)).items()})
    return {k: torch.cat([p[k] for p in parts]) for k in parts[0]}


def stabilization_depth(top_ids_by_depth: list[int], final_top: int) -> int | None:
    """First depth index d such that the diagnostic top token equals the final top token at every depth >= d."""
    d = None
    for k in range(len(top_ids_by_depth) - 1, -1, -1):
        if top_ids_by_depth[k] == final_top:
            d = k
        else:
            break
    return d


def summarize(stats: dict[str, torch.Tensor]) -> dict[str, float]:
    r = stats["rank"].float()
    return {"n": int(r.numel()), "top1_rate": float((r == 1).float().mean()), "top5_rate": float((r <= 5).float().mean()),
            "median_rank": float(r.median()), "mean_logp_true": float(stats["logp_true"].mean()),
            "perplexity": float(math.exp(-stats["logp_true"].mean().item())), "mean_entropy": float(stats["entropy"].mean())}
