"""Join Stockfish + Maia into per-decision records.

For each player decision (ply) we build
  * position-level fields (identical for every hypothetical move at that decision), and
  * a CANDIDATE table: every Stockfish MultiPV move plus the actually played move, each with
    sf_rank, eval, centipawn loss, Maia probability and Maia rank.

A synthetic-assistance variant is then just a choice of one candidate per decision, so
all move-level features of a variant are exact functions of the original analyses.

Played move outside the MultiPV list: its evaluation is taken as minus the best evaluation of
the resulting position (analysed at the same depth), capped to be no better than the K-th
line, and its rank is censored as K+1 ("not in top-K").
"""

from __future__ import annotations

import math

import chess
import numpy as np

from .. import config
from ..maia.model import surprisal

PIECE_VALUES = {chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9}


def clip_cp(cp: float) -> float:
    return float(max(-config.EVAL_CAP_CP, min(config.EVAL_CAP_CP, cp)))


def game_phase(board: chess.Board, ply: int) -> str:
    npm = sum(len(board.pieces(pt, c)) * v for pt, v in PIECE_VALUES.items() for c in chess.COLORS)
    if npm <= 26:
        return "endgame"
    if ply < 30:
        return "opening"
    return "middlegame"


def best_cp_of(an: dict | None) -> float | None:
    if an is None:
        return None
    if an.get("lines"):
        return clip_cp(an["lines"][0]["cp"])
    if "terminal_cp" in an:
        return clip_cp(an["terminal_cp"])
    return None


def build_game_decisions(game: dict, sf: list[dict | None], maia: dict[int, dict[str, float]]) -> list[dict]:
    """Return a list of decision dicts for ALL plies that have analysis (eligible flag set)."""
    K = config.SF_MULTIPV
    out = []
    moves = game["moves_uci"]
    for ply, played in enumerate(moves):
        an = sf[ply] if ply < len(sf) else None
        if an is None or not an.get("lines"):
            continue
        board = chess.Board(game["fens"][ply])
        white = board.turn == chess.WHITE
        lines = an["lines"]
        n_legal = board.legal_moves.count()
        best = clip_cp(lines[0]["cp"])
        cps = [clip_cp(l["cp"]) for l in lines]
        line_moves = [l["move"] for l in lines]

        # evaluation of the played move
        if played in line_moves:
            p_rank = line_moves.index(played) + 1
            p_cp = cps[p_rank - 1]
        else:
            nxt = best_cp_of(sf[ply + 1]) if ply + 1 < len(sf) else None
            p_rank = len(lines) + 1
            p_cp = -nxt if nxt is not None else cps[-1]
            p_cp = min(p_cp, cps[-1])

        dist = maia.get(ply, {})
        order = sorted(dist.items(), key=lambda kv: -kv[1])
        maia_rank = {m: i + 1 for i, (m, _) in enumerate(order)}
        maia_top = [m for m, _ in order[:5]]

        def cand(move: str, rank: int, cp: float) -> dict:
            p = dist.get(move, float("nan"))
            return {"move": move, "sf_rank": rank, "cp": cp, "cpl": max(0.0, best - cp),
                    "maia_p": p, "maia_rank": maia_rank.get(move, n_legal),
                    "surprisal": surprisal(p) if not math.isnan(p) else float("nan")}

        cands = [cand(m, i + 1, c) for i, (m, c) in enumerate(zip(line_moves, cps))]
        if played not in line_moves:
            cands.append(cand(played, p_rank, p_cp))
        played_idx = next(i for i, c in enumerate(cands) if c["move"] == played)

        prev_best = best_cp_of(sf[ply - 1]) if ply >= 1 else None
        eval_swing = abs(best - (-prev_best)) if prev_best is not None else 0.0
        gap12 = best - cps[1] if len(cps) > 1 else float(config.EVAL_CAP_CP)
        near_opt = sum(1 for c in cps if best - c <= config.NEAR_OPTIMAL_CP)
        probs = np.array(list(dist.values())) if dist else np.array([1.0])
        pp = probs[probs > 0]
        entropy = float(-(pp * np.log(pp)).sum())                  # E[surprisal] under Maia
        svar = float((pp * np.log(pp) ** 2).sum() - entropy ** 2)  # Var[surprisal] under Maia

        eligible = (ply >= config.OPENING_SKIP_PLIES and n_legal >= 2
                    and abs(best) <= config.DECIDED_EVAL_CP and len(lines) >= 2)

        out.append({
            "game_id": game["game_id"],
            "ply": ply,
            "move_no": ply // 2 + 1,
            "color": "white" if white else "black",
            "player": game["white"] if white else game["black"],
            "elo": game["white_elo"] if white else game["black_elo"],
            "opp_elo": game["black_elo"] if white else game["white_elo"],
            "fen": game["fens"][ply],
            "san": game["moves_san"][ply],
            "played": played,
            "eligible": bool(eligible),
            "n_legal": n_legal,
            "eval_before": best,
            "eval_swing": min(eval_swing, 2 * config.EVAL_CAP_CP),
            "gap12": min(gap12, config.SELECTIVE_GAP_CAP_CP * 2),
            "near_opt": near_opt,
            "phase": game_phase(board, ply),
            "sf_best": line_moves[0],
            "maia_top1": maia_top[0] if maia_top else None,
            "maia_top": maia_top,
            "maia_p_best": dist.get(line_moves[0], float("nan")),
            "maia_p_top1": order[0][1] if order else float("nan"),
            "maia_top_p": [round(p, 5) for _, p in order[:5]],
            "maia_entropy": entropy,
            "maia_svar": max(svar, 0.0),
            "maia_sf_agree": bool(maia_top and maia_top[0] == line_moves[0]),
            "cands": cands,
            "played_idx": played_idx,
            "sf_lines": [{"move": l["move"], "cp": l["cp"], "pv": l.get("pv", [])} for l in lines],
            "sf_depth": int(an.get("depth", 0)),
            "sf_quick": bool(an.get("quick", False)),
        })
    return out
