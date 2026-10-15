# Deployment

## Professor demo = static site (no backend)
All three prepared studies, the three-model comparison (`prepared_three_model_demo.json`) and every result file are
static JSON in `apps/web/public/data/`. The demo works without Modal, Docker, Cloudflare, localhost or a GPU.

## Live GPU service → Modal (Qwen3-8B-Base BF16 + Maia-3 79M + Stockfish 19)
```bash
.venv-modal/Scripts/modal token new                         # one-time browser login
.venv-modal/Scripts/modal run deploy/modal_app.py::score --split test     # offline research scoring (also val, train)
.venv-modal/Scripts/modal deploy deploy/modal_app.py        # endpoints: /health /score-position /compare-position /analyze-game
cd apps/web && printf "https://<workspace>--chessassistlens-live-web.modal.run" | npx vercel env add NEXT_PUBLIC_LIVE_API_URL production && npx vercel --prod
```
The frontend shows LIVE MODEL COMPARISON only after `/health` reports models loaded within 4 s; otherwise
PREPARED RESEARCH STUDY. Weights are cached in the Modal volume `chessassistlens-hf-cache`, pinned by revision.

## Cloudflare tunnel — development only
The laptop Docker + quick-tunnel setup below is retained for development of the old `/analyze` live report only.
It is not the demo backend.


The presentation never depends on the backend: the three professor demos, the simulator, the AI lab
and projected-vs-observed views are static JSON in `apps/web/public/data/`. The backend is needed
only for **live PGN analysis**.

## Frontend → Vercel

```bash
cd apps/web
npx vercel login                       # one-time, opens the browser
npx vercel link                        # create/link the project (root = apps/web)
npx vercel env add NEXT_PUBLIC_API_URL production   # e.g. https://<user>-chessassistlens.hf.space
npx vercel --prod
```

## Backend → laptop + Cloudflare quick tunnel (current, free)

```bash
docker run -d --name cal-api --restart unless-stopped -p 7860:7860 chessassistlens-api:latest
tools/cloudflared/cloudflared.exe tunnel --no-autoupdate --protocol http2 --url http://localhost:7860
# copy the printed https://<words>.trycloudflare.com URL, then:
cd apps/web
npx vercel env rm NEXT_PUBLIC_API_URL production --yes
printf "https://<words>.trycloudflare.com" | npx vercel env add NEXT_PUBLIC_API_URL production
npx vercel deploy --prod
```
`--protocol http2` is required on networks that block QUIC/UDP. Works only while the laptop, Docker
Desktop and the tunnel are running; the URL changes whenever the tunnel restarts. Loaded API memory ≈ 460 MB.

**Because `NEXT_PUBLIC_API_URL` is baked in at build time, every tunnel restart requires the env update
and a redeploy above.** Before a demo:

1. Start Docker Desktop, then `docker start cal-api`; check `curl localhost:7860/api/health` shows
   `"models": true, "engine_path_exists": true`.
2. Start the tunnel, update `NEXT_PUBLIC_API_URL`, `npx vercel deploy --prod`.
3. Open `/analyze?tab=upload`: the status line must read "Live analyzer online (models and engine loaded)".
4. Keep the laptop awake for the whole demo.

If any step fails, demo the **Prepared studies** tab: it is precomputed, served with the site, and shows the
same report view. The upload tab reports "unreachable" and offers an "Open prepared studies" button.

## Backend → Hugging Face Spaces (Docker Spaces now require a PRO subscription) (Docker, free CPU tier: 2 vCPU / 16 GB)

The repository-root `Dockerfile` builds a CPU image containing Stockfish 19, the Maia-3 5M checkpoint
and the trained artifacts in `data/artifacts/`. It listens on `$PORT` (default 7860).

```bash
hf auth login
hf repo create chessassistlens --repo-type space --space_sdk docker
git clone https://huggingface.co/spaces/<user>/chessassistlens space && cd space
cp -r ../Dockerfile ../.dockerignore ../services . && mkdir -p data && cp -r ../data/artifacts data/
# Spaces needs a README.md front-matter header:
printf -- "---\ntitle: ChessAssistLens API\nsdk: docker\napp_port: 7860\n---\n" > README.md
git add . && git commit -m "deploy" && git push
```

Set `CORS_ORIGINS=https://<your-vercel-domain>` as a Space variable (default `*`).

### Alternatives
* **Render / Railway / Fly.io / Cloud Run:** point the service at the repo-root `Dockerfile`;
  they inject `$PORT`. Use ≥ 2 GB RAM (torch + Maia + SHAP).
* Optional env: `SF_THREADS` (Stockfish threads for live analysis; offline analysis used 1),
  `LIVE_MAX_PLIES` (default 160), `CORS_ORIGINS`.

Note: live analysis uses the same depth (12) and MultiPV (5) as the training data so features are
comparable; a 60-move game takes ≈ 30–90 s on a 2-vCPU host.

## Local smoke test of the image

```bash
docker build -t chessassistlens-api .
docker run --rm -p 7860:7860 chessassistlens-api
curl localhost:7860/api/health
```
