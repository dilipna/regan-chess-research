"""Automated split-leakage tests.

Unit tests check the splitting algorithm; the integration test checks the actual dataset on disk
(skipped if the pipeline has not been run)."""

import json

import pandas as pd
import pytest

from analyzer import config
from analyzer.synthetic.splits import assign_splits, check_no_leakage


def _games():
    # players A..Z; some players appear in several games -> must share a split
    gs = []
    for i in range(400):
        gs.append({"game_id": f"g{i}", "white": f"p{i}", "black": f"q{i}"})
    gs += [{"game_id": "x1", "white": "p1", "black": "p2"},
           {"game_id": "x2", "white": "p2", "black": "p300"},
           {"game_id": "x3", "white": "P300", "black": "q7"}]   # case-insensitive names
    return gs


def test_connected_players_share_split():
    gs = _games()
    sp = assign_splits(gs)
    linked = ["g1", "g2", "g300", "g7", "x1", "x2", "x3"]
    assert len({sp[g] for g in linked}) == 1
    assert check_no_leakage(gs, sp) == []


def test_split_fractions_reasonable():
    sp = assign_splits(_games())
    counts = pd.Series(sp).value_counts(normalize=True)
    assert set(counts.index) == {"train", "val", "test"}
    assert 0.45 < counts["train"] < 0.75


def test_detects_variant_leakage():
    gs = _games()
    sp = assign_splits(gs)
    rows = [("g5", sp["g5"]), ("g5", "test" if sp["g5"] != "test" else "train")]
    assert check_no_leakage(gs, sp, rows)


def test_split_is_deterministic():
    assert assign_splits(_games()) == assign_splits(_games())


@pytest.mark.skipif(not (config.PROCESSED / "variants.parquet").exists(), reason="dataset not built")
def test_dataset_on_disk_has_no_leakage():
    df = pd.read_parquet(config.PROCESSED / "variants.parquet", columns=["game_id", "player", "split", "level"])
    splits = json.loads((config.PROCESSED / "splits.json").read_text())
    # every variant inherits the split of its source game
    assert (df["split"] == df["game_id"].map(splits)).all()
    # no source game in two splits
    assert (df.groupby("game_id")["split"].nunique() == 1).all()
    # no player in two splits
    assert (df.assign(p=df["player"].str.lower()).groupby("p")["split"].nunique() == 1).all()
    # every split has clean and assisted variants
    for s in ("train", "val", "test"):
        part = df[df["split"] == s]
        assert (part["level"] == 0).any() and (part["level"] > 0).any()
