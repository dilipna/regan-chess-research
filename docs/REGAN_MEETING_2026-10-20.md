# Regan meeting, 2026-10-20

> **DO NOT COMMIT PROFESSOR REGAN'S FILES OR SCRIPTS TO THE PUBLIC REPOSITORY WITHOUT EXPLICIT PERMISSION.**
> If any of his files are copied today, keep them outside this repository (for example `~/regan-private/`) unless
> he says otherwise. This repository is public on GitHub.

# Goal

Reproduce Professor Regan's recall workflow, then extend it to layerwise latent-state trajectories.

# Before meeting

CSE access tested (2026-10-19, from home network, not on VPN):
cerf: DNS resolves (128.205.36.11); TCP port 22 connects; SSH banner exchange times out
turing: DNS resolves (128.205.36.6); TCP port 22 connects; SSH banner exchange times out
VPN: not connected during the test; connect the UB VPN and retry (see `CSE_ACCESS_CHECKLIST.md`)
result: not yet logged in. Likely needs the VPN from off campus; account provisioning still unconfirmed.

# Need to learn

14B checkpoint:
larger checkpoint:
tokenizer(s):
input file:
command:
recall definition:
output format:
script location:
latent state requested:
permission to copy:
privacy requirement:
next deliverable:

# Proposed experiment

For each target token:

- final correctness
- true-token rank
- true-token probability
- top-token probability
- margin
- entropy

At selected/all layers where valid:

- diagnostic true-token rank
- top projected token
- margin
- activation RMS

Compare models by relative depth (block / number of blocks), since the two models have different numbers of blocks.

Intermediate-layer values are diagnostic projections (final RMSNorm + LM head applied to an earlier residual state),
not the model's predictions at those layers.

What already exists for this: `scripts/latentlens/run_recall_analysis.py` records the output-level values above and,
per layer, the true-token rank, top projected token and margin for Qwen3-8B-Base (Gettysburg run, bf16 and fp32).
Activation RMS per layer is not recorded by it yet (it is in the one-sentence trace), and a named competing token
(for will vs shall) is not recorded either. `scripts/latentlens/compare_recall_models.py` `scripts/latentlens/compare_recall_models.py` compares
two such runs. Neither has been run on the 14B or larger checkpoints. Its recall definition (top-1 next-token under
teacher forcing) may differ from Professor Regan's; his definition takes precedence.

# Special cases

- tokenization differences (about 40 extra tokens in the larger run; some long words split differently)
- will vs shall divergence ("...from every state and every city," then "we will" vs "we shall not")
- place-name recalls (both models reportedly correct)
- 14B-correct / larger-wrong cases
- larger-correct / 14B-wrong cases

# Questions

1. "Which exact checkpoints did you use for the 14B and larger model runs?"
2. "Could you show me exactly how your script defines a successful recall?"
3. "How are the additional tokens and different tokenizations handled when the models are compared?"
4. "Could we reproduce one of the runs together on turing or cerf?"
5. "When you say latent states, which representation would you most like me to inspect first: the residual output
   after each block, before or after RMSNorm, or another point?"
6. "Would tracing the true continuation's rank through every layer be useful for what you're trying to understand?"
7. "For the will-versus-shall case, would you want me to inspect where those alternatives begin to diverge through
   the network?"
8. "Should I reproduce the recall experiment first before moving to the human-versus-AI probing work?"
9. "May I make a working copy of your scripts, and should the files remain private?"
10. "What exact result would be most useful for me to bring you at our next meeting?"

# Notes

&nbsp;

&nbsp;

&nbsp;

&nbsp;

# Next action after meeting

&nbsp;
