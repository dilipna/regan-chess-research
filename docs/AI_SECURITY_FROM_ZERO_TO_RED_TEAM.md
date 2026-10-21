# AI security from zero to red team

Security begins with the system, not the prompt. Levels 7 to 10 of the LatentLens curriculum. Conceptual only: no operational attack recipes. The model proposes; the system authorizes.

_Generated from the LatentLens curriculum data (apps/web/src/lib/latent). Edit the data, then regenerate; do not edit by hand._

## Level 7: AI security foundations

Assets, boundaries, threat models.

### Security foundations, mapped to LLM systems

Route: `/latent/security/learn/security-foundations`

**In ten seconds.** Security is about protecting assets from adversaries by controlling who can do what, assuming some components will fail.

**Where.** Every layer of an AI system: model, application, infrastructure, people.

**Mechanism.**
- Vocabulary: an asset is something of value; an adversary has goals and capabilities; the attack surface is every way in; a trust boundary is where data or control crosses between levels of trust; a vulnerability is a weakness, an exploit uses it, impact is the harm, and risk combines likelihood and impact.
- CIA: confidentiality (no unauthorized disclosure), integrity (no unauthorized modification, including of the model's behaviour), availability (service stays usable and affordable).
- Authentication proves who someone is; authorization decides what they may do. Least privilege grants only what a task needs; defense in depth layers independent controls; secure defaults make the safe choice automatic.
- Operations: validate inputs and outputs, sandbox risky execution, log and monitor, and have incident response ready.

**LLM property behind it.**
- (generic) An LLM is a component that turns untrusted text into text. It has no built-in identity, permissions or notion of trusted vs untrusted tokens: those must come from the surrounding system.
- (generic) Its outputs are probabilistic, so a control that depends on the model behaving well will sometimes fail; deterministic controls must sit around it.

**Why it exists.** Without shared vocabulary and principles, AI security becomes a list of tricks instead of engineering.

**Without it.** Systems built without trust boundaries give the model (and anyone who can influence its context) the full authority of the application.

**Training vs inference.** Applies across the lifecycle: data and training (integrity of weights), deployment (application controls), operations (monitoring).

**Security lens.** This topic is the frame for all others: each later attack violates C, I or A across some trust boundary.

**Common confusion.** "Authentication vs authorization": knowing who the user is does not decide what the agent may do on their behalf; both are needed and authorization must be checked at the tool, not in the prompt.

**Teach back.** Define asset, adversary, trust boundary, vulnerability, impact and risk, and map CIA onto an LLM application.
- [ ] asset and adversary
- [ ] attack surface and trust boundary
- [ ] vulnerability, exploit, impact, risk
- [ ] CIA mapped to LLM examples
- [ ] authentication vs authorization
- [ ] least privilege and defense in depth

**Interview (level 5).** Map the CIA triad onto a customer-support chatbot with retrieval.

### Web security basics every AI engineer needs

Route: `/latent/security/learn/web-security`

**In ten seconds.** An LLM app is still a web app: model output, model-chosen URLs and model-chosen ids are untrusted input, and the classic web rules apply to them unchanged.

**Where.** Wherever model output meets an interpreter or a privileged request: the browser, the server's network, the database, internal APIs.

**Mechanism.**
- Authentication proves who the user is; authorization decides what they may do. Broken access control (for example, reading another customer's order by changing its id) is the top web risk in OWASP's 2021 list.
- Cross-site scripting: text shown as HTML runs as code in the viewer's browser with their session. Fix: encode output for its context and add a Content-Security-Policy.
- Server-side request forgery: a server fetches a URL chosen by someone else and reaches internal services or the cloud metadata service. Fix: parse the URL, allow exact https hosts, block private addresses and re-check the resolved IP at connection time.
- Injection: data concatenated into SQL or shell commands becomes code. Fix: parameterized queries, allowlisted commands, no shell, strict schemas for tool arguments.

| Input | Operation | Output |
|---|---|---|
| `model output` | context-aware encoding | `safe text in the page` |
| `model-chosen URL` | parse, allowlist host, check IP | `fetch or refuse` |

**LLM property behind it.**
- (generic) The LLM property behind it: the model's output is sampled from a distribution conditioned on its whole context, including untrusted text, so it carries no guarantee about what it contains.
- (generic) Tool calls are requests the application makes on the user's behalf; the model choosing the arguments does not make them authorized.

**Why it exists.** Most real-world LLM application incidents are classic web vulnerabilities reached through a new input path.

**Without it.** Skipping these basics turns a chatbot into a script injector, an internal network scanner or a data-export tool.

**Training vs inference.** Inference and application layer only: no training change fixes them; the application must enforce them.

**Security lens.** This topic is the foundation for improper output handling, excessive agency and agent security; lab 2 lets you break and fix each bug.

**Common confusion.** “Authentication means the request is allowed.” A signed-in user is known, not authorized for everything; every object access needs its own check.

**Teach back.** Explain XSS, SSRF and broken access control and how each appears in an LLM app.
- [ ] authentication vs authorization
- [ ] XSS via rendered model output
- [ ] markdown images as a data leak
- [ ] SSRF via a URL tool and the metadata service
- [ ] IDOR via a model-chosen id
- [ ] parameterized queries and allowlists

**Interview (level 3).** Your agent has a fetch_url tool. How do you stop SSRF?

### Threat modeling an AI application

Route: `/latent/security/learn/threat-modeling`

**In ten seconds.** If you cannot draw the trust boundaries, you cannot secure the AI system.

**Where.** Design time, and again whenever a tool, data source or permission is added.

**Mechanism.**
- Draw the data flow: users, application, model, retrieval, tools, memory, external systems. Mark each component trusted or untrusted and each flow's direction.
- List assets (secrets, customer data, money, reputation, model weights) and entry points (user input, documents, web pages, emails, tool results, memory, third-party servers).
- For each untrusted input, trace paths to assets: what could it make the model say or do, and with which privileges? Use STRIDE or the OWASP lists as prompts.
- Rank by likelihood and impact; choose controls at boundaries (authorization at tools, validation of outputs, approvals); record residual risk.

**LLM property behind it.**
- (generic) The model collapses all inputs into one token sequence, so every untrusted entry point into the context is a path to every capability the model can trigger. Threat models must follow text, not just network packets.

**Why it exists.** Prevents building controls in the wrong place (for example only filtering user input while documents and tool outputs flow in unchecked).

**Without it.** Without a threat model, teams secure the chat box and miss indirect channels like email, retrieved pages and memory.

**Training vs inference.** Design-time activity; include training-time assets (data, weights) when you control the training pipeline.

**Security lens.** This is the core skill of AI security engineering: reasoning about paths, not memorizing attack names.

**Common confusion.** "The system prompt is a security boundary." It is an instruction to a probabilistic model; boundaries are enforced by code, permissions and isolation.

**Teach back.** Threat-model an email assistant that can read and send mail.
- [ ] components and data flows
- [ ] trusted vs untrusted
- [ ] assets
- [ ] entry points including incoming email
- [ ] attack paths to send_email
- [ ] controls at boundaries and residual risk

**Interview (level 5).** Threat-model an agent with email access.

### Model, application, infrastructure, people

Route: `/latent/security/learn/security-layers`

**In ten seconds.** AI security has four concentric layers, and most real incidents happen in the outer ones, not inside the weights.

**Where.** The whole system, seen as rings.

**Mechanism.**
- Model level: weights, training data, alignment, adversarial inputs, extraction, training-data privacy, backdoors.
- Application level: prompts, RAG, tools, agents, memory, authentication, authorization, APIs, output handling.
- Infrastructure level: GPUs, model servers, containers, networks, secrets, dependencies, CI/CD, supply chain.
- Human and governance level: trust in outputs, approvals, misinformation, social engineering, policy, monitoring and response.

**LLM property behind it.**
- (generic) A model-level property (instructions and data share one context) becomes an application-level vulnerability (indirect injection) only when the application connects untrusted inputs and capabilities.

**Why it exists.** Assigns each risk to the layer where it can actually be controlled.

**Without it.** Treating everything as a model problem leads to over-reliance on alignment and filters; treating everything as an app problem ignores poisoned weights and supply chain.

**Training vs inference.** Model-level risks start in training; application and infrastructure risks appear at deployment.

**Security lens.** Use the layers to check coverage of a threat model and a red-team plan.

**Common confusion.** "Model red teaming vs application red teaming vs penetration testing": model red teaming probes the model's behaviour; application red teaming tests the whole system including tools and data flows; pentesting targets conventional software and infrastructure vulnerabilities.

**Teach back.** Describe the four layers with two risks and one control each.
- [ ] model layer risks and controls
- [ ] application layer
- [ ] infrastructure layer
- [ ] human and governance layer
- [ ] why most impact comes from capabilities around the model

**Interview (level 5).** Give one model-level, one application-level and one infrastructure-level risk for a deployed RAG assistant.

## Level 8: LLM application security

Injection, leakage, poisoning, output handling.

### Prompt injection, direct and indirect

Route: `/latent/security/learn/prompt-injection`

**In ten seconds.** Prompt injection happens when text the application treats as data is interpreted by the model as instructions.

**Where.** Any path by which text reaches the model's context.

**Mechanism.**
- Applications build one prompt from parts of different trust: system and developer instructions (trusted), the user's message (partly trusted), and data (documents, web pages, emails, tool results, memory, images: untrusted).
- Direct prompt injection: the user writes instructions meant to override the application's intent.
- Indirect prompt injection: instructions are hidden in content the application retrieves or receives, so a third party who never talks to the system can steer it. Multimodal variants hide text in images or audio.
- Agents raise the stakes: an injected instruction can trigger tool calls (send, delete, buy) with the user's privileges. Mitigations reduce likelihood (training on instruction hierarchies, spotlighting / delimiting untrusted data, classifiers) and, more reliably, impact (least privilege, no tool authority from untrusted data, approvals, output validation).

**LLM property behind it.**
- (generic) Instructions and data become tokens in one sequence processed by the same attention and weights. There is no hard, OS-like privilege boundary between them inside the model.
- (generic) Role markers and instruction-hierarchy training make models prefer trusted instructions statistically, not absolutely; this is why prompt injection is not considered solved.

**Why it exists.** Understanding the root cause (instruction/data confusion) tells you which defenses can work: architectural ones that do not rely on the model obeying.

**Without it.** Ignoring indirect channels means a malicious web page or email can direct an agent; relying on "ignore instructions in documents" in the system prompt fails against novel phrasing.

**Training vs inference.** An inference-time attack on the deployed system; training-time hierarchy tuning only reduces susceptibility.

**Security lens.** OWASP LLM01 in both the 2025 and 2026 lists; NIST AI 100-2e2025 covers direct prompting and indirect prompt injection as GenAI attack classes; OWASP Agentic ASI01 (goal hijack) is its agentic consequence.

**Common confusion.** Prompt injection vs jailbreak: injection subverts the application's intended task (often via third-party data); a jailbreak tries to get the model to violate its own safety policy. They overlap but have different targets and defenses.

**Teach back.** Explain why prompt injection exists, the direct vs indirect distinction, and which defenses reduce impact.
- [ ] one token sequence with mixed trust
- [ ] no hard privilege boundary in the model
- [ ] direct vs indirect channels
- [ ] agents convert it into actions
- [ ] likelihood vs impact controls
- [ ] not solved: defense in depth

**Interview (level 4).** Why can't a system prompt alone prevent prompt injection?

### Jailbreaks, adversarial inputs and guardrails

Route: `/latent/security/learn/jailbreaks`

**In ten seconds.** A jailbreak is an input that gets a model to do what its safety training says it should refuse; guardrails are extra layers that try to catch that.

**Where.** The model's learned policy plus input and output filters around it.

**Mechanism.**
- Safety behaviour is learned in post-training on a finite distribution of examples. Jailbreaks search for inputs outside that distribution: role-play framings, multi-turn escalation, obfuscation or encodings, other languages, and optimized adversarial strings (gradient-based suffixes found with white-box access that sometimes transfer).
- Multimodal jailbreaks place the request in images or audio, where text filters do not look.
- Guardrails: input classifiers, output classifiers, policy models, refusal training, and rate limits. Each reduces success rates; none is complete, and over-blocking harms legitimate use.
- Evaluation: attack success rate over many attempts and seeds, benign refusal rate, and robustness to adaptive attackers (who know the defense).

**LLM property behind it.**
- (generic) Refusals are a learned distribution over outputs, not a rule; sampling and distribution shift mean success is a probability.
- (generic) Open weights (like Qwen3-8B-Base) allow white-box optimization and fine-tuning that removes safety training; a base model has no safety post-training at all.

**Why it exists.** Teaches why guardrails are one layer of defense in depth and why evaluation must be statistical and adaptive.

**Without it.** Treating a guardrail as sufficient leads to systems where one bypass gives full access to dangerous capabilities.

**Training vs inference.** Safety is trained (SFT, RLHF); jailbreaks happen at inference; guardrails run at inference.

**Security lens.** Relates to OWASP misuse concerns and NIST's misuse-enablement objective; for deployed applications, the consequence of a jailbreak depends on what capabilities the model can reach.

**Common confusion.** Jailbreak vs adversarial example: an adversarial example is any input crafted to cause a model error (including classic image perturbations); a jailbreak is the specific goal of bypassing a safety policy.

**Teach back.** Explain why jailbreaks exist, the main families conceptually, and how to evaluate guardrails honestly.
- [ ] safety as learned distribution
- [ ] out-of-distribution inputs
- [ ] optimized and obfuscated inputs
- [ ] guardrails and their trade-offs
- [ ] ASR over many trials
- [ ] adaptive attackers

**Interview (level 6).** How would you evaluate a jailbreak guardrail?

### Sensitive information disclosure and privacy attacks

Route: `/latent/security/learn/privacy-attacks`

**In ten seconds.** Secrets can leak from what the model was trained on, from what is in its context, and from what its outputs reveal about its training data.

**Where.** Training data, context (prompts, RAG, tools, memory) and outputs.

**Mechanism.**
- Context leakage: secrets or other users' data placed in prompts, retrieved documents, tool results or memory can be repeated to the wrong person. Hidden context (system prompts, tool schemas) should be assumed discoverable.
- Training-data extraction (NIST: data reconstruction): prompting a model to reproduce memorized training sequences verbatim, including personal data.
- Membership inference: deciding whether a specific record was in the training set, using differences in the model's confidence or loss.
- Model inversion: reconstructing representative features of a class or input from model outputs; property inference: learning aggregate properties of the training data. Mitigations: data minimization, deduplication, PII scrubbing, differential privacy in training, output filtering, access control on context, and limiting exposure of log-probabilities.

**LLM property behind it.**
- (generic) Language models memorize some training sequences, more so when repeated; memorization is a property of the weights.
- (generic) Anything in the context window can be reproduced in the output: the model has no notion of which tokens are secret.

**Why it exists.** Different leak paths need different controls: training-time privacy vs runtime access control.

**Without it.** Putting API keys or other customers' records into prompts makes them one clever question away from disclosure.

**Training vs inference.** Extraction and membership inference exploit training; context leakage is purely inference-time.

**Security lens.** OWASP LLM02 Sensitive Information Disclosure (2025 and 2026); OWASP 2026 LLM08 Hidden Context Exposure (replacing System Prompt Leakage); NIST privacy-compromise objective.

**Common confusion.** Model extraction (stealing the model's behaviour or parameters) vs training-data extraction (recovering the data it was trained on) vs membership inference (a yes/no about one record).

**Teach back.** Distinguish context leakage, training-data extraction, membership inference and model inversion.
- [ ] where each leak comes from
- [ ] what the attacker learns
- [ ] training-time vs inference-time
- [ ] controls for each
- [ ] hidden context should be assumed discoverable

**Interview (level 3).** What is the difference between model extraction and training-data extraction?

### Data poisoning, model poisoning and backdoors

Route: `/latent/security/learn/poisoning`

**In ten seconds.** Poisoning attacks change what a model learns (or what it retrieves) so that it later misbehaves, sometimes only when a secret trigger appears.

**Where.** Pretraining data, fine-tuning data, adapters, RAG corpora, memory.

**Mechanism.**
- Training-data poisoning: insert crafted examples into data that will be trained on (web content, datasets). Objectives: degrade quality (availability), cause targeted errors, or implant a backdoor.
- Backdoor: the model behaves normally except when a trigger pattern is present, then produces the attacker's chosen behaviour. Backdoors can persist through further safety training in some studies.
- Model poisoning: tamper with weights or adapters directly (malicious fine-tune, compromised checkpoint, poisoned LoRA).
- RAG corpus and memory poisoning do not change weights: they plant content that will be retrieved into future contexts. Mitigations: data provenance, filtering and deduplication, held-out behavioural evals, trigger scanning research, signed artifacts, and for RAG/memory: write controls, provenance and review.

**LLM property behind it.**
- (generic) Gradient descent learns whatever regularities are in the data, including attacker-inserted ones; a small fraction of poisoned data can implant a reliable association.
- (generic) Retrieved or remembered text conditions the model like any other context, so poisoning a corpus has an effect at inference without retraining.

**Why it exists.** Supply of data and weights crosses many organizations; integrity must be verified, not assumed.

**Without it.** Training on unvetted scraped data or downloading unverified adapters lets attackers shape behaviour before you ever deploy.

**Training vs inference.** Data and model poisoning act at training time; RAG and memory poisoning act at inference time through stored content.

**Security lens.** OWASP LLM04 (2025) / LLM05 (2026) Data and Model Poisoning; OWASP LLM08 (2025) / LLM09 (2026) Vector and Embedding Weaknesses for corpus attacks; OWASP Agentic ASI06 Memory & Context Poisoning; NIST poisoning classes (availability, targeted, backdoor, model poisoning).

**Common confusion.** Model poisoning vs RAG poisoning: the first changes weights and persists in every deployment of that model; the second changes retrievable content and can be fixed by cleaning the corpus.

**Teach back.** For training-data poisoning, backdoors, RAG poisoning and memory poisoning give: when it happens, attacker capability, persistence, and mitigation.
- [ ] attack objective
- [ ] attacker capability needed
- [ ] lifecycle stage
- [ ] how it persists
- [ ] detection and mitigation

**Interview (level 5).** What is the difference between data poisoning and context poisoning?

### Model extraction and model theft

Route: `/latent/security/learn/model-extraction`

**In ten seconds.** With enough queries, an attacker can train a copy that imitates a model's behaviour, or learn facts about its architecture and parameters.

**Where.** The model's API (black-box) or its stored weights (theft).

**Mechanism.**
- Behaviour imitation: collect many prompts and outputs, then train a student model on them (distillation-like extraction).
- Parameter or architecture extraction: research shows some parameters (for example the final projection layer's dimension) can be estimated from detailed API outputs such as log-probabilities.
- Direct theft: exfiltration of checkpoint files from storage, training clusters or insiders: an infrastructure problem.
- Mitigations: authentication, rate limits and quotas, monitoring for systematic querying, limiting log-prob exposure, terms of use, and watermarking or fingerprinting (useful for attribution, but with known limits).

**LLM property behind it.**
- (generic) Every query reveals part of the model's input-output function; richer outputs (full log-probs) reveal more per query.

**Why it exists.** Weights and behaviour are intellectual property and may embody safety work an attacker could strip.

**Without it.** Unlimited high-detail API access makes imitation cheap; unprotected checkpoints make it trivial.

**Training vs inference.** Black-box extraction uses inference queries; the stolen copy is then trained by the attacker.

**Security lens.** IP and safety risk (an extracted copy has none of the provider's controls); MITRE ATLAS and NIST AI 100-2e2025 both list model extraction.

**Common confusion.** Model extraction vs distillation: distillation is a legitimate training technique on a model you are allowed to use; extraction is unauthorized copying.

**Teach back.** Explain how model extraction works conceptually and how providers limit it.
- [ ] query access and imitation
- [ ] parameter information from detailed outputs
- [ ] direct weight theft
- [ ] rate limits and monitoring
- [ ] watermarking limits

**Interview (level 4).** Why would an LLM API restrict top-k log-probabilities?

### RAG security: poisoned, leaked and cross-tenant retrieval

Route: `/latent/security/learn/rag-security`

**In ten seconds.** Retrieval decides what untrusted text the model reads, so it must enforce who may see what and treat every retrieved chunk as data.

**Where.** Indexing, retrieval filters, context construction.

**Mechanism.**
- Poisoned documents: content written to be retrieved for certain queries (keyword or embedding-targeted) and to carry instructions or false facts.
- Cross-tenant or unauthorized retrieval: the index returns chunks the current user may not see, and filtering happens after the model has already read them.
- Vector and embedding weaknesses: embeddings can leak information about their text (inversion research), indexes may lack access control, metadata filters can be misconfigured.
- Controls: authorize before retrieval (filter by the user's permissions in the query itself, separate indexes per tenant), provenance and source allowlists, sanitization and spotlighting of retrieved text, no tool authority from retrieved content, citations and groundedness checks, monitoring.

**LLM property behind it.**
- (generic) Retrieved chunks enter the context as ordinary tokens and are interpreted together with trusted instructions; the model cannot tell an injected instruction from a legitimate one by position or channel.

**Why it exists.** RAG is the most common way private data reaches an LLM, so it is the most common place for leaks and injections.

**Without it.** Filtering by permission after generation means the model already saw (and may repeat) forbidden data.

**Training vs inference.** Inference and indexing time; no weights change.

**Security lens.** OWASP LLM08:2025 / LLM09:2026 Vector and Embedding Weaknesses; LLM01 indirect injection; LLM02 disclosure.

**Common confusion.** "Vector DB vs model memory": a vector database is external storage searched at query time; the model's knowledge lives in its weights; agent memory is stored text reinserted into prompts.

**Teach back.** Explain three RAG attacks and where each control sits.
- [ ] poisoned documents
- [ ] cross-tenant retrieval
- [ ] embedding leakage
- [ ] authorization before retrieval
- [ ] provenance and sanitization
- [ ] no tool authority from retrieved text

**Interview (level 6).** How would you secure a RAG system containing private documents?

### Improper output handling

Route: `/latent/security/learn/output-handling`

**In ten seconds.** Model output is untrusted input to whatever consumes it next: a browser, a database, a shell or a tool.

**Where.** Between the model's text and any interpreter or executor.

**Mechanism.**
- If output is inserted into HTML, it can carry script (cross-site scripting); into SQL, it can change the query; into a shell, it can run commands; into tool arguments, it can target the wrong resource.
- An attacker who can influence the model (directly or by injection) can therefore reach those downstream systems.
- Correct handling: parse structurally (schemas, typed arguments), encode for the output context (HTML escaping), use parameterized queries, allowlist commands and values, enforce authorization on every action, and sandbox anything executed.

**LLM property behind it.**
- (generic) The model generates the most plausible tokens given its context; it has no notion of which strings are dangerous in which interpreter.

**Why it exists.** Classic injection vulnerabilities reappear whenever LLM output is treated as trusted code or data.

**Without it.** Rendering raw model HTML or executing generated commands gives anyone who can steer the model a path to the user's browser or the server.

**Training vs inference.** Inference and application only.

**Security lens.** OWASP LLM05:2025 / LLM10:2026 Improper Output Handling; OWASP Agentic ASI05 Unexpected Code Execution.

**Common confusion.** "Guardrail vs sandbox": a guardrail tries to stop bad outputs from being produced; a sandbox limits the damage if a bad output is executed. You need the second even with the first.

**Teach back.** Explain why LLM output must be treated as untrusted and how to handle it for HTML, SQL, shell and tool arguments.
- [ ] output feeds interpreters
- [ ] attacker influence via injection
- [ ] structural parsing
- [ ] context-specific encoding
- [ ] parameterization and allowlists
- [ ] sandboxing and authorization

**Interview (level 6).** An LLM generates SQL for analytics. How do you make that safe?

### Unbounded consumption and denial of wallet

Route: `/latent/security/learn/unbounded-consumption`

**In ten seconds.** LLM systems spend money and GPU time per token and per tool call, so an attacker or a bug can make them burn resources without limit.

**Where.** API gateway, model server, agent loop.

**Mechanism.**
- Cost drivers: input tokens (prefill compute, KV memory), output tokens (decode steps), model choice, and agent steps (each step is another LLM call plus tools).
- Abuse patterns: extremely long contexts, requests for huge outputs, recursive or looping agents, fan-out to many tools or sub-agents, and routing to the most expensive model.
- Controls: per-user rate limits and quotas, token limits on input and output, timeouts, tool-call and step limits, loop detection, budgets with circuit breakers, and cost monitoring with alerts.

**LLM property behind it.**
- (verified) Prefill cost grows with prompt length (attention is quadratic in it) and KV memory grows linearly: 147,456 bytes per token for Qwen3-8B in bf16.

**Why it exists.** Availability and cost are security properties; LLM workloads make both easy to attack.

**Without it.** An agent with no step limit can loop until the budget is gone; a public endpoint with no limits invites cost amplification.

**Training vs inference.** Inference only: training jobs have fixed, pre-planned compute budgets, while serving costs are driven by whatever requests arrive.

**Security lens.** OWASP LLM10:2025 / LLM06:2026 Unbounded Consumption; NIST availability-breakdown objective; OWASP Agentic ASI08 Cascading Failures for runaway multi-agent effects.

**Common confusion.** "Rate limiting is enough": request rate limits do not bound tokens per request or steps per agent run; limits are needed at each level.

**Teach back.** List the cost drivers of an agentic LLM system and the limit at each level.
- [ ] input tokens
- [ ] output tokens
- [ ] agent steps and tool calls
- [ ] model selection
- [ ] rate limits, token limits, step limits, budgets, circuit breakers

**Interview (level 6).** Design limits for a public agent endpoint.

### AI supply chain

Route: `/latent/security/learn/supply-chain`

**In ten seconds.** Every model file, tokenizer, dataset, package, plugin and tool server you load is code or data written by someone else.

**Where.** Everything you download or connect to.

**Mechanism.**
- Artifacts: model checkpoints, tokenizers, adapters (LoRA), datasets, Python packages, containers, MCP servers and agent tools, prompt templates, RAG data providers.
- Risks: malicious or tampered artifacts, unsafe serialization formats that execute code when loaded (Python pickle), typosquatted packages, compromised updates, and poisoned weights.
- Controls: provenance (who made it, from where), hash verification and signatures, pinned versions, trusted formats (safetensors), sandboxed loading, SBOM / AI-BOM inventories, and review before connecting new tools or servers.

**LLM property behind it.**
- (verified) LatentLens pins the exact Qwen3-8B-Base revision (49e3418f…) and loads safetensors weights; this is the kind of control supply-chain guidance asks for.

**Why it exists.** Attackers prefer compromising a widely used component over attacking each deployment.

**Without it.** Loading an untrusted pickle file can execute arbitrary code; floating versions silently pull in compromised updates.

**Training vs inference.** Both: training pipelines ingest datasets and code; deployments load checkpoints, adapters and tool servers.

**Security lens.** OWASP LLM03:2025 / LLM04:2026 Supply Chain; OWASP Agentic ASI04 Agentic Supply Chain Vulnerabilities; NIST AI 100-2e2025 supply-chain attacks.

**Common confusion.** "Open-source means audited." Availability of code or weights does not mean anyone has reviewed the version you download.

**Teach back.** List AI supply-chain artifacts, one risk for each, and the controls.
- [ ] checkpoints and formats
- [ ] packages and containers
- [ ] adapters and datasets
- [ ] MCP servers and tools
- [ ] hashes, signatures, pinning, SBOM/AI-BOM, sandboxed loading

**Interview (level 6).** How do you safely add a third-party model and an MCP server to a product?

## Level 9: Agentic AI security

Bound what any decision can do.

### Agentic AI security (OWASP Agentic Top 10)

Route: `/latent/security/learn/agent-security`

**In ten seconds.** Agents turn model mistakes and manipulations into actions, so agent security is about bounding what any single decision can do.

**Where.** The agent loop, its tools, identities, memory and peers.

**Mechanism.**
- OWASP Top 10 for Agentic Applications (2026 edition, published December 2025): ASI01 Agent Goal Hijack, ASI02 Tool Misuse and Exploitation, ASI03 Identity and Privilege Abuse, ASI04 Agentic Supply Chain Vulnerabilities, ASI05 Unexpected Code Execution, ASI06 Memory & Context Poisoning, ASI07 Insecure Inter-Agent Communication, ASI08 Cascading Failures, ASI09 Human-Agent Trust Exploitation, ASI10 Rogue Agents.
- Common root: an agent combines untrusted inputs, a probabilistic decision maker, and real capabilities.
- Controls: least-privilege identities per agent and task, scoped and short-lived credentials, tool allowlists, argument validation, risk-based human approval, sandboxed execution, memory write controls, authenticated inter-agent messages, step and budget limits, audit logs and kill switches. OWASP's Agent Control Standard (v0.1, September 2026) proposes runtime hooks for allow / deny / modify decisions.

**LLM property behind it.**
- (generic) A probabilistic model output controls deterministic external capability: the agent's blast radius is the union of what its tools can do with its credentials.

**Why it exists.** Agents are where AI risk becomes operational risk; most serious agent incidents involve excessive permissions plus an injected or mistaken decision.

**Without it.** An agent with broad credentials, no approvals and untrusted inputs can be directed by anyone who can place text in its context.

**Training vs inference.** Inference and application architecture.

**Security lens.** Maps to OWASP Agentic ASI01 to ASI10 and to OWASP LLM03:2026 Excessive Agency (LLM06:2025).

**Common confusion.** "Excessive agency vs tool misuse": excessive agency is a design flaw (too much functionality, permission or autonomy); tool misuse is the event where a tool is used in an unintended, harmful way.

**Teach back.** Name the ten OWASP agentic risks and the three controls that reduce the most blast radius.
- [ ] the ten categories
- [ ] common root cause
- [ ] least privilege and scoped credentials
- [ ] approval for irreversible actions
- [ ] validation and sandboxing
- [ ] memory and inter-agent controls

**Interview (level 5).** How would you red-team an agent with email access?

### Memory and context poisoning

Route: `/latent/security/learn/memory-security`

**In ten seconds.** If untrusted text can be written into an agent's memory, it will be read back as context in every future session.

**Where.** The memory writer and the memory retriever.

**Mechanism.**
- An agent saves facts from conversations, documents or tool results. If that write accepts untrusted content, an attacker can plant instructions or false facts.
- Future sessions retrieve the entry into the prompt, so the influence persists across users, sessions or agents that share the memory.
- Controls: memory provenance (who or what wrote it), write authorization (only the user or trusted processes), user confirmation of new memories, scoping per user and task, expiration, integrity checks, review and deletion UI, and never granting tool authority based on memory content alone.

**LLM property behind it.**
- (generic) Persistent content re-enters future contexts as tokens and is interpreted like any other instruction or fact.

**Why it exists.** Makes one successful injection durable.

**Without it.** Auto-saving "useful facts" from documents lets any document author permanently influence the assistant.

**Training vs inference.** Inference and application storage.

**Security lens.** OWASP Agentic ASI06 Memory & Context Poisoning.

**Common confusion.** Memory poisoning vs training-data poisoning: no weights change; removing the entry removes the effect.

**Teach back.** Explain memory poisoning and the controls on write, storage and read.
- [ ] untrusted write path
- [ ] persistence across sessions
- [ ] provenance
- [ ] write authorization and confirmation
- [ ] scope and expiry
- [ ] review and deletion

**Interview (level 6).** Design a safe long-term memory feature.

### MCP security

Route: `/latent/security/learn/mcp-security`

**In ten seconds.** Every MCP server you connect is third-party code whose descriptions and results flow into the model's context, so it must be treated as untrusted until proven otherwise.

**Where.** Host, client and each connected server.

**Mechanism.**
- Capability exposure: servers advertise tools, resources and prompts. Tool descriptions and annotations are text the model reads, so they can carry instructions; the specification says they should be considered untrusted unless the server is trusted.
- Results returned by tools and resources are untrusted content (indirect injection channel).
- Credentials: servers often act with OAuth tokens or API keys; over-broad scopes or token passthrough create confused-deputy risks. Updates to a server can change behaviour after approval (supply chain).
- Controls (implementers' responsibility, per the specification): explicit user consent before invoking tools, allowlisted and pinned servers, least-privilege scoped tokens, isolation of servers, review of tool descriptions, logging, and treating outputs as data.

**LLM property behind it.**
- (verified) MCP specification 2026-07-28 (checked 17 October 2026): "MCP itself cannot enforce these security principles at the protocol level"; hosts must obtain explicit user consent before invoking any tool.

**Why it exists.** MCP makes connecting tools easy, which makes over-connecting easy.

**Without it.** Auto-approving tools from many servers gives each server's author a path into the agent's capabilities.

**Training vs inference.** Inference and application.

**Security lens.** OWASP Agentic ASI04 (supply chain), ASI02 (tool misuse), ASI03 (identity and privilege abuse), plus LLM01 injection.

**Common confusion.** MCP client vs MCP server: the client runs inside your host and calls out; the server exposes capabilities and may be operated by someone else.

**Teach back.** Explain MCP's trust boundaries and the controls a host must implement.
- [ ] servers as third parties
- [ ] tool descriptions as untrusted text
- [ ] results as injection channel
- [ ] credential scope
- [ ] consent, allowlists, pinning, isolation, logging
- [ ] no protocol-level guarantees

**Interview (level 4).** What does the MCP specification guarantee about security?

## Level 10: AI red teaming and defense

Test, measure, fix, retest.

### How an AI red team thinks

Route: `/latent/security/learn/red-teaming`

**In ten seconds.** A red team challenges the system's assumptions with reproducible, scoped experiments and turns each finding into a fix and a regression test.

**Where.** Before release and continuously after.

**Mechanism.**
- Process: define scope and rules of engagement; identify assets; build the threat model; understand architecture; enumerate attack surface; form hypotheses; design reproducible test cases; execute safely; measure success rates; estimate impact; document evidence; recommend mitigations; add regression tests; retest after fixes.
- Types: model red teaming (behaviour of the model), application red teaming (the whole system with tools and data), agent red teaming (multi-step actions and permissions), traditional penetration testing (software and infrastructure), adversarial ML evaluation (robustness of models to crafted inputs), safety evaluation (harmful capability and policy compliance).
- Purple teaming pairs each attack with the defense: what assumption failed, where the control should have been, did the fix work, what risk remains.

**LLM property behind it.**
- (generic) Because outputs are sampled and depend on context, findings must be expressed as rates over repeated trials with recorded settings, not single screenshots.

**Why it exists.** Systematic, reproducible testing is what distinguishes security engineering from anecdote collecting.

**Without it.** Ad-hoc jailbreak collections give no coverage, no severity and no regression protection.

**Training vs inference.** Applied to deployed or pre-release systems; findings may feed back into training data or system design.

**Security lens.** Uses the OWASP lists and MITRE ATLAS as coverage checklists; NIST AI RMF and its Generative AI Profile (NIST AI 600-1, July 2024) frame governance of these activities.

**Common confusion.** Model red teaming vs pentesting: the first studies a model's learned behaviour (often statistical); the second exploits deterministic software flaws. Agent red teaming needs both.

**Teach back.** Walk through the 14-step red-team process for an AI agent and explain purple teaming.
- [ ] scope and rules
- [ ] assets and threat model
- [ ] attack surface and hypotheses
- [ ] reproducible cases and safe execution
- [ ] rates and impact
- [ ] report, mitigation, regression, retest

**Interview (level 5).** How do you decide the severity of a prompt-injection finding?

### Defense in depth for LLM systems

Route: `/latent/security/learn/defenses`

**In ten seconds.** Assume the model will sometimes be fooled; design so that when it is, nothing important happens.

**Where.** Around the model at every boundary.

**Mechanism.**
- Reduce likelihood: input and output classifiers (guardrails), instruction-hierarchy-trained models, spotlighting or delimiting untrusted content, prompt hygiene, retrieval provenance.
- Reduce impact (more reliable): least privilege, scoped credentials, tool allowlists per task, argument validation, human approval for irreversible or high-risk actions, sandboxing, output encoding, separation of untrusted data from control flow (for example designs where untrusted content can never choose tool calls).
- Detect and respond: audit logs of prompts, tool calls and approvals; monitoring and anomaly alerts; rate limits and budgets; incident response playbooks; kill switches.
- Verify continuously: security evals in CI, red teaming, regression tests, and re-evaluation when models, prompts or tools change.

**LLM property behind it.**
- (generic) No control inside a probabilistic model is absolute, so deterministic controls outside the model carry the guarantees.

**Why it exists.** Prompt injection and jailbreaks are not solved; systems must stay safe when the model misbehaves.

**Without it.** Relying on one layer (a guardrail or a system prompt) creates a single point of failure.

**Training vs inference.** Mostly deployment and operations; model-level defenses come from training.

**Security lens.** Cuts across every OWASP item; the Agent Control Standard formalizes runtime enforcement hooks for agents.

**Common confusion.** "System prompt vs security boundary": a system prompt is guidance; a security boundary is enforced by code, identity and isolation.

**Teach back.** Explain defense in depth for an agent: likelihood controls, impact controls, detection, verification.
- [ ] guardrails and their limits
- [ ] least privilege and approvals
- [ ] sandboxing and output handling
- [ ] separating untrusted data from control
- [ ] logging, monitoring, response
- [ ] continuous evaluation

**Interview (level 6).** Why can't a guardrail model alone secure an agent?

## Frameworks (verified 2026-10-17)

- **OWASP Top 10 for LLM Applications** (OWASP GenAI Security Project), 2026 edition (announced 1 to 2 September 2026); 2025 edition still listed on the project page. The ten most critical risks for applications that use LLMs as components. Source: https://genai.owasp.org/llm-top-10/ Note: The 2025 list was read from OWASP's own page. The 2026 order below comes from OWASP's announcement plus the Cloud Security Alliance research note, because the 2026 list page was not retrievable at check time.
- **OWASP Top 10 for Agentic Applications** (OWASP GenAI Security Project), 2026 edition, published 9 December 2025. Risks specific to autonomous and tool-using agents (ASI01 to ASI10). Source: https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/ Note: Release date read from OWASP's page; entry names consistent across several independent guides. One source mentions a later 2.01 revision; unconfirmed.
- **OWASP Agent Control Standard (ACS)** (OWASP GenAI Security Project), v0.1 public preview (September 2026). Runtime enforcement for agents: hooks where policy can allow, deny or modify actions; inspectable, traceable agents. Source: https://genai.owasp.org/agent-control-standard/ Note: Early-stage standard; details may change.
- **NIST AI 100-2e2025: Adversarial Machine Learning taxonomy** (NIST), March 2025 (no newer edition found). Taxonomy and terminology of attacks and mitigations for predictive and generative AI: evasion, poisoning, privacy attacks, supply chain, direct prompting, indirect prompt injection, agent security. Attacker objectives: availability breakdown, integrity violation, privacy compromise, misuse enablement. Source: https://doi.org/10.6028/NIST.AI.100-2e2025
- **NIST AI RMF 1.0 and Generative AI Profile (NIST AI 600-1)** (NIST), AI RMF 1.0 (January 2023); AI 600-1 (26 July 2024). Governance: map, measure, manage and govern AI risks; the profile adapts this to generative AI. Source: https://doi.org/10.6028/NIST.AI.600-1
- **MITRE ATLAS** (MITRE), living knowledge base. Adversary tactics, techniques and case studies against AI-enabled systems, modelled on ATT&CK; useful for red-team coverage. Source: https://atlas.mitre.org/
- **Google Secure AI Framework (SAIF)** (Google), framework and risk map. A conceptual framework and risk map for securing AI systems across data, model, application and infrastructure. Source: https://saif.google/
- **Model Context Protocol specification** (MCP project), 2026-07-28. Hosts, clients, servers; resources, prompts, tools; security principles (consent, privacy, tool safety) that implementers must enforce. Source: https://modelcontextprotocol.io/specification/latest

### OWASP Top 10 for LLM Applications, 2025
- LLM01 Prompt Injection
- LLM02 Sensitive Information Disclosure
- LLM03 Supply Chain
- LLM04 Data and Model Poisoning
- LLM05 Improper Output Handling
- LLM06 Excessive Agency
- LLM07 System Prompt Leakage
- LLM08 Vector and Embedding Weaknesses
- LLM09 Misinformation
- LLM10 Unbounded Consumption

### OWASP Top 10 for LLM Applications, 2026
- LLM01 Prompt Injection
- LLM02 Sensitive Information Disclosure
- LLM03 Excessive Agency
- LLM04 Supply Chain
- LLM05 Data and Model Poisoning
- LLM06 Unbounded Consumption
- LLM07 Misinformation
- LLM08 Hidden Context Exposure
- LLM09 Vector and Embedding Weaknesses
- LLM10 Improper Output Handling

### OWASP Top 10 for Agentic Applications (2026 edition)
- ASI01 Agent Goal Hijack
- ASI02 Tool Misuse and Exploitation
- ASI03 Identity and Privilege Abuse
- ASI04 Agentic Supply Chain Vulnerabilities
- ASI05 Unexpected Code Execution
- ASI06 Memory & Context Poisoning
- ASI07 Insecure Inter-Agent Communication
- ASI08 Cascading Failures
- ASI09 Human-Agent Trust Exploitation
- ASI10 Rogue Agents
