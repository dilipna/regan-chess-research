"""Leakage-safe train/validation/test split of ORIGINAL games, done before any synthetic
variant exists.

Games are grouped into connected components of the graph 'two games are linked if they share a
player name'. Whole components are assigned to a split, so no game and no player can appear in
more than one split. Synthetic variants inherit the split of their source game.
"""

from __future__ import annotations

import hashlib

from .. import config


class _UF:
    def __init__(self):
        self.p: dict[str, str] = {}

    def find(self, x: str) -> str:
        self.p.setdefault(x, x)
        while self.p[x] != x:
            self.p[x] = self.p[self.p[x]]
            x = self.p[x]
        return x

    def union(self, a: str, b: str):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.p[rb] = ra


def _bucket(key: str) -> float:
    h = hashlib.sha256(f"{config.SEED}:{key}".encode()).hexdigest()
    return int(h[:12], 16) / float(16 ** 12)


def assign_splits(games: list[dict]) -> dict[str, str]:
    """games: dicts with game_id, white, black. Returns {game_id: split}."""
    uf = _UF()
    for g in games:
        gid = "G:" + g["game_id"]
        uf.union(gid, "P:" + g["white"].lower())
        uf.union(gid, "P:" + g["black"].lower())
    edges = []
    acc = 0.0
    for name, frac in config.SPLIT_FRACTIONS.items():
        acc += frac
        edges.append((acc, name))
    out = {}
    for g in games:
        root = uf.find("G:" + g["game_id"])
        u = _bucket(root)
        out[g["game_id"]] = next(name for edge, name in edges if u < edge)
    return out


def check_no_leakage(games: list[dict], split_of_game: dict[str, str],
                     variant_rows: list[tuple[str, str]] | None = None) -> list[str]:
    """Return a list of violations (empty = OK).
    variant_rows: optional (source_game_id, split) pairs for every synthetic variant."""
    problems = []
    player_splits: dict[str, set[str]] = {}
    for g in games:
        s = split_of_game[g["game_id"]]
        for p in (g["white"].lower(), g["black"].lower()):
            player_splits.setdefault(p, set()).add(s)
    for p, ss in player_splits.items():
        if len(ss) > 1:
            problems.append(f"player {p} in splits {sorted(ss)}")
    if variant_rows is not None:
        seen: dict[str, set[str]] = {}
        for gid, s in variant_rows:
            seen.setdefault(gid, set()).add(s)
        for gid, ss in seen.items():
            if len(ss) > 1:
                problems.append(f"game {gid} variants in splits {sorted(ss)}")
            if gid in split_of_game and ss != {split_of_game[gid]}:
                problems.append(f"game {gid} variant split {sorted(ss)} != source split {split_of_game[gid]}")
    return problems
