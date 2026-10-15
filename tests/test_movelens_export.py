"""MoveLens demo file: every value traces to stored artifacts; Qwen values only from the local scores file."""

import json

import chess
import pytest

from analyzer import config


@pytest.fixture(scope="module")
def demo():
    p = config.ARTIFACTS / "movelens_demo.json"
    if not p.exists():
        pytest.skip("not exported")
    return json.loads(p.read_text())


def test_examples_are_real_positions(demo):
    assert len(demo["examples"]) <= 3
    for e in demo["examples"]:
        if "fen" not in e:
            assert e["status"] == "not-evaluated"
            continue
        b = chess.Board(e["fen"])
        assert chess.Move.from_uci(e["played"]) in b.legal_moves
        assert e["n_legal"] == b.legal_moves.count()
        assert e["stockfish"]["lines"][0]["move"] == next(iter(e["stockfish"]["lines"]))["move"]


def test_qwen_only_with_local_scores(demo):
    scores = config.INTERIM / "qwen_local_demo" / "scores.jsonl"
    n = len(scores.read_text().splitlines()) if scores.exists() else 0
    ok = n >= len(demo["pool"])
    assert (demo["models"]["qwen"]["status"] == "precomputed-local") == ok
    for e in demo["examples"]:
        if "fen" in e:
            assert (e["qwen"] is not None) == ok


def test_statistical_label_rule(demo):
    r = demo["label_rule"]
    for e in demo["examples"]:
        if "fen" not in e:
            continue
        s = e["statistical"]
        obs = s["p_t1"] if s["engine_match"] else 1 - s["p_t1"]
        assert s["p_observed_outcome"] == pytest.approx(obs, abs=1e-6)
        assert s["label"] == ("unusual" if obs < r["unusual_below"] else "somewhat unexpected" if obs < r["somewhat_unexpected_below"] else "expected")


def test_regan_checks_consistency():
    p = config.ARTIFACTS / "regan_checks.json"
    if not p.exists():
        pytest.skip("not exported")
    c = json.loads(p.read_text())
    g = c["game"]
    for v in g["variants"]:
        z = (v["actual_t1"] - v["projected_t1"]) / (g["kappa_t1"] * v["var_t1"]) ** 0.5
        assert z == pytest.approx(v["z_t1"], abs=1e-4)
        assert sum(v["t1"]) == v["actual_t1"] and len(v["t1"]) == g["n_decisions"]
    assert sum(c["clean_z"]["hist"]) == c["clean_z"]["n"] == 605
    assert sum(b["n"] for b in c["calibration"]["by_band"]) == c["calibration"]["n"]
    q = c["qwen_ablation"]
    if q["status"] == "precomputed-local":
        for cond in ("regan_aligned", "position_only"):
            assert q["summary"][cond]["top_is_engine_first"] == sum(r[cond]["top_is_engine_first"] for r in q["rows"])
