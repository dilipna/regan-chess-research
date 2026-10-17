// AI-security frameworks, checked on the date below. Editions change; each entry says what was verified where.

export const FRAMEWORKS_CHECKED = "17 October 2026";

export interface Framework { name: string; version: string; source: string; url: string; covers: string; labs: string[]; note?: string }

export const FRAMEWORKS: Framework[] = [
  { name: "OWASP Top 10 for LLM Applications", version: "2026 edition (announced 1 to 2 September 2026); 2025 edition still listed on the project page", source: "OWASP GenAI Security Project", url: "https://genai.owasp.org/llm-top-10/",
    covers: "The ten most critical risks for applications that use LLMs as components.", labs: ["prompt-injection", "rag", "output", "consumption", "tools"],
    note: "The 2025 list was read from OWASP's own page. The 2026 order below comes from OWASP's announcement plus the Cloud Security Alliance research note, because the 2026 list page was not retrievable at check time." },
  { name: "OWASP Top 10 for Agentic Applications", version: "2026 edition, published 9 December 2025", source: "OWASP GenAI Security Project", url: "https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/",
    covers: "Risks specific to autonomous and tool-using agents (ASI01 to ASI10).", labs: ["tools", "memory", "attack-tree", "evals"],
    note: "Release date read from OWASP's page; entry names consistent across several independent guides. One source mentions a later 2.01 revision; unconfirmed." },
  { name: "OWASP Agent Control Standard (ACS)", version: "v0.1 public preview (September 2026)", source: "OWASP GenAI Security Project", url: "https://genai.owasp.org/agent-control-standard/",
    covers: "Runtime enforcement for agents: hooks where policy can allow, deny or modify actions; inspectable, traceable agents.", labs: ["tools"], note: "Early-stage standard; details may change." },
  { name: "NIST AI 100-2e2025: Adversarial Machine Learning taxonomy", version: "March 2025 (no newer edition found)", source: "NIST", url: "https://doi.org/10.6028/NIST.AI.100-2e2025",
    covers: "Taxonomy and terminology of attacks and mitigations for predictive and generative AI: evasion, poisoning, privacy attacks, supply chain, direct prompting, indirect prompt injection, agent security. Attacker objectives: availability breakdown, integrity violation, privacy compromise, misuse enablement.", labs: ["prompt-injection", "rag", "memory", "evals"] },
  { name: "NIST AI RMF 1.0 and Generative AI Profile (NIST AI 600-1)", version: "AI RMF 1.0 (January 2023); AI 600-1 (26 July 2024)", source: "NIST", url: "https://doi.org/10.6028/NIST.AI.600-1",
    covers: "Governance: map, measure, manage and govern AI risks; the profile adapts this to generative AI.", labs: ["threat-model", "evals"] },
  { name: "MITRE ATLAS", version: "living knowledge base", source: "MITRE", url: "https://atlas.mitre.org/",
    covers: "Adversary tactics, techniques and case studies against AI-enabled systems, modelled on ATT&CK; useful for red-team coverage.", labs: ["attack-tree", "evals"] },
  { name: "Google Secure AI Framework (SAIF)", version: "framework and risk map", source: "Google", url: "https://saif.google/",
    covers: "A conceptual framework and risk map for securing AI systems across data, model, application and infrastructure.", labs: ["threat-model"] },
  { name: "Model Context Protocol specification", version: "2026-07-28", source: "MCP project", url: "https://modelcontextprotocol.io/specification/latest",
    covers: "Hosts, clients, servers; resources, prompts, tools; security principles (consent, privacy, tool safety) that implementers must enforce.", labs: ["tools"] },
];

export const OWASP_LLM_2025 = ["LLM01 Prompt Injection", "LLM02 Sensitive Information Disclosure", "LLM03 Supply Chain", "LLM04 Data and Model Poisoning", "LLM05 Improper Output Handling", "LLM06 Excessive Agency", "LLM07 System Prompt Leakage", "LLM08 Vector and Embedding Weaknesses", "LLM09 Misinformation", "LLM10 Unbounded Consumption"];
export const OWASP_LLM_2026 = ["LLM01 Prompt Injection", "LLM02 Sensitive Information Disclosure", "LLM03 Excessive Agency", "LLM04 Supply Chain", "LLM05 Data and Model Poisoning", "LLM06 Unbounded Consumption", "LLM07 Misinformation", "LLM08 Hidden Context Exposure", "LLM09 Vector and Embedding Weaknesses", "LLM10 Improper Output Handling"];
export const OWASP_AGENTIC_2026 = ["ASI01 Agent Goal Hijack", "ASI02 Tool Misuse and Exploitation", "ASI03 Identity and Privilege Abuse", "ASI04 Agentic Supply Chain Vulnerabilities", "ASI05 Unexpected Code Execution", "ASI06 Memory & Context Poisoning", "ASI07 Insecure Inter-Agent Communication", "ASI08 Cascading Failures", "ASI09 Human-Agent Trust Exploitation", "ASI10 Rogue Agents"];

export const REDTEAM_STEPS = [
  ["Define scope", "What systems, which environments (sandbox only), what is out of bounds, who approves."],
  ["Define assets", "Data, money, credentials, reputation, model weights, availability."],
  ["Threat model", "Adversaries, their capabilities and positions (user, document author, server operator)."],
  ["Understand the architecture", "Data flows, trust boundaries, tools and their permissions."],
  ["Enumerate the attack surface", "Every way text, files or calls enter: chat, documents, email, tool results, memory, MCP servers."],
  ["Build hypotheses", "\"Untrusted document text can cause send_email to an external address.\""],
  ["Design reproducible cases", "Fixed inputs, settings, seeds and expected secure behaviour."],
  ["Execute safely", "Local or sandboxed targets, fake data and secrets, no third parties."],
  ["Measure success", "Attack success rate over repeated trials; benign task success."],
  ["Estimate impact", "What an attacker gains; prerequisites; blast radius."],
  ["Document evidence", "Inputs, outputs, logs, configuration."],
  ["Recommend mitigation", "Root-cause control first (permissions, validation), then likelihood reductions."],
  ["Regression test", "Turn each finding into an automated eval case."],
  ["Retest after fixes", "Confirm the rate dropped; record residual risk."],
] as const;

export const REPORT_FIELDS = ["Title", "Summary", "Affected component", "Prerequisites", "Threat model", "Reproduction in sandbox", "Observed behavior", "Expected behavior", "Impact", "Severity rationale", "Evidence", "Root cause", "Recommended mitigation", "Regression test", "Residual risk"] as const;
