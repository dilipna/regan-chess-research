"""Score exported positions with a base LLM on a local GPU (the Modal job in deploy/modal_app.py runs the
same services/analyzer/qwen/runner.py code remotely and writes the same files).

Results for Qwen/Qwen3-8B-Base go to data/interim/qwen/<condition>/<split>.jsonl and are the only ones
the evaluation reads. Any other model (e.g. Qwen3-0.6B-Base for a pipeline check) is written to
data/interim/qwen_pilot/<model>/... and is never used as a result.

Usage:
  python experiments/13_qwen_score.py --split test [--condition regan_aligned] [--model Qwen/Qwen3-8B-Base] [--limit N]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services"))
from analyzer import config  # noqa: E402
from analyzer.qwen.cache import ScoreCache  # noqa: E402
from analyzer.qwen.prompt import CONDITIONS  # noqa: E402
from analyzer.qwen.runner import score_records  # noqa: E402
from analyzer.qwen.scorer import QWEN_MODEL_ID, QwenScorer  # noqa: E402


def out_path(model: str, condition: str, split: str) -> Path:
    if model == QWEN_MODEL_ID:
        return config.INTERIM / "qwen" / condition / f"{split}.jsonl"
    return config.INTERIM / "qwen_pilot" / model.replace("/", "__") / condition / f"{split}.jsonl"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--split", required=True)
    ap.add_argument("--condition", default="regan_aligned", choices=CONDITIONS)
    ap.add_argument("--model", default=QWEN_MODEL_ID)
    ap.add_argument("--dtype", default="bfloat16")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()
    recs = [json.loads(l) for l in (config.INTERIM / "three_model" / f"positions_{args.split}.jsonl").read_text().splitlines()]
    if args.limit:
        recs = recs[:args.limit]
    out = out_path(args.model, args.condition, args.split)
    out.parent.mkdir(parents=True, exist_ok=True)
    done = set()
    if out.exists():
        done = {json.loads(l)["position_id"] for l in out.read_text().splitlines()}
    todo = [r for r in recs if r["position_id"] not in done]
    print(f"{len(todo)} to score ({len(done)} already in {out})", flush=True)
    scorer = QwenScorer(args.model, dtype=args.dtype)
    cache = ScoreCache(config.INTERIM / "qwen_cache.sqlite")
    with open(out, "a", encoding="utf-8") as fh:
        for r in score_records(scorer, todo, args.condition, cache):
            fh.write(json.dumps(r) + "\n")
    info = scorer.runtime_info()
    (out.parent / f"{args.split}.runtime.json").write_text(json.dumps(info, indent=1))
    print("runtime:", info)


if __name__ == "__main__":
    main()
