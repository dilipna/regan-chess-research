// The Security Lab's lab list. Each lab has its own data file and its own interactive component.

import { TRUST_TEXT } from "./trust-boundaries";
import type { LabText } from "./types";

export interface LabInfo { slug: string; n: number; title: string; intro: string; text: LabText }

export const LAB_LIST: LabInfo[] = [
  { slug: "trust-boundaries", n: 1, title: "Trust boundaries", intro: "Mark which parts of an AI application are trusted, privileged, persistent or external, then find every path from outside text to an action.", text: TRUST_TEXT },
];
export const labBySlug = (s: string) => LAB_LIST.find((l) => l.slug === s);
