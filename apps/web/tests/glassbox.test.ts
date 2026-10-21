import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CHECKS, MATCH_TOLERANCE, compare, parseLayer, rankVariants, rmsOf, type GbManifest } from "@/lib/latent/glassbox";

const DIR = path.join(__dirname, "..", "public", "data", "latent", "qwen3-8b", "glassbox");
const manifest: GbManifest = JSON.parse(readFileSync(path.join(DIR, "manifest.json"), "utf-8"));
const load = (i: number) => {
  const meta = manifest.layers[i];
  const b = readFileSync(path.join(DIR, meta.file));
  return { meta, A: parseLayer(meta, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) };
};

describe("Glass Box: re-deriving recorded Qwen3-8B tensors", () => {
  it("the binary files match the manifest", () => {
    for (let i = 0; i < manifest.layers.length; i++) {
      const { meta, A } = load(i);
      for (const a of meta.arrays) expect(A[a.name].length).toBe(a.shape.reduce((x, y) => x * y, 1));
      expect(Array.from(A.attn_probs).every(Number.isFinite)).toBe(true);
    }
  });
  for (let i = 0; i < 3; i++) {
    it(`block ${manifest.layers[i].layer + 1}: Qwen's documented formula is the best fit in every check, at bfloat16 precision, by at least 3x`, () => {
      const { A } = load(i);
      for (const c of CHECKS) {
        const ranked = rankVariants(c, A, manifest, manifest.query_position);
        const correct = ranked.find((r) => r.correct)!;
        expect(correct.best, `${c.id}: correct formula should fit best`).toBe(true);
        expect(correct.cmp.maxRel, `${c.id}: bfloat16 precision`).toBeLessThan(MATCH_TOLERANCE);
        for (const r of ranked.filter((x) => !x.correct)) expect(r.ratio, `${c.id}/${r.id}`).toBeGreaterThan(3);
      }
      const py = manifest.layers[i].python_ledger;
      expect(py.every((c) => c.max_err_rel_to_max < MATCH_TOLERANCE)).toBe(true);
    });
  }
  it("the residual stream's mean is small compared with its RMS (why LayerNorm comes close)", () => {
    for (let i = 0; i < 3; i++) {
      const { A } = load(i);
      const mean = A.resid_pre.reduce((s, v) => s + v, 0) / A.resid_pre.length;
      expect(Math.abs(mean) / rmsOf(A.resid_pre)).toBeLessThan(0.05);
    }
  });
  it("RoPE only matches at the token's real position", () => {
    const { A } = load(1);
    const rope = CHECKS.find((c) => c.id === "rope")!;
    const at = (p: number) => { const { got, ref } = rope.run(A, manifest, "half", p); return compare(got, ref).maxRel; };
    expect(at(manifest.query_position)).toBeLessThan(MATCH_TOLERANCE);
    expect(at(manifest.query_position - 1)).toBeGreaterThan(MATCH_TOLERANCE);
    expect(at(manifest.query_position + 1)).toBeGreaterThan(MATCH_TOLERANCE);
  });
});
