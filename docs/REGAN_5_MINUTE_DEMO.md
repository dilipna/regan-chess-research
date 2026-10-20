# Regan meeting: spoken demo script

Screen: `/latent/professor` (local: http://localhost:3000/latent/professor). Arrow keys move between sections.
Every number below is on screen and comes from a recorded artifact or from Professor Regan's own email.

## 5-MINUTE VERSION

**0:00 to 0:40 · Section 1, From outputs to internals**

"I realized I had been treating Qwen mostly from the outside: I looked at what it predicted and compared that with
other models. After our discussion I wanted to understand what happens inside the model and make those internal
states measurable. So the path is: text goes through the tokenizer to token IDs, each ID selects an embedding,
that vector goes through 36 transformer blocks, then a final RMSNorm and the LM head produce a score for every
vocabulary entry, and the top score is the next token."

**0:40 to 1:30 · Section 2, One Qwen transformer block**

"Inside each block it is pre-norm. The residual state is copied and RMS-normalized, then projected to queries, keys
and values: 32 query heads of 128 dimensions, and 8 key-value heads shared by four query heads each, so grouped-query
attention. Qwen3 also RMS-normalizes each query and key head separately, then applies RoPE to Q and K. Causal
attention mixes value vectors across earlier positions, the output projection brings it back to 4,096, and that is
added to the residual. Then a second RMSNorm, the SwiGLU MLP, 4,096 to 12,288 and back, and a second residual
addition. I checked this order against the actual transformers source, and re-derived the weight-free steps from
recorded tensors."

**1:30 to 2:10 · Sections 3 and 4, The latent state and RMSNorm**

"By latent state I mean the residual vector of each token at a given point: after the embedding and after each of
the 36 blocks, so 37 capture points, each of shape batch by tokens by 4,096. RMSNorm divides by the root mean square
and multiplies by a learned gain; unlike LayerNorm it does not subtract the mean. There are two different
RMSNorms: the block norm on the whole 4,096-dimensional residual, and the Q/K norm on each 128-dimensional head. So
for any experiment I need to say exactly which one I capture: before normalization, after it, or after a sublayer."

**2:10 to 3:15 · Section 5, One real Qwen internal trace**

"This is one real recorded run of Qwen3-8B-Base on 'The researcher opened the notebook', bfloat16, on my laptop GPU,
with the model revision and code commit recorded. At the last position the model's actual output ranks a period
first. If I project earlier layers through the final norm and LM head, that period is ranked 74,658th at the
embedding, and only reaches 32nd at layer 34, 8th at layer 35, and first at the output. These intermediate ranks are
diagnostic logit-lens projections, not what the model predicts at those layers. And this is one example, not a
population result. I have the same measurement across a whole passage: on the Gettysburg Address the median rank
of the true next token reaches 1 at layer 34."

**3:15 to 4:20 · Sections 6 and 7, Your 14B → ~27B observation**

"This connects to what you found. Your older Qwen ~14B run gave 86.31% recall and the ~27B run 86.34%, almost
identical, with about 40 more tokens, some long words split differently, and a divergence after 'from every state
and every city', where the older model continues 'we will' and the larger one 'we shall not'. That is your observation, I haven't
reproduced it. My question is: the final recall is almost the same, but are the internal trajectories the same?
There are at least three possibilities: tokenization differences affect a token-level comparison, the task is near
a ceiling, or the two models reach the same score through different internal paths. The third one is what this
instrumentation can test."

**4:20 to 5:00 · Sections 8 and 9, Proposed experiment and request**

"So the first experiment I'd propose is: trace the correct next token through the layers of both models and compare,
by relative depth, when the continuation becomes accessible and when it becomes dominant, with the will-versus-shall
point as a case study. Before I run that comparison, I don't want to guess your setup. I'd like to reproduce your
existing workflow exactly. Could you walk me through the files and scripts on turing or cerf?"

Then open the checklist (section 9) and go through the questions.

**If he engages with the experiment · open `/latent/proposal` (Phase 2, subsection 2.21)**

"I wrote the plan down so you can change it. It has five stages: reproduce your run exactly, separate the
tokenization effect, trace the known next token through the layers of both models, compare the cases where they
agree and disagree, with will versus shall as the first case study, and only then ask whether the plateau is real.
The table shows what I'd need to confirm with you and what I'd measure. Which part would you change?"

## 30-SECOND EXPLANATION OF THE PROPOSED APPROACH

"Your two runs give almost the same recall, 86.31 and 86.34 percent, but that single number could come from
several causes. So I'd first reproduce your recall exactly with your scripts, checkpoints and definition. Then I'd
separate tokenization, since the larger run had about 40 more tokens. Then, at every position where your text gives
the known next token, I'd trace its rank through every layer of both models on a relative-depth axis, and look at
where they agree, where they disagree, and at the will-versus-shall point. That tells us whether the same final
recall hides a different internal trajectory."

## 60-SECOND VERSION

"After our last meeting I studied Qwen's internals, not just its outputs. I can now name the exact points where a
latent state can be captured: the residual vector after each of the 36 blocks, before or after RMSNorm, which is
different from the per-head Q/K norm. I instrumented one real Qwen3-8B trace and can show where, layer by layer,
the final token becomes top-ranked, as a diagnostic projection. Your 14B versus ~27B result, 86.31 versus 86.34
percent, suggests the next step: compare when the correct continuation becomes dominant inside each model, by
relative depth. But first I want to reproduce your scripts exactly. Could you walk me through them on turing or
cerf?"

## If asked

- **"Is the logit lens reliable at early layers?"** "It's diagnostic. Earlier layers weren't trained to be read
  through the final norm, so I use it to see when the true token becomes favoured, not as the model's prediction."
- **"Why 8B?"** "It's what fits my 4 GB laptop GPU with layer streaming. The comparison you care about needs your
  checkpoints, which is why I want your setup."
- **"Is there a wall between 14B and 27B?"** "Two runs can't establish that yet. Same final recall could come from the
  same or a different internal path; that's what the layerwise comparison would show."
- **"Did you run the 14B or 27B?"** "No. Nothing on screen about those models is my measurement; those are your
  numbers, labelled as such."
