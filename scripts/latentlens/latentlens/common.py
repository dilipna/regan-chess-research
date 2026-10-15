"""Paths, seeding and provenance shared by every LatentLens script."""

from __future__ import annotations

import datetime as _dt
import hashlib
import json
import math
import os
import platform
import random
import subprocess
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
RESULTS = ROOT / "results" / "latentlens"
DATA = ROOT / "data" / "latentlens"          # large, gitignored (representations, caches)
WEB_DATA = ROOT / "apps" / "web" / "public" / "data" / "latent"

DEFAULT_MODEL = "Qwen/Qwen3-8B-Base"
PINNED_REVISIONS = {
    # Same revision Version 1 pinned for its chess scoring (services/analyzer/qwen/scorer.py).
    "Qwen/Qwen3-8B-Base": "49e3418fbbbca6ecbdf9608b4d22e5a407081db4",
    # pipeline checks and tests only; never reported as a Qwen3-8B result
    "Qwen/Qwen3-0.6B-Base": "da87bfb608c14b7cf20ba1ce41287e8de496c0cd",
}


def model_slug(model_id: str) -> str:
    """'Qwen/Qwen3-8B-Base' -> 'qwen3-8b' (results folder name)."""
    name = model_id.split("/")[-1].lower()
    for suffix in ("-base", "-instruct"):
        if name.endswith(suffix):
            name = name[: -len(suffix)]
    return name


def results_dir(model_id: str) -> Path:
    d = RESULTS / model_slug(model_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def seed_everything(seed: int) -> None:
    random.seed(seed)
    os.environ["PYTHONHASHSEED"] = str(seed)
    try:
        import numpy as np
        np.random.seed(seed)
    except ImportError:
        pass
    try:
        import torch
        torch.manual_seed(seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(seed)
    except ImportError:
        pass


def stable_hash(text: str, seed: int = 0) -> int:
    """Platform-independent 64-bit hash (Python's hash() is salted per process)."""
    return int.from_bytes(hashlib.sha256(f"{seed}:{text}".encode()).digest()[:8], "big")


def git_commit() -> str | None:
    try:
        out = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, timeout=10)
        sha = out.stdout.strip()
        if out.returncode != 0 or not sha:
            return None
        dirty = subprocess.run(["git", "status", "--porcelain"], cwd=ROOT, capture_output=True, text=True, timeout=30).stdout.strip()
        return sha + ("-dirty" if dirty else "")
    except (OSError, subprocess.SubprocessError):
        return None


def library_versions() -> dict[str, str | None]:
    import importlib.metadata as md
    out: dict[str, str | None] = {"python": platform.python_version()}
    for pkg in ("torch", "transformers", "tokenizers", "safetensors", "numpy", "scikit-learn", "pandas"):
        try:
            out[pkg] = md.version(pkg)
        except md.PackageNotFoundError:
            out[pkg] = None
    return out


def hardware() -> dict[str, Any]:
    info: dict[str, Any] = {"platform": platform.platform(), "machine": platform.machine(), "node": platform.node()}
    try:
        import torch
        if torch.cuda.is_available():
            p = torch.cuda.get_device_properties(0)
            info["gpu"] = p.name
            info["gpu_memory_gib"] = round(p.total_memory / 2**30, 2)
        else:
            info["gpu"] = None
    except ImportError:
        info["gpu"] = None
    return info


def now_iso() -> str:
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()


def provenance(**extra: Any) -> dict[str, Any]:
    return {"git_commit": git_commit(), "timestamp": now_iso(), "versions": library_versions(), "hardware": hardware(), **extra}


def _clean(o: Any, digits: int) -> Any:
    if isinstance(o, float):
        if math.isnan(o) or math.isinf(o):
            return None
        return round(o, digits)
    if isinstance(o, dict):
        return {str(k): _clean(v, digits) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_clean(v, digits) for v in o]
    if hasattr(o, "item") and callable(o.item):        # numpy / torch scalars
        return _clean(o.item(), digits)
    return o


def write_json(path: Path, obj: Any, digits: int = 6, compact: bool = False) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(_clean(obj, digits), ensure_ascii=False, **({"separators": (",", ":")} if compact else {"indent": 1}))
    path.write_text(text + "\n", encoding="utf-8")
    return path


def read_json(path: Path) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))
