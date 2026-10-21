// The CONNECTIONS panel: what a topic requires, what depends on it, and where it shows up in security and research.

import Link from "next/link";
import type { Connections } from "@/lib/latent/mastery/connections";
import { topicHref } from "@/lib/latent/mastery";
import type { Topic } from "@/lib/latent/mastery/types";

function List({ items }: { items: Topic[] }) {
  if (!items.length) return <span className="text-ink-4">none</span>;
  return <>{items.map((t, i) => <span key={t.slug}>{i > 0 && " · "}<Link href={topicHref(t)} className="underline underline-offset-2">{t.title}</Link></span>)}</>;
}

export function TopicConnections({ c, track }: { c: Connections; track: "mastery" | "security" }) {
  return (
    <section aria-labelledby="conn" className="rounded-xl border border-rule bg-paper-2/60 p-4 sm:p-5">
      <h2 id="conn" className="mb-3 text-[12px] font-semibold tracking-wide text-ink-3 uppercase">Connections</h2>
      <dl className="grid gap-x-5 gap-y-2 text-[14.5px] text-ink-2 sm:grid-cols-[11rem_1fr]">
        <dt className="font-semibold text-ink">Requires</dt><dd><List items={c.requires} /></dd>
        <dt className="font-semibold text-ink">Used by</dt><dd><List items={c.usedBy} /></dd>
        <dt className="font-semibold text-ink">{track === "mastery" ? "Security implications" : "Builds on mechanism"}</dt><dd><List items={c.security} /></dd>
        <dt className="font-semibold text-ink">Research</dt>
        <dd>{c.research.length ? c.research.map((r, i) => <span key={r.href + r.label}>{i > 0 && " · "}<Link href={r.href} className="underline underline-offset-2">{r.label}</Link></span>) : <span className="text-ink-4">none</span>}</dd>
        {c.crossLinks.length > 0 && <><dt className="font-semibold text-ink">Across the system</dt><dd><ul className="list-disc space-y-0.5 pl-5">{c.crossLinks.map((x) => <li key={x}>{x}</li>)}</ul></dd></>}
      </dl>
    </section>
  );
}
