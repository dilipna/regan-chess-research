"""Actual CLI orchestration with deterministic doubles, not model-quality tests."""

import json
import sys

import numpy as np
import pytest
from extraction_fixture import install_doubles, invoke
from latentlens.checkpoint import SplitCheckpoint, file_hash, verify_completed


@pytest.fixture
def dataset(tmp_path, monkeypatch):
    install_doubles(monkeypatch)
    monkeypatch.setattr(sys, "argv", list(sys.argv))
    path = tmp_path / "docs.jsonl"
    rows = [
        {"id": str(i), "text": text, "label": "human", "split": "train"}
        for i, text in enumerate(["one sentence", "another example", "third fixture"])
    ]
    path.write_text("".join(json.dumps(r) + "\n" for r in rows))
    return path


def test_clean_resume_preserves_chunks_and_values(tmp_path, dataset):
    out = tmp_path / "out"
    invoke(dataset, out)
    chunks = {
        p.name: (file_hash(p), p.stat().st_mtime_ns)
        for p in (out / "train/chunks").glob("*")
    }
    before = np.load(out / "train/resid_mean.npy")
    invoke(dataset, out)
    assert chunks == {
        p.name: (file_hash(p), p.stat().st_mtime_ns)
        for p in (out / "train/chunks").glob("*")
    }
    np.testing.assert_array_equal(before, np.load(out / "train/resid_mean.npy"))
    verify_completed(out / "train")


@pytest.mark.parametrize(
    "mutation", ["text", "order", "chunk", "precision", "batch", "seed"]
)
def test_drift_rejected_without_rebinding_metadata(
    tmp_path, dataset, mutation, monkeypatch
):
    out = tmp_path / "out"
    invoke(dataset, out)
    before = (out / "train/meta.jsonl").read_bytes()
    kwargs = {}
    if mutation == "order":
        from latentlens import data

        original = data.sample_balanced
        monkeypatch.setattr(
            data, "sample_balanced", lambda *a: list(reversed(original(*a)))
        )
    elif mutation == "text":
        rows = dataset.read_text().splitlines()
        row = json.loads(rows[0])
        row["text"] = "changed source"
        rows[0] = json.dumps(row)
        dataset.write_text("\n".join(rows) + "\n")
    elif mutation == "chunk":
        kwargs["chunk_size"] = 2
    else:
        kwargs["extra"] = {
            "precision": ["--store-dtype", "float16"],
            "batch": ["--batch-size", "2"],
            "seed": ["--seed", "1"],
        }[mutation]
    with pytest.raises((ValueError, SystemExit)):
        invoke(dataset, out, **kwargs)
    assert (out / "train/meta.jsonl").read_bytes() == before
    verify_completed(out / "train")


def test_interruption_resume_matches_clean(tmp_path, dataset, monkeypatch):
    out, clean = tmp_path / "resumed", tmp_path / "clean"
    publish = SplitCheckpoint.publish

    def interrupt(self, index, arrays, schema):
        publish(self, index, arrays, schema)
        raise RuntimeError("injected process interruption after completed chunk")

    with monkeypatch.context() as patch:
        patch.setattr(SplitCheckpoint, "publish", interrupt)
        with pytest.raises(RuntimeError, match="interruption"):
            invoke(dataset, out)
    first = out / "train/chunks/00000.npz"
    first_identity = (file_hash(first), first.stat().st_mtime_ns)
    assert not (out / "train/complete.json").exists()
    invoke(dataset, out)
    invoke(dataset, clean)
    assert first_identity == (file_hash(first), first.stat().st_mtime_ns)
    for path in (clean / "train").glob("*.npy"):
        np.testing.assert_array_equal(np.load(path), np.load(out / "train" / path.name))
    verify_completed(out / "train")


def test_corrupt_completed_chunk_rejects_and_marks_incomplete(tmp_path, dataset):
    out = tmp_path / "out"
    invoke(dataset, out)
    (out / "train/chunks/00000.npz").write_bytes(b"bad")
    with pytest.raises(ValueError, match="Corrupt"):
        invoke(dataset, out)
    assert not (out / "train/complete.json").exists()


def test_model_cleanup_after_failure(tmp_path, dataset, monkeypatch):
    adapter = sys.modules["latentlens.adapter"].Qwen3Adapter
    closed = []
    monkeypatch.setattr(adapter, "cleanup", lambda self: closed.append(True))
    monkeypatch.setattr(
        adapter,
        "forward_hidden_states",
        lambda *a: (_ for _ in ()).throw(RuntimeError("injected model failure")),
    )
    with pytest.raises(RuntimeError, match="model failure"):
        invoke(dataset, tmp_path / "out")
    assert closed == [True]
