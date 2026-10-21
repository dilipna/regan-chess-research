import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { atlasLevels } from "@/lib/latent/atlas";
import { atlasExample } from "@/lib/latent/atlas-example";
import type { Architecture } from "@/lib/latent/types";

const arch = JSON.parse(readFileSync("public/data/latent/qwen3-8b/architecture.json", "utf8")) as Architecture;
const levels = atlasLevels(arch);

describe("Transformer Atlas", () => {
  it("has the four zoom levels, with dives that point at real levels", () => {
    expect(levels.map((l) => l.id)).toEqual(["model", "block", "attention", "mlp"]);
    const ids = new Set(levels.map((l) => l.id));
    for (const l of levels) {
      if (l.parent) expect(ids.has(l.parent)).toBe(true);
      for (const n of l.nodes) if (n.dive) expect(ids.has(n.dive), `${l.id}/${n.id}`).toBe(true);
    }
  });
  it("every edge and tour step names a node on its level, and every node is on the tour", () => {
    for (const l of levels) {
      const ids = new Set(l.nodes.map((n) => n.id));
      for (const e of l.edges) expect(ids.has(e.from) && ids.has(e.to), `${l.id}: ${e.from} -> ${e.to}`).toBe(true);
      expect([...l.order].sort()).toEqual([...ids].sort());
    }
  });
  it("every node has a full explanation and a memory hook", () => {
    for (const l of levels) for (const n of l.nodes) {
      const p = n.part;
      for (const k of ["title", "intuition", "mechanism", "shapes", "why", "confusion", "hook"] as const) expect(p[k], `${l.id}/${n.id}.${k}`).toBeTruthy();
    }
  });
  it("nodes stay inside the drawing", () => {
    for (const l of levels) for (const n of l.nodes) {
      expect(n.x - n.w / 2, `${l.id}/${n.id}`).toBeGreaterThanOrEqual(0);
      expect(n.x + n.w / 2, `${l.id}/${n.id}`).toBeLessThanOrEqual(l.width);
      expect(n.y + n.h / 2, `${l.id}/${n.id}`).toBeLessThanOrEqual(l.height);
    }
  });
  it("uses the verified Qwen3-8B sizes", () => {
    const text = JSON.stringify(levels);
    for (const s of ["4,096 → 12,288", "32 heads × 128", "8 heads × 128", "×36", "151,936"]) expect(text).toContain(s);
  });
});

describe("Atlas running example", () => {
  const trace = JSON.parse(readFileSync("public/data/latent/qwen3-8b/token_trace.json", "utf8"));
  const tok = JSON.parse(readFileSync("public/data/latent/qwen3-8b/tokenizer_examples.json", "utf8"));
  const ex = atlasExample(trace, tok)!;
  it("is a recorded forward pass with every slice the visuals need", () => {
    expect(ex.text).toBe("The researcher opened the notebook");
    expect(ex.tokens[0].prefix).toBe(true);
    expect(ex.emb.length).toBe(ex.tokens.length - 1);
    expect(ex.stream.length).toBe(arch.verified.num_hidden_layers + 1);
    for (const k of ["attnNorm", "mlpNorm", "attnOut", "mlpOut"] as const) expect(ex[k].length).toBe(arch.verified.num_hidden_layers);
    expect(ex.top.length).toBe(8);
  });
  it("the curated heads match their descriptions", () => {
    const T = ex.tokens.length;
    const prev = (w: number[][]) => w.slice(2).reduce((s, r, i) => s + r[i + 1], 0) / (T - 2);
    const sink = (w: number[][]) => w.slice(1).reduce((s, r) => s + r[0], 0) / (T - 1);
    expect(ex.heads.map((h) => `${h.layer}/${h.head}`)).toEqual(["1/4", "17/18", "34/12"]);
    expect(prev(ex.heads[0].w)).toBeGreaterThan(0.6);
    expect(sink(ex.heads[1].w)).toBeGreaterThan(0.9);
    expect(prev(ex.heads[2].w)).toBeGreaterThan(0.6);
    for (const h of ex.heads) for (const r of h.w) expect(r.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 1);
  });
  it("the model level uses the example's sentence and predicted token", () => {
    const model = atlasLevels(arch, ex)[0];
    expect(model.nodes.find((n) => n.id === "text")!.sub).toContain(ex.text);
    expect(model.nodes.find((n) => n.id === "next")!.label).toContain(ex.top[0].label);
  });
});
