// A generic frame for a lab lesson in twelve fixed steps. It renders text it is given and an interactive slot;
// it contains no security logic itself.

import Link from "next/link";
import type { LabText } from "@/lib/latent/security/labs/types";

export type { LabText };


const STEPS: [keyof LabText, string][] = [
  ["system", "System"], ["boundary", "Trust boundary"], ["assumption", "Assumption"], ["fixture", "Fixed synthetic fixture"],
  ["failure", "Failure"], ["rootCause", "Root cause"], ["impact", "Impact"], ["defense", "Defense"], ["retest", "Retest"],
  ["residual", "Residual risk"], ["frameworks", "Framework mapping"], ["fundamentals", "Connection to LLM fundamentals"],
];

export function LabLesson({ title, intro, text, children, topicLinks }: { title: string; intro: string; text: LabText; children: React.ReactNode; topicLinks: { href: string; label: string }[] }) {
  return (
    <article className="grid gap-6" aria-labelledby="lab-title">
      <header className="grid gap-2 border-b border-rule pb-5">
        <Link href="/latent/security/labs" className="text-[13px] text-ink-3 underline underline-offset-2">← Labs</Link>
        <h1 id="lab-title" className="font-serif text-[34px] leading-tight font-semibold text-ink">{title}</h1>
        <p className="max-w-3xl text-[16px] text-ink-2">{intro}</p>
        <p className="w-fit rounded-md border border-dashed border-rule-strong px-2.5 py-1 text-[12.5px] text-ink-3">Local, simulated and deterministic. Fixed synthetic fixtures, fake data, mock tools; nothing is executed or sent anywhere.</p>
      </header>
      <ol className="grid gap-2 md:grid-cols-2">
        {STEPS.slice(0, 4).map(([k, label], i) => <Step key={k} n={i + 1} label={label} body={text[k]} />)}
      </ol>
      <section aria-label="Try it" className="rounded-3xl border border-rule-strong bg-[#090c14] p-4 shadow-[0_0_0_1px_color-mix(in_oklab,var(--role-resid)_12%,transparent)] sm:p-6">{children}</section>
      <ol className="grid gap-2 md:grid-cols-2" start={5}>
        {STEPS.slice(4).map(([k, label], i) => <Step key={k} n={i + 5} label={label} body={text[k]} />)}
      </ol>
      <p className="text-[14px] text-ink-2">Related lessons: {topicLinks.map((l, i) => <span key={l.href}>{i > 0 && " · "}<Link href={l.href} className="underline underline-offset-2">{l.label}</Link></span>)}</p>
    </article>
  );
}

function Step({ n, label, body }: { n: number; label: string; body: string | string[] }) {
  return (
    <li className="rounded-2xl border border-rule bg-paper p-4">
      <div className="text-[12px] font-semibold tracking-wide text-ink-3 uppercase"><span className="num mr-1.5 text-ink-4">{n}</span>{label}</div>
      {Array.isArray(body) ? <ul className="mt-1 list-disc pl-5 text-[14.5px] text-ink-2">{body.map((b) => <li key={b}>{b}</li>)}</ul> : <p className="mt-1 text-[14.5px] leading-relaxed text-ink-2">{body}</p>}
    </li>
  );
}
