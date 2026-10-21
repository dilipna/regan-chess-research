"""Checks for the 'Mistake, or another version?' analysis (no model needed: it reads recorded recall artifacts)."""

import json
from pathlib import Path

import pytest

from analyze_recall_versions import evidence, next_words, words

ROOT = Path(__file__).resolve().parents[2]
VERSIONS = ROOT / "scripts" / "latentlens" / "passages" / "gettysburg_versions.json"
RESULT = ROOT / "results" / "latentlens" / "qwen3-8b" / "recall_versions.json"


def test_words_keeps_case_and_splits_hyphens():
    assert words("resting-place, for Liberty") == ["resting", "place", "for", "Liberty"]


def test_next_words_uses_longest_matching_context_case_insensitively():
    ver = words("we are met on a great battle-field of that war. we are met to dedicate")
    assert next_words(ver, words("We are met")) == {"on", "to"}
    assert next_words(ver, words("now we are met on a great")) == {"battle"}
    assert next_words(ver, words("nothing like this")) == set()


def test_evidence_finds_the_continuing_passage():
    txt = "It is rather for us to be here dedicated to the great task remaining before us"
    assert evidence(txt, "for us to be here").startswith("us to be here dedicated")   # keyed on the last 4 words
    assert evidence(txt, "zebra quantum") is None


def test_versions_source_contains_the_scored_bliss_copy():
    src = json.loads(VERSIONS.read_text(encoding="utf-8"))
    assert set(src["versions"]) >= {"Bliss", "Nicolay", "Hay", "Everett", "Bancroft"}
    assert all(len(t.split()) > 200 for t in src["versions"].values())


@pytest.mark.skipif(not RESULT.exists(), reason="recorded analysis not present")
def test_recorded_result_is_internally_consistent():
    r = json.loads(RESULT.read_text(encoding="utf-8"))
    assert r["top1_hits"] + r["misses"] == r["n_scored"]
    assert sum(r["miss_categories"].values()) == r["misses"]
    assert len(r["misses_detail"]) == r["misses"]
    other = [d for d in r["misses_detail"] if d["category"] == "another version"]
    assert len(other) == r["miss_categories"]["another version"]
    assert r["recall_strict"] == pytest.approx(r["top1_hits"] / r["n_scored"])
    assert r["recall_if_other_versions_accepted"] == pytest.approx((r["top1_hits"] + len(other)) / r["n_scored"])
    for d in other:
        assert d["versions_with_prediction"] and all(d["evidence"][v] for v in d["versions_with_prediction"])
