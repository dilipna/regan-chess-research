# Recall passages

- `gettysburg_address.txt`: Abraham Lincoln, Gettysburg Address (1863), Bliss copy. Public domain. A famous text the model has
  very likely seen many times during pretraining.
- `control_original.txt`: an original paragraph written for LatentLens on 2026-10-15 in a similar formal register. It has
  never been published, so the model cannot have memorized it. It is the control for "recall" versus ordinary prediction.

Copyrighted texts (for example the 1963 "I Have a Dream" speech) are not stored in this repository. Pass any local text
file to `run_recall_analysis.py --input <file>`; results are written to `results/`, the text itself is stored only as
the token pieces needed to display the analysis (use `--no-store-text` to omit them).
