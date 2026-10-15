"""Export the eligible decision positions that the direct three-model comparison scores.

Additive step; reads only existing artifacts (decisions.pkl, variants.parquet, splits.json) and changes none.

Outputs (data/interim/three_model/):
  positions_<split>.jsonl   prompt inputs only: position_id, fen, elo, opp_elo, engine_lines.
                            No played move and no assistance information -> safe to send to a GPU job.
  targets_<split>.parquet   position_id, source game, colour, ply, split, played move, Stockfish lines
                            (kept local; used only for evaluation).

Positions = eligible decisions of player-games that are in the controlled benchmark (>= 10 eligible
decisions), i.e. exactly the decisions behind every original and substituted row of variants.parquet.
Substituted variants are decision-level substitutions in these same original positions, so one
legal-move distribution per position serves all 16 rows of a player-game.
"""

from __future__ import annotations

import argparse
import json
import pickle
import sys
from pathlib import Path

import chess
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services"))
from analyzer import config  # noqa: E402

OUT = config.INTERIM / "three_model"


def position_id(gid: str, ply: int) -> str:
    return f"{gid}:{ply}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--splits", default="test,val,train")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    with open(config.PROCESSED / "decisions.pkl", "rb") as fh:
        decs = pickle.load(fh)
    split = json.loads((config.PROCESSED / "splits.json").read_text())
    v = pd.read_parquet(config.PROCESSED / "variants.parquet", columns=["game_id", "color", "split", "level", "n_dec"])
    pgs = v[v["level"] == 0]
    for s in args.splits.split(","):
        keys = set(zip(pgs.loc[pgs["split"] == s, "game_id"], pgs.loc[pgs["split"] == s, "color"]))
        recs, tg = [], []
        for gid in sorted({g for g, _ in keys}):
            assert split[gid] == s
            for d in decs[gid]:
                if not d["eligible"] or (gid, d["color"]) not in keys:
                    continue
                board = chess.Board(d["fen"])
                assert chess.Move.from_uci(d["played"]) in board.legal_moves, "played move must be legal"
                pid = position_id(gid, d["ply"])
                recs.append({"position_id": pid, "fen": d["fen"], "elo": int(d["elo"]), "opp_elo": int(d["opp_elo"]),
                             "engine_lines": [[l["move"], float(l["cp"])] for l in d["sf_lines"]]})
                tg.append({"position_id": pid, "source_game_id": gid, "color": d["color"], "ply": d["ply"],
                           "split": s, "fen": d["fen"], "player_elo": int(d["elo"]), "opponent_elo": int(d["opp_elo"]),
                           "side_to_move": "white" if board.turn == chess.WHITE else "black",
                           "played_move_uci": d["played"], "candidate_count": board.legal_moves.count(),
                           "sf_moves": [l["move"] for l in d["sf_lines"]],
                           "p_t1": d["p_t1"], "p_t3": d["p_t3"], "difficulty": d["difficulty"]})
        n_dec = int(pgs.loc[pgs["split"] == s, "n_dec"].sum())
        assert len(recs) == n_dec, f"{s}: {len(recs)} positions vs {n_dec} eligible decisions in variants.parquet"
        with open(OUT / f"positions_{s}.jsonl", "w", encoding="utf-8") as fh:
            for r in recs:
                fh.write(json.dumps(r) + "\n")
        pd.DataFrame(tg).to_parquet(OUT / f"targets_{s}.parquet", index=False)
        print(f"{s}: {len(recs)} positions from {len(keys)} player-games")


if __name__ == "__main__":
    main()
