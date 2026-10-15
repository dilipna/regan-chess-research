"""Integrity tests for the additive three-model experiment (skipped if its artifacts are absent)."""

import hashlib
import json

import chess
import pandas as pd
import pytest

from analyzer import config

# SHA-256 of validated artifacts at the start of the three-model work (2026-10-05). They must never change.
FROZEN = {
    "data/processed/splits.json": "b4cb777d5afb82e817ac638c2acee75e5ada2e2b5211bc4c4fb2e82cd01c9f5f",
    "data/processed/variants.parquet": "8baa1b4d0cafcff781d11dbcac1adda43e07758fa0562227c4f59884152797e6",
    "data/artifacts/test_predictions.parquet": "07db35613fb926925ae617519404581698d24f05c237c2685f800a373f5467e9",
    "data/artifacts/metrics.json": "9da1aa1be1f6299c365ef387850258d75df012201cff6467346d755c6609b4b2",
}
TM = config.INTERIM / "three_model"


def _sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


@pytest.mark.parametrize("rel", sorted(FROZEN))
def test_validated_artifacts_unchanged(rel):
    p = config.ROOT / rel
    if not p.exists():
        pytest.skip("artifact not present")
    assert _sha(p) == FROZEN[rel]


def _targets(split):
    p = TM / f"targets_{split}.parquet"
    if not p.exists():
        pytest.skip("positions not exported")
    return pd.read_parquet(p)


def test_positions_respect_source_game_split_and_no_leakage():
    split = json.loads((config.PROCESSED / "splits.json").read_text())
    games = {}
    for s in ("train", "val", "test"):
        t = _targets(s)
        assert set(t["split"]) == {s}
        assert all(split[g] == s for g in t["source_game_id"].unique())
        games[s] = set(t["source_game_id"])
    assert not (games["train"] & games["val"]) and not (games["train"] & games["test"]) and not (games["val"] & games["test"])


def test_played_moves_are_legal_and_counts_match_benchmark():
    t = _targets("test")
    for r in t.sample(2000, random_state=0).itertuples():
        b = chess.Board(r.fen)
        assert chess.Move.from_uci(r.played_move_uci) in b.legal_moves
        assert b.legal_moves.count() == r.candidate_count
    v = pd.read_parquet(config.PROCESSED / "variants.parquet", columns=["split", "level", "n_dec"])
    assert len(t) == int(v[(v["split"] == "test") & (v["level"] == 0)]["n_dec"].sum())


def test_result_files_are_consistent_with_existing_numbers():
    p = config.ARTIFACTS / "three_model_assistance_results.json"
    if not p.exists():
        pytest.skip("three-model evaluation not run")
    res = json.loads(p.read_text())
    m = json.loads((config.ARTIFACTS / "metrics.json").read_text())
    assert abs(res["models"]["R"]["roc_auc"] - m["experiments"]["A0_zt1"]["classifier"]["roc_auc"]) < 1e-12
    assert res["data"]["rows"] == m["dataset"]["n_variants"]["test"]
    mp = json.loads((config.ARTIFACTS / "three_model_move_prediction.json").read_text())
    assert mp["models"]["R"]["metrics"]["top1_accuracy"] is None      # no per-move distribution -> not computed
    for k in ("Q", "M"):
        if mp["models"][k]["status"] == "pending":
            assert all(v is None for v in mp["models"][k]["metrics"].values())
    assert mp["generator"]["plan_sha256"] == res["generator"]["plan_sha256"]


def test_qwen_artifacts_never_mix_models():
    p = config.ARTIFACTS / "qwen_move_scores.parquet"
    if not p.exists():
        pytest.skip("Qwen3-8B-Base not scored yet")
    q = pd.read_parquet(p, columns=["qwen_model_id", "qwen_revision", "prompt_hash", "condition"])
    assert set(q["qwen_model_id"]) == {"Qwen/Qwen3-8B-Base"} and q["qwen_revision"].nunique() == 1
    assert q.groupby("condition")["prompt_hash"].nunique().max() == 1


def test_prepared_study_json_matches_source_artifacts():
    p = config.WEB_DATA / "prepared_three_model_demo.json"
    if not p.exists():
        pytest.skip("prepared three-model study not exported")
    demo = json.loads(p.read_text())
    t = _targets("test").set_index("position_id")
    from analyzer.compare.dists import maia_dist
    for pos in demo["positions"]:
        pid = pos["position_id"]
        assert pos["fen"] == t.at[pid, "fen"] and pos["original_move"] == t.at[pid, "played_move_uci"]
        gid, ply = pid.rsplit(":", 1)
        d = maia_dist("M", gid, int(ply))
        for c in pos["candidates"]:
            assert abs(c["maia"] - d[c["move"]]) < 1e-6
        assert abs(sum(c["maia"] for c in pos["candidates"]) - 1) < 1e-4
        if pos.get("substitute_move"):
            assert pos["substitute_move"] != pos["original_move"]
            assert pos["substitute_move"] in {c["move"] for c in pos["candidates"]}   # same original position
