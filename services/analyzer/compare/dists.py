"""Per-position legal-move distributions of the direct comparators, loaded from stored model outputs.

Every distribution is validated against the legal moves of the position (python-chess): the support
must be exactly the legal move set and the probabilities must sum to 1 (tolerance documented per
model). Nothing is imputed: a missing model output raises, or (Qwen) yields "pending".
"""

from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path

import chess
import numpy as np

from .. import config

PROB_FLOOR = 1e-6          # same floor as the existing surprisal definition (maia/model.py)
QWEN_DIR = config.INTERIM / "qwen"
MAIA5_DIR = config.INTERIM / "maia"
MAIA79_DIR = config.INTERIM / "maia79"

MODEL_LABELS = {
    "R": "Regan-inspired reconstruction",
    "Q": "Qwen3-8B-Base",
    "Q0": "Qwen3-8B-Base (position-only ablation)",
    "M": "Maia-3 79M",
    "M5": "Maia-3 5M",
}
# Maia-3 5M policies were stored rounded to 6 decimals by 03_maia.py, so their sums deviate slightly.
SUM_TOL = {"M5": 5e-4, "M": 1e-4, "Q": 1e-6, "Q0": 1e-6}


def legal_moves(fen: str) -> set[str]:
    return {m.uci() for m in chess.Board(fen).legal_moves}


def validate(dist: dict[str, float], fen: str, model: str) -> dict[str, float]:
    legal = legal_moves(fen)
    if set(dist) != legal:
        raise ValueError(f"{model}: support != legal moves at {fen} "
                         f"(extra {sorted(set(dist) - legal)[:3]}, missing {sorted(legal - set(dist))[:3]})")
    s = float(sum(dist.values()))
    if abs(s - 1.0) > SUM_TOL[model]:
        raise ValueError(f"{model}: probabilities sum to {s} at {fen}")
    return dist


@lru_cache(maxsize=4096)
def _maia_file(directory: str, gid: str) -> dict:
    p = Path(directory) / f"{gid}.json"
    return json.loads(p.read_text())["policies"]


def maia_dist(model: str, gid: str, ply: int) -> dict[str, float]:
    d = MAIA79_DIR if model == "M" else MAIA5_DIR
    pol = _maia_file(str(d), gid)
    return pol[str(ply)]


def qwen_path(condition: str, split: str) -> Path:
    return QWEN_DIR / condition / f"{split}.jsonl"


def load_qwen(condition: str, split: str, expected_model: str = "Qwen/Qwen3-8B-Base") -> dict[str, dict] | None:
    """{position_id: {"logprob": {...}, "prob": {...}, meta}} or None if not scored yet (pending)."""
    p = qwen_path(condition, split)
    if not p.exists():
        return None
    from ..qwen.prompt import PROMPT_HASH
    from ..qwen.scorer import normalize
    out = {}
    for line in p.read_text(encoding="utf-8").splitlines():
        r = json.loads(line)
        if r["model_id"] != expected_model:
            raise ValueError(f"{p}: model {r['model_id']} is not {expected_model}; refusing to mix models")
        if r["prompt_hash"] != PROMPT_HASH[condition]:
            raise ValueError(f"{p}: prompt hash {r['prompt_hash']} != frozen {PROMPT_HASH[condition]}")
        r["prob"] = normalize(r["logprob"])
        out[r["position_id"]] = r
    return out


def entropy(dist: dict[str, float]) -> float:
    a = np.array([v for v in dist.values() if v > 0], dtype=np.float64)
    return float(-(a * np.log(a)).sum())


def rank_of(dist: dict[str, float], move: str) -> int:
    p = dist[move]
    return 1 + sum(1 for v in dist.values() if v > p)


def surprisal(p: float) -> float:
    return -math.log(max(p, PROB_FLOOR))


def top_k(dist: dict[str, float], k: int = 5) -> list[tuple[str, float]]:
    return sorted(dist.items(), key=lambda kv: (-kv[1], kv[0]))[:k]
