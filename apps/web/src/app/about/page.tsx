import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, PageShell } from "@/components/site/page";
import { IndependentPrototype } from "@/components/story/independent";
import { LimitationsPanel } from "@/components/three/summary";

export const metadata: Metadata = { title: "About" };

const VIEWS: [string, string, string][] = [
  ["/present", "10-minute research demo", "The guided six-step presentation."],
  ["/research", "Research overview", "The earlier long-form overview: statistical modeling, Maia-3 and the LLM experiment on one featured position."],
  ["/compare", "Compare models", "One position, every legal move, original move vs controlled substitute."],
  ["/examples", "Where the models disagree", "Six rule-selected held-out decisions and two reserved Qwen slots."],
  ["/walkthrough", "Eight-step walkthrough", "The longer tour with evaluation and provenance detail."],
  ["/demo", "Hybrid demo", "The validated A/B/C/D hybrid experiment on prepared games."],
  ["/analyze", "Full game report", "Per-move report for a prepared game."],
  ["/results", "Results", "Every evaluation table with intervals."],
  ["/methodology", "Methodology", "Definitions, protocol, provenance, downloads."],
];

export default function AboutPage() {
  return (
    <PageShell>
      <PageHeader eyebrow="About" title="About MoveLens"
        lede="An independent research prototype that tests whether a general-purpose language model provides a move-preference signal that is not already captured by chess statistics or by a human-move model." />
      <section className="mb-12">
        <h2 className="mb-3 font-serif text-[22px] font-semibold text-ink">All views</h2>
        <ul className="divide-y divide-rule rounded-md border border-rule bg-paper">
          {VIEWS.map(([href, t, d]) => (
            <li key={href} className="grid gap-1 px-4 py-3 sm:grid-cols-[16rem_1fr]">
              <Link href={href} className="font-medium text-ink underline decoration-dotted underline-offset-2 hover:text-ink-2">{t}</Link>
              <span className="text-[14px] text-ink-2">{d}</span>
            </li>
          ))}
        </ul>
      </section>
      <IndependentPrototype />
      <h2 id="limitations" className="mt-12 mb-3 scroll-mt-20 font-serif text-[22px] font-semibold text-ink">Limitations</h2>
      <LimitationsPanel id="limitations-about" />
    </PageShell>
  );
}
