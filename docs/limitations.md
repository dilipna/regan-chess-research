# Limitations

* The statistical baseline is an independent reconstruction from publicly documented concepts; it is not Professor Regan's production analyzer, calibration or data, and no
  comparison with his analyzer was made.
* Controlled engine substitutions are not real-world cheating: substitutes are Stockfish lines inserted into otherwise human decisions and evaluated in the original positions
  (games are not replayed). For RANDOM/SELECTIVE the substitute equals Stockfish #1 by construction, favouring engine-match statistics.
* Maia-3 models human move preference, not cheating; a low probability means "unusual for this rating".
* Qwen3-8B-Base is a general language model, not a chess-specialized detector; it provides a move-preference signal. **It has not been run on the 8B model yet; no Qwen result exists.**
* Tokenization, prompt wording, UCI notation and candidate order can change LLM likelihoods; one frozen formulation was built, others are unexplored.
* Results depend on the dataset (one month of online Lichess rapid/classical games, presumed human, one game per player), engine settings (Stockfish 19, depth 12, MultiPV 5),
  and the substitution protocol. Maia-3 was trained on Lichess data to Jul 2025; the test games are Aug 2026.
* Bootstrap intervals condition on the frozen/fitted models (refit variance is not captured) and no multiplicity correction is applied.
* Classification performance or correlation is not proof of misconduct and must not be used alone for adjudication.
