# Optional full saved-prediction CPU check — pre-implementation contract

The narrow committed-artifact check is already implemented and passing. A subsequent approved read-only check of the handoff's owner checkout succeeded: it is clean on `latentlens-storybook` (`7e70f1d`). Only the three required ignored inputs were copied to a separate mission workspace snapshot. Their hashes match the previously frozen identities in tests/test_three_model.py. The owner checkout and all original results remain unchanged.

This optional second command requires an explicit external evidence directory; it cannot claim full reproduction from a fresh clone alone. No model runtime, inference, Stockfish or raw Maia/Qwen policy is needed.

Acceptance before implementing the optional check:

1. Match frozen snapshot and reference hashes from full_cpu_verification_manifest.json. Missing or altered files fail with nonzero exit; do not skip or synthesize records.
2. Verify that all used variant/game assignments match splits.json, each game is in one split, and each case-normalized recorded player identifier appears in one split. Check unique variant identities, label/level agreement, and exact held-out prediction-to-test-variant identities. This is metadata consistency/disjointness, not proof of real human identity, absence of real assistance or collection integrity.
3. Recompute all five stored ROC-AUC points and seven paired differences/95% intervals from the 9,680 held-out rows, using the stored 2,000 source-game resamples and seed. Preserve original first-appearance source-game order. Independently implement weighted ROC-AUC with half credit for score ties; class-balanced weights cancel within each class for binary AUC. Verify against known tie/weight controls before using research outputs.
4. Match stored AUC values, difference points and percentile bounds within absolute 1e-9. Do not alter source values or relax tolerance after seeing results. Descriptive share<=0 is not part of acceptance; floating sign at zero is not a hypothesis-test p-value.
5. Write a separate hashed/runtime-qualified report. Do not overwrite source/web artifacts or commit the ignored inputs. Retain Qwen pending and independent-Regan attribution. No new model-quality result is claimed.

The new full check can upgrade the program's split/prediction-arithmetic evidence, but cannot regenerate model predictions, reconstruct the raw legal-move distributions or establish scientific/production/cheating-detection validity. Minimal CI continues to use committed inputs only; the optional input-dependent command is not falsely represented as running in public CI.
