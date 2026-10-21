// Security foundations vocabulary and the two principles the Security Lab keeps returning to.

export const FOUNDATIONS: { term: string; def: string; llm: string }[] = [
  { term: "Asset", def: "Something of value that must be protected.", llm: "Customer data, secrets, the ability to send email as the user, money, model weights, availability and cost." },
  { term: "Adversary", def: "Someone with goals against your assets, and some capability.", llm: "A malicious user, the author of a document or web page the system reads, the operator of a connected tool server." },
  { term: "Trust boundary", def: "A place where data or control crosses between different levels of trust.", llm: "Retrieved text entering the prompt; model output becoming a tool call; tool output re-entering the context." },
  { term: "Attack surface", def: "Every way an adversary can reach the system.", llm: "Chat input, uploads, retrieved documents, emails, images, tool results, memory, tool descriptions." },
  { term: "Threat", def: "A possible way an adversary could cause harm.", llm: "Untrusted document text causing an unauthorized email." },
  { term: "Vulnerability", def: "A weakness that makes a threat possible.", llm: "The email tool accepts any recipient the model writes." },
  { term: "Impact", def: "The harm if the threat succeeds.", llm: "Private data sent to an outside address." },
  { term: "Risk", def: "Likelihood combined with impact.", llm: "High if the agent reads public content and holds broad permissions." },
  { term: "Control", def: "A measure that reduces likelihood or impact.", llm: "Recipient allowlist plus human approval before sending." },
  { term: "Confidentiality, integrity, availability", def: "No unauthorized disclosure; no unauthorized modification; the service stays usable.", llm: "Leaked context; manipulated answers or actions; runaway cost and loops." },
  { term: "Authentication vs authorization", def: "Who you are vs what you may do.", llm: "Logging in does not authorize every action an agent proposes on your behalf." },
  { term: "Least privilege", def: "Grant only what the task needs.", llm: "A calendar assistant gets a read-only calendar credential and nothing else." },
  { term: "Defense in depth", def: "Several independent controls, so one failure is not a breach.", llm: "Classifier, plus permissions, plus approval, plus logging." },
  { term: "Sandboxing", def: "Run risky operations where they cannot harm the real system.", llm: "Generated code runs in a container with no secrets and no network." },
  { term: "Validation", def: "Check inputs and outputs against what is allowed.", llm: "Tool arguments parsed against a schema; output escaped before rendering." },
  { term: "Monitoring and incident response", def: "Notice misuse and act on it.", llm: "Audit logs of prompts, tool calls and approvals; alerts; a kill switch." },
];

export const PRINCIPLES = [
  { title: "The model proposes. The system authorizes.", body: "An LLM's output is text. When that text names an action, the application decides whether it happens, using permissions, validation and approvals that exist outside the probabilistic model. Natural-language output is never itself authorization." },
  { title: "Security does not mean truthfulness.", body: "Architecture-level controls can reduce data exposure, unauthorized actions, privilege abuse and blast radius. They cannot guarantee factual correctness, correct reasoning or the absence of hallucination. A planted false claim needs no privileges, so capability controls cannot stop it; that needs verification, grounding and human review." },
];
