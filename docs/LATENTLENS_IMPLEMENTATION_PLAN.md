# LatentLens (Version 2) implementation plan

Internal planning document. Written 2026-10-15, before any LatentLens code, from a full audit of the repository.

## 1. Current architecture (audit)

| Area | Finding |
|---|---|
| Repository | One folder, no commits before this work. First commit `66f8284` (tag `v1-baseline`) snapshots Version 1 byte-for-byte. Work continues on branch `latentlens-v2`. `master` stays unborn, as it was. |
| Frontend | Next.js 16.3.8 (App Router, Turbopack), React 19.2, TypeScript strict, Tailwind CSS v4 with CSS-variable tokens in `src/app/globals.css`, shadcn/radix primitives, lucide icons, Recharts 3 for charts. No animation library; animations are CSS (`.reveal`, reduced-motion aware). Fonts: Cormorant Garamond (display), IBM Plex Sans/Mono. |
| Routing | `src/app/*/page.tsx`. V1 routes: `/`, `/about`, `/analyze`, `/compare`, `/demo`, `/examples`, `/methodology`, `/present`, `/research`, `/results`, `/walkthrough`, plus `robots.txt`, `sitemap.xml`, `icon.svg`, and redirects in `next.config.ts` (`/lab`, `/guided`, `/simulator`, `/explain`, `/projected`). |
| Data flow | Static JSON in `public/data/*.json`, read at build time by `lib/server-data.ts::preload` and passed to client components. No server runtime is needed; all pages prerender as static. |
| Backend | `services/analyzer` (FastAPI, Stockfish, Maia-3, Qwen scorer) and `deploy/modal_app.py` (Modal GPU job + endpoints). Not needed by the deployed site. |
| Experiments | `experiments/01..24_*.py` (V1 pipeline), results in `data/artifacts/` and copies in `apps/web/public/data/`. |
| Existing Qwen code | `services/analyzer/qwen/` scores chess moves by token log-likelihood. Pinned `Qwen/Qwen3-8B-Base @ 49e3418fbbbca6ecbdf9608b4d22e5a407081db4`; `Qwen/Qwen3-0.6B-Base` used for tests. |
| Model cache | Full Qwen3-8B-Base (5 safetensors shards, 16 GB, same pinned revision) and Qwen3-0.6B-Base are in the local HF cache. |
| Python envs | `.venv` (research, sklearn, torch; must never get transformers), `.venv-qwen` (torch 2.14.1+cu126, transformers 5.18.0), `.venv-modal`. |
| Hardware | RTX 3050 Ti Laptop (4 GB VRAM), 15.7 GB RAM, ~560 GB free disk. |
| Tests / CI | pytest (`tests/`), vitest (`apps/web/tests/`), `tsc --noEmit`, eslint. No CI config in the repo. |
| Deployment | Vercel project `chessassistlens` (`apps/web/.vercel`), `https://chessassistlens.vercel.app`. Dockerfile for the analyzer API. |
| Env vars | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_LIVE_API_URL` (optional). `.env.local` is gitignored and not touched. |
| Baseline | pytest 44 passed + 4 skipped (`.venv`); 14/14 (`.venv-qwen`); vitest 33/33; tsc + eslint clean; `next build` OK, 15 routes static. |

## 2. Version 1 preservation strategy

1. V1 is frozen at tag `v1-baseline`. At the end, `git diff v1-baseline --stat` must list only the V1 files named below.
2. No V1 component, data file, experiment, result or test is edited, moved or renamed.
3. Allowed V1 touch points (additive only, each justified in the final report):
   - `apps/web/src/components/site/nav.tsx`: one link, "V2 · Model Internals", after "Methods".
   - `apps/web/src/app/sitemap.ts`: append the `/latent` routes.
   - `.gitignore`: append ignore rules for LatentLens activations, caches and the new venv.
   - `README.md`: append a "Version 2: LatentLens" section; nothing above it changes.
4. V1 tests (pytest, vitest) are rerun unchanged at every milestone; the V1 route list must still build.
5. LatentLens CSS lives in its own file imported by the `/latent` layout; `globals.css` is not edited.
6. LatentLens Python runs in a new `.venv-latent`; V1 environments are not modified.

## 3. Version 2 architecture

```
apps/web/src/app/latent/            new route group, own layout + sub-navigation
  page.tsx                          overview: V1 -> V2 progression, verified architecture, mode cards
  learn/page.tsx                    Learn Mode (follow one token, block microscope, labs, training, teach-back)
  research/page.tsx                 Research Mode (layer probes, PCA, RMSNorm and component studies, controls)
  recall/page.tsx                   Recall Microscope (true-token rank by depth, diagnostic projections)
  methods/page.tsx                  methods, open vs black-box models, limitations, provenance
  demo/page.tsx                     5-minute professor demo
apps/web/src/components/latent/*    all V2 components
apps/web/src/lib/latent/*           artifact types, schema checks, toy math (RMSNorm, RoPE, softmax, decoding, backprop)
apps/web/public/data/latent/qwen3-8b/*.json   compact artifacts copied from results/
scripts/latentlens/                 CLI tools + `latentlens` Python package
results/latentlens/qwen3-8b/        committed compact artifacts (JSON); large activations go to data/latentlens/ (ignored)
tests/latentlens/                   Python tests (skip cleanly where torch/transformers are unavailable)
apps/web/tests/latent.test.tsx      web tests
docs/QWEN3_FROM_ZERO_TO_INTERNALS.md, LLM_MASTERY_CHECKLIST.md, LLM_MASTERY_ANSWERS.md,
docs/LATENTLENS_PROFESSOR_DEMO.md, LATENTLENS_CSE_RUNBOOK.md
```

### Model execution design

The 8B model (16 GB in bf16) cannot sit on a 4 GB GPU. Two loaders share one adapter interface:

- `full`: `AutoModelForCausalLM.from_pretrained(...).to(device)` for a CSE GPU machine. Hooks capture internals.
- `stream`: a layer-streaming runner. It instantiates each real `Qwen3DecoderLayer` from the installed transformers
  implementation, loads only that layer's tensors from the safetensors shards onto the GPU, runs every sequence of the
  batch through it, then frees it. Embeddings, final RMSNorm and LM head are handled the same way. The math is the
  library's own modules; a test checks that streamed hidden states and logits match the ordinary full model on
  Qwen3-0.6B-Base.

Hidden states are captured by explicit forward hooks, not by `output_hidden_states`, because in transformers 5.18
`hidden_states[-1]` is overwritten with the output of the final RMSNorm while every other entry is a pre-norm residual.

### Artifacts

`architecture.json`, `tokenizer_examples.json`, `token_trace.json` (one real forward pass of the example sentence),
`recall_probe.json`, `layer_probe.json`, `rmsnorm_probe.json`, `component_probe.json`, `pca/*.json`, `metadata.json`.
Each artifact has `status` (`ok` or `pending`), provenance, and only measured values. The UI renders "Experiment pending"
for anything not `ok`.

## 4. Implementation phases (priority order from the brief)

P0 protect V1 · P1 audit + baseline · P2 `/latent` + verified architecture · P3 tokenizer to logits trace ·
P4 transformer block microscope · P5 RMSNorm lab · P6 attention, GQA, RoPE, causal mask · P7 MLP and residual ·
P8 training, inference, decoding, KV cache · P9 teach-back + mastery docs · P10 Recall Microscope ·
P11 hidden-state extraction · P12 layer probes + controls · P13 RMSNorm research · P14 attention vs MLP ·
P15 PCA · P16 adapter interface for further models.

## 5. Risks and limitations

| Risk | Mitigation |
|---|---|
| EditLens (`pangram/editlens_iclr`) is gated (manual approval, non-commercial terms). No HF token on this machine. | Loader written against the published schema; probe results stay `pending` until the user is granted access. An ungated third-party mirror exists and is deliberately not used. `pangram/WildAI` is not a substitute: its labels come from Pangram's detector (circular). |
| 8B model on a 4 GB laptop GPU | Layer streaming (above). Experiments that need thousands of documents are better run on CSE GPUs; the runbook gives commands. |
| bf16 numerics | RMSNorm and softmax already run in fp32 inside Qwen3; streamed vs full equivalence tested in fp32 on 0.6B; dtype recorded in metadata. |
| Logit lens misread as "the model's prediction at layer k" | Always labelled "intermediate diagnostic projection"; final-layer identity with real logits is asserted. |
| Overclaiming from probes / PCA | Fixed wording rules (brief section 48), layer selection on validation only, test evaluated once, random-label and length/token-count controls. |
| Copyrighted recall passages (e.g. the MLK speech) | Not bundled. Demo uses the Gettysburg Address (public domain) and an original control paragraph; any text file can be passed on the command line. |
| V1 regressions | V1 tests at each milestone; `git diff v1-baseline` audit at the end. |

## 6. Files expected to change

New: everything under `apps/web/src/app/latent/`, `apps/web/src/components/latent/`, `apps/web/src/lib/latent/`,
`apps/web/public/data/latent/`, `apps/web/tests/latent.test.tsx`, `scripts/latentlens/`, `results/latentlens/`,
`tests/latentlens/`, the docs listed above.

Modified V1 files (additive only): `apps/web/src/components/site/nav.tsx`, `apps/web/src/app/sitemap.ts`, `.gitignore`,
`README.md`.
