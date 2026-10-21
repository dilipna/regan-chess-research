// Lab 1: Trust boundaries. An architecture exercise with no adversarial content at all.

import type { LabText } from "./types";

export type Attr = "trusted" | "untrusted" | "privileged" | "persistent" | "external";
export const ATTRS: { id: Attr; label: string }[] = [
  { id: "trusted", label: "Trusted" }, { id: "untrusted", label: "Untrusted" }, { id: "privileged", label: "Can cause side effects" },
  { id: "persistent", label: "Persistent" }, { id: "external", label: "External" },
];

export interface Part { id: string; name: string; ref: Attr[]; why: string }
export const PARTS: Part[] = [
  { id: "user", name: "User", ref: ["untrusted", "external"], why: "Authenticated, but their input is still untrusted: it may be mistaken, malicious, or pasted from elsewhere." },
  { id: "app", name: "Web app / backend", ref: ["trusted", "privileged"], why: "Your code: holds credentials, enforces authorization, calls tools." },
  { id: "llm", name: "LLM", ref: ["untrusted"], why: "Your component, but its output is untrusted: it is a probabilistic function of everything in its context, including untrusted text." },
  { id: "rag", name: "RAG retriever", ref: ["trusted"], why: "Your code that queries the index; it must apply authorization filters, but it hands untrusted text onward." },
  { id: "vector", name: "Vector store", ref: ["persistent"], why: "Stores embeddings and chunks from many sources; its contents are only as trustworthy as what was ingested." },
  { id: "memory", name: "Agent memory", ref: ["persistent"], why: "Persists across sessions; untrusted content written here keeps coming back." },
  { id: "tools", name: "Tools (email, records, payments)", ref: ["trusted", "privileged"], why: "Your code with real side effects; the place where authorization must be enforced." },
  { id: "mcp", name: "Third-party MCP server", ref: ["untrusted", "external", "privileged"], why: "Someone else's code and descriptions, possibly acting with delegated credentials." },
  { id: "web", name: "External data (web pages, emails)", ref: ["untrusted", "external"], why: "Written by anyone; enters the context through retrieval or tools." },
  { id: "secrets", name: "Secrets store", ref: ["trusted", "persistent"], why: "Should be reachable by the tool layer only, never placed in the model's context." },
];

/** Data and control flows between parts. A boundary exists wherever trust differs across a flow. */
export const FLOWS: [string, string, string][] = [
  ["user", "app", "request"], ["app", "rag", "query"], ["rag", "vector", "search"], ["web", "vector", "ingestion"],
  ["vector", "rag", "chunks"], ["rag", "llm", "retrieved text"], ["app", "llm", "prompt"], ["memory", "llm", "recalled notes"],
  ["llm", "app", "proposed tool call"], ["app", "tools", "authorized call"], ["tools", "app", "tool result"], ["app", "mcp", "tool call"],
  ["mcp", "llm", "tool output"], ["llm", "memory", "memory write"], ["secrets", "tools", "credentials"],
];

export const QUESTIONS: { q: string; a: string }[] = [
  { q: "What assets exist?", a: "Customer data in the vector store and records, the secrets, the ability to send email and move credits as the user, the memory, and availability and cost." },
  { q: "What enters from untrusted sources?", a: "User messages, external web pages and emails (via ingestion and retrieval), third-party MCP tool descriptions and outputs, and anything previously written to memory from those." },
  { q: "Which components can cause side effects?", a: "The tools, the third-party MCP server (with whatever credentials it holds), and the backend that calls them." },
  { q: "Where is authorization enforced?", a: "In the backend and tool layer, on every proposed call, using the user's permissions. Never in the prompt and never by the LLM." },
  { q: "What data persists?", a: "Vector store, agent memory, secrets store and logs. Persistent stores turn a one-time input into a future-session problem." },
  { q: "What is the blast radius of a fully fooled model?", a: "Exactly what its proposed calls can achieve after your checks. With least privilege, validation and approval it shrinks to a few low-impact actions; without them it is everything the tools and their credentials can do." },
];

export const TRUST_TEXT: LabText = {
  system: "A support assistant: a web app calls an LLM that can retrieve documents, remember notes, and call tools (email, customer records, demo credits), plus one third-party MCP server.",
  boundary: "Mark each component, then see where flows cross between trusted and untrusted parts.",
  assumption: "Teams often secure the chat box and assume everything else is internal and therefore safe.",
  fixture: "No adversarial content in this lab: only the architecture.",
  failure: "Any flow from an untrusted part into the LLM, followed by a flow from the LLM to a privileged part, is a path by which outside text could steer an action.",
  rootCause: "The LLM merges trusted and untrusted inputs into one context and its output then drives privileged components.",
  impact: "Confidentiality (disclosure of data or context), integrity (unauthorized actions, manipulated answers, poisoned stores), availability (cost and loops).",
  defense: "Put authorization, validation and approval on the flow from the LLM to tools; authorize before retrieval; control memory writes; keep secrets out of context; restrict third-party servers.",
  retest: "Re-draw the flows after adding controls: every untrusted-to-privileged path should now pass through an enforcement point.",
  residual: "The model can still be wrong or misled in text it shows the user; that needs grounding, citations and human judgement.",
  frameworks: ["OWASP LLM Top 10 (2026): LLM01 Prompt Injection, LLM03 Excessive Agency", "OWASP Agentic Top 10: ASI03 Identity and Privilege Abuse, ASI04 Supply Chain", "Google SAIF: risk map across data, model, application, infrastructure"],
  fundamentals: "Attention reads every token in the context the same way, so the model has no built-in notion of which text is trusted; boundaries must be enforced by the system around it.",
  topics: ["threat-modeling", "security-foundations", "agents"],
};
