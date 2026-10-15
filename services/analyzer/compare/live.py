"""Live single-position comparison: Regan-inspired reconstruction, Qwen, Maia-3, Stockfish.

Shared by the GPU service (deploy/modal_app.py) and local development. Every value returned is a
model output computed here; nothing is generated as prose and nothing is imputed (a model that is not
loaded is reported as "unavailable").

Inputs mirror the offline pipeline: Stockfish 19 at depth 12, MultiPV 5, Threads 1; Maia-3 sees the
current position plus up to 7 previous positions; the Regan-inspired projection uses the frozen
projection.json fitted on the training split. Position features that need the previous position
(eval swing) are computed only when `prev_fen` is supplied; otherwise they are set to 0 and flagged.
"""

from __future__ import annotations

import time
from collections import deque

import chess
import numpy as np
import pandas as pd
import torch

from .. import config
from ..features.decisions import clip_cp, game_phase
from ..models.projection import ProjectionModel
from ..qwen.prompt import PROMPT_HASH, REGAN_ALIGNED, PositionInput, build_prompt, candidate_text
from .dists import entropy, rank_of, top_k


def _ply_from_fen(board: chess.Board) -> int:
    return 2 * (board.fullmove_number - 1) + (0 if board.turn == chess.WHITE else 1)


def maia_position(maia, fens: list[str], elo: int, opp_elo: int) -> dict[str, float]:
    """Full legal-move distribution for the LAST fen, with the earlier fens as history (oldest first),
    reproducing MaiaModel.game_policies input construction for one position."""
    hist: deque = deque(maxlen=maia.cfg.history)
    for f in fens:
        hist.append(maia._tok(chess.Board(f)))
    board = chess.Board(fens[-1])
    tokens = maia._encode(hist).unsqueeze(0)
    logits = maia._forward(tokens, [int(elo)], [int(opp_elo)])[0]
    mask = maia._mask(board, maia.move_index)
    probs = torch.softmax(logits.masked_fill(~mask, float("-inf")), dim=-1)
    out = {}
    for m in board.legal_moves:
        u = m.uci()
        key = u if board.turn == chess.WHITE else maia._mirror(u)
        out[u] = float(probs[maia.move_index[key]])
    return out


def regan_position(proj: ProjectionModel, board: chess.Board, lines: list[dict], elo: int,
                   prev_best_cp: float | None) -> dict:
    cps = [clip_cp(l["cp"]) for l in lines]
    best = cps[0]
    eval_swing = abs(best - (-prev_best_cp)) if prev_best_cp is not None else 0.0
    row = {"elo": elo, "gap12": min(best - cps[1] if len(cps) > 1 else float(config.EVAL_CAP_CP), config.SELECTIVE_GAP_CAP_CP * 2),
           "near_opt": sum(1 for c in cps if best - c <= config.NEAR_OPTIMAL_CP), "n_legal": board.legal_moves.count(),
           "eval_before": best, "eval_swing": min(eval_swing, 2 * config.EVAL_CAP_CP),
           "phase": game_phase(board, _ply_from_fen(board))}
    ex = proj.expectations(pd.DataFrame([row])).iloc[0]
    eligible = abs(best) <= config.DECIDED_EVAL_CP and len(lines) >= 2 and row["n_legal"] >= 2
    return {"difficulty": float(ex["difficulty"]), "p_t1": float(ex["p_t1"]), "p_t3": float(ex["p_t3"]),
            "p_ev": float(ex["p_ev"]), "expected_loss_cp": float(ex["mu_loss"]),
            "engine_first_move": lines[0]["move"], "engine_top3": [l["move"] for l in lines[:3]],
            "eligible_by_pipeline_rule": bool(eligible), "eval_swing_from_previous_position": prev_best_cp is not None,
            "move_distribution": None,
            "note": "Regan-inspired public reconstruction: projects P(top-1 / top-3 engine match) and expected loss "
                    "for this Elo and position difficulty; it does not assign a probability to every legal move."}


def compare_position(fen: str, elo: int, opp_elo: int, *, history_fens: list[str] | None = None,
                     prev_fen: str | None = None, played: str | None = None, sf=None, maia=None, qwen=None,
                     proj: ProjectionModel | None = None) -> dict:
    t0 = time.time()
    board = chess.Board(fen)
    if not board.is_valid():
        raise ValueError("invalid FEN")
    legal = sorted(m.uci() for m in board.legal_moves)
    if len(legal) < 1:
        raise ValueError("no legal moves (game over)")
    if played is not None and played not in legal:
        raise ValueError(f"played move {played} is not legal in this position")
    out: dict = {"position": {"fen": fen, "elo": int(elo), "opp_elo": int(opp_elo),
                              "side_to_move": "white" if board.turn == chess.WHITE else "black",
                              "legal_moves": legal, "played": played}}
    # Stockfish
    lines = None
    if sf is not None:
        token = object()
        an = sf.analyze_position(board, token, prefilter=False)
        lines = an["lines"]
        prev_best = None
        if prev_fen:
            pa = sf.analyze_position(chess.Board(prev_fen), object(), prefilter=False)
            prev_best = clip_cp(pa["lines"][0]["cp"]) if pa["lines"] else None
        out["stockfish"] = {"engine": sf.name, "depth": an["depth"], "multipv": len(lines),
                            "lines": [{"move": l["move"], "cp": l["cp"], "pv": l.get("pv", [])} for l in lines]}
        out["regan_inspired"] = (regan_position(proj, board, lines, int(elo), prev_best) if proj is not None and len(lines) >= 2
                                 else {"status": "unavailable", "reason": "projection model or >= 2 engine lines missing"})
    else:
        out["stockfish"] = {"status": "unavailable"}
        out["regan_inspired"] = {"status": "unavailable", "reason": "needs Stockfish analysis"}

    def summarize(dist: dict[str, float]) -> dict:
        r = {"distribution": {m: dist[m] for m in legal}, "top": top_k(dist, 5), "entropy": entropy(dist)}
        if played:
            r.update({"played_probability": dist[played], "played_rank": rank_of(dist, played)})
        if lines:
            r["p_engine_first_move"] = dist[lines[0]["move"]]
            r["p_engine_top3"] = float(sum(dist[l["move"]] for l in lines[:3]))
        return r

    if maia is not None:
        fens = list(history_fens or []) + [fen]
        out["maia"] = {"model": maia.model_name, **summarize(maia_position(maia, fens, elo, opp_elo)),
                       "history_positions": len(fens) - 1}
    else:
        out["maia"] = {"status": "unavailable"}

    if qwen is not None:
        if lines is None:
            out["qwen"] = {"status": "unavailable", "reason": "the Regan-aligned prompt needs Stockfish lines"}
        else:
            pos = PositionInput(fen, int(elo), int(opp_elo), tuple((l["move"], float(l["cp"])) for l in lines))
            prompt, cands = build_prompt(pos, REGAN_ALIGNED)
            sc = qwen.score_position(prompt, {m: candidate_text(m) for m in cands})
            lp = np.array([sc[m]["logprob"] for m in cands])
            pr = np.exp(lp - lp.max())
            pr /= pr.sum()
            dist = {m: float(p) for m, p in zip(cands, pr)}
            out["qwen"] = {"model": qwen.model_id, "revision": qwen.revision, "prompt_hash": PROMPT_HASH[REGAN_ALIGNED],
                           **summarize(dist), "logprob": {m: sc[m]["logprob"] for m in cands},
                           "n_tokens": {m: sc[m]["n_tokens"] for m in cands}}
    else:
        out["qwen"] = {"status": "unavailable"}
    out["provenance"] = {"elapsed_s": round(time.time() - t0, 3), "stockfish_depth": config.SF_DEPTH,
                         "stockfish_multipv": config.SF_MULTIPV, "maia_checkpoint": getattr(maia, "model_name", None),
                         "qwen": qwen.runtime_info() if qwen is not None else None,
                         "projection": "data/artifacts/projection.json (train-split fit, unchanged)"}
    return out
