# ChessAssistLens - STATUS

_Last updated: 2026-10-07 (research-demo pass)_

## 2026-10-07 final pass (pre-meeting)
- Every Qwen status statement on every page now distinguishes the pending HELD-OUT run from the 7 locally scored demo positions.
- Methods page opens with "MoveLens in one minute"; downloads now include movelens_demo.json, regan_checks.json and the raw local Qwen scores (qwen_local_scores.json).
- Nav adds Game and Checks; chessboard favicon (old favicon.ico backed up to the session scratchpad); README reproduce steps include scripts 22–24.
- `docs/STUDY_GUIDE.md`: what to learn in order + expected questions with answers.
- Verified: pytest 44 passed + 4 skipped; Qwen venv 14/14; vitest 33/33; tsc + eslint clean; build OK; production: 11 routes x 2 widths, 0 console errors, no overflow; demo and all 3 examples clicked through.

## 2026-10-07 MoveLens: statistician's additions + chess-book design
- New sections: 5 Whole game (projected vs actual, z by substitution level; z recomputed and asserted against test_predictions) and 6 Checks (held-out calibration, clean-game z distribution vs N(0,1), screening power by strategy x level, Maia accuracy by band, Qwen engine-echo ablation on 7 positions, "what is not shown yet"). Data: `experiments/24_export_regan_checks.py` -> `regan_checks.json`.
- Qwen position-only prompt run locally on the 7 demo positions (`QWEN_CONDITION=position_only`): top = engine #1 in 0/7 vs 3/7 with engine lines.
- Typography: Cormorant Garamond (display, lining figures), IBM Plex Sans/Mono; figurine notation; board-square section numbers, checkered rules, board-square demo progress. Chart colors validated (#2f6fb0 / #c8642c on #f6f3ec).

## 2026-10-07 MoveLens redesign (public name; repo names unchanged)
- `/` is now one light-theme page: Overview + 1 Statistical model, 2 Qwen3-8B, 3 Maia-3 79M, 4 Compare, a 7-minute demo mode (1/4 to 4/4, presenter notes), 3 curated real positions, limitations. Nav: Overview, Statistical, Qwen, Maia, Compare + small Methods. Dark theme removed site-wide.
- Statistical model audited: logistic-regression difficulty + Elo x difficulty-decile projection table + kappa-scaled z; **not KNN** (no neighbor search anywhere in the code).
- Qwen3-8B-Base run LOCALLY on the 7 MoveLens demo positions only (`experiments/23_qwen_local_demo.py`; RTX 3050 Ti laptop, CPU RAM + disk offload, bf16, frozen prompt and scorer; consistency vs full-sequence scoring 0.083 nats). Shown as "Precomputed Qwen3-8B result"; it is NOT the held-out evaluation, which still needs a cloud GPU.
- Data for the page: `experiments/22_export_movelens_demo.py` -> `movelens_demo.json`. All earlier routes still exist (`/present`, `/research`, `/compare`, `/examples`, `/walkthrough`, `/results`, `/methodology`, `/about`).

## 2026-10-07 presentation simplification
- `/` is now a one-button landing page; `/present` is the six-step 10-minute guided demo (presenter notes toggle); nav = Demo, Results, Methodology, About. The old overview moved to `/research` (nothing deleted); `/about` lists every other view. No data or evaluation code changed.

## 2026-10-07 pass (additive; validated artifacts untouched)
- New routes: `/walkthrough` (8-step professor tour), `/examples` ("Where the models disagree", 6 real rule-selected test decisions + 2 reserved Qwen slots).
- Overview: spec title, three-model Input/Output/Role/Strength/Limitation cards, honest Qwen-pending status, Limitations section. Methodology: research-artifact downloads + comparison limitations.
- New artifacts: `curated_examples.json` (`experiments/20`), `three_model_results_summary.csv` (`experiments/21`), `paired_bootstrap.json` copied to the web data folder.
- Docs: README rewritten (question, protocol, findings, reproduce, architecture, limitations), `docs/methodology.md`, `experiment_protocol.md`, `limitations.md`, new DEMO_SCRIPT.
- Verified: pytest 40 passed + 4 skipped; vitest 23/23; tsc, eslint clean; production build OK; 8 routes x (1366, 375 px): 0 console errors, no overflow; walkthrough and example tabs clicked through; deployed to Vercel and rechecked on production; external links 200.
- **Qwen3-8B-Base still has no results**: Modal refuses GPU functions without a payment method (re-checked 2026-10-07; `deploy/modal_app.py` GPU list changed to `["L40S", "A100"]`).

## 2026-10-05 three-model restructuring

## Three-model comparison (primary story)
Done (P0, without GPU):
- Audit: R (projection.py) has **no per-legal-move distribution** → compatibility matrix; R compared on T1/T3 events and z(top-1).
- Qwen3-8B-Base scorer (`services/analyzer/qwen/`): frozen prompt (hash `7f4373cf…`), full-candidate log-likelihood,
  log-sum-exp over legal moves, KV-cache batching (verified vs full-sequence scoring: 2.5e-5 nats fp32), immutable cache.
- Positions exported (test 12,863 / val 11,973 / train 38,191); Maia-3 79M run on val+test (revision a107d6ce).
- Task 1 + Task 2 + paired source-game bootstrap (`14_three_model_eval.py`), plan frozen in `three_model_plan.py`.
- Prepared three-model study (`prepared_three_model_demo.json`), `/compare` flagship, new Overview, Results tabs,
  Methodology section, extended provenance (`three_model_provenance.json`).
- Tests: pytest 35 passed + 5 skipped (research venv), 14/14 in `.venv-qwen` (incl. real-model scoring tests);
  vitest 14/14; tsc + eslint clean; build passes; 0 console errors; no overflow at 375/1366 px.
- Validated artifacts byte-identical (SHA-256 checked: splits, variants, decisions, test predictions, metrics,
  projection, paired bootstrap, provenance, prepared studies, AIF).

Decision 2026-10-05: Qwen set aside for now; the site presents Regan-inspired vs Maia-3 79M, with the LLM shown as the
next experiment (UI switches to three models automatically when Qwen is scored). Modal token is configured; GPU use needs
a payment method on the Modal account.

Added later on 2026-10-05: Results show the pre-registered secondary score (excess surprisal: Maia-3 79M AUC 0.715, 5M 0.698) and
a Maia-3 79M vs 5M finding; `docs/THREE_MODEL_RESULTS.md` generated from the result files (`19_three_model_results_md.py`);
`docs/DEMO_SCRIPT.md` (5–6 min professor walkthrough); provenance refreshed. Checks: pytest 36 passed + 4 skipped, Qwen venv
14/14, vitest 15/15, tsc + eslint clean, build OK, production verified (0 console errors, no overflow at 375/1366 px).

Pending (Qwen, when resumed):
- Qwen3-8B-Base scoring of test/val/train (`modal run deploy/modal_app.py::score --split …`), then rerun 15 → 14 → 16 → 17 → 18 and redeploy.
- Live endpoint (`modal deploy deploy/modal_app.py`) + `NEXT_PUBLIC_LIVE_API_URL` on Vercel.
- P1: position-only ablation (`--condition position_only`), System E hybrid.

## Earlier status (hybrid pipeline)

## Completed
- Data: 2,230 Lichess rapid/classical games (Aug 2026), stratified by Elo band, one game per player.
- Stockfish 19 MultiPV 5 depth 12 (reproducible); Maia-3 5M full legal-move policy (official package, pinned).
- Regan-inspired projection (difficulty model, Elo band × difficulty decile table, κ from validation);
  projected-vs-observed for T1-match analogue, **EV-match analogue (added)**, top-3, unscaled loss,
  hard/ordinary-position top-1, Maia surprisal. Model features unchanged by the EV addition (verified
  byte-identical feature table).
- Controlled assistance (Random / Selective / Subtle, 0–70%), leakage-safe splits + automated tests (17 pass).
- Ablation A0/A/B/C/D, XGBoost classifier + regressor, SHAP, decision-level model, event-level power,
  baseline calibration. Results in `docs/RESULTS.md`, figures in `docs/figures/`.
- **Final redesign** (audit: `docs/AUDIT.md`):
  - Navigation: Overview · Guided Demo · Compare Methods · Analyze Game · Methodology (old routes redirect).
  - Provenance badges everywhere: Regan — verified public method / ChessAssistLens — augmentation or
    approximation / Experimental finding. Single source of truth for Regan statements: `apps/web/src/lib/regan.ts`.
  - Dual-layer UX: plain readings first (Engine Quality, Human Plausibility, Position Difficulty, Pattern
    Over Time, Deviation From Expected, Estimated Assistance Intensity) + "Technical details" with raw
    values, formulas, conditioning and provenance.
  - 5-stage Guided Demo (Problem → Existing Foundation → AI Addition → Controlled Experiment → Finding).
  - Findings generated from metrics.json with explicit rules (`apps/web/src/lib/findings.ts`):
    finding / evidence / interpretation / limitation.
  - Methodology: exact pipeline, Relationship-to-Regan table (verified / approximation / addition),
    feature definitions, hyper-parameters and versions read from the export, uncertainty, AIF,
    reproducibility, independent-research note.
  - New disclaimer text in UI, API and AIF; AIF relabelled "experimental AIF-compatible export".
- Verified end to end on production (https://chessassistlens.vercel.app): guided walk, all pages,
  redirects, 0 console errors, no horizontal overflow at 375 px, live PGN upload (12 s).

## Accuracy / provenance pass (2026-10-04, for the demo to Prof. Regan)
- Framing: "controlled decision-level substitutions"; source games "original (presumed human, no injected
  assistance)"; ground truth = intervention label + realized substituted fraction; required note on not
  replaying games shown beside the guided controls, in Methodology and README.
- Attribution: "three complementary views"; every Regan concept cites a verified public source with page
  (Apr 2026 talk, IR user guide, CSE 702 Week 6A); EWN described as optional (unit weighting > 99% per the
  guide); difficulty awareness credited to Regan's model; Maia-3 described as a Chessformer-based transformer
  (ICLR 2026 paper, model card: Lichess Jan 2023 – Jul 2025), "predicted probability" wording throughout.
- Statistics: `experiments/09_paired_bootstrap.py` — paired source-game cluster bootstrap of AUC differences
  on the saved test predictions (no refit/tuning). A→B and C→D, previously "within uncertainty" by interval
  overlap, have paired 95% CIs excluding 0 (+0.0066 [+0.0026, +0.0105]; +0.0067 [+0.0025, +0.0110]).
  Low-FPR recall always shown with realized test FPR; hard-position z tail (0.99% vs 0.14%) surfaced.
- Pseudo-event result renamed "exploratory pooling of different-player games", removed from headline findings.
- Prepared studies: original move and counterfactual substitution shown together; timeline selection strip +
  "View selected position" (no auto-scroll); "Prepared report" vs "Live analysis" labels; health check now
  requires models + engine loaded; offline fallback button switches to prepared studies.
- Provenance: `experiments/10_provenance.py` → `provenance.json` (hashes, split counts, Maia revision b6559de,
  4 consistency checks, all passing); `services/analyzer/requirements-lock.txt`. No git commit / run ID exists.
- Verification: export re-run changed **no** numeric value (deep JSON diff; AIF files byte-identical);
  pytest 17/17; eslint + tsc clean; 122/122 browser checks (routes at 1366 and 375 px, guided nav,
  controls, timeline sync, disclosures, chart selectors, downloads, offline fallback, keyboard, labels);
  live code path reproduced prepared scores within 5e-7 (Windows).

## Current
- Backend: Docker on the development laptop behind a Cloudflare quick tunnel (see DEPLOY.md). At the end of
  the 2026-10-04 pass Docker Desktop and the tunnel were **not running**; the URL baked into the production
  build (`visits-podcast-weekends-freely.trycloudflare.com`) no longer resolves.

## Blocked (needs the user)
- Permanent backend host (Railway / Render Starter / Cloud Run / ngrok static domain) — needs an account token.

## Next
- Move the backend to a permanent host; then set NEXT_PUBLIC_API_URL once and redeploy.
