import json
import math

import numpy as np
import pandas as pd
import pytest

from analyzer import config
from analyzer.aif.export import LABEL, _cell, report_to_aif
from analyzer.features.aggregate import ALL_FEATURES, GROUPS

DEMO = config.WEB_DATA / "demo-human-baseline.json"


def test_feature_groups_are_nested():
    a, b, c, d = (GROUPS[k] for k in ("A_stat", "B_sf", "C_sf_maia", "D_sf_maia_seq"))
    assert set(a) < set(b) < set(c) < set(d)
    assert len(d) == len(set(d))
    # the statistical and Stockfish groups must not use Maia-3 information
    assert not any("maia" in f or "surprisal" in f or "triple" in f or "nonhuman" in f for f in b)


def test_aif_cell_format():
    assert _cell(132) == "+132"
    assert _cell(-53) == "-053"
    assert _cell(5000) == "+900"            # clipped to the documented range
    assert _cell(config.MATE_CP - 3) == "+997"  # mate in 3 -> 1000-3
    assert _cell(None) == "n.a."


@pytest.mark.skipif(not DEMO.exists(), reason="demo not exported")
def test_aif_export_structure():
    rep = json.loads(DEMO.read_text())
    txt = report_to_aif(rep, rep["focus"])
    assert LABEL in txt
    for tag in ("[GameID ", "[EngineID ", "[MultiPV ", "[DepthRange ", "[Turn ", "[MovePlayed ",
                "[EngineMove ", "[Eval ", "[FEN ", "[NumLegalMoves ", "[LegalMoves "):
        assert tag in txt
    n_blocks = txt.count("[Turn ")
    assert n_blocks == sum(1 for r in rep["players"][rep["focus"]]["timeline"] if r["sf_lines"])


@pytest.mark.skipif(not (config.PROCESSED / "variants.parquet").exists(), reason="dataset not built")
def test_features_finite_and_labels_consistent():
    df = pd.read_parquet(config.PROCESSED / "variants.parquet")
    assert np.isfinite(df[ALL_FEATURES].to_numpy(float)).all()
    assert ((df["level"] == 0) == (df["label"] == 0)).all()
    assert (df.loc[df["level"] == 0, "realized_alpha"] == 0).all()
    assert (df["realized_alpha"] <= df["level"] + 1.0 / df["n_dec"] + 1e-9).all()
    # clean z(top-1) should be roughly standardized on held-out games (kappa from validation)
    z = df.loc[(df["level"] == 0) & (df["split"] == "test"), "z_t1"]
    assert abs(z.mean()) < 0.35 and 0.6 < z.std() < 1.5


@pytest.mark.skipif(not DEMO.exists(), reason="demo not exported")
def test_projected_vs_observed_rows_and_disclaimer():
    rep = json.loads(DEMO.read_text())
    keys = [r["key"] for r in rep["players"][rep["focus"]]["pvo"]]
    assert keys[:4] == ["t1", "ev", "t3", "loss"] and "maia" in keys
    ev = next(r for r in rep["players"][rep["focus"]]["pvo"] if r["key"] == "ev")
    t1 = next(r for r in rep["players"][rep["focus"]]["pvo"] if r["key"] == "t1")
    assert ev["observed"] >= t1["observed"]      # equal-value matches include all top-1 matches
    assert "not proof" in rep["disclaimer"]
