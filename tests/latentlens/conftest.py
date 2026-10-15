import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts" / "latentlens"))

SMALL_MODEL = "Qwen/Qwen3-0.6B-Base"      # pipeline checks only; never presented as Qwen3-8B output


def _cached(model_id: str) -> bool:
    try:
        from huggingface_hub import snapshot_download
        from latentlens.common import PINNED_REVISIONS
        snapshot_download(model_id, revision=PINNED_REVISIONS.get(model_id), local_files_only=True,
                          allow_patterns=["config.json"])
        return True
    except Exception:
        return False


@pytest.fixture(scope="session")
def small_model_id():
    pytest.importorskip("torch")
    pytest.importorskip("transformers")
    if not _cached(SMALL_MODEL):
        pytest.skip(f"{SMALL_MODEL} not in the local Hugging Face cache")
    return SMALL_MODEL
