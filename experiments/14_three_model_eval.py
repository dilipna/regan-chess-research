"""Direct three-model comparison: Regan-inspired reconstruction (R) vs Qwen3-8B-Base (Q) vs Maia-3 79M (M),
plus Maia-3 5M (M5, the checkpoint inside the existing hybrid systems) as a secondary row.

Additive: reads existing artifacts, writes only new files. The analysis plan (three_model_plan.py) was
frozen before any test evaluation of the new comparators; its hash is recorded in every output.

TASK 1  Who best predicts genuine human moves?  ORIGINAL test decisions only.
TASK 2  How do the move-prediction signals respond to controlled decision-level substitutions?
        All 9,680 test rows of the existing benchmark; thresholds for low-FPR recall from VALIDATION originals.
Uncertainty: paired source-game cluster bootstrap, 2,000 resamples, conditional on frozen/fitted models
(no refitting), no multiplicity correction.

Consistency checks (abort on failure):
  * every distribution's support equals the legal move set and sums to 1
  * Maia-3 5M mean surprisal recomputed here equals the evaluated feature `mean_surprisal` exactly
  * R's z(top-1) AUC equals the exported A0 value in metrics.json
  * test rows / source games equal the existing benchmark (9,680 rows, 321 source games)

Outputs (data/artifacts/ and apps/web/public/data/):
  three_model_move_prediction.json, three_model_assistance_results.json, three_model_bootstrap.json,
  maia_move_scores.parquet (data/artifacts only)
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import math
import pickle
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, roc_auc_score

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services"))
from analyzer import config  # noqa: E402
from analyzer.compare.dists import (MODEL_LABELS, PROB_FLOOR, entropy, load_qwen, maia_dist,  # noqa: E402
                                    rank_of, surprisal, top_k, validate)

HERE = Path(__file__).resolve().parent
SCRIPT = "experiments/14_three_model_eval.py"
ART, WEB = config.ARTIFACTS, config.WEB_DATA
TM = config.INTERIM / "three_model"
FPRS = [0.01, 0.05]
EPS = 1e-6


def _plan():
    spec = importlib.util.spec_from_file_location("three_model_plan", HERE / "three_model_plan.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.PLAN


PLAN = _plan()
PLAN_HASH = hashlib.sha256(json.dumps(PLAN, sort_keys=True).encode()).hexdigest()
N_BOOT = PLAN["bootstrap"]["n_boot"]
SEED = PLAN["bootstrap"]["seed"]


def balanced_weights(y: np.ndarray) -> np.ndarray:
    pos, neg = y.sum(), len(y) - y.sum()
    return np.where(y == 1, 0.5 / pos, 0.5 / neg) * len(y)


def auc(y, s):
    return float(roc_auc_score(y, s, sample_weight=balanced_weights(y)))


def tpr_at_fpr(neg_val, s, y, fpr):
    thr = float(np.quantile(neg_val, 1 - fpr))
    return {"target_fpr": fpr, "threshold": thr, "tpr": float((s[y == 1] > thr).mean()),
            "test_fpr": float((s[y == 0] > thr).mean())}


def logloss(y, p):
    p = np.clip(p, EPS, 1 - EPS)
    return -(y * np.log(p) + (1 - y) * np.log(1 - p))


# ----------------------------------------------------------------------------------------------- data
def load_dists(split: str, targets: pd.DataFrame) -> dict[str, dict | None]:
    """{model: {position_id: dist}} for the distribution models; None = pending."""
    out: dict[str, dict | None] = {"M": {}, "M5": {}}
    for r in targets.itertuples():
        for m in ("M", "M5"):
            out[m][r.position_id] = validate(maia_dist(m, r.source_game_id, r.ply), r.fen, m)
    for key, cond in (("Q", "regan_aligned"), ("Q0", "position_only")):
        q = load_qwen(cond, split)
        if q is None:
            out[key] = None
            continue
        missing = set(targets["position_id"]) - set(q)
        if missing:
            raise ValueError(f"{key}/{split}: {len(missing)} positions not scored; refusing a partial comparison")
        out[key] = {pid: validate(q[pid]["prob"], fen, key) for pid, fen in zip(targets["position_id"], targets["fen"])}
    return out


def position_metrics(t: pd.DataFrame, dists: dict[str, dict | None]) -> pd.DataFrame:
    """One row per (position, model) with Task-1 quantities. R contributes only the event predictions."""
    rows = []
    for r in t.itertuples():
        sf = list(r.sf_moves)
        y1, y3 = int(r.played_move_uci == sf[0]), int(r.played_move_uci in sf[:3])
        rows.append({"position_id": r.position_id, "game": r.source_game_id, "model": "R", "band": config.elo_band(r.player_elo),
                     "y_t1": y1, "y_t3": y3, "pred_t1": r.p_t1, "pred_t3": r.p_t3})
        for m, D in dists.items():
            if D is None:
                continue
            d = D[r.position_id]
            p = d[r.played_move_uci]
            rk = rank_of(d, r.played_move_uci)
            rows.append({"position_id": r.position_id, "game": r.source_game_id, "model": m,
                         "band": config.elo_band(r.player_elo), "y_t1": y1, "y_t3": y3,
                         "pred_t1": d[sf[0]], "pred_t3": sum(d[x] for x in sf[:3]),
                         "hit1": float(rk == 1), "hit3": float(rk <= 3), "nll": surprisal(p),
                         "brier": 1.0 - 2.0 * p + float(sum(v * v for v in d.values())), "rank": float(rk),
                         "p_played": p, "entropy": entropy(d)})
    df = pd.DataFrame(rows)
    df["t1_logloss"] = logloss(df["y_t1"].to_numpy(), df["pred_t1"].to_numpy())
    df["t1_brier"] = (df["pred_t1"] - df["y_t1"]) ** 2
    df["t3_logloss"] = logloss(df["y_t3"].to_numpy(), df["pred_t3"].to_numpy())
    df["t3_brier"] = (df["pred_t3"] - df["y_t3"]) ** 2
    return df


DIST_METRICS = {"top1_accuracy": "hit1", "top3_accuracy": "hit3", "mean_nll": "nll", "brier_multiclass": "brier",
                "mean_rank": "rank"}
EVENT_METRICS = {"t1_event_logloss": "t1_logloss", "t1_event_brier": "t1_brier",
                 "t3_event_logloss": "t3_logloss", "t3_event_brier": "t3_brier"}
LOWER_IS_BETTER = {"mean_nll", "brier_multiclass", "mean_rank", *EVENT_METRICS}


class GameBootstrap:
    """Resampling weights over source games, shared by every model and metric (paired)."""

    def __init__(self, games: np.ndarray, seed: int, n_boot: int):
        self.games = np.asarray(sorted(set(games)))
        self.index = {g: i for i, g in enumerate(self.games)}
        rng = np.random.default_rng(seed)
        G = len(self.games)
        self.picks = rng.integers(0, G, size=(n_boot, G))
        self.W = np.stack([np.bincount(p, minlength=G) for p in self.picks]).astype(float)

    def means(self, game: pd.Series, values: pd.Series) -> np.ndarray:
        gi = game.map(self.index).to_numpy()
        G = len(self.games)
        s = np.bincount(gi, weights=values.to_numpy(float), minlength=G)
        c = np.bincount(gi, minlength=G).astype(float)
        return (self.W @ s) / (self.W @ c)


def summarize_diff(a_full: float, b_full: float, a_boot: np.ndarray, b_boot: np.ndarray, lower_better: bool) -> dict:
    d = b_boot - a_boot
    return {"a": a_full, "b": b_full, "delta": b_full - a_full,
            "ci95": [float(np.percentile(d, 2.5)), float(np.percentile(d, 97.5))],
            "share_le_0": float((d <= 0).mean()), "lower_is_better": lower_better}


# ----------------------------------------------------------------------------------------------- task 1
def task1(t: pd.DataFrame, dists: dict, boot: GameBootstrap) -> tuple[dict, list[dict]]:
    pm = position_metrics(t, dists)
    models = {}
    status = {m: ("ok" if (m == "R" or dists.get(m) is not None) else "pending") for m in ("R", "Q", "Q0", "M", "M5")}
    for m, st in status.items():
        g = pm[pm["model"] == m]
        res = {"label": MODEL_LABELS[m], "status": st, "metrics": {}, "ci95": {}}
        if st == "ok":
            avail = dict(EVENT_METRICS) if m == "R" else {**DIST_METRICS, **EVENT_METRICS}
            for name in [*DIST_METRICS, *EVENT_METRICS]:
                if name not in avail:
                    res["metrics"][name] = None
                    continue
                col = avail[name]
                res["metrics"][name] = float(g[col].mean())
                b = boot.means(g["game"], g[col])
                res["ci95"][name] = [float(np.percentile(b, 2.5)), float(np.percentile(b, 97.5))]
            if m != "R":
                res["metrics"]["median_rank"] = float(g["rank"].median())
                res["metrics"]["mean_entropy"] = float(g["entropy"].mean())
                res["by_band"] = [{"band": b, "n": int(len(x)), "top1_accuracy": float(x["hit1"].mean()),
                                   "mean_nll": float(x["nll"].mean())} for b, x in g.groupby("band")]
            res["observed_t1_rate"] = float(g["y_t1"].mean())
            res["mean_pred_t1"] = float(g["pred_t1"].mean())
        else:
            res["metrics"] = {k: None for k in [*DIST_METRICS, *EVENT_METRICS, "median_rank"]}
        models[m] = res

    diffs = []
    pairs = [("dist", p) for p in PLAN["bootstrap"]["task1_pairs"]] + [("event", p) for p in PLAN["bootstrap"]["task1_event_pairs"]]
    for kind, (a, b) in pairs:
        for name, col in (DIST_METRICS if kind == "dist" else EVENT_METRICS).items():
            if status[a] != "ok" or status[b] != "ok":
                diffs.append({"task": "task1", "from": a, "to": b, "metric": name, "status": "pending"})
                continue
            ga, gb = pm[pm["model"] == a].set_index("position_id"), pm[pm["model"] == b].set_index("position_id")
            assert ga.index.equals(gb.index)
            ba, bb = boot.means(ga["game"], ga[col]), boot.means(gb["game"], gb[col])
            diffs.append({"task": "task1", "from": a, "to": b, "metric": name, "status": "ok",
                          **summarize_diff(float(ga[col].mean()), float(gb[col].mean()), ba, bb, name in LOWER_IS_BETTER)})
    return models, diffs, pm


# ----------------------------------------------------------------------------------------------- task 2
def variant_scores(rows: pd.DataFrame, choices: dict, decs: dict, dists: dict[str, dict | None]) -> pd.DataFrame:
    """Mean surprisal and mean excess surprisal of each row's chosen moves under each distribution model."""
    by = {}
    out = {f"{k}_{m}": np.full(len(rows), np.nan) for m in dists for k in ("ms", "mxs")}
    for i, vid in enumerate(rows["variant_id"]):
        gid = vid.split(":")[0]
        if gid not in by:
            by[gid] = {d["ply"]: d for d in decs[gid]}
        ch = choices[vid]
        moves = [(gid, p, by[gid][p]["cands"][k]["move"]) for p, k in zip(ch["plies"], ch["choice"])]
        for m, D in dists.items():
            if D is None:
                continue
            s = [surprisal(D[f"{g}:{p}"][mv]) for g, p, mv in moves]
            h = [entropy(D[f"{g}:{p}"]) for g, p, _ in moves]
            out[f"ms_{m}"][i] = float(np.mean(s))
            out[f"mxs_{m}"][i] = float(np.mean(np.array(s) - np.array(h)))
    return rows.assign(**out)


def task2(te, va, dists_te, dists_va, metrics_json, boot_games, seed) -> tuple[dict, list[dict], pd.DataFrame]:
    y = te["label"].to_numpy()
    yv = va["label"].to_numpy()
    scores = {"R": ("z_t1", "z(top-1) of the Regan-inspired reconstruction")}
    for m in ("Q", "Q0", "M", "M5"):
        scores[m] = (f"ms_{m}", "mean surprisal of the chosen moves")
    models = {}
    for m, (col, desc) in scores.items():
        if m != "R" and dists_te.get(m) is None:
            models[m] = {"label": MODEL_LABELS[m], "status": "pending", "score": desc}
            continue
        s, sv = te[col].to_numpy(float), va.loc[yv == 0, col].to_numpy(float)
        res = {"label": MODEL_LABELS[m], "status": "ok", "score": desc, "score_column": col,
               "roc_auc": auc(y, s), "pr_auc": float(average_precision_score(y, s, sample_weight=balanced_weights(y))),
               "tpr_at_fpr": [tpr_at_fpr(sv, s, y, f) for f in FPRS], "by_cell": []}
        clean = te["level"] == 0
        for (st, lv), _ in te[~clean].groupby(["strategy", "level"]):
            msk = (clean | ((te["strategy"] == st) & (te["level"] == lv))).to_numpy()
            res["by_cell"].append({"strategy": st, "level": float(lv), "roc_auc": float(roc_auc_score(y[msk], s[msk]))})
        if m != "R":
            sx = te[f"mxs_{m}"].to_numpy(float)
            res["secondary_excess_surprisal"] = {"roc_auc": auc(y, sx),
                                                 "pr_auc": float(average_precision_score(y, sx, sample_weight=balanced_weights(y)))}
        models[m] = res

    # existing-number consistency: R's AUC must equal the exported A0 value
    a0 = metrics_json["experiments"]["A0_zt1"]["classifier"]["roc_auc"]
    assert abs(models["R"]["roc_auc"] - a0) < 1e-12, (models["R"]["roc_auc"], a0)

    # paired AUC bootstrap over source games
    games = te["game_id"].unique()
    idx = te.groupby("game_id").indices
    rng = np.random.default_rng(seed)
    ok = [m for m in scores if models[m]["status"] == "ok"]
    boot = {m: np.empty(N_BOOT) for m in ok}
    for b in range(N_BOOT):
        pick = rng.choice(games, len(games), replace=True)
        ix = np.concatenate([idx[g] for g in pick])
        for m in ok:
            boot[m][b] = auc(y[ix], te[scores[m][0]].to_numpy(float)[ix])
    for m in ok:
        models[m]["roc_auc_ci95"] = [float(np.percentile(boot[m], 2.5)), float(np.percentile(boot[m], 97.5))]
    diffs = []
    for a, b in PLAN["bootstrap"]["task2_pairs"]:
        if a not in ok or b not in ok:
            diffs.append({"task": "task2", "from": a, "to": b, "metric": "roc_auc", "status": "pending"})
            continue
        diffs.append({"task": "task2", "from": a, "to": b, "metric": "roc_auc", "status": "ok",
                      **summarize_diff(models[a]["roc_auc"], models[b]["roc_auc"], boot[a], boot[b], False)})
    return models, diffs


# ----------------------------------------------------------------------------------------------- main
def main():
    t0 = time.time()
    metrics_json = json.loads((ART / "metrics.json").read_text())
    with open(config.PROCESSED / "decisions.pkl", "rb") as fh:
        decs = pickle.load(fh)
    with open(config.PROCESSED / "variant_choices.pkl", "rb") as fh:
        choices = pickle.load(fh)
    t_te = pd.read_parquet(TM / "targets_test.parquet")
    t_va = pd.read_parquet(TM / "targets_val.parquet")
    d_te, d_va = load_dists("test", t_te), load_dists("val", t_va)
    print("distributions loaded + validated:", {k: (None if v is None else len(v)) for k, v in d_te.items()},
          f"({time.time() - t0:.0f}s)", flush=True)

    # ---------------- Task 1
    boot1 = GameBootstrap(t_te["source_game_id"].to_numpy(), SEED, N_BOOT)
    t1_models, t1_diffs, pm = task1(t_te, d_te, boot1)
    for m, r in t1_models.items():
        print("T1", m, r["status"], {k: (None if v is None else round(v, 4)) for k, v in r["metrics"].items()})

    # ---------------- Task 2
    te = pd.read_parquet(ART / "test_predictions.parquet", columns=["variant_id", "game_id", "color", "label", "strategy",
                                                                      "level", "realized_alpha", "z_t1", "mean_surprisal", "band"])
    va = pd.read_parquet(config.PROCESSED / "variants.parquet", columns=["variant_id", "game_id", "label", "level", "z_t1", "split"])
    va = va[(va["split"] == "val") & (va["level"] == 0)].reset_index(drop=True)
    assert len(te) == metrics_json["dataset"]["n_variants"]["test"] and te["game_id"].nunique() == metrics_json["dataset"]["n_source_games"]["test"]
    te = variant_scores(te, choices, decs, d_te)
    va = variant_scores(va, choices, decs, d_va)
    dev = float(np.abs(te["ms_M5"] - te["mean_surprisal"]).max())
    assert dev < 1e-9, f"Maia-3 5M mean surprisal does not reproduce the evaluated feature (max dev {dev})"
    print(f"check: Maia-3 5M mean surprisal reproduces feature `mean_surprisal` (max |dev| {dev:.1e})")
    t2_models, t2_diffs = task2(te, va, d_te, d_va, metrics_json, None, SEED + 1)
    for m, r in t2_models.items():
        print("T2", m, r["status"], round(r.get("roc_auc", float("nan")), 4), r.get("roc_auc_ci95"))

    gen = {"script": SCRIPT, "plan_version": PLAN["version"], "plan_sha256": PLAN_HASH,
           "generated_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    caveats = [
        "Source games are presumed human; their absence of real assistance is not established.",
        "Substitutions are controlled decision-level substitutions evaluated in the original positions; games are not replayed.",
        "Bootstrap resamples source games with the fitted/frozen models held fixed; refit variability is not captured.",
        "Several comparisons are reported; no multiplicity correction is applied.",
        "The Regan-inspired reconstruction is not Professor Regan's analyzer and outputs no per-move distribution.",
    ]
    compat = [
        {"metric": "Probability for every legal move", "R": False, "Q": True, "M": True},
        {"metric": "Top-1 / top-3 move prediction", "R": False, "Q": True, "M": True},
        {"metric": "Negative log-likelihood of the played move", "R": False, "Q": True, "M": True},
        {"metric": "Multi-class Brier score", "R": False, "Q": True, "M": True},
        {"metric": "Rank of the played move", "R": False, "Q": True, "M": True},
        {"metric": "P(played move = engine's first line) — T1 event", "R": True, "Q": True, "M": True},
        {"metric": "P(played move in engine's top 3) — T3 event", "R": True, "Q": True, "M": True},
        {"metric": "Game-level assistance-sensitive score", "R": True, "Q": True, "M": True},
    ]
    n = {"positions": int(len(t_te)), "source_games": int(t_te["source_game_id"].nunique()),
         "player_games": int(t_te.groupby(["source_game_id", "color"]).ngroups)}
    move_pred = {"generator": gen, "task": "Task 1 — prediction of original (presumed-human) moves, held-out test split",
                 "data": n, "plan": PLAN["task1"], "compatibility": compat, "models": t1_models,
                 "bootstrap": {"n_boot": N_BOOT, "seed": SEED, "cluster": "source game"}, "caveats": caveats}
    assist = {"generator": gen, "task": "Task 2 — response to controlled decision-level substitutions, held-out test split",
              "data": {"rows": int(len(te)), "positives": int(te["label"].sum()), "source_games": int(te["game_id"].nunique()),
                       "val_original_player_games_for_thresholds": int(len(va))},
              "plan": PLAN["task2"], "models": t2_models, "caveats": caveats,
              "consistency_checks": [
                  {"name": "R z(top-1) AUC equals exported A0", "passed": True},
                  {"name": "Maia-3 5M mean surprisal equals evaluated feature", "passed": True, "max_abs_dev": dev}]}
    bootstrap = {"generator": gen, "method": "Paired source-game cluster bootstrap; the same resamples for every model; "
                                             "percentile 95% intervals; conditional on frozen/fitted models (no refit); "
                                             "no multiplicity correction.",
                 "n_boot": N_BOOT, "seed_task1": SEED, "seed_task2": SEED + 1,
                 "n_clusters_task1": n["source_games"], "n_clusters_task2": int(te["game_id"].nunique()),
                 "comparisons": t1_diffs + t2_diffs}

    def _clean(o):
        if isinstance(o, dict):
            return {str(k): _clean(v) for k, v in o.items()}
        if isinstance(o, (list, tuple)):
            return [_clean(v) for v in o]
        if isinstance(o, (np.floating, float)):
            f = float(o)
            return None if (math.isnan(f) or math.isinf(f)) else f
        if isinstance(o, np.integer):
            return int(o)
        if isinstance(o, np.bool_):
            return bool(o)
        return o

    for name, obj in (("three_model_move_prediction.json", move_pred), ("three_model_assistance_results.json", assist),
                      ("three_model_bootstrap.json", bootstrap)):
        txt = json.dumps(_clean(obj), indent=1)
        (ART / name).write_text(txt, encoding="utf-8")
        (WEB / name).write_text(json.dumps(_clean(obj), separators=(",", ":")), encoding="utf-8")
        print("wrote", name)

    # Maia direct-comparator per-position scores (test originals)
    rows = []
    for m in ("M", "M5"):
        g = pm[pm["model"] == m].merge(t_te[["position_id", "source_game_id", "color", "ply", "fen", "player_elo",
                                             "opponent_elo", "side_to_move", "played_move_uci", "candidate_count"]], on="position_id")
        for r in g.itertuples():
            d = d_te[m][r.position_id]
            tk = top_k(d, 5)
            rows.append({"model": MODEL_LABELS[m], "source_game_id": r.source_game_id,
                         "variant_id": f"{r.source_game_id}:{r.color}:none:0", "split": "test", "ply": r.ply, "fen": r.fen,
                         "player_elo": r.player_elo, "opponent_elo": r.opponent_elo, "side_to_move": r.side_to_move,
                         "played_move_uci": r.played_move_uci, "candidate_count": r.candidate_count,
                         "logprob_played": math.log(max(r.p_played, PROB_FLOOR)), "prob_played": r.p_played,
                         "rank_played": int(r.rank), "top1_move": tk[0][0], "top1_probability": tk[0][1],
                         "top5_moves": [x for x, _ in tk], "entropy": r.entropy, "generator": SCRIPT})
    pd.DataFrame(rows).to_parquet(ART / "maia_move_scores.parquet", index=False)
    print(f"wrote maia_move_scores.parquet ({len(rows)} rows); done in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
