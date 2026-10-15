# ChessAssistLens analyzer API (Stockfish 19 + Maia-3 5M + trained models), CPU-only.
# Works on Hugging Face Spaces (Docker SDK, port 7860), Render, Railway, Fly.io, Cloud Run.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    HF_HOME=/app/hf_cache STOCKFISH_PATH=/app/bin/stockfish \
    NUMBA_CACHE_DIR=/tmp/numba MPLCONFIGDIR=/tmp/mpl

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Stockfish 19 (same release as the offline analysis)
RUN mkdir -p /app/bin && curl -fsSL --retry 5 --retry-all-errors -o /tmp/sf.tar.gz \
      https://github.com/official-stockfish/Stockfish/releases/download/sf_19/stockfish-linux-x86-64-universal.tar.gz \
    && tar -xzf /tmp/sf.tar.gz -C /tmp && mv /tmp/stockfish/stockfish-linux-x86-64-universal /app/bin/stockfish \
    && chmod +x /app/bin/stockfish && rm -rf /tmp/sf.tar.gz /tmp/stockfish

COPY services/analyzer/requirements.txt /app/requirements.txt
RUN pip install torch==2.14.1 --index-url https://download.pytorch.org/whl/cpu \
    && pip install -r /app/requirements.txt

# Pre-fetch the Maia-3 5M checkpoint at build time (no download on first request)
RUN python -c "from maia3.model_registry import resolve_model_spec, resolve_checkpoint_path; \
print(resolve_checkpoint_path(resolve_model_spec('maia3-5m')))"

COPY services /app/services
COPY data/artifacts /app/data/artifacts

RUN useradd -m -u 1000 user && chown -R user /app
USER user

EXPOSE 7860
CMD ["sh", "-c", "uvicorn analyzer.api.main:app --app-dir /app/services --host 0.0.0.0 --port ${PORT:-7860}"]
