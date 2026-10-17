"""Step 2 checks: counting, normalizing, scoring and sampling."""
import math

import numpy as np
import pytest

from impl import load

m = load("s02_bigram")
TEXT = "abab ba."


def test_counts():
    stoi, itos = m.build_vocab(TEXT)
    c = m.count_bigrams(TEXT, stoi)
    assert c.shape == (len(itos), len(itos))
    assert c[stoi["a"], stoi["b"]] == 2 and c[stoi["b"], stoi["a"]] == 2 and c[stoi[" "], stoi["b"]] == 1
    assert c.sum() == len(TEXT) - 1


def test_rows_are_distributions_and_smoothing_removes_zeros():
    stoi, _ = m.build_vocab(TEXT)
    P = m.probs_from_counts(m.count_bigrams(TEXT, stoi), smoothing=1.0)
    assert np.allclose(P.sum(axis=1), 1.0)
    assert (P > 0).all()
    P0 = m.probs_from_counts(m.count_bigrams(TEXT, stoi) + 1, smoothing=0.0)
    assert np.allclose(P, P0)


def test_nll_of_uniform_is_log_vocab():
    stoi, itos = m.build_vocab(TEXT)
    U = np.full((len(itos), len(itos)), 1 / len(itos))
    assert m.nll(TEXT, U, stoi) == pytest.approx(math.log(len(itos)))


def test_bigram_beats_uniform_on_real_text():
    from data import tiny_stories
    text = tiny_stories(20_000)
    stoi, itos = m.build_vocab(text)
    P = m.probs_from_counts(m.count_bigrams(text[:18_000], stoi))
    assert m.nll(text[18_000:], P, stoi) < math.log(len(itos)) - 0.8


def test_sampling_is_reproducible_and_uses_the_table():
    stoi, itos = m.build_vocab(TEXT)
    P = np.zeros((len(itos), len(itos)))
    for a in itos:
        P[stoi[a], stoi["b" if a == "a" else "a"]] = 1.0       # deterministic: a -> b, everything else -> a
    s = m.sample(P, itos, "a", 6, np.random.default_rng(0))
    assert s == "abababa"
    rng_out = [m.sample(m.probs_from_counts(m.count_bigrams(TEXT, stoi)), itos, "a", 20, np.random.default_rng(3)) for _ in range(2)]
    assert rng_out[0] == rng_out[1] and len(rng_out[0]) == 21
