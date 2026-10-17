import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GENERATED_DOCS } from "@/lib/latent/docs";
import { PROF_SECTIONS } from "@/lib/latent/professor";

const DOCS = path.join(__dirname, "..", "..", "..", "docs");
const norm = (s: string) => s.replace(/\r\n/g, "\n");

describe("study guides", () => {
  it.runIf(process.env.GEN_DOCS === "1")("regenerates the data-derived docs", () => {
    for (const [f, make] of Object.entries(GENERATED_DOCS)) writeFileSync(path.join(DOCS, f), make());
  });
  it("generated docs match the curriculum data", () => {
    for (const [f, make] of Object.entries(GENERATED_DOCS)) {
      expect(existsSync(path.join(DOCS, f)), f).toBe(true);
      expect(norm(readFileSync(path.join(DOCS, f), "utf-8")), `${f} is out of date: run GEN_DOCS=1 npx vitest run tests/docs-sync.test.ts`).toBe(norm(make()));
    }
  });
  it("all ten guides exist; hand-written ones cover what they must", () => {
    for (const f of ["PROFESSOR_REGAN_TECHNICAL_WALKTHROUGH.md", "AI_THREAT_MODEL_TEMPLATE.md"]) expect(existsSync(path.join(DOCS, f)), f).toBe(true);
    const prof = readFileSync(path.join(DOCS, "PROFESSOR_REGAN_TECHNICAL_WALKTHROUGH.md"), "utf-8");
    for (const s of ["60-second", "5-minute", "10-minute", "Likely questions", "residual stream", "RMSNorm", "Recall Microscope"]) expect(prof).toContain(s);
    for (const s of PROF_SECTIONS) expect(prof).toContain(s.title);
    const tm = readFileSync(path.join(DOCS, "AI_THREAT_MODEL_TEMPLATE.md"), "utf-8");
    for (const s of ["Assets", "Trust boundaries", "Entry points", "Attack paths", "Residual risk"]) expect(tm).toContain(s);
  });
  it("no em dashes in any of the guides", () => {
    for (const f of [...Object.keys(GENERATED_DOCS), "PROFESSOR_REGAN_TECHNICAL_WALKTHROUGH.md", "AI_THREAT_MODEL_TEMPLATE.md"]) {
      if (existsSync(path.join(DOCS, f))) expect(readFileSync(path.join(DOCS, f), "utf-8"), f).not.toContain("—");
    }
  });
});
