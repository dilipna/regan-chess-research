import json
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest

LIB = Path(__file__).resolve().parents[2] / "scripts/latentlens"
sys.path.insert(0, str(LIB))
from latentlens.checkpoint import (
    SplitCheckpoint,
    atomic_write,
    output_lock,
    verify_completed,
)

SCHEMA = {"resid": {"shape": [2, 1, 2], "dtype": "float32"}}
ARRAYS = {"resid": np.arange(4, dtype=np.float32).reshape(2, 1, 2)}


def test_roundtrip_and_immutable_completion(tmp_path):
    cp = SplitCheckpoint(tmp_path / "train", {"dataset": "x"}, 1)
    cp.publish(0, ARRAYS, SCHEMA)
    np.testing.assert_array_equal(cp.load(0, SCHEMA)["resid"], ARRAYS["resid"])
    with pytest.raises(ValueError, match="immutable"):
        cp.publish(0, ARRAYS, SCHEMA)


@pytest.mark.parametrize(
    "identity", [{"dataset": "y"}, {"dataset": "x", "chunk_size": 2}]
)
def test_identity_drift_fails_before_any_write(tmp_path, identity):
    cp = SplitCheckpoint(tmp_path, {"dataset": "x"}, 1)
    before = cp.contract.read_bytes()
    with pytest.raises(ValueError, match="identity changed"):
        SplitCheckpoint(tmp_path, identity, 1)
    assert cp.contract.read_bytes() == before


@pytest.mark.parametrize(
    "corruption", ["bytes", "missing_data", "receipt_identity", "schema"]
)
def test_completed_chunk_corruption_fails(tmp_path, corruption):
    cp = SplitCheckpoint(tmp_path, {}, 1)
    cp.publish(0, ARRAYS, SCHEMA)
    data, receipt = cp._paths(0)
    if corruption == "bytes":
        data.write_bytes(b"broken")
    elif corruption == "missing_data":
        data.unlink()
    else:
        value = json.loads(receipt.read_text())
        value["identity_sha256" if corruption == "receipt_identity" else "schema"] = (
            "wrong"
        )
        receipt.write_text(json.dumps(value))
    with pytest.raises(ValueError, match="Corrupt"):
        cp.load(0, SCHEMA)


def test_orphan_after_crash_recomputed(tmp_path):
    cp = SplitCheckpoint(tmp_path, {}, 1)
    data, _ = cp._paths(0)
    data.write_bytes(b"partial npz")
    assert cp.load(0, SCHEMA) is None
    cp.publish(0, ARRAYS, SCHEMA)
    assert cp.load(0, SCHEMA) is not None


@pytest.mark.parametrize(
    "value",
    [
        np.zeros((1, 1, 2), dtype=np.float32),
        np.zeros((2, 1, 2), dtype=np.float64),
        np.full((2, 1, 2), np.nan, dtype=np.float32),
    ],
)
def test_bad_array_rejected_before_publication(tmp_path, value):
    cp = SplitCheckpoint(tmp_path, {}, 1)
    with pytest.raises(ValueError):
        cp.publish(0, {"resid": value}, SCHEMA)
    assert not cp._paths(0)[1].exists()


def test_nll_sentinel_only_when_explicitly_disabled(tmp_path):
    cp = SplitCheckpoint(tmp_path, {}, 1)
    arrays = {"nll": np.full(2, np.nan, dtype=np.float32)}
    schema = {"nll": {"shape": [2], "dtype": "float32", "all_nan": True}}
    cp.publish(0, arrays, schema)
    assert cp.load(0, schema) is not None
    with pytest.raises(ValueError):
        cp.validate({"nll": np.zeros(2, dtype=np.float32)}, schema)


def test_legacy_output_is_not_adopted(tmp_path):
    (tmp_path / "meta.jsonl").write_text("old")
    with pytest.raises(ValueError, match="Legacy"):
        SplitCheckpoint(tmp_path, {}, 1)


def test_atomic_write_failure_keeps_previous_file(tmp_path):
    path = tmp_path / "value"
    path.write_bytes(b"old")

    def crash(fh):
        fh.write(b"partial")
        raise RuntimeError("injected write failure")

    with pytest.raises(RuntimeError):
        atomic_write(path, crash)
    assert path.read_bytes() == b"old"
    assert not list(tmp_path.glob("*.partial"))


def test_completion_marker_and_output_tamper(tmp_path):
    cp = SplitCheckpoint(tmp_path, {}, 1)
    meta = tmp_path / "meta.jsonl"
    meta.write_text("one")
    with pytest.raises(ValueError, match="incomplete"):
        verify_completed(tmp_path)
    cp.mark_complete([meta])
    verify_completed(tmp_path)
    meta.write_text("changed")
    with pytest.raises(ValueError, match="corrupt"):
        verify_completed(tmp_path)
    cp.invalidate_completion()
    assert not (tmp_path / "complete.json").exists()


def test_lock_contention_and_release_on_process_death(tmp_path):
    env = {**os.environ, "PYTHONPATH": str(LIB)}
    code = "from latentlens.checkpoint import output_lock; import sys;\nwith output_lock(sys.argv[1]): print('locked', flush=True); sys.stdin.read()"
    child = subprocess.Popen(
        [sys.executable, "-c", code, str(tmp_path)],
        env=env,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        assert child.stdout.readline().strip() == "locked"
        with pytest.raises(ValueError, match="Another extractor"), output_lock(tmp_path):
            pass
    finally:
        child.kill()
        child.communicate(timeout=10)
    with output_lock(tmp_path):
        pass


def test_new_reader_rejects_incomplete_split(tmp_path):
    from latentlens.reps import load_run

    SplitCheckpoint(tmp_path / "train", {}, 1)
    (tmp_path / "run.json").write_text(
        json.dumps({"checkpoint_schema": 1, "splits": {"train": {}}})
    )
    with pytest.raises(ValueError, match="incomplete"):
        load_run(tmp_path)
