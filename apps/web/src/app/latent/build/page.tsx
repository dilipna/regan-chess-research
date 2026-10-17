import type { Metadata } from "next";
import { BuildPage } from "@/components/latent/foundations/pages";

export const metadata: Metadata = { title: "Build it", description: "Eight coding steps: autograd, a bigram model, a BPE tokenizer, attention, RMSNorm/RoPE/SwiGLU, a tiny Qwen-style GPT, sampling with a KV cache, and LoRA." };

export default function Build() {
  return <BuildPage />;
}
