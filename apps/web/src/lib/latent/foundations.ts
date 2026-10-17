// Level 0 · Foundations: the maths and machine-learning ideas an LLM is built from, one interactive module each.
// `atlas` links use the Atlas deep-link form "level.node" (see components/latent/atlas/atlas.tsx).

export interface FoundationLink { label: string; atlas?: string; href?: string }

export interface Foundation {
  slug: string;
  title: string;
  oneLine: string;
  hook: string;
  idea: string[];
  inLLM: FoundationLink[];
  confusion: string;
  recall: { q: string; a: string }[];
  build?: { step: string; file: string; what: string };
  play: string;               // the instruction shown above the widget
}

export const FOUNDATIONS: Foundation[] = [
  {
    slug: "vectors",
    title: "Vectors and the dot product",
    oneLine: "A vector is a list of numbers you can picture as an arrow. The dot product measures how much two arrows point the same way.",
    hook: "Same direction: big positive. Right angle: zero. Opposite: big negative.",
    play: "Drag the tips of the two arrows. Watch the dot product and the angle.",
    idea: [
      "Every token inside an LLM is a vector: Qwen3-8B uses 4,096 numbers per token. We can only draw 2 of them, but every rule you see here holds in 4,096 dimensions.",
      "The dot product multiplies matching coordinates and adds them up: a·b = a₁b₁ + a₂b₂ + … It equals |a| |b| cos(angle), so it grows when the arrows are long and when they point the same way.",
      "Dividing by both lengths leaves only the direction part, the cosine similarity, between −1 and 1. Embedding search and “these two words are similar” are this number.",
    ],
    inLLM: [
      { label: "Attention scores are dot products of a query with every key", atlas: "attention.scores" },
      { label: "The LM head scores each vocabulary entry with a dot product", atlas: "model.lm_head" },
      { label: "Each token starts life as a 4,096-number vector", atlas: "model.embedding" },
    ],
    confusion: "A big dot product does not always mean “similar direction”: a very long vector gives big dot products with almost anything. That is one reason Qwen normalizes queries and keys (QK-norm) before comparing them.",
    recall: [
      { q: "What is (1, 2) · (3, −1)?", a: "1×3 + 2×(−1) = 1." },
      { q: "Two vectors at a right angle: what is their dot product?", a: "Zero, whatever their lengths. cos(90°) = 0." },
    ],
  },
  {
    slug: "matrices",
    title: "Matrices are functions",
    oneLine: "A matrix is a machine that turns one vector into another. Multiplying by it stretches, rotates and mixes the coordinates.",
    hook: "Every output number is a dot product of the input with one column.",
    play: "Change the four numbers of the matrix W. The grid shows what W does to the whole plane; the arrow shows one vector x and its image xW.",
    idea: [
      "Written as xW (the convention in PyTorch code), each output coordinate is the dot product of x with one column of W. A 4,096 × 12,288 matrix, like Qwen's up_proj, makes 12,288 such dot products at once.",
      "Matrices can stretch (scale), rotate, shear, flatten a dimension away, or change the number of dimensions entirely. A neural network layer is a matrix followed by a simple nonlinearity.",
      "Almost all of an LLM's 8 billion parameters are entries of matrices like this. “Training” means adjusting those entries.",
    ],
    inLLM: [
      { label: "Q, K and V are three different matrices applied to the same input", atlas: "attention.q" },
      { label: "The MLP widens 4,096 numbers to 12,288 with one matrix", atlas: "mlp.up" },
      { label: "Merging 32 attention heads back into the stream is one matrix", atlas: "attention.oproj" },
    ],
    confusion: "Matrix multiplication is not elementwise multiplication. xW mixes every input coordinate into every output coordinate; elementwise (⊙) multiplies matching positions only, which is what the MLP's gate does.",
    recall: [
      { q: "x has 4,096 numbers and W is 4,096 × 1,024. How many numbers does xW have?", a: "1,024. The output size is the number of columns." },
      { q: "Which W leaves every vector unchanged?", a: "The identity: 1 on the diagonal, 0 elsewhere." },
    ],
  },
  {
    slug: "softmax",
    title: "Probability and softmax",
    oneLine: "Softmax turns any list of scores into probabilities: all positive, adding up to 1, with bigger scores getting more.",
    hook: "Exponentiate, then divide by the total. Only the gaps between scores matter.",
    play: "Move the scores (logits) of the five candidate words, and the temperature. The bars are the probabilities.",
    idea: [
      "A model's raw outputs, logits, can be any real numbers. Softmax computes e^score for each and divides by the sum, which makes every value positive and the total exactly 1.",
      "Adding the same number to every logit changes nothing: only differences matter. A gap of 1 between two logits means one is e ≈ 2.72 times as likely as the other.",
      "Temperature divides the logits before softmax. Below 1 the distribution sharpens toward the top choice; above 1 it flattens toward uniform. Temperature 0 means always take the top one (greedy).",
    ],
    inLLM: [
      { label: "The model's final scores over the vocabulary", atlas: "model.logits" },
      { label: "Softmax and sampling choose the next token", atlas: "model.softmax" },
      { label: "The same softmax turns attention scores into weights", atlas: "attention.attn_softmax" },
    ],
    confusion: "Softmax does not choose a token. It only produces probabilities; greedy decoding, sampling, top-k and top-p are separate rules applied afterwards.",
    recall: [
      { q: "Logits [2, 2, 2]: what are the probabilities?", a: "1/3 each. Equal scores give equal probabilities, whatever the value." },
      { q: "What does raising the temperature do?", a: "Flattens the distribution: less likely tokens get picked more often." },
    ],
  },
  {
    slug: "loss",
    title: "Loss: measuring how wrong",
    oneLine: "Cross-entropy loss is −log(probability the model gave to the right answer). Confident and right: near 0. Confident and wrong: huge.",
    hook: "The loss is the surprise. Training is the process of becoming less surprised by real text.",
    play: "Slide the probability the model gives to the correct next token. Watch the loss and the perplexity.",
    idea: [
      "For every position in the training text, the model outputs a distribution over the next token. The loss looks only at the probability p it gave to the token that actually came next, and scores it −ln p.",
      "p = 1 costs 0. p = 0.5 costs 0.69. p = 0.01 costs 4.6. The curve punishes confident mistakes much more than hesitant ones, which pushes the model toward honest probabilities.",
      "Averaged over many tokens this is the number training drives down. e^loss is the perplexity: “as unsure as choosing uniformly among this many tokens”. A model that knows nothing about Qwen's 151,936 entries scores ln(151,936) ≈ 11.9.",
    ],
    inLLM: [
      { label: "The loss is computed from these probabilities", atlas: "model.softmax" },
      { label: "Logits are what the loss's gradient flows back into first", atlas: "model.logits" },
    ],
    confusion: "Low training loss is not the same as being right or truthful. It means the model predicts its training text well, which can include predicting common mistakes.",
    recall: [
      { q: "The model gave the right token probability 1. What is the loss?", a: "0, because −ln 1 = 0." },
      { q: "Loss 2.3 nats per token. Roughly what perplexity?", a: "e^2.3 ≈ 10: as unsure as choosing among about 10 equally likely tokens." },
    ],
    build: { step: "Step 2", file: "s02_bigram.py", what: "compute this loss for a counting model" },
  },
  {
    slug: "gradients",
    title: "Gradients and gradient descent",
    oneLine: "The gradient says which way is uphill for the loss. Training takes small steps the opposite way, downhill.",
    hook: "Feel the slope, step downhill, repeat. The learning rate is the size of the step.",
    play: "Press Step to move the ball downhill on the loss curve. Change the learning rate and see what too small and too large do.",
    idea: [
      "The derivative of the loss with respect to one weight is the slope: how much the loss changes if that weight is nudged. The gradient is that slope for every weight at once, 8 billion of them for Qwen3-8B.",
      "Gradient descent updates each weight by w ← w − learning_rate × slope. Too small a learning rate and training crawls; too large and it overshoots and can blow up.",
      "Real training uses AdamW, which keeps a running average of past gradients and scales each weight's step individually, plus a learning-rate schedule (warm-up, then decay). The core idea is the same small step downhill.",
    ],
    inLLM: [
      { label: "Every learned matrix in the diagram is adjusted this way", atlas: "block.attn" },
      { label: "Including the 151,936 × 4,096 embedding table", atlas: "model.embedding" },
    ],
    confusion: "Using a model does not train it. During a chat, no gradients are computed and no weights change; learning only happens in a separate training run.",
    recall: [
      { q: "The slope at w is +3 and the learning rate is 0.1. What is the new w?", a: "w − 0.3. Positive slope means the loss rises to the right, so step left." },
      { q: "What happens with a learning rate that is far too large?", a: "The steps overshoot the minimum, the loss bounces or grows, and training can diverge." },
    ],
  },
  {
    slug: "backprop",
    title: "Backpropagation: the chain rule at scale",
    oneLine: "Backprop computes every gradient in one backward sweep, by multiplying local slopes along the path from the loss back to each weight.",
    hook: "Forward computes values. Backward multiplies slopes. Each node only needs its own local rule.",
    play: "Move the inputs. The top numbers are the forward values; the coloured numbers are the gradients flowing back from the loss.",
    idea: [
      "A network is a chain of simple operations. The chain rule says: the effect of a weight on the loss = (effect of the weight on the next value) × (effect of that value on the loss).",
      "So we go forward once to get every value, then backward once from the loss, multiplying local slopes. Each operation only needs to know its own derivative: for a + b both inputs get the incoming gradient; for a × b each input gets the gradient times the other input.",
      "PyTorch's autograd does exactly this for tensors. In the Build track you write it yourself on single numbers in about 60 lines.",
    ],
    inLLM: [
      { label: "The residual addition passes gradients straight through, which is why 36 blocks can be trained", atlas: "block.add1" },
      { label: "Gradients reach the very first layer through the residual stream", atlas: "model.blocks" },
    ],
    confusion: "Backprop is not the learning rule. It only computes gradients; the optimizer (gradient descent, AdamW) uses them to change the weights.",
    recall: [
      { q: "z = x × y with x = 3, y = −2, and dL/dz = 5. What is dL/dx?", a: "dL/dz × y = 5 × (−2) = −10." },
      { q: "For z = a + b, what gradient does a receive?", a: "Exactly the incoming gradient dL/dz: addition passes gradients through unchanged." },
    ],
    build: { step: "Step 1", file: "s01_micrograd.py", what: "write autograd from scratch and train it on XOR" },
  },
  {
    slug: "neural-nets",
    title: "Neural networks learn by fitting",
    oneLine: "A neural network is matrices with simple nonlinear functions between them. Gradient descent bends it to fit the data.",
    hook: "Without a nonlinearity, any stack of layers is just one straight line.",
    play: "Press Train and watch a tiny network (one hidden layer of 16 neurons) learn the curve. Switch the activation off to see why nonlinearity matters.",
    idea: [
      "One neuron computes a weighted sum of its inputs plus a bias, then applies an activation such as SiLU. A layer is many neurons side by side: a matrix multiply plus the activation.",
      "Stack linear layers without activations and the result is still a single linear map, no matter how deep. The nonlinearity is what lets networks build curves, edges and, at scale, language.",
      "Training repeats the loop you met in the last three modules: predict, measure the loss, backprop, step downhill. An LLM is this loop with a transformer as the network and next-token prediction as the task.",
    ],
    inLLM: [
      { label: "The MLP in every block is exactly this: matrix, SiLU, matrix", atlas: "block.mlp" },
      { label: "SiLU is Qwen's activation", atlas: "mlp.silu" },
    ],
    confusion: "Neurons in artificial networks are not models of brain neurons. The name is historical; each is just a weighted sum and a simple function.",
    recall: [
      { q: "Why does a network need a nonlinear activation?", a: "Without one, all layers multiply together into one linear map, which can only fit straight lines (or flat planes)." },
      { q: "What are the four steps of a training loop?", a: "Forward pass (predict), loss, backward pass (gradients), optimizer step (update weights)." },
    ],
    build: { step: "Step 1", file: "s01_micrograd.py", what: "train a small network on XOR with your own autograd" },
  },
  {
    slug: "next-token",
    title: "Predicting the next token",
    oneLine: "A language model gives a probability to every possible next token. Generating text is sampling one, appending it, and repeating.",
    hook: "Predict, pick, append, repeat. Everything else is how good the prediction is.",
    play: "This model only counts which character follows which in a short text. Click a character to see its next-character probabilities, or generate text.",
    idea: [
      "Text becomes tokens, and the model is trained on one task: given all the tokens so far, predict the next one. Every position in every document is a training example.",
      "The simplest model looks at only the previous character and counts. It already has the full machinery: a vocabulary, a probability for each next token, a loss, and a sampling loop.",
      "Its weakness is obvious when it writes: it has no memory beyond one character. Everything in a transformer exists to make the prediction use the WHOLE context, well.",
    ],
    inLLM: [
      { label: "The same loop, with Qwen's real top next-token probabilities", atlas: "model.softmax" },
      { label: "The chosen token is appended and the model runs again", atlas: "model.next" },
    ],
    confusion: "An LLM does not plan a whole answer and then type it out. It produces one token at a time; anything that looks like a plan has to be represented in its hidden states as it goes.",
    recall: [
      { q: "How many training examples does one 1,000-token document give?", a: "About 1,000: every position predicts the token after it." },
      { q: "What is the bigram model's big limitation?", a: "It only sees the previous token, so it cannot use anything earlier in the text." },
    ],
    build: { step: "Step 2", file: "s02_bigram.py", what: "build this counting model and its sampler" },
  },
  {
    slug: "why-attention",
    title: "Why attention",
    oneLine: "Good predictions need the right earlier words, which can be far back. Attention lets every position look back at all earlier ones and pick what matters.",
    hook: "Don't squeeze the past into one memory. Look back at it directly.",
    play: "Switch how much context the predictor may see, and watch whether it can get the verb right.",
    idea: [
      "“The keys to the old wooden cabinet ___”: the right verb is “are”, because of “keys”, six words earlier. A model that sees only the last word or two sees “cabinet” and guesses “is”.",
      "Older recurrent networks (RNNs) read text one token at a time and squeezed everything so far into one fixed-size memory vector. Long-range details got lost, and they could not be trained in parallel.",
      "Attention keeps every earlier token's vector around and lets the current position compute a weighted average of them, with the weights chosen by query-key matching. Distant tokens are one step away, and every position can be computed at the same time during training.",
    ],
    inLLM: [
      { label: "Attention: the only place tokens exchange information", atlas: "block.attn" },
      { label: "The causal mask: look back, never forward", atlas: "attention.mask" },
      { label: "Real attention weights from Qwen3-8B", atlas: "attention.weighted" },
    ],
    confusion: "Attention weights are not an explanation of the model's reasoning. They show where information was read from in one head of one layer, among hundreds.",
    recall: [
      { q: "What did attention replace, and what was that design's weakness?", a: "Recurrent networks, which squeezed the whole past into one fixed-size vector, lost distant details and could not be parallelized across positions." },
      { q: "In a decoder-only LLM, which positions can a token attend to?", a: "Itself and every earlier position, never later ones (the causal mask)." },
    ],
    build: { step: "Step 4", file: "s04_attention.py", what: "write attention and the causal mask" },
  },
];

export const foundation = (slug: string) => FOUNDATIONS.find((f) => f.slug === slug);

/** The whole route from zero to red team, shown on the Foundations index. */
export const ROUTE = [
  { n: 0, title: "Foundations", line: "Vectors, matrices, probability, gradients, backprop, next-token prediction.", href: "/latent/foundations" },
  { n: 1, title: "The Atlas", line: "The whole transformer, drawn and explained part by part with Qwen3-8B's real numbers.", href: "/latent" },
  { n: 2, title: "Build it", line: "Write autograd, a tokenizer, attention and a tiny Qwen-style GPT yourself, with automatic checks.", href: "/latent/build" },
  { n: 3, title: "Mastery", line: "Training, post-training, inference and serving, RAG, agents and MCP, interpretability.", href: "/latent/mastery" },
  { n: 4, title: "AI security", line: "Threat models, prompt injection, jailbreaks, poisoning, extraction, agent and MCP security.", href: "/latent/security" },
  { n: 5, title: "Practice", line: "Labs, security labs and red-team exercises against real targets.", href: "/latent/labs" },
];
