"""Read representation folders written by extract_hidden_states.py."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .common import read_json


@dataclass
class Split:
    name: str
    meta: list[dict]
    root: Path

    @property
    def y(self) -> np.ndarray:
        return np.array([m["label"] for m in self.meta], dtype=int)

    @property
    def groups(self) -> np.ndarray | None:
        g = [m.get("group") for m in self.meta]
        return None if all(x is None for x in g) else np.array([x if x is not None else f"_id:{m['id']}" for x, m in zip(g, self.meta)])

    def array(self, key: str) -> np.ndarray:
        return np.load(self.root / f"{key}.npy", mmap_mode="r")

    def has(self, key: str) -> bool:
        return (self.root / f"{key}.npy").exists()

    def col(self, field: str) -> np.ndarray:
        return np.array([m.get(field) for m in self.meta])


def load_run(path: str | Path) -> tuple[dict, dict[str, Split]]:
    from .checkpoint import output_lock, verify_completed

    root = Path(path)
    with output_lock(root):
        run = read_json(root / "run.json")
        splits = {}
        if run.get("checkpoint_schema") == 1:
            recorded = {p.parent.name for p in root.glob("*/resume-contract.json")}
            if recorded != set(run["splits"]):
                raise ValueError("Extraction has incomplete split records")
        for name in run["splits"]:
            sdir = root / name
            if run.get("checkpoint_schema") == 1:
                marker = verify_completed(sdir)
                contract = read_json(sdir / "resume-contract.json")
                if (marker["identity_sha256"] != run["splits"][name].get("identity_sha256")
                        or contract["identity"].get("shared_identity_sha256") != run.get("shared_identity_sha256")):
                    raise ValueError("Split identity differs from the recorded extraction run")
            meta = [json.loads(l) for l in (sdir / "meta.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
            splits[name] = Split(name, meta, sdir)
    return run, splits
