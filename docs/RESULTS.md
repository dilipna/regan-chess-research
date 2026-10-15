# Results (generated from `data/artifacts/metrics.json`)

All numbers below are computed on the held-out TEST split (source games and players disjoint from training and validation). Classifier: original (0%) vs substituted (5–70%) player-games (controlled decision-level substitutions), with balanced class weighting. TPR thresholds are chosen on VALIDATION original games.

- Source games: train 943, val 297, test 321
- Original player-games: train 1788, val 567, test 605
- Rows incl. originals (player-games x 16 conditions): train 28608, val 9072, test 9680
- Mean eligible decisions per player-game: 21.3
- Injected (substituted) variants: test 9075; rows of one source game are dependent, so intervals resample source games.
- Original player-games are presumed human (no assistance injected by us); their absence of real assistance is not established.

## Ablation

TPR columns: recall on substituted test variants at a threshold set on validation original games for the target FPR; the realized test FPR is in parentheses and differs by system, so recall alone does not rank systems.

| Experiment | Features | ROC-AUC [95% CI] | PR-AUC | TPR @1% target (test FPR) | TPR @5% target (test FPR) | Brier | α MAE (pp) | α RMSE (pp) |
|---|---:|---|---:|---:|---:|---:|---:|---:|
| z(top-1) statistic only | 1 | 0.785 | 0.818 | 0.315 (1.2%) | 0.439 (6.1%) | — | — | — |
| Statistical baseline | 10 | 0.820 [0.812, 0.829] | 0.846 | 0.321 (1.0%) | 0.499 (6.0%) | 0.171 | 10.9 | 14.0 |
| Stockfish-XGB | 19 | 0.826 [0.819, 0.833] | 0.855 | 0.371 (1.7%) | 0.520 (5.8%) | 0.166 | 9.1 | 12.4 |
| Stockfish+Maia-XGB | 30 | 0.873 [0.864, 0.882] | 0.892 | 0.409 (1.0%) | 0.557 (4.0%) | 0.142 | 6.9 | 9.6 |
| Stockfish+Maia+Sequence-XGB | 44 | 0.880 [0.873, 0.887] | 0.898 | 0.404 (0.7%) | 0.576 (3.6%) | 0.138 | 6.9 | 9.5 |

## Paired differences in ROC-AUC (post hoc, saved test predictions)

Paired cluster bootstrap: 2000 resamples of 321 test source games, the same resample for both systems; percentile 95% interval. No refitting or tuning; no multiplicity correction; refit variance not captured. Overlap of the individual intervals above is a visual comparison only.

| From | To | Δ ROC-AUC | Paired 95% CI | Share of resamples ≤ 0 |
|---|---|---:|---|---:|
| z(top-1) statistic only | Statistical baseline | +0.0350 | [+0.0291, +0.0405] | 0.0000 |
| Statistical baseline | Stockfish-XGB | +0.0066 | [+0.0026, +0.0105] | 0.0010 |
| Stockfish-XGB | Stockfish+Maia-XGB | +0.0468 | [+0.0395, +0.0536] | 0.0000 |
| Stockfish+Maia-XGB | Stockfish+Maia+Sequence-XGB | +0.0067 | [+0.0025, +0.0110] | 0.0010 |
| Statistical baseline | Stockfish+Maia-XGB | +0.0534 | [+0.0458, +0.0607] | 0.0000 |
| Statistical baseline | Stockfish+Maia+Sequence-XGB | +0.0601 | [+0.0516, +0.0681] | 0.0000 |
| Stockfish-XGB | Stockfish+Maia+Sequence-XGB | +0.0535 | [+0.0451, +0.0612] | 0.0000 |

## ROC-AUC by strategy and assistance level (original test player-games vs that condition)

| Experiment | Strategy | 5% | 10% | 20% | 40% | 70% |
|---|---|---:|---:|---:|---:|---:|
| z(top-1) statistic only | random | 0.636 | 0.719 | 0.868 | 0.984 | 0.999 |
| z(top-1) statistic only | selective | 0.636 | 0.719 | 0.868 | 0.984 | 0.999 |
| z(top-1) statistic only | subtle | 0.541 | 0.570 | 0.629 | 0.749 | 0.870 |
| Statistical baseline | random | 0.648 | 0.728 | 0.875 | 0.982 | 0.999 |
| Statistical baseline | selective | 0.723 | 0.828 | 0.953 | 0.996 | 0.999 |
| Statistical baseline | subtle | 0.556 | 0.593 | 0.667 | 0.818 | 0.931 |
| Stockfish-XGB | random | 0.645 | 0.723 | 0.876 | 0.982 | 1.000 |
| Stockfish-XGB | selective | 0.721 | 0.836 | 0.961 | 0.996 | 1.000 |
| Stockfish-XGB | subtle | 0.559 | 0.596 | 0.677 | 0.849 | 0.971 |
| Stockfish+Maia-XGB | random | 0.702 | 0.797 | 0.927 | 0.991 | 0.999 |
| Stockfish+Maia-XGB | selective | 0.760 | 0.874 | 0.975 | 0.997 | 0.999 |
| Stockfish+Maia-XGB | subtle | 0.620 | 0.691 | 0.819 | 0.952 | 0.991 |
| Stockfish+Maia+Sequence-XGB | random | 0.717 | 0.810 | 0.933 | 0.991 | 0.999 |
| Stockfish+Maia+Sequence-XGB | selective | 0.810 | 0.906 | 0.981 | 0.998 | 0.999 |
| Stockfish+Maia+Sequence-XGB | subtle | 0.619 | 0.685 | 0.813 | 0.946 | 0.990 |

## ROC-AUC by Elo band

| Experiment | 1000-1399 | 1400-1799 | 1800-2199 | 2200-2699 |
|---|---:|---:|---:|---:|
| Statistical baseline | 0.822 | 0.834 | 0.822 | 0.798 |
| Stockfish-XGB | 0.825 | 0.840 | 0.827 | 0.809 |
| Stockfish+Maia-XGB | 0.874 | 0.889 | 0.879 | 0.845 |
| Stockfish+Maia+Sequence-XGB | 0.886 | 0.900 | 0.880 | 0.851 |

## Exploratory pooling of different-player games (pseudo-events)

Each pseudo-event pools k test player-games by k different players of one Elo band (all original or all substituted at the same strategy and level); event score = mean game score. This does NOT validate longitudinal detection for a single player.

| Model | Strategy | Level | k=1 | k=3 | k=5 | k=9 |
|---|---|---|---:|---:|---:|---:|
| z(top-1) statistic only | random | 5% | 0.630 | 0.734 | 0.787 | 0.851 |
| z(top-1) statistic only | random | 10% | 0.718 | 0.842 | 0.902 | 0.959 |
| z(top-1) statistic only | random | 20% | 0.865 | 0.974 | 0.994 | 1.000 |
| z(top-1) statistic only | selective | 5% | 0.638 | 0.733 | 0.780 | 0.859 |
| z(top-1) statistic only | selective | 10% | 0.706 | 0.837 | 0.908 | 0.963 |
| z(top-1) statistic only | selective | 20% | 0.867 | 0.976 | 0.994 | 1.000 |
| z(top-1) statistic only | subtle | 5% | 0.553 | 0.575 | 0.611 | 0.620 |
| z(top-1) statistic only | subtle | 10% | 0.574 | 0.621 | 0.650 | 0.697 |
| z(top-1) statistic only | subtle | 20% | 0.638 | 0.710 | 0.763 | 0.824 |
| Statistical baseline | random | 5% | 0.647 | 0.737 | 0.779 | 0.855 |
| Statistical baseline | random | 10% | 0.744 | 0.848 | 0.909 | 0.959 |
| Statistical baseline | random | 20% | 0.888 | 0.976 | 0.994 | 1.000 |
| Statistical baseline | selective | 5% | 0.721 | 0.833 | 0.895 | 0.959 |
| Statistical baseline | selective | 10% | 0.820 | 0.949 | 0.981 | 0.998 |
| Statistical baseline | selective | 20% | 0.950 | 0.998 | 1.000 | 1.000 |
| Statistical baseline | subtle | 5% | 0.562 | 0.588 | 0.610 | 0.634 |
| Statistical baseline | subtle | 10% | 0.606 | 0.648 | 0.699 | 0.746 |
| Statistical baseline | subtle | 20% | 0.670 | 0.760 | 0.816 | 0.898 |
| Stockfish+Maia+Sequence-XGB | random | 5% | 0.730 | 0.840 | 0.884 | 0.943 |
| Stockfish+Maia+Sequence-XGB | random | 10% | 0.811 | 0.919 | 0.967 | 0.993 |
| Stockfish+Maia+Sequence-XGB | random | 20% | 0.933 | 0.993 | 0.999 | 1.000 |
| Stockfish+Maia+Sequence-XGB | selective | 5% | 0.813 | 0.928 | 0.967 | 0.994 |
| Stockfish+Maia+Sequence-XGB | selective | 10% | 0.900 | 0.987 | 0.997 | 1.000 |
| Stockfish+Maia+Sequence-XGB | selective | 20% | 0.980 | 1.000 | 1.000 | 1.000 |
| Stockfish+Maia+Sequence-XGB | subtle | 5% | 0.629 | 0.669 | 0.715 | 0.781 |
| Stockfish+Maia+Sequence-XGB | subtle | 10% | 0.697 | 0.774 | 0.832 | 0.903 |
| Stockfish+Maia+Sequence-XGB | subtle | 20% | 0.801 | 0.920 | 0.965 | 0.991 |

## Baseline z-statistics on original test player-games

Mean ≈ 0 and SD ≈ 1 are largely implied by the κ estimation; they do not validate normal tails.

| Statistic | n | Mean | SD | z > 2 (N(0,1)) | z > 3 (N(0,1)) |
|---|---:|---:|---:|---:|---:|
| `z_t1` | 605 | 0.02 | 1.04 | 3.31% (2.27%) | 0.17% (0.14%) |
| `z_t3` | 605 | 0.02 | 0.97 | 2.15% (2.27%) | 0.00% (0.14%) |
| `z_loss` | 605 | 0.00 | 1.07 | 2.48% (2.27%) | 0.17% (0.14%) |
| `z_t1_hard` | 605 | 0.04 | 0.99 | 3.64% (2.27%) | 0.99% (0.14%) |
| `z_maia` | 605 | 0.05 | 0.88 | 2.31% (2.27%) | 0.33% (0.14%) |

## Regression: synthetic-equivalent assistance estimate by true level (full model D)

| Nominal level | Mean realized α | Mean estimate | MAE (pp) |
|---:|---:|---:|---:|
| 0% | 0.000 | 0.082 | 8.2 |
| 5% | 0.061 | 0.105 | 4.8 |
| 10% | 0.100 | 0.124 | 4.6 |
| 20% | 0.198 | 0.188 | 6.9 |
| 40% | 0.397 | 0.358 | 9.5 |
| 70% | 0.622 | 0.581 | 8.0 |

## Top global SHAP features (model D classifier, mean |SHAP| on test)

| Feature | mean abs SHAP |
|---|---:|
| `nonhuman_engine_rate` | 0.6740 |
| `triple_rate` | 0.6200 |
| `z_t1_hard` | 0.2985 |
| `z_t3` | 0.2207 |
| `z_t1` | 0.2127 |
| `triple_count` | 0.1724 |
| `mean_surprisal` | 0.0875 |
| `t1_rate` | 0.0814 |
| `z_maia` | 0.0812 |
| `frac_maia_p_lt05` | 0.0785 |
| `frac_near_opt` | 0.0665 |
| `mean_log_ratio_maia_top1` | 0.0630 |
| `t3_rate` | 0.0601 |
| `corr_diff_t1` | 0.0600 |
| `acc_hard` | 0.0512 |

## Decision-level explanation model

Test ROC-AUC 0.926, PR-AUC 0.808 (positive rate 0.256); by strategy: random 0.921, selective 0.950, subtle 0.915.
