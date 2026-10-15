"""Stockfish MultiPV analysis.

Reproducibility: Threads=1, fixed depth, and a fresh hash (`ucinewgame`) for each game, so
the same game analyzed twice yields identical output.

All scores are reported in centipawns from the perspective of the side to move,
mate scores mapped to +/-MATE_CP.
"""

from __future__ import annotations

import chess
import chess.engine

from .. import config


def score_to_cp(score: chess.engine.PovScore, turn: chess.Color) -> int:
    return int(score.pov(turn).score(mate_score=config.MATE_CP))


class StockfishAnalyzer:
    def __init__(self, path: str | None = None, depth: int | None = None,
                 multipv: int | None = None, threads: int = 1):
        self.path = path or config.STOCKFISH_PATH
        self.depth = depth or config.SF_DEPTH
        self.multipv = multipv or config.SF_MULTIPV
        self.engine = chess.engine.SimpleEngine.popen_uci(self.path)
        self.engine.configure({"Threads": threads, "Hash": config.SF_HASH_MB})
        self.name = self.engine.id.get("name", "Stockfish")

    def close(self):
        try:
            self.engine.quit()
        except Exception:
            pass

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    def analyze_position(self, board: chess.Board, game_token: object, prefilter: bool = True) -> dict:
        """MultiPV analysis of one position. Returns {'lines': [{'move','cp'}...], 'depth'}."""
        if board.is_game_over(claim_draw=False):
            outcome = board.outcome()
            if outcome is not None and outcome.winner is not None:
                cp = -config.MATE_CP if outcome.winner != board.turn else config.MATE_CP
            else:
                cp = 0
            return {"lines": [], "terminal_cp": cp, "depth": 0}
        n_legal = board.legal_moves.count()
        if prefilter:
            q = self.engine.analyse(board, chess.engine.Limit(depth=config.SF_PREFILTER_DEPTH), game=game_token)
            qcp = score_to_cp(q["score"], board.turn)
            if abs(qcp) > config.SF_PREFILTER_DECIDED_CP and q.get("pv"):
                # decided position: single quick line only (ineligible by rule 4)
                return {"lines": [{"move": q["pv"][0].uci(), "cp": qcp, "pv": [m.uci() for m in q["pv"][:6]]}],
                        "depth": int(q.get("depth", 0)), "quick": True}
        infos = self.engine.analyse(
            board,
            chess.engine.Limit(depth=self.depth),
            multipv=min(self.multipv, n_legal),
            game=game_token,
        )
        lines = []
        for info in infos:
            pv = info.get("pv")
            if not pv:
                continue
            lines.append({"move": pv[0].uci(), "cp": score_to_cp(info["score"], board.turn),
                          "pv": [m.uci() for m in pv[:6]]})
        # python-chess returns lines ordered by multipv index (best first)
        return {"lines": lines, "depth": int(infos[0].get("depth", 0)) if infos else 0}

    def analyze_game(self, fens: list[str], game_token: object | None = None,
                     first_ply: int = 0) -> list[dict | None]:
        """Analyze fens[first_ply:]. fens[i] is the position before ply i (the last fen is the
        final position, analyzed too so the last move's evaluation is known)."""
        token = game_token if game_token is not None else object()
        out: list[dict | None] = [None] * len(fens)
        last = min(len(fens), config.MAX_ANALYZED_PLY + 1)
        for i in range(max(0, first_ply - 1), last):
            out[i] = self.analyze_position(chess.Board(fens[i]), token)
        return out
