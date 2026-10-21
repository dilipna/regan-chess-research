// Topics added to close the gaps in the path: scaling laws, reasoning models, fine-tuning, evaluation, superposition
// and sparse autoencoders, hallucination, and the web-security basics every AI engineer needs. Qwen statements are
// "verified" only when they come from the checkpoint, Qwen's own publications, or LatentLens's recorded runs;
// numbers derived from verified values by arithmetic plus an assumption are "inferred".

import type { Topic } from "./types";

const QWEN3_BLOG = { label: "Qwen3 blog (29 April 2025)", url: "https://qwenlm.github.io/blog/qwen3/" };
const QWEN3_REPORT = { label: "Qwen3 Technical Report (arXiv 2505.09388)", url: "https://arxiv.org/abs/2505.09388" };

export const EXTRA: Topic[] = [
  // ---------------- Level 2 ----------------
  {
    slug: "scaling-laws", track: "mastery", level: 2, title: "Scaling laws and compute-optimal training", prereqs: ["training-step", "pretraining-data"],
    intuition: "Loss falls smoothly and predictably as you add parameters, data and compute, so you can plan a training run before spending the money.",
    visual: "train-loop", where: "Before training starts: choosing model size and token count for a compute budget.",
    mechanism: [
      "Across many orders of magnitude, test loss follows a power law in model parameters N, training tokens D and training compute C, as long as none of the three is the bottleneck (Kaplan et al., 2020).",
      "Training a dense transformer costs about 6ND floating-point operations: roughly 2ND for the forward pass and 4ND for the backward pass.",
      "Chinchilla (Hoffmann et al., 2022): for a fixed compute budget, parameters and tokens should grow in equal proportion, about 20 tokens per parameter. Their 70B model trained on 1.4T tokens beat the 280B Gopher model trained with the same compute.",
      "Modern open models deliberately train far past that point: a smaller model trained on more tokens costs more to train but less to run, and inference is paid on every request.",
    ],
    eq: ["C ≈ 6 N D", "L(N, D) ≈ E + A / N^α + B / D^β", "compute-optimal: D ≈ 20 N (Chinchilla)"],
    qwen: [
      { text: "Qwen3 was pretrained on about 36 trillion tokens (Qwen's own report).", status: "verified" },
      { text: "If Qwen3-8B saw the full ~36T tokens, that is about 4,400 tokens per parameter (8,190,735,360 parameters), over 200 times the Chinchilla ratio, and about 1.8 × 10^24 training FLOPs by 6ND.", status: "inferred" },
      { text: "The exact token count and compute used for the 8B model are not published separately.", status: "unknown" },
    ],
    shapes: [["compute budget C", "choose N and D with C ≈ 6ND", "planned model size and token count"], ["small pilot runs", "fit the power law", "predicted loss at full scale"]],
    why: "Training runs cost millions. Scaling laws let teams predict the loss of a big run from small pilots and spend compute where it helps most.",
    breaks: "Without them, models end up too big for their data (undertrained) or too small for their budget. Predictions also break when data quality changes or data runs out.",
    trainInfer: "A training decision with an inference consequence: parameter count sets the cost of every future token generated.",
    security: "Bigger and longer-trained models memorize more of their training data, which raises the stakes of data extraction and membership inference. Capability jumps also change which misuse is possible.",
    confusion: "“Compute-optimal means best.” It means lowest training loss for a fixed training budget. If you also pay for inference, an overtrained smaller model is often the better product.",
    teachBack: { prompt: "Explain scaling laws and why open models are trained past the Chinchilla point.", points: ["power laws in N, D and C", "C ≈ 6ND", "about 20 tokens per parameter is compute-optimal", "inference cost depends on N", "so smaller, longer-trained models", "data quality and data exhaustion limit the laws"] },
    interview: { q: "You have a fixed compute budget. How do you choose model size and token count?", level: 3, outline: ["C ≈ 6ND", "Chinchilla: scale N and D together, about 20 tokens per parameter", "adjust for expected inference volume", "validate with small pilot runs and a fitted power law"] },
    quiz: [
      { id: "scale-1", topic: "scaling-laws", area: "traininf", prompt: "Roughly how many FLOPs does training a dense model with N parameters on D tokens cost?", options: [
        { t: "About 6ND", ok: true, why: "About 2ND for the forward pass and 4ND for the backward pass." },
        { t: "About N + D", why: "Every token passes through every parameter, so the cost multiplies, it does not add." },
        { t: "About N²D", why: "Dense layers cost linear, not quadratic, work per parameter per token (attention adds a smaller sequence-length term)." },
      ] },
      { id: "scale-2", topic: "scaling-laws", area: "connection", prompt: "Why do teams train small models on far more than 20 tokens per parameter?", options: [
        { t: "Inference cost depends on parameter count, so a smaller well-trained model is cheaper to serve", ok: true, why: "The extra training cost is paid once; the inference saving is paid back on every request." },
        { t: "Chinchilla showed more tokens always lower training loss for free", why: "More tokens cost compute; Chinchilla is about the best split of a fixed budget." },
        { t: "Small models cannot be trained on fewer tokens", why: "They can; they would just stop improving later than they could." },
      ] },
    ],
    links: [{ href: "/latent/foundations/loss", label: "Foundations: loss" }, { href: "/latent/build", label: "Build it: train a tiny GPT" }],
    sources: [QWEN3_BLOG, { label: "Scaling Laws for Neural Language Models (arXiv 2001.08361)", url: "https://arxiv.org/abs/2001.08361" }, { label: "Training Compute-Optimal Large Language Models (arXiv 2203.15556)", url: "https://arxiv.org/abs/2203.15556" }],
  },
  {
    slug: "reasoning-models", track: "mastery", level: 2, title: "Reasoning models: chain of thought, RL with verifiable rewards, test-time compute", prereqs: ["post-training", "decoding"],
    intuition: "Let the model write out its working before answering, then use reinforcement learning on problems with checkable answers to make that working better.",
    visual: "posttrain", where: "Post-training (reasoning RL) and inference (thinking tokens before the answer).",
    mechanism: [
      "Chain of thought: generating intermediate steps before the final answer improves multi-step problems, because every generated token is one more forward pass of computation (Wei et al., 2022).",
      "RL with verifiable rewards: sample answers to problems whose result can be checked automatically (a math answer, unit tests for code) and reward the correct ones. No learned reward model is needed for these tasks.",
      "GRPO (DeepSeekMath, 2024): sample a group of answers per prompt and use each answer's reward relative to the group's mean and spread as its advantage, so no separate value network is trained.",
      "DeepSeek-R1 (2025) showed long, self-checking reasoning can emerge from large-scale RL, and added a small supervised cold-start stage for readability. Test-time compute then becomes a dial: more thinking tokens, usually better answers on hard tasks.",
    ],
    eq: ["A_i = (r_i − mean(r_1 … r_G)) / std(r_1 … r_G)", "answer ~ p(· | prompt, thinking tokens)"],
    qwen: [
      { text: "Qwen3 post-trained models have a thinking mode and a non-thinking mode, switched with enable_thinking in the chat template or /think and /no_think in a message, plus a thinking-budget mechanism (Qwen's blog and report).", status: "verified" },
      { text: "Qwen3's post-training has four stages: long chain-of-thought cold start, reasoning RL with rule-based rewards, thinking-mode fusion, and general RL (Qwen's blog).", status: "verified" },
      { text: "Qwen3-8B-Base, the checkpoint LatentLens studies, is the model before this post-training, so it has no trained thinking mode.", status: "inferred" },
    ],
    shapes: [["prompt", "sample G answers", "G reasoning traces"], ["G traces + checker", "group-relative advantages", "policy-gradient update"]],
    why: "Many tasks need several steps of computation that cannot fit in one forward pass; writing intermediate tokens gives the model room to compute, and RL on checkable tasks teaches it to use that room well.",
    breaks: "Rewards that can be gamed (tests that are too weak, answers matched by format only) teach reward hacking. Unlimited thinking makes answers slow and expensive.",
    trainInfer: "Both: RL is a training stage; thinking tokens are spent at inference, where they add latency and cost per request.",
    security: "Longer outputs mean more cost per request (denial of wallet) and more places for injected instructions to steer the model mid-reasoning. Reasoning traces can also restate sensitive data from the context.",
    confusion: "“The thinking text is exactly how the model reached its answer.” A chain of thought is generated text that helps the computation; it is not guaranteed to be a faithful account of it.",
    teachBack: { prompt: "Explain how a reasoning model is trained and why thinking longer helps.", points: ["chain of thought as extra computation", "verifiable rewards from checkers", "GRPO group-relative advantage, no value network", "cold-start SFT then RL", "test-time compute as a dial", "reward hacking and cost"] },
    interview: { q: "How does GRPO differ from PPO as used in RLHF?", level: 4, outline: ["PPO uses a learned value network (critic) as baseline", "GRPO uses the mean reward of a sampled group as the baseline", "advantages normalized within the group", "saves memory and compute, suits verifiable rewards"] },
    quiz: [
      { id: "reason-1", topic: "reasoning-models", area: "traininf", prompt: "What makes a reward “verifiable”?", options: [
        { t: "It is computed by a checker, such as comparing a math answer or running unit tests", ok: true, why: "The correctness of the result can be checked automatically, without a learned judge." },
        { t: "A human verifies every sample", why: "That is human feedback; verifiable rewards are automatic." },
        { t: "The model states it is confident", why: "Self-reported confidence is not a check of correctness." },
      ] },
      { id: "reason-2", topic: "reasoning-models", area: "connection", prompt: "Why can more thinking tokens improve answers?", options: [
        { t: "Each generated token is another forward pass, so the model gets more computation before committing", ok: true, why: "Intermediate tokens act as working memory the next steps can attend to." },
        { t: "Thinking tokens update the weights during inference", why: "Weights never change at inference." },
        { t: "Longer outputs always have lower loss", why: "Length alone does not help; useful intermediate steps do." },
      ] },
    ],
    links: [{ href: "/latent/foundations/next-token", label: "Foundations: next-token prediction" }, { href: "/latent/security/labs/consumption", label: "Lab 9: unbounded consumption" }],
    sources: [QWEN3_BLOG, QWEN3_REPORT, { label: "Chain-of-Thought Prompting (arXiv 2201.11903)", url: "https://arxiv.org/abs/2201.11903" }, { label: "DeepSeekMath, introduces GRPO (arXiv 2402.03300)", url: "https://arxiv.org/abs/2402.03300" }, { label: "DeepSeek-R1 (arXiv 2501.12948)", url: "https://arxiv.org/abs/2501.12948" }],
  },
  {
    slug: "fine-tuning", track: "mastery", level: 2, title: "Fine-tuning in practice: full, LoRA, QLoRA", prereqs: ["post-training", "training-step"],
    intuition: "Teach an existing model a new style or skill by training on your own examples, usually by learning a small add-on instead of changing all 8 billion weights.",
    visual: "posttrain", where: "After pretraining and post-training: adapting a released checkpoint to your task.",
    mechanism: [
      "Data: input and desired output pairs formatted with the model's chat template; the loss is usually computed only on the response tokens.",
      "Full fine-tuning updates every weight. With mixed-precision AdamW that needs about 16 bytes per parameter (bf16 weights and gradients, fp32 master weights and two Adam moments), before activations.",
      "LoRA freezes the weights and learns W + (α/r)·BA for chosen matrices, with A of shape [r, in] and B of shape [out, r], B starting at zero. After training, BA can be merged into W at no inference cost.",
      "QLoRA stores the frozen base weights in 4-bit NormalFloat and trains LoRA adapters on top, which brings fine-tuning of large models within reach of one GPU.",
    ],
    eq: ["W' = W + (α / r) · B A", "trainable = r · (in + out) per adapted matrix"],
    qwen: [
      { text: "Full fine-tuning of 8,190,735,360 parameters at about 16 bytes each needs roughly 131 GB for weights, gradients and optimizer state alone.", status: "inferred" },
      { text: "LoRA with r = 16 on q_proj (4,096 to 4,096) and v_proj (4,096 to 1,024) in all 36 blocks trains 7,667,712 parameters, about 0.09% of the model (computed from the verified shapes).", status: "inferred" },
      { text: "Which fine-tuning recipes Qwen used internally beyond its published post-training stages is not disclosed.", status: "unknown" },
    ],
    shapes: [["x [B, T, 4096]", "W x + (α/r)·B(A x)", "[B, T, out]"], ["A [r, 4096], B [out, r]", "merge after training", "W' with W's shape"]],
    code: "lora_A = nn.Parameter(torch.empty(r, d_in)); nn.init.kaiming_uniform_(lora_A, a=5 ** 0.5)\nlora_B = nn.Parameter(torch.zeros(d_out, r))\ny = base(x) + (alpha / r) * (x @ lora_A.T) @ lora_B.T",
    why: "Most teams cannot afford full fine-tuning of large models, and many adapters can share one frozen base model.",
    breaks: "Too little or low-quality data overfits; a high learning rate destroys what the base model knew (catastrophic forgetting); the wrong chat template silently degrades results.",
    trainInfer: "Training only, but adapters can be swapped per request at inference, or merged into the weights.",
    security: "Fine-tuning can remove safety behaviour, even with benign-looking data (Qi et al., 2023). Poisoned fine-tuning data can plant backdoors, and downloaded adapters are code-like supply-chain artifacts.",
    confusion: "“LoRA is a smaller model.” It is a low-rank correction added to the same full model; the base weights are all still used.",
    teachBack: { prompt: "Explain LoRA and when you would choose it over full fine-tuning.", points: ["frozen W plus low-rank BA", "B starts at zero so training starts from the base model", "r and α", "trainable parameter count", "merge after training", "QLoRA for memory", "safety and supply-chain risks"] },
    interview: { q: "Why is B initialised to zero in LoRA?", level: 3, outline: ["then BA = 0 at the start", "so the adapted model starts identical to the base", "training moves away from a known-good point", "A is random so gradients for B are non-zero"] },
    quiz: [
      { id: "peft-1", topic: "fine-tuning", area: "traininf", prompt: "LoRA with rank r adapts a 4,096 × 4,096 matrix. How many parameters does it train?", options: [
        { t: "r × (4,096 + 4,096)", ok: true, why: "A is r × 4,096 and B is 4,096 × r." },
        { t: "4,096 × 4,096", why: "That is the frozen base matrix." },
        { t: "r × r", why: "The low-rank factors connect r to the full input and output sizes." },
      ] },
      { id: "peft-2", topic: "fine-tuning", area: "security", prompt: "Which is a documented risk of fine-tuning an aligned model?", options: [
        { t: "Safety behaviour can degrade, even on benign data", ok: true, why: "Shown by Qi et al. (2023); re-evaluate safety after every fine-tune." },
        { t: "LoRA adapters can read the user's files", why: "Adapters are weights; risk comes from what they make the model do, not file access." },
        { t: "Fine-tuning makes prompt injection impossible", why: "No training method removes instruction/data confusion." },
      ] },
    ],
    links: [{ href: "/latent/build", label: "Build it, step 8: LoRA" }],
    sources: [{ label: "LoRA (arXiv 2106.09685)", url: "https://arxiv.org/abs/2106.09685" }, { label: "QLoRA (arXiv 2305.14314)", url: "https://arxiv.org/abs/2305.14314" }, { label: "Fine-tuning Aligned Language Models Compromises Safety (arXiv 2310.03693)", url: "https://arxiv.org/abs/2310.03693" }],
  },
  {
    slug: "evaluation", track: "mastery", level: 2, title: "Evaluating LLMs: loss, benchmarks, contamination, LLM judges", prereqs: ["training-step", "decoding"],
    intuition: "You cannot improve or trust what you do not measure, and every way of measuring an LLM has a known way of fooling you.",
    visual: "train-loop", where: "Throughout: during training (held-out loss), before release (benchmarks, safety and red-team evals), and in production (monitoring).",
    mechanism: [
      "Held-out loss and perplexity: average −log p of real text the model did not train on. Perplexity e^loss is the effective number of equally likely choices per token.",
      "Benchmarks: fixed question sets scored automatically, by exact match (multiple choice, as in MMLU's 57 subjects), by running unit tests for code (pass@k), or by checking final answers in math.",
      "Contamination: if benchmark items appeared in the pretraining data, scores measure memory rather than ability. Detection uses n-gram overlap and canary strings; fresh, private test sets avoid it.",
      "LLM-as-a-judge: a strong model grades open-ended answers, often pairwise. It scales well but has known biases toward the first position, longer answers and its own style, so judges must be validated against human ratings.",
    ],
    eq: ["loss = −(1/T) Σ log p(x_t | x_<t)", "perplexity = e^loss", "pass@k = P(at least one of k samples passes)"],
    qwen: [
      { text: "LatentLens recorded Qwen3-8B-Base on “The researcher opened the notebook”: mean loss 8.25 nats per token (perplexity about 3,841). “ researcher” after “The” was ranked 56,550th (17.59 nats); “ the” after “opened” was its top guess at 19.2%.", status: "verified" },
      { text: "Qwen publishes benchmark results for Qwen3 in its technical report; independent replication of those numbers varies by setup.", status: "generic" },
      { text: "Whether any specific benchmark leaked into Qwen3's pretraining data is not publicly known.", status: "unknown" },
    ],
    shapes: [["held-out text", "forward pass, −log p of each true token", "loss per token"], ["benchmark items", "generate, then score", "accuracy or pass@k"]],
    why: "Model choice, training decisions, safety claims and regressions all rest on measurements; bad measurement gives confident wrong decisions.",
    breaks: "Contaminated or saturated benchmarks overstate ability; judge bias rewards verbose answers; a single run hides the variance of sampled outputs.",
    trainInfer: "Loss is a training signal and a training-time metric; benchmarks and judges run the model at inference, so decoding settings change the score.",
    security: "Safety and red-team evaluation is the same machinery: fixed attack cases, an attack success rate, and benign tasks to catch false positives. Lab 10 is a small version of it.",
    confusion: "“A higher benchmark score means a better model for my task.” It means better on that test set, with that prompt format and decoding, if the set was not memorized. Always evaluate on your own task.",
    teachBack: { prompt: "Explain how LLMs are evaluated and how evaluations mislead.", points: ["held-out loss and perplexity", "benchmarks with exact-match or unit-test scoring", "pass@k", "contamination and detection", "LLM-as-judge and its biases", "security evals and attack success rate"] },
    interview: { q: "A new model beats yours on a public benchmark. What do you check before switching?", level: 4, outline: ["contamination risk for that benchmark", "prompt format and decoding settings used", "variance across seeds", "evaluate on your own task and data", "cost and latency"] },
    quiz: [
      { id: "eval-1", topic: "evaluation", area: "traininf", prompt: "What does a perplexity of 10 mean?", options: [
        { t: "On average the model is as unsure as choosing uniformly among about 10 tokens", ok: true, why: "Perplexity is e^loss: the effective branching factor." },
        { t: "It gets 10% of tokens right", why: "Perplexity is not an accuracy." },
        { t: "It needs 10 samples to find the answer", why: "That would be closer to pass@k." },
      ] },
      { id: "eval-2", topic: "evaluation", area: "connection", prompt: "Why is benchmark contamination a problem?", options: [
        { t: "The model may have memorized the answers, so the score measures recall, not ability", ok: true, why: "Items seen in pretraining inflate scores without real capability." },
        { t: "It makes the benchmark harder", why: "It makes it easier, misleadingly so." },
        { t: "It only matters for multiple-choice tests", why: "Any test whose items or answers leaked is affected." },
      ] },
    ],
    links: [{ href: "/latent/foundations/loss", label: "Foundations: loss and perplexity" }, { href: "/latent/security/labs/evals", label: "Lab 10: the eval suite" }],
    sources: [{ label: "Measuring Massive Multitask Language Understanding (arXiv 2009.03300)", url: "https://arxiv.org/abs/2009.03300" }, { label: "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena (arXiv 2306.05685)", url: "https://arxiv.org/abs/2306.05685" }, QWEN3_REPORT],
  },

  // ---------------- Level 4 ----------------
  {
    slug: "hallucination", track: "mastery", level: 4, title: "Hallucination, calibration and grounding", prereqs: ["decoding", "rag"],
    intuition: "A language model produces likely text, not checked facts; when it does not know, a fluent guess is often more likely than “I don't know”.",
    visual: "decode", where: "At decoding time, in any answer that states facts; reduced by retrieval and abstention in the application.",
    mechanism: [
      "Pretraining rewards predicting the next token of real text. For facts seen rarely or never, the model can only generalize, and plausible-but-wrong continuations get probability.",
      "Kalai et al. (2025) argue hallucinations persist because common evaluations grade answers as right or wrong with no credit for abstaining, so guessing scores better than admitting uncertainty.",
      "Calibration: a calibrated model's confidence matches its accuracy. Base models are often reasonably calibrated on well-formatted multiple-choice questions (Kadavath et al., 2022); free-form answers are harder to read confidence from.",
      "Mitigations: ground answers in retrieved sources with citations, allow and reward abstention, check consistency across samples, and verify claims against tools or databases.",
    ],
    qwen: [
      { text: "LatentLens's Recall Microscope scored Qwen3-8B-Base on 316 tokens of the Gettysburg Address: 73 tokens were not its top guess, and 9 of those misses match the wording of another Lincoln manuscript, so a “miss” is not always an invention.", status: "verified" },
      { text: "Qwen3-8B-Base has had no post-training, so nothing has taught it to abstain; it continues text.", status: "inferred" },
    ],
    shapes: [["question", "decode the most likely continuation", "fluent answer, right or wrong"], ["question + retrieved sources", "answer with citations or abstain", "checkable answer"]],
    why: "Users act on stated facts. Knowing why models hallucinate tells you which mitigations can work: grounding and abstention, not more confident wording.",
    breaks: "Ungrounded assistants invent citations, numbers, legal cases and API names; agents act on invented facts.",
    trainInfer: "The cause is in training (objective and evaluation incentives); the symptoms and most mitigations are at inference and in the application.",
    security: "Misinformation is a security risk (OWASP LLM Top 10). Attackers register package names that models hallucinate (“package hallucination”) so developers install malicious code.",
    confusion: "“Hallucination is a bug that the next model version will fix.” It follows from how models are trained and graded; it can be reduced and contained, not assumed away.",
    teachBack: { prompt: "Explain why LLMs hallucinate and how to build systems that cope with it.", points: ["likely text, not checked facts", "rare facts force generalization", "binary grading rewards guessing", "calibration", "grounding with citations", "abstention", "package hallucination as an attack"] },
    interview: { q: "How would you reduce hallucinations in a support bot?", level: 3, outline: ["retrieve from authoritative sources", "require citations", "allow and test “I don't know”", "verify critical facts with tools", "measure groundedness"] },
    quiz: [
      { id: "halluc-1", topic: "hallucination", area: "arch", prompt: "Why does a base model state wrong facts fluently?", options: [
        { t: "It generates likely text; a plausible wrong continuation can have high probability", ok: true, why: "Fluency comes from the training objective, not from checking truth." },
        { t: "It looks the answer up in a corrupted database", why: "There is no database; knowledge is in the weights." },
        { t: "Softmax always picks the wrong token", why: "Softmax only turns scores into probabilities." },
      ] },
      { id: "halluc-2", topic: "hallucination", area: "security", prompt: "What is “package hallucination” abused for?", options: [
        { t: "Registering package names models invent, so developers install the attacker's code", ok: true, why: "Studied by Spracklen et al. (2024)." },
        { t: "Making the model reveal its system prompt", why: "That is system-prompt leakage." },
        { t: "Slowing down inference", why: "That is resource abuse." },
      ] },
    ],
    links: [{ href: "/latent/recall", label: "Recall Microscope" }, { href: "/latent/security/labs/rag", label: "Lab 7: retrieval" }],
    sources: [{ label: "Why Language Models Hallucinate (arXiv 2509.04664)", url: "https://arxiv.org/abs/2509.04664" }, { label: "Language Models (Mostly) Know What They Know (arXiv 2207.05221)", url: "https://arxiv.org/abs/2207.05221" }, { label: "Package hallucinations by code-generating LLMs (arXiv 2406.10279)", url: "https://arxiv.org/abs/2406.10279" }],
  },

  // ---------------- Level 6 ----------------
  {
    slug: "superposition", track: "mastery", level: 6, title: "Features, superposition and sparse autoencoders", prereqs: ["probes", "residual-stream"],
    intuition: "A model stores far more concepts than it has dimensions by packing them in as overlapping directions; sparse autoencoders try to pull those directions back apart.",
    visual: "probe", where: "In the residual stream and MLP activations of every block.",
    mechanism: [
      "Linear representation idea: many concepts correspond to directions in activation space; a concept is “on” to the degree the activation points that way.",
      "Superposition (Toy Models of Superposition, 2022): when features are sparse, a network can represent more features than it has dimensions using nearly orthogonal directions, accepting a little interference. Individual neurons then respond to several unrelated things (polysemantic).",
      "Sparse autoencoders (dictionary learning): train a wide encoder and decoder to reconstruct activations from a few active features at a time, with a sparsity penalty. The learned features are often far more interpretable than neurons (Towards Monosemanticity, 2023; scaled to a production model in 2024).",
      "Circuits: the residual stream acts as a shared channel that attention heads and MLPs read from and write to; specific heads, such as induction heads that continue repeated patterns, can be traced end to end.",
    ],
    eq: ["x ≈ b + Σ_i f_i(x) · d_i   (few f_i non-zero)", "loss = ||x − x̂||² + λ Σ_i |f_i(x)|"],
    qwen: [
      { text: "Qwen3-8B's residual stream has 4,096 dimensions per token (checkpoint), so any representation of more than 4,096 distinct features at one point must use superposition.", status: "verified" },
      { text: "No public sparse-autoencoder dictionary for Qwen3-8B-Base was used or checked in this project.", status: "unknown" },
    ],
    shapes: [["activation x [4096]", "encoder + ReLU", "sparse features f [m], m ≫ 4096"], ["f [m]", "decoder", "reconstruction x̂ [4096]"]],
    why: "Neurons are the wrong unit for understanding a model; features are closer to the right one. Finding them is a step toward checking what a model knows and why it acts.",
    breaks: "Without it, interpretability stalls on polysemantic neurons. Sparse autoencoders themselves can miss features, split one feature into many, or reconstruct poorly.",
    trainInfer: "Analysis is done on a trained model's activations at inference; SAEs are trained separately on those activations, without changing the model.",
    security: "Interpretability can help detect deception, backdoors or memorized secrets, and steering by features can change behaviour; the same steering could also be used to remove safeguards from open models.",
    confusion: "“One neuron, one concept.” Because of superposition, a neuron usually mixes several concepts and a concept is spread over many neurons.",
    teachBack: { prompt: "Explain superposition and how sparse autoencoders help.", points: ["features as directions", "more features than dimensions", "sparsity makes it possible", "polysemantic neurons", "SAE: wide, sparse reconstruction", "circuits and induction heads", "limits of SAEs"] },
    interview: { q: "Why are individual neurons often hard to interpret?", level: 4, outline: ["superposition packs many sparse features into fewer dimensions", "features are directions, not single neurons", "so neurons are polysemantic", "sparse dictionaries recover more monosemantic features"] },
    quiz: [
      { id: "sae-1", topic: "superposition", area: "arch", prompt: "What makes superposition possible?", options: [
        { t: "Features are sparse: few are active at once, so overlapping directions rarely interfere", ok: true, why: "Sparsity keeps interference small enough to be worth the extra capacity." },
        { t: "Every feature gets its own dimension", why: "Then there would be no superposition." },
        { t: "RMSNorm removes interference", why: "Normalization rescales vectors; it does not separate features." },
      ] },
      { id: "sae-2", topic: "superposition", area: "connection", prompt: "What does a sparse autoencoder's sparsity penalty encourage?", options: [
        { t: "Each activation is explained by a few active features", ok: true, why: "That is what makes the learned features individually interpretable." },
        { t: "Smaller model weights in the LLM", why: "The LLM is not changed; only the autoencoder is trained." },
        { t: "Exact reconstruction at any cost", why: "It trades some reconstruction error for sparsity." },
      ] },
    ],
    links: [{ href: "/latent/research", label: "LatentLens research: probes" }, { href: "/latent?part=model.blocks#atlas", label: "Atlas: the residual stream" }],
    sources: [{ label: "A Mathematical Framework for Transformer Circuits (2021)", url: "https://transformer-circuits.pub/2021/framework/index.html" }, { label: "Toy Models of Superposition (2022)", url: "https://transformer-circuits.pub/2022/toy_model/index.html" }, { label: "Towards Monosemanticity (2023)", url: "https://transformer-circuits.pub/2023/monosemantic-features/index.html" }, { label: "Scaling Monosemanticity (2024)", url: "https://transformer-circuits.pub/2024/scaling-monosemanticity/index.html" }, { label: "In-context Learning and Induction Heads (arXiv 2209.11895)", url: "https://arxiv.org/abs/2209.11895" }],
  },

  // ---------------- Level 7 (security) ----------------
  {
    slug: "web-security", track: "security", level: 7, title: "Web security basics every AI engineer needs", prereqs: ["security-foundations"],
    intuition: "An LLM app is still a web app: model output, model-chosen URLs and model-chosen ids are untrusted input, and the classic web rules apply to them unchanged.",
    visual: "boundary", where: "Wherever model output meets an interpreter or a privileged request: the browser, the server's network, the database, internal APIs.",
    mechanism: [
      "Authentication proves who the user is; authorization decides what they may do. Broken access control (for example, reading another customer's order by changing its id) is the top web risk in OWASP's 2021 list.",
      "Cross-site scripting: text shown as HTML runs as code in the viewer's browser with their session. Fix: encode output for its context and add a Content-Security-Policy.",
      "Server-side request forgery: a server fetches a URL chosen by someone else and reaches internal services or the cloud metadata service. Fix: parse the URL, allow exact https hosts, block private addresses and re-check the resolved IP at connection time.",
      "Injection: data concatenated into SQL or shell commands becomes code. Fix: parameterized queries, allowlisted commands, no shell, strict schemas for tool arguments.",
    ],
    qwen: [
      { text: "The LLM property behind it: the model's output is sampled from a distribution conditioned on its whole context, including untrusted text, so it carries no guarantee about what it contains.", status: "generic" },
      { text: "Tool calls are requests the application makes on the user's behalf; the model choosing the arguments does not make them authorized.", status: "generic" },
    ],
    shapes: [["model output", "context-aware encoding", "safe text in the page"], ["model-chosen URL", "parse, allowlist host, check IP", "fetch or refuse"]],
    why: "Most real-world LLM application incidents are classic web vulnerabilities reached through a new input path.",
    breaks: "Skipping these basics turns a chatbot into a script injector, an internal network scanner or a data-export tool.",
    trainInfer: "Inference and application layer only: no training change fixes them; the application must enforce them.",
    security: "This topic is the foundation for improper output handling, excessive agency and agent security; lab 2 lets you break and fix each bug.",
    confusion: "“Authentication means the request is allowed.” A signed-in user is known, not authorized for everything; every object access needs its own check.",
    teachBack: { prompt: "Explain XSS, SSRF and broken access control and how each appears in an LLM app.", points: ["authentication vs authorization", "XSS via rendered model output", "markdown images as a data leak", "SSRF via a URL tool and the metadata service", "IDOR via a model-chosen id", "parameterized queries and allowlists"] },
    interview: { q: "Your agent has a fetch_url tool. How do you stop SSRF?", level: 3, outline: ["parse with a real URL parser", "allow only https and exact hosts", "block private, loopback and link-local ranges", "resolve and check the IP at connection time (DNS rebinding)", "no redirects to disallowed hosts", "run without cloud credentials"] },
    quiz: [
      { id: "websec-1", topic: "web-security", area: "security", prompt: "A URL check allows anything that starts with https://docs.example.test. Which URL slips past it to the metadata service?", options: [
        { t: "https://docs.example.test@169.254.169.254/", ok: true, why: "The part before @ is a username; the host is 169.254.169.254." },
        { t: "https://docs.example.test/guide", why: "That really is the documentation host." },
        { t: "http://169.254.169.254/", why: "It does not start with the allowed prefix, so the naive check rejects it." },
      ] },
      { id: "websec-2", topic: "web-security", area: "security", prompt: "Where must “users may only see their own orders” be enforced?", options: [
        { t: "In the order API, on every request, using the signed-in user", ok: true, why: "Only server-side checks hold no matter what the model is told or asked." },
        { t: "In the system prompt", why: "A prompt rule is advice to the model; a persuasive request can override it." },
        { t: "In the user interface", why: "The UI can be bypassed by calling the API directly." },
      ] },
    ],
    links: [{ href: "/latent/security/labs/web-basics", label: "Lab 2: web bugs LLM apps inherit" }, { href: "/latent/security/labs/output-handling", label: "Lab 8: output handling" }],
    sources: [{ label: "OWASP Top 10 (web)", url: "https://owasp.org/Top10/" }, { label: "OWASP SSRF Prevention Cheat Sheet", url: "https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html" }, { label: "OWASP XSS Prevention Cheat Sheet", url: "https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html" }, { label: "PortSwigger Web Security Academy: access control", url: "https://portswigger.net/web-security/access-control" }],
  },
];
