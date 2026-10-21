// Professor mode: the 5 to 7 minute meeting flow for Professor Regan. Academic tone; every claim is a verified
// architecture fact, a recorded measurement (shown by the evidence components), a professor-reported observation,
// or explicitly marked as a hypothesis or pending.

export type Evidence = "glassbox" | "latent" | "rms" | "trace" | "regan" | "hypotheses" | "experiment" | "checklist" | null;
export interface ProfSection { id: string; n: number; title: string; lead: string; flow?: string[]; points: string[]; evidence: Evidence; minutes: number }

export const LENS_CAVEAT = "Intermediate vocabulary projections are diagnostic logit-lens projections. They are not literal model predictions at those intermediate layers.";

export const PROF_SECTIONS: ProfSection[] = [
  { id: "outputs-to-internals", n: 1, title: "From outputs to internals", minutes: 0.5, evidence: null,
    lead: "Last time I was analyzing Qwen mainly from its outputs. After our discussion, I wanted to understand what happens inside the model and make those internal states measurable.",
    flow: ["Text", "Tokenizer", "Token IDs", "Embeddings", "Transformer blocks", "Final RMSNorm", "LM head", "Logits", "Next token"],
    points: [
      "Model: Qwen/Qwen3-8B-Base, pinned revision 49e3418f, a decoder-only causal model with 8,190,735,360 parameters stored in bfloat16.",
      "Byte-level BPE tokenizer with 151,669 entries; the embedding table and LM head have 151,936 rows and are separate (untied) matrices. No BOS token is added.",
      "Recorded on a 4 GB laptop GPU by streaming one block at a time; streamed outputs were checked against a full offloaded run.",
    ] },
  { id: "block", n: 2, title: "One Qwen transformer block", minutes: 1, evidence: "glassbox",
    lead: "Each of the 36 blocks is pre-norm: attention and the MLP read a normalized copy of the residual state and add their output back to it. Order verified from the module source (transformers 5.18.0, modeling_qwen3.py).",
    points: [
      "Q has 32 heads of 128 dimensions; K and V have 8 heads of 128, each shared by 4 query heads (grouped-query attention).",
      "q_norm and k_norm are RMSNorms over each 128-dimensional head vector, applied after the projection and before RoPE. V is neither normalized nor rotated.",
      "RoPE (base 1,000,000, rotate-half pairing) rotates Q and K only. Scores are scaled by 1/√128 and causally masked.",
      "SwiGLU MLP: down_proj(SiLU(gate_proj x) ⊙ up_proj x), 4,096 → 12,288 → 4,096, no biases.",
      "Attention weights describe how the attention operation mixes value vectors across positions; they are not a readout of what the model is \"thinking about\".",
    ] },
  { id: "latent", n: 3, title: "The latent state", minutes: 0.5, evidence: "latent",
    lead: "A hidden state (intermediate representation) is the vector representation of each token at a particular point in the network.",
    flow: ["Layer 0 (embedding)", "Layer 1", "Layer 2", "…", "Layer 36", "Final RMSNorm", "LM head"],
    points: [
      "For B texts of T tokens, the residual state after each block is a tensor of shape [B, T, 4096]. There are 37 such capture points: the embedding output (layer 0) and the output of each of the 36 blocks.",
      "Each block adds updates to a running sum, so the representation of the same token evolves across depth.",
      "Which information is linearly accessible at a given depth is an empirical question for a probe or projection to measure, not something to assume.",
    ] },
  { id: "rmsnorm", n: 4, title: "RMSNorm", minutes: 1, evidence: "rms",
    lead: "RMS(x) = √(mean(xᵢ²) + ε),   RMSNorm(x) = g ⊙ x / RMS(x),   with ε = 1e-6 (computed in float32, then a learned per-dimension gain g).",
    points: [
      "RMSNorm rescales magnitude. Unlike LayerNorm it does not subtract the mean and has no bias.",
      "Block RMSNorm and Q/K RMSNorm are different operations on different vectors, so an experiment must state exactly which representation it captures.",
      "This lets us ask whether we should inspect the state before normalization, after normalization, or after a sublayer.",
    ] },
  { id: "trace", n: 5, title: "One real Qwen internal trace", minutes: 1, evidence: "trace",
    lead: "One recorded forward pass of Qwen3-8B-Base, read back from the saved artifact. Every number below comes from that file.",
    points: [] },
  { id: "regan", n: 6, title: "Professor Regan's 14B → ~27B observation", minutes: 1, evidence: "regan",
    lead: "What Professor Regan reported from his own runs, kept separate from anything measured here.",
    points: [] },
  { id: "hypotheses", n: 7, title: "Three hypotheses", minutes: 0.5, evidence: "hypotheses",
    lead: "Three possible explanations for nearly identical final recall. None of them has been tested.",
    points: [] },
  { id: "experiment", n: 8, title: "Proposed first experiment", minutes: 1, evidence: "experiment",
    lead: "Trace the correct next token through the transformer layers and compare when the continuation becomes accessible or dominant in each model.",
    points: [] },
  { id: "checklist", n: 9, title: "What I need from this meeting", minutes: 0.5, evidence: "checklist",
    lead: "Before running that comparison I would like to reproduce your existing workflow exactly, rather than guess the setup.",
    points: [] },
];

export const PROF_TOTAL_MINUTES = PROF_SECTIONS.reduce((a, s) => a + s.minutes, 0);

// Everything below is reported by Professor Regan by email. It is not a LatentLens measurement.
export const REGAN_REPORT = {
  older: { label: "Older Qwen ~14B", recall: "86.31%" },
  larger: { label: "Larger Qwen ~27B", recall: "86.34%" },
  text: "MLK speech",
  differences: [
    "about 40 more tokens in the larger model's run",
    "some long words were segmented into tokens differently",
    "both models correctly recalled the preceding US place names",
  ],
  divergence: { context: "…from every state and every city,", older: "we will …", larger: "we shall not …" },
  hypothesis: "Somewhere between ~14B and ~27B there may be a wall. Treated here as a hypothesis, not an established result.",
} as const;

export const COMPARE_ROWS = ["true-token rank by relative depth", "prediction margin", "entropy", "activation RMS", "stabilization depth", "tokenization"];

export const HYPOTHESES = [
  { id: "H1", title: "Tokenization effect", text: "Different tokenization may affect a raw token-level recall comparison." },
  { id: "H2", title: "Task saturation", text: "This memorized-text task may be close to a ceiling for these model sizes." },
  { id: "H3", title: "Same final score, different internal path", text: "The two models may reach almost identical final recall through different internal representation trajectories.", latentlens: true },
];

export const CASE_MEASURES = ["layer", "true-token rank", "competing-token rank", "true-token score", "competing-token score", "margin", "entropy"];

export const CHECKLIST = [
  "exact 14B model checkpoint",
  "exact ~27B model checkpoint",
  "exact tokenizer(s)",
  "exact MLK text / input file",
  "exact script / command",
  "exact definition of recall",
  "output file format",
  "where the scripts live",
  "which latent state to examine first",
  "whether working copies may be made",
  "whether the files and scripts must remain private",
  "what exact result to bring to the next meeting",
];

export const QUESTIONS = [
  "Which exact checkpoints did you use for the 14B and larger model runs?",
  "Could you show me exactly how your script defines a successful recall?",
  "How are the additional tokens and different tokenizations handled when the models are compared?",
  "Could we reproduce one of the runs together on turing or cerf?",
  "When you say latent states, which representation would you most like me to inspect first: the residual output after each block, before or after RMSNorm, or another point?",
  "Would tracing the true continuation's rank through every layer be useful for what you're trying to understand?",
  "For the will-versus-shall case, would you want me to inspect where those alternatives begin to diverge through the network?",
  "Should I reproduce the recall experiment first before moving to the human-versus-AI probing work?",
  "May I make a working copy of your scripts, and should the files remain private?",
  "What exact result would be most useful for me to bring you at our next meeting?",
];

export const FUTURE_EXTENSION = "Once the latent-state extraction is validated against the recall experiment, the same instrumentation can be applied to human-versus-AI representation analysis.";
