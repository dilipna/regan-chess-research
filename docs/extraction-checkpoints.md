# Reliable hidden-state extraction

The former extractor treated an existing numbered NPZ as completed work. A deterministic CLI fixture demonstrated that changing a document at the same source path reused the old vectors while rewriting metadata for the changed text. This was a resume-integrity defect, not evidence that existing published experiments were affected.

The replacement boundary is `latentlens/checkpoint.py`: an OS-held lock serializes writers to the output root; each split records its ordered selected document/text/token identities, complete numerical configuration, implementation hashes and runtime before metadata is published. Existing chunks must have matching completion receipts, SHA-256, keys, dimensions, storage precision and finite values. Disabled NLL explicitly permits its all-NaN sentinel. A data file without a receipt is unfinished and recomputed; a receipt with missing/corrupt data fails.

Writes use a temporary file in the same directory, file flush/fsync and atomic replacement. Each final split gets a completion marker with hashes of metadata and arrays. New-format probe readers reject incomplete/corrupt published outputs and an active writer. The lock is held by the OS and released on process death; the permanent lock file is not itself an active lock. No stale-file deletion heuristic is used.

## Usage and legacy outputs

The extraction command and representation array shapes remain the same. For existing output folders created by the old extractor, choose a **new `--out` directory**. Legacy chunks cannot be safely adopted without the original run identity. Existing historical representations may still be read by the legacy reader path; that does not confer the new verified-completion status on them. The mission does not rewrite historical research artifacts.

For an interrupted new-format run, rerun the exact command with the same selected documents, configuration, software and numerical runtime. Completed valid chunks are reused; unfinished chunks are recomputed. Changed identity or corrupted completed data produces an explicit failure. Preserve the evidence and investigate or choose a new output folder; do not delete receipts just to bypass validation.

The implementation keeps chunk size and loader/batch/device settings in each split's identity. Shared model, dtype, depths, pooling, label mapping and NLL semantics remain compatible across splits. A source-file reorder that leaves the deterministically selected ordered documents unchanged does not change that selected-content identity.

## Guarantees and limits

This is single-host coordination on a filesystem with normal OS locking and atomic replace semantics. It is not a distributed job scheduler, a network-filesystem lease or a guarantee of survival of all directory metadata under sudden power loss. File hashes detect accidental drift/corruption relative to the recorded contract; an authorized operator can rewrite both data and receipts. Final consolidation still loads arrays in memory and may need a separate measured scaling improvement for very large corpora.

CPU tests exercise the actual CLI orchestration using deterministic test doubles, plus independent checkpoint I/O, lock contention/process death, atomic-write failure, corruption, drift and interrupted/resumed parity. Those fixtures are not model-quality results. Cached-model regressions are reported separately with their real runtime and checkpoint identities. No speedup or new scientific result is claimed.
