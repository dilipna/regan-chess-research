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

- http://localhost:3000/latent/professor (the meeting flow; ← / → to move)
- http://localhost:3000/latent/recall (Recall Microscope)
- http://localhost:3000/ (MoveLens V1)

If port 3000 is busy: `npx next start -p 3100`, then use http://localhost:3100/latent/professor.

If the build is missing or broken, `npm run dev` also works (slower first page load) at the same URL.

## If nothing runs

Screenshots of every section of the professor flow, and of the Recall Microscope, are in
`docs/regan-demo-backup/` (`section-1.png` to `section-9.png`, `recall-microscope.png`). The spoken script is
`docs/REGAN_5_MINUTE_DEMO.md`.

## Online

- Production (stable, older LatentLens): https://chessassistlens.vercel.app/latent
- The new professor flow on this branch is not on production. See the final report for any preview link.
