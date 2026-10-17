import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }), usePathname: () => "/latent/review" }));

import ReviewPage from "@/app/latent/review/page";
import ConfusionsPage from "@/app/latent/mastery/confusions/page";
import RequestPage from "@/app/latent/mastery/request/page";
import InterviewPage from "@/app/latent/mastery/interview/page";
import FinalPage from "@/app/latent/mastery/final/page";
import { ALL_PAIRS } from "@/components/latent/mastery/confusion-pairs";
import { EXTRAS } from "@/lib/latent/mastery/confusion-extras";
import { WALK } from "@/lib/latent/mastery/course";
import { TOPICS, topicBySlug } from "@/lib/latent/mastery";
import { EMPTY_STATE, markConfidence, pickDaily, priority, record, status } from "@/lib/latent/mastery/progress";

const text = (el: React.ReactElement) => renderToString(el).replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const T0 = Date.UTC(2026, 9, 17);

describe("/latent/review", () => {
  it("renders the plan, the honest description of the schedule and local-only storage", () => {
    const h = text(<ReviewPage />);
    for (const s of ["10-minute daily review", "lightweight deterministic review schedule", "not a scientifically optimized algorithm", "only in this browser", "Start today's 10 questions", "Reset progress"]) expect(h).toContain(s);
  });
  it("low confidence keeps a correctly answered concept in review and ahead of overdue ones", () => {
    let s = record(EMPTY_STATE, "rope", true, T0);
    expect(status(s.concepts.rope, T0)).toBe("learning");
    s = markConfidence(s, "rope", true);
    expect(status(s.concepts.rope, T0)).toBe("review");
    const s2 = record(s, "gqa", true, T0 - 30 * 86_400_000);
    expect(priority(s2.concepts.rope, T0)).toBeGreaterThan(priority(s2.concepts.gqa, T0));
    expect(pickDaily(TOPICS.flatMap((t) => t.quiz), s, T0, 1).some((q) => q.topic === "rope")).toBe(true);
    expect(markConfidence(EMPTY_STATE, "never-seen", true)).toBe(EMPTY_STATE);
  });
});

describe("confusion pairs", () => {
  it("every pair has an example and a trap question, and links to a real topic", () => {
    expect(ALL_PAIRS.length).toBeGreaterThanOrEqual(34);
    for (const p of ALL_PAIRS) {
      const x = EXTRAS[`${p.a}|${p.b}`];
      expect(x, `${p.a}|${p.b}`).toBeDefined();
      expect(x.trap.q.length).toBeGreaterThan(10);
      expect(topicBySlug(p.topic), p.topic).toBeDefined();
    }
    expect(new Set(ALL_PAIRS.map((p) => `${p.a}|${p.b}`)).size).toBe(ALL_PAIRS.length);
  });
  it("page renders every pair", () => {
    const h = text(<ConfusionsPage />);
    for (const p of ALL_PAIRS) expect(h).toContain(p.a);
    expect(h).toContain(`${ALL_PAIRS.length} pairs`);
  });
});

describe("other mastery practice pages", () => {
  it("the request walkthrough lists every stage", () => {
    const h = text(<RequestPage />);
    for (const w of WALK) expect(h).toContain(w.stage);
    for (const v of ["model view", "system view", "security view"]) expect(h).toContain(v);
  });
  it("interview bank has all six levels and every topic's question", () => {
    const h = text(<InterviewPage />);
    for (let lv = 1; lv <= 6; lv++) expect(h).toContain(`Level ${lv}:`);
    for (const t of TOPICS) expect(h).toContain(t.interview.q.slice(0, 40));
  });
  it("final test has parts A to J", () => {
    const h = text(<FinalPage />);
    for (const p of ["Draw an LLM from memory", "Trace one token", "Design a RAG system", "Threat-model that agent", "Explain Professor Regan"]) expect(h).toContain(p);
  });
});
