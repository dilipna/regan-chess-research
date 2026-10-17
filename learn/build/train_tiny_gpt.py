"""Train the tiny GPT from step 6 and watch it learn to write.

    python train_tiny_gpt.py                  # uses YOUR code (the exercise files)
    python train_tiny_gpt.py --solutions      # uses the reference solutions
    python train_tiny_gpt.py --text my.txt    # train on any text file (keep it small: tens of kilobytes)

It prints the loss as it falls and samples text before and after training. Expect gibberish first, then real
words, spaces and full stops after a few hundred steps (a minute or two).
"""
import argparse
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

p = argparse.ArgumentParser()
p.add_argument("--solutions", action="store_true")
p.add_argument("--text", type=Path)
p.add_argument("--steps", type=int, default=600)
p.add_argument("--layers", type=int, default=4)
p.add_argument("--d-model", type=int, default=128)
args = p.parse_args()

sys.path.insert(0, str(ROOT / "solutions" if args.solutions else ROOT))
sys.path.append(str(ROOT))

import torch  # noqa: E402

from data import tiny_stories  # noqa: E402
from s06_tiny_gpt import CharTokenizer, Config, TinyGPT, count_params, train  # noqa: E402
from s07_generate import generate  # noqa: E402

text = args.text.read_text(encoding="utf-8") if args.text else tiny_stories()
tok = CharTokenizer(text)
data = torch.tensor(tok.encode(text), dtype=torch.long)
device = "cuda" if torch.cuda.is_available() else "cpu"
cfg = Config(vocab_size=len(tok.itos), d_model=args.d_model, n_layers=args.layers, n_heads=4, n_kv_heads=2,
             d_ff=3 * args.d_model, max_len=128)
torch.manual_seed(0)
model = TinyGPT(cfg).to(device)
print(f"{len(text):,} characters, vocabulary {len(tok.itos)}, model {count_params(cfg):,} parameters on {device}")
print(f"a model that knows nothing scores ln({len(tok.itos)}) = {math.log(len(tok.itos)):.2f}\n")


def show(label: str) -> None:
    g = torch.Generator(device=device).manual_seed(1)
    prompt = torch.tensor([tok.encode("The ")], device=device)
    out = generate(model, prompt, 160, temperature=0.8, generator=g)
    print(f"--- {label} ---\n{tok.decode(out[0].tolist())}\n")


show("before training")
train(model, data, steps=args.steps, block=96, log_every=max(1, args.steps // 10))
show("after training")
