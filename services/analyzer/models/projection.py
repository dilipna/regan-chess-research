"""Regan-INSPIRED projected-vs-observed baseline.

This is NOT Kenneth Regan's model. His IR (Intrinsic Ratings) analyzer reads Multi-PV engine analysis
(AIF files), scales engine move utilities across search depths, and generates a probability p_i for every
legal move from Elo-trained player parameters s (sensitivity), c (consistency) and h (heave/nudge); it
reports projected-vs-actual T1-match, EV-match, ASD, IPR and EWN-weighted statistics. His calibration is
not public and none of it is reproduced here.
We use a simpler, fully documented, *empirical* projection with the same statistical shape:

1. Difficulty model.  Logistic regression  P(top-1 match | Stockfish position features, Elo)
   fitted on clean human decisions of the TRAINING split only.
   position difficulty := 1 - P_hat(top-1).
2. Projection table.  Cells = Elo band x difficulty decile. For each cell, the mean and variance
   of top-1 match, top-3 match and capped move loss among training human decisions.
3. For a player-game with eligible decisions i=1..n:
       projected T1 = sum_i p_i,   Var = sum_i p_i (1 - p_i)     (independence assumption)
       z = (observed - projected) / sqrt(kappa * Var)
   kappa is a variance-inflation factor estimated on VALIDATION clean games so that clean z
   has unit variance (decisions within a game are not independent).
Same construction for top-3 match and for capped move loss (sign: positive z = lower loss than
projected, i.e. 'better than expected').
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

from .. import config

LOSS_CAP = 300.0
PHASES = ["opening", "middlegame", "endgame"]


def position_design(df: pd.DataFrame) -> np.ndarray:
    """Stockfish-only position features + player Elo (no move-choice information)."""
    elo = (df["elo"].astype(float) - 1700) / 400
    gap = np.log1p(df["gap12"].clip(lower=0, upper=600).astype(float))
    near = df["near_opt"].astype(float)
    cols = [
        elo, elo ** 2, gap, gap ** 2, gap * elo,
        np.log(df["n_legal"].astype(float)),
        df["eval_before"].abs().astype(float) / 100,
        np.log1p(df["eval_swing"].astype(float)),
    ]
    cols += [(near == k).astype(float) for k in (1, 2, 3, 4)]
    cols += [(df["phase"] == p).astype(float) for p in PHASES[:2]]
    return np.column_stack(cols)


@dataclass
class ProjectionModel:
    scaler: StandardScaler | None = None
    clf: LogisticRegression | None = None
    decile_edges: list[float] = field(default_factory=list)
    table: dict = field(default_factory=dict)      # (band, decile) -> stats
    kappa: dict = field(default_factory=lambda: {"t1": 1.0, "t3": 1.0, "loss": 1.0,
                                                  "t1_hard": 1.0, "maia": 1.0})
    hard_threshold: float = 0.0   # difficulty above this = "hard" (top tercile, training)
    easy_threshold: float = 0.0   # difficulty below this = "easy" (bottom tercile, training)

    # ---------------------------------------------------------------- fitting
    def fit(self, dec: pd.DataFrame) -> "ProjectionModel":
        """dec: clean human eligible decisions from the training split, with columns
        top1, top3, loss (played move) plus position columns."""
        X = position_design(dec)
        self.scaler = StandardScaler().fit(X)
        self.clf = LogisticRegression(max_iter=2000, C=1.0).fit(self.scaler.transform(X), dec["top1"])
        diff = self.difficulty(dec)
        self.decile_edges = list(np.quantile(diff, np.linspace(0, 1, 11))[1:-1])
        self.hard_threshold = float(np.quantile(diff, 2 / 3))
        self.easy_threshold = float(np.quantile(diff, 1 / 3))
        cells = self._cells(dec, diff)
        decile = np.searchsorted(self.decile_edges, diff, side="right")
        tmp = dec.assign(_cell=cells, _dec=decile)

        def stats(g):
            return {"n": int(len(g)), "t1": float(g["top1"].mean()), "t3": float(g["top3"].mean()),
                    "ev": float(g["ev"].mean()) if "ev" in g else float("nan"),
                    "loss_mean": float(g["loss"].mean()), "loss_var": float(g["loss"].var(ddof=1))}

        # cells with < MIN_CELL training decisions fall back to the pooled difficulty decile
        pooled = {int(k): stats(g) for k, g in tmp.groupby("_dec")}
        self.table = {}
        for cell, g in tmp.groupby("_cell"):
            s = stats(g)
            if s["n"] < self.MIN_CELL:
                s = dict(pooled[int(cell.split("|")[1])], n=s["n"], pooled=True)
            self.table[cell] = s
        self.table.update({f"pooled|{k}": v for k, v in pooled.items()})
        return self

    MIN_CELL = 30

    def difficulty(self, df: pd.DataFrame) -> np.ndarray:
        X = self.scaler.transform(position_design(df))
        return 1.0 - self.clf.predict_proba(X)[:, 1]

    def _cells(self, df: pd.DataFrame, diff: np.ndarray) -> list[str]:
        dec = np.searchsorted(self.decile_edges, diff, side="right")
        bands = [config.elo_band(e) for e in df["elo"]]
        return [f"{b}|{d}" for b, d in zip(bands, dec)]

    def expectations(self, df: pd.DataFrame, diff: np.ndarray | None = None) -> pd.DataFrame:
        """Per-decision projected values (position-level; independent of the move chosen)."""
        if diff is None:
            diff = self.difficulty(df)
        cells = self._cells(df, diff)
        # unseen cell (e.g. Elo outside training bands) -> pooled decile statistics
        rows = [self.table.get(c) or self.table[f"pooled|{c.split('|')[1]}"] for c in cells]
        return pd.DataFrame({
            "difficulty": diff,
            "p_t1": [r["t1"] for r in rows], "p_t3": [r["t3"] for r in rows],
            "p_ev": [r.get("ev", float("nan")) for r in rows],
            "mu_loss": [r["loss_mean"] for r in rows], "var_loss": [r["loss_var"] for r in rows],
        }, index=df.index)

    # ---------------------------------------------------------------- scoring
    @staticmethod
    def _z(obs: float, proj: float, var: float, kappa: float) -> float:
        if var <= 0:
            return 0.0
        return float((obs - proj) / math.sqrt(kappa * var))

    def raw_stats(self, top1, top3, loss, p_t1, p_t3, mu_loss, var_loss, difficulty, ev=None, p_ev=None) -> dict:
        top1, top3, loss = map(np.asarray, (top1, top3, loss))
        p_t1, p_t3, mu_loss, var_loss, difficulty = map(np.asarray, (p_t1, p_t3, mu_loss, var_loss, difficulty))
        n = len(top1)
        hard = difficulty >= self.hard_threshold
        out = {
            "n": n,
            "t1_obs": float(top1.sum()), "t1_proj": float(p_t1.sum()), "t1_var": float((p_t1 * (1 - p_t1)).sum()),
            "t3_obs": float(top3.sum()), "t3_proj": float(p_t3.sum()), "t3_var": float((p_t3 * (1 - p_t3)).sum()),
            "loss_obs": float(loss.sum()), "loss_proj": float(mu_loss.sum()), "loss_var": float(var_loss.sum()),
            "n_hard": int(hard.sum()),
            "t1h_obs": float(top1[hard].sum()), "t1h_proj": float(p_t1[hard].sum()),
            "t1h_var": float((p_t1[hard] * (1 - p_t1[hard])).sum()),
        }
        if ev is not None and p_ev is not None:
            ev, p_ev = np.asarray(ev, float), np.asarray(p_ev, float)
            out.update({"ev_obs": float(ev.sum()), "ev_proj": float(p_ev.sum()),
                        "ev_var": float((p_ev * (1 - p_ev)).sum())})
        return out

    def zscores(self, s: dict) -> dict:
        k = self.kappa
        return {
            "z_t1": self._z(s["t1_obs"], s["t1_proj"], s["t1_var"], k["t1"]),
            "z_t3": self._z(s["t3_obs"], s["t3_proj"], s["t3_var"], k["t3"]),
            # sign flipped: positive = less loss than projected
            "z_loss": self._z(s["loss_proj"], s["loss_obs"], s["loss_var"], k["loss"]),
            "z_t1_hard": self._z(s["t1h_obs"], s["t1h_proj"], s["t1h_var"], k["t1_hard"]),
        }

    def calibrate_kappa(self, raw: list[dict], maia_raw: list[tuple[float, float]] | None = None):
        """Estimate variance inflation on clean validation player-games."""
        def infl(o, p, v):
            z = [(a - b) / math.sqrt(c) for a, b, c in zip(o, p, v) if c > 0]
            return float(max(np.var(z), 1e-6)) if len(z) > 10 else 1.0
        self.kappa["t1"] = infl([r["t1_obs"] for r in raw], [r["t1_proj"] for r in raw], [r["t1_var"] for r in raw])
        self.kappa["t3"] = infl([r["t3_obs"] for r in raw], [r["t3_proj"] for r in raw], [r["t3_var"] for r in raw])
        self.kappa["loss"] = infl([r["loss_proj"] for r in raw], [r["loss_obs"] for r in raw], [r["loss_var"] for r in raw])
        if raw and "ev_obs" in raw[0]:
            self.kappa["ev"] = infl([r["ev_obs"] for r in raw], [r["ev_proj"] for r in raw], [r["ev_var"] for r in raw])
        self.kappa["t1_hard"] = infl([r["t1h_obs"] for r in raw], [r["t1h_proj"] for r in raw], [r["t1h_var"] for r in raw])
        if maia_raw:
            z = [num / math.sqrt(v) for num, v in maia_raw if v > 0]
            self.kappa["maia"] = float(max(np.var(z), 1e-6))

    # ---------------------------------------------------------------- io
    def to_json(self) -> dict:
        return {
            "scaler_mean": self.scaler.mean_.tolist(), "scaler_scale": self.scaler.scale_.tolist(),
            "coef": self.clf.coef_.tolist(), "intercept": self.clf.intercept_.tolist(),
            "decile_edges": self.decile_edges, "table": self.table, "kappa": self.kappa,
            "hard_threshold": self.hard_threshold, "easy_threshold": self.easy_threshold,
        }

    @classmethod
    def from_json(cls, d: dict) -> "ProjectionModel":
        m = cls()
        m.scaler = StandardScaler()
        m.scaler.mean_ = np.array(d["scaler_mean"]); m.scaler.scale_ = np.array(d["scaler_scale"])
        m.scaler.var_ = m.scaler.scale_ ** 2; m.scaler.n_features_in_ = len(m.scaler.mean_)
        m.clf = LogisticRegression()
        m.clf.coef_ = np.array(d["coef"]); m.clf.intercept_ = np.array(d["intercept"])
        m.clf.classes_ = np.array([0, 1])
        m.decile_edges = d["decile_edges"]; m.table = d["table"]; m.kappa = d["kappa"]
        m.hard_threshold = d["hard_threshold"]; m.easy_threshold = d["easy_threshold"]
        return m

    def save(self, path):
        with open(path, "w") as fh:
            json.dump(self.to_json(), fh)

    @classmethod
    def load(cls, path) -> "ProjectionModel":
        with open(path) as fh:
            return cls.from_json(json.load(fh))
