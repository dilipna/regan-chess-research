"""Central configuration. Every constant that affects a reported number lives here
so the README and methodology page can cite a single source of truth."""

from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
RAW = DATA / "raw"
INTERIM = DATA / "interim"
PROCESSED = DATA / "processed"
ARTIFACTS = DATA / "artifacts"          # trained models, metrics
WEB_DATA = ROOT / "apps" / "web" / "public" / "data"   # precomputed JSON for the frontend

# --- Stockfish -------------------------------------------------------------
STOCKFISH_PATH = os.environ.get(
    "STOCKFISH_PATH",
    str(ROOT / "tools" / "stockfish" / "stockfish" / "stockfish-windows-x86-64-universal.exe"),
)
SF_MULTIPV = 5            # number of principal variations recorded per position
SF_DEPTH = int(os.environ.get("SF_DEPTH", "12"))   # fixed depth, Threads=1 -> reproducible
SF_HASH_MB = 64
# Positions whose quick depth-8 single-PV eval exceeds +/-5.00 are treated as decided:
# only that quick line is stored and the decision is ineligible (eligibility uses +/-3.00).
SF_PREFILTER_DEPTH = 8
SF_PREFILTER_DECIDED_CP = 500
MAX_ANALYZED_PLY = 160    # plies beyond 80 full moves are not analyzed
EVAL_CAP_CP = 1000        # evaluations clipped to +/-1000 cp before computing losses
MATE_CP = 10000           # mate scores mapped to +/-MATE_CP before clipping

# --- Maia-3 ----------------------------------------------------------------
MAIA_MODEL = os.environ.get("MAIA_MODEL", "maia3-5m")
MAIA_HISTORY = 8

# --- Decision eligibility (documented rule) ----------------------------------
# A player decision (one ply by that player) is ELIGIBLE iff all hold:
#   1. ply index >= OPENING_SKIP_PLIES (skip the first 8 moves per side: book-like)
#   2. the side to move has >= 2 legal moves (not forced)
#   3. |Stockfish eval before the move| <= DECIDED_EVAL_CP (game not already decided)
#   4. Stockfish returned at least 2 principal variations
OPENING_SKIP_PLIES = 16
DECIDED_EVAL_CP = 300
NEAR_OPTIMAL_CP = 25      # "near-optimal" = within 25 cp of the best line

# --- Synthetic assistance ------------------------------------------------------
ASSIST_LEVELS = [0.0, 0.05, 0.10, 0.20, 0.40, 0.70]
STRATEGIES = ["random", "selective", "subtle"]
SUBTLE_MAX_LOSS_CP = 30   # SUBTLE picks from SF top-3 moves within 30 cp of best
SELECTIVE_GAP_CAP_CP = 300

# --- Splits -------------------------------------------------------------------
SPLIT_FRACTIONS = {"train": 0.6, "val": 0.2, "test": 0.2}
SEED = 20261003

ELO_BANDS = [(1000, 1400), (1400, 1800), (1800, 2200), (2200, 2700)]


def elo_band(elo: float) -> str:
    for lo, hi in ELO_BANDS:
        if lo <= elo < hi:
            return f"{lo}-{hi - 1}"
    return "other"


DISCLAIMER = (
    "ChessAssistLens is a research prototype. Its scores measure similarity to patterns in controlled "
    "engine-assistance experiments. They are not proof that a real player cheated and must not be used "
    "alone for adjudication."
)
