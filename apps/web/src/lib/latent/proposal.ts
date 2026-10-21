// Proposed experiment for Professor Regan: explaining the 14B → ~27B recall plateau. This is a plan, not a result.
// Values come only from Professor Regan's email; everything else is marked "to confirm" or "to measure".

export const PROPOSAL_TITLE = "Proposed experiment: explaining the 14B → ~27B recall plateau";
export const PROPOSAL_SUBTITLE = "From final recall to layerwise recall trajectories";

export const FRAMING = "Nearly identical final recall may come from several different underlying causes.";
export const MAIN_QUESTION = "Do the two models achieve similar final recall through the same internal trajectory, or do their hidden representations evolve differently across transformer depth?";

export const PIPELINE = [
  "Professor's existing run",
  "Reproduce exact recall",
  "Compare tokenization",
  "Extract layerwise hidden states",
  "Intermediate diagnostic projection",
  "Compare true-token trajectories",
  "Inspect disagreement cases",
  "Test plateau hypothesis",
];

export interface Stage { n: number; title: string; why: string; items: { label: string; list: string[] }[]; question?: string; principle?: string }

export const STAGES: Stage[] = [
  { n: 1, title: "Reproduce the professor's baseline exactly",
    principle: "Reproduce first. Interpret second.",
    why: "If the original metric cannot be reproduced, any deeper comparison risks answering a different question.",
    items: [
      { label: "Use exactly his", list: ["input text", "scripts", "preprocessing", "model checkpoints", "tokenizer for each model", "recall definition", "numerator and denominator", "handling of special and non-word tokens"] },
      { label: "Target", list: ["86.31% (older ~14B) and 86.34% (larger ~27B), as closely as possible"] },
    ] },
  { n: 2, title: "Separate tokenization from model behavior",
    why: "The larger model's run reportedly had about 40 more tokens, so raw token-level recall percentages are not automatically aligned.",
    items: [
      { label: "Record for each model", list: ["total token count", "token boundaries", "special and non-word tokens", "words split differently", "locations where tokenization diverges"] },
      { label: "Two reporting views", list: ["A. Model-native token recall: each model against its own token sequence", "B. Aligned text-span analysis: where meaningful, align the underlying text at word, span or character level, so token boundaries can be inspected separately from recall behavior"] },
      { label: "Caveat", list: ["No alignment method is final until Professor Regan confirms the comparison he intends."] },
    ],
    question: "How much of the observed difference is caused by tokenization rather than internal recall behavior?" },
  { n: 3, title: "Trace the known next token through transformer depth",
    why: "This is the central LatentLens experiment. The text supplies a known next token at every position, so its support can be followed through every layer.",
    items: [
      { label: "At the model output, per position", list: ["correct next token", "top predicted token", "true-token rank", "true-token logit", "true-token probability", "top-token probability", "margin", "entropy", "top-1 correctness"] },
      { label: "At every depth (intermediate diagnostic projection)", list: ["diagnostic rank of the known next token", "diagnostic score (logit)", "top projected token", "margin against the strongest competitor"] },
    ],
    question: "When does the correct continuation become strongly supported in each model?" },
  { n: 4, title: "Analyze agreement and disagreement cases",
    why: "Aggregate recall may hide qualitatively different behavior, so positions are partitioned before trajectories are compared.",
    items: [],
    question: "At what point do the two candidate continuations begin to diverge?" },
  { n: 5, title: "Test whether the apparent plateau is real",
    why: "Do not decide on one aggregate percentage. Compare the full passage on several measures, then frame the conclusion conservatively.",
    items: [
      { label: "Across the full passage", list: ["final top-1 recall", "mean and median true-token rank", "average negative log-likelihood, if appropriate", "prediction margin", "entropy", "stabilization depth", "disagreement rate", "tokenization-adjusted results where possible"] },
      { label: "Uncertainty", list: ["Paired bootstrap resampling over aligned positions or spans, if appropriate.", "No significance test is run until the alignment and independence assumptions have been checked."] },
    ] },
];

export const PROJECTION_CHAIN = ["hidden state after block k", "final normalization (Qwen3: model.norm, to confirm per checkpoint)", "LM head", "diagnostic vocabulary logits"];

export const LATENT_TRACK = {
  depths: ["early", "middle", "late", "final"],
  measures: ["residual-state RMS", "L2 norm", "cosine similarity between consecutive layer states, if useful", "hidden-state trajectory statistics", "pre-RMSNorm state", "post-RMSNorm state, where feasible"],
  question: "Does the trajectory change materially before versus after RMSNorm?",
  caveat: "Representation magnitude is reported as magnitude; it is not treated as an amount of information.",
};

export const CATEGORIES = [
  { id: "A", text: "Both models correct" },
  { id: "B", text: "14B correct, larger model wrong" },
  { id: "C", text: "Larger model correct, 14B wrong" },
  { id: "D", text: "Both wrong, same continuation" },
  { id: "E", text: "Both wrong, different continuations" },
];

export const CASE_STUDY = {
  context: "…from every state and every city,",
  older: "we will …",
  larger: "we shall not …",
  plot: ["relative depth", "rank of “will”", "rank of “shall”", "score of “will”", "score of “shall”", "margin between them"],
  limitation: "If the two tokenizers split this span differently, the relevant text span is aligned instead and the limitation is stated.",
};

export const OUTCOMES = [
  { id: "A", result: "Same final recall, similar internal trajectories", reading: "The task may genuinely be near saturation across these model sizes." },
  { id: "B", result: "Same final recall, different internal trajectories", reading: "The final metric hides meaningful representational differences." },
  { id: "C", result: "Recall similarity changes substantially after accounting for tokenization", reading: "Part of the apparent plateau was a measurement or alignment issue." },
  { id: "D", result: "Differences concentrate at particular token types or contexts", reading: "The phenomenon may be localized rather than a global scaling plateau." },
];

export type Cell = { v: string; kind: "reported" | "confirm" | "measure" };
export const COMPARISON: { m: string; a: Cell; b: Cell }[] = [
  { m: "Final recall", a: { v: "86.31%", kind: "reported" }, b: { v: "86.34%", kind: "reported" } },
  { m: "Checkpoint", a: { v: "to confirm", kind: "confirm" }, b: { v: "to confirm", kind: "confirm" } },
  { m: "Token count", a: { v: "to confirm", kind: "confirm" }, b: { v: "to confirm (reported: about 40 more)", kind: "confirm" } },
  { m: "Tokenizer", a: { v: "to confirm", kind: "confirm" }, b: { v: "to confirm", kind: "confirm" } },
  { m: "True-token rank trajectory", a: { v: "to measure", kind: "measure" }, b: { v: "to measure", kind: "measure" } },
  { m: "Prediction margin", a: { v: "to measure", kind: "measure" }, b: { v: "to measure", kind: "measure" } },
  { m: "Entropy", a: { v: "to measure", kind: "measure" }, b: { v: "to measure", kind: "measure" } },
  { m: "Stabilization depth", a: { v: "to measure", kind: "measure" }, b: { v: "to measure", kind: "measure" } },
  { m: "Residual RMS", a: { v: "to measure", kind: "measure" }, b: { v: "to measure", kind: "measure" } },
  { m: "Pre / post RMSNorm", a: { v: "to measure", kind: "measure" }, b: { v: "to measure", kind: "measure" } },
];

export const WHY = [
  "It preserves Professor Regan's existing metric rather than replacing it.",
  "It separates tokenization effects from model-behavior effects.",
  "It turns the recall problem into a layerwise representation question.",
  "It can explain cases that aggregate accuracy hides.",
  "It produces a reusable pipeline for future model comparisons.",
  "The same instrumentation can later be extended to human-vs-AI representation analysis.",
];

export const CONFIRM = [
  "exact 14B checkpoint",
  "exact larger-model checkpoint",
  "tokenizer for each",
  "exact recall definition",
  "treatment of extra and non-word tokens",
  "preferred latent-state capture point",
  "whether relative-depth comparison makes sense to him",
  "token-level only, or an aligned word/span comparison too",
  "whether “will” vs “shall” is the best first case study",
  "which result he would consider most useful",
];

export const PITCH = "I would first reproduce your recall experiment exactly, then separate the tokenization effect, and finally trace the known next token through the hidden states of both models to see whether nearly identical final recall is hiding a different internal trajectory.";

export const TRACE_NOTE = "The Qwen3-8B trace in the Professor demo is an instrumentation demonstration that follows the model's own final top output. This experiment is different: Professor Regan's text supplies a known next token at every position.";
