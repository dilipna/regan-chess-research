// The framework registry as reference cards, each mapped to curriculum topics.

import Link from "next/link";
import { FRAMEWORKS, FRAMEWORKS_CHECKED, FRAMEWORK_TOPICS, OWASP_AGENTIC_2026, OWASP_LLM_2025, OWASP_LLM_2026 } from "@/lib/latent/security/frameworks";
import { hrefFor, topicBySlug } from "@/lib/latent/mastery";
import { FrameworkReference } from "../learn/primitives";

export function FrameworkMap() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-3 lg:grid-cols-2">
        {FRAMEWORKS.map((f) => (
          <FrameworkReference key={f.name} name={f.name} org={f.source} version={f.version} url={f.url} verified={`Verified on ${FRAMEWORKS_CHECKED}`} covers={f.covers} note={f.note}
            maps={(FRAMEWORK_TOPICS[f.name] ?? []).map((s, i) => <span key={s}>{i > 0 && ", "}<Link href={hrefFor(s)} className="underline underline-offset-2">{topicBySlug(s)?.title}</Link></span>)} />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {([["OWASP LLM Top 10, 2025 edition", OWASP_LLM_2025], ["OWASP LLM Top 10, 2026 edition", OWASP_LLM_2026], ["OWASP Agentic Top 10, 2026 edition", OWASP_AGENTIC_2026]] as const).map(([t, list]) => (
          <section key={t} className="rounded-xl border border-rule bg-paper p-4">
            <h3 className="text-[15px] font-semibold text-ink">{t}</h3>
            <ol className="mt-2 grid gap-0.5 text-[13.5px] text-ink-2">{list.map((x) => <li key={x}>{x}</li>)}</ol>
          </section>
        ))}
      </div>
      <p className="text-[13px] text-ink-3">Names and editions verified on {FRAMEWORKS_CHECKED} against the organizations&apos; pages where reachable (see each card&apos;s note). Frameworks evolve: check the official source before relying on an edition. Lists are names only; read the official documents for definitions.</p>
    </div>
  );
}
