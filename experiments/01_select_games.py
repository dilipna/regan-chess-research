"""Select a stratified sample of genuine human games from a (truncated) Lichess dump.

Selection rule (documented in README):
  * rated standard games, estimated duration base + 40*inc >= 480 s (rapid/classical)
  * Termination in {Normal, Time forfeit}  (excludes 'Rules infraction', 'Abandoned')
  * both ratings present and in [1000, 2700)
  * >= 50 plies
  * at most ONE game per player name across the whole sample
  * stratified: equal number of games per Elo band of the mean rating
Output: data/interim/games.jsonl
"""

from __future__ import annotations

import argparse
import io
import json
import random
import re
import sys
from pathlib import Path

import zstandard

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services"))
from analyzer import config  # noqa: E402
from analyzer.chesscore.pgn import parse_pgn_text  # noqa: E402

HDR = re.compile(r'^\[(\w+) "(.*)"\]$', re.M)


def iter_raw_games(path: Path, max_bytes: int):
    dctx = zstandard.ZstdDecompressor()
    buf = ""
    with open(path, "rb") as fh:
        reader = dctx.stream_reader(fh)
        text = io.TextIOWrapper(reader, encoding="utf-8", errors="replace")
        read = 0
        try:
            while read < max_bytes:
                chunk = text.read(1 << 20)
                if not chunk:
                    break
                read += len(chunk)
                buf += chunk
                parts = buf.split("\n\n[Event ")
                for p in parts[:-1]:
                    yield p if p.startswith("[Event") else "[Event " + p
                buf = parts[-1]
        except zstandard.ZstdError:
            pass  # truncated download: stop at the last complete game


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=str(config.RAW / "lichess_2026-08_head.pgn.zst"))
    ap.add_argument("--per-band", type=int, default=600)
    ap.add_argument("--max-bytes", type=int, default=600_000_000)
    args = ap.parse_args()

    rng = random.Random(config.SEED)
    by_band: dict[str, list[str]] = {f"{lo}-{hi - 1}": [] for lo, hi in config.ELO_BANDS}
    seen_players: set[str] = set()
    n_raw = 0
    for raw in iter_raw_games(Path(args.src), args.max_bytes):
        n_raw += 1
        h = dict(HDR.findall(raw.split("\n\n", 1)[0]))
        if not h.get("Event", "").startswith("Rated"):
            continue
        if h.get("Variant", "Standard") != "Standard":
            continue
        if h.get("Termination") not in ("Normal", "Time forfeit"):
            continue
        tc = h.get("TimeControl", "-")
        if "+" not in tc:
            continue
        base, inc = (int(x) for x in tc.split("+"))
        if base + 40 * inc < 480:
            continue
        try:
            we, be = int(h["WhiteElo"]), int(h["BlackElo"])
        except (KeyError, ValueError):
            continue
        if not (1000 <= we < 2700 and 1000 <= be < 2700):
            continue
        w, b = h.get("White"), h.get("Black")
        if w in seen_players or b in seen_players or w == b:
            continue
        band = config.elo_band((we + be) / 2)
        if band not in by_band or len(by_band[band]) >= args.per_band * 3:
            continue
        # cheap ply count: count move numbers
        if raw.count(". ") < 25:
            continue
        by_band[band].append(raw)
        seen_players.update([w, b])
        if all(len(v) >= args.per_band * 3 for v in by_band.values()):
            break

    print(f"scanned {n_raw} raw games; pool per band:", {k: len(v) for k, v in by_band.items()})
    out = config.INTERIM / "games.jsonl"
    out.parent.mkdir(parents=True, exist_ok=True)
    n_out = 0
    with open(out, "w", encoding="utf-8") as fh:
        for band, raws in by_band.items():
            rng.shuffle(raws)
            kept = 0
            for raw in raws:
                recs = parse_pgn_text(raw, max_games=1)
                if not recs or len(recs[0].moves_uci) < 50:
                    continue
                d = recs[0].to_dict()
                d["band"] = band
                fh.write(json.dumps(d) + "\n")
                kept += 1
                n_out += 1
                if kept >= args.per_band:
                    break
            print(band, "kept", kept)
    print("wrote", n_out, "games to", out)


if __name__ == "__main__":
    main()
