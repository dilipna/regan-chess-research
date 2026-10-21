"""Step 3 · A byte-level BPE tokenizer (the algorithm family Qwen's tokenizer uses).

Text starts as UTF-8 bytes (256 possible values, so ANY string can be represented). Training repeatedly finds the
most frequent adjacent pair of ids and replaces it everywhere with a brand-new id. After enough merges, frequent
chunks such as " the" or "ing" become single tokens, so common text gets short while rare text still works.

Qwen's real tokenizer adds a regex pre-split (so merges never cross word boundaries) and has 151,643 learned
entries. The core loop is exactly this one.

Atlas link: Tokenizer and Token IDs (The model).
Run the checks:  python -m pytest -k s03
"""
from __future__ import annotations

from collections import Counter


def get_pair_counts(ids: list[int]) -> Counter:
    """How often each adjacent pair (a, b) occurs in ids."""
    # TODO(3.1): count every consecutive pair, e.g. [1, 2, 3, 1, 2] -> {(1, 2): 2, (2, 3): 1, (3, 1): 1}.
    return Counter(zip(ids, ids[1:]))
    # END TODO


def merge(ids: list[int], pair: tuple[int, int], new_id: int) -> list[int]:
    """Replace every non-overlapping occurrence of `pair`, scanning left to right, with new_id."""
    # TODO(3.2): walk with an index i. If ids[i], ids[i + 1] equals pair, emit new_id and jump 2; else emit ids[i] and jump 1.
    out, i = [], 0
    while i < len(ids):
        if i + 1 < len(ids) and (ids[i], ids[i + 1]) == pair:
            out.append(new_id)
            i += 2
        else:
            out.append(ids[i])
            i += 1
    return out
    # END TODO


def train(text: str, vocab_size: int) -> dict[tuple[int, int], int]:
    """Learn vocab_size - 256 merges. Returns {pair: new_id}, in the order they were learned (ids 256, 257, ...)."""
    assert vocab_size >= 256
    ids = list(text.encode("utf-8"))
    merges: dict[tuple[int, int], int] = {}
    # TODO(3.3): for new_id in 256 .. vocab_size - 1: find the most common pair (stop early if none is left),
    # merge it in ids, and record merges[pair] = new_id.
    for new_id in range(256, vocab_size):
        counts = get_pair_counts(ids)
        if not counts:
            break
        pair = max(counts, key=counts.get)
        ids = merge(ids, pair, new_id)
        merges[pair] = new_id
    return merges
    # END TODO


def encode(text: str, merges: dict[tuple[int, int], int]) -> list[int]:
    """Text -> token ids, applying merges in the order they were learned."""
    ids = list(text.encode("utf-8"))
    # TODO(3.4): while at least two ids remain: among the pairs present, pick the one learned EARLIEST
    # (smallest merges[pair]); if none of them was learned, stop; otherwise merge it.
    while len(ids) >= 2:
        pairs = get_pair_counts(ids)
        pair = min(pairs, key=lambda p: merges.get(p, float("inf")))
        if pair not in merges:
            break
        ids = merge(ids, pair, merges[pair])
    return ids
    # END TODO


def decode(ids: list[int], merges: dict[tuple[int, int], int]) -> str:
    """Token ids -> text. Each id stands for a fixed byte string."""
    # TODO(3.5): build vocab: id -> bytes, starting with bytes([i]) for i < 256 and, for each merge in order,
    # vocab[new_id] = vocab[a] + vocab[b]. Join the bytes and decode as UTF-8 (errors="replace").
    vocab = {i: bytes([i]) for i in range(256)}
    for (a, b), new_id in merges.items():
        vocab[new_id] = vocab[a] + vocab[b]
    return b"".join(vocab[i] for i in ids).decode("utf-8", errors="replace")
    # END TODO


def show(ids: list[int], merges: dict[tuple[int, int], int]) -> list[str]:
    """Each token as readable text (for printing)."""
    return [decode([i], merges) for i in ids]


if __name__ == "__main__":
    from data import tiny_stories

    text = tiny_stories()
    merges = train(text, 256 + 200)
    sample = "The fox ran to the river."
    ids = encode(sample, merges)
    print(f"{len(sample.encode())} bytes -> {len(ids)} tokens:", show(ids, merges))
    assert decode(ids, merges) == sample
