// The lab list (plain data; safe to import from server and client components).
export const LABS = [
  { slug: "rmsnorm", title: "RMSNorm versus LayerNorm", question: "What exactly does normalization change, and what does it keep?", scene: 3 },
  { slug: "attention", title: "Attention microscope", question: "How do Q, K, V, the mask and softmax produce one output?", scene: 4 },
  { slug: "rope", title: "Position and RoPE", question: "How can rotating vectors encode where a token is?", scene: 4 },
  { slug: "sampling", title: "Temperature and sampling", question: "What does temperature change, and what does it not?", scene: 7 },
  { slug: "kv-cache", title: "KV cache", question: "What is stored during generation, and why?", scene: 7 },
  { slug: "training", title: "One training step", question: "How does a single update change a prediction?", scene: 8 },
] as const;
