# CPU verification contract — before implementation

Baseline `0f4fd281b51be26d7aa4e5b5a074d79b36ab7001`. Preserve every existing validated artifact, analysis plan and displayed number. This is an additive offline verification command, not a model inference/training run or a publication. The original handoff's owner checkout cannot be inspected from this session; this work uses a clean isolated remote clone and must not overwrite that checkout.

The full hybrid test_predictions.parquet, processed splits/variants and raw policy/target files are gitignored and absent from a clean clone. Therefore full ROC-AUC bootstrap reproduction, actual train/validation/test player-disjointness, Stockfish regeneration and legal-policy validation cannot be claimed here.

The committed maia_move_scores.parquet contains both Maia checkpoints' 12,863 declared test decisions with source-game identities, played-move rank/probability and log probability. It supports a narrower meaningful check without torch, model downloads, Stockfish, private caches or a paid GPU.

Acceptance, frozen before verifier implementation:

1. A single command in a separate minimal CPU environment recomputes Maia-79M and Maia-5M top-1 accuracy, top-3 accuracy, mean negative log-likelihood and mean rank, plus their source-game percentile intervals and four paired differences, using the original analysis plan seed and 2,000 resamples.
2. Match saved JSON values at absolute tolerance 1e-10. Failure is a nonzero process exit; never update source values or increase tolerance after observing a mismatch. Missing inputs must fail, not turn into green skipped tests.
3. Check frozen source artifact/plan hashes; one row per model/source-game/ply; exact paired position sets and input metadata; finite probabilities/ranks; original variant/test labels; declared counts; original plan hash and Qwen held-out pending/null status. Use the same source-game resamples for both models; never bootstrap individual decisions independently.
4. Write a separate verification report/table with code/input/runtime identities, leaving every source and website artifact unchanged. Explicitly list metrics that cannot be recovered from the committed score summaries (full multiclass Brier, engine-event and Task-2/hybrid metrics) and the missing split proof.
5. Dedicated CPU tests exercise arithmetic, unequal game sizes, pairing, duplicates, invalid values, hash drift and missing evidence. Add an offline-friendly CI command, but distinguish local execution from an actually completed GitHub Actions run.

No original statistical result, researcher appointment, professor approval, real-world cheating detection or completed Qwen held-out evaluation may be inferred from this check. It verifies saved-output arithmetic and consistency, not the provenance/quality of the original model inference or source games. The Regan-inspired reconstruction remains independent of Professor Regan's production system.
