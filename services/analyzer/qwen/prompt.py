"""Frozen prompt templates for scoring legal chess moves with a base (non-chat) LLM.

The LLM is never asked for a verdict or a confidence. Every legal move m_i is appended to the same
prompt as the fixed continuation CANDIDATE_FORMAT, and the model's summed token log-probability of
that continuation is the move's score (see scorer.py).

Information policy (both conditions): only what is known BEFORE the decision is shown -- player and
opponent Elo, side to move, the FEN, the legal moves and (primary condition only) the Stockfish
MultiPV lines of that position, which the Regan-inspired statistical baseline also uses. The played
move, any substitution label, the assistance level, the evaluation of the played move when it lies
outside the MultiPV lines (that value is derived from the target) and anything after the decision
are never part of a prompt. Legal moves are listed in lexicographic UCI order so the list order
carries no engine or target information. No few-shot examples are used.

Changing anything in this file changes PROMPT_HASH, which is part of every cache key and is recorded
in every Qwen artifact; scores produced under a different hash are never reused.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field

import chess

PROMPT_VERSION = "chessassistlens.qwen-prompt.v1"

# Condition names
REGAN_ALIGNED = "regan_aligned"     # primary: FEN + Elo + legal moves + Stockfish MultiPV values
POSITION_ONLY = "position_only"     # P1 ablation: same, without engine information
CONDITIONS = (REGAN_ALIGNED, POSITION_ONLY)

# The continuation that is scored for every legal move: a leading space, the UCI move, a newline.
# The newline terminates the answer, so P(continuation) is the probability of exactly this move.
CANDIDATE_FORMAT = " {uci}\n"

ENGINE_DESCRIPTION = "Stockfish 19, fixed depth 12, MultiPV 5"
EVAL_CAP_CP = 1000  # same clipping as the rest of the pipeline (mates map to +/-10000, then clip)

_HEADER = (
    "Chess move prediction. The position below is from a rated online game "
    "(Lichess, rapid or classical time control).\n"
    "\n"
    "Player Elo: {elo}\n"
    "Opponent Elo: {opp_elo}\n"
    "Side to move: {side}\n"
    "\n"
    "Position FEN:\n"
    "{fen}\n"
    "\n"
)
_ENGINE_NOTE = (
    "Engine analysis: {engine}. engine_eval is the evaluation in pawns from the point of view of the side "
    "to move; n/a means the move is not among the engine's top lines.\n"
    "\n"
)
_FOOTER = (
    "\n"
    "Predict the move most likely to be chosen by a human player of approximately this strength.\n"
    "\n"
    "Move:"
)

TEMPLATES = {
    REGAN_ALIGNED: _HEADER + _ENGINE_NOTE + "Legal candidate moves:\n{candidates}\n" + _FOOTER,
    POSITION_ONLY: _HEADER + "Legal candidate moves:\n{candidates}\n" + _FOOTER,
}
LINE_FORMAT = {
    REGAN_ALIGNED: "{uci} | engine_eval={ev}",
    POSITION_ONLY: "{uci}",
}


def _spec(condition: str) -> dict:
    return {
        "version": PROMPT_VERSION, "condition": condition, "template": TEMPLATES[condition],
        "line_format": LINE_FORMAT[condition], "candidate_format": CANDIDATE_FORMAT,
        "engine": ENGINE_DESCRIPTION if condition == REGAN_ALIGNED else None,
        "eval_rule": "clip(cp, -1000, 1000) / 100, formatted %+.2f; moves outside MultiPV -> n/a",
        "move_order": "lexicographic UCI", "few_shot_examples": 0,
    }


def prompt_hash(condition: str = REGAN_ALIGNED) -> str:
    """SHA-256 of the frozen template specification for one condition."""
    blob = json.dumps(_spec(condition), sort_keys=True, ensure_ascii=True).encode()
    return hashlib.sha256(blob).hexdigest()


PROMPT_HASH = {c: prompt_hash(c) for c in CONDITIONS}


def prompt_spec(condition: str = REGAN_ALIGNED) -> dict:
    return {**_spec(condition), "sha256": PROMPT_HASH[condition]}


@dataclass(frozen=True)
class PositionInput:
    """Everything the prompt may contain. Deliberately has no field for the played move."""
    fen: str
    elo: int
    opp_elo: int
    engine_lines: tuple[tuple[str, float], ...] = field(default_factory=tuple)  # (uci, cp) in MultiPV order

    @property
    def board(self) -> chess.Board:
        return chess.Board(self.fen)

    @property
    def side(self) -> str:
        return "White" if self.board.turn == chess.WHITE else "Black"

    def legal_moves(self) -> list[str]:
        return sorted(m.uci() for m in self.board.legal_moves)


def _fmt_eval(cp: float) -> str:
    v = max(-EVAL_CAP_CP, min(EVAL_CAP_CP, float(cp))) / 100.0
    return f"{v:+.2f}"


def build_prompt(pos: PositionInput, condition: str = REGAN_ALIGNED) -> tuple[str, list[str]]:
    """Return (prompt text, legal candidate moves in prompt order)."""
    if condition not in TEMPLATES:
        raise ValueError(condition)
    legal = pos.legal_moves()
    if len(legal) < 1:
        raise ValueError("position has no legal moves")
    legal_set = set(legal)
    evals = {}
    for uci, cp in pos.engine_lines:
        if uci not in legal_set:
            raise ValueError(f"engine line {uci} is not legal in {pos.fen}")
        evals.setdefault(uci, cp)
    lines = [LINE_FORMAT[condition].format(uci=u, ev=_fmt_eval(evals[u]) if u in evals else "n/a") for u in legal]
    text = TEMPLATES[condition].format(
        elo=int(pos.elo), opp_elo=int(pos.opp_elo), side=pos.side, fen=pos.fen,
        engine=ENGINE_DESCRIPTION, candidates="\n".join(lines),
    )
    return text, legal


def candidate_text(uci: str) -> str:
    return CANDIDATE_FORMAT.format(uci=uci)


def position_from_decision(d: dict) -> PositionInput:
    """Build the prompt input from a decision record of data/processed/decisions.pkl.

    Only position-level fields are read (fen, elo, opp_elo, sf_lines). d['played'], d['cands'] (which
    contain the played move's value) and every assistance field are intentionally not used."""
    lines = tuple((l["move"], float(l["cp"])) for l in d["sf_lines"])
    return PositionInput(fen=d["fen"], elo=int(d["elo"]), opp_elo=int(d["opp_elo"]), engine_lines=lines)
