"""Immutable cache of position-level Qwen scores.

Key = SHA-256 of {model id, model revision, tokenizer revision, dtype, prompt hash, condition, candidate
format, FEN, player Elo, opponent Elo, sorted candidate set, engine-input configuration, engine lines}.
Any change in model/prompt/engine input gives a different key, so scores from incompatible
configurations are never reused. Entries are insert-only (INSERT OR IGNORE): an existing key is never
overwritten.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path

from .prompt import CANDIDATE_FORMAT, ENGINE_DESCRIPTION, PROMPT_HASH, REGAN_ALIGNED, PositionInput


def cache_key(pos: PositionInput, candidates: list[str], *, model_id: str, revision: str, dtype: str,
              condition: str = REGAN_ALIGNED, tokenizer_revision: str | None = None) -> str:
    payload = {
        "model_id": model_id, "revision": revision, "tokenizer_revision": tokenizer_revision or revision,
        "dtype": dtype, "prompt_hash": PROMPT_HASH[condition], "condition": condition,
        "candidate_format": CANDIDATE_FORMAT, "fen": pos.fen, "elo": int(pos.elo), "opp_elo": int(pos.opp_elo),
        "candidates": sorted(candidates),
        "engine_config": ENGINE_DESCRIPTION if condition == REGAN_ALIGNED else None,
        "engine_lines": [[u, float(cp)] for u, cp in pos.engine_lines] if condition == REGAN_ALIGNED else None,
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


class ScoreCache:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(str(self.path))
        self.db.execute("CREATE TABLE IF NOT EXISTS scores (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
        self.db.commit()

    def get(self, key: str) -> dict | None:
        row = self.db.execute("SELECT value FROM scores WHERE key = ?", (key,)).fetchone()
        return json.loads(row[0]) if row else None

    def put(self, key: str, value: dict) -> None:
        self.db.execute("INSERT OR IGNORE INTO scores (key, value) VALUES (?, ?)", (key, json.dumps(value)))
        self.db.commit()

    def __len__(self) -> int:
        return self.db.execute("SELECT COUNT(*) FROM scores").fetchone()[0]

    def close(self):
        self.db.close()
