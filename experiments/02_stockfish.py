"""Run Stockfish MultiPV over every selected game (resumable, parallel).

Each worker owns one single-threaded Stockfish process at fixed depth, so results are
reproducible. Output: data/interim/sf/<game_id>.json
"""

from __future__ import annotations

import argparse
import json
import multiprocessing as mp
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services"))
from analyzer import config  # noqa: E402

OUT = config.INTERIM / "sf"
_AN = None


def _init():
    global _AN
    from analyzer.stockfish.engine import StockfishAnalyzer
    _AN = StockfishAnalyzer()


def _work(line: str):
    g = json.loads(line)
    path = OUT / f"{g['game_id']}.json"
    if path.exists():
        return g["game_id"], 0.0, True
    t0 = time.time()
    res = _AN.analyze_game(g["fens"], first_ply=config.OPENING_SKIP_PLIES)
    payload = {"game_id": g["game_id"], "engine": _AN.name, "depth": _AN.depth,
               "multipv": _AN.multipv, "first_ply": config.OPENING_SKIP_PLIES - 1, "analysis": res}
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload))
    tmp.replace(path)
    return g["game_id"], time.time() - t0, False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--games", default=str(config.INTERIM / "games.jsonl"))
    ap.add_argument("--workers", type=int, default=16)
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    lines = Path(args.games).read_text(encoding="utf-8").splitlines()
    import random
    random.Random(config.SEED).shuffle(lines)   # process bands interleaved
    if args.limit:
        lines = lines[: args.limit]
    t0 = time.time()
    done = 0
    with mp.Pool(args.workers, initializer=_init) as pool:
        for gid, dt, skipped in pool.imap_unordered(_work, lines, chunksize=1):
            done += 1
            if done % 25 == 0 or done == len(lines):
                el = time.time() - t0
                print(f"{done}/{len(lines)} games  elapsed {el/60:.1f} min  "
                      f"eta {el/done*(len(lines)-done)/60:.1f} min", flush=True)


if __name__ == "__main__":
    main()
