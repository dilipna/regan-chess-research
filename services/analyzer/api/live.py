"""Live analysis of an uploaded PGN: Stockfish -> Maia-3 -> decisions -> report."""

from __future__ import annotations

import os
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

import chess

from .. import config
from ..chesscore.pgn import parse_pgn_text
from ..features.decisions import build_game_decisions
from ..maia.model import get_maia
from ..report import game_report, load_artifacts
from ..stockfish.engine import StockfishAnalyzer

MAX_PLIES = int(os.environ.get("LIVE_MAX_PLIES", "160"))
_EXEC = ThreadPoolExecutor(max_workers=int(os.environ.get("LIVE_WORKERS", "1")))
JOBS: dict[str, dict] = {}
_LOCK = threading.Lock()


def _set(job_id: str, **kw):
    with _LOCK:
        JOBS[job_id].update(kw)


def _run(job_id: str, game: dict, default_elo: int):
    try:
        t0 = time.time()
        for k in ("white_elo", "black_elo"):
            if not game.get(k):
                game[k] = default_elo
                game.setdefault("assumed_elo", []).append(k)
        n = min(len(game["fens"]), MAX_PLIES + 1)
        first = config.OPENING_SKIP_PLIES - 1
        sf: list[dict | None] = [None] * len(game["fens"])
        _set(job_id, status="stockfish", total=max(n - first, 1), progress=0)
        with StockfishAnalyzer(threads=int(os.environ.get("SF_THREADS", "1"))) as an:
            token = object()
            engine_name = an.name
            for i in range(first, n):
                sf[i] = an.analyze_position(chess.Board(game["fens"][i]), token)
                _set(job_id, progress=i - first + 1)
        _set(job_id, status="maia")
        maia = get_maia()
        plies = list(range(first, min(len(game["moves_uci"]), MAX_PLIES + 1)))
        pol = maia.game_policies(game["start_fen"], game["moves_uci"], game["white_elo"], game["black_elo"], plies=plies)
        _set(job_id, status="features")
        decs = build_game_decisions(game, sf, pol)
        art = load_artifacts()
        rep = game_report(art, game, decs, report_id=f"live-{job_id}", title="Uploaded game", kind="live",
                          anonymize=False, analysis_meta={
                              "engine": engine_name, "depth": config.SF_DEPTH, "multipv": config.SF_MULTIPV,
                              "maia_model": maia.model_name, "elapsed_s": round(time.time() - t0, 1),
                              "assumed_elo": game.get("assumed_elo", [])})
        _set(job_id, status="done", report=rep)
    except Exception as e:  # surface the error to the client
        _set(job_id, status="error", error=f"{type(e).__name__}: {e}")


def submit(pgn: str, game_index: int = 0, default_elo: int = 1500) -> dict:
    games = parse_pgn_text(pgn, max_games=game_index + 1)
    if len(games) <= game_index:
        raise ValueError("No legal game found in the PGN at that index.")
    game = games[game_index].to_dict()
    if len(game["moves_uci"]) < config.OPENING_SKIP_PLIES + 4:
        raise ValueError(f"Game too short: analysis starts at move {config.OPENING_SKIP_PLIES // 2 + 1}.")
    job_id = uuid.uuid4().hex[:12]
    with _LOCK:
        JOBS[job_id] = {"id": job_id, "status": "queued", "progress": 0, "total": 1, "created": time.time(),
                        "white": game["white"], "black": game["black"], "n_plies": len(game["moves_uci"])}
    _EXEC.submit(_run, job_id, game, default_elo)
    return {"job_id": job_id, "n_plies": len(game["moves_uci"]), "white": game["white"], "black": game["black"]}


def get(job_id: str) -> dict | None:
    with _LOCK:
        j = JOBS.get(job_id)
        return dict(j) if j else None
