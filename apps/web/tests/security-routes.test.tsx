import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }), usePathname: () => "/latent/security", notFound: () => { throw new Error("NOT_FOUND"); } }));

import SecurityHome from "@/app/latent/security/page";
import FrameworksPage from "@/app/latent/security/frameworks/page";
import SecurityTopicPage, { generateStaticParams } from "@/app/latent/security/learn/[topic]/page";
import { MasteryTopic } from "@/components/latent/mastery/mastery-topic";
import { TOPICS, topicBySlug } from "@/lib/latent/mastery";
import { FRAMEWORKS, FRAMEWORK_TOPICS } from "@/lib/latent/security/frameworks";
import { FOUNDATIONS } from "@/lib/latent/security/principles";

const text = (el: React.ReactElement) => renderToString(el).replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const sec = TOPICS.filter((t) => t.track === "security");

describe("/latent/security", () => {
  it("opens with the system, foundations and the two principles before any attack topic", () => {
    const h = text(<SecurityHome />);
    expect(h).toContain("Security begins with the system, not the prompt.");
    for (const f of FOUNDATIONS) expect(h).toContain(f.term);
    expect(h).toContain("The model proposes. The system authorizes.");
    expect(h).toContain("Security does not mean truthfulness.");
    expect(h.indexOf("Foundations first")).toBeLessThan(h.indexOf("The path"));
  });
  it("level 7 starts with foundations, not prompt injection", () => {
    expect(sec[0].slug).toBe("security-foundations");
    expect(sec.find((t) => t.slug === "prompt-injection")!.level).toBeGreaterThan(7);
  });
  it("frameworks page shows every framework with a dated verification and valid topic mapping", () => {
    const h = text(<FrameworksPage />);
    for (const f of FRAMEWORKS) { expect(h).toContain(f.name); expect(FRAMEWORK_TOPICS[f.name], f.name).toBeDefined(); for (const s of FRAMEWORK_TOPICS[f.name]) expect(topicBySlug(s), s).toBeDefined(); }
    expect(h).toContain("Verified on 2026-10-17");
    expect(h).not.toMatch(/\blatest edition\b/i);
  });
  it("every security topic renders with the LLM-property section and connections", () => {
    expect(generateStaticParams().map((p) => p.topic).sort()).toEqual(sec.map((t) => t.slug).sort());
    for (const t of sec) {
      const h = text(<MasteryTopic slug={t.slug} defaultOpen />);
      for (const s of ["What property of LLMs makes this possible?", "Connections", "Teach it back", t.title]) expect(h, `${t.slug}: ${s}`).toContain(s);
    }
  });
  it("rejects mastery slugs on the security route", async () => {
    await expect(SecurityTopicPage({ params: Promise.resolve({ topic: "rmsnorm" }) })).rejects.toThrow("NOT_FOUND");
  });
});
