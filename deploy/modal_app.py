"""ChessAssistLens GPU service on Modal: Qwen3-8B-Base (BF16) + Maia-3 79M + Stockfish 19.

Two uses, same code (services/analyzer/qwen/runner.py and services/analyzer/compare/live.py):

1. Offline scoring of the exported positions (the research run):
       modal run deploy/modal_app.py::score --split test --condition regan_aligned
   writes data/interim/qwen/<condition>/<split>.jsonl and <split>.runtime.json locally.

2. Live web endpoints (enhancement only; the professor demo never depends on them):
       modal deploy deploy/modal_app.py
   GET  /health            models loaded? revisions, GPU
   POST /score-position    Qwen legal-move distribution for a FEN (+ Elo, + Stockfish lines computed here)
   POST /compare-position  structured R / Qwen / Maia / Stockfish outputs for one position
   POST /analyze-game      the same for every eligible decision of one player in a PGN (capped)

Weights are cached in a Modal Volume and pinned to exact Hugging Face revisions. No secrets are needed
(all checkpoints are public); CORS is restricted to CORS_ORIGINS.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import modal

ROOT = Path(__file__).resolve().parents[1]
QWEN_ID, QWEN_REV = "Qwen/Qwen3-8B-Base", "49e3418fbbbca6ecbdf9608b4d22e5a407081db4"
MAIA79_REV = "a107d6ceb7b298cb04ae1da4edffe2939858b894"
GPU = ["L40S", "A100"]
CORS = os.environ.get("CORS_ORIGINS", "https://chessassistlens.vercel.app,http://localhost:3000")

image = (
    modal.Image.debian_slim(python_version="3.13")
    .apt_install("curl", "ca-certificates", "git")
    .run_commands(
        "mkdir -p /opt/sf && curl -fsSL --retry 5 -o /tmp/sf.tar.gz "
        "https://github.com/official-stockfish/Stockfish/releases/download/sf_19/stockfish-linux-x86-64-universal.tar.gz "
        "&& tar -xzf /tmp/sf.tar.gz -C /tmp && mv /tmp/stockfish/stockfish-linux-x86-64-universal /opt/sf/stockfish "
        "&& chmod +x /opt/sf/stockfish && rm -rf /tmp/sf.tar.gz /tmp/stockfish")
    .pip_install("torch==2.14.1", "transformers==5.18.0", "accelerate", "chess==1.11.2", "numpy==2.5.3",
                 "pandas==3.0.6", "pyarrow==25.0.1", "scikit-learn==1.9.1", "fastapi[standard]", "pydantic",
                 "maia3 @ git+https://github.com/CSSLab/maia3@1e13597c42d4858b7cfd7cfdae01e297263364b2")
    .env({"HF_HOME": "/cache/hf", "STOCKFISH_PATH": "/opt/sf/stockfish", "TOKENIZERS_PARALLELISM": "false"})
    .add_local_dir(str(ROOT / "services" / "analyzer"), "/root/services/analyzer", ignore=["**/__pycache__"])
    .add_local_file(str(ROOT / "data" / "artifacts" / "projection.json"), "/root/data/artifacts/projection.json")
)
volume = modal.Volume.from_name("chessassistlens-hf-cache", create_if_missing=True)
app = modal.App("chessassistlens", image=image)


@app.cls(gpu=GPU, volumes={"/cache": volume}, timeout=3600, scaledown_window=300, max_containers=8)
class Scorer:
    @modal.enter()
    def load(self):
        import sys
        sys.path.insert(0, "/root/services")
        from analyzer.qwen.scorer import QwenScorer
        self.qwen = QwenScorer(QWEN_ID, revision=QWEN_REV, dtype="bfloat16", candidate_batch=64)
        volume.commit()

    @modal.method()
    def score_chunk(self, records: list[dict], condition: str) -> tuple[list[dict], dict]:
        from analyzer.qwen.runner import score_records
        return list(score_records(self.qwen, records, condition, cache=None, log_every=0)), self.qwen.runtime_info()


@app.local_entrypoint()
def score(split: str = "test", condition: str = "regan_aligned", chunk: int = 250, limit: int = 0):
    src = ROOT / "data" / "interim" / "three_model" / f"positions_{split}.jsonl"
    out = ROOT / "data" / "interim" / "qwen" / condition / f"{split}.jsonl"
    out.parent.mkdir(parents=True, exist_ok=True)
    recs = [json.loads(l) for l in src.read_text().splitlines()]
    if limit:
        recs = recs[:limit]
    done = {json.loads(l)["position_id"] for l in out.read_text().splitlines()} if out.exists() else set()
    todo = [r for r in recs if r["position_id"] not in done]
    print(f"{len(todo)} positions to score ({len(done)} already done)")
    chunks = [todo[i:i + chunk] for i in range(0, len(todo), chunk)]
    runtime = None
    with open(out, "a", encoding="utf-8") as fh:
        for res, info in Scorer().score_chunk.starmap([(c, condition) for c in chunks], order_outputs=False):
            for r in res:
                fh.write(json.dumps(r) + "\n")
            fh.flush()
            runtime = info
            print(f"  +{len(res)} positions")
    (out.parent / f"{split}.runtime.json").write_text(json.dumps(runtime, indent=1))
    print("runtime:", runtime)


@app.cls(gpu=GPU, volumes={"/cache": volume}, timeout=600, scaledown_window=600, max_containers=1)
@modal.concurrent(max_inputs=4)
class Live:
    @modal.enter()
    def load(self):
        import sys
        sys.path.insert(0, "/root/services")
        os.environ.setdefault("MAIA_MODEL", "maia3-79m")
        from analyzer.maia.model import MaiaModel
        from analyzer.models.projection import ProjectionModel
        from analyzer.qwen.scorer import QwenScorer
        self.qwen = QwenScorer(QWEN_ID, revision=QWEN_REV, dtype="bfloat16", candidate_batch=64)
        self.maia = MaiaModel("maia3-79m")
        self.proj = ProjectionModel.load("/root/data/artifacts/projection.json")
        volume.commit()

    @modal.asgi_app()
    def web(self):
        import threading

        import chess
        from fastapi import FastAPI, HTTPException
        from fastapi.middleware.cors import CORSMiddleware
        from pydantic import BaseModel, Field

        from analyzer import config
        from analyzer.chesscore.pgn import parse_pgn_text
        from analyzer.compare.live import compare_position
        from analyzer.stockfish.engine import StockfishAnalyzer

        api = FastAPI(title="ChessAssistLens live comparison", description=config.DISCLAIMER)
        api.add_middleware(CORSMiddleware, allow_origins=CORS.split(","), allow_methods=["GET", "POST"], allow_headers=["*"])
        lock = threading.Lock()   # one GPU, one Stockfish process

        class Pos(BaseModel):
            fen: str = Field(..., max_length=120)
            elo: int = Field(1500, ge=600, le=3200)
            opp_elo: int = Field(1500, ge=600, le=3200)
            played: str | None = Field(None, max_length=6)
            history_fens: list[str] = Field(default_factory=list, max_length=7)
            prev_fen: str | None = Field(None, max_length=120)

        class Game(BaseModel):
            pgn: str = Field(..., max_length=100_000)
            color: str = Field("white", pattern="^(white|black)$")
            max_decisions: int = Field(30, ge=1, le=60)

        def run(p: Pos, with_qwen=True, with_maia=True):
            with lock, StockfishAnalyzer() as sf:
                return compare_position(p.fen, p.elo, p.opp_elo, history_fens=p.history_fens, prev_fen=p.prev_fen,
                                        played=p.played, sf=sf, maia=self.maia if with_maia else None,
                                        qwen=self.qwen if with_qwen else None, proj=self.proj)

        @api.get("/health")
        def health():
            return {"status": "ok", "models_loaded": True, "qwen": self.qwen.runtime_info(), "maia": self.maia.model_name,
                    "maia_revision": MAIA79_REV, "stockfish": os.path.exists(config.STOCKFISH_PATH),
                    "disclaimer": config.DISCLAIMER}

        @api.post("/compare-position")
        def compare(p: Pos):
            try:
                return run(p)
            except ValueError as e:
                raise HTTPException(400, str(e))

        @api.post("/score-position")
        def score_position(p: Pos):
            try:
                r = run(p, with_maia=False)
                return {"position": r["position"], "qwen": r["qwen"], "stockfish": r["stockfish"], "provenance": r["provenance"]}
            except ValueError as e:
                raise HTTPException(400, str(e))

        @api.post("/analyze-game")
        def analyze_game(g: Game):
            games = parse_pgn_text(g.pgn, max_games=1)
            if not games:
                raise HTTPException(400, "no legal game in PGN")
            gm = games[0].to_dict()
            turn = chess.WHITE if g.color == "white" else chess.BLACK
            elo = gm.get(f"{g.color}_elo") or 1500
            opp = gm.get(("black" if g.color == "white" else "white") + "_elo") or 1500
            out = []
            for ply, mv in enumerate(gm["moves_uci"]):
                if ply < config.OPENING_SKIP_PLIES or chess.Board(gm["fens"][ply]).turn != turn:
                    continue
                r = run(Pos(fen=gm["fens"][ply], elo=elo, opp_elo=opp, played=mv,
                            history_fens=gm["fens"][max(0, ply - 7):ply], prev_fen=gm["fens"][ply - 1]))
                for k in ("maia", "qwen"):
                    r[k].pop("distribution", None)
                out.append({"ply": ply, **r})
                if len(out) >= g.max_decisions:
                    break
            return {"color": g.color, "elo": elo, "opp_elo": opp, "decisions": out}

        return api
