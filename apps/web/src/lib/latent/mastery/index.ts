// The connected curriculum: levels, every topic, and the knowledge map that shows how they form one system.

import { SECURITY } from "../security/topics";
import { CORE } from "./topics-core";
import { EXTRA } from "./topics-extra";
import { SYSTEMS } from "./topics-systems";
import type { Topic } from "./types";

/** Each added topic sits right after the topic it builds on, so the course order and prev/next stay natural. */
const AFTER: Record<string, string> = {
  "scaling-laws": "training-step", evaluation: "scaling-laws", "fine-tuning": "post-training", "reasoning-models": "fine-tuning",
  hallucination: "rag", superposition: "logit-lens", "web-security": "security-foundations",
};
function withExtras(base: Topic[]): Topic[] {
  const out = [...base];
  let pending = [...EXTRA];
  while (pending.length) {
    const ready = pending.filter((t) => out.some((x) => x.slug === AFTER[t.slug]));
    if (!ready.length) throw new Error(`No anchor for ${pending.map((t) => t.slug).join(", ")}`);
    for (const t of ready) out.splice(out.findIndex((x) => x.slug === AFTER[t.slug]) + 1, 0, t);
    pending = pending.filter((t) => !ready.includes(t));
  }
  return out;
}
export const TOPICS: Topic[] = withExtras([...CORE, ...SYSTEMS, ...SECURITY]);
export const topicBySlug = (s: string) => TOPICS.find((t) => t.slug === s);
export const topicHref = (t: Topic) => (t.track === "security" ? `/latent/security/learn/${t.slug}` : `/latent/mastery/${t.slug}`);
export const hrefFor = (slug: string) => { const t = topicBySlug(slug); return t ? topicHref(t) : "/latent/mastery"; };

export interface LevelInfo { n: number; title: string; goal: string; prereqs: number[]; href?: string }
export const LEVELS: LevelInfo[] = [
  { n: 0, title: "Storybook", goal: "Build the intuition", prereqs: [], href: "/latent/story" },
  { n: 1, title: "Transformer foundations", goal: "Trace one token through Qwen3-8B", prereqs: [0] },
  { n: 2, title: "Training and post-training", goal: "From corpus to gradient update to assistant", prereqs: [1] },
  { n: 3, title: "Inference and serving", goal: "From request to prefill, KV cache and decode", prereqs: [1] },
  { n: 4, title: "RAG and retrieval", goal: "Ground answers in retrieved text", prereqs: [1, 3] },
  { n: 5, title: "Agents and tools", goal: "Loops, tools, memory and MCP", prereqs: [4] },
  { n: 6, title: "Interpretability and latent states", goal: "Read and test what is inside", prereqs: [1] },
  { n: 7, title: "AI security foundations", goal: "Assets, boundaries, threat models", prereqs: [5] },
  { n: 8, title: "LLM application security", goal: "Injection, leakage, poisoning, output handling", prereqs: [7] },
  { n: 9, title: "Agentic AI security", goal: "Bound what any decision can do", prereqs: [8] },
  { n: 10, title: "AI red teaming and defense", goal: "Test, measure, fix, retest", prereqs: [9] },
  { n: 11, title: "LatentLens research", goal: "Hidden states, probes, Recall Microscope", prereqs: [6], href: "/latent/research" },
];
export const topicsAt = (n: number) => TOPICS.filter((t) => t.level === n);

// ---------- knowledge map ----------

export type Lane = "pipeline" | "training" | "inference" | "application" | "security";
export const LANES: { id: Lane; label: string }[] = [
  { id: "pipeline", label: "How an LLM computes" },
  { id: "training", label: "How it learns" },
  { id: "inference", label: "How it runs" },
  { id: "application", label: "How it is used" },
  { id: "security", label: "How it fails and is secured" },
];
export interface MapNode { id: string; lane: Lane; label: string; topic: string }
export const MAP_NODES: MapNode[] = [
  { id: "text", lane: "pipeline", label: "Text", topic: "autoregressive" },
  { id: "tokenizer", lane: "pipeline", label: "Tokenizer", topic: "tokenization" },
  { id: "ids", lane: "pipeline", label: "Token IDs", topic: "tokenization" },
  { id: "embedding", lane: "pipeline", label: "Embedding", topic: "embeddings" },
  { id: "stream", lane: "pipeline", label: "Residual stream", topic: "residual-stream" },
  { id: "blocks", lane: "pipeline", label: "36 blocks: norm, attention, MLP", topic: "causal-attention" },
  { id: "final-norm", lane: "pipeline", label: "Final norm", topic: "rmsnorm" },
  { id: "lm-head", lane: "pipeline", label: "LM head", topic: "lm-head" },
  { id: "logits", lane: "pipeline", label: "Logits", topic: "lm-head" },
  { id: "decoding", lane: "pipeline", label: "Decoding", topic: "decoding" },

  { id: "data", lane: "training", label: "Data", topic: "pretraining-data" },
  { id: "sequences", lane: "training", label: "Token sequences", topic: "pretraining-data" },
  { id: "objective", lane: "training", label: "Causal objective", topic: "autoregressive" },
  { id: "xent", lane: "training", label: "Cross-entropy", topic: "training-step" },
  { id: "backprop", lane: "training", label: "Backprop", topic: "training-step" },
  { id: "optimizer", lane: "training", label: "Optimizer", topic: "training-step" },
  { id: "updates", lane: "training", label: "Weight updates", topic: "distributed-training" },
  { id: "base", lane: "training", label: "Base model", topic: "post-training" },
  { id: "post", lane: "training", label: "Post-training", topic: "post-training" },

  { id: "prompt", lane: "inference", label: "Prompt", topic: "prefill-decode" },
  { id: "prefill", lane: "inference", label: "Prefill", topic: "prefill-decode" },
  { id: "kv", lane: "inference", label: "KV cache", topic: "gqa" },
  { id: "decode-loop", lane: "inference", label: "Decode loop", topic: "prefill-decode" },
  { id: "sampling", lane: "inference", label: "Sampling", topic: "decoding" },
  { id: "serving", lane: "inference", label: "Batching and serving", topic: "serving" },

  { id: "llm", lane: "application", label: "LLM", topic: "autoregressive" },
  { id: "roles", lane: "application", label: "System / developer / user", topic: "prompt-injection" },
  { id: "rag", lane: "application", label: "RAG", topic: "rag" },
  { id: "tools", lane: "application", label: "Tools", topic: "agents" },
  { id: "memory", lane: "application", label: "Memory", topic: "memory-multiagent" },
  { id: "agents", lane: "application", label: "Agents", topic: "agents" },
  { id: "mcp", lane: "application", label: "MCP / connectors", topic: "mcp" },
  { id: "external", lane: "application", label: "External systems", topic: "agents" },

  { id: "boundaries", lane: "security", label: "Trust boundaries", topic: "threat-modeling" },
  { id: "untrusted", lane: "security", label: "Untrusted data", topic: "threat-modeling" },
  { id: "confusion", lane: "security", label: "Instruction/data confusion", topic: "prompt-injection" },
  { id: "injection", lane: "security", label: "Prompt injection", topic: "prompt-injection" },
  { id: "tool-misuse", lane: "security", label: "Tool misuse", topic: "agent-security" },
  { id: "leakage", lane: "security", label: "Data leakage", topic: "privacy-attacks" },
  { id: "escalation", lane: "security", label: "Privilege escalation", topic: "agent-security" },
  { id: "impact", lane: "security", label: "Real-world impact", topic: "defenses" },
];
/** Cross-lane connections: the relationships that make it one system. */
export const MAP_LINKS: { a: string; b: string; why: string }[] = [
  { a: "ids", b: "sequences", why: "Training data is the same token ids, packed into sequences." },
  { a: "logits", b: "xent", why: "Training scores the same logits against the true next token." },
  { a: "blocks", b: "kv", why: "Every block's K and V are what the KV cache stores; GQA sets its size." },
  { a: "decoding", b: "sampling", why: "Sampling is the decoding policy run once per generated token." },
  { a: "post", b: "roles", why: "Post-training teaches the model to follow role markers; it is learned, not enforced." },
  { a: "stream", b: "rag", why: "Retrieved text becomes tokens whose states mix into the residual stream through attention." },
  { a: "rag", b: "untrusted", why: "Retrieved documents are untrusted data entering the context." },
  { a: "blocks", b: "confusion", why: "Attention reads all context tokens alike: there is no hard privilege boundary inside the model." },
  { a: "tools", b: "tool-misuse", why: "A probabilistic output controls a deterministic capability." },
  { a: "memory", b: "injection", why: "Poisoned memory re-enters future contexts as instructions." },
  { a: "mcp", b: "untrusted", why: "Tool descriptions and results from third-party servers are untrusted text." },
  { a: "data", b: "boundaries", why: "Training data is a trust boundary too: poisoning acts here." },
  { a: "prefill", b: "impact", why: "Long prompts and loops cost compute and money: availability and denial of wallet." },
  { a: "lm-head", b: "leakage", why: "Detailed logits and log-probs leak information useful for extraction and membership inference." },
];

// ---------- Storybook bridge ----------

export const STORY_TO_MASTERY: Record<string, string[]> = {
  guess: ["autoregressive"], pieces: ["tokenization"], codes: ["embeddings"], counting: ["autoregressive", "training-step"],
  practice: ["training-step"], flashlight: ["qkv", "causal-attention"], tower: ["residual-stream", "rmsnorm"],
  library: ["pretraining-data", "architectures"], manners: ["post-training"], dice: ["decoding"], thinking: ["post-training"],
  agents: ["agents", "mcp"], careful: ["security-foundations", "prompt-injection"], timeline: ["architectures"],
};
