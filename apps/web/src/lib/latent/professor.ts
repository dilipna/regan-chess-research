// Professor mode: a concise technical walkthrough for a 5 to 10 minute meeting. Academic tone; every claim is
// either a verified architecture fact, a recorded measurement (shown by the evidence components), or marked pending.

export type Evidence = "glassbox" | "rms" | "recall" | "probe" | null;
export interface ProfSection { id: string; n: number; title: string; lead: string; flow?: string[]; points: string[]; evidence: Evidence; minutes: number }

export const PROF_SECTIONS: ProfSection[] = [
  { id: "why", n: 1, title: "Why Version 2 exists", minutes: 1, evidence: null,
    lead: "Version 1 examined model behavior primarily through output-level measurements. After our discussion, I wanted to move inside the model and understand how those outputs are constructed.",
    flow: ["Output behavior", "Internal representation", "Latent analysis"],
    points: [
      "V1 compared move probabilities from Qwen3-8B-Base with a statistical model and human-move predictions on the same chess positions.",
      "V2 records the internal states of the same model family (Qwen3-8B-Base, pinned revision 49e3418f) on a 4 GB laptop GPU by streaming one layer at a time; streamed outputs were checked against a full offloaded run.",
      "Every number shown is labelled: recorded measurement, toy calculation, or pending experiment.",
    ] },
  { id: "end-to-end", n: 2, title: "Qwen3-8B-Base end to end", minutes: 1, evidence: null,
    lead: "A decoder-only transformer: each position predicts the next token from earlier positions only.",
    flow: ["Text", "Tokenizer", "Token IDs [T]", "Embeddings [T, 4096]", "Residual stream", "36 blocks", "Final RMSNorm", "LM head", "Logits [T, 151936]", "Next token"],
    points: [
      "Byte-level BPE tokenizer (151,669 entries; embedding table padded to 151,936 rows); no BOS token is added.",
      "8,190,735,360 parameters in bfloat16; input embedding and LM head are separate (untied) matrices.",
      "Width 4,096 throughout; 36 pre-norm blocks; context up to 32,768 positions; no sliding window in the base configuration.",
    ] },
  { id: "block", n: 3, title: "One transformer block", minutes: 2, evidence: "glassbox",
    lead: "The order of operations inside every block, verified from the module source and reproduced from recorded tensors.",
    flow: ["Residual x", "RMSNorm", "Q, K, V", "q_norm, k_norm", "RoPE", "Causal GQA", "o_proj", "+ residual", "RMSNorm", "SwiGLU MLP", "+ residual"],
    points: [
      "Q has 32 heads of 128; K and V have 8 heads of 128, each shared by 4 query heads (grouped-query attention).",
      "q_norm and k_norm are RMSNorms over each 128-dimensional head vector, applied before RoPE; V is neither normalized nor rotated.",
      "RoPE (base 1,000,000, rotate-half pairing) rotates Q and K only; scores are scaled by 1/√128 and causally masked.",
      "SwiGLU MLP: down_proj(SiLU(gate_proj x) ⊙ up_proj x), 4,096 → 12,288 → 4,096. Attention and MLP write updates that are added to the residual stream.",
    ] },
  { id: "rmsnorm", n: 4, title: "RMSNorm", minutes: 2, evidence: "rms",
    lead: "RMSNorm(x) = g ⊙ x / √(mean(x²) + ε), with ε = 1e-6, computed in float32, then a learned per-dimension gain. No mean subtraction and no bias.",
    points: [
      "What gets normalized: the copy of each position's 4,096-dimensional residual vector that attention or the MLP reads. The residual stream itself is not normalized until the final norm.",
      "Block RMSNorm (input_layernorm, post_attention_layernorm, model.norm) works over 4,096 dimensions; Q/K RMSNorm works over each 128-dimensional head.",
      "Scale invariance: the reader sees direction (weighted by the gain), not magnitude. On real block-18 inputs the mean is only about 1 to 3% of the RMS, which is why LayerNorm comes close but fits measurably worse.",
      "Research questions: is human-vs-AI information more linearly accessible before or after normalization? Does activation magnitude, discarded by the norm, carry signal of its own?",
    ] },
  { id: "latent", n: 5, title: "Latent states", minutes: 1, evidence: null,
    lead: "A hidden state is the vector representation of a token at a particular point in the model.",
    flow: ["h₀ = embedding", "h₁ … h₃₆ after each block", "final RMSNorm", "logits"],
    points: [
      "For a batch of B texts of length T, the hidden states at layer l form a tensor of shape [B, T, 4096]; there are 37 such points (the embedding plus 36 blocks).",
      "Because each block adds updates to a running sum, information written early remains available to later layers unless something writes against it, which is why intermediate states can be read by simple linear probes.",
      "A probe that succeeds shows that information is linearly decodable at that depth. It does not show that the model uses it; causal tests (patching, ablation) are needed for that.",
    ] },
  { id: "recall", n: 6, title: "Recall Microscope", minutes: 2, evidence: "recall",
    lead: "Final recall asks: did the correct next token win? Latent analysis asks: when, inside the network, did it begin to win?",
    points: [
      "Teacher forcing on known public-domain text: at every position the true next token is fed in, and the model's prediction is compared with it.",
      "For each layer, the intermediate state is projected through the final norm and LM head (a diagnostic projection, not the model's output at that depth) and the true token's rank is recorded.",
      "Recorded finding beyond the plateau: several of Qwen's misses on the Gettysburg Address are the wording of another Lincoln manuscript, so a single reference transcript caps measurable recall below 100%.",
    ] },
  { id: "human-ai", n: 7, title: "Human vs AI, layer by layer", minutes: 1, evidence: "probe",
    lead: "Research question: where does information useful for distinguishing human from AI writing become linearly accessible?",
    flow: ["Human text / AI text", "Frozen Qwen3-8B-Base", "Hidden states by layer", "Same linear probe per layer", "Separability by depth"],
    points: [
      "The same simple classifier is trained at every layer with held-out evaluation, shuffled-label and surface-feature baselines, and leakage checks.",
      "The language is deliberate: a layer does not \"detect AI\"; the question is where the information becomes linearly accessible.",
      "Next experiments: pre- vs post-RMSNorm probes, attention vs MLP contributions to separation, generalization across generators and domains, and comparison with a dedicated detector.",
    ] },
];

export const PROF_TOTAL_MINUTES = PROF_SECTIONS.reduce((a, s) => a + s.minutes, 0);
