// Foundations vocabulary and the two core principles, as plain readable cards.

import { FOUNDATIONS, PRINCIPLES } from "@/lib/latent/security/principles";

export function CorePrinciples() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {PRINCIPLES.map((p) => (
        <section key={p.title} className="rounded-2xl border-2 border-ink bg-paper p-5">
          <h3 className="font-serif text-[22px] leading-tight font-semibold text-ink">{p.title}</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{p.body}</p>
        </section>
      ))}
    </div>
  );
}

export function FoundationsGlossary() {
  return (
    <dl className="grid gap-2 md:grid-cols-2">
      {FOUNDATIONS.map((f) => (
        <div key={f.term} className="rounded-xl border border-rule bg-paper p-3.5">
          <dt className="text-[15.5px] font-semibold text-ink">{f.term}</dt>
          <dd className="mt-1 text-[14.5px] text-ink-2">{f.def}</dd>
          <dd className="mt-1 text-[13.5px] text-ink-3"><span className="font-semibold">In an LLM system: </span>{f.llm}</dd>
        </div>
      ))}
    </dl>
  );
}
