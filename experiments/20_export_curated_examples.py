"""Curated demo examples for the professor walkthrough (static; works with no backend).

Every example is a REAL held-out test decision (original, presumed-human move) with stored Stockfish lines,
the Regan-inspired reconstruction's projections and Maia-3 79M's full legal-move distribution. Qwen3-8B-Base
fields are null ("pending") until real Qwen scores exist in data/interim/qwen/regan_aligned/test.jsonl.

Selection is rule-based and deterministic (rules below, frozen in RULES, documented in the artifact). Rules use
ONLY Stockfish / Maia-3 79M / the reconstruction's own outputs -- except the two Qwen rules, which activate only
when real Qwen scores exist. Nothing is chosen to make any model look good or bad; tie-break: position_id.

Examples:
  all-agree          engine #1 = Maia #1 = played move
  engine-vs-maia     played = Maia #1, but Stockfish ranks it >= 2nd and Maia gives Stockfish's #1 little probability
  natural-offbook    played move outside Stockfish's top 5 yet Maia's #1/#2 (a human-natural, engine-unlisted move)
  ambiguous          highest Maia-3 entropy (many plausible moves)
  stat-uncertain     reconstruction's projected P(top-1 match) closest to 0.5
  engine-substitute  the existing featured controlled substitution (selective study; engine #1 that Maia ranks very low)
  qwen-vs-maia       [needs Qwen] largest Jensen-Shannon divergence between Qwen and Maia-3
  qwen-implausible   [needs Qwen] Qwen's top move has Maia-3 rank >= 10, highest Qwen probability

Output: apps/web/public/data/curated_examples.json (+ copy in data/artifacts/)
"""

from __future__ import annotations

import json
import math
import pickle
import sys
import time
from pathlib import Path

import chess
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services"))
from analyzer import config  # noqa: E402
from analyzer.compare.dists import entropy, load_qwen, maia_dist, rank_of, validate  # noqa: E402
from analyzer.qwen.prompt import PROMPT_HASH, build_prompt, position_from_decision  # noqa: E402

SCRIPT = "experiments/20_export_curated_examples.py"
RULES = {
    "all-agree": "played == Stockfish #1 == Maia-3 #1; >= 25 legal moves; |eval| <= 150 cp; Maia-3 probability of the played move in [0.5, 0.95] (not a forced reply); highest such probability",
    "engine-vs-maia": "played == Maia-3 #1 with p in [0.4, 0.95] and Stockfish rank of played in 2..5 with cp loss in [20, 150]; Maia-3 probability of Stockfish #1 <= 0.05; "
                      "maximize Maia p(played) - Maia p(Stockfish #1)",
    "natural-offbook": "played not in Stockfish's top 5 lines; Maia-3 rank of played <= 2 with p <= 0.95 (not a forced reply); |eval| <= 300 cp; highest Maia-3 probability of the played move",
    "ambiguous": "highest Maia-3 entropy among decisions with >= 30 legal moves",
    "stat-uncertain": "reconstruction's projected P(top-1 engine match) closest to 0.5 (maximal uncertainty about whether the engine's first move is played), >= 25 legal moves",
    "engine-substitute": "existing rule: in the selective study, the substituted Stockfish #1 move that Maia-3 5M ranks lowest (see prepared_three_model_demo.json)",
    "qwen-vs-maia": "needs real Qwen scores: maximal Jensen-Shannon divergence between Qwen and Maia-3 79M distributions",
    "qwen-implausible": "needs real Qwen scores: Qwen top-1 move with Maia-3 79M rank >= 10; highest Qwen probability",
}
TITLES = {
    "all-agree": "Everyone agrees",
    "engine-vs-maia": "Engine and Maia disagree",
    "natural-offbook": "A natural human move the engine does not list",
    "ambiguous": "An ambiguous, high-complexity position",
    "stat-uncertain": "Where the statistical baseline is uncertain (P ≈ 0.5)",
    "engine-substitute": "A controlled engine substitution",
    "qwen-vs-maia": "Qwen and Maia disagree",
    "qwen-implausible": "Qwen strongly prefers an implausible move",
}


def r6(x):
    return None if x is None or (isinstance(x, float) and (math.isnan(x) or math.isinf(x))) else round(float(x), 6)


def js_divergence(p: dict[str, float], q: dict[str, float]) -> float:
    keys = sorted(p)
    a = np.array([p[k] for k in keys]); b = np.array([q[k] for k in keys]); m = 0.5 * (a + b)

    def kl(x, y):
        mask = x > 0
        return float((x[mask] * np.log(x[mask] / y[mask])).sum())

    return 0.5 * kl(a, m) + 0.5 * kl(b, m)


def pick(rows: list[dict], key, used: set[str]) -> dict | None:
    """Best row by key (max), tie-break position_id ascending; never reuse a position or a source game."""
    cand = [r for r in rows if r["position_id"] not in used and r["gid"] not in {u.split(":")[0] for u in used}]
    if not cand:
        return None
    return sorted(cand, key=lambda r: (-key(r), r["position_id"]))[0]


def select(rows: list[dict], have_qwen: bool) -> dict[str, dict | None]:
    """Pure selection function over precomputed per-decision summaries (unit-tested)."""
    used: set[str] = set()
    out: dict[str, dict | None] = {}

    def take(name, flt, key):
        r = pick([x for x in rows if flt(x)], key, used)
        out[name] = r
        if r:
            used.add(r["position_id"])

    take("all-agree", lambda r: r["played"] == r["sf1"] == r["m_top"] and r["n_legal"] >= 25 and abs(r["eval"]) <= 150 and 0.5 <= r["m_p_played"] <= 0.95, lambda r: r["m_p_played"])
    take("engine-vs-maia", lambda r: r["played"] == r["m_top"] and r["sf_rank_played"] is not None and 2 <= r["sf_rank_played"] <= 5
         and r["cp_loss"] is not None and 20 <= r["cp_loss"] <= 150 and r["m_p_sf1"] <= 0.05 and 0.4 <= r["m_p_played"] <= 0.95, lambda r: r["m_p_played"] - r["m_p_sf1"])
    take("natural-offbook", lambda r: r["sf_rank_played"] is None and r["m_rank_played"] <= 2 and r["m_p_played"] <= 0.95 and abs(r["eval"]) <= 300, lambda r: r["m_p_played"])
    take("ambiguous", lambda r: r["n_legal"] >= 30, lambda r: r["m_entropy"])
    take("stat-uncertain", lambda r: r["n_legal"] >= 25, lambda r: -abs(r["p_t1"] - 0.5))
    if have_qwen:
        take("qwen-vs-maia", lambda r: r.get("js_qm") is not None, lambda r: r["js_qm"])
        take("qwen-implausible", lambda r: r.get("q_top_maia_rank") is not None and r["q_top_maia_rank"] >= 10, lambda r: r["q_top_p"])
    return out


def summarize(d: dict, gid: str, M: dict[str, float], Q: dict[str, float] | None) -> dict:
    sf = {l["move"]: (i + 1, l["cp"]) for i, l in enumerate(d["sf_lines"])}
    sf1 = d["sf_lines"][0]["move"]
    played = d["played"]
    r = {"position_id": f"{gid}:{d['ply']}", "gid": gid, "ply": d["ply"], "played": played, "sf1": sf1, "n_legal": len(M),
         "eval": float(d["eval_before"]), "m_top": max(M, key=lambda k: (M[k], k)), "m_p_played": M[played], "m_rank_played": rank_of(M, played),
         "m_p_sf1": M[sf1], "m_entropy": entropy(M), "sf_rank_played": sf[played][0] if played in sf else None,
         "cp_loss": (d["sf_lines"][0]["cp"] - sf[played][1]) if played in sf else None,
         "difficulty": float(d["difficulty"]), "p_t1": float(d["p_t1"])}
    if Q is not None:
        r["js_qm"] = js_divergence(Q, M)
        qt = max(Q, key=lambda k: (Q[k], k))
        r["q_top_maia_rank"] = rank_of(M, qt)
        r["q_top_p"] = Q[qt]
    return r


def candidate_rows(d, gid, M, M5, Q, Qlog, Qntok, Q0):
    sf = {l["move"]: (i + 1, l["cp"]) for i, l in enumerate(d["sf_lines"])}
    out = []
    for mv in sorted(M):
        out.append({"move": mv, "san": chess.Board(d["fen"]).san(chess.Move.from_uci(mv)),
                    "sf_rank": sf[mv][0] if mv in sf else None, "sf_cp": sf[mv][1] if mv in sf else None,
                    "maia": r6(M[mv]), "maia_rank": rank_of(M, mv), "maia5": r6(M5[mv]), "maia5_rank": rank_of(M5, mv),
                    "qwen": r6(Q[mv]) if Q else None, "qwen_rank": rank_of(Q, mv) if Q else None,
                    "qwen_logprob": r6(Qlog[mv]) if Q else None, "qwen_n_tokens": Qntok[mv] if Q else None,
                    "qwen_position_only": r6(Q0[mv]) if Q0 else None})
    return out


def position_obj(d, gid, M, M5, q, q0, sub=None, sub_studies=None):
    pid = f"{gid}:{d['ply']}"
    Q = Qlog = Qn = Q0 = None
    if q and pid in q:
        Q = validate(q[pid]["prob"], d["fen"], "Q"); Qlog = q[pid]["logprob"]; Qn = q[pid]["n_tokens"]
    if q0 and pid in q0:
        Q0 = validate(q0[pid]["prob"], d["fen"], "Q0")
    prompt, _ = build_prompt(position_from_decision(d))
    san = lambda mv: chess.Board(d["fen"]).san(chess.Move.from_uci(mv))  # noqa: E731
    return {
        "position_id": pid, "ply": d["ply"], "move_no": d["move_no"], "color": d["color"], "fen": d["fen"],
        "elo": int(d["elo"]), "opp_elo": int(d["opp_elo"]), "n_legal": len(M),
        "original_move": d["played"], "original_san": d["san"],
        "substitute_move": sub, "substitute_san": san(sub) if sub else None, "substituted_in": sub_studies or [],
        "sf_lines": [{"move": l["move"], "cp": l["cp"], "san": san(l["move"])} for l in d["sf_lines"]],
        "eval_before": d["eval_before"], "phase": d["phase"],
        "regan": {"difficulty": r6(d["difficulty"]), "p_t1": r6(d["p_t1"]), "p_t3": r6(d["p_t3"]), "p_ev": r6(d.get("p_ev")),
                  "expected_loss_cp": r6(d["mu_loss"]), "engine_first_move": d["sf_lines"][0]["move"]},
        "entropy": {"maia": r6(entropy(M)), "maia5": r6(entropy(M5)), "qwen": r6(entropy(Q)) if Q else None},
        "qwen_prompt": prompt, "candidates": candidate_rows(d, gid, M, M5, Q, Qlog, Qn, Q0),
    }


def main():
    tg = pd.read_parquet(config.INTERIM / "three_model" / "targets_test.parquet", columns=["position_id", "source_game_id"])
    test_ids = set(tg["position_id"])
    with open(config.PROCESSED / "decisions.pkl", "rb") as fh:
        decs = pickle.load(fh)
    q = load_qwen("regan_aligned", "test")
    q0 = load_qwen("position_only", "test")
    rows, index = [], {}
    for gid in sorted(set(tg["source_game_id"])):
        for d in decs[gid]:
            pid = f"{gid}:{d['ply']}"
            if not d["eligible"] or pid not in test_ids:
                continue
            M = validate(maia_dist("M", gid, d["ply"]), d["fen"], "M")
            Q = validate(q[pid]["prob"], d["fen"], "Q") if q and pid in q else None
            rows.append(summarize(d, gid, M, Q)); index[pid] = d
    assert len(rows) == len(test_ids), (len(rows), len(test_ids))
    have_qwen = bool(q) and all(r.get("js_qm") is not None for r in rows)
    chosen = select(rows, have_qwen)

    # the existing featured controlled substitution (already validated; reused unchanged)
    prep = json.loads((config.ARTIFACTS / "prepared_three_model_demo.json").read_text())
    feat = next(p for p in prep["positions"] if p["ply"] == prep["featured_ply"])

    examples = []
    for name in TITLES:
        if name == "engine-substitute":
            examples.append({"id": name, "title": TITLES[name], "rule": RULES[name], "status": "ok", "source": "prepared_three_model_demo.json",
                             "position": feat})
            continue
        r = chosen.get(name)
        if r is None:
            reason = "needs real Qwen3-8B-Base scores (not yet run)" if name.startswith("qwen-") and not have_qwen else "no decision satisfied the rule"
            examples.append({"id": name, "title": TITLES[name], "rule": RULES[name], "status": "pending", "pending_reason": reason, "position": None})
            continue
        d = index[r["position_id"]]
        gid = r["gid"]
        examples.append({"id": name, "title": TITLES[name], "rule": RULES[name], "status": "ok", "source": "test split, original move",
                         "position": position_obj(d, gid, validate(maia_dist("M", gid, d["ply"]), d["fen"], "M"),
                                                  validate(maia_dist("M5", gid, d["ply"]), d["fen"], "M5"), q, q0)})
    out = {
        "schema": "chessassistlens.curated_examples.v1", "generator": SCRIPT,
        "generated_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "pool": {"split": "test", "decisions": len(rows), "description": "all eligible original (presumed-human) decisions of the held-out test split"},
        "qwen": {"status": "ok" if have_qwen else "pending", "model_id": "Qwen/Qwen3-8B-Base", "prompt_hash": PROMPT_HASH["regan_aligned"]},
        "examples": examples,
        "note": "Rules are fixed in the generator and use only Stockfish, Maia-3 79M and the reconstruction's outputs (Qwen rules activate only with real Qwen scores).",
    }
    txt = json.dumps(out, separators=(",", ":"))
    (config.WEB_DATA / "curated_examples.json").write_text(txt, encoding="utf-8")
    (config.ARTIFACTS / "curated_examples.json").write_text(txt, encoding="utf-8")
    for e in examples:
        p = e["position"]
        print(f"{e['id']:18s} {e['status']:8s} {p['position_id'] if p else '-'} {p['original_san'] if p else ''}")
    print(f"wrote curated_examples.json ({len(txt) / 1024:.0f} KB), pool {len(rows)}, qwen {'ok' if have_qwen else 'pending'}")


if __name__ == "__main__":
    main()
