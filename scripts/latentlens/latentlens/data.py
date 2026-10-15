"""Datasets for the human-vs-AI study: loading, label mapping, deterministic sampling and leakage checks.

Primary dataset: Pangram's EditLens release (`pangram/editlens_iclr` on Hugging Face; gated, non-commercial terms).
Published columns: text_id, text, cosine_score, soft_ngrams_score, text_type, model, source, source_id, source_text, split.
Published splits: train, val, test, test_enron (domain shift: e-mails), test_llama (held-out generator family).

The first LatentLens task is HUMAN-WRITTEN vs FULLY AI-GENERATED. AI-edited (mixed) text is excluded. Label values are
never guessed silently: text_type values that are not listed as human or AI are excluded and reported, and the run
fails if nothing maps.

A generic JSONL format is also accepted (one object per line):
    {"id": ..., "text": ..., "label": "human" | "ai", "generator": ..., "domain": ..., "source": ..., "split": ...}
"""

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path

from .common import stable_hash

HUMAN, AI = 0, 1
DEFAULT_HUMAN_TYPES = ("human_written", "human")
DEFAULT_AI_TYPES = ("ai_generated", "fully_ai_generated", "ai")
EDITLENS_SPLITS = ("train", "val", "test", "test_enron", "test_llama")


@dataclass
class Doc:
    id: str
    text: str
    label: int                    # 0 human, 1 AI
    generator: str | None         # e.g. a model name; None for human text
    domain: str | None
    source: str                   # dataset name
    split: str
    group: str | None = None      # documents sharing a group must stay in one split (EditLens source_id)
    text_type: str | None = None

    def meta(self) -> dict:
        d = asdict(self)
        d.pop("text")
        d["n_chars"] = len(self.text)
        d["n_words"] = len(self.text.split())
        d["text_sha1"] = hashlib.sha1(self.text.encode("utf-8")).hexdigest()
        return d


def _read_parquet_split(root: Path, split: str):
    import pandas as pd
    files = sorted(root.glob(f"data/{split}-*.parquet")) or sorted(root.glob(f"{split}-*.parquet")) or sorted(root.glob(f"{split}.parquet"))
    if not files:
        raise FileNotFoundError(f"no parquet files for split {split!r} under {root}")
    return pd.concat([pd.read_parquet(f) for f in files], ignore_index=True)


def resolve_editlens(spec: str, local_files_only: bool = False) -> Path:
    """'hf:pangram/editlens_iclr' -> local snapshot (requires accepted access + HF login); a directory path is used as is."""
    if spec.startswith("hf:"):
        from huggingface_hub import snapshot_download
        return Path(snapshot_download(spec[3:], repo_type="dataset", local_files_only=local_files_only))
    return Path(spec)


def load_editlens(spec: str, split: str, human_types=DEFAULT_HUMAN_TYPES, ai_types=DEFAULT_AI_TYPES,
                  local_files_only: bool = False) -> tuple[list[Doc], dict]:
    root = resolve_editlens(spec, local_files_only)
    df = _read_parquet_split(root, split)
    need = {"text_id", "text", "text_type"}
    if need - set(df.columns):
        raise ValueError(f"EditLens columns missing: {need - set(df.columns)}; found {list(df.columns)}")
    types = Counter(df["text_type"].astype(str))
    docs, excluded = [], Counter()
    for r in df.itertuples(index=False):
        tt = str(r.text_type)
        if tt in human_types:
            lab = HUMAN
        elif tt in ai_types:
            lab = AI
        else:
            excluded[tt] += 1
            continue
        gen = getattr(r, "model", None)
        docs.append(Doc(id=str(r.text_id), text=str(r.text), label=lab,
                        generator=None if lab == HUMAN else (str(gen) if gen is not None else None),
                        domain=str(getattr(r, "source", None)) if getattr(r, "source", None) is not None else None,
                        source="pangram/editlens_iclr", split=split,
                        group=str(getattr(r, "source_id", None)) if getattr(r, "source_id", None) is not None else None,
                        text_type=tt))
    report = {"split": split, "rows": len(df), "text_type_counts": dict(types), "excluded": dict(excluded),
              "kept": len(docs), "human": sum(d.label == HUMAN for d in docs), "ai": sum(d.label == AI for d in docs)}
    if not docs:
        raise ValueError(f"no rows mapped to human/AI in split {split}; text_type values seen: {dict(types)}. "
                         "Pass --human-types/--ai-types explicitly.")
    return docs, report


def load_jsonl(path: str, split: str | None = None) -> tuple[list[Doc], dict]:
    docs = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        o = json.loads(line)
        if split is not None and o.get("split") != split:
            continue
        lab = {"human": HUMAN, "ai": AI, 0: HUMAN, 1: AI}[o["label"]]
        docs.append(Doc(id=str(o["id"]), text=o["text"], label=lab, generator=o.get("generator"), domain=o.get("domain"),
                        source=o.get("source", Path(path).name), split=o.get("split", split or "unspecified"),
                        group=o.get("group")))
    return docs, {"split": split, "kept": len(docs), "human": sum(d.label == HUMAN for d in docs),
                  "ai": sum(d.label == AI for d in docs)}


def sample_balanced(docs: list[Doc], limit: int | None, seed: int) -> list[Doc]:
    """Deterministic class-balanced sample: order each class by a seeded hash of its id, take limit//2 of each."""
    if not limit:
        return sorted(docs, key=lambda d: stable_hash(d.id, seed))
    out = []
    for lab in (HUMAN, AI):
        cls = sorted((d for d in docs if d.label == lab), key=lambda d: stable_hash(d.id, seed))
        out += cls[: limit // 2]
    return sorted(out, key=lambda d: stable_hash(d.id, seed))


def check_splits(metas: dict[str, list[dict]]) -> dict:
    """Leakage audit across splits: duplicate ids, identical texts and shared groups (EditLens source_id)."""
    report = {"splits": {s: len(m) for s, m in metas.items()}, "dup_ids_within": {}, "id_overlap": {}, "text_overlap": {},
              "group_overlap": {}}
    names = list(metas)
    for s in names:
        c = Counter(m["id"] for m in metas[s])
        report["dup_ids_within"][s] = sum(v > 1 for v in c.values())
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            key = f"{a}|{b}"
            ia, ib = {m["id"] for m in metas[a]}, {m["id"] for m in metas[b]}
            ta, tb = {m["text_sha1"] for m in metas[a]}, {m["text_sha1"] for m in metas[b]}
            ga = {m["group"] for m in metas[a] if m.get("group")}
            gb = {m["group"] for m in metas[b] if m.get("group")}
            report["id_overlap"][key] = len(ia & ib)
            report["text_overlap"][key] = len(ta & tb)
            report["group_overlap"][key] = len(ga & gb)
    report["leakage_free"] = (all(v == 0 for v in report["dup_ids_within"].values())
                              and all(v == 0 for v in report["id_overlap"].values())
                              and all(v == 0 for v in report["text_overlap"].values())
                              and all(v == 0 for v in report["group_overlap"].values()))
    return report


# ----------------------------------------------------------------------------------- stylometric baseline
_WORD = re.compile(r"[A-Za-z']+")
_SENT = re.compile(r"[.!?]+(?:\s|$)")
PUNCT = ",.;:!?-\"'()"
STYLO_NAMES = ["mean_word_len", "std_word_len", "type_token_ratio_300", "mean_sentence_words", "std_sentence_words",
               "newline_rate", "digit_rate", "upper_rate"] + [f"rate_{c}" for c in PUNCT]


def stylometric_features(text: str) -> list[float]:
    import statistics as st
    words = _WORD.findall(text)
    n_chars = max(len(text), 1)
    wl = [len(w) for w in words] or [0]
    first = [w.lower() for w in words[:300]]
    sents = [s for s in _SENT.split(text) if s.strip()]
    sl = [len(s.split()) for s in sents] or [0]
    feats = [st.mean(wl), st.pstdev(wl), (len(set(first)) / len(first)) if first else 0.0, st.mean(sl), st.pstdev(sl),
             text.count("\n") / n_chars, sum(ch.isdigit() for ch in text) / n_chars, sum(ch.isupper() for ch in text) / n_chars]
    feats += [text.count(c) / n_chars for c in PUNCT]
    return feats
