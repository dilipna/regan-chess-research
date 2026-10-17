"""Step 3 checks: pair counting, merging, training, and a perfect round trip."""
from impl import load

m = load("s03_bpe")


def test_pair_counts():
    assert dict(m.get_pair_counts([1, 2, 3, 1, 2])) == {(1, 2): 2, (2, 3): 1, (3, 1): 1}
    assert dict(m.get_pair_counts([7])) == {}


def test_merge_is_left_to_right_and_non_overlapping():
    assert m.merge([1, 2, 3, 1, 2], (1, 2), 99) == [99, 3, 99]
    assert m.merge([5, 5, 5], (5, 5), 9) == [9, 5]


def test_training_learns_the_most_frequent_pair_first():
    merges = m.train("aaabdaaabac", 259)
    first = next(iter(merges))
    assert first == (97, 97) and merges[first] == 256
    assert list(merges.values()) == [256, 257, 258]


def test_round_trip_any_text():
    from data import tiny_stories
    merges = m.train(tiny_stories(8_000), 256 + 60)
    for s in ["The fox ran to the river.", "héllo wörld — 你好 🙂", "", "zzzz qqq"]:
        assert m.decode(m.encode(s, merges), merges) == s


def test_merges_compress_common_text():
    from data import tiny_stories
    text = tiny_stories(8_000)
    merges = m.train(text, 256 + 60)
    sample = "The cat went to the park."
    assert len(m.encode(sample, merges)) < 0.7 * len(sample.encode())
