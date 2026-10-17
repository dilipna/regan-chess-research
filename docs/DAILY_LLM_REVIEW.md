# Daily LLM review

Ten minutes a day at /latent/review.

_Generated from the LatentLens curriculum data (apps/web/src/lib/latent). Edit the data, then regenerate; do not edit by hand._

## What a session contains

- 2 architecture questions
- 2 training and inference questions
- 2 RAG and agents questions
- 2 security questions
- 1 connection question
- 1 teach-back (explain a concept in writing, then tick the rubric)

## How questions are chosen

A lightweight deterministic review schedule, not a scientifically optimized algorithm:

1. Concepts you answered wrong last time come first.
2. Then concepts you marked as guessed (low confidence).
3. Then concepts whose review date has passed.
4. Then concepts you have never seen.

Each correct answer moves a concept to the next interval (0d, 1d, 3d, 7d, 21d); a wrong answer moves it back to the start. Everything is stored in your browser's local storage; nothing is sent anywhere. "Reset progress" clears it.
