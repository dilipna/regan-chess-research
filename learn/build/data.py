"""A small, seeded, synthetic corpus for the tiny GPT (about 40,000 characters, no download needed).

The sentences follow simple templates, so you can see the model learn real structure: words, spaces, capital
letters after full stops, and which verbs go with which nouns. Pass --text to the trainer to use your own file.
"""
import random

ANIMALS = ["cat", "dog", "fox", "owl", "bear", "frog", "duck", "wolf", "mouse", "horse"]
NAMES = ["Mia", "Leo", "Ava", "Sam", "Zoe", "Max", "Ivy", "Ben"]
PLACES = ["the park", "the river", "the hill", "the barn", "the forest", "the market", "the garden", "the lake"]
THINGS = ["a red ball", "a small boat", "an old map", "a blue kite", "a warm cake", "a tiny key", "a big box"]
FEELINGS = ["happy", "sleepy", "hungry", "brave", "curious", "tired", "calm"]
VERBS_TO = ["ran to", "walked to", "went to", "hopped to", "flew to"]


def sentence(rng: random.Random) -> str:
    a, b = rng.sample(ANIMALS, 2)
    n = rng.choice(NAMES)
    templates = [
        f"The {a} {rng.choice(VERBS_TO)} {rng.choice(PLACES)}.",
        f"{n} found {rng.choice(THINGS)} near {rng.choice(PLACES)}.",
        f"The {a} was {rng.choice(FEELINGS)}, so it slept.",
        f"{n} gave {rng.choice(THINGS)} to the {a}.",
        f"The {a} and the {b} played at {rng.choice(PLACES)}.",
        f"{n} was {rng.choice(FEELINGS)} and the {a} was {rng.choice(FEELINGS)}.",
    ]
    return rng.choice(templates)


def tiny_stories(n_chars: int = 40_000, seed: int = 0) -> str:
    rng = random.Random(seed)
    lines, size = [], 0
    while size < n_chars:
        story = " ".join(sentence(rng) for _ in range(rng.randint(2, 4)))
        lines.append(story)
        size += len(story) + 1
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    print(tiny_stories()[:600])
