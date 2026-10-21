// The ten questions every topic must answer, shown together at the top so the mental model forms first.

import Link from "next/link";
import type { Topic } from "@/lib/latent/mastery/types";
import type { Connections } from "@/lib/latent/mastery/connections";
import { topicHref } from "@/lib/latent/mastery";

export function TenQuestions({ t, c }: { t: Topic; c: Connections }) {
  const first = t.shapes?.[0], last = t.shapes?.[t.shapes.length - 1];
  const rows: [string, React.ReactNode][] = [
    ["What is it?", t.intuition],
    ["Where is it?", t.where],
    ["What enters?", first ? <code className="font-mono text-[13.5px]">{first[0]}</code> : t.mechanism[0]],
    ["What operation happens?", first ? t.shapes!.map((s) => s[1]).join("; then ") : t.mechanism[1] ?? t.mechanism[0]],
    ["What comes out?", last ? <code className="font-mono text-[13.5px]">{last[2]}</code> : t.mechanism[t.mechanism.length - 1]],
    ["What shape changes?", first ? <span className="font-mono text-[13.5px]">{first[0]} → {last![2]}</span> : "Not a tensor operation: this is a system-level concept."],
    ["Why does it exist?", t.why],
    ["What breaks without it?", t.breaks],
    ["What is it confused with?", t.confusion],
    ["What does it connect to?", c.requires.length || c.usedBy.length ? (
      <span>{c.requires.length > 0 && <>Builds on {c.requires.map((r, i) => <span key={r.slug}>{i > 0 && ", "}<Link className="underline underline-offset-2" href={topicHref(r)}>{r.title}</Link></span>)}. </>}
        {c.usedBy.length > 0 && <>Used by {c.usedBy.slice(0, 4).map((r, i) => <span key={r.slug}>{i > 0 && ", "}<Link className="underline underline-offset-2" href={topicHref(r)}>{r.title}</Link></span>)}.</>}</span>
    ) : "A starting point of the curriculum."],
  ];
  return (
    <section aria-labelledby="ten-q" className="rounded-xl border-2 border-ink bg-paper p-4 sm:p-5">
      <h2 id="ten-q" className="mb-3 text-[12px] font-semibold tracking-wide text-ink-3 uppercase">The ten questions</h2>
      <dl className="grid gap-x-5 gap-y-2.5 sm:grid-cols-[13rem_1fr]">
        {rows.map(([q, a]) => (
          <div key={q} className="contents">
            <dt className="text-[14px] font-semibold text-ink">{q}</dt>
            <dd className="min-w-0 text-[14.5px] leading-relaxed text-ink-2">{a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
