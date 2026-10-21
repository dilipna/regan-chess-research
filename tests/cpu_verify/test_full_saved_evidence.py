import copy

import numpy as np
import pytest

from scripts.verify_full_cpu_evidence import validate_splits, verify, weighted_auc


@pytest.mark.parametrize("scores,expected", [([0, 1], 1), ([1, 0], 0), ([1, 1], 0.5)])
def test_order_and_ties(scores, expected):
    ties = np.unique(scores, return_inverse=True)[1]
    assert weighted_auc([0, 1], ties, [1, 1]) == expected


def test_weighted_auc_matches_explicit_pairs():
    y = np.array([0, 1, 0, 1, 1])
    scores = np.array([1, 1, 3, 4, 2])
    weights = np.array([2, 3, 1, 2, 4])
    numerator = sum(
        weights[i]
        * weights[j]
        * ((scores[i] > scores[j]) + 0.5 * (scores[i] == scores[j]))
        for i in range(5)
        for j in range(5)
        if y[i] == 1 and y[j] == 0
    )
    expected = numerator / (weights[y == 1].sum() * weights[y == 0].sum())
    ties = np.unique(scores, return_inverse=True)[1]
    assert weighted_auc(y, ties, weights) == pytest.approx(expected)
    # Integer multiplicities must equal materializing sampled rows.
    ix = np.repeat(np.arange(5), weights)
    assert weighted_auc(y[ix], ties[ix], np.ones(len(ix))) == pytest.approx(expected)


@pytest.mark.parametrize(
    "y,weights",
    [
        ([1, 1], [1, 1]),
        ([0, 1], [-1, 1]),
        ([0, 1], [1, float("nan")]),
        ([0, 2], [1, 1]),
    ],
)
def test_invalid_auc_rejected(y, weights):
    with pytest.raises(ValueError):
        weighted_auc(y, [0, 1], weights)


def fixtures():
    variants = [
        {
            "variant_id": "a",
            "game_id": "g1",
            "player": "Alice",
            "split": "train",
            "label": 0,
            "level": 0,
        },
        {
            "variant_id": "b",
            "game_id": "g2",
            "player": "Bob",
            "split": "test",
            "label": 1,
            "level": 0.1,
        },
    ]
    return variants, [copy.deepcopy(variants[1])], {"g1": "train", "g2": "test"}


def test_valid_metadata():
    assert validate_splits(*fixtures())["source_games"] == 2


@pytest.mark.parametrize(
    "mutation",
    [
        "player",
        "game",
        "duplicate_variant",
        "missing_prediction",
        "duplicate_prediction",
        "label",
        "prediction_metadata",
    ],
)
def test_corrupted_metadata_rejected(mutation):
    variants, predictions, splits = fixtures()
    if mutation == "player":
        variants[1]["player"] = " ALICE "
    elif mutation == "game":
        variants[1]["game_id"] = "g1"
    elif mutation == "duplicate_variant":
        variants.append(copy.deepcopy(variants[0]))
    elif mutation == "missing_prediction":
        predictions.clear()
    elif mutation == "duplicate_prediction":
        predictions.append(copy.deepcopy(predictions[0]))
    elif mutation == "label":
        variants[1]["label"] = 0
    else:
        predictions[0]["level"] = 0.2
    with pytest.raises(ValueError):
        validate_splits(variants, predictions, splits)


def test_missing_external_inputs_fail(tmp_path):
    from scripts.verify_full_cpu_evidence import ROOT

    with pytest.raises(ValueError, match="Missing or altered"):
        verify(ROOT, tmp_path)
