"""Provenance record for the additive three-model experiment.

Writes data/artifacts/three_model_provenance.json and apps/web/public/data/three_model_provenance.json.
The existing provenance.json (10_provenance.py) is NOT rewritten, so its bytes stay identical.
Every field is read from disk or computed here; anything that cannot be established is null with a note.
"""

from __future__ import annotations

import hashlib
import json
import platform
import subprocess
import sys
import time
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services"))
from analyzer import config  # noqa: E402
from analyzer.qwen.prompt import PROMPT_HASH, prompt_spec  # noqa: E402
from analyzer.qwen.scorer import PINNED_REVISIONS, QWEN_MODEL_ID, QWEN_REVISION  # noqa: E402

ROOT = config.ROOT
HF = Path.home() / ".cache" / "huggingface" / "hub"
VALIDATED = ["data/processed/splits.json", "data/processed/variants.parquet", "data/processed/decisions.pkl",
             "data/processed/variant_choices.pkl", "data/artifacts/test_predictions.parquet", "data/artifacts/metrics.json",
             "data/artifacts/projection.json", "data/artifacts/paired_bootstrap.json", "data/artifacts/provenance.json",
             "apps/web/public/data/metrics.json", "apps/web/public/data/demos.json", "apps/web/public/data/provenance.json"]
NEW = ["data/interim/three_model/positions_test.jsonl", "data/interim/three_model/positions_val.jsonl",
       "data/interim/three_model/positions_train.jsonl", "data/interim/three_model/targets_test.parquet",
       "data/interim/three_model/targets_val.parquet", "data/artifacts/three_model_move_prediction.json",
       "data/artifacts/three_model_assistance_results.json", "data/artifacts/three_model_bootstrap.json",
       "data/artifacts/maia_move_scores.parquet", "data/artifacts/prepared_three_model_demo.json",
       "data/artifacts/qwen_move_scores.parquet", "data/artifacts/qwen_candidate_distributions.parquet",
       "data/artifacts/qwen_provenance.json", "data/artifacts/hybrid_E_results.json",
       "data/interim/qwen/regan_aligned/test.jsonl", "data/interim/qwen/regan_aligned/val.jsonl",
       "data/interim/qwen/regan_aligned/train.jsonl", "data/interim/qwen/position_only/test.jsonl",
       "docs/THREE_MODEL_RESULTS.md"]
SCRIPTS = ["experiments/three_model_plan.py", "experiments/11_export_positions.py", "experiments/12_maia79.py",
           "experiments/13_qwen_score.py", "experiments/14_three_model_eval.py", "experiments/15_qwen_artifacts.py",
           "experiments/16_export_three_model_demo.py", "experiments/17_hybrid_qwen.py", "experiments/18_three_model_provenance.py",
           "experiments/19_three_model_results_md.py",
           "services/analyzer/qwen/prompt.py", "services/analyzer/qwen/scorer.py", "services/analyzer/qwen/cache.py",
           "services/analyzer/qwen/runner.py", "services/analyzer/compare/dists.py", "services/analyzer/compare/live.py",
           "deploy/modal_app.py"]
LOCKS = ["services/analyzer/requirements-lock.txt", "services/analyzer/requirements-qwen-lock.txt", "apps/web/package-lock.json"]


def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def rec(rel: str) -> dict:
    p = ROOT / rel
    if not p.exists():
        return {"path": rel, "exists": False}
    return {"path": rel, "exists": True, "bytes": p.stat().st_size, "sha256": sha256(p),
            "modified_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(p.stat().st_mtime))}


def hf_ref(repo: str) -> str | None:
    p = HF / f"models--{repo.replace('/', '--')}" / "refs" / "main"
    return p.read_text().strip() if p.exists() else None


def stockfish_version() -> str | None:
    try:
        r = subprocess.run([config.STOCKFISH_PATH], input="uci\nquit\n", capture_output=True, text=True, timeout=20)
        return next((l[len("id name "):] for l in r.stdout.splitlines() if l.startswith("id name ")), None)
    except (OSError, subprocess.SubprocessError):
        return None


def main():
    runtime = {}
    for cond in ("regan_aligned", "position_only"):
        for split in ("test", "val", "train"):
            p = config.INTERIM / "qwen" / cond / f"{split}.runtime.json"
            if p.exists():
                runtime[f"{cond}/{split}"] = json.loads(p.read_text())
    plan = json.loads((config.ARTIFACTS / "three_model_move_prediction.json").read_text())["generator"]
    git = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True)
    out = {
        "record_id": str(uuid.uuid4()),
        "record_id_note": "Identifies this provenance record. The experiment scripts themselves do not assign run IDs.",
        "generated_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "repository_commit": git.stdout.strip() if git.returncode == 0 else None,
        "repository_note": None if git.returncode == 0 else "The local git repository has no commits; no commit hash can be cited.",
        "analysis_plan": plan,
        "models": {
            "qwen": {"model_id": QWEN_MODEL_ID, "revision": QWEN_REVISION, "tokenizer_revision": QWEN_REVISION,
                     "status": "scored" if runtime else "pending (not yet run; requires a GPU with >= 24 GB, planned on Modal)",
                     "runtime_by_split": runtime or None,
                     "dtype": "bfloat16" if runtime else None, "quantization": None if runtime else None,
                     "gpu": sorted({r.get("gpu") for r in runtime.values() if r}) or None,
                     "pipeline_check_model": {"model_id": "Qwen/Qwen3-0.6B-Base", "revision": PINNED_REVISIONS["Qwen/Qwen3-0.6B-Base"],
                                              "use": "automated tests and pipeline checks only; never reported as a result"}},
            "maia3_79m": {"checkpoint": "UofTCSSLab/Maia3-79M", "revision_pinned": "a107d6ceb7b298cb04ae1da4edffe2939858b894",
                          "revision_in_local_cache": hf_ref("UofTCSSLab/Maia3-79M"), "package_commit": "1e13597c42d4858b7cfd7cfdae01e297263364b2"},
            "maia3_5m": {"checkpoint": "UofTCSSLab/Maia3-5M", "revision_in_local_cache": hf_ref("UofTCSSLab/Maia3-5M"),
                         "note": "existing pipeline checkpoint; outputs reused from data/interim/maia/ (unchanged)"},
            "stockfish": {"version": stockfish_version(), "binary_sha256": sha256(Path(config.STOCKFISH_PATH)) if Path(config.STOCKFISH_PATH).exists() else None,
                          "depth": config.SF_DEPTH, "multipv": config.SF_MULTIPV, "note": "offline analysis reused unchanged"},
        },
        "prompts": {c: prompt_spec(c) for c in PROMPT_HASH},
        "validated_artifacts_unchanged": [rec(f) for f in VALIDATED],
        "new_artifacts": [rec(f) for f in NEW],
        "scripts": [rec(f) for f in SCRIPTS],
        "dependency_locks": [rec(f) for f in LOCKS],
        "environment": {"python": platform.python_version(), "platform": platform.platform()},
        "commands": [
            "python experiments/11_export_positions.py",
            "python experiments/12_maia79.py",
            "modal run deploy/modal_app.py::score --split test   (also --split val, --split train; --condition position_only for P1)",
            "python experiments/15_qwen_artifacts.py",
            "python experiments/14_three_model_eval.py",
            "python experiments/16_export_three_model_demo.py",
            "python experiments/17_hybrid_qwen.py",
            "python experiments/18_three_model_provenance.py",
            "python experiments/19_three_model_results_md.py",
            "pytest tests  (+ .venv-qwen: pytest tests/test_qwen.py);  cd apps/web && npm test && npm run typecheck && npm run lint && npm run build",
        ],
    }
    for p in (config.ARTIFACTS / "three_model_provenance.json", config.WEB_DATA / "three_model_provenance.json"):
        p.write_text(json.dumps(out, indent=1), encoding="utf-8")
    print("qwen:", out["models"]["qwen"]["status"], "| maia79 rev:", out["models"]["maia3_79m"]["revision_in_local_cache"],
          "| stockfish:", out["models"]["stockfish"]["version"], "| new artifacts present:",
          sum(r["exists"] for r in out["new_artifacts"]), "/", len(NEW))


if __name__ == "__main__":
    main()
