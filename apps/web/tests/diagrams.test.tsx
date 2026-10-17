import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hasDiagram } from "@/components/latent/mastery/diagrams";
import { ropeScore } from "@/components/latent/mastery/diagrams/rope-concept";
import { MasteryTopic } from "@/components/latent/mastery/mastery-topic";
import type { Architecture } from "@/lib/latent/types";

const text = (el: React.ReactElement) => renderToString(el).replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const arch: Architecture = JSON.parse(readFileSync(path.join(__dirname, "..", "public", "data", "latent", "qwen3-8b", "architecture.json"), "utf-8"));

describe("transformer diagrams", () => {
  it("RoPE: equal offsets give equal scores, a different offset does not", () => {
    expect(ropeScore(2, 5)).toBeCloseTo(ropeScore(10, 13), 12);
    expect(ropeScore(2, 5)).toBeCloseTo(ropeScore(40, 43), 12);
    expect(Math.abs(ropeScore(2, 5) - ropeScore(2, 6))).toBeGreaterThan(1e-3);
  });
  it("each diagram renders inside its topic with the key facts", () => {
    const cases: [string, string[]][] = [
      ["residual-stream", ["Δattn", "Δmlp", "x′ = x + Δattn", "never replaced"]],
      ["qkv", ["[T, 32, 128]", "[T, 8, 128]", "no norm, no rotation", "Q·Kᵀ / √128"]],
      ["causal-attention", ["causal mask", "allowed", "−∞"]],
      ["gqa", ["Q31", "K7 V7", arch.kv_cache.bytes_per_token_all_layers.toLocaleString("en-US"), arch.kv_cache.bytes_per_token_if_mha.toLocaleString("en-US")]],
      ["rope", ["offset n − m", "rotate-half"]],
      ["swiglu", ["SiLU(gate) ⊙ up", "[12288]", "Δmlp [4096]"]],
    ];
    for (const [slug, needles] of cases) {
      expect(hasDiagram(slug), slug).toBe(true);
      const h = text(<MasteryTopic slug={slug} defaultOpen />);
      for (const n of needles) expect(h, `${slug}: ${n}`).toContain(n);
    }
  });
});
