"""LatentLens: instruments for looking inside decoder-only language models (Version 2 of MoveLens).

Modules
    common     paths, seeding, provenance (git commit, library versions, hardware), JSON writing
    adapter    ModelProbeAdapter interface and the Qwen3 implementation (full or layer-streamed loading)
    streaming  layer-by-layer execution of a real Qwen3 checkpoint on a small GPU
    capture    forward hooks that pool hidden states at named sites, with guaranteed hook removal
    data       dataset loading, label mapping, deterministic sampling, split leakage checks
    probes     layerwise logistic-regression probes, metrics and negative controls
    recall     next-token recall scoring and intermediate diagnostic projections ("logit lens")
    schema     validators for every artifact the website reads
"""

__version__ = "0.1.0"
