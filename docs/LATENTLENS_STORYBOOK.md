# The LLM Storybook (`/latent/story`)

Level 0 of LatentLens: intuition first. Fourteen short chapters, each with a read-aloud story, one activity, a
sticker, and a "Grown-up corner" with the precise version and links into the rigorous pages.

## Chapters

| # | Slug | Idea | Activity | Data |
|---|---|---|---|---|
| 1 | guess | next-word prediction | rhymes, then Qwen's real next-token shares | toy + recorded |
| 2 | pieces | tokens | real Qwen3 tokenizer splits | recorded |
| 3 | codes | embeddings | 3-number toy codes, nearest neighbours; first 8 real coordinates of "The" | toy + recorded |
| 4 | counting | n-gram counting | teach a bigram machine, let it talk | toy (live in browser) |
| 5 | practice | training | gradient descent on four words; huge steps oscillate | toy (live) |
| 6 | flashlight | attention | real attention formula with hand-picked 2-number keys | toy |
| 7 | tower | blocks + residual stream | 36-floor climb; recorded top-3 guesses at the top | toy + recorded |
| 8 | library | pretraining scale, MoE | knob dot-field from papers/cards; 512-helper router | toy (sourced counts) |
| 9 | manners | SFT / RLHF | pick better answers; Bradley-Terry two-feature reward | toy |
| 10 | dice | sampling, temperature | wheel from recorded logits and full-vocab normalizers at 6 temperatures | recorded |
| 11 | thinking | reasoning models | fast vs step-by-step (hand-written) + sourced model cards | toy |
| 12 | agents | multimodal, tools, agents | order an agent's steps; same-name cards (Astra, Muse) | toy |
| 13 | careful | hallucination, safety | Qwen's Gettysburg recall and the five-manuscript finding; safety cards | recorded |
| 14 | timeline | history 1948 to Oct 2026 | sourced timeline, filters, certificate | public sources |

## Honesty rules

- Every activity carries the LatentLens provenance label (Toy calculation / Recorded Qwen measurement); the timeline
  carries "public sources, each one linked". Nothing claims a live model.
- 2026 model facts were checked on 17 October 2026 against the labs' pages, Hugging Face model cards or major news
  coverage (TechCrunch for GPT-6 Astra). The list will go out of date.
- The book has not been tested with children; the cover says so.

## Implementation

- `src/lib/latent/story.ts` (chapters), `story-timeline.ts` (sourced timeline, knob counts), `story-models.ts`
  (pure toy computations, unit-tested).
- `src/components/latent/story/` (core: read-aloud via the browser's speech synthesis with word highlighting, stickers
  in localStorage, Pip; book: chapter shell and cover; acts-a/b/c: activities).
- Font: Andika (SIL, designed for beginning readers), loaded only by the story layout. Styles in
  `src/app/latent/story/story.css`, scoped to `[data-story]`.
- Tests: `apps/web/tests/story.test.tsx` (toy maths against recorded data, content rules, all chapters render).
