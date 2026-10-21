"""Step 2 · The simplest language model: counting pairs.

A language model gives a probability to the next token. The simplest possible one looks at a single previous
character and asks "after this character, how often did each character come next?" That table IS the model.

It already has every piece an LLM has: a vocabulary, a probability distribution over the next token, a loss
(average negative log-likelihood, the same cross-entropy used to train Qwen) and a sampling loop. The transformer
replaces "look at one previous character" with "look at everything before, through 36 blocks".

Atlas link: Logits, Softmax → sample (The model).
Run the checks:  python -m pytest -k s02
"""
from __future__ import annotations

import numpy as np


def build_vocab(text: str) -> tuple[dict[str, int], list[str]]:
    """Every distinct character, sorted. Returns (string -> id, id -> string)."""
    itos = sorted(set(text))
    return {c: i for i, c in enumerate(itos)}, itos


def count_bigrams(text: str, stoi: dict[str, int]) -> np.ndarray:
    """counts[a, b] = how many times character b directly follows character a."""
    V = len(stoi)
    # TODO(2.1): fill a [V, V] integer array by walking over consecutive pairs (text[i], text[i + 1]).
    raise NotImplementedError("TODO(2.1)")


def probs_from_counts(counts: np.ndarray, smoothing: float = 1.0) -> np.ndarray:
    """Turn counts into next-character probabilities. Each row must sum to 1."""
    # TODO(2.2): add `smoothing` to every count (so nothing has probability 0), then divide each row by its sum.
    raise NotImplementedError("TODO(2.2)")


def nll(text: str, P: np.ndarray, stoi: dict[str, int]) -> float:
    """Average negative log-likelihood per predicted character: the cross-entropy loss. Lower is better."""
    # TODO(2.3): average -log P[a, b] over every consecutive pair in text.
    raise NotImplementedError("TODO(2.3)")


def sample(P: np.ndarray, itos: list[str], start: str, n: int, rng: np.random.Generator) -> str:
    """Generate n characters after `start`, drawing each from the row of the previous character."""
    stoi = {c: i for i, c in enumerate(itos)}
    # TODO(2.4): repeat n times: take the row of the last character, draw the next id with
    # rng.choice(len(itos), p=row), append its character.
    raise NotImplementedError("TODO(2.4)")


if __name__ == "__main__":
    from data import tiny_stories

    text = tiny_stories()
    stoi, itos = build_vocab(text)
    split = int(0.9 * len(text))
    P = probs_from_counts(count_bigrams(text[:split], stoi))
    print(f"vocabulary: {len(itos)} characters; uniform guessing scores {np.log(len(itos)):.3f} nats")
    print(f"bigram model on held-out text: {nll(text[split:], P, stoi):.3f} nats per character")
    print(sample(P, itos, "T", 200, np.random.default_rng(0)))
