"""Verify explicitly supplied saved predictions; never regenerate model outputs."""

import argparse
import json
import platform
import subprocess
import sys
from pathlib import Path

import numpy as np
import pyarrow
import pyarrow.parquet as pq

try:
    from scripts.verify_cpu_artifacts import close, sha
except ModuleNotFoundError:
    from verify_cpu_artifacts import close, sha

ROOT = Path(__file__).resolve().parents[1]
SCORES = {
    "A0_zt1": "z_t1",
    "A_stat": "score_A_stat",
    "B_sf": "score_B_sf",
    "C_sf_maia": "score_C_sf_maia",
    "D_sf_maia_seq": "score_D_sf_maia_seq",
}


def weighted_auc(y, ties, weights):
    """Weighted positive/negative pair ordering, half credit for ties."""
    y, ties, weights = np.asarray(y), np.asarray(ties), np.asarray(weights)
    if (
        y.ndim != 1
        or y.shape != ties.shape
        or y.shape != weights.shape
        or not np.isin(y, [0, 1]).all()
        or not np.isfinite(weights).all()
        or (weights < 0).any()
    ):
        raise ValueError("Invalid AUC labels or weights")
    pos = np.bincount(ties, weights=weights * y)
    neg = np.bincount(ties, weights=weights * (1 - y))
    if pos.sum() <= 0 or neg.sum() <= 0:
        raise ValueError("AUC requires both classes")
    return float(np.sum(pos * (np.cumsum(neg) - 0.5 * neg)) / (pos.sum() * neg.sum()))


def validate_splits(variants, predictions, splits):
    by_id, players, games = {}, {}, {}
    for row in variants:
        key, game, split = row["variant_id"], row["game_id"], row["split"]
        player = row["player"].strip().casefold()
        if (
            not key
            or key in by_id
            or not player
            or split not in ("train", "val", "test")
            or splits.get(game) != split
            or row["label"] != int(row["level"] > 0)
        ):
            raise ValueError("Invalid variant identity, split or label")
        for mapping, identity in ((players, player), (games, game)):
            if identity in mapping and mapping[identity] != split:
                raise ValueError("Recorded player or game crosses splits")
            mapping[identity] = split
        by_id[key] = row
    expected = {k for k, row in by_id.items() if row["split"] == "test"}
    seen = set()
    for row in predictions:
        key = row["variant_id"]
        if key in seen or key not in expected:
            raise ValueError("Duplicate or unexpected held-out prediction")
        seen.add(key)
        if any(
            row[k] != by_id[key][k]
            for k in ("game_id", "split", "label", "player", "level")
        ):
            raise ValueError("Prediction metadata differs from test variant")
    if seen != expected:
        raise ValueError("Missing held-out prediction")
    return {
        "variants": len(by_id),
        "recorded_players": len(players),
        "source_games": len(games),
    }


def calculate(predictions, reference):
    y = np.asarray([r["label"] for r in predictions])
    games = list(dict.fromkeys(r["game_id"] for r in predictions))
    game_index = {g: i for i, g in enumerate(games)}
    gi = np.asarray([game_index[r["game_id"]] for r in predictions])
    counts = {
        "n_clusters": len(games),
        "n_rows": len(y),
        "n_positive_rows": int(y.sum()),
        "n_player_games": len({(r["game_id"], r["color"]) for r in predictions}),
    }
    if any(counts[k] != reference[k] for k in counts):
        raise ValueError("Held-out counts differ from reference")
    ties = {}
    for model, column in SCORES.items():
        values = np.asarray([r[column] for r in predictions], dtype=float)
        if not np.isfinite(values).all():
            raise ValueError("Nonfinite saved score")
        ties[model] = np.unique(values, return_inverse=True)[1]
    points = {k: weighted_auc(y, t, np.ones(len(y))) for k, t in ties.items()}
    boot = {k: np.empty(reference["n_boot"]) for k in SCORES}
    rng = np.random.default_rng(reference["seed"])
    for b in range(reference["n_boot"]):
        pick = rng.choice(games, len(games), replace=True)
        multiplicity = np.bincount([game_index[g] for g in pick], minlength=len(games))
        for k, t in ties.items():
            boot[k][b] = weighted_auc(y, t, multiplicity[gi])
    comparisons = []
    for pair in reference["comparisons"]:
        a, b = pair["from"], pair["to"]
        delta = boot[b] - boot[a]
        comparisons.append(
            {
                "from": a,
                "to": b,
                "delta": points[b] - points[a],
                "ci95": np.percentile(delta, [2.5, 97.5]).tolist(),
                "share_le_0": float((delta <= 0).mean()),
            }
        )
    return {
        **counts,
        "auc": points,
        "comparisons": comparisons,
        "bootstrap": {
            "seed": reference["seed"],
            "n_boot": reference["n_boot"],
            "cluster": "source game",
            "order": "first appearance",
        },
    }


def verify(root, evidence):
    contract_path = root / "experiments/full_cpu_verification_manifest.json"
    contract = json.loads(contract_path.read_text())
    hashes = {}
    for directory, section in ((evidence, "evidence_files"), (root, "reference_files")):
        for name, expected in contract[section].items():
            path = directory / name
            if not path.is_file() or sha(path) != expected:
                raise ValueError(f"Missing or altered frozen input: {name}")
            hashes[name] = expected
    reference = json.loads((root / "data/artifacts/paired_bootstrap.json").read_text())
    metrics = json.loads((root / "data/artifacts/metrics.json").read_text())
    variants = pq.read_table(evidence / "variants.parquet").to_pylist()
    predictions = pq.read_table(evidence / "test_predictions.parquet").to_pylist()
    splits = json.loads((evidence / "splits.json").read_text())
    split_counts = validate_splits(variants, predictions, splits)
    result = calculate(predictions, reference)
    tolerance = contract["absolute_tolerance"]
    for model, point in result["auc"].items():
        close(point, reference["reproduced_auc"][model], tolerance, model)
        close(
            point,
            metrics["experiments"][model]["classifier"]["roc_auc"],
            tolerance,
            model,
        )
    for actual, expected in zip(result["comparisons"], reference["comparisons"]):
        for key in ("delta", "ci95"):
            close(
                actual[key],
                expected[key],
                tolerance,
                f"{actual['from']}->{actual['to']}/{key}",
            )
    result.update(
        {
            "status": "PASS",
            "scope": contract["scope"],
            "split_counts": split_counts,
            "recorded_player_and_game_disjointness_verified": True,
            "inputs_sha256": hashes,
            "absolute_tolerance": tolerance,
            "contract_sha256": sha(contract_path),
            "verifier_sha256": sha(Path(__file__)),
            "source_commit": subprocess.check_output(
                ["git", "rev-parse", "HEAD"], cwd=root, text=True
            ).strip(),
            "runtime": {
                "python": platform.python_version(),
                "numpy": np.__version__,
                "pyarrow": pyarrow.__version__,
            },
            "not_verified": [
                "Real human identity or collection integrity",
                "Original model inference or legal-policy normalization",
                "Qwen held-out results (pending)",
                "Scientific or production cheating-detection validity",
            ],
        }
    )
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    output, evidence = args.output.resolve(), args.evidence_dir.resolve()
    if (
        output.suffix != ".json"
        or output.is_relative_to(evidence)
        or any(
            output.is_relative_to(ROOT / p)
            for p in ("data", "apps", "experiments", "scripts", "tests")
        )
    ):
        parser.error("Write a separate JSON report outside input and source paths")
    try:
        result = verify(ROOT, evidence)
    except (ValueError, KeyError, OSError, TypeError) as exc:
        print(json.dumps({"status": "FAIL", "error": str(exc)}), file=sys.stderr)
        return 1
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8"
    )
    print(json.dumps(result, indent=2, allow_nan=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
