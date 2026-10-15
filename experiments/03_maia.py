"""Run Maia-3 over every selected game (resumable). Output: data/interim/maia/<game_id>.json
holding the full legal-move probability distribution for each ply >= OPENING_SKIP_PLIES - 1."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services"))
from analyzer import config  # noqa: E402
from analyzer.maia.model import get_maia  # noqa: E402

OUT = config.INTERIM / "maia"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    maia = get_maia()
    print("Maia model:", maia.model_name, "device:", maia.device, flush=True)
    lines = (config.INTERIM / "games.jsonl").read_text(encoding="utf-8").splitlines()
    t0 = time.time()
    for k, line in enumerate(lines, 1):
        g = json.loads(line)
        path = OUT / f"{g['game_id']}.json"
        if path.exists():
            continue
        last = min(len(g["moves_uci"]), config.MAX_ANALYZED_PLY + 1)
        plies = list(range(config.OPENING_SKIP_PLIES - 1, last))
        pol = maia.game_policies(g["start_fen"], g["moves_uci"], g["white_elo"], g["black_elo"], plies=plies)
        payload = {"game_id": g["game_id"], "model": maia.model_name,
                   "policies": {str(p): {m: round(v, 6) for m, v in d.items()} for p, d in pol.items()}}
        path.write_text(json.dumps(payload))
        if k % 100 == 0:
            print(f"{k}/{len(lines)}  {time.time() - t0:.0f}s", flush=True)
    print("done", time.time() - t0)


if __name__ == "__main__":
    main()
