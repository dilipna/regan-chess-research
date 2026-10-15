"""FastAPI service for ChessAssistLens live analysis.

Run:  uvicorn analyzer.api.main:app --app-dir services --port 8000
"""

from __future__ import annotations

import json
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from .. import config
from . import live

app = FastAPI(title="ChessAssistLens analyzer", version="0.1.0",
              description=config.DISCLAIMER)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"], allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    pgn: str = Field(..., max_length=200_000)
    game_index: int = Field(0, ge=0, le=50)
    default_elo: int = Field(1500, ge=600, le=3000)


@app.get("/api/health")
def health():
    ok_models = (config.ARTIFACTS / "projection.json").exists()
    return {"status": "ok", "models": ok_models, "engine_path_exists": os.path.exists(config.STOCKFISH_PATH),
            "depth": config.SF_DEPTH, "multipv": config.SF_MULTIPV, "maia_model": config.MAIA_MODEL,
            "disclaimer": config.DISCLAIMER}


@app.post("/api/analyze")
def analyze(req: AnalyzeRequest):
    try:
        return live.submit(req.pgn, req.game_index, req.default_elo)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.get("/api/jobs/{job_id}")
def job(job_id: str):
    j = live.get(job_id)
    if j is None:
        raise HTTPException(404, "unknown job")
    return j


@app.get("/api/metrics")
def metrics():
    p = config.ARTIFACTS / "metrics.json"
    if not p.exists():
        raise HTTPException(404, "metrics not computed")
    return json.loads(p.read_text())


@app.get("/api/jobs/{job_id}/aif", response_class=PlainTextResponse)
def job_aif(job_id: str, color: str = "white"):
    from ..aif.export import report_to_aif
    j = live.get(job_id)
    if j is None or j.get("status") != "done":
        raise HTTPException(404, "report not ready")
    return report_to_aif(j["report"], color)
