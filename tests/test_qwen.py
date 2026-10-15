"""Tests for the Qwen legal-move scorer.

Prompt / normalization / cache tests are pure Python. Scoring tests need `transformers` and the small
Qwen3-0.6B-Base checkpoint (a pipeline check only); they are skipped where those are unavailable
(e.g. the research .venv, whose pinned huggingface_hub conflicts with transformers). Run them with
.venv-qwen:  .venv-qwen/Scripts/python -m pytest tests/test_qwen.py
"""

import json
import math
import pickle
import tempfile

import chess
import pytest

from analyzer import config
from analyzer.qwen.cache import ScoreCache, cache_key
from analyzer.qwen.prompt import (CANDIDATE_FORMAT, POSITION_ONLY, PROMPT_HASH, REGAN_ALIGNED, PositionInput,
                                  build_prompt, candidate_text, position_from_decision)
from analyzer.qwen.scorer import distribution_summary, normalize, played_rank

FEN = "r1bq1rk1/1pp2ppp/p1np1n2/4p3/1P1bP3/P1NP1N1P/2P1BPP1/R1BQK2R w KQ - 1 9"
LINES = (("f3d4", 6.0), ("c1d2", -28.0), ("d1d2", -29.0), ("c1b2", -36.0), ("e1d2", -333.0))
POS = PositionInput(FEN, 1570, 1586, LINES)


def _decisions():
    p = config.PROCESSED / "decisions.pkl"
    if not p.exists():
        pytest.skip("pipeline not run")
    with open(p, "rb") as fh:
        return pickle.load(fh)


# ------------------------------------------------------------------ prompt
def test_prompt_ends_before_answer_and_lists_only_legal_moves():
    text, legal = build_prompt(POS)
    assert text.endswith("Move:")
    assert legal == sorted(m.uci() for m in chess.Board(FEN).legal_moves)
    listed = [l.split(" | ")[0] for l in text.split("Legal candidate moves:\n")[1].split("\n\n")[0].splitlines()]
    assert listed == legal


def test_illegal_engine_move_is_rejected():
    with pytest.raises(ValueError):
        build_prompt(PositionInput(FEN, 1500, 1500, (("e2e4", 10.0),)))


def test_position_only_condition_has_no_engine_information():
    text, _ = build_prompt(POS, POSITION_ONLY)
    assert "engine" not in text.lower() and "+0.06" not in text
    assert PROMPT_HASH[POSITION_ONLY] != PROMPT_HASH[REGAN_ALIGNED]


def test_prompt_does_not_depend_on_target_or_assistance():
    """The prompt is a function of position-level fields only: changing the played move, the candidate
    table (which holds the played move's evaluation) or any assistance field leaves it identical."""
    decs = _decisions()
    d = next(x for gid in sorted(decs) for x in decs[gid] if x["eligible"])
    base, _ = build_prompt(position_from_decision(d))
    other = next(m.uci() for m in chess.Board(d["fen"]).legal_moves if m.uci() != d["played"])
    d2 = {**d, "played": other, "cands": [], "played_idx": -1, "difficulty": 0.0, "p_t1": 0.0,
          "substituted": True, "level": 0.7}
    assert build_prompt(position_from_decision(d2))[0] == base
    assert "played" not in PositionInput.__dataclass_fields__


def test_played_move_value_outside_multipv_never_shown():
    decs = _decisions()
    n = 0
    for gid in sorted(decs)[:200]:
        for d in decs[gid]:
            if d["eligible"] and d["played"] not in [l["move"] for l in d["sf_lines"]]:
                text, _ = build_prompt(position_from_decision(d))
                assert f"\n{d['played']} | engine_eval=n/a\n" in text
                n += 1
    assert n > 0


def test_exported_positions_contain_no_target():
    p = config.INTERIM / "three_model" / "positions_test.jsonl"
    if not p.exists():
        pytest.skip("positions not exported")
    r = json.loads(p.read_text().splitlines()[0])
    assert set(r) == {"position_id", "fen", "elo", "opp_elo", "engine_lines"}


def test_candidate_format_frozen():
    assert CANDIDATE_FORMAT == " {uci}\n" and candidate_text("e7e8q") == " e7e8q\n"


# ------------------------------------------------------------------ normalization / ranks
def test_probabilities_sum_to_one_and_follow_logits():
    lp = {"a": -1.0, "b": -2.0, "c": -30.0, "d": -1.0}
    p = normalize(lp)
    assert abs(sum(p.values()) - 1) < 1e-12
    assert abs(p["a"] / p["b"] - math.e) < 1e-9 and p["a"] == p["d"]
    assert normalize({"a": -1000.0, "b": -1001.0})["a"] > 0.7  # log-sum-exp is stable


def test_rank_rule_and_summary():
    p = {"a": 0.5, "b": 0.3, "c": 0.2}
    assert played_rank(p, "a") == 1 and played_rank(p, "c") == 3
    s = distribution_summary(p, {k: math.log(v) for k, v in p.items()}, played="b")
    assert s["rank_played"] == 2 and s["top1_move"] == "a" and s["candidate_count"] == 3


# ------------------------------------------------------------------ cache
def test_cache_key_invalidates_on_model_prompt_and_input():
    _, legal = build_prompt(POS)
    k = dict(model_id="Qwen/Qwen3-8B-Base", revision="r1", dtype="bfloat16")
    base = cache_key(POS, legal, **k)
    assert base == cache_key(POS, list(reversed(legal)), **k)          # candidate order irrelevant
    assert base != cache_key(POS, legal, **{**k, "revision": "r2"})
    assert base != cache_key(POS, legal, **{**k, "model_id": "Qwen/Qwen3-0.6B-Base"})
    assert base != cache_key(POS, legal, **{**k, "dtype": "float32"})
    assert base != cache_key(POS, legal, condition=POSITION_ONLY, **k)
    assert base != cache_key(PositionInput(FEN, 1571, 1586, LINES), legal, **k)
    assert base != cache_key(PositionInput(FEN, 1570, 1586, LINES[:4]), legal, **k)


def test_cache_is_insert_only():
    with tempfile.TemporaryDirectory() as d:
        c = ScoreCache(f"{d}/c.sqlite")
        c.put("k", {"v": 1})
        c.put("k", {"v": 2})
        assert c.get("k") == {"v": 1} and len(c) == 1 and c.get("missing") is None
        c.close()


# ------------------------------------------------------------------ model scoring (needs transformers + small model)
@pytest.fixture(scope="module")
def scorer():
    pytest.importorskip("transformers")
    from analyzer.qwen.scorer import QwenScorer
    try:
        return QwenScorer("Qwen/Qwen3-0.6B-Base", dtype="float32", candidate_batch=16)
    except Exception as e:  # offline / not cached
        pytest.skip(f"small Qwen checkpoint unavailable: {e}")


def test_every_candidate_token_is_scored(scorer):
    text, legal = build_prompt(POS)
    ids = scorer.encode_prompt(text)
    for m in legal[:6] + ["e1g1"]:
        toks = scorer.candidate_tokens(text, ids, candidate_text(m))
        assert scorer.tokenizer.decode(toks) == candidate_text(m) and len(toks) >= 2
    sc = scorer.score_position(text, {m: candidate_text(m) for m in legal[:6]})
    for m, r in sc.items():
        assert r["n_tokens"] == len(r["token_logprobs"]) >= 2
        assert abs(r["logprob"] - sum(r["token_logprobs"])) < 1e-9


def test_cached_scoring_equals_full_sequence_scoring(scorer):
    text, legal = build_prompt(POS)
    c = {m: candidate_text(m) for m in legal}
    a, b = scorer.score_position(text, c), scorer.score_naive(text, c)
    assert max(abs(a[m]["logprob"] - b[m]["logprob"]) for m in legal) < 1e-3


def test_scoring_is_deterministic_and_normalized(scorer):
    text, legal = build_prompt(POS)
    c = {m: candidate_text(m) for m in legal}
    a, b = scorer.score_position(text, c), scorer.score_position(text, c)
    assert all(a[m]["logprob"] == b[m]["logprob"] for m in legal)
    p = normalize({m: a[m]["logprob"] for m in legal})
    assert set(p) == set(legal) and abs(sum(p.values()) - 1) < 1e-9
