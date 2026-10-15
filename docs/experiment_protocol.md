# Experiment protocol

1. **Held-out human games.** Original games are split 60/20/20 *before* any variant exists. Games sharing a player are joined (union-find) and whole components go to
   one split; variants inherit their source game's split. Tests: `tests/test_leakage.py`. The difficulty model is fitted on train only; kappa is calibrated on validation only.
2. **Natural (negative) examples.** The original, presumed-human decisions. "Presumed" because the absence of real assistance is not verified.
3. **Controlled engine-assisted (positive) examples.** For a player's n eligible decisions in a game and level alpha in {5, 10, 20, 40, 70}%, m = max(1, round(alpha*n))
   decisions where the human did not already play Stockfish's #1 receive a different engine-chosen move:
   * RANDOM: m decisions uniformly, substitute Stockfish #1;
   * SELECTIVE: the m highest-difficulty decisions, substitute Stockfish #1;
   * SUBTLE: substitute uniform among top-3 lines within 30 cp of the best (excluding the human move), decisions uniform.
   Selections are nested across levels and deterministic. Substitutions are evaluated **in the original positions**; games are not replayed.
4. **Grouping.** The unit of resampling and splitting is the source game; moves within a game are dependent.
5. **Same observations for every system.** All models are scored on the same held-out rows (9,680 rows, 321 source games). Pre-registered scores: z(top-1) for R,
   mean surprisal -ln P for Q and M (secondary: excess surprisal). Low-FPR thresholds from 567 validation original player-games.
6. **Leakage controls.** No test game, player or decision enters fitting, threshold choice or prompt design; Qwen prompts are built from position fields only and
   tests assert the prompt is unchanged when the played move or any assistance field changes; Qwen is zero-shot.
7. **Statistics.** ROC-AUC, PR-AUC, recall at FPR (with realized FPR), paired delta-AUC with 95% percentile CI from 2,000 paired source-game resamples (seed 20261012 for
   the hybrid bootstrap), no refitting inside the bootstrap, no multiplicity correction.
8. **Qwen increment (pending).** Baseline, +Qwen, +Maia, +Maia+Qwen and full hybrid on identical rows with paired deltas; produced only from real scores. Current
   sample: 0 of 12,863 test positions scored.

Order of work when Qwen is run: `modal run deploy/modal_app.py::score` for test, val, train; then `15_qwen_artifacts`, `14_three_model_eval`,
`16_export_three_model_demo`, `17_hybrid_qwen`, `18_three_model_provenance`, `19_three_model_results_md`, `20_export_curated_examples`, `21_export_results_csv`;
then redeploy. The UI switches to the three-model view automatically and reports whatever the numbers show.
