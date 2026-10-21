# Extraction integrity: acceptance before implementation

October 21, 2026; baseline source `8747bfa0da748064bb3d72450cae83da72f011e6` (extractor unchanged from `0f4fd28`). This is a pipeline reliability change, not a new research result.

Observed source behavior: existing numbered chunks are skipped without validating document identities or contents. Metadata is rewritten first. Changing the dataset at the same path, document selection/order, chunk size, NLL setting or storage precision can silently combine incompatible outputs. A partially written NPZ is also considered finished by existence. Global run.json is first written after completion, so it does not identify an interrupted first extraction.

Acceptance:

1. Reproduce at least a stale-source/chunk reuse failure before modifying the extractor. Record the result separately.
2. Each split gets an immutable resume contract before any output write: complete extraction configuration, selected ordered document metadata plus SHA-256 of text and token IDs, tokenizer/model revision identity, chunk layout, implementation identity and relevant numerical runtime versions. A mismatch fails before rewriting metadata or results. Across splits, shared representation configuration remains compatible; loader/chunk settings belong to each split identity. No automatic conversion of legacy unverified outputs: use a new directory.
3. Publish chunk data and its integrity record atomically using same-directory temporary files and replacement. Validate hash, exact keys, dimensions, dtypes and finiteness before reuse. Only no-NLL permits the documented all-NaN NLL sentinel. Reject corruption instead of silently retraining or deleting evidence. A data file without its completion record is unfinished and may be recomputed; a completion record without data is corruption and fails.
4. Serialize writers to the entire extraction output root with an OS-held lock that releases on process death. Reject a concurrent writer. No stale-lock file deletion heuristic. Readers must not interpret a partial run as complete.
5. Clean and interrupted/resumed extraction produce identical arrays for a deterministic fixture. Exercise source/order/config/chunk/runtime drift, partial data writes, tampering, missing chunks, lock contention/process death, and rejected legacy output. Existing model math and scientific artifacts stay unchanged.
6. Resource cleanup executes after extraction errors. Preserve original failure and do not claim durable inference state or multi-host/distributed coordination.

Implement the artifact boundary as a small NumPy/stdlib module so CPU CI can exercise failure recovery without downloading models. Where cached runtime/model inputs are available, supplement it with actual pipeline regression; explicitly report any missing-model skips. Public CI need not run a GPU or gated dataset. Do not change existing result values to make tests pass.
