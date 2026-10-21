"""Recompute four saved Maia metrics and paired source-game intervals on CPU.

No model inference, torch, Stockfish, private cache, source writes or skipped
missing-evidence checks. This does not establish actual split disjointness.
"""

import argparse
import hashlib
import json
import math
import platform
import runpy
import subprocess
import sys
from pathlib import Path

import numpy as np
import pyarrow
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[1]
MODELS = {"M": "Maia-3 79M", "M5": "Maia-3 5M"}
METRICS = ("top1_accuracy", "top3_accuracy", "mean_nll", "mean_rank")


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_rows(rows):
    by_model = {key: {} for key in MODELS}
    reverse = {value: key for key, value in MODELS.items()}
    for row in rows:
        if row["model"] not in reverse or row["split"] != "test":
            raise ValueError("Unexpected model or declared split")
        model = reverse[row["model"]]
        game, ply = row["source_game_id"], row["ply"]
        key = (game, ply)
        if not game or type(ply) is not int or key in by_model[model]:
            raise ValueError("Missing or duplicate source-game/ply identity")
        side = row["side_to_move"]
        if (
            side not in ("white", "black")
            or row["variant_id"] != f"{game}:{side}:none:0"
        ):
            raise ValueError("Expected an original player-game variant")
        p, lp = row["prob_played"], row["logprob_played"]
        rank, count = row["rank_played"], row["candidate_count"]
        if (
            not math.isfinite(p)
            or not 0 <= p <= 1
            or not math.isfinite(lp)
            or not math.isclose(lp, math.log(max(p, 1e-6)), rel_tol=0, abs_tol=1e-12)
        ):
            raise ValueError("Invalid or inconsistent probability/log probability")
        if (
            type(rank) is not int
            or type(count) is not int
            or count < 2
            or not 1 <= rank <= count
        ):
            raise ValueError("Invalid rank/candidate count")
        if not row["fen"] or not row["played_move_uci"]:
            raise ValueError("Missing position metadata")
        by_model[model][key] = row
    if not by_model["M"] or set(by_model["M"]) != set(by_model["M5"]):
        raise ValueError("Exact paired position sets required")
    keys = sorted(by_model["M"])
    for key in keys:
        for field in (
            "fen",
            "played_move_uci",
            "candidate_count",
            "side_to_move",
            "variant_id",
            "player_elo",
            "opponent_elo",
        ):
            if by_model["M"][key][field] != by_model["M5"][key][field]:
                raise ValueError(f"Paired position metadata mismatch: {field}")
    return keys, by_model


def calculate(rows, *, seed, n_boot):
    keys, by_model = validate_rows(rows)
    games = sorted({game for game, _ in keys})
    game_index = {game: i for i, game in enumerate(games)}
    gi = np.asarray([game_index[game] for game, _ in keys])
    picks = np.random.default_rng(seed).integers(
        0, len(games), size=(n_boot, len(games))
    )
    weights = np.stack([np.bincount(p, minlength=len(games)) for p in picks]).astype(
        float
    )
    counts = np.bincount(gi, minlength=len(games)).astype(float)
    denominator = weights @ counts
    models, boot = {}, {}
    for model in MODELS:
        aligned = [by_model[model][key] for key in keys]
        values = np.asarray(
            [
                [
                    float(r["rank_played"] == 1),
                    float(r["rank_played"] <= 3),
                    -r["logprob_played"],
                    float(r["rank_played"]),
                ]
                for r in aligned
            ]
        )
        sums = np.column_stack(
            [
                np.bincount(gi, weights=values[:, j], minlength=len(games))
                for j in range(len(METRICS))
            ]
        )
        boot[model] = (weights @ sums) / denominator[:, None]
        bounds = np.percentile(boot[model], [2.5, 97.5], axis=0)
        models[model] = {
            metric: {"value": float(values[:, j].mean()), "ci95": bounds[:, j].tolist()}
            for j, metric in enumerate(METRICS)
        }
    delta = boot["M"] - boot["M5"]
    bounds = np.percentile(delta, [2.5, 97.5], axis=0)
    paired = {
        metric: {
            "from": "M5",
            "to": "M",
            "delta": models["M"][metric]["value"] - models["M5"][metric]["value"],
            "ci95": bounds[:, j].tolist(),
        }
        for j, metric in enumerate(METRICS)
    }
    players = {(r["source_game_id"], r["side_to_move"]) for r in by_model["M"].values()}
    return {
        "positions": len(keys),
        "source_games": len(games),
        "player_games": len(players),
        "models": models,
        "paired": paired,
        "bootstrap": {"seed": seed, "n_boot": n_boot, "cluster": "source game"},
    }


def close(actual, expected, tolerance, label):
    if not np.allclose(actual, expected, rtol=0, atol=tolerance):
        raise ValueError(
            f"Reference mismatch: {label}: recomputed {actual}, stored {expected}"
        )


def require_pending(models):
    for model in ("Q", "Q0"):
        result = models[model]
        if result["status"] != "pending" or any(
            value is not None for value in result["metrics"].values()
        ):
            raise ValueError(
                "This frozen artifact set requires Qwen held-out results to stay pending/null"
            )


def verify(root):
    contract_path = root / "experiments/cpu_verification_manifest.json"
    contract = json.loads(contract_path.read_text())
    inputs = {}
    for name, expected in contract["expected_files"].items():
        path = root / name
        if not path.is_file():
            raise ValueError(f"Required evidence missing: {name}")
        inputs[name] = sha(path)
        if inputs[name] != expected:
            raise ValueError(f"Frozen artifact hash mismatch: {name}")
    reference = json.loads(
        (root / "data/artifacts/three_model_move_prediction.json").read_text()
    )
    paired_reference = json.loads(
        (root / "data/artifacts/three_model_bootstrap.json").read_text()
    )
    plan = runpy.run_path(str(root / "experiments/three_model_plan.py"))["PLAN"]
    plan_hash = hashlib.sha256(json.dumps(plan, sort_keys=True).encode()).hexdigest()
    if (
        reference["generator"]["plan_sha256"] != plan_hash
        or paired_reference["generator"]["plan_sha256"] != plan_hash
    ):
        raise ValueError("Analysis-plan identity mismatch")
    require_pending(reference["models"])
    bootstrap = plan["bootstrap"]
    if (
        reference["bootstrap"]["seed"] != bootstrap["seed"]
        or reference["bootstrap"]["n_boot"] != bootstrap["n_boot"]
    ):
        raise ValueError("Stored bootstrap does not match the frozen plan")
    rows = pq.read_table(root / "data/artifacts/maia_move_scores.parquet").to_pylist()
    result = calculate(rows, seed=bootstrap["seed"], n_boot=bootstrap["n_boot"])
    for key in ("positions", "source_games", "player_games"):
        if result[key] != reference["data"][key]:
            raise ValueError(f"Declared data count mismatch: {key}")
    tolerance = contract["absolute_tolerance"]
    for model in MODELS:
        if reference["models"][model]["status"] != "ok":
            raise ValueError("Missing completed Maia reference")
        for metric in METRICS:
            value = result["models"][model][metric]
            close(
                value["value"],
                reference["models"][model]["metrics"][metric],
                tolerance,
                f"{model}/{metric}",
            )
            close(
                value["ci95"],
                reference["models"][model]["ci95"][metric],
                tolerance,
                f"{model}/{metric}/CI",
            )
    for metric in METRICS:
        matches = [
            r
            for r in paired_reference["comparisons"]
            if r["task"] == "task1"
            and r["from"] == "M5"
            and r["to"] == "M"
            and r["metric"] == metric
            and r.get("status") == "ok"
        ]
        if len(matches) != 1:
            raise ValueError(f"Expected one completed paired reference: {metric}")
        close(
            result["paired"][metric]["delta"],
            matches[0]["delta"],
            tolerance,
            f"paired/{metric}",
        )
        close(
            result["paired"][metric]["ci95"],
            matches[0]["ci95"],
            tolerance,
            f"paired/{metric}/CI",
        )
    result.update(
        {
            "status": "PASS",
            "scope": contract["scope"],
            "inputs_sha256": inputs,
            "analysis_plan_sha256": plan_hash,
            "absolute_tolerance": tolerance,
            "cpu_contract_sha256": sha(contract_path),
            "verifier_sha256": sha(Path(__file__)),
            "runtime": {
                "python": platform.python_version(),
                "numpy": np.__version__,
                "pyarrow": pyarrow.__version__,
            },
            "qwen_held_out_status": "pending; no inference or imputation",
            "actual_split_disjointness_verified": False,
            "not_reproduced": [
                "Original Maia inference or legal-set normalization",
                "Actual train/validation/test player disjointness: split inputs absent",
                "Full multiclass Brier, engine-event metrics, Task-2/hybrid results: required policy/target/prediction artifacts absent",
                "Stockfish regeneration or Qwen held-out evaluation",
            ],
        }
    )
    try:
        result["source_commit"] = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=root, text=True
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        result["source_commit"] = None
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root, output = args.root.resolve(), args.output.resolve()
    if (
        output.suffix != ".json"
        or output.is_relative_to(root / "data")
        or output.is_relative_to(root / "apps")
        or output == root / "experiments/cpu_verification_manifest.json"
    ):
        parser.error(
            "Write a separate .json report outside source data/web/contract paths"
        )
    try:
        result = verify(root)
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
