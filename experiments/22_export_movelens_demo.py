"""Static data for the MoveLens presentation (three curated positions, every value read from stored artifacts).

For each position: the statistical model's real inputs and outputs (Stockfish 19 lines, the projection
model's position features, difficulty, projected P(engine #1), P(top-3), expected loss, and the player-game's
z(top-1) on the original game), Maia-3 79M's full legal-move distribution, and Qwen3-8B-Base scores ONLY if
they exist in data/interim/qwen_local_demo/scores.jsonl (written by experiments/23_qwen_local_demo.py with the
frozen prompt and the frozen scorer). Without that file every Qwen field is null ("Not yet evaluated").

Candidate pool (fixed before any Qwen output was seen): the six curated examples (experiments/20) plus the
decision chosen by the "stat-vs-maia" rule below over all 12,863 held-out test decisions.

Example rules:
  agree         statistical label "expected", Maia-3 rank of the played move <= 3, and (if Qwen exists)
                Qwen rank of the played move <= 3; prefer the featured position, else highest Maia probability
  stat-vs-maia  over the whole test split: played == Stockfish #1, projected P(engine #1) <= 0.25 (so the
                statistical model calls the match unusual), Maia-3 probability of the played move in
                [0.5, 0.95], >= 20 legal moves; highest Maia probability (tie: position_id)
  qwen-vs-maia  needs Qwen: largest Jensen-Shannon divergence between Qwen and Maia-3 among the scored pool
                positions not used by the other two examples

Output: apps/web/public/data/movelens_demo.json (+ copy in data/artifacts/)
"""

from __future__ import annotations

import importlib.util
import json
import math
import pickle
import sys
import time
from pathlib import Path

import chess
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services"))
from analyzer import config  # noqa: E402
from analyzer.compare.dists import entropy, maia_dist, rank_of, validate  # noqa: E402
from analyzer.qwen.prompt import PROMPT_HASH, build_prompt, position_from_decision, prompt_spec  # noqa: E402
from analyzer.qwen.scorer import QWEN_MODEL_ID, QWEN_REVISION, normalize  # noqa: E402

SCRIPT = "experiments/22_export_movelens_demo.py"
QWEN_LOCAL = config.INTERIM / "qwen_local_demo" / "scores.jsonl"
QWEN_RUNTIME = config.INTERIM / "qwen_local_demo" / "runtime.json"
_spec = importlib.util.spec_from_file_location("curated", ROOT / "experiments" / "20_export_curated_examples.py")
curated = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(curated)

# Presentation rule for the one-word statistical reading of a single move (shown with its rule on the site):
# probability the model assigned to what actually happened (engine #1 played or not).
UNUSUAL_BELOW, UNEXPECTED_BELOW = 0.25, 0.50


def r6(x):
    return None if x is None or (isinstance(x, float) and (math.isnan(x) or math.isinf(x))) else round(float(x), 6)


def stat_label(engine_match: bool, p_t1: float) -> tuple[float, str]:
    p_obs = p_t1 if engine_match else 1.0 - p_t1
    return p_obs, ("unusual" if p_obs < UNUSUAL_BELOW else "somewhat unexpected" if p_obs < UNEXPECTED_BELOW else "expected")


def load_local_qwen() -> dict[str, dict]:
    if not QWEN_LOCAL.exists():
        return {}
    out = {}
    for line in QWEN_LOCAL.read_text(encoding="utf-8").splitlines():
        r = json.loads(line)
        assert r["model_id"] == QWEN_MODEL_ID and r["revision"] == QWEN_REVISION, "refusing to mix models"
        assert r["prompt_hash"] == PROMPT_HASH["regan_aligned"], "prompt hash differs from the frozen prompt"
        r["prob"] = normalize(r["logprob"])
        out[r["position_id"]] = r
    return out


def top(dist: dict[str, float], fen: str, k: int = 3) -> list[dict]:
    b = chess.Board(fen)
    return [{"move": m, "san": b.san(chess.Move.from_uci(m)), "p": r6(p), "rank": i + 1}
            for i, (m, p) in enumerate(sorted(dist.items(), key=lambda kv: (-kv[1], kv[0]))[:k])]


def build(d: dict, gid: str, q: dict | None, z_game: float | None, role: str, title: str, rule: str) -> dict:
    fen, played = d["fen"], d["played"]
    b = chess.Board(fen)
    san = lambda m: b.san(chess.Move.from_uci(m))  # noqa: E731
    M = validate(maia_dist("M", gid, d["ply"]), fen, "M")
    lines = [{"move": l["move"], "san": san(l["move"]), "cp": l["cp"]} for l in d["sf_lines"]]
    sf_rank = next((i + 1 for i, l in enumerate(lines) if l["move"] == played), None)
    match = sf_rank == 1
    p_obs, label = stat_label(match, float(d["p_t1"]))
    out = {
        "role": role, "title": title, "rule": rule, "position_id": f"{gid}:{d['ply']}", "fen": fen,
        "move_no": d["move_no"], "color": d["color"], "elo": int(d["elo"]), "opp_elo": int(d["opp_elo"]),
        "played": played, "played_san": d["san"], "n_legal": int(d["n_legal"]),
        "stockfish": {"lines": lines, "played_rank": sf_rank,
                      "played_loss_cp": (lines[0]["cp"] - lines[sf_rank - 1]["cp"]) if sf_rank else None},
        "statistical": {
            "features": {"elo": int(d["elo"]), "eval_before_cp": d["eval_before"], "gap12_cp": d["gap12"],
                         "near_optimal_moves": int(d["near_opt"]), "legal_moves": int(d["n_legal"]),
                         "eval_swing_cp": d["eval_swing"], "phase": d["phase"]},
            "difficulty": r6(d["difficulty"]), "p_t1": r6(d["p_t1"]), "p_t3": r6(d["p_t3"]),
            "expected_loss_cp": r6(d["mu_loss"]), "engine_match": match, "p_observed_outcome": r6(p_obs), "label": label,
            "game_z_t1_original": r6(z_game),
        },
        "maia": {"played_p": r6(M[played]), "played_rank": rank_of(M, played), "top3": top(M, fen), "entropy": r6(entropy(M))},
        "qwen": None,
        "qwen_prompt": build_prompt(position_from_decision(d))[0],
    }
    if q:
        Q = validate(q["prob"], fen, "Q")
        out["qwen"] = {"played_p": r6(Q[played]), "played_rank": rank_of(Q, played), "top3": top(Q, fen),
                       "played_logprob": r6(q["logprob"][played]), "played_n_tokens": q["n_tokens"][played],
                       "entropy": r6(entropy(Q)), "js_vs_maia": r6(curated.js_divergence(Q, M))}
    return out


def pool_ids() -> tuple[list[str], str, str]:
    """(pool position ids, featured id, stat-vs-maia id) -- independent of any Qwen output."""
    cur = json.loads((config.ARTIFACTS / "curated_examples.json").read_text())
    ids = [e["position"]["position_id"] for e in cur["examples"] if e["position"]]
    featured = next(e["position"]["position_id"] for e in cur["examples"] if e["id"] == "engine-substitute")
    tg = pd.read_parquet(config.INTERIM / "three_model" / "targets_test.parquet", columns=["position_id", "source_game_id"])
    test_ids = set(tg["position_id"])
    with open(config.PROCESSED / "decisions.pkl", "rb") as fh:
        decs = pickle.load(fh)
    best = None
    for gid in sorted(set(tg["source_game_id"])):
        for d in decs[gid]:
            pid = f"{gid}:{d['ply']}"
            if not d["eligible"] or pid not in test_ids or d["played"] != d["sf_lines"][0]["move"] or d["p_t1"] > 0.25 or d["n_legal"] < 20:
                continue
            p = maia_dist("M", gid, d["ply"])[d["played"]]
            if 0.5 <= p <= 0.95 and (best is None or (-p, pid) < (-best[0], best[1])):
                best = (p, pid)
    assert best is not None
    return ids + [best[1]], featured, best[1]


def main():
    ids, featured, svm = pool_ids()
    with open(config.PROCESSED / "decisions.pkl", "rb") as fh:
        decs = pickle.load(fh)
    dec_of = {pid: next(d for d in decs[pid.split(":")[0]] if d["ply"] == int(pid.split(":")[1])) for pid in ids}
    te = pd.read_parquet(config.ARTIFACTS / "test_predictions.parquet", columns=["game_id", "color", "level", "z_t1"])
    z0 = {(r.game_id, r.color): r.z_t1 for r in te[te["level"] == 0].itertuples()}
    q = load_local_qwen()
    have_q = all(pid in q for pid in ids)

    def obj(pid, role, title, rule):
        gid = pid.split(":")[0]
        d = dec_of[pid]
        return build(d, gid, q.get(pid) if have_q else None, z0.get((gid, d["color"])), role, title, rule)

    every = {pid: obj(pid, "", "", "") for pid in ids}

    def agrees(o):
        return o["statistical"]["label"] == "expected" and o["maia"]["played_rank"] <= 3 and (o["qwen"] is None or o["qwen"]["played_rank"] <= 3)

    agree_rule = ("Statistical reading 'expected', Maia-3 rank of the played move <= 3 and, if Qwen was scored, Qwen rank <= 3; "
                  "the featured position if it qualifies, otherwise the qualifying pool position with the highest Maia probability.")
    if agrees(every[featured]):
        agree = featured
    else:
        cands = [p for p in ids if p != svm and agrees(every[p])]
        agree = max(cands, key=lambda p: (every[p]["maia"]["played_p"], p)) if cands else featured
    examples = [obj(agree, "agree", "Models mostly agree", agree_rule),
                obj(svm, "stat-vs-maia", "Statistical model and Maia disagree",
                    "Over all held-out test decisions: the played move is Stockfish's #1 although the statistical model projected only <= 25% for that, "
                    "and Maia-3 gives the played move 50-95%; highest Maia probability.")]
    if have_q:
        rest = [p for p in ids if p not in (agree, svm)]
        qvm = max(rest, key=lambda p: (every[p]["qwen"]["js_vs_maia"], p))
        examples.append(obj(qvm, "qwen-vs-maia", "Qwen and Maia disagree",
                            f"Among the {len(rest)} remaining locally scored demo positions: largest Jensen-Shannon divergence between Qwen's and Maia-3's move distributions."))
    else:
        examples.append({"role": "qwen-vs-maia", "title": "Qwen and Maia disagree", "status": "not-evaluated",
                         "rule": "Needs Qwen3-8B-Base scores; not yet evaluated."})
    runtime = json.loads(QWEN_RUNTIME.read_text()) if (have_q and QWEN_RUNTIME.exists()) else None
    out = {
        "schema": "movelens.demo.v1", "generator": SCRIPT, "generated_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "label_rule": {"quantity": "probability the statistical model assigned to what happened (engine #1 played or not)",
                       "unusual_below": UNUSUAL_BELOW, "somewhat_unexpected_below": UNEXPECTED_BELOW},
        "models": {
            "statistical": {"name": "Regan-inspired statistical model", "code": "services/analyzer/models/projection.py",
                            "method": "logistic-regression difficulty model + Elo band x difficulty decile projection table (training split), "
                                      "kappa-scaled z-scores (validation split). Not KNN."},
            "stockfish": {"version": "Stockfish 19", "depth": 12, "multipv": 5, "threads": 1},
            "maia": {"checkpoint": "UofTCSSLab/Maia3-79M", "revision": "a107d6ceb7b298cb04ae1da4edffe2939858b894"},
            "qwen": {"model_id": QWEN_MODEL_ID, "revision": QWEN_REVISION, "prompt_hash": PROMPT_HASH["regan_aligned"],
                     "prompt": prompt_spec("regan_aligned"), "status": "precomputed-local" if have_q else "not-evaluated",
                     "scope": f"{len(ids)} demo positions only" if have_q else None, "runtime": runtime},
        },
        "examples": examples,
        "pool": ids,
    }
    txt = json.dumps(out, separators=(",", ":"))
    for p in (config.WEB_DATA / "movelens_demo.json", config.ARTIFACTS / "movelens_demo.json"):
        p.write_text(txt, encoding="utf-8")
    for e in examples:
        print(e["role"], e.get("position_id"), e.get("played_san"), e.get("statistical", {}).get("label"),
              (e.get("maia") or {}).get("played_rank"), (e.get("qwen") or {}).get("played_rank") if e.get("qwen") else "-")
    print(f"wrote movelens_demo.json ({len(txt) / 1024:.0f} KB), qwen {'precomputed-local' if have_q else 'not evaluated'}; pool {ids}")


if __name__ == "__main__":
    main()
