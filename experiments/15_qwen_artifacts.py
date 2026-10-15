"""Build the Qwen3-8B-Base artifacts from the scored positions (additive).

Inputs : data/interim/qwen/<condition>/<split>.jsonl (summed candidate log-likelihoods per legal move)
         data/interim/three_model/targets_<split>.parquet, data/processed/{decisions.pkl, variant_choices.pkl,
         variants.parquet}
Outputs: data/artifacts/qwen_move_scores.parquet         one row per (row of the benchmark, eligible decision):
                                                         the move evaluated is the original move, or the
                                                         substitute in substituted test rows (same original position)
         data/artifacts/qwen_candidate_distributions.parquet   full legal-move distribution per position
         data/artifacts/qwen_provenance.json
Test rows cover all 16 conditions of every test player-game; train/val rows cover the originals only.
"""

from __future__ import annotations

import json
import math
import pickle
import sys
import time
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services"))
from analyzer import config  # noqa: E402
from analyzer.compare.dists import entropy, load_qwen, rank_of, surprisal, validate  # noqa: E402
from analyzer.qwen.prompt import PROMPT_HASH, prompt_spec  # noqa: E402
from analyzer.qwen.scorer import QWEN_MODEL_ID, QWEN_REVISION  # noqa: E402

SCRIPT = "experiments/15_qwen_artifacts.py"
TM = config.INTERIM / "three_model"


def main():
    t0 = time.time()
    with open(config.PROCESSED / "decisions.pkl", "rb") as fh:
        decs = pickle.load(fh)
    with open(config.PROCESSED / "variant_choices.pkl", "rb") as fh:
        choices = pickle.load(fh)
    v = pd.read_parquet(config.PROCESSED / "variants.parquet",
                        columns=["variant_id", "game_id", "color", "split", "strategy", "level", "realized_alpha", "label"])
    rows, cand_rows, runtime, n_by = [], [], {}, {}
    for cond in ("regan_aligned", "position_only"):
        for split in ("test", "val", "train"):
            q = load_qwen(cond, split)
            if q is None:
                continue
            t = pd.read_parquet(TM / f"targets_{split}.parquet").set_index("position_id")
            assert set(q) == set(t.index), f"{cond}/{split}: scored positions differ from the exported set"
            rt = config.INTERIM / "qwen" / cond / f"{split}.runtime.json"
            runtime[f"{cond}/{split}"] = json.loads(rt.read_text()) if rt.exists() else None
            n_by[f"{cond}/{split}"] = len(q)
            dist = {pid: validate(r["prob"], t.at[pid, "fen"], "Q") for pid, r in q.items()}
            for pid, r in q.items():
                d = dist[pid]
                order = sorted(d.items(), key=lambda kv: (-kv[1], kv[0]))
                cand_rows.append({"condition": cond, "split": split, "position_id": pid,
                                  "candidates": list(d), "logprob": [r["logprob"][m] for m in d],
                                  "n_tokens": [r["n_tokens"][m] for m in d], "prob": [d[m] for m in d],
                                  "top1_move": order[0][0], "entropy": entropy(d), "cache_key": r["cache_key"]})
            vv = v[v["split"] == split] if split == "test" else v[(v["split"] == split) & (v["level"] == 0)]
            for vr in vv.itertuples():
                by = {dd["ply"]: dd for dd in decs[vr.game_id]}
                ch = choices[vr.variant_id]
                for ply, k, alt in zip(ch["plies"], ch["choice"], ch["altered"]):
                    pid = f"{vr.game_id}:{ply}"
                    d, dec = dist[pid], by[ply]
                    mv = dec["cands"][k]["move"]
                    order = sorted(d.items(), key=lambda kv: (-kv[1], kv[0]))
                    rows.append({
                        "condition": cond, "source_game_id": vr.game_id, "variant_id": vr.variant_id, "split": split,
                        "ply": ply, "fen": dec["fen"], "player_elo": int(dec["elo"]), "opponent_elo": int(dec["opp_elo"]),
                        "side_to_move": dec["color"], "played_move_uci": mv, "original_move_uci": dec["played"],
                        "substituted": bool(alt), "candidate_count": len(d),
                        "qwen_model_id": QWEN_MODEL_ID, "qwen_revision": QWEN_REVISION, "prompt_hash": PROMPT_HASH[cond],
                        "qwen_logprob_played": math.log(max(d[mv], 1e-300)), "qwen_prob_played": d[mv],
                        "qwen_surprisal_played": surprisal(d[mv]), "qwen_rank_played": rank_of(d, mv),
                        "qwen_top1_move": order[0][0], "qwen_top1_probability": order[0][1], "qwen_entropy": entropy(d),
                        "assistance_label": int(vr.label), "strategy": vr.strategy,
                        "target_assistance_fraction": float(vr.level), "realized_assistance_fraction": float(vr.realized_alpha),
                        "generator": SCRIPT})
    if not rows:
        print("no Qwen3-8B-Base scores found under data/interim/qwen/ -- nothing written (Qwen remains pending)")
        return
    pd.DataFrame(rows).to_parquet(config.ARTIFACTS / "qwen_move_scores.parquet", index=False)
    pd.DataFrame(cand_rows).to_parquet(config.ARTIFACTS / "qwen_candidate_distributions.parquet", index=False)
    prov = {"generator": SCRIPT, "generated_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "model_id": QWEN_MODEL_ID, "revision": QWEN_REVISION, "tokenizer_revision": QWEN_REVISION,
            "prompts": {c: prompt_spec(c) for c in PROMPT_HASH}, "positions_scored": n_by, "runtime": runtime,
            "scoring": {"candidate_continuation": "' <uci>\\n' appended to the frozen prompt",
                        "score": "sum of log P(token) over every candidate token (no length normalization)",
                        "normalization": "softmax (log-sum-exp) over the legal moves of the position",
                        "sampling": "none; no text is generated", "few_shot_examples": 0,
                        "numerics": "bfloat16 weights; log-softmax in float32. With bfloat16, scoring a candidate through "
                                    "the prompt KV cache vs one full forward pass differed by up to 0.16 nats on the "
                                    "Qwen3-0.6B-Base pipeline check (2.5e-5 in float32); results are deterministic for a "
                                    "fixed batch composition (candidate batch 64)."},
            "rows": len(rows)}
    (config.ARTIFACTS / "qwen_provenance.json").write_text(json.dumps(prov, indent=1))
    print(f"wrote qwen_move_scores.parquet ({len(rows)} rows), candidate distributions ({len(cand_rows)}), "
          f"qwen_provenance.json in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
