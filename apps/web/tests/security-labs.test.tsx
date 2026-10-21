import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }), usePathname: () => "/latent/security/labs", notFound: () => { throw new Error("NOT_FOUND"); } }));

import LabsIndex from "@/app/latent/security/labs/page";
import LabPage, { generateStaticParams } from "@/app/latent/security/labs/[lab]/page";
import { LabView } from "@/components/latent/security/labs/lab-view";
import { LAB_LIST } from "@/lib/latent/security/labs";
import { FLOWS, PARTS } from "@/lib/latent/security/labs/trust-boundaries";
import { topicBySlug } from "@/lib/latent/mastery";

const text = (el: React.ReactElement) => renderToString(el).replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const STEP_LABELS = ["System", "Trust boundary", "Assumption", "Fixed synthetic fixture", "Failure", "Root cause", "Impact", "Defense", "Retest", "Residual risk", "Framework mapping", "Connection to LLM fundamentals"];

describe("security labs", () => {
  it("index lists every lab and states the local, synthetic boundary", () => {
    const h = text(<LabsIndex />);
    for (const l of LAB_LIST) expect(h).toContain(l.title);
    expect(h).toContain("nothing is executed or sent anywhere");
  });
  it("every lab renders all twelve steps and links to real topics", () => {
    expect(generateStaticParams().map((p) => p.lab)).toEqual(LAB_LIST.map((l) => l.slug));
    for (const l of LAB_LIST) {
      const h = text(<LabView slug={l.slug} />);
      for (const s of STEP_LABELS) expect(h, `${l.slug}: ${s}`).toContain(s);
      for (const t of l.text.topics) expect(topicBySlug(t), t).toBeDefined();
    }
  });
  it("rejects unknown labs", async () => {
    await expect(LabPage({ params: Promise.resolve({ lab: "nope" }) })).rejects.toThrow("NOT_FOUND");
  });
  it("lab 1 flows reference real components, and every untrusted input to the LLM can reach a privileged part", () => {
    const ids = new Set(PARTS.map((p) => p.id));
    for (const [a, b] of FLOWS) { expect(ids.has(a), a).toBe(true); expect(ids.has(b), b).toBe(true); }
    const priv = PARTS.filter((p) => p.ref.includes("privileged")).map((p) => p.id);
    expect(FLOWS.some(([a, b]) => a === "llm" && priv.includes(b))).toBe(true);
    for (const p of PARTS) expect(p.ref.includes("trusted") && p.ref.includes("untrusted"), p.id).toBe(false);
  });
});
