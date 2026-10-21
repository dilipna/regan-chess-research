"""Record two real generation steps for the Learn journey: the next-token distribution after a prompt, and, for each of
the top-k candidates, the distribution after that candidate is appended.

One forward pass over k + 1 short sequences (teacher-forced prefixes, no sampling inside the model). For each
distribution we store the top-n tokens with logits and probabilities, and exact log-sum-exp normalizers over the FULL
vocabulary for several temperatures, so the website can recompute probabilities at those temperatures exactly.

Usage:
    .venv-latent/Scripts/python scripts/latentlens/record_generation_steps.py --loader stream --device cuda
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from latentlens.common import provenance, results_dir, seed_everything, write_json  # noqa: E402

TEMPERATURES = (0.25, 0.5, 0.7, 1.0, 1.5, 2.0)


def summarize(tok, z, top_n):
    import torch
    p = torch.softmax(z, 0)
    order = z.topk(top_n).indices.tolist()
    return {"top": [{"id": int(j), "text": tok.decode([int(j)]), "logit": float(z[j]), "p": float(p[j])} for j in order],
            "logsumexp_by_temperature": {str(t): float(torch.logsumexp(z / t, 0)) for t in TEMPERATURES},
            "top_mass": float(p[order].sum()), "entropy": float(-(p * p.clamp_min(1e-30).log()).sum())}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", default="Qwen/Qwen3-8B-Base")
    ap.add_argument("--text", default="The researcher opened the notebook")
    ap.add_argument("--candidates", type=int, default=3)
    ap.add_argument("--top", type=int, default=20)
    ap.add_argument("--loader", default="stream", choices=["stream", "full"])
    ap.add_argument("--device", default="cuda")
    ap.add_argument("--dtype", default="bfloat16")
    ap.add_argument("--local-files-only", action="store_true")
    args = ap.parse_args()

    from latentlens.adapter import Qwen3Adapter, make_batches
    seed_everything(0)
    t0 = time.time()
    a = Qwen3Adapter(args.model, device=args.device, dtype=args.dtype, loader=args.loader, local_files_only=args.local_files_only)
    a.load_model()
    tok, L = a.tokenizer, a.get_layer_count()
    base = [a.doc_prefix_id] + a.tokenize(args.text)

    def last_logits(seqs):
        cap = {}
        a.forward_hidden_states(make_batches(seqs, len(seqs), a.doc_prefix_id, sort_by_length=False), {L - 1: {"resid_post"}},
                                lambda s, l, h, b: [cap.__setitem__(gi, h[r, int(b.mask[r].sum()) - 1].float().cpu()) for r, gi in enumerate(b.index)])
        return [a.project_to_logits(cap[i][None])[0].cpu() for i in range(len(seqs))]

    z0 = last_logits([base])[0]
    cands = z0.topk(args.candidates).indices.tolist()
    zs = last_logits([base + [c] for c in cands])
    steps = [{"appended": {"id": int(c), "text": tok.decode([int(c)])}, "context": args.text + tok.decode([int(c)]), **summarize(tok, z, args.top)}
             for c, z in zip(cands, zs)]
    out = {"schema": "latentlens.generation_steps/1", "status": "ok", "model_id": a.model_id, "revision": a.revision,
           "dtype": args.dtype, "loader": args.loader, "prompt": args.text, "prefix": "<|endoftext|>",
           "procedure": "one forward pass per sequence; the appended token is one of the top candidates of step 1; "
                        "no sampling happens inside the model",
           "step1": summarize(tok, z0, args.top), "step2": steps, "runtime_s": round(time.time() - t0, 1),
           "provenance": provenance(script="scripts/latentlens/record_generation_steps.py", loader=args.loader)}
    path = results_dir(a.model_id) / "generation_steps.json"
    write_json(path, out)
    print("step 1 top:", [(d["text"], round(d["p"], 3)) for d in out["step1"]["top"][:5]])
    for s in steps:
        print(f"after {s['appended']['text']!r}:", [(d["text"], round(d["p"], 3)) for d in s["top"][:5]])
    print("->", path)
    a.cleanup()


if __name__ == "__main__":
    main()
