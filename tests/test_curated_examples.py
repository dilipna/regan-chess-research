"""Curated demo examples: selection rules are deterministic and the artifact never contains invented Qwen values."""

import importlib.util
import json
import math
from pathlib import Path

import pytest

from analyzer import config

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("curated", ROOT / "experiments" / "20_export_curated_examples.py")
curated = importlib.util.module_from_spec(spec)
spec.loader.exec_module(curated)


def row(pid, **kw):
    base = dict(position_id=pid, gid=pid.split(":")[0], ply=1, played="a", sf1="a", n_legal=30, eval=0.0, m_top="a", m_p_played=0.7,
                m_rank_played=1, m_p_sf1=0.7, m_entropy=1.0, sf_rank_played=1, cp_loss=0.0, difficulty=0.5, p_t1=0.4)
    base.update(kw)
    return base


def test_selection_is_deterministic_and_never_reuses_a_game():
    rows = [row(f"g{i}:{i}", m_p_played=0.5 + i / 100) for i in range(10)]
    a = curated.select(rows, have_qwen=False)
    assert a == curated.select(list(reversed(rows)), have_qwen=False)
    ids = [r["position_id"] for r in a.values() if r]
    assert len(ids) == len(set(ids)) and len({i.split(":")[0] for i in ids}) == len(ids)


def test_qwen_slots_only_activate_with_qwen_scores():
    rows = [row("g1:1", n_legal=10, played="x", sf1="y", m_top="z", m_p_played=0.1, m_p_sf1=0.5, js_qm=0.3, q_top_maia_rank=12, q_top_p=0.6)]
    assert "qwen-vs-maia" not in curated.select(rows, have_qwen=False)
    assert curated.select(rows, have_qwen=True)["qwen-vs-maia"]["position_id"] == "g1:1"


def test_js_divergence_properties():
    p = {"a": 0.5, "b": 0.5}
    assert curated.js_divergence(p, p) == pytest.approx(0.0)
    assert curated.js_divergence({"a": 1.0, "b": 0.0}, {"a": 0.0, "b": 1.0}) == pytest.approx(math.log(2))


def test_artifact_has_no_qwen_values_while_pending():
    p = config.ARTIFACTS / "curated_examples.json"
    if not p.exists():
        pytest.skip("not exported")
    d = json.loads(p.read_text())
    qwen_present = (config.INTERIM / "qwen" / "regan_aligned" / "test.jsonl").exists()
    assert (d["qwen"]["status"] == "ok") == qwen_present
    if not qwen_present:
        for e in d["examples"]:
            if e["position"]:
                assert all(c["qwen"] is None and c["qwen_rank"] is None for c in e["position"]["candidates"])
            else:
                assert e["status"] == "pending"
    assert sum(1 for e in d["examples"] if e["position"]) >= 5
