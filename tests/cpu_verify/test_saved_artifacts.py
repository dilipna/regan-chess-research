import copy
import hashlib
import json
import math
import subprocess
import sys

import numpy as np
import pytest

from scripts.verify_cpu_artifacts import (
    ROOT,
    calculate,
    close,
    require_pending,
    validate_rows,
    verify,
)


def fixture_rows():
    rows = []
    for game, plies in [("a", [16]), ("b", [16, 17, 18]), ("c", [16])]:
        for ply in plies:
            side = "white" if ply % 2 == 0 else "black"
            for model, p, rank in [("Maia-3 79M", 0.6, 1), ("Maia-3 5M", 0.3, 2)]:
                rows.append(
                    {
                        "model": model,
                        "source_game_id": game,
                        "ply": ply,
                        "split": "test",
                        "side_to_move": side,
                        "variant_id": f"{game}:{side}:none:0",
                        "prob_played": p,
                        "logprob_played": math.log(p),
                        "rank_played": rank,
                        "candidate_count": 20,
                        "fen": f"fixture-{game}-{ply}",
                        "played_move_uci": "a2a3",
                        "player_elo": 1500,
                        "opponent_elo": 1500,
                    }
                )
    return rows


def test_metric_arithmetic_and_shared_cluster_resamples():
    result = calculate(fixture_rows(), seed=7, n_boot=100)
    assert result["positions"] == 5 and result["source_games"] == 3
    assert result["models"]["M"]["top1_accuracy"]["value"] == 1
    assert result["models"]["M5"]["top1_accuracy"]["value"] == 0
    assert result["models"]["M"]["mean_rank"]["value"] == 1
    assert result["paired"]["top1_accuracy"]["delta"] == 1
    np.testing.assert_allclose(
        result["paired"]["mean_nll"]["ci95"], [math.log(0.5)] * 2
    )


def test_unequal_source_games_use_decision_weighted_means_and_cluster_draws():
    rows = fixture_rows()
    for row in rows:
        if row["model"] == "Maia-3 79M":
            row["rank_played"] = 1 if row["source_game_id"] == "a" else 4
    result = calculate(rows, seed=3, n_boot=100)
    assert result["models"]["M"]["top1_accuracy"]["value"] == 0.2
    samples = []
    for pick in np.random.default_rng(3).integers(0, 3, size=(100, 3)):
        values = []
        for game in pick:
            values.extend({0: [1], 1: [0, 0, 0], 2: [0]}[game])
        samples.append(np.mean(values))
    np.testing.assert_allclose(
        result["models"]["M"]["top1_accuracy"]["ci95"],
        np.percentile(samples, [2.5, 97.5]),
    )


@pytest.mark.parametrize(
    "defect",
    [
        "duplicate",
        "missing-pair",
        "split",
        "variant",
        "probability",
        "nan",
        "logprob",
        "rank",
        "metadata",
        "model",
    ],
)
def test_invalid_or_unpaired_evidence_rejected(defect):
    rows = fixture_rows()
    if defect == "duplicate":
        rows.append(copy.deepcopy(rows[0]))
    elif defect == "missing-pair":
        rows.pop()
    elif defect == "split":
        rows[0]["split"] = "train"
    elif defect == "variant":
        rows[0]["variant_id"] = "assisted"
    elif defect == "probability":
        rows[0]["prob_played"] = 2
    elif defect == "nan":
        rows[0]["prob_played"] = float("nan")
    elif defect == "logprob":
        rows[0]["logprob_played"] = -100
    elif defect == "rank":
        rows[0]["rank_played"] = 21
    elif defect == "metadata":
        rows[1]["fen"] = "different-position"
    else:
        rows[0]["model"] = "Qwen"
    with pytest.raises(ValueError):
        validate_rows(rows)


def test_missing_evidence_is_a_failure_not_a_skip(tmp_path):
    (tmp_path / "experiments").mkdir()
    (tmp_path / "experiments/cpu_verification_manifest.json").write_text(
        json.dumps({"expected_files": {"missing.parquet": "x"}})
    )
    with pytest.raises(ValueError, match="missing"):
        verify(tmp_path)
    command = [
        sys.executable,
        str(ROOT / "scripts/verify_cpu_artifacts.py"),
        "--root",
        str(tmp_path),
        "--output",
        str(tmp_path / "report.json"),
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    assert result.returncode == 1 and "FAIL" in result.stderr
    assert not (tmp_path / "report.json").exists()


def test_hash_drift_fails_before_reading_modified_input(tmp_path):
    (tmp_path / "experiments").mkdir()
    (tmp_path / "source").write_bytes(b"changed")
    (tmp_path / "experiments/cpu_verification_manifest.json").write_text(
        json.dumps(
            {"expected_files": {"source": hashlib.sha256(b"original").hexdigest()}}
        )
    )
    with pytest.raises(ValueError, match="hash mismatch"):
        verify(tmp_path)


def test_numeric_reference_drift_and_pending_result_fabrication_rejected():
    with pytest.raises(ValueError, match="Reference mismatch"):
        close(1, 1.00001, 1e-10, "fixture")
    models = {
        "Q": {"status": "pending", "metrics": {"accuracy": None}},
        "Q0": {"status": "pending", "metrics": {"accuracy": None}},
    }
    require_pending(models)
    models["Q"]["metrics"]["accuracy"] = 0.99
    with pytest.raises(ValueError, match="pending/null"):
        require_pending(models)


def test_cannot_overwrite_source_artifacts(tmp_path):
    target = ROOT / "data/artifacts/three_model_move_prediction.json"
    before = target.read_bytes()
    result = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts/verify_cpu_artifacts.py"),
            "--output",
            str(target),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode != 0
    assert target.read_bytes() == before


def test_committed_artifacts_reproduce_selected_table_and_paired_intervals():
    result = verify(ROOT)
    assert result["status"] == "PASS"
    assert (
        result["positions"] == 12863
        and result["source_games"] == 321
        and result["player_games"] == 605
    )
    assert result["actual_split_disjointness_verified"] is False
    assert result["qwen_held_out_status"].startswith("pending")
