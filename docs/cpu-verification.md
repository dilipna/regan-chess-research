# Reproduce selected saved Maia results without model inference

The original end-to-end experiment requires ignored raw/intermediate files and model runtimes. A fresh clone cannot run the full hybrid bootstrap merely because its summary JSON is committed. This additive command verifies what the committed score artifact actually supports; missing evidence is a failure, never a skipped success.

## Separate minimal environment

From a clean checkout with Python 3.10:

```powershell
python -m venv .venv-cpu
.venv-cpu/Scripts/python.exe -m pip install -r requirements-cpu-verify.txt
.venv-cpu/Scripts/python.exe -m pytest tests/cpu_verify -q
.venv-cpu/Scripts/python.exe scripts/verify_cpu_artifacts.py --output reports/cpu-evidence/verification.json
```

On Linux use `.venv-cpu/bin/python`. Dependencies are numpy 1.26.4, pyarrow 21.0.0 and pytest 8.1.1. This is a saved-artifact arithmetic environment, not a replacement for the existing pinned training/inference environment. It does not install torch/transformers, download models, deserialize pickled estimators or require Stockfish, Modal, credentials or GPU access.

## Exact scope

The 25,726 committed score rows represent 12,863 paired declared test positions for each of Maia-79M and Maia-5M, with 321 source games and 605 player-games. The verifier recomputes top-1 and top-3 accuracy from played-move rank, mean negative log-likelihood from the stored log probability (checked against the recorded probability/floor), and mean rank. It also recomputes all eight model-specific intervals and four paired difference intervals using the original seed and 2,000 source-game resamples shared across models. Unequal game sizes use decision-weighted means within each cluster resample, matching the source method.

The contract was committed before implementing this verifier in `docs/cpu-evidence-contract.md` and `experiments/cpu_verification_manifest.json`. Point values and intervals must match source JSON at absolute tolerance 1e-10. The command checks frozen file/plan hashes, data counts, unique paired source-game/ply keys and matching metadata, original/test labels, ranks/probabilities, and held-out Qwen pending/null status. It writes a separate report; it rejects writes into source data, web data or the contract. No validated source value or website artifact is regenerated or edited.

## Boundaries

This is independent arithmetic from saved model outputs, not independent regeneration of those outputs or independent data collection. The score file includes truncated move metadata, not all legal-move probabilities. Therefore it cannot prove legal-set normalization, reproduce full multiclass Brier or engine-event metrics, or validate original model inference.

The hybrid held-out predictions, split assignments, variants and target/policy files are absent from a fresh clone. Actual train/validation/test player-disjointness, Task-2/hybrid ROC-AUC and the Regan-versus-Maia event table remain unreproduced by this command. A `split == test` label is checked for consistency, not accepted as proof of leakage-free assignment. Those gaps require a separate public-safe frozen evidence export or regeneration protocol; do not reconstruct private files or manufacture substitute results.

Qwen's held-out evaluation remains pending. Seven locally scored demo positions do not change that status. Maia is a human-move transformer, not an LLM; the Regan-inspired reconstruction is independent of Professor Regan's production system; scores do not prove cheating. Bootstrap uncertainty conditions on the saved outputs, excludes training/refit uncertainty and has no multiplicity correction.

## Automation and evidence

`.github/workflows/cpu-evidence.yml` runs only this minimal verifier suite and command with read-only repository permissions. Local passing checks do not establish that GitHub Actions or Linux has run successfully; the workflow is prepared but not dispatched in this mission. The full original research/Qwen/LatentLens suites are not claimed as tested by this small environment.

The report includes source commit where Git is available, verifier/contract/input hashes, runtime versions, reproduced values/intervals, pending status and explicit unreproduced capabilities. Frozen file hashes detect drift relative to this repository contract; they do not independently authenticate the original scientific results or establish external prospective timestamps.

The initial sandboxed owner-checkout read failed; a subsequent authorized read-only check succeeded. The owner checkout is clean on `latentlens-storybook` at `7e70f1d` and was not modified. Three required ignored inputs were copied into a separate mission snapshot. Their identities match the original frozen test hashes. No public site, provider account or research attribution was changed.

## Optional full saved-prediction check

With an explicitly supplied evidence directory containing the exact frozen `variants.parquet`, `splits.json` and `test_predictions.parquet`:

```powershell
.venv-cpu/Scripts/python.exe scripts/verify_full_cpu_evidence.py --evidence-dir ../chess-evidence-inputs --output reports/cpu-evidence/full-verification.json
```

Missing/altered inputs fail; this command is not run by public CI because the ignored inputs are absent from a fresh clone. The pre-implementation contract is `docs/full-cpu-evidence-contract.md`. It independently checks recorded player identifiers (case-normalized) and source games across splits, variant/label metadata and exact held-out prediction identities. It reproduces five saved hybrid ROC-AUC values and seven paired differences/intervals at frozen absolute tolerance 1e-9. The independent weighted pair-ordering AUC gives half credit to score ties. Binary class-balanced weights cancel within classes. Each bootstrap draws the original first-appearance game order with the recorded seed; multiplicities weight every row of a sampled source game together.

Local results: 47,360 variant rows, 2,960 recorded players, 1,561 source games across splits; 9,680 held-out rows from 321 games and 605 player-games. All five point values and seven paired intervals match. These checks establish consistency of the frozen recorded identifiers and saved prediction arithmetic. They do not establish real-human identity, prospective data collection, original inference, independent Regan implementation validity, or real-world cheating-detection validity. Qwen held-out results remain pending. The minimal helper tests run without these external files; the actual external-input command was separately executed locally.
