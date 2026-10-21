# LLM and AI-security confusion pairs

Say the difference aloud before reading it. Each pair: the one-sentence difference, a comparison, an example and a trap question.

_Generated from the LatentLens curriculum data (apps/web/src/lib/latent). Edit the data, then regenerate; do not edit by hand._

## Token vs Token ID

A token is a piece of text chosen by the tokenizer; its token ID is the integer that names that piece in the vocabulary.

| | Token | Token ID |
|---|---|---|
| Example | " notebook" (with its leading space) | 37166 |
| Used by | humans reading the split | the embedding lookup |

**Example.** Token "Token" (no leading space) has id 3323; "ization" has id 2022.

**Trap.** Is " notebook" the same token as "notebook"? _No; the leading space is part of the token, so the ids differ._

## Token vs Embedding

A token is an integer id; its embedding is the learned vector that id selects.

| | Token | Embedding |
|---|---|---|
| Type | integer (e.g. 37166) | vector of 4,096 numbers |
| Geometry | none | learned |
| Where | tokenizer output | first model operation |

**Example.** Token id 37166 (" notebook") selects row 37166 of a [151936, 4096] table.

**Trap.** Do two tokens with ids 37166 and 37167 have similar embeddings? _Not necessarily; id order carries no meaning, only learned rows do._

## Embedding vs Hidden state

The embedding is the starting vector; a hidden state is the residual-stream vector after some number of blocks, shaped by context.

| | Embedding | Hidden state |
|---|---|---|
| Depends on context | no (same row every time) | yes |
| Layer | 0 | 1 to 36 |

**Example.** "bank" has one embedding, but different hidden states in "river bank" and "bank account" after a few blocks.

**Trap.** Is the hidden state at layer 0 contextual? _No; layer 0 is the embedding itself. Context enters through attention in block 1 onward._

## Hidden state vs Latent representation

A hidden state is the concrete vector; a latent representation is a claim about information that vector encodes.

| | Hidden state | Latent representation |
|---|---|---|
| Nature | measured numbers | an interpretation |
| Tested by | recording | probes and interventions |

**Example.** The 4,096 numbers at layer 20 are a hidden state; "layer 20 encodes authorship style" is a claim about a latent representation.

**Trap.** Does a probe reading a property prove the representation exists in the model's computation? _It shows decodability, not use; causal tests are needed._

## LayerNorm vs RMSNorm

LayerNorm subtracts the mean and adds a bias; RMSNorm only divides by the RMS and multiplies by a gain.

| | LayerNorm | RMSNorm |
|---|---|---|
| Mean subtraction | yes | no |
| Bias | yes | no |
| Qwen3 | not used | used everywhere, ε = 1e-6 |

**Example.** x = [1, 2, 3, 4] + 10: LayerNorm output is unchanged by the +10, RMSNorm output changes.

**Trap.** Does RMSNorm subtract the mean if you add a bias? _Qwen3's RMSNorm has neither bias nor mean subtraction; adding a constant changes its output._

## Q vs K vs V

Q asks, K is matched against Q to set the weights, V is what gets mixed into the output.

| | Q | K vs V |
|---|---|---|
| Q | query of the reading position | rotated by RoPE, normalized |
| K | address of each position | rotated by RoPE, normalized, cached |
| V | content to copy | not rotated or normalized, cached |

**Example.** For "it" in "the dog ... because it was hungry", q(it) matches k(dog) strongly, so v(dog) is mixed into it.

**Trap.** Which of Q, K, V is cached during generation? _K and V; Q is only needed for the newest token._

## MHA / MQA vs GQA

MHA: one KV head per query head; MQA: one KV head total; GQA: groups of query heads share a KV head.

| | MHA / MQA | GQA |
|---|---|---|
| KV heads (32 query heads) | 32 / 1 | 8 in Qwen3 |
| KV cache | largest / smallest | 4x smaller than MHA |

**Example.** Qwen3-8B: 32 query heads, 8 KV heads, so 4 query heads share each K/V head.

**Trap.** Does GQA reduce the number of attention patterns? _No; there are still 32 query heads and 32 patterns. Only K and V are shared._

## Attention vs MLP

Attention communicates between positions; the MLP transforms features within a position.

| | Attention | MLP |
|---|---|---|
| Mixes positions | yes | no |
| Parameters per Qwen3 block | about 42M | about 151M |

**Example.** Resolving which noun "it" refers to needs attention; turning "Paris" into a feature like "capital of France" is MLP-like work.

**Trap.** Can the MLP at position 5 read position 2? _No; only attention mixes positions._

## RoPE vs Absolute positional embedding

Absolute embeddings add a position vector to the input; RoPE rotates Q and K inside attention so scores depend on relative offset.

| | RoPE | Absolute positional embedding |
|---|---|---|
| Where | added to embedding | applied to Q, K in every block |
| Encodes | absolute position | relative offset in dot products |

**Example.** GPT-2 adds a learned vector for position 7 to the input; Qwen3 rotates q and k by angles proportional to 7 in every block.

**Trap.** Does RoPE change the residual stream directly? _No; it only rotates Q and K inside attention._

## Logit vs Probability

Logits are unnormalized scores; softmax turns them into probabilities that sum to 1.

| | Logit | Probability |
|---|---|---|
| Range | any real number | 0 to 1 |
| Shift by a constant | no effect on softmax | n/a |

**Example.** Logits [2, 1, 0] become probabilities about [0.67, 0.24, 0.09].

**Trap.** Does adding 100 to every logit change the output distribution? _No; softmax is invariant to a shared constant._

## Training vs Inference

Training changes weights with gradients; inference only runs the forward pass with fixed weights.

| | Training | Inference |
|---|---|---|
| Weights change | yes | no |
| Positions per pass | all (teacher forcing) | one new token per decode step |

**Example.** Training on "The cat sat" scores predictions at every position at once; inference writes one new token per step.

**Trap.** Does a deployed chatbot update its weights from your messages? _No; weights change only in separate training runs._

## Prefill vs Decode

Prefill processes the whole prompt in parallel and fills the KV cache; decode generates one token per step reusing it.

| | Prefill | Decode |
|---|---|---|
| Bottleneck | compute | memory bandwidth |
| Metric | time to first token | inter-token latency |

**Example.** A 3,000-token prompt is prefilled in one pass; then each output token is one decode step reading the cache.

**Trap.** Which phase does INT4 weight quantization speed up most? _Decode, which is limited by memory bandwidth._

## Base model vs Instruct model

A base model continues text; an instruct model has been post-trained to follow instructions and conversation formats.

| | Base model | Instruct model |
|---|---|---|
| Training | pretraining only | pretraining + SFT + preference optimization |
| LatentLens | Qwen3-8B-Base | not studied here |

**Example.** Asked "What is 2+2?", a base model may continue with more quiz questions; an instruct model answers.

**Trap.** Is Qwen3-8B-Base chat-tuned? _No; it is the pretrained base model._

## SFT vs RLHF

SFT imitates demonstrations with cross-entropy; RLHF optimizes a reward learned from human preferences.

| | SFT | RLHF |
|---|---|---|
| Data | ideal responses | comparisons |
| Signal | token-level targets | scalar reward |

**Example.** SFT: train on a written ideal answer. RLHF: humans pick the better of two answers, a reward model learns that, then RL optimizes it.

**Trap.** Does SFT need comparison data? _No; it uses demonstrations._

## PPO vs DPO

PPO runs reinforcement learning against a reward model; DPO optimizes preference pairs directly without one.

| | PPO | DPO |
|---|---|---|
| Reward model | needed | not needed |
| Online sampling | yes | no (offline pairs) |

**Example.** PPO samples new answers during training and scores them; DPO trains directly on fixed chosen/rejected pairs.

**Trap.** Which one needs a separately trained reward model? _PPO-based RLHF._

## RAG vs Fine-tuning

RAG supplies facts in the context at query time; fine-tuning changes the weights.

| | RAG | Fine-tuning |
|---|---|---|
| Updating facts | change the index | retrain |
| Good for | fresh or private facts, citations | style, format, skills |

**Example.** New refund policy today: re-index the document (RAG) instead of retraining (fine-tuning).

**Trap.** Can fine-tuning make the model cite the source document? _Not reliably; citations come naturally from RAG's retrieved passages._

## Embedding model vs Generative model

An embedding model maps text to one vector for similarity search; a generative model predicts next tokens.

| | Embedding model | Generative model |
|---|---|---|
| Output | one vector per text | logits per position |
| Use in RAG | retrieval | answer generation |

**Example.** An embedding model maps a whole paragraph to one vector for search; Qwen3-8B predicts the next token.

**Trap.** Does RAG use the generator's LM head to rank documents? _No; a separate embedding model (and maybe a reranker) does._

## Vector DB vs Model memory

A vector database is external storage searched at query time; the model's knowledge is in its weights.

| | Vector DB | Model memory |
|---|---|---|
| Editable at runtime | yes | no |
| Access control | must be enforced by the app | n/a |

**Example.** Deleting a document from the vector DB removes it from future answers; facts in the weights stay until retraining.

**Trap.** Who enforces which tenant can see which vectors? _The application, in the retrieval query; the database or model will not do it implicitly._

## Tool vs Agent

A tool is one function the application exposes; an agent is the loop that lets the model choose tools repeatedly.

| | Tool | Agent |
|---|---|---|
| Decides | nothing | which tool, when |
| Risk | what it can do | what any sequence of calls can do |

**Example.** send_email is a tool; the loop deciding to read a document, then summarize, then send is the agent.

**Trap.** Is a single function-calling request an agent? _Only if there is a loop where the model chooses further actions based on results._

## Agent memory vs KV cache

Agent memory is stored text reinserted into future prompts; the KV cache is per-request numeric state inside the server.

| | Agent memory | KV cache |
|---|---|---|
| Lifetime | across sessions | one request |
| Content | text | keys and values per layer |

**Example.** "User prefers metric units" saved to a database is agent memory; K and V tensors for this prompt are the cache.

**Trap.** Does clearing the KV cache erase an agent's long-term memory? _No; they are unrelated stores._

## Prompt injection vs Jailbreak

Injection subverts the application's task, often through third-party data; a jailbreak bypasses the model's own safety policy.

| | Prompt injection | Jailbreak |
|---|---|---|
| Target | the application's intent and tools | the model's refusals |
| Typical attacker | third party via content, or user | the user |

**Example.** A web page telling the summarizer to email the user's notes is injection; a user role-playing to obtain disallowed instructions is a jailbreak.

**Trap.** Can prompt injection happen without the user doing anything wrong? _Yes; indirect injection comes from third-party content._

## Prompt injection vs Data poisoning

Injection arrives in the context at inference; poisoning changes training data (and weights) or stored corpora.

| | Prompt injection | Data poisoning |
|---|---|---|
| When | inference | training (or ingestion) |
| Persistence | this context | every use of the model or corpus |

**Example.** Injection: a malicious sentence in today's retrieved page. Poisoning: malicious examples placed in training data months earlier.

**Trap.** Which one persists in every deployment of the model? _Training-data poisoning, because it changes the weights._

## Jailbreak vs Adversarial example

An adversarial example is any input crafted to cause a model error; a jailbreak specifically aims to bypass safety behaviour.

| | Jailbreak | Adversarial example |
|---|---|---|
| Scope | any model, any error | safety-trained LLMs |

**Example.** A perturbed stop-sign image that a classifier misreads is an adversarial example but not a jailbreak.

**Trap.** Is every jailbreak an adversarial example? _Broadly yes (crafted input causing unwanted behaviour), but the terms emphasize different goals._

## Model red teaming vs Penetration testing

Model red teaming probes learned behaviour statistically; pentesting exploits deterministic software and infrastructure flaws.

| | Model red teaming | Penetration testing |
|---|---|---|
| Evidence | success rates over trials | reproducible exploit |
| Agents | need both | need both |

**Example.** Measuring how often a model follows injected instructions is model red teaming; finding an exposed admin endpoint is pentesting.

**Trap.** Which one reports success rates over many trials? _Model red teaming, because outputs are stochastic._

## Model poisoning vs RAG poisoning

Model poisoning changes weights; RAG poisoning plants retrievable content and is fixed by cleaning the corpus.

| | Model poisoning | RAG poisoning |
|---|---|---|
| Weights change | yes | no |
| Removal | retrain or replace | delete documents |

**Example.** A tampered LoRA adapter vs a malicious FAQ uploaded to the knowledge base.

**Trap.** How do you remove RAG poisoning? _Delete or quarantine the documents; no retraining._

## Model extraction vs Training-data extraction

Model extraction copies the model's behaviour or parameters; training-data extraction recovers examples it was trained on.

| | Model extraction | Training-data extraction |
|---|---|---|
| Asset | intellectual property | privacy of data subjects |

**Example.** Training a copy from API outputs vs prompting the model to reproduce a memorized email address.

**Trap.** Which threatens privacy of people in the data? _Training-data extraction._

## Authentication vs Authorization

Authentication establishes who you are; authorization decides what you (or your agent) may do.

| | Authentication | Authorization |
|---|---|---|
| Question | who? | allowed? |
| Where for agents | at login | at every tool call |

**Example.** Logging in proves you are Dilip; whether the agent may email your manager on your behalf is authorization.

**Trap.** If the user is authenticated, may the agent use the service account's full rights? _No; authorize each action for that user and task._

## Guardrail vs Sandbox

A guardrail tries to stop bad outputs; a sandbox limits damage when something bad is executed anyway.

| | Guardrail | Sandbox |
|---|---|---|
| Reduces | likelihood | impact |
| Bypassable by clever input | yes | not by input alone |

**Example.** A classifier blocking a harmful reply is a guardrail; running generated code in a container without network is a sandbox.

**Trap.** Which still helps after the guardrail is bypassed? _The sandbox._

## System prompt vs Security boundary

A system prompt is guidance to a probabilistic model; a security boundary is enforced by code, identity and isolation.

| | System prompt | Security boundary |
|---|---|---|
| Enforced | no | yes |
| Assume secret | no (hidden context exposure) | n/a |

**Example.** "Never reveal the config" in a system prompt vs keeping the config out of the context entirely.

**Trap.** Should a system prompt contain an API key if it says not to reveal it? _No; assume hidden context can be exposed._

## MCP client vs MCP server

The client lives inside the host application and makes requests; the server exposes tools, resources and prompts.

| | MCP client | MCP server |
|---|---|---|
| Runs in | your AI application | possibly a third party's process |
| Trust | yours | verify before use |

**Example.** The calendar connector inside your assistant is a client; the calendar service exposing read_events is the server.

**Trap.** Who must ask the user before a tool runs? _The host application (via its client), per the MCP specification._

## Excessive agency vs Tool misuse

Excessive agency is the design flaw (too much permission or autonomy); tool misuse is the harmful event it enables.

| | Excessive agency | Tool misuse |
|---|---|---|
| Kind | condition | incident |

**Example.** Giving a calendar bot a delete-all-mail permission is excessive agency; the day it deletes mail because of an injected invite is tool misuse.

**Trap.** Which can you fix before any incident? _Excessive agency, by removing permissions._

## Data poisoning vs Context poisoning

Data poisoning alters training data and therefore weights; context poisoning alters what is inserted into prompts (RAG, memory, tool results).

| | Data poisoning | Context poisoning |
|---|---|---|
| Needs retraining to fix | yes | no |

**Example.** Poisoned fine-tuning set vs a poisoned memory entry inserted into future prompts.

**Trap.** Which needs retraining to fix? _Data poisoning._

## KV cache vs Model memory (weights)

The KV cache holds keys and values for the current request only; what the model knows lives in its fixed weights.

| | KV cache | Model memory (weights) |
|---|---|---|
| Lifetime | one request | until retrained |
| Size driver | tokens × layers × KV heads | parameter count |

**Example.** Restarting a request clears its KV cache; the model still knows Paris is in France.

**Trap.** Does a longer conversation make the weights larger? _No; only the cache grows._

## Agent memory vs Context window

The context window is what the model reads in this call; agent memory is stored outside and selectively copied into that window.

| | Agent memory | Context window |
|---|---|---|
| Bounded by | max positions (32,768 for Qwen3-8B) | storage and retrieval policy |
| Persists across sessions | no | yes, if written |

**Example.** Ten saved preferences in a database, of which three are retrieved into this call's context.

**Trap.** Can agent memory exceed the context window? _Yes in storage; only what fits is inserted per call._
