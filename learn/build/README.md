# Build it: write an LLM yourself, one piece at a time

Eight short steps. In each one you fill in a few marked `TODO` blocks, run its checks, and the checks tell you
exactly what is wrong. By step 6 you have written a working transformer with the same block design as Qwen3-8B
and watched it learn to write. Most checks compare your code against PyTorch's own implementation, so passing
them means your code is correct, not just plausible.

| Step | File | You write | It is this part of the Atlas |
|---|---|---|---|
| 1 | `s01_micrograd.py` | autograd on single numbers: `+ * ** exp silu` and `backward()` | how every box learns (training) |
| 2 | `s02_bigram.py` | a counting language model, its loss and a sampler | Logits, Softmax → sample |
| 3 | `s03_bpe.py` | a byte-level BPE tokenizer: train, encode, decode | Tokenizer, Token IDs |
| 4 | `s04_attention.py` | stable softmax, causal mask, attention, GQA's `repeat_kv` | Inside attention |
| 5 | `s05_parts.py` | RMSNorm, RoPE, SwiGLU | RMSNorm, QK-norm, RoPE, Inside the MLP |
| 6 | `s06_tiny_gpt.py` | the block and the full model (Qwen3 module names) | the whole diagram |
| 7 | `s07_generate.py` | temperature / top-k / top-p, and a KV cache | Softmax → sample; K and V |
| 8 | `s08_lora.py` | LoRA fine-tuning: a low-rank add-on, merged at the end | Wq → Q, Wv → V |

Do the steps in order: step 6 imports YOUR attention and parts from steps 4 and 5.

## How to work

From the repository root, using the project's `.venv` (it already has PyTorch, NumPy and pytest):

```bash
cd learn/build
../../.venv/Scripts/python -m pytest -k s01          # Windows (Git Bash). On macOS/Linux: ../../.venv/bin/python
```

1. Read the file's top comment and the step's Foundations page on the site if the idea is new.
2. Find each `raise NotImplementedError("TODO(n)")`. The comment above it says what to compute and gives the formula.
   Each file has at least one finished example of the same pattern (for instance `tanh` in step 1).
3. Run the checks for the step. Fix, rerun. A failing check names what is wrong in its message.
4. Run the file itself (`python s05_parts.py`): each one prints something worth looking at.

When step 6 passes, train your model:

```bash
../../.venv/Scripts/python train_tiny_gpt.py              # your code
../../.venv/Scripts/python train_tiny_gpt.py --text some.txt
```

It prints random characters before training and sentences such as "The fox was curious, so it slept." after.

## Stuck?

* `solutions/` has the reference answers. Try for 20 minutes first: the struggle is where the learning happens.
* `python make_exercises.py --force` resets every exercise (your old files are kept as `.py.bak`).
* `BUILD_IMPL=solutions python -m pytest` runs the checks against the solutions, to see what passing looks like.

## After step 8

You will have written every component in the Atlas yourself. Good next projects, in rising difficulty:

1. Train step 6 on a real text with your step 3 tokenizer instead of characters.
2. Load a small real model's weights (for example Qwen3-0.6B) into your step 6 code and check that your logits
   match Hugging Face's. This is the best possible test that you understand the architecture.
3. Work through Andrej Karpathy's *Neural Networks: Zero to Hero* videos, which build the same ideas at greater length.
