// The Security Lab's lab list. Each lab has its own data and its own interactive component.

import { AGENCY_TEXT, CONSUMPTION_TEXT, EVAL_TEXT, INJECTION_TEXT, LEAK_TEXT, MEMORY_TEXT, OUTPUT_TEXT, RAG_TEXT } from "./sim-labs";
import { TRUST_TEXT } from "./trust-boundaries";
import type { LabText } from "./types";
import { WEB_TEXT } from "./web-basics";

export interface LabInfo { slug: string; n: number; title: string; intro: string; text: LabText }

export const LAB_LIST: LabInfo[] = [
  { slug: "trust-boundaries", n: 1, title: "Trust boundaries", intro: "Mark which parts of an AI application are trusted, privileged, persistent or external, then find every path from outside text to an action.", text: TRUST_TEXT },
  { slug: "web-basics", n: 2, title: "Web bugs LLM apps inherit", intro: "Cross-site scripting through model output, server-side request forgery through a URL tool, and broken access control through an order tool. The old rules, applied to a new source of input.", text: WEB_TEXT },
  { slug: "prompt-injection", n: 3, title: "Prompt injection, direct and indirect", intro: "One document, four phrasings of the same hidden request. See which defenses lower the odds and which ones hold even when the model is fooled.", text: INJECTION_TEXT },
  { slug: "secrets", n: 4, title: "Secrets and system-prompt leakage", intro: "A secret in the system prompt plus “never share it”. Ask for it directly and indirectly, then move it out of the model's reach.", text: LEAK_TEXT },
  { slug: "excessive-agency", n: 5, title: "Excessive agency and blast radius", intro: "A calendar question, an outside invite, and a credential that can move money. Measure what a fooled agent can actually do, and shrink it.", text: AGENCY_TEXT },
  { slug: "memory-poisoning", n: 6, title: "Memory poisoning across sessions", intro: "A note read on Monday quietly changes what the assistant does on Friday. Follow one poisoned memory through two sessions.", text: MEMORY_TEXT },
  { slug: "rag", n: 7, title: "Poisoned and leaky retrieval", intro: "Real similarity search over a shared index: a keyword-stuffed upload outranks the real policy, and another customer's secrets show up in the answer.", text: RAG_TEXT },
  { slug: "output-handling", n: 8, title: "Improper output handling", intro: "Model output flowing into a web page, a database, a shell and a file tool. Edit the output and watch validation accept or reject it.", text: OUTPUT_TEXT },
  { slug: "consumption", n: 9, title: "Unbounded consumption", intro: "A planted loop, a fan-out and an enormous answer, priced in tokens. Find the limit that stops each one.", text: CONSUMPTION_TEXT },
  { slug: "evals", n: 10, title: "Measure it: the red-team eval suite", intro: "All the attacks at once, plus benign tasks. Compare defense configurations by attack success rate and false positives, and meet the case nothing stops.", text: EVAL_TEXT },
];
export const labBySlug = (s: string) => LAB_LIST.find((l) => l.slug === s);
