"""Controlled engine-assistance variants (decision-level substitution).

Definitions
-----------
Unit: one player's eligible decisions in one game (a "player-game"), n decisions.
Nominal assistance level alpha in {0, .05, .10, .20, .40, .70}.
m = max(1, round(alpha * n)) decisions are ALTERED (for alpha > 0), i.e. the human move is
replaced by a different, engine-chosen move. A decision where the human already played the
engine's choice cannot be altered and is not eligible for selection.
If fewer than m decisions are alterable, all alterable decisions are altered.
realized alpha = (# altered decisions) / n  -- this is the regression target.

Strategies
----------
RANDOM    : alterable = decisions where human move != Stockfish #1; choose m uniformly at
            random; substitute Stockfish #1.
SELECTIVE : same alterable set and substitute, but choose the m decisions with the highest
            position difficulty (1 - projected top-1 probability for this Elo).
SUBTLE    : substitute = a move drawn uniformly from Stockfish top-3 lines within 30 cp of the
            best line, excluding the human move; alterable = decisions with such an option;
            choose m uniformly at random.
Selections are nested across alpha (the 10% set contains the 5% set, etc.).

Limitation: the rest of the game is NOT re-simulated after a substitution; each decision is
treated as a choice in the original position (the same per-position independence used by
projection models). This is documented in the methodology.
"""

from __future__ import annotations

import hashlib

import numpy as np

from .. import config


def _rng(*keys) -> np.random.Generator:
    h = hashlib.sha256(("|".join(map(str, (config.SEED,) + keys))).encode()).digest()
    return np.random.default_rng(int.from_bytes(h[:8], "little"))


def subtle_options(dec: dict) -> list[int]:
    played = dec["played_idx"]
    return [i for i, c in enumerate(dec["cands"])
            if c["sf_rank"] <= 3 and c["cpl"] <= config.SUBTLE_MAX_LOSS_CP and i != played]


def plan_strategy(decs: list[dict], strategy: str, key: str) -> list[tuple[int, int]]:
    """Ordered list of (decision position, substitute candidate idx). Taking the first m
    entries yields the variant at any level, which makes levels nested."""
    rng = _rng(key, strategy)
    if strategy in ("random", "selective"):
        pool = [(j, 0) for j, d in enumerate(decs) if d["played_idx"] != 0]  # cand 0 = SF #1
        if strategy == "random":
            order = rng.permutation(len(pool))
            return [pool[k] for k in order]
        diff = np.array([decs[j]["difficulty"] for j, _ in pool])
        tiebreak = rng.random(len(pool)) * 1e-9
        order = np.argsort(-(diff + tiebreak), kind="stable")
        return [pool[k] for k in order]
    if strategy == "subtle":
        pool = []
        for j, d in enumerate(decs):
            opts = subtle_options(d)
            if opts:
                pool.append((j, int(opts[rng.integers(len(opts))])))
        order = rng.permutation(len(pool))
        return [pool[k] for k in order]
    raise ValueError(strategy)


def n_altered(alpha: float, n: int) -> int:
    if alpha <= 0 or n == 0:
        return 0
    return max(1, int(round(alpha * n)))


def make_variants(decs: list[dict], key: str) -> list[dict]:
    """All variants for one player-game. decs: eligible decisions in ply order.
    Returns dicts: strategy, level, choice (cand idx per decision), altered (bool per decision),
    realized_alpha."""
    n = len(decs)
    base = [d["played_idx"] for d in decs]
    out = [{"strategy": "none", "level": 0.0, "choice": base, "altered": [False] * n, "realized_alpha": 0.0}]
    for strat in config.STRATEGIES:
        plan = plan_strategy(decs, strat, key)
        for lvl in config.ASSIST_LEVELS[1:]:
            m = min(n_altered(lvl, n), len(plan))
            choice = list(base)
            altered = [False] * n
            for j, ci in plan[:m]:
                choice[j] = ci
                altered[j] = True
            out.append({"strategy": strat, "level": lvl, "choice": choice, "altered": altered,
                        "realized_alpha": m / n if n else 0.0})
    return out
