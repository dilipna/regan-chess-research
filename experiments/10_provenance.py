"""Write a provenance record for the exported results (no model is run, nothing is recomputed except checks).

Every field is either read from disk / git or computed by a consistency check in this script. Fields
that cannot be established (e.g. a git commit when the repository has none) are written as null with
a note, never filled in.

Outputs: data/artifacts/provenance.json and apps/web/public/data/provenance.json
"""

from __future__ import annotations

import collections
import hashlib
import json
import platform
import re
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services"))
from analyzer import config  # noqa: E402

ROOT = config.ROOT
RAW = config.RAW / "lichess_2026-08_head.pgn.zst"
SOURCE_URL = "https://database.lichess.org/standard/lichess_db_standard_rated_2026-08.pgn.zst"
BYTE_RANGE = (0, 419430399)
LOCKFILE = ROOT / "services" / "analyzer" / "requirements-lock.txt"
HF_REF = Path.home() / ".cache" / "huggingface" / "hub" / "models--UofTCSSLab--Maia3-5M" / "refs" / "main"
FILES = [
    "data/raw/lichess_2026-08_head.pgn.zst", "data/interim/games.jsonl", "data/processed/splits.json",
    "data/processed/variants.parquet", "data/artifacts/projection.json", "data/artifacts/model_A_stat.pkl",
    "data/artifacts/model_B_sf.pkl", "data/artifacts/model_C_sf_maia.pkl", "data/artifacts/model_D_sf_maia_seq.pkl",
    "data/artifacts/decision_model.pkl", "data/artifacts/test_predictions.parquet", "data/artifacts/metrics.json",
    "data/artifacts/paired_bootstrap.json", "apps/web/public/data/metrics.json", "apps/web/public/data/demos.json",
    "apps/web/public/data/simulator.json", "apps/web/public/data/roc_curves.json",
    "services/analyzer/requirements.txt", "services/analyzer/requirements-lock.txt", "apps/web/package-lock.json",
]
COMMANDS = [
    "curl -r 0-419430399 -o data/raw/lichess_2026-08_head.pgn.zst " + SOURCE_URL,
    "python experiments/01_select_games.py --per-band 600 --max-bytes 4000000000",
    "python experiments/02_stockfish.py --workers 16",
    "python experiments/03_maia.py",
    "python experiments/04_build_dataset.py",
    "python experiments/05_train_eval.py",
    "python experiments/05b_decision_model.py",
    "python experiments/06_export_web.py",
    "python experiments/07_results_md.py",
    "python experiments/08_figures.py",
    "python experiments/09_paired_bootstrap.py",
    "python experiments/10_provenance.py",
    "pytest tests",
]


def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def utc(ts: float) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ts))


def git(*args: str) -> str | None:
    try:
        r = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, timeout=20)
        return r.stdout.strip() if r.returncode == 0 and r.stdout.strip() else None
    except (OSError, subprocess.SubprocessError):
        return None


def main():
    metrics = json.loads((config.ARTIFACTS / "metrics.json").read_text())
    web = json.loads((config.WEB_DATA / "metrics.json").read_text())
    ds = metrics["dataset"]
    checks = []

    # 1. saved predictions reproduce the exported ROC-AUC values
    te = pd.read_parquet(config.ARTIFACTS / "test_predictions.parquet")
    y = te["label"].to_numpy()
    w = np.where(y == 1, 0.5 / y.sum(), 0.5 / (len(y) - y.sum())) * len(y)
    cols = {"A0_zt1": "z_t1", "A_stat": "score_A_stat", "B_sf": "score_B_sf", "C_sf_maia": "score_C_sf_maia",
            "D_sf_maia_seq": "score_D_sf_maia_seq"}
    worst = max(abs(roc_auc_score(y, te[c], sample_weight=w) - metrics["experiments"][k]["classifier"]["roc_auc"])
                for k, c in cols.items())
    checks.append({"name": "Saved test predictions reproduce exported ROC-AUC", "passed": bool(worst < 1e-9),
                   "detail": f"max |difference| over 5 systems = {worst:.1e}"})

    # 2. the dataset rebuilt on disk matches the features the models were evaluated on
    v = pd.read_parquet(config.PROCESSED / "variants.parquet")
    vt = v[v["split"] == "test"].set_index("variant_id").sort_index()
    tt = te.set_index("variant_id").sort_index()
    feats = web["feature_groups"]["D_sf_maia_seq"] + ["label", "realized_alpha", "level", "n_dec"]
    same_ids = vt.index.equals(tt.index)
    bad = [c for c in feats if not same_ids or not np.array_equal(vt[c].to_numpy(), tt[c].to_numpy())]
    checks.append({"name": "Current variants.parquet equals the evaluated test feature table", "passed": same_ids and not bad,
                   "detail": f"{len(feats)} columns × {len(tt)} test rows compared exactly" + (f"; mismatches: {bad}" if bad else "")})

    # 3. raw file is exactly the documented byte range
    raw_bytes = RAW.stat().st_size if RAW.exists() else None
    expected = BYTE_RANGE[1] - BYTE_RANGE[0] + 1
    checks.append({"name": "Raw dump prefix has the documented size", "passed": raw_bytes == expected,
                   "detail": f"{raw_bytes} bytes on disk; range {BYTE_RANGE[0]}–{BYTE_RANGE[1]} = {expected} bytes"})

    # 4. lockfile key versions match versions recorded at export time
    lock = LOCKFILE.read_text(encoding="utf-8") if LOCKFILE.exists() else ""
    ver = web.get("versions", {})
    pairs = {"xgboost": ver.get("xgboost"), "scikit-learn": ver.get("scikit_learn"), "shap": ver.get("shap"),
             "chess": ver.get("python_chess"), "torch": ver.get("torch")}
    mism = [f"{p} lock≠{want}" for p, want in pairs.items()
            if not re.search(rf"^{re.escape(p)}=={re.escape(str(want))}(\+\S+)?$", lock, re.M)]
    if ver.get("maia3_commit") and ver["maia3_commit"] not in lock:
        mism.append("maia3 commit")
    checks.append({"name": "Lockfile versions match versions recorded in the export", "passed": bool(lock) and not mism,
                   "detail": ", ".join(mism) if mism else "xgboost, scikit-learn, shap, python-chess, torch, maia3 commit"})

    games = [json.loads(line) for line in (config.INTERIM / "games.jsonl").read_text(encoding="utf-8").splitlines()]
    splits = json.loads((config.PROCESSED / "splits.json").read_text())
    commit, remote = git("rev-parse", "HEAD"), git("remote", "get-url", "origin")
    revision = HF_REF.read_text().strip() if HF_REF.exists() else None
    sf_exe = Path(config.STOCKFISH_PATH)

    out = {
        "generated_utc": utc(time.time()),
        "repository": {"url": remote, "commit": commit,
                       "note": None if commit else "The local git repository has no commits and no remote, so no commit hash can be cited for this code."},
        "run_id": {"value": None, "note": "The pipeline does not record a run ID. The file hashes and modification times below identify the artifacts used."},
        "dataset_selection": {
            "source_url": SOURCE_URL, "byte_range": f"{BYTE_RANGE[0]}-{BYTE_RANGE[1]}",
            "raw_file_bytes": raw_bytes, "raw_file_bytes_matches_range": raw_bytes == expected,
            "rules": ["rated standard games; estimated duration base + 40·increment ≥ 480 s",
                      "termination Normal or Time forfeit", "both ratings in [1000, 2700)", "≥ 50 plies",
                      "at most one game per player name", "stratified by mean-rating band (600 per band requested)"],
            "n_games_selected": len(games),
            "games_by_band": dict(sorted(collections.Counter(g.get("band") for g in games).items())),
        },
        "splits": {
            "games_assigned": dict(collections.Counter(splits.values())),
            "source_games_with_player_games": ds["n_source_games"],
            "player_games": ds["n_player_games"],
            "rows_including_originals": ds["n_variants"],
            "injected_variants": {s: ds["n_variants"][s] - ds["n_player_games"][s] for s in ds["n_variants"]},
            "note": ("Games are assigned to splits first; a source game contributes player-games only for players with "
                     "≥ 10 eligible decisions. Each player-game yields 1 original + 15 substituted rows, so rows from the "
                     "same source game are strongly dependent; the effective sample size is closer to the number of source games."),
        },
        "checkpoint": {"maia3_commit": ver.get("maia3_commit"), "maia3_checkpoint": ver.get("maia3_checkpoint"),
                       "revision": revision,
                       "revision_note": "Hugging Face snapshot hash in the local cache used for inference" if revision else "local Hugging Face cache not found; revision not established"},
        "engine": {"name": web.get("analysis", {}).get("engine"),
                   "binary_sha256": sha256(sf_exe) if sf_exe.exists() else None,
                   "note": "SHA-256 of the Windows binary used for offline analysis; the Docker image downloads the official Linux sf_19 release."},
        "environment": {"python": platform.python_version(), "lockfile": str(LOCKFILE.relative_to(ROOT)).replace("\\", "/"),
                        "lockfile_sha256": sha256(LOCKFILE) if LOCKFILE.exists() else None,
                        "note": "pip-freeze snapshot of the research environment; see header of the lockfile."},
        "consistency_checks": checks,
        "files": [{"path": f, "bytes": (ROOT / f).stat().st_size, "sha256": sha256(ROOT / f),
                   "modified_utc": utc((ROOT / f).stat().st_mtime)} for f in FILES if (ROOT / f).exists()],
        "commands": COMMANDS,
        "caveats": [
            "No end-to-end re-run of the pipeline was performed when this record was written; it documents the existing artifacts.",
            "data/processed/* were rebuilt after training (EV-match display addition); check 2 confirms the test features are unchanged.",
            "Training used a CUDA torch wheel for Maia-3; the live analyzer image uses the CPU wheel of the same version.",
        ],
    }
    for p in (config.ARTIFACTS / "provenance.json", config.WEB_DATA / "provenance.json"):
        p.write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    for c in checks:
        print(("PASS " if c["passed"] else "FAIL ") + c["name"] + " — " + c["detail"])
    print("commit:", commit, "| maia revision:", revision, "| games:", len(games))


if __name__ == "__main__":
    main()
