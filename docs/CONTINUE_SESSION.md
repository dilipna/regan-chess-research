# ChessAssistLens — continue-session handoff

_Written 2026-10-07. Read this first, then `docs/STATUS.md`. Project root: `C:\Users\Dilip\OneDrive\Pictures\chess_llm`._

## 1. What the project is now
Final restructuring for a demo to Professor Kenneth W. Regan (University at Buffalo). Question: how do a **statistical
human-move model (our "Regan-inspired public reconstruction")**, a **general LLM (Qwen3-8B-Base)** and a **chess-specific
human-move transformer (Maia-3)** compare on the same human chess decisions, and how do their signals respond to
controlled engine assistance. The existing A/B/C/D XGBoost hybrid experiment is a **secondary extension**.

Naming rules: always "Regan-inspired public reconstruction/baseline" (never his exact detector/model); Maia is a
"Chessformer-based human chess transformer" (never an LLM); never "Qwen detected cheating" or "20% probability of
cheating"; sources are "presumed-human"; substitutions are "controlled decision-level substitutions evaluated in the
original positions" (games are not replayed); never fabricate a model probability; never compare recall at different
realized FPRs as if equal.

## 2. Decision made this session (important)
The user chose to **set Qwen3-8B-Base aside for now** (needs a paid GPU; laptop is an RTX 3050 Ti 4 GB, 15.7 GB RAM).
The site currently presents **Regan-inspired reconstruction vs Maia-3 79M**, with the LLM shown only as "next experiment —
method built and tested, not yet run". The UI **switches to the full three-model view automatically** once
`prepared_three_model_demo.json` has `models.Q.status == "ok"` (needs real Qwen scores, then rerun scripts 15→14→16→17→18→19).

## 3. State of everything
**Live site (deployed, verified):** https://chessassistlens.vercel.app — routes `/` (overview), `/compare` (flagship same
position, original ↔ controlled-substitute toggle, clickable moves), `/results` (two tabs + hybrid extension section),
`/demo` (hybrid demo), `/methodology`, `/analyze`. Prepared mode only; no backend needed. Last production check: 0 console
errors, no horizontal overflow at 375/1366 px.

**Computed results (held-out test; paired source-game bootstrap, 2,000 resamples; plan frozen in
`experiments/three_model_plan.py`):**
- Task 1 (12,863 original test decisions): Maia-3 79M top-1 56.9% [56.0, 57.9], top-3 84.4%, NLL 1.280; Maia-3 5M 55.5% /
  1.350. Engine-first-move event log-loss: Regan-inspired 0.588, Maia-79M 0.422 (paired diff −0.165 [−0.178, −0.152]).
  Regan-inspired has **no per-legal-move distribution** → move-level metrics "not defined" (compared on T1/T3 events).
- Task 2 (9,680 test rows): ROC-AUC Regan z(top-1) 0.785 [0.776, 0.793]; Maia-79M mean surprisal 0.689 [0.675, 0.704];
  paired diff −0.096 [−0.112, −0.078]; secondary excess-surprisal AUC 0.715 (79M), 0.698 (5M); 79M vs 5M +0.0127 [+0.0085, +0.0166].
- Full generated summary: `docs/THREE_MODEL_RESULTS.md`. Demo walkthrough (5–6 min): `docs/DEMO_SCRIPT.md`.
- **Qwen: no results exist.** All Qwen fields are pending/null; nothing is estimated.

**Untouched (verified by SHA-256 against a pre-work snapshot):** splits, variants, decisions, test predictions, metrics,
projection, paired bootstrap, original provenance.json, AIF files, simulator, prepared studies. Validated numbers:
A→B +0.0066 [+0.0026, +0.0105]; B→C +0.0468 [+0.0395, +0.0536]; C→D +0.0067 [+0.0025, +0.0110]; recall @1%:
A 32.1% (1.0%), B 37.1% (1.7%), C 40.9% (1.0%), D 40.4% (0.7%). `tests/test_three_model.py` has a SHA-256 guard for four of them.

**Last verification:** pytest 36 passed + 4 skipped (`.venv`); Qwen tests 14/14 (`.venv-qwen`); vitest 15/15; tsc, eslint,
`next build` clean.

## 4. Where things are
- Qwen scorer: `services/analyzer/qwen/{prompt,scorer,cache,runner}.py` — frozen prompt (hash `7f4373cf34140539…`, regan_aligned;
  position_only `ba79104a…`), full candidate `" <uci>\n"` summed log-prob, softmax over legal moves, KV-cache batching
  (verified vs full-sequence scoring: 2.5e-5 nats fp32; bf16 differs up to 0.16 nats on the 0.6B check model), immutable cache.
  Pinned: `Qwen/Qwen3-8B-Base` @ `49e3418fbbbca6ecbdf9608b4d22e5a407081db4`. Qwen3-0.6B-Base used only for tests/pipeline checks.
- Comparison libs: `services/analyzer/compare/{dists,live}.py`.
- Experiments (all additive): `11_export_positions` (test 12,863 / val 11,973 / train 38,191 positions → `data/interim/three_model/`),
  `12_maia79` (Maia-3 79M @ `a107d6ce…`, val+test done), `13_qwen_score` (local scorer), `14_three_model_eval`,
  `15_qwen_artifacts`, `16_export_three_model_demo`, `17_hybrid_qwen` (System E, needs all splits), `18_three_model_provenance`,
  `19_three_model_results_md`. Dry-run of 14–17 with fake random scores was done in a scratch dir only (not committed to results).
- Modal: `deploy/modal_app.py` (score job + live FastAPI endpoints /health /score-position /compare-position /analyze-game).
  Modal token **is configured** (workspace `ubdg0312`, Starter, $1 credit). Image builds (Stockfish URL fixed to `universal`).
  **Blocked: Modal needs a payment method before any GPU**. GPU list is still `["H100", "A100-80GB"]` → change to a cheaper GPU
  (A100/L40S) and run a 50-position pilot (`modal run deploy/modal_app.py::score --split test --limit 50`) to measure cost
  before any full run. On Windows set `PYTHONIOENCODING=utf-8 PYTHONUTF8=1` first. Estimated cost: core (test+val) ≈ $5–10;
  + train ≈ $7–12; + position-only ≈ $2–5. Tell the user the estimate and wait for OK before spending.
- Frontend: `apps/web/src/components/three/*`, `apps/web/src/lib/three.ts`, `apps/web/tests/three.test.tsx`; new `/compare` page.
- Provenance: `data/artifacts/three_model_provenance.json` (+ web copy); `services/analyzer/requirements-qwen-lock.txt`.
- Docs: `README.md` (new top section), `docs/STATUS.md`, `docs/DEPLOY.md`, this file.

## 5. Environments (do not mix)
- `.venv` — pinned research env (huggingface_hub 2.1.1). **Never install transformers here.**
- `.venv-qwen` — torch 2.14.1+cu126 + transformers 5.18.0 for Qwen scoring and `tests/test_qwen.py`.
- `.venv-modal` — Modal client only (`.venv-modal/Scripts/modal ...`).
- Frontend: `cd apps/web && npm test && npx tsc --noEmit -p . && npx eslint . && npm run build`; deploy with
  `npx vercel deploy --prod --yes` (logged in as `ubdg0312-8781`; `NEXT_PUBLIC_API_URL` exists but is the old dead tunnel;
  `NEXT_PUBLIC_LIVE_API_URL` is not set).
- The git repo has **no commits** (so provenance says so honestly). Nothing has been committed or pushed.

## 6. Remaining work (in priority order)
1. **If the user adds a Modal card:** pilot run → cost estimate → ask OK → `modal run deploy/modal_app.py::score` for
   `--split test`, `val`, then (optional) `train`; `--condition position_only --split test` for the P1 ablation. Then:
   `15_qwen_artifacts` → `14_three_model_eval` → `16_export_three_model_demo` → `17_hybrid_qwen` (needs train too) →
   `18_three_model_provenance` → `19_three_model_results_md`; rerun all tests; check the dry-run assumptions (evaluation
   asserts every split is fully scored); rebuild and redeploy; verify the UI shows three models and findings are
   generated honestly (do not pre-write a winner).
2. Optional: `modal deploy deploy/modal_app.py` for live endpoints, set `NEXT_PUBLIC_LIVE_API_URL` on Vercel, redeploy.
3. Optional (user choice): free Kaggle 2×T4 route runs Qwen in **FP16** (not BF16) — must be labelled separately, manual uploads.
4. Optional: commit the work to git if the user asks (do not commit unasked).
5. Not started / P2: decorative animation, extra models.

## 7. Known limits to keep stating
Source games presumed human; one month of online Lichess rapid/classical data; substitutions evaluated in original positions;
random/selective substitutes equal Stockfish #1 by construction (favours engine-match statistics); bootstrap conditions on
frozen/fitted models; multiple comparisons without correction; Regan-inspired model is not his analyzer.

## 8. Prompt to start the next session
Paste this:

> Continue the ChessAssistLens project in `C:\Users\Dilip\OneDrive\Pictures\chess_llm`. First read `docs/CONTINUE_SESSION.md`
> and `docs/STATUS.md`, and the memory files for this project. Do not change any validated A/B/C/D numbers or existing
> artifacts. The site (https://chessassistlens.vercel.app) currently shows Regan-inspired reconstruction vs Maia-3 79M, with
> Qwen3-8B-Base as the "next experiment" (not yet run). [Choose one:] (A) I have added a payment card to Modal with a spending
> cap — run the cost pilot on 50 positions, tell me the estimate, and wait for my OK before the full Qwen run, then finish the
> pipeline (scripts 15→14→16→17→18→19), tests, and redeploy. (B) Keep Qwen set aside; do only: [describe the task]. Be
> careful and make no mistakes; report outcomes faithfully.
