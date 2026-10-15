"""Score the MoveLens demo positions with the REAL Qwen3-8B-Base on local hardware (no cloud GPU).

Same pinned checkpoint, same frozen prompt (hash checked), same candidate continuations and the same
QwenScorer.score_position code as the planned Modal run. Differences, recorded in runtime.json:
the 16 GB bf16 model does not fit a 4 GB laptop GPU, so accelerate splits it across GPU / CPU RAM / disk
(offloaded layers are moved to the GPU for each forward pass), and the candidate batch is small (KV memory).
bf16 rounding therefore differs slightly from a single-GPU run; this is a demo-scope run on a handful of
positions, NOT the held-out evaluation, and is labelled as such everywhere it is shown.

A consistency check re-scores a few candidates of the first position with independent full-sequence
forward passes (QwenScorer.score_naive) and records the largest difference.

Run (separate venv; never in the research .venv):
    .venv-qwen/Scripts/python experiments/23_qwen_local_demo.py                       # primary prompt (with Stockfish lines)
    QWEN_CONDITION=position_only .venv-qwen/Scripts/python experiments/23_qwen_local_demo.py   # ablation: no engine information
Output: data/interim/qwen_local_demo/scores.jsonl (+ runtime.json), or scores_position_only.jsonl (+ runtime_position_only.json).
"""

from __future__ import annotations

import json
import os
import pickle
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services"))
from analyzer import config  # noqa: E402
from analyzer.qwen.prompt import PROMPT_HASH, build_prompt, candidate_text, position_from_decision  # noqa: E402
from analyzer.qwen.scorer import QWEN_MODEL_ID, QWEN_REVISION, QwenScorer  # noqa: E402

OUT = config.INTERIM / "qwen_local_demo"
OFFLOAD = Path(os.environ.get("QWEN_OFFLOAD_DIR", str(OUT / "offload")))


def load_scorer(candidate_batch: int) -> QwenScorer:
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    s = object.__new__(QwenScorer)          # same scoring methods; only the loading differs (device_map)
    s.torch, s.model_id, s.revision, s.dtype_name, s.candidate_batch = torch, QWEN_MODEL_ID, QWEN_REVISION, "bfloat16", candidate_batch
    s.tokenizer = AutoTokenizer.from_pretrained(QWEN_MODEL_ID, revision=QWEN_REVISION)
    OFFLOAD.mkdir(parents=True, exist_ok=True)
    s.model = AutoModelForCausalLM.from_pretrained(
        QWEN_MODEL_ID, revision=QWEN_REVISION, dtype=torch.bfloat16, attn_implementation="sdpa",
        device_map="auto", max_memory={0: os.environ.get("QWEN_GPU_MEM", "2GiB"), "cpu": os.environ.get("QWEN_CPU_MEM", "8GiB")},
        offload_folder=str(OFFLOAD))
    s.model.eval()
    s.device = str(s.model.get_input_embeddings().weight.device) if s.model.get_input_embeddings().weight.device.type != "meta" else "cuda:0"
    return s


def main():
    demo = json.loads((config.ARTIFACTS / "movelens_demo.json").read_text())
    ids = demo["pool"]
    with open(config.PROCESSED / "decisions.pkl", "rb") as fh:
        decs = pickle.load(fh)
    OUT.mkdir(parents=True, exist_ok=True)
    cond = os.environ.get("QWEN_CONDITION", "regan_aligned")
    assert cond in PROMPT_HASH, cond
    sfx = "" if cond == "regan_aligned" else f"_{cond}"
    out_path = OUT / f"scores{sfx}.jsonl"
    done = {json.loads(l)["position_id"] for l in out_path.read_text().splitlines()} if out_path.exists() else set()
    todo = [p for p in ids if p not in done]
    print(f"{len(todo)} positions to score ({len(done)} done)", flush=True)
    t0 = time.time()
    scorer = load_scorer(int(os.environ.get("QWEN_CAND_BATCH", "4")))
    import torch
    devmap = {}
    for k, v in getattr(scorer.model, "hf_device_map", {}).items():
        devmap[str(v)] = devmap.get(str(v), 0) + 1
    print(f"loaded in {time.time() - t0:.0f}s; device map (modules per device): {devmap}", flush=True)
    check = None
    with open(out_path, "a", encoding="utf-8") as fh:
        for pid in todo:
            gid, ply = pid.split(":")
            d = next(x for x in decs[gid] if x["ply"] == int(ply))
            prompt, legal = build_prompt(position_from_decision(d), cond)
            t = time.time()
            sc = scorer.score_position(prompt, {m: candidate_text(m) for m in legal})
            rec = {"position_id": pid, "condition": cond, "model_id": QWEN_MODEL_ID, "revision": QWEN_REVISION,
                   "dtype": "bfloat16", "prompt_hash": PROMPT_HASH[cond], "candidates": legal,
                   "logprob": {m: sc[m]["logprob"] for m in legal}, "n_tokens": {m: sc[m]["n_tokens"] for m in legal}}
            fh.write(json.dumps(rec) + "\n"); fh.flush()
            print(f"  {pid}: {len(legal)} moves in {time.time() - t:.0f}s", flush=True)
            if check is None:
                sub = {m: candidate_text(m) for m in [d["played"], d["sf_lines"][0]["move"], legal[0]]}
                ref = scorer.score_naive(prompt, sub)
                check = {"position_id": pid, "moves": list(sub), "max_abs_diff_nats": max(abs(ref[m]["logprob"] - sc[m]["logprob"]) for m in sub)}
                print(f"  consistency vs full-sequence scoring: {check}", flush=True)
    import transformers
    runtime = {"model_id": QWEN_MODEL_ID, "revision": QWEN_REVISION, "dtype": "bfloat16", "quantization": None,
               "hardware": f"accelerate device_map='auto' on {torch.cuda.get_device_name(0)} machine; see modules_per_device for where layers ran",
               "modules_per_device": devmap, "candidate_batch": scorer.candidate_batch, "torch": torch.__version__,
               "transformers": transformers.__version__, "condition": cond, "prompt_hash": PROMPT_HASH[cond],
               "scoring": "sum of log-probabilities of every token of ' <uci>\\n'; softmax over legal moves; nothing generated",
               "scope": f"{len(ids)} MoveLens demo positions; not the held-out evaluation",
               "consistency_check": check, "generated_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    if check is not None:
        (OUT / f"runtime{sfx}.json").write_text(json.dumps(runtime, indent=1))
    print("done", runtime, flush=True)


if __name__ == "__main__":
    main()
