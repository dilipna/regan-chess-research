import type { Metadata } from "next";
import Link from "next/link";
import { RevealOutline } from "@/components/latent/learn/primitives";
import { EXTRA_INTERVIEW } from "@/lib/latent/mastery/course";
import { TOPICS, hrefFor } from "@/lib/latent/mastery";

export const metadata: Metadata = { title: "Interview questions · LLM Mastery" };

const LEVEL_NAMES = ["", "Explain concepts", "Trace tensors", "Compare architectures", "Debug systems", "Threat-model an AI application", "Design defenses"];

export default function InterviewPage() {
  const all = [...TOPICS.map((t) => ({ q: t.interview.q, level: t.interview.level, outline: t.interview.outline, topic: t.slug })), ...EXTRA_INTERVIEW];
  return (
    <div className="grid gap-8">
      <header className="grid gap-2 border-b border-rule pb-6">
        <Link href="/latent/mastery" className="text-[13px] text-ink-3 underline underline-offset-2">← Mastery</Link>
        <h1 className="font-serif text-[36px] leading-tight font-semibold text-ink">Interview questions</h1>
        <p className="max-w-3xl text-[16px] text-ink-2">{all.length} questions in six levels. Answer aloud before revealing the outline; the outline lists what a strong answer covers, not a script.</p>
      </header>
      {[1, 2, 3, 4, 5, 6].map((lv) => (
        <section key={lv} aria-labelledby={`lv-${lv}`} className="grid gap-3">
          <h2 id={`lv-${lv}`} className="font-serif text-[24px] font-semibold text-ink">Level {lv}: {LEVEL_NAMES[lv]}</h2>
          <ul className="grid gap-3 lg:grid-cols-2">
            {all.filter((x) => x.level === lv).map((x) => (
              <li key={x.q} className="rounded-xl border border-rule bg-paper p-4"><RevealOutline q={x.q} outline={x.outline} /><Link href={hrefFor(x.topic)} className="mt-2 inline-block text-[13px] text-[var(--role-resid-ink)] underline underline-offset-2">Topic</Link></li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
