"""Linear probes on frozen representations.

Protocol (fixed before any result is seen):
  * fit on TRAIN only: StandardScaler + L2-regularised logistic regression, class-balanced weights;
    the regularisation strength C is chosen by grouped k-fold cross-validation inside TRAIN (groups = EditLens
    source_id when present, so a human text and an AI rewrite of it never sit on both sides of a fold)
  * choose the layer (and pooling) on VALIDATION only
  * evaluate TEST once, at the validation-selected layer and at the final layer (a pre-specified comparison)

A successful probe means: a linear classifier can read information correlated with the human-vs-AI label from this
representation. It does not mean the layer "detects AI", and it does not identify a mechanism.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

DEFAULT_CS = (0.001, 0.01, 0.1, 1.0)


def metrics(y: np.ndarray, p: np.ndarray, threshold: float = 0.5) -> dict:
    from sklearn.metrics import average_precision_score, balanced_accuracy_score, f1_score, roc_auc_score
    y = np.asarray(y).astype(int)
    out = {"n": int(len(y)), "n_ai": int(y.sum()), "n_human": int((1 - y).sum())}
    if len(np.unique(y)) < 2:
        return {**out, "roc_auc": None, "pr_auc": None, "balanced_accuracy": None, "f1": None}
    yhat = (p >= threshold).astype(int)
    return {**out, "roc_auc": float(roc_auc_score(y, p)), "pr_auc": float(average_precision_score(y, p)),
            "balanced_accuracy": float(balanced_accuracy_score(y, yhat)), "f1": float(f1_score(y, yhat, zero_division=0))}


@dataclass
class Probe:
    C: float
    cv_auc: dict
    model: object

    def predict(self, X: np.ndarray) -> np.ndarray:
        return self.model.predict_proba(np.asarray(X, dtype=np.float64))[:, 1]


def _pipeline(C: float, seed: int):
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    return make_pipeline(StandardScaler(), LogisticRegression(C=C, class_weight="balanced", max_iter=2000,
                                                              random_state=seed))


def fit_probe(X: np.ndarray, y: np.ndarray, groups: np.ndarray | None = None, Cs=DEFAULT_CS, folds: int = 3,
              seed: int = 0) -> Probe:
    """Choose C by grouped CV on the training set only, then refit on all training rows."""
    from sklearn.metrics import roc_auc_score
    from sklearn.model_selection import GroupKFold, StratifiedKFold
    X = np.asarray(X, dtype=np.float64)
    y = np.asarray(y).astype(int)
    if groups is not None and len(np.unique(groups)) >= folds:
        splits = list(GroupKFold(n_splits=folds).split(X, y, groups))
    else:
        splits = list(StratifiedKFold(n_splits=folds, shuffle=True, random_state=seed).split(X, y))
    cv = {}
    for C in Cs:
        aucs = []
        for tr, va in splits:
            if len(np.unique(y[va])) < 2:
                continue
            m = _pipeline(C, seed).fit(X[tr], y[tr])
            aucs.append(roc_auc_score(y[va], m.predict_proba(X[va])[:, 1]))
        cv[C] = float(np.mean(aucs)) if aucs else float("nan")
    best = max(cv, key=lambda c: (cv[c], -c))          # ties -> stronger regularisation
    return Probe(C=best, cv_auc={str(k): v for k, v in cv.items()}, model=_pipeline(best, seed).fit(X, y))


def bootstrap_auc_diff(y: np.ndarray, p_a: np.ndarray, p_b: np.ndarray, n: int = 1000, seed: int = 0) -> dict:
    """Paired bootstrap over documents of AUROC(b) - AUROC(a) with fixed predictions (no refitting)."""
    from sklearn.metrics import roc_auc_score
    rng = np.random.default_rng(seed)
    y = np.asarray(y).astype(int)
    diffs = []
    for _ in range(n):
        i = rng.integers(0, len(y), len(y))
        if len(np.unique(y[i])) < 2:
            continue
        diffs.append(roc_auc_score(y[i], p_b[i]) - roc_auc_score(y[i], p_a[i]))
    d = np.array(diffs)
    return {"diff": float(roc_auc_score(y, p_b) - roc_auc_score(y, p_a)), "ci95": [float(np.quantile(d, 0.025)),
            float(np.quantile(d, 0.975))], "n_boot": int(len(d))}


def bootstrap_auc_ci(y: np.ndarray, p: np.ndarray, n: int = 1000, seed: int = 0) -> list[float]:
    from sklearn.metrics import roc_auc_score
    rng = np.random.default_rng(seed)
    y = np.asarray(y).astype(int)
    vals = []
    for _ in range(n):
        i = rng.integers(0, len(y), len(y))
        if len(np.unique(y[i])) >= 2:
            vals.append(roc_auc_score(y[i], p[i]))
    return [float(np.quantile(vals, 0.025)), float(np.quantile(vals, 0.975))]


def length_matched_indices(n_tokens: np.ndarray, y: np.ndarray, bins: int = 10, seed: int = 0) -> np.ndarray:
    """Subsample so both classes have the same count in every token-length decile (decile edges from all rows)."""
    rng = np.random.default_rng(seed)
    edges = np.unique(np.quantile(n_tokens, np.linspace(0, 1, bins + 1)))
    b = np.clip(np.searchsorted(edges, n_tokens, side="right") - 1, 0, len(edges) - 2)
    keep = []
    for k in np.unique(b):
        h = np.where((b == k) & (y == 0))[0]
        a = np.where((b == k) & (y == 1))[0]
        m = min(len(h), len(a))
        if m:
            keep += list(rng.choice(h, m, replace=False)) + list(rng.choice(a, m, replace=False))
    return np.sort(np.array(keep, dtype=int))
