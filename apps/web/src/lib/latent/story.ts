// The LLM Storybook: fourteen short chapters from "a machine that guesses the next word" to today's models.
// Story lines are written to be read aloud to a young child; the grown-up corner says the same thing precisely and
// links to the deeper LatentLens pages. Plain data, safe for server and client.

export interface Chapter {
  n: number;
  slug: string;
  part: number;
  title: string;
  emoji: string;
  story: string[];             // read aloud, one sentence per entry
  doIt: string;                // the spoken instruction for the activity
  learned: string;
  sticker: { emoji: string; name: string };
  words?: [string, string][];  // [storybook word, real name]
  grown: string[];
  links: { href: string; label: string }[];
}

export const PARTS = ["Words and numbers", "How machines learn", "Inside the model", "Growing up", "Today's models"];

export const CHAPTERS: Chapter[] = [
  {
    n: 1, slug: "guess", part: 0, title: "The guessing game", emoji: "⭐",
    story: [
      "Let's play a game.",
      "I say some words, and you guess the next one.",
      "Twinkle, twinkle, little star!",
      "You knew it, because you have heard it before.",
      "A language model is a computer that plays this game.",
      "It is very, very good at guessing the next word.",
    ],
    doIt: "Tap the word that comes next.",
    learned: "A language model guesses the next word.",
    sticker: { emoji: "⭐", name: "Guesser" },
    words: [["language model", "LLM, a large language model"]],
    grown: [
      "A language model gives a probability to every token in its vocabulary (151,936 tokens for Qwen3), given all the text so far. Text is written by choosing one token, adding it, and asking again.",
      "The bars under the rhymes are real: Qwen3-8B-Base's recorded next-token probabilities after \"The researcher opened the notebook\" (bfloat16, one forward pass).",
    ],
    links: [{ href: "/latent/journey?s=7", label: "Journey scene 7: scores become the next token" }, { href: "/latent/play", label: "You vs Qwen: guess the Gettysburg Address" }],
  },
  {
    n: 2, slug: "pieces", part: 0, title: "Words are made of pieces", emoji: "🧱",
    story: [
      "Before the computer can guess, it cuts the words into pieces.",
      "Short, common words stay whole, like \"the\" and \"cat\".",
      "Long or rare words are cut into a few pieces, like building blocks.",
      "Every piece has its own number.",
      "Tap a word to see how a real model cuts it.",
    ],
    doIt: "Tap a word card. Count its blocks.",
    learned: "The computer reads pieces of words, not whole words.",
    sticker: { emoji: "🧱", name: "Block builder" },
    words: [["piece", "token"], ["piece number", "token id"]],
    grown: [
      "Qwen3 uses a byte-level BPE tokenizer. Frequent strings are single tokens; rare words split into several. The space before a word is part of the token, so \" notebook\" and \"notebook\" have different ids.",
      "Every split shown here is the real Qwen3 tokenizer output, recorded by LatentLens.",
    ],
    links: [{ href: "/latent/journey?s=1", label: "Journey scene 1: text becomes tokens" }],
  },
  {
    n: 3, slug: "codes", part: 0, title: "Every piece gets a secret code", emoji: "🔢",
    story: [
      "Computers love numbers.",
      "So every piece gets its own list of numbers, like a secret code.",
      "Words that mean similar things get similar codes.",
      "That is how the computer can tell that a puppy is a bit like a kitten.",
      "Make a code with the sliders, and see which words live nearby.",
    ],
    doIt: "Move the sliders. Who lives next to your word?",
    learned: "Every piece becomes a list of numbers, and similar words get similar lists.",
    sticker: { emoji: "🔢", name: "Code maker" },
    words: [["secret code", "embedding vector"]],
    grown: [
      "Each token id selects one row of the embedding matrix: 151,936 rows of 4,096 numbers in Qwen3-8B. The rows are learned in training.",
      "The three sliders are a toy. A real model's 4,096 numbers are not labelled \"alive\" or \"big\"; meaning is spread across many directions, and nobody chose them by hand.",
    ],
    links: [{ href: "/latent/journey?s=2", label: "Journey scene 2: tokens become vectors" }],
  },
  {
    n: 4, slug: "counting", part: 1, title: "Teach a machine by reading to it", emoji: "📚",
    story: [
      "Here is a baby word machine. It knows nothing yet.",
      "Read it some sentences. It counts which word comes after which.",
      "Then press \"Let it talk\", and it makes new sentences from what it counted.",
      "The more it reads, the better it gets.",
    ],
    doIt: "Tap sentence cards to read them to the machine. Then let it talk.",
    learned: "Machines learn from lots and lots of reading.",
    sticker: { emoji: "📚", name: "Teacher" },
    words: [["counting machine", "bigram model"]],
    grown: [
      "This is a bigram model: the next word depends only on the current word, with probabilities equal to counts. Claude Shannon built text this way in 1948.",
      "A real language model looks at the whole text so far (up to 32,768 tokens for Qwen3-8B) and stores what it learned in billions of weights, not in a count table. It is trained by gradient descent, which is the next chapter.",
    ],
    links: [{ href: "/latent/story/timeline", label: "The story so far: Shannon, 1948" }],
  },
  {
    n: 5, slug: "practice", part: 1, title: "Getting better by practising", emoji: "🚲",
    story: [
      "A real model learns by practising, like you learn to ride a bike.",
      "It guesses. Then it checks the right answer.",
      "If it was surprised, it turns its knobs a tiny bit.",
      "Press \"Practise\" and watch the surprise get smaller.",
      "But if the steps are too big, it wobbles!",
    ],
    doIt: "Press Practise. Then try huge steps.",
    learned: "Models learn by guessing, checking, and changing a tiny bit.",
    sticker: { emoji: "🚲", name: "Practiser" },
    words: [["knobs", "parameters (weights)"], ["surprise", "loss (cross-entropy)"], ["step size", "learning rate"]],
    grown: [
      "Each step lowers the cross-entropy loss, -ln p(correct word), by gradient descent. For next-word scores the gradient is simply p - onehot(correct word).",
      "The examples say \"milk\" three times and \"water\" twice, so the best possible answer is 60% milk, 40% water. Each practice step uses one example, so tiny steps settle very close to that and good steps hover nearby; huge steps overshoot back and forth, which is why real training uses small learning rates.",
      "Qwen3-8B has 8,190,735,360 parameters, all trained this way (by backpropagation through every layer) on about 36 trillion tokens.",
    ],
    links: [{ href: "/latent/labs/training", label: "Lab: one training step" }, { href: "/latent/journey?s=8", label: "Journey scene 8: learning versus using" }],
  },
  {
    n: 6, slug: "flashlight", part: 2, title: "A flashlight called attention", emoji: "🔦",
    story: [
      "Some words point back to other words.",
      "The dog chased the ball because it was hungry. Who was hungry?",
      "The dog! Balls don't get hungry.",
      "A model has a flashlight called attention. Each word shines it on the earlier words that help it.",
      "Change the last word, and watch the flashlight move.",
    ],
    doIt: "Tap a different last word. Where does the flashlight shine?",
    learned: "Attention lets each word look back at the words that matter.",
    sticker: { emoji: "🔦", name: "Flashlight" },
    words: [["flashlight", "attention"]],
    grown: [
      "Attention scores each earlier position by query · key / √d, turns the scores into shares with softmax, and mixes those positions' value vectors. A word can only look back, never forward (the causal mask).",
      "In this toy the keys and queries have two hand-picked numbers so the idea is visible; the formula is the real one. Qwen3-8B has 32 attention heads in each of its 36 blocks.",
    ],
    links: [{ href: "/latent/journey?s=4&level=research", label: "A real Qwen attention head" }, { href: "/latent/labs/attention", label: "Lab: attention microscope" }],
  },
  {
    n: 7, slug: "tower", part: 2, title: "A tower of thinking floors", emoji: "🏰",
    story: [
      "The model is like a tall tower with many floors.",
      "On every floor, each piece does two things.",
      "First it looks around at the other pieces. That is the purple step.",
      "Then it thinks on its own. That is the orange step.",
      "It writes what it found in its blue notebook, and climbs up.",
      "Qwen has 36 floors. At the top, the notebook turns into guesses.",
    ],
    doIt: "Press Climb, and ride the piece to the top of the tower.",
    learned: "A model is a tower of the same kind of floor, stacked many times.",
    sticker: { emoji: "🏰", name: "Tower climber" },
    words: [["floor", "transformer block (layer)"], ["looking around", "attention"], ["thinking on its own", "MLP"], ["notebook", "residual stream"]],
    grown: [
      "Each Qwen3 block: RMSNorm, attention, add to the residual stream; RMSNorm, SwiGLU MLP, add. Every floor has the same shape but its own weights.",
      "The guesses at the top are the recorded Qwen3-8B-Base probabilities for the next token.",
    ],
    links: [{ href: "/latent/glassbox", label: "Glass Box: one real floor, opened" }, { href: "/latent/journey?s=3", label: "Journey scene 3: one block" }],
  },
  {
    n: 8, slug: "library", part: 3, title: "Reading a giant library", emoji: "🏛️",
    story: [
      "How does a model learn all this?",
      "It reads a giant library, more than one person could read in thousands of lifetimes.",
      "While it reads, it plays the guessing game again and again, and turns its knobs each time.",
      "Bigger models have more knobs. Some have more than a trillion!",
      "Some giant models work like a school full of helpers. For each piece, only a few helpers answer.",
    ],
    doIt: "Pick a model and count its knobs. Then tap a word and see which helpers answer.",
    learned: "Models learn by reading a huge amount, and giant ones share the work among helpers.",
    sticker: { emoji: "🏛️", name: "Librarian" },
    words: [["knobs", "parameters"], ["school of helpers", "mixture of experts"], ["reading the library", "pretraining"]],
    grown: [
      "Qwen3 was pretrained on about 36 trillion tokens. A person reading 250 words a minute, 8 hours a day, every day for 80 years reads about 3.5 billion words, roughly 4.7 billion tokens at about 1.3 tokens per English word. 36 trillion tokens is about 7,700 such lifetimes.",
      "In a mixture-of-experts model a small router picks a few expert MLPs for each token. Qwen3.8 has 512 experts and uses 10 routed experts plus 1 shared expert per token, so only 95B of its 2.4T parameters work on any one token. Which helpers light up here is a toy; the counts are from the model card.",
    ],
    links: [{ href: "/latent/story/timeline", label: "The story so far" }],
  },
  {
    n: 9, slug: "manners", part: 3, title: "Learning to be a good helper", emoji: "🤝",
    story: [
      "After reading the library, a model can continue any text. But it is not a good helper yet.",
      "Ask it a question, and it might just write more questions!",
      "So people show it good answers, and they pick which of two answers is better.",
      "The model learns to give the kind of answers people liked.",
      "You can be the teacher. Pick the better answer.",
    ],
    doIt: "Read both answers. Tap the better one.",
    learned: "People teach models to be helpful, honest and kind.",
    sticker: { emoji: "🤝", name: "Kind teacher" },
    words: [["showing good answers", "supervised fine-tuning"], ["picking the better answer", "human feedback (RLHF)"]],
    grown: [
      "A pretrained base model only continues text. Assistants are made by fine-tuning on example conversations and then reinforcement learning from human (or AI) preferences, using a reward model trained on comparisons like the ones here.",
      "This toy reward has two features (does it help? is it kind?) and learns their weights from your picks with a Bradley-Terry update. Qwen3-8B-Base, the model LatentLens studies, is a base model: pretrained, not chat-tuned.",
    ],
    links: [{ href: "/latent/methods", label: "Why LatentLens studies a base model" }],
  },
  {
    n: 10, slug: "dice", part: 3, title: "Spinning the word wheel", emoji: "🎡",
    story: [
      "When a model talks, it doesn't always pick its biggest guess.",
      "It spins a wheel. Big guesses get big slices.",
      "A dial called temperature changes the wheel.",
      "Cold makes the biggest slice win almost every time. Hot makes the slices more even, so surprises happen.",
      "This is Qwen's real wheel. Spin it!",
    ],
    doIt: "Pick cold or hot. Then spin.",
    learned: "Temperature changes how surprising the next word can be.",
    sticker: { emoji: "🎡", name: "Wheel spinner" },
    words: [["wheel", "probability distribution"], ["spin", "sampling"], ["dial", "temperature"]],
    grown: [
      "Shares at temperature T are exp(z / T − logsumexp(z / T)). The scores z and the full-vocabulary normalizers were recorded from Qwen3-8B-Base, so each slice is exact at the six recorded temperatures; other temperatures are not offered. \"Everything else\" is the rest of the 151,936-token vocabulary.",
      "The spin itself is a random draw in your browser; nothing reruns the model.",
    ],
    links: [{ href: "/latent/labs/sampling", label: "Lab: temperature and sampling" }],
  },
  {
    n: 11, slug: "thinking", part: 4, title: "Thinking before answering", emoji: "🧠",
    story: [
      "Some new models think before they answer.",
      "They write little notes to themselves, step by step, like you do on scrap paper.",
      "This helps a lot with puzzles and maths.",
      "Try a puzzle. First a fast guess, then with thinking steps.",
    ],
    doIt: "Pick a puzzle. Press Fast, then press Think.",
    learned: "Thinking step by step helps with hard problems.",
    sticker: { emoji: "🧠", name: "Thinker" },
    words: [["thinking notes", "chain of thought (reasoning tokens)"]],
    grown: [
      "Reasoning models are trained, mostly with reinforcement learning, to generate intermediate tokens before the final answer; spending more tokens at answer time (test-time compute) improves accuracy on hard problems.",
      "The puzzle answers here are written by hand to show the idea; no model is running.",
    ],
    links: [{ href: "/latent/story/timeline", label: "o1, DeepSeek-R1, Qwen3.8 and more" }],
  },
  {
    n: 12, slug: "agents", part: 4, title: "Eyes, ears and hands", emoji: "🛠️",
    story: [
      "The newest models can do more than read and write.",
      "Some can see pictures, and look through a camera.",
      "Some can listen, and talk out loud.",
      "Some can use tools, like a calculator, a web browser, or a whole computer.",
      "A model that makes a plan and uses tools to finish a job is called an agent.",
      "Help Pip the agent finish a job!",
    ],
    doIt: "Tap the steps in the right order. Then press Go.",
    learned: "Agents make a plan, use tools, and check their work.",
    sticker: { emoji: "🛠️", name: "Agent helper" },
    words: [["seeing and hearing", "multimodal"], ["agent", "AI agent (tool use)"]],
    grown: [
      "An agent runs the model in a loop: the model writes a tool call, the program runs the tool, the result is added to the text, and the model continues until the job is done.",
      "The weather and reminder tools here are pretend. The two pairs of same-named models are real; see the sources in the timeline.",
    ],
    links: [{ href: "/latent/story/timeline", label: "Project Astra, GPT-6 Astra, Muse and Muse Spark" }],
  },
  {
    n: 13, slug: "careful", part: 4, title: "When machines make mistakes", emoji: "🔍",
    story: [
      "Language models are amazing, but they can be wrong.",
      "They can say something that sounds very sure, but is not true.",
      "We tested a real model, Qwen, on a famous old speech, the Gettysburg Address.",
      "It guessed the next word right about 77 times out of 100.",
      "And some of its mistakes were not really mistakes! Abraham Lincoln wrote the speech out five times, a little differently each time.",
      "So check important things, and ask a grown-up you trust.",
    ],
    doIt: "Look at what Qwen guessed, and what Lincoln wrote. Then flip the safety cards.",
    learned: "Models can be wrong, so we always check.",
    sticker: { emoji: "🔍", name: "Fact checker" },
    words: [["sounding sure but wrong", "hallucination"]],
    grown: [
      "Teacher-forced top-1 recall of Qwen3-8B-Base on the Bliss copy of the Gettysburg Address was 76.9% (bfloat16). Of its 73 misses, 9 are the wording of another Lincoln manuscript (79.7% if any manuscript counts).",
      "Labs also test models for dangerous abilities. OpenAI says GPT-6 Astra met its \"critical\" cybersecurity threshold, so it limited early access; Anthropic reports Claude Opus 5.5 is much less likely than recent models to take hard-to-reverse actions. These are the companies' own statements.",
    ],
    links: [{ href: "/latent/recall", label: "Recall Microscope and the five manuscripts" }],
  },
  {
    n: 14, slug: "timeline", part: 4, title: "The story so far", emoji: "🏆",
    story: [
      "People have dreamed of talking machines for a long time.",
      "Tap the years to walk through the story, from 1948 until today.",
      "What comes next? Nobody knows for sure.",
      "Maybe you will help build it.",
    ],
    doIt: "Tap a year. Tap a picture to see only that kind of idea.",
    learned: "Language models grew from a simple guessing game into helpers that see, talk and use tools.",
    sticker: { emoji: "🏆", name: "Storyteller" },
    grown: [
      "Every entry links to its source. Entries from 2026 were checked against the labs' own pages or major news coverage on the date shown; new models appear almost weekly, so this list will go out of date.",
    ],
    links: [{ href: "/latent/journey", label: "Next: the full journey through Qwen3-8B" }, { href: "/latent/glassbox", label: "Glass Box" }],
  },
];

export const chapterBySlug = (slug: string) => CHAPTERS.find((c) => c.slug === slug);
