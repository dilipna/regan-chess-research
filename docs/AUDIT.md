# UX / accuracy audit (before final redesign) — 2026-10-04

## Accuracy w.r.t. Regan's publicly documented framework
| # | Finding | Severity | Fix |
|---|---|---|---|
| 1 | Methodology/`projection.py` say Regan's model has "sensitivity and consistency" parameters — omits **h (heave/nudge)**, the third Elo-trained parameter in the April 2026 description. | High | State s, c, h; describe move utilities across depths, scaling, p_i per legal move. |
| 2 | No mention of **EV-match, ASD, IPR, EWN, Proj1…Proj7+**, MultiPV-only input, or the console analyzer. A Regan reader cannot see which of his concepts we approximate. | High | "Relationship to Regan's work" table (verified / approximation / addition) on Methodology + Guided Demo stage 2. |
| 3 | Our baseline reports top-1, top-3, capped CPL. **EV-match is not computed**; "mean move loss" could be read as ASD. | Medium | Add EV-match (played value = best value at depth 12) to projected-vs-observed (display only; model features unchanged). Label move loss "unscaled — not ASD". |
| 4 | Difficulty-conditioned performance is presented without noting that **EWN** already weights complex positions. Risk of implying we invented difficulty-aware detection. | High | Explicit note wherever difficulty appears; badge difficulty items as approximation, not augmentation. |
| 5 | No provenance marking. Reader cannot tell Regan concept vs our addition vs experimental result. | High | Three badges: REGAN — VERIFIED PUBLIC METHOD / CHESSASSISTLENS — OUR AUGMENTATION (with "approximation" variant) / EXPERIMENTAL FINDING. |
| 6 | AIF label says "AIF-format export"; spec asks "AIF-compatible export" and no compatibility claim. | Low | Relabel; beginner + expert explanation. |
| 7 | Disclaimer wording differs from the required text. | Low | Replace everywhere (frontend + API + AIF). |
| 8 | No "independent research" statement (no private Regan data/calibration). | Medium | Add to Overview and Methodology. |

## UX
| # | Finding | Fix |
|---|---|---|
| 9 | 7 primary nav items; no narrative path. | 5 items: Overview, Guided Demo, Compare Methods, Analyze Game, Methodology; old routes redirect. |
| 10 | Technical vocabulary first (surprisal, cp, z, MultiPV) — beginner cannot follow. | Plain names first (Engine Quality, Human Plausibility, Deviation From Expected, Hard-Position Performance, Pattern Over Time, Estimated Assistance Intensity) + "Technical details" disclosure with raw values, formula, conditioning, provenance. |
| 11 | Position panel shows 8 numbers at once. | Inspector: 4 qualitative readings + one generated sentence; numbers behind Technical details. |
| 12 | Timeline shows 6 overlapping encodings by default. | Simple mode: 3 tracks + highlighted co-occurrence regions with "why highlighted"; Expert mode keeps raw tracks. |
| 13 | Findings are spread across charts; no explicit "what we found" with evidence and limitations. | Findings generated from metrics.json with Finding / Evidence / Interpretation / Limitation. |
| 14 | No guided 3–5 minute story. | 5-stage Guided Demo with stepper, Back / Next / Exit. |
| 15 | Metric names (TPR@FPR) untranslated. | Plain-language sentence beside each metric; CI-overlap verdict. |

## Kept unchanged
Data, Stockfish/Maia analysis, splits, variants, model features, trained models, metrics — all numbers stay
the ones produced by the existing pipeline.
