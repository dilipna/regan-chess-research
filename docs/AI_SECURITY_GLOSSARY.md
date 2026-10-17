# AI security glossary

Short definitions of the AI-security concepts in LatentLens, then the distinctions people most often blur.

_Generated from the LatentLens curriculum data (apps/web/src/lib/latent). Edit the data, then regenerate; do not edit by hand._

## Concepts

**Security foundations, mapped to LLM systems.** Security is about protecting assets from adversaries by controlling who can do what, assuming some components will fail. (Level 7; `/latent/security/learn/security-foundations`)

**Threat modeling an AI application.** If you cannot draw the trust boundaries, you cannot secure the AI system. (Level 7; `/latent/security/learn/threat-modeling`)

**Model, application, infrastructure, people.** AI security has four concentric layers, and most real incidents happen in the outer ones, not inside the weights. (Level 7; `/latent/security/learn/security-layers`)

**Prompt injection, direct and indirect.** Prompt injection happens when text the application treats as data is interpreted by the model as instructions. (Level 8; `/latent/security/learn/prompt-injection`)

**Jailbreaks, adversarial inputs and guardrails.** A jailbreak is an input that gets a model to do what its safety training says it should refuse; guardrails are extra layers that try to catch that. (Level 8; `/latent/security/learn/jailbreaks`)

**Sensitive information disclosure and privacy attacks.** Secrets can leak from what the model was trained on, from what is in its context, and from what its outputs reveal about its training data. (Level 8; `/latent/security/learn/privacy-attacks`)

**Data poisoning, model poisoning and backdoors.** Poisoning attacks change what a model learns (or what it retrieves) so that it later misbehaves, sometimes only when a secret trigger appears. (Level 8; `/latent/security/learn/poisoning`)

**Model extraction and model theft.** With enough queries, an attacker can train a copy that imitates a model's behaviour, or learn facts about its architecture and parameters. (Level 8; `/latent/security/learn/model-extraction`)

**RAG security: poisoned, leaked and cross-tenant retrieval.** Retrieval decides what untrusted text the model reads, so it must enforce who may see what and treat every retrieved chunk as data. (Level 8; `/latent/security/learn/rag-security`)

**Improper output handling.** Model output is untrusted input to whatever consumes it next: a browser, a database, a shell or a tool. (Level 8; `/latent/security/learn/output-handling`)

**Unbounded consumption and denial of wallet.** LLM systems spend money and GPU time per token and per tool call, so an attacker or a bug can make them burn resources without limit. (Level 8; `/latent/security/learn/unbounded-consumption`)

**AI supply chain.** Every model file, tokenizer, dataset, package, plugin and tool server you load is code or data written by someone else. (Level 8; `/latent/security/learn/supply-chain`)

**Agentic AI security (OWASP Agentic Top 10).** Agents turn model mistakes and manipulations into actions, so agent security is about bounding what any single decision can do. (Level 9; `/latent/security/learn/agent-security`)

**Memory and context poisoning.** If untrusted text can be written into an agent's memory, it will be read back as context in every future session. (Level 9; `/latent/security/learn/memory-security`)

**MCP security.** Every MCP server you connect is third-party code whose descriptions and results flow into the model's context, so it must be treated as untrusted until proven otherwise. (Level 9; `/latent/security/learn/mcp-security`)

**How an AI red team thinks.** A red team challenges the system's assumptions with reproducible, scoped experiments and turns each finding into a fix and a regression test. (Level 10; `/latent/security/learn/red-teaming`)

**Defense in depth for LLM systems.** Assume the model will sometimes be fooled; design so that when it is, nothing important happens. (Level 10; `/latent/security/learn/defenses`)

## Distinctions

**Vector DB vs Model memory.** A vector database is external storage searched at query time; the model's knowledge is in its weights.

**Prompt injection vs Jailbreak.** Injection subverts the application's task, often through third-party data; a jailbreak bypasses the model's own safety policy.

**Prompt injection vs Data poisoning.** Injection arrives in the context at inference; poisoning changes training data (and weights) or stored corpora.

**Jailbreak vs Adversarial example.** An adversarial example is any input crafted to cause a model error; a jailbreak specifically aims to bypass safety behaviour.

**Model red teaming vs Penetration testing.** Model red teaming probes learned behaviour statistically; pentesting exploits deterministic software and infrastructure flaws.

**Model poisoning vs RAG poisoning.** Model poisoning changes weights; RAG poisoning plants retrievable content and is fixed by cleaning the corpus.

**Model extraction vs Training-data extraction.** Model extraction copies the model's behaviour or parameters; training-data extraction recovers examples it was trained on.

**Authentication vs Authorization.** Authentication establishes who you are; authorization decides what you (or your agent) may do.

**Guardrail vs Sandbox.** A guardrail tries to stop bad outputs; a sandbox limits damage when something bad is executed anyway.

**System prompt vs Security boundary.** A system prompt is guidance to a probabilistic model; a security boundary is enforced by code, identity and isolation.

**Excessive agency vs Tool misuse.** Excessive agency is the design flaw (too much permission or autonomy); tool misuse is the harmful event it enables.

**Data poisoning vs Context poisoning.** Data poisoning alters training data and therefore weights; context poisoning alters what is inserted into prompts (RAG, memory, tool results).
