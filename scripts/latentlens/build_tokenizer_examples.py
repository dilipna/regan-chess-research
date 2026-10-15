"""Tokenize example texts with the REAL Qwen tokenizer and read the matching embedding rows from the checkpoint.

Writes results/latentlens/<model>/tokenizer_examples.json. Nothing here is simulated: token pieces, ids and offsets come
from the tokenizer shipped with the checkpoint, and embedding statistics from the stored `model.embed_tokens.weight`.

Usage:
    .venv-latent/Scripts/python scripts/latentlens/build_tokenizer_examples.py --model Qwen/Qwen3-8B-Base
    .venv-latent/Scripts/python scripts/latentlens/build_tokenizer_examples.py --text "Your sentence here" --text "Another"
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from latentlens.common import PINNED_REVISIONS, provenance, results_dir, write_json  # noqa: E402

MAIN = "The researcher opened the notebook"
EXAMPLES = [
    (MAIN, "The running example used throughout Learn Mode."),
    ("Tokenization is not the same as splitting on spaces.", "Common words are single tokens; the leading space is part of the token."),
    ("unbelievably", "One word, several tokens."),
    (" notebook | notebook | Notebook | NOTEBOOK", "The same word with and without a leading space or capitals maps to different ids."),
    ("In 1863, roughly 2,000 people listened.", "Numbers are split into digit pieces."),
    ("def rms(x): return (sum(v*v for v in x)/len(x))**0.5", "Code."),
    ("Der Forscher öffnete das Notizbuch.", "German: accented characters are byte-level pieces."),
    ("研究人员打开了笔记本。", "Chinese: Qwen's vocabulary has many multi-character Chinese tokens."),
    ("<|endoftext|>", "A special token written as text is recognised as one special token id."),
]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--model", default="Qwen/Qwen3-8B-Base")
    ap.add_argument("--revision", default=None)
    ap.add_argument("--text", action="append", help="extra text(s) to tokenize (added after the built-in examples)")
    ap.add_argument("--local-files-only", action="store_true")
    args = ap.parse_args()

    import torch
    from huggingface_hub import snapshot_download
    from safetensors import safe_open
    from transformers import AutoTokenizer

    rev = args.revision or PINNED_REVISIONS.get(args.model)
    root = Path(snapshot_download(args.model, revision=rev, local_files_only=args.local_files_only,
                                  allow_patterns=["*.json", "*.txt", "*.safetensors"]))
    tok = AutoTokenizer.from_pretrained(root)
    examples = list(EXAMPLES) + [(t, "User-provided text.") for t in (args.text or [])]

    out_examples = []
    for text, note in examples:
        enc = tok(text, add_special_tokens=True, return_offsets_mapping=True)
        ids = enc["input_ids"]
        pieces = tok.convert_ids_to_tokens(ids)
        toks = [{"id": int(i), "piece": p, "text": tok.decode([i]), "start": int(s), "end": int(e),
                 "special": int(i) in tok.all_special_ids}
                for i, p, (s, e) in zip(ids, pieces, enc["offset_mapping"])]
        out_examples.append({"text": text, "note": note, "n_chars": len(text), "n_words": len(text.split()),
                             "n_tokens": len(ids), "tokens": toks,
                             "roundtrip_ok": tok.decode(ids) == text})

    # embedding rows for the running example (read only the rows we need)
    idx_file = root / "model.safetensors.index.json"
    name = "model.embed_tokens.weight"
    shard = root / (json.loads(idx_file.read_text())["weight_map"][name] if idx_file.exists() else "model.safetensors")
    main_ids = tok(MAIN, add_special_tokens=False)["input_ids"]
    with safe_open(str(shard), framework="pt") as fh:
        sl = fh.get_slice(name)
        shape = list(sl.get_shape())
        rows = torch.stack([sl[i:i + 1][0] for i in main_ids]).float()
    emb = []
    for i, r in zip(main_ids, rows):
        emb.append({"id": int(i), "piece": tok.convert_ids_to_tokens(int(i)), "text": tok.decode([i]),
                    "dim": int(r.numel()), "rms": r.pow(2).mean().sqrt().item(), "l2": r.norm().item(),
                    "mean": r.mean().item(), "std": r.std().item(), "min": r.min().item(), "max": r.max().item(),
                    "first_coords": [round(v, 5) for v in r[:8].tolist()]})
    nrm = rows / rows.norm(dim=-1, keepdim=True)
    cos = (nrm @ nrm.T).tolist()

    specials = {t: int(tok.convert_tokens_to_ids(t)) for t in ("<|endoftext|>", "<|im_start|>", "<|im_end|>")}
    res = {
        "schema": "latentlens.tokenizer/1", "status": "ok", "model_id": args.model, "revision": rev,
        "tokenizer_class": type(tok).__name__, "tokenizer_size": len(tok),
        "add_special_tokens_prepends": tok("x", add_special_tokens=True)["input_ids"][:-1],
        "special_tokens": specials,
        "examples": out_examples,
        "embedding": {"tensor": name, "shape": shape, "dtype_stored": "bfloat16", "text": MAIN,
                      "tokens": emb, "cosine": [[round(c, 4) for c in row] for row in cos]},
        "provenance": provenance(script="scripts/latentlens/build_tokenizer_examples.py"),
    }
    out = results_dir(args.model) / "tokenizer_examples.json"
    write_json(out, res)
    for e in out_examples:
        print(f"{e['n_tokens']:3d} tokens | {e['text'][:50]!r} -> {[t['piece'] for t in e['tokens']][:12]}")
    print("->", out)


if __name__ == "__main__":
    main()
