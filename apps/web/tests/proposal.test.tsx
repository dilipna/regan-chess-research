import { existsSync } from "node:fs";
import path from "node:path";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }), usePathname: () => "/latent/proposal" }));

import Home from "@/app/page";
import ProposalPage from "@/app/latent/proposal/page";
import * as P from "@/lib/latent/proposal";
import { PHASES, headerLinks } from "@/lib/site/phases";

const text = (el: React.ReactElement) => renderToString(el).replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const APP = path.join(__dirname, "..", "src", "app");

describe("site phases", () => {
  it("has exactly two phases, chess then LLMs, and every subsection resolves to a page", () => {
    expect(PHASES.map((p) => p.label)).toEqual(["Chess", "LLMs"]);
    for (const p of PHASES) for (const g of p.groups) for (const l of g.links) {
      const route = l.href.split("#")[0].replace(/^\//, "");
      expect(existsSync(path.join(APP, route, "page.tsx")), l.href).toBe(true);
      expect(l.n.startsWith(`${p.n}.`)).toBe(true);
    }
  });
  it("places the proposed approach as the last subsection of Phase 2, and in the Phase 2 header last", () => {
    const llm = PHASES[1];
    const links = llm.groups.flatMap((g) => g.links);
    expect(links.at(-1)!.href).toBe("/latent/proposal");
    expect(links.at(-1)!.n).toBe(`2.${links.length}`);
    expect(headerLinks(llm).at(-1)!.href).toBe("/latent/proposal");
    expect(PHASES[0].groups.flatMap((g) => g.links).some((l) => l.href.includes("proposal"))).toBe(false);
  });
  it("renders a simple home: two phases, three starting points, the full index folded away", async () => {
    const h = text(await Home());
    expect(h).toContain("A research project in two phases");
    for (const p of PHASES) expect(h).toContain(p.plain);
    for (const s of ["The 5-minute demo", "The proposed next experiment", "The Recall Microscope", "All pages, by phase"]) expect(h).toContain(s);
    for (const p of PHASES) for (const g of p.groups) for (const l of g.links) expect(h).toContain(l.label);
    expect(h).toContain("diagnostic projection");
    expect(h).toContain("0.820 to 0.873 ROC-AUC");
    expect(h).toContain("held-out evaluation is still pending");
  });
  it("keeps the header short: only key pages", () => {
    for (const p of PHASES) expect(headerLinks(p).length).toBeLessThanOrEqual(4);
  });
});

describe("/latent/proposal", () => {
  const h = text(<ProposalPage />);
  it("frames the professor's observation without assuming a wall, and states the main question", () => {
    for (const s of ["Professor-reported observation", "86.31%", "86.34%", "about 40 more tokens", "we will", "we shall not", P.FRAMING, P.MAIN_QUESTION, "does not assume that scaling has hit a wall"]) expect(h).toContain(s);
  });
  it("presents five stages in order, with the pipeline and the reproduce-first principle", () => {
    expect(P.STAGES.map((s) => s.n)).toEqual([1, 2, 3, 4, 5]);
    for (const s of P.STAGES) expect(h).toContain(s.title);
    expect(h).toContain("Reproduce first. Interpret second.");
    for (const s of P.PIPELINE) expect(h).toContain(s);
    for (const s of ["Model-native token recall", "Aligned text-span analysis", "relative transformer depth", "Block RMSNorm", "Q/K RMSNorm", P.LATENT_TRACK.question]) expect(h).toContain(s);
    for (const c of P.CATEGORIES) expect(h).toContain(c.text);
    for (const o of P.OUTCOMES) expect(h).toContain(o.result);
  });
  it("invents no values: only the two reported recall figures appear as percentages", () => {
    expect([...new Set(h.match(/\d+(\.\d+)?%/g))].sort()).toEqual(["86.31%", "86.34%"]);
    expect(h).toContain("to confirm");
    expect(h).toContain("to measure");
    expect(h).toContain("Proposal · not yet run");
    expect(h).not.toMatch(/Qwen\/Qwen[^ ]*(14B|27B|32B)/);
  });
  it("ends with the exact pitch and the confirmation list", () => {
    expect(h).toContain(P.PITCH);
    expect(P.CONFIRM).toHaveLength(10);
    for (const c of P.CONFIRM) expect(h).toContain(c);
    expect(P.WHY).toHaveLength(6);
  });
  it("follows the wording rules", () => {
    for (const bad of [/layer knows/i, /layer predicts/i, /larger model is worse/i, /scaling (has )?hit a wall(?<!not assume that scaling has hit a wall)/i, /RMSNorm caused/i, /more information because/i, /model's prediction at layer/i])
      expect(h.replace("does not assume that scaling has hit a wall", "")).not.toMatch(bad);
    expect(h).toContain("intermediate diagnostic projection".replace(/^i/, "I"));
    expect(h).toContain("not treated as an amount of information");
    expect(h).not.toContain("—");
  });
});
