import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExampleExplorer, MoveTable, OneMoveExplained, type CuratedData } from "@/components/three/examples";
import { ARTIFACTS, LIMITATIONS, LimitationsPanel, ThreeModelCards } from "@/components/three/summary";
import { explainPosition } from "@/lib/explain";
import type { ThreePosition } from "@/lib/three";

const root = path.join(__dirname, "..", "public");
const cur: CuratedData = JSON.parse(readFileSync(path.join(root, "data", "curated_examples.json"), "utf-8"));
const okPositions = cur.examples.filter((e) => e.position).map((e) => e.position as ThreePosition);

describe("curated examples (precomputed research data)", () => {
  it("has at least five real positions and reserved Qwen slots", () => {
    expect(okPositions.length).toBeGreaterThanOrEqual(5);
    expect(cur.examples.filter((e) => e.status === "pending").every((e) => e.position === null && e.id.startsWith("qwen-"))).toBe(true);
  });
  it("every Maia distribution is a probability distribution over exactly the legal moves", () => {
    for (const p of okPositions) {
      expect(p.candidates.length).toBe(p.n_legal);
      const s = p.candidates.reduce((a, c) => a + (c.maia ?? NaN), 0);
      expect(Math.abs(s - 1)).toBeLessThan(2e-3);
      expect(p.candidates.some((c) => c.move === p.original_move)).toBe(true);
    }
  });
  it("never shows a Qwen value while Qwen is pending", () => {
    if (cur.qwen.status === "ok") return;
    for (const p of okPositions) for (const c of p.candidates) expect([c.qwen, c.qwen_rank, c.qwen_logprob]).toEqual([null, null, null]);
    const html = renderToString(<ExampleExplorer data={cur} />);
    expect(html).toMatch(/pending/i);
  });
  it("explanations are generated from stored numbers and mention the played move", () => {
    for (const p of okPositions) {
      const e = explainPosition(p, false);
      expect(e.human).toContain(p.original_san);
      expect(e.qwen).toMatch(/pending/i);
      expect(e.maia).toContain("%");
    }
  });
  it("renders the table and explanation for every example without throwing", () => {
    for (const p of okPositions) {
      expect(renderToString(<MoveTable p={p} qwenOk={false} />)).toContain(p.original_san);
      expect(renderToString(<OneMoveExplained p={p} qwenOk={false} />)).toContain("What it means");
    }
  });
});

describe("static research artifacts and required statements", () => {
  it("every listed download exists", () => {
    for (const a of ARTIFACTS) expect(existsSync(path.join(root, a.path)), a.path).toBe(true);
  });
  it("limitations cover the required points and the disclaimer is shown", () => {
    const t = LIMITATIONS.join(" ");
    for (const k of ["not Professor Regan", "not identical to real-world cheating", "human move preference, not cheating", "general language model", "Tokenization", "dataset", "not proof of misconduct"]) expect(t).toContain(k);
    expect(renderToString(<LimitationsPanel />).replace(/&#x27;/g, "'")).toMatch(/not Professor Regan(&#x27;|')s production analyzer/);
  });
  it("Maia is never described as a language model; the three model cards render", () => {
    const html = renderToString(<ThreeModelCards qwenOk={false} />);
    expect(html).toMatch(/not a language model/);
    expect(html).toMatch(/pending/i);
  });
});
