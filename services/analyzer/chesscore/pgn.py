"""PGN parsing into a normalized game record."""

from __future__ import annotations

import hashlib
import io
import re
from dataclasses import dataclass, field, asdict

import chess
import chess.pgn

_CLK_RE = re.compile(r"\[%clk (\d+):(\d+):(\d+(?:\.\d+)?)\]")


@dataclass
class GameRecord:
    game_id: str
    white: str
    black: str
    white_elo: int | None
    black_elo: int | None
    result: str
    time_control: str
    event: str
    termination: str
    start_fen: str
    moves_uci: list[str] = field(default_factory=list)
    moves_san: list[str] = field(default_factory=list)
    fens: list[str] = field(default_factory=list)          # fens[i] = position BEFORE ply i
    clocks: list[float | None] = field(default_factory=list)  # seconds left after ply i

    def to_dict(self) -> dict:
        return asdict(self)


def _int_or_none(v: str | None) -> int | None:
    try:
        return int(v) if v not in (None, "", "?") else None
    except ValueError:
        return None


def _game_id(headers: chess.pgn.Headers, moves: list[str]) -> str:
    site = headers.get("Site", "")
    if "lichess.org/" in site:
        return "li_" + site.rsplit("/", 1)[-1]
    h = hashlib.sha1(("|".join([headers.get("White", ""), headers.get("Black", ""),
                                headers.get("Date", ""), " ".join(moves)])).encode()).hexdigest()
    return "g_" + h[:12]


def game_to_record(game: chess.pgn.Game) -> GameRecord | None:
    headers = game.headers
    board = game.board()
    start_fen = board.fen()
    rec_moves, rec_san, fens, clocks = [], [], [], []
    for node in game.mainline():
        move = node.move
        if move not in board.legal_moves:
            return None
        fens.append(board.fen())
        rec_san.append(board.san(move))
        rec_moves.append(move.uci())
        m = _CLK_RE.search(node.comment or "")
        clocks.append(int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3)) if m else None)
        board.push(move)
    fens.append(board.fen())  # final position
    return GameRecord(
        game_id=_game_id(headers, rec_moves),
        white=headers.get("White", "White"),
        black=headers.get("Black", "Black"),
        white_elo=_int_or_none(headers.get("WhiteElo")),
        black_elo=_int_or_none(headers.get("BlackElo")),
        result=headers.get("Result", "*"),
        time_control=headers.get("TimeControl", "-"),
        event=headers.get("Event", ""),
        termination=headers.get("Termination", ""),
        start_fen=start_fen,
        moves_uci=rec_moves,
        moves_san=rec_san,
        fens=fens,
        clocks=clocks,
    )


def parse_pgn_text(text: str, max_games: int = 50) -> list[GameRecord]:
    """Parse every game in a PGN string. Illegal / empty games are skipped."""
    out: list[GameRecord] = []
    stream = io.StringIO(text)
    while len(out) < max_games:
        game = chess.pgn.read_game(stream)
        if game is None:
            break
        if game.errors:
            continue
        rec = game_to_record(game)
        if rec is not None and len(rec.moves_uci) > 0:
            out.append(rec)
    return out
