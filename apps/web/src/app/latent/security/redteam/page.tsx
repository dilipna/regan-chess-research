import type { Metadata } from "next";
import Link from "next/link";
import { REDTEAM_STEPS, REPORT_FIELDS } from "@/lib/latent/security/frameworks";

export const metadata: Metadata = { title: "Red-team process · Security Lab", description: "The fourteen steps of an AI red-team engagement and the fields of a finding report." };

export default function RedTeam() {
  return (
    <div className="grid gap-10">
      <header className="grid max-w-3xl gap-3">
        <Link href="/latent/security" className="text-[13px] text-ink-3 underline underline-offset-2">← Security</Link>
        <div className="text-[11.5px] font-medium tracking-[0.16em] text-ink-4 uppercase">Level 10 · red teaming</div>
        <h1 className="font-serif text-[38px] leading-tight font-semibold text-ink sm:text-[48px]">How an AI red-team engagement runs</h1>
        <p className="text-[16px] leading-relaxed text-ink-2">
          Fourteen steps from scope to retest, then a report another engineer can reproduce. Practise the measuring part in{" "}
          <Link href="/latent/security/labs/evals" className="text-[var(--role-resid-ink)] underline underline-offset-2">Lab 10</Link>, and only ever test systems you own or are authorized to test.
        </p>
      </header>

      <section aria-labelledby="steps">
        <h2 id="steps" className="font-serif text-[26px] font-semibold text-ink">The process</h2>
        <ol className="mt-5 grid gap-2.5 md:grid-cols-2">
          {REDTEAM_STEPS.map(([title, body], i) => (
            <li key={title} className="flex gap-4 rounded-2xl border border-rule bg-paper p-4">
              <span className="num flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-rule-strong font-mono text-[12.5px] text-ink">{i + 1}</span>
              <span>
                <span className="block text-[15px] font-medium text-ink">{title}</span>
                <span className="mt-1 block text-[13.5px] leading-relaxed text-ink-3">{body}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="report">
        <h2 id="report" className="font-serif text-[26px] font-semibold text-ink">A finding report</h2>
        <p className="mt-2 max-w-3xl text-[15px] text-ink-2">Every finding gets these fields, in this order. The regression test is what turns a one-off finding into lasting protection.</p>
        <ol className="mt-5 flex flex-wrap gap-2">
          {REPORT_FIELDS.map((f, i) => (
            <li key={f} className="rounded-full border border-rule bg-paper px-3.5 py-1.5 text-[13.5px] text-ink-2"><span className="num mr-1.5 font-mono text-[11.5px] text-ink-4">{i + 1}</span>{f}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
