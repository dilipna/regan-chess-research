"""Cross-check the layer-streaming runner against an independent full-model path on the REAL checkpoint.

The full model is loaded by transformers + accelerate with CPU/disk offload (the same method Version 1 used to score
Qwen3-8B on this laptop), and its logits are compared with the streamed logits for the same token ids, in the same
dtype. Writes results/latentlens/<model>/streaming_check.json.

Usage:
    .venv-latent/Scripts/python scripts/latentlens/verify_streaming.py --model Qwen/Qwen3-8B-Base
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from latentlens.common import DATA, PINNED_REVISIONS, provenance, results_dir, write_json  # noqa: E402

TEXTS = ["The researcher opened the notebook", "Four score and seven years ago our fathers brought forth on this continent"]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", default="Qwen/Qwen3-8B-Base")
    ap.add_argument("--dtype", default="bfloat16")
    ap.add_argument("--gpu-mem", default=os.environ.get("QWEN_GPU_MEM", "2GiB"))
    ap.add_argument("--cpu-mem", default=os.environ.get("QWEN_CPU_MEM", "8GiB"))
    ap.add_argument("--local-files-only", action="store_true")
    args = ap.parse_args()

    import gc
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from latentlens.adapter import Qwen3Adapter, _dtype, make_batches

    rev = PINNED_REVISIONS.get(args.model)
    tok = AutoTokenizer.from_pretrained(args.model, revision=rev, local_files_only=args.local_files_only)
    eot = tok.convert_tokens_to_ids("<|endoftext|>")
    seqs = [[eot] + tok(t, add_special_tokens=False)["input_ids"] for t in TEXTS]

    t0 = time.time()
    offload = DATA / "offload"
    offload.mkdir(parents=True, exist_ok=True)
    ref = AutoModelForCausalLM.from_pretrained(args.model, revision=rev, dtype=_dtype(args.dtype), attn_implementation="sdpa",
                                               device_map="auto", max_memory={0: args.gpu_mem, "cpu": args.cpu_mem},
                                               offload_folder=str(offload), local_files_only=args.local_files_only).eval()
    ref_logits = []
    with torch.inference_mode():
        for s in seqs:
            ref_logits.append(ref(input_ids=torch.tensor([s], device="cuda:0")).logits[0].float().cpu())
    t_ref = time.time() - t0
    del ref
    gc.collect()
    torch.cuda.empty_cache()

    t1 = time.time()
    a = Qwen3Adapter(args.model, device="cuda", dtype=args.dtype, loader="stream", local_files_only=args.local_files_only)
    a.load_model()
    L = a.get_layer_count()
    cap = {}
    a.forward_hidden_states(make_batches(seqs, 1, eot, sort_by_length=False), {L - 1: {"resid_post"}},
                            lambda site, layer, h, b: cap.__setitem__(b.index[0], h[0].float().cpu()))
    st_logits = [a.project_to_logits(cap[i]).cpu() for i in range(len(seqs))]
    t_st = time.time() - t1
    a.cleanup()

    rows = []
    for text, r, s in zip(TEXTS, ref_logits, st_logits):
        lr, ls = torch.log_softmax(r, -1), torch.log_softmax(s, -1)
        top = r.topk(20, dim=-1).indices
        rows.append({"text": text, "positions": int(r.shape[0]),
                     "top1_agreement": float((r.argmax(-1) == s.argmax(-1)).float().mean()),
                     "max_abs_logprob_diff_top20": float((lr.gather(1, top) - ls.gather(1, top)).abs().max()),
                     "max_abs_logit_diff": float((r - s).abs().max()),
                     "ref_top1": [tok.decode([int(i)]) for i in r.argmax(-1)],
                     "stream_top1": [tok.decode([int(i)]) for i in s.argmax(-1)]})
    out = {"schema": "latentlens.streaming_check/1", "status": "ok", "model_id": args.model, "revision": rev,
           "dtype": args.dtype, "reference": "transformers AutoModelForCausalLM + accelerate offload (sdpa)",
           "candidate": "LatentLens layer streaming (sdpa)", "results": rows,
           "runtime_s": {"reference": round(t_ref, 1), "stream": round(t_st, 1)},
           "provenance": provenance(script="scripts/latentlens/verify_streaming.py")}
    write_json(results_dir(args.model) / "streaming_check.json", out)
    for r in rows:
        print(r["text"][:40], "top-1 agreement", r["top1_agreement"], "max |dlogp| top20", round(r["max_abs_logprob_diff_top20"], 4))
        print("  ref   ", r["ref_top1"])
        print("  stream", r["stream_top1"])


if __name__ == "__main__":
    main()
