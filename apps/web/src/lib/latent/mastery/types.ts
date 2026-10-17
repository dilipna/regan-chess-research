// Shared shapes for the LLM Mastery course and the AI Security Lab. Every topic follows one fixed learning format
// (A to M) so that what you learn always lands in the same mental slots.

export type FactStatus = "verified" | "generic" | "inferred" | "unknown";

export interface Option { t: string; ok?: boolean; why: string }
export type Area = "arch" | "traininf" | "app" | "security" | "connection";

export interface QuizItem {
  id: string;
  topic: string;          // topic slug this item trains
  area: Area;
  prompt: string;
  options: Option[];      // every option explains why it is right or wrong (error correction)
}

export type Visual =
  | "pipeline" | "tokens" | "embedding" | "residual" | "rmsnorm" | "matmul" | "qkv" | "gqa" | "rope" | "mask"
  | "mlp" | "head" | "decode" | "train-loop" | "parallel" | "posttrain" | "arch-compare" | "serve" | "kv" | "rag"
  | "agent" | "mcp" | "probe" | "layers" | "boundary" | "injection" | "lifecycle" | "redteam";

export interface Topic {
  slug: string;
  track: "mastery" | "security";
  level: number;                       // curriculum level (1 to 11)
  title: string;
  prereqs: string[];                   // topic slugs
  intuition: string;                   // A. 10-second intuition
  visual: Visual;                      // B. visual model
  where: string;                       //    where it sits in the system
  mechanism: string[];                 // C. exact mechanism
  eq?: string[];
  qwen: { text: string; status: FactStatus }[];   // D. real Qwen connection (security track: the LLM property behind it)
  shapes?: [string, string, string][]; // E. input, operation, output
  code?: string;                       // F. code connection
  why: string;                         // G
  breaks: string;                      // H
  trainInfer: string;                  // I
  security: string;                    // J
  confusion: string;                   // K
  teachBack: { prompt: string; points: string[] };     // L. what a complete explanation mentions
  interview: { q: string; level: 1 | 2 | 3 | 4 | 5 | 6; outline: string[] };   // M
  quiz: QuizItem[];                    // first item is asked before the reveal (prediction)
  links: { href: string; label: string }[];
  story?: string;                      // Storybook chapter slug
  research?: { href: string; label: string };
  sources?: { label: string; url: string }[];
}

export const STATUS_LABEL: Record<FactStatus, string> = {
  verified: "Verified Qwen fact",
  generic: "Generic modern LLM practice",
  inferred: "Inferred",
  unknown: "Unknown / not disclosed",
};
