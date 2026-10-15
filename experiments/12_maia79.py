"""Maia-3 79M full legal-move distributions for the direct comparison (additive; resumable).

The existing pipeline used Maia-3 5M (data/interim/maia/, unchanged). This script runs the released
Maia-3 79M checkpoint with the SAME input construction (official maia3 package, current position + up
to 7 previous positions, side-to-move Elo and opponent Elo) on every eligible position exported by
11_export_positions.py, and stores full-precision probabilities.

Output: data/interim/maia79/<game_id>.json  {"game_id", "model", "revision", "policies": {ply: {uci: p}}}
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services"))
from analyzer import config  # noqa: E402
from analyzer.maia.model import MaiaModel  # noqa: E402

OUT = config.INTERIM / "maia79"
MODEL = "maia3-79m"
REVISION = "a107d6ceb7b298cb04ae1da4edffe2939858b894"
HF_REF = Path.home() / ".cache" / "huggingface" / "hub" / "models--UofTCSSLab--Maia3-79M" / "refs" / "main"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--splits", default="test,val")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    maia = MaiaModel(MODEL)
    rev = HF_REF.read_text().strip() if HF_REF.exists() else None
    assert rev == REVISION, f"Maia-3 79M revision {rev} != pinned {REVISION}"
    print("model", maia.model_name, "revision", rev, "device", maia.device, flush=True)
    games = {json.loads(l)["game_id"]: json.loads(l)
             for l in (config.INTERIM / "games.jsonl").read_text(encoding="utf-8").splitlines()}
    want: dict[str, set[int]] = {}
    for s in args.splits.split(","):
        t = pd.read_parquet(config.INTERIM / "three_model" / f"targets_{s}.parquet", columns=["source_game_id", "ply"])
        for g, p in zip(t["source_game_id"], t["ply"]):
            want.setdefault(g, set()).add(int(p))
    t0 = time.time()
    for k, (gid, plies) in enumerate(sorted(want.items()), 1):
        path = OUT / f"{gid}.json"
        if path.exists():
            continue
        g = games[gid]
        pol = maia.game_policies(g["start_fen"], g["moves_uci"], g["white_elo"], g["black_elo"], plies=sorted(plies))
        path.write_text(json.dumps({"game_id": gid, "model": maia.model_name, "revision": rev,
                                    "policies": {str(p): d for p, d in pol.items()}}))
        if k % 100 == 0:
            print(f"{k}/{len(want)}  {time.time() - t0:.0f}s", flush=True)
    print("done", len(want), "games", f"{time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
