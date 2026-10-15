"""Deterministic research-explanation generator.

It ONLY verbalizes structured, already-computed outputs (numbers passed in). It never computes,
alters or invents a score. Every sentence is a template filled with values from the input dict.
"""

from __future__ import annotations

FEATURE_TEXT = {
    "z_t1": "top-1 engine match relative to projection (z)",
    "z_t3": "top-3 engine match relative to projection (z)",
    "z_loss": "move loss relative to projection (z)",
    "z_t1_hard": "top-1 match in hard positions relative to projection (z)",
    "t1_rate": "top-1 engine match rate",
    "t3_rate": "top-3 engine match rate",
    "mean_loss": "mean move loss",
    "n_dec": "number of eligible decisions",
    "elo": "player rating",
    "opp_elo": "opponent rating",
    "t5_rate": "top-5 engine match rate",
    "median_loss": "median move loss",
    "std_loss": "variability of move loss",
    "frac_loss_ge100": "share of moves losing >= 100 cp",
    "frac_loss_ge300": "share of moves losing >= 300 cp",
    "mean_rank": "mean Stockfish rank of chosen moves",
    "frac_near_opt": "share of near-optimal moves (<= 25 cp)",
    "mean_abs_eval": "mean absolute evaluation",
    "mean_gap12": "mean best-vs-second gap",
    "mean_surprisal": "mean human surprisal (Maia-3)",
    "median_surprisal": "median human surprisal (Maia-3)",
    "mean_maia_p": "mean human likelihood of chosen moves",
    "maia_t1_rate": "agreement with Maia-3's most likely human move",
    "maia_t3_rate": "share of moves in Maia-3's top 3",
    "frac_maia_p_lt05": "share of moves with human likelihood < 5%",
    "frac_maia_p_lt02": "share of moves with human likelihood < 2%",
    "excess_surprisal": "surprisal above the human-model expectation",
    "z_maia": "human-model surprisal relative to projection (z)",
    "nonhuman_engine_rate": "engine-best choices where the likely human move differs",
    "mean_log_ratio_maia_top1": "log-likelihood relative to the most likely human move",
    "longest_t1_streak": "longest run of consecutive top-1 matches",
    "longest_t1_streak_frac": "longest top-1 run as a share of decisions",
    "roll_t1_max": "peak rolling top-1 agreement (8 decisions)",
    "roll_t1_std": "variability of rolling top-1 agreement",
    "roll_loss_min": "lowest rolling move loss (8 decisions)",
    "roll_surprisal_max": "peak rolling human surprisal (8 decisions)",
    "acc_easy": "top-1 accuracy in ordinary positions",
    "acc_hard": "top-1 accuracy in hard positions",
    "crit_lift": "critical accuracy lift (hard minus ordinary)",
    "corr_diff_t1": "correlation of difficulty with engine agreement",
    "corr_diff_loss": "correlation of difficulty with move quality",
    "triple_rate": "rate of engine-best, hard, low-human-likelihood moves",
    "triple_count": "count of engine-best, hard, low-human-likelihood moves",
    "longest_nonhuman_streak": "longest run of engine-best but non-human-typical choices",
    # decision-level model
    "sf_rank": "Stockfish rank of the move",
    "cpl": "centipawn loss of the move",
    "gap12": "best-vs-second-best gap",
    "near_opt": "number of near-optimal alternatives",
    "difficulty": "position difficulty",
    "n_legal": "number of legal moves",
    "abs_eval": "absolute evaluation",
    "maia_p": "human likelihood (Maia-3)",
    "maia_rank": "Maia-3 rank of the move",
    "surprisal": "human surprisal",
    "maia_entropy": "human-model uncertainty (entropy)",
    "maia_p_best": "human likelihood of the engine-best move",
    "maia_sf_agree": "whether the likely human move is engine-best",
}


def _fmt_pct(x: float) -> str:
    return f"{100 * x:.0f}%"


def game_explanation(d: dict) -> list[str]:
    """d: {elo, n, pvo: rows, scores: {...}, alpha_est, shap_top: [(feature, value, contribution)]}"""
    out = []
    t1 = next((r for r in d["pvo"] if r["metric"] == "Top-1 engine match"), None)
    if t1:
        out.append(
            f"Across {t1['n']} eligible decisions, the player matched Stockfish's first choice "
            f"{_fmt_pct(t1['observed'])} of the time against a projected {_fmt_pct(t1['projected'])} "
            f"for this rating and these positions (z = {t1['z']:+.2f}).")
    hard = next((r for r in d["pvo"] if r["metric"] == "Top-1 match, hard positions"), None)
    if hard:
        out.append(
            f"In the {hard['n']} hardest positions, top-1 agreement was {_fmt_pct(hard['observed'])} "
            f"versus {_fmt_pct(hard['projected'])} projected (z = {hard['z']:+.2f}).")
    hs = next((r for r in d["pvo"] if r["metric"].startswith("Human surprisal")), None)
    if hs:
        word = "more" if hs["observed"] > hs["projected"] else "less"
        out.append(
            f"Maia-3 found the chosen moves {word} surprising than its own expectation for this rating "
            f"({hs['observed']:.2f} vs {hs['projected']:.2f} nats per move, z = {hs['z']:+.2f}).")
    s = d.get("scores", {})
    if s:
        out.append(
            "Model scores (similarity to controlled synthetic assistance, not a probability of cheating): "
            + ", ".join(f"{k} {v:.2f}" for k, v in s.items()) + ".")
    if d.get("alpha_est") is not None:
        out.append(f"The synthetic-equivalent assistance estimate is {_fmt_pct(d['alpha_est'])} of eligible decisions.")
    if d.get("shap_top"):
        ups = [f for f in d["shap_top"] if f[2] > 0][:3]
        downs = [f for f in d["shap_top"] if f[2] < 0][:2]
        if ups:
            out.append("Largest contributions toward the assisted pattern: "
                       + "; ".join(f"{FEATURE_TEXT.get(f, f)} ({v:.3g})" for f, v, _ in ups) + ".")
        if downs:
            out.append("Largest contributions toward the human pattern: "
                       + "; ".join(f"{FEATURE_TEXT.get(f, f)} ({v:.3g})" for f, v, _ in downs) + ".")
    return out


def move_explanation(m: dict) -> list[str]:
    """m: one timeline row plus optional decision-model output {dm_score, dm_shap}."""
    out = []
    rank = m["sf_rank"]
    rank_txt = f"Stockfish's #{rank} choice" if not m.get("sf_rank_censored") else "outside Stockfish's top 5"
    out.append(f"{m['move_no']}{'.' if m['color'] == 'white' else '...'} {m.get('display_san') or m['move']} "
               f"was {rank_txt}, losing {m['cpl']:.0f} cp.")
    if m.get("maia_p") is not None:
        out.append(f"Maia-3 assigns this move a predicted probability of {100 * m['maia_p']:.1f}% for a player "
                   f"of this rating (Maia rank #{m['maia_rank']}, surprisal {m['surprisal']:.2f} nats).")
    if m.get("difficulty") is not None:
        out.append(f"Position difficulty is {m['difficulty']:.2f} (projected top-1 probability "
                   f"{1 - m['difficulty']:.2f}).")
    if m.get("flag_triple"):
        out.append("This decision combines engine-best play, a hard position and low human likelihood.")
    if m.get("dm_score") is not None:
        out.append(f"The decision-level model scores this move {m['dm_score']:.2f} for resemblance to a "
                   f"synthetic substitution.")
    if m.get("dm_shap"):
        top = sorted(m["dm_shap"], key=lambda r: -abs(r["contribution"]))[:3]
        out.append("Main drivers: " + "; ".join(
            f"{FEATURE_TEXT.get(r['feature'], r['feature'])} ({r['contribution']:+.2f})" for r in top) + ".")
    return out
