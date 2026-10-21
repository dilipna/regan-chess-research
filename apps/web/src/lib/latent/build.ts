// The "Build it" coding track (learn/build in the repository). Mirrors learn/build/README.md.

export interface BuildStep { n: number; file: string; title: string; write: string; atlas: { label: string; part: string }; foundation?: string }

export const BUILD_STEPS: BuildStep[] = [
  { n: 1, file: "s01_micrograd.py", title: "Autograd from scratch", write: "A Value that records how it was computed, five operations with their derivatives, and backward(). Then train a tiny network on XOR with it.", atlas: { label: "How every box learns", part: "block.add1" }, foundation: "backprop" },
  { n: 2, file: "s02_bigram.py", title: "A counting language model", write: "Count which character follows which, turn counts into probabilities, score text with cross-entropy, and sample.", atlas: { label: "Logits, Softmax → sample", part: "model.softmax" }, foundation: "next-token" },
  { n: 3, file: "s03_bpe.py", title: "A byte-level BPE tokenizer", write: "Pair counting, merging, training merges, encoding and decoding, with a perfect round trip on any Unicode text.", atlas: { label: "Tokenizer, Token IDs", part: "model.tokenizer" } },
  { n: 4, file: "s04_attention.py", title: "Attention by hand", write: "A numerically stable softmax, the causal mask, scaled dot-product attention and GQA's repeat_kv, checked against PyTorch.", atlas: { label: "Inside attention", part: "attention.scores" }, foundation: "why-attention" },
  { n: 5, file: "s05_parts.py", title: "RMSNorm, RoPE, SwiGLU", write: "Qwen3's three distinctive parts, with checks that RoPE keeps lengths and makes scores depend only on distance.", atlas: { label: "RoPE", part: "attention.rope" } },
  { n: 6, file: "s06_tiny_gpt.py", title: "A tiny Qwen-style GPT", write: "Assemble the block and the full model with Hugging Face's Qwen3 module names, then train it to write sentences.", atlas: { label: "The whole diagram", part: "model.blocks" } },
  { n: 7, file: "s07_generate.py", title: "Sampling and the KV cache", write: "Temperature, top-k and top-p, plus a KV cache whose logits match the uncached model exactly.", atlas: { label: "Keys and values", part: "attention.k" } },
  { n: 8, file: "s08_lora.py", title: "LoRA fine-tuning", write: "A low-rank add-on that starts as a no-op, trains a tiny fraction of the weights and merges back exactly.", atlas: { label: "Wq → Q", part: "attention.q" } },
];

/** Real output of `python train_tiny_gpt.py --solutions --steps 1500` (recorded 2026-10-17). */
export const SAMPLE_RUN = {
  before: "The tlSZbeTolwbrwIMniyLSLTTglbTiIgp.vZBureydiSkmipodp.ZdrbAgwdBeM.ihvnmor,hwcpck,",
  after: "The fox was curious, so it slept. Sam was hungry and the bear was curious. Zoe was brave and the dog was brave.",
  loss: [3.581, 0.334, 0.283, 0.274, 0.262, 0.256, 0.252, 0.22, 0.211, 0.161, 0.163],
  params: 796_800,
};
