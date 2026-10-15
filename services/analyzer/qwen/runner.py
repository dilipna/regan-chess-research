"""Batch scoring of exported position records (used locally and inside the Modal GPU job).

Input record (JSON, one per position; no played move, no assistance information):
    {"position_id", "fen", "elo", "opp_elo", "engine_lines": [[uci, cp], ...]}
Output record:
    {"position_id", "condition", "model_id", "revision", "dtype", "prompt_hash", "cache_key",
     "candidates": [uci ...], "logprob": {uci: L_i}, "n_tokens": {uci: n}}
Normalization to probabilities happens downstream (scorer.normalize), from the stored L_i.
"""

from __future__ import annotations

import time
from collections.abc import Iterable, Iterator

from .cache import ScoreCache, cache_key
from .prompt import PROMPT_HASH, REGAN_ALIGNED, PositionInput, build_prompt, candidate_text


def record_to_position(r: dict) -> PositionInput:
    return PositionInput(fen=r["fen"], elo=int(r["elo"]), opp_elo=int(r["opp_elo"]),
                         engine_lines=tuple((u, float(cp)) for u, cp in r.get("engine_lines", [])))


def score_records(scorer, records: Iterable[dict], condition: str = REGAN_ALIGNED,
                  cache: ScoreCache | None = None, log_every: int = 200) -> Iterator[dict]:
    t0 = time.time()
    for k, r in enumerate(records, 1):
        pos = record_to_position(r)
        prompt, legal = build_prompt(pos, condition)
        key = cache_key(pos, legal, model_id=scorer.model_id, revision=scorer.revision,
                        dtype=scorer.dtype_name, condition=condition)
        hit = cache.get(key) if cache else None
        if hit is None:
            sc = scorer.score_position(prompt, {m: candidate_text(m) for m in legal})
            hit = {"logprob": {m: sc[m]["logprob"] for m in legal}, "n_tokens": {m: sc[m]["n_tokens"] for m in legal}}
            if cache:
                cache.put(key, hit)
        yield {"position_id": r["position_id"], "condition": condition, "model_id": scorer.model_id,
               "revision": scorer.revision, "dtype": scorer.dtype_name, "prompt_hash": PROMPT_HASH[condition],
               "cache_key": key, "candidates": legal, **hit}
        if log_every and k % log_every == 0:
            print(f"  scored {k} positions ({time.time() - t0:.0f}s)", flush=True)
