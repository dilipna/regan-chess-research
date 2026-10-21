"""Mistake, or another version? Classify each top-1 recall miss on the Gettysburg Address (Bliss copy) by comparing the
model's predicted token with the four other manuscript copies (Nicolay, Hay, Everett, Bancroft).

Works on the recorded recall artifact (teacher forcing): no model is run here. For each scored position where the
model's top-1 token is not the true next token:

  1. inside a word        the true token continues a word (no leading space), e.g. a sub-word piece
  2. punctuation / form   the true or predicted token has no letters (comma, dash, newline, space)
  3. another version      the predicted word is what one of the other manuscripts has at this point: the last 3 to 6
                          context words occur in that copy and its next word starts with the predicted token
                          (case-sensitive, so "liberty" and "Liberty" differ); a predicted "-word" must appear
                          literally hyphenated after the previous word in that copy
  4. other                none of the above

Context matching ignores case and punctuation, because the transcriptions of the copies do not reproduce punctuation
consistently. Exploratory analysis of one passage; it does not establish why the model predicted what it did.

Usage:
    .venv-latent/Scripts/python scripts/latentlens/analyze_recall_versions.py
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from latentlens.common import ROOT, provenance, read_json, results_dir, write_json  # noqa: E402

WORD = re.compile(r"[A-Za-z]+")
NONWORD = r"\W+"
BOUNDARY = r"\b"


def words(s: str) -> list[str]:
    """Words with their original capitalisation; hyphenated compounds are split into their parts."""
    return WORD.findall(s.replace("-", " "))


def low(ws: list[str]) -> list[str]:
    return [w.lower() for w in ws]


def next_words(ver: list[str], ctx: list[str], kmin: int = 3, kmax: int = 6) -> set[str]:
    """Words that follow the longest context suffix (kmax..kmin words, case-insensitive) wherever it occurs."""
    lv = low(ver)
    for k in range(min(kmax, len(ctx)), kmin - 1, -1):
        suf = low(ctx[-k:])
        hits = {ver[i + k] for i in range(len(ver) - k) if lv[i:i + k] == suf}
        if hits:
            return hits
    return set()


def evidence(txt: str, ctx_tail: str) -> str | None:
    """The passage of a copy where the same context continues (longest of the last 4, 3 or 2 context words)."""
    for k in (4, 3, 2):
        key = words(ctx_tail)[-k:]
        m = re.search(BOUNDARY + NONWORD.join(map(re.escape, key)) + NONWORD + ".{0,30}", txt, flags=re.I)
        if m:
            return m.group(0)
    return None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", default="Qwen/Qwen3-8B-Base")
    ap.add_argument("--recall", default=None, help="recall JSON (default: results/latentlens/<model>/recall_probe.json)")
    ap.add_argument("--passage", default="Gettysburg Address (public domain)")
    ap.add_argument("--versions", default=str(ROOT / "scripts/latentlens/passages/gettysburg_versions.json"))
    args = ap.parse_args()

    res = results_dir(args.model)
    rec = read_json(Path(args.recall) if args.recall else res / "recall_probe.json")
    vers = read_json(Path(args.versions))
    p = next(x for x in rec["passages"] if x["name"] == args.passage)
    reference = "Bliss"
    raw = {k: v for k, v in vers["versions"].items() if k != reference}
    others = {k: words(v) for k, v in raw.items()}
    pos = p["positions"]
    texts = [x["true"] for x in pos]
    rows, counts = [], {"inside a word": 0, "punctuation / form": 0, "another version": 0, "other": 0}
    for i, x in enumerate(pos):
        if x["top1"]:
            continue
        ctx = "".join(texts[:i])
        true_t, pred_t = x["true"], x["top"]
        prev_char = ctx[-1:] if ctx else " "
        support: list[str] = []
        if true_t and not true_t[0].isspace() and prev_char.isalpha() and true_t[0].isalpha():
            cat = "inside a word"
        elif not re.search(r"[A-Za-z]", true_t) or not re.search(r"[A-Za-z]", pred_t):
            cat = "punctuation / form"
        else:
            pw = words(pred_t)
            if pred_t.startswith("-") and pw:
                pattern = re.compile(BOUNDARY + re.escape(words(ctx)[-1]) + "-" + re.escape(pw[0]))
                support = [name for name, txt in raw.items() if pattern.search(txt)]
            elif pw:
                support = [name for name, ver in others.items() if any(w.startswith(pw[0]) for w in next_words(ver, words(ctx)))]
            cat = "another version" if support else "other"
        counts[cat] += 1
        rows.append({"t": x["t"], "context_tail": ctx[-60:], "true": true_t, "predicted": pred_t, "rank": x["rank"],
                     "p_true": x["p_true"], "p_top": x["p_top"], "category": cat, "versions_with_prediction": support,
                     "evidence": {name: evidence(raw[name], ctx[-60:]) for name in support}})
    n = p["n_scored"]
    hits = sum(1 for x in pos if x["top1"])
    out = {
        "schema": "latentlens.recall_versions/1", "status": "ok", "model_id": rec["model_id"], "dtype": rec["dtype"],
        "passage": args.passage, "reference_copy": reference, "compared_copies": list(others),
        "versions_source": vers["source"], "versions_source_name": vers["source_name"], "versions_retrieved": vers["retrieved"],
        "n_scored": n, "top1_hits": hits, "misses": n - hits, "miss_categories": counts,
        "recall_strict": hits / n, "recall_if_other_versions_accepted": (hits + counts["another version"]) / n,
        "misses_detail": rows,
        "method": "case-sensitive comparison of the model's top-1 token with the word that follows the same 3-6 word context "
                  "(case and punctuation ignored for the context) in each other manuscript copy; teacher-forced recall from "
                  "the recorded artifact",
        "caveats": ["One passage. Exploratory: it shows which misses coincide with another authentic wording, not why the model "
                    "produced them.", "Transcriptions of the copies come from one secondary source and differ in punctuation.",
                    "A prediction that matches another copy may still have other causes (for example, the same phrase in "
                    "quotations or paraphrases seen in training)."],
        "provenance": provenance(script="scripts/latentlens/analyze_recall_versions.py"),
    }
    write_json(res / "recall_versions.json", out)
    print(f"{args.passage}: {hits}/{n} top-1 hits; misses {counts}")
    print(f"strict recall {out['recall_strict']:.3f}; accepting other manuscript wordings {out['recall_if_other_versions_accepted']:.3f}")
    for r in rows:
        if r["category"] == "another version":
            print(f"  ...{r['context_tail'][-32:]!r} true {r['true']!r} predicted {r['predicted']!r}")
            for name, ev in r["evidence"].items():
                print(f"       {name}: {ev}")


if __name__ == "__main__":
    main()
