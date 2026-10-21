# Local demo runbook (no internet needed)

If Vercel or the Wi-Fi fails, run the site from this laptop. All LatentLens and MoveLens data is static JSON in
`apps/web/public/data/`, so no backend, GPU or network is needed once the site is built.

All commands use the scripts in `apps/web/package.json`.

## Tonight, while online

```bash
cd apps/web
npm install          # only if node_modules is missing (it is present on this laptop)
npm run build        # production build; do it while online in case fonts or packages need fetching
```

## Tomorrow

```bash
cd apps/web
npm run start        # serves the existing build
```

Open:

- http://localhost:3000/ (home: the two phases, three places to start, all pages folded at the bottom)
- http://localhost:3000/latent/professor (2.1, the meeting flow; ← / → to move)
- http://localhost:3000/latent/proposal (2.21, the proposed experiment; last subsection of Phase 2)
- http://localhost:3000/latent/recall (2.2, Recall Microscope)
- http://localhost:3000/chess (Phase 1, MoveLens V1)

If port 3000 is busy: `npx next start -p 3100`, then use http://localhost:3100/latent/professor.

If the build is missing or broken, `npm run dev` also works (slower first page load) at the same URL.

## If nothing runs

Screenshots of every section of the professor flow, the proposed experiment, the home page and the Recall
Microscope are in `docs/regan-demo-backup/` (`section-1.png` to `section-9.png`, `proposed-experiment.png`,
`home-phases.png`, `recall-microscope.png`). The spoken script is
`docs/REGAN_5_MINUTE_DEMO.md`.

## Online

- Live site (this version, deployed 2026-10-20): https://chessassistlens.vercel.app
- Professor demo: https://chessassistlens.vercel.app/latent/professor
- Proposed experiment: https://chessassistlens.vercel.app/latent/proposal
