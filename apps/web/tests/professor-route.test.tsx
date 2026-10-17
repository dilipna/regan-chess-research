import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }), usePathname: () => "/latent/professor" }));

import ProfessorPage from "@/app/latent/professor/page";
import { PROF_SECTIONS, PROF_TOTAL_MINUTES } from "@/lib/latent/professor";
import type { Architecture } from "@/lib/latent/types";

const text = (el: React.ReactElement) => renderToString(el).replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const arch: Architecture = JSON.parse(readFileSync(path.join(__dirname, "..", "public", "data", "latent", "qwen3-8b", "architecture.json"), "utf-8"));
const all = PROF_SECTIONS.flatMap((s) => [s.title, s.lead, ...(s.flow ?? []), ...s.points]).join(" ");

describe("/latent/professor", () => {
  it("renders the first section and the full section list, in an academic register", async () => {
    const h = text(await ProfessorPage());
    expect(h).toContain("Why Version 2 exists");
    for (const s of PROF_SECTIONS) expect(h).toContain(s.title);
    for (const banned of ["Pip", "sticker", "Sticker"]) expect(h).not.toContain(banned);
  });
  it("covers the seven requested sections and fits a 5 to 10 minute meeting", () => {
    expect(PROF_SECTIONS.map((s) => s.id)).toEqual(["why", "end-to-end", "block", "rmsnorm", "latent", "recall", "human-ai"]);
    expect(PROF_TOTAL_MINUTES).toBeGreaterThanOrEqual(5);
    expect(PROF_TOTAL_MINUTES).toBeLessThanOrEqual(10);
  });
  it("quotes only verified architecture numbers", () => {
    for (const n of [arch.parameters.total.toLocaleString("en-US"), arch.verified.vocab_size.toLocaleString("en-US"), arch.verified.tokenizer_size.toLocaleString("en-US"), "1e-6", "12,288", "32,768"]) expect(all).toContain(n);
  });
  it("never claims a layer detects AI, and keeps no em dashes", () => {
    expect(all).not.toMatch(/layer (that )?detects AI(?! ")/);
    expect(all).toContain("does not \"detect AI\"");
    expect(all).not.toContain("—");
  });
});
