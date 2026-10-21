"""Exercise original extractor with deterministic test doubles, never model inference."""

import importlib.util
import sys
import types
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/latentlens"))


def install_doubles(monkeypatch=None):
    def put(name, module):
        if monkeypatch:
            monkeypatch.setitem(sys.modules, name, module)
        else:
            sys.modules[name] = module

    torch = types.ModuleType("torch")
    torch.manual_seed = lambda seed: None
    torch.cuda = types.SimpleNamespace(is_available=lambda: False)
    put("torch", torch)
    adapter = types.ModuleType("latentlens.adapter")

    class Adapter:
        model_id, revision, doc_prefix_id = "fixture", "fixed", 0

        def __init__(self, *a, **kw):
            pass

        def load_model(self):
            pass

        def cleanup(self):
            pass

        def get_layer_count(self):
            return 2

        def get_hidden_size(self):
            return 2

        def tokenize(self, text):
            return list(text.encode())

        def forward_hidden_states(self, batches, sites, collector):
            for batch in batches:
                for layer, requested in sites.items():
                    for site in requested:
                        collector(site, layer, batch.values + layer, batch)

    adapter.Qwen3Adapter = Adapter
    adapter.make_batches = lambda toks, *a, **kw: [
        types.SimpleNamespace(
            index=list(range(len(toks))),
            values=np.array([sum(t) for t in toks], dtype=float),
        )
    ]
    put("latentlens.adapter", adapter)
    capture = types.ModuleType("latentlens.capture")

    class Store:
        def __init__(self, n, hidden, layers, poolings):
            self.layers = layers
            self.arrays = {
                (s, p): np.zeros((n, len(ls), hidden), dtype=np.float32)
                for s, ls in layers.items()
                for p in poolings
            }
            self.rms = {
                s: np.zeros((n, len(ls)), dtype=np.float32) for s, ls in layers.items()
            }

        def __call__(self, site, layer, h, batch):
            if site not in self.layers or layer not in self.layers[site]:
                return
            slot = self.layers[site].index(layer)
            for (s, p), arr in self.arrays.items():
                if s == site:
                    arr[:, slot] = h[:, None]
            self.rms[site][:, slot] = h

    capture.PooledStore = Store
    put("latentlens.capture", capture)


def invoke(dataset, out, chunk_size=1, extra=()):
    spec = importlib.util.spec_from_file_location(
        "fixture_extractor", ROOT / "scripts/latentlens/extract_hidden_states.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    sys.argv = [
        "extract_hidden_states.py",
        "--model",
        "fixture",
        "--dataset",
        str(dataset),
        "--dataset-format",
        "jsonl",
        "--split",
        "train",
        "--out",
        str(out),
        "--chunk-size",
        str(chunk_size),
        "--depths",
        "0,2",
        "--component-layers",
        "none",
        "--no-nll",
        "--store-dtype",
        "float32",
        "--local-files-only",
    ]
    sys.argv.extend(extra)
    module.main()
