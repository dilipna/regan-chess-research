"""Single-host extraction checkpoints: identity, atomic completion and validation.

An OS-held lock serializes writers. Hashes detect accidental drift/corruption;
they do not protect against an authorized operator rewriting data and receipts.
"""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
from contextlib import contextmanager
from pathlib import Path

import numpy as np


def digest(value):
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, ensure_ascii=False, allow_nan=False).encode()
    ).hexdigest()


def file_hash(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as fh:
        for block in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def atomic_write(path, writer):
    """Flush a same-directory temporary file before atomic visibility by replace."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".partial", dir=path.parent
    )
    try:
        with os.fdopen(fd, "wb") as fh:
            writer(fh)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def atomic_json(path, value):
    encoded = (
        json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
    ).encode("utf-8")
    atomic_write(path, lambda fh: fh.write(encoded))


@contextmanager
def output_lock(root):
    """Held until context exit/process death; leave the lock inode in place."""
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    with (root / ".extraction.lock").open("a+b") as fh:
        fh.seek(0, os.SEEK_END)
        if fh.tell() == 0:
            fh.write(b"0")
            fh.flush()
        fh.seek(0)
        try:
            if os.name == "nt":
                import msvcrt

                msvcrt.locking(fh.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl

                fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as exc:
            raise ValueError("Another extractor holds this output directory") from exc
        try:
            yield
        finally:
            fh.seek(0)
            if os.name == "nt":
                msvcrt.locking(fh.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(fh, fcntl.LOCK_UN)


class SplitCheckpoint:
    def __init__(self, root, identity, expected_chunks):
        self.root = Path(root)
        self.chunks = self.root / "chunks"
        self.contract = self.root / "resume-contract.json"
        self.identity = digest(identity)
        self.expected_chunks = expected_chunks
        envelope = {
            "schema": "latentlens.extraction/1",
            "identity_sha256": self.identity,
            "identity": identity,
        }
        if self.contract.exists():
            saved = json.loads(self.contract.read_text(encoding="utf-8"))
            if saved != envelope:
                raise ValueError(
                    "Extraction identity changed; use a new --out directory"
                )
        else:
            # An empty chunks directory is harmless; legacy arrays/metadata are not.
            if self.root.exists() and any(p.is_file() for p in self.root.rglob("*")):
                raise ValueError(
                    "Legacy output lacks a verified resume contract; use a new --out"
                )
            atomic_json(self.contract, envelope)
        self.chunks.mkdir(parents=True, exist_ok=True)
        for path in self.chunks.glob("*.json"):
            if path.stem not in {f"{i:05d}" for i in range(expected_chunks)}:
                raise ValueError("Unexpected completed chunk")

    def _paths(self, index):
        if not 0 <= index < self.expected_chunks:
            raise ValueError("Chunk index outside frozen layout")
        return self.chunks / f"{index:05d}.npz", self.chunks / f"{index:05d}.json"

    @staticmethod
    def validate(arrays, schema):
        if set(arrays) != set(schema):
            raise ValueError("Chunk array keys differ from contract")
        for key, rule in schema.items():
            a = arrays[key]
            if list(a.shape) != rule["shape"] or str(a.dtype) != rule["dtype"]:
                raise ValueError(f"Chunk shape/dtype mismatch: {key}")
            if rule.get("all_nan", False):
                if not np.isnan(a).all():
                    raise ValueError("Expected disabled-NLL sentinel")
            elif not np.isfinite(a).all():
                raise ValueError(f"Nonfinite chunk values: {key}")

    def load(self, index, schema):
        data, receipt = self._paths(index)
        if not receipt.exists():
            return None  # crash before completion: recompute, never trust the orphan
        saved = json.loads(receipt.read_text(encoding="utf-8"))
        if (
            saved.get("identity_sha256") != self.identity
            or saved.get("index") != index
            or saved.get("schema") != schema
            or not data.is_file()
            or saved.get("sha256") != file_hash(data)
        ):
            raise ValueError(f"Corrupt completed chunk: {index}")
        with np.load(data, allow_pickle=False) as archive:
            arrays = {key: archive[key] for key in archive.files}
        self.validate(arrays, schema)
        return arrays

    def publish(self, index, arrays, schema):
        self.validate(arrays, schema)
        data, receipt = self._paths(index)
        if receipt.exists():
            raise ValueError("Completed chunk is immutable")
        atomic_write(data, lambda fh: np.savez(fh, **arrays))
        atomic_json(
            receipt,
            {
                "identity_sha256": self.identity,
                "index": index,
                "sha256": file_hash(data),
                "schema": schema,
            },
        )

    def mark_complete(self, outputs):
        atomic_json(
            self.root / "complete.json",
            {
                "identity_sha256": self.identity,
                "outputs_sha256": {Path(p).name: file_hash(p) for p in outputs},
            },
        )

    def invalidate_completion(self):
        # A failed/active rerun must not leave an earlier successful marker visible.
        (self.root / "complete.json").unlink(missing_ok=True)


def verify_completed(root):
    """Validate published arrays/metadata before a new-format reader uses them."""
    root = Path(root)
    contract = json.loads((root / "resume-contract.json").read_text(encoding="utf-8"))
    if contract.get("identity_sha256") != digest(contract["identity"]):
        raise ValueError("Corrupt resume contract")
    marker = root / "complete.json"
    if not marker.is_file():
        raise ValueError("Extraction is incomplete; resume the matching command")
    saved = json.loads(marker.read_text(encoding="utf-8"))
    outputs = saved.get("outputs_sha256", {})
    actual = {"meta.jsonl", *(p.name for p in root.glob("*.npy"))}
    if (
        saved.get("identity_sha256") != contract["identity_sha256"]
        or set(outputs) != actual
        or any(
            not (root / name).is_file() or file_hash(root / name) != expected
            for name, expected in outputs.items()
        )
    ):
        raise ValueError("Published extraction outputs are incomplete or corrupt")
    return saved
