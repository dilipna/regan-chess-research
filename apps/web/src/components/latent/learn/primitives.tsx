"use client";

// Domain-agnostic learning components. They render structured curriculum data and know nothing about any subject.

import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { STATUS_TEXT, type Status } from "@/lib/latent/mastery/progress";
import { STATUS_LABEL, type FactStatus, type QuizItem } from "@/lib/latent/mastery/types";

export function MasteryBadge({ s }: { s: Status }) {
  const tone = {
    "not-started": "border-rule-strong text-ink-3",
    learning: "border-[var(--role-resid)] bg-[var(--role-resid-soft)] text-[var(--role-resid-ink)]",
    review: "border-[var(--role-mlp)] bg-[var(--role-mlp-soft)] text-[var(--role-mlp-ink)]",
    mastered: "border-[var(--role-norm)] bg-[var(--role-norm-soft)] text-[var(--role-norm-ink)]",
  }[s];
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap uppercase", tone)}>{STATUS_TEXT[s]}</span>;
}

export function FactBadge({ s }: { s: FactStatus }) {
  const tone = { verified: "border-[var(--role-norm)] text-[var(--role-norm-ink)]", generic: "border-rule-strong text-ink-3", inferred: "border-[var(--role-mlp)] text-[var(--role-mlp-ink)]", unknown: "border-dashed border-rule-strong text-ink-4" }[s];
  return <span className={cn("inline-flex shrink-0 items-center rounded border px-1.5 py-[1px] text-[10.5px] font-semibold tracking-wide whitespace-nowrap uppercase", tone)}>{STATUS_LABEL[s]}</span>;
}

/** A labelled block of a lesson (one letter of the A to M format). */
export function ConceptCard({ k, title, children, className }: { k?: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-rule bg-paper p-4 sm:p-5", className)}>
      <h3 className="mb-2 flex items-baseline gap-2 text-[12px] font-semibold tracking-wide text-ink-3 uppercase">
        {k && <span className="num inline-flex h-5 min-w-5 items-center justify-center rounded bg-ink px-1 text-[11px] text-paper">{k}</span>}{title}
      </h3>
      <div className="text-[15px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

/** Multiple choice with an explanation for whichever option is chosen. */
export function QuizCard({ q, label, onAnswer }: { q: QuizItem; label?: string; onAnswer?: (correct: boolean) => void }) {
  const [pick, setPick] = useState<number | null>(null);
  const id = useId();
  const choose = (i: number) => { if (pick !== null) return; setPick(i); onAnswer?.(!!q.options[i].ok); };
  const picked = pick !== null ? q.options[pick] : null;
  return (
    <div className="rounded-xl border border-rule bg-paper p-4" role="group" aria-labelledby={id}>
      {label && <div className="mb-1 text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">{label}</div>}
      <p id={id} className="text-[16px] font-medium text-ink">{q.prompt}</p>
      <div className="mt-3 grid gap-2">
        {q.options.map((o, i) => (
          <button key={i} type="button" onClick={() => choose(i)} disabled={pick !== null} aria-pressed={pick === i}
            className={cn("rounded-lg border px-3 py-2 text-left text-[15px] text-ink transition-colors",
              pick === null ? "border-rule-strong hover:border-ink-3" : o.ok ? "border-[var(--role-norm)] bg-[var(--role-norm-soft)]" : pick === i ? "border-[var(--role-mlp)] bg-[var(--role-mlp-soft)]" : "border-rule opacity-60")}>
            {o.t}
          </button>
        ))}
      </div>
      {picked && (
        <div aria-live="polite" className="mt-3 grid gap-1.5 text-[14.5px] leading-relaxed">
          <p className={picked.ok ? "text-[var(--role-norm-ink)]" : "text-[var(--role-mlp-ink)]"}><strong>{picked.ok ? "Correct." : "Not quite."}</strong> {picked.why}</p>
          {!picked.ok && <p className="text-ink-2"><strong className="text-ink">Correct answer:</strong> {q.options.find((o) => o.ok)?.t}. {q.options.find((o) => o.ok)?.why}</p>}
        </div>
      )}
    </div>
  );
}

/** Explain it in your own words, then check it against the points a complete explanation covers. */
export function TeachBackPrompt({ prompt, points, saved, onSave }: { prompt: string; points: string[]; saved?: string; onSave?: (text: string, covered: number) => void }) {
  const [text, setText] = useState(saved ?? "");
  const [shown, setShown] = useState(false);
  const [ticks, setTicks] = useState<boolean[]>(points.map(() => false));
  const id = useId();
  const covered = ticks.filter(Boolean).length;
  return (
    <div className="grid gap-3">
      <label htmlFor={id} className="text-[15px] font-medium text-ink">{prompt}</label>
      <textarea id={id} value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="Write your explanation without looking back. Saved only in this browser."
        className="w-full rounded-lg border border-rule-strong bg-paper p-3 text-[15px] leading-relaxed text-ink" />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setShown(true)} disabled={text.trim().length < 20} className="rounded-lg bg-ink px-4 py-2 text-[14px] font-medium text-paper disabled:opacity-40">Check against the rubric</button>
        {shown && <button type="button" onClick={() => onSave?.(text, covered)} className="rounded-lg border border-rule-strong px-4 py-2 text-[14px] text-ink">Save ({covered}/{points.length} covered)</button>}
      </div>
      {shown && (
        <fieldset className="rounded-lg bg-paper-2/60 p-3">
          <legend className="px-1 text-[12px] font-semibold tracking-wide text-ink-3 uppercase">Did your explanation mention…</legend>
          <ul className="grid gap-1.5">
            {points.map((p, i) => (
              <li key={p}><label className="flex items-start gap-2 text-[14.5px] text-ink-2">
                <input type="checkbox" checked={ticks[i]} onChange={() => setTicks(ticks.map((t, j) => (j === i ? !t : t)))} className="mt-1" />{p}
              </label></li>
            ))}
          </ul>
          <p className="mt-2 text-[13px] text-ink-3">You tick the boxes yourself; nothing grades your text automatically. Anything unticked is what to review.</p>
        </fieldset>
      )}
    </div>
  );
}

/** Show an outline only after the learner has tried to answer. */
export function RevealOutline({ q, outline }: { q: string; outline: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-2">
      <p className="text-[15.5px] font-medium text-ink">{q}</p>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-fit rounded-lg border border-rule-strong px-3 py-1.5 text-[13.5px] text-ink-2">{open ? "Hide" : "Answer it aloud first, then show"} the outline</button>
      {open && <ul className="list-disc space-y-1 pl-5 text-[14.5px] text-ink-2">{outline.map((o) => <li key={o}>{o}</li>)}</ul>}
    </div>
  );
}

export function ConfusionPairCard({ a, b, keyDiff, rows, href, example, trap }: { a: string; b: string; keyDiff: string; rows: [string, string, string][]; href?: string; example?: string; trap?: { q: string; a: string } }) {
  const [show, setShow] = useState(false);
  const [trapOpen, setTrapOpen] = useState(false);
  return (
    <article className="rounded-xl border border-rule bg-paper p-4">
      <h3 className="text-[17px] font-semibold text-ink">{a} <span className="text-ink-4">vs</span> {b}</h3>
      {!show ? (
        <button type="button" onClick={() => setShow(true)} className="mt-2 rounded-lg border border-rule-strong px-3 py-1.5 text-[13.5px] text-ink-2">Say the difference aloud, then reveal</button>
      ) : (
        <div className="mt-2 grid gap-2">
          <p className="text-[15px] text-ink">{keyDiff}</p>
          <div className="scroll-x">
            <table className="w-full min-w-[420px] text-left text-[13.5px]">
              <thead><tr className="text-ink-3"><th className="py-1 pr-3 font-medium" /><th className="py-1 pr-3 font-medium">{a}</th><th className="py-1 font-medium">{b}</th></tr></thead>
              <tbody>{rows.map(([d, x, y]) => <tr key={d} className="border-t border-rule"><td className="py-1 pr-3 text-ink-3">{d}</td><td className="py-1 pr-3 text-ink">{x}</td><td className="py-1 text-ink">{y}</td></tr>)}</tbody>
            </table>
          </div>
          {example && <p className="text-[14px] text-ink-2"><strong className="text-ink">Example: </strong>{example}</p>}
          {trap && (
            <div className="rounded-lg bg-paper-2/60 p-2.5 text-[14px]">
              <p className="text-ink"><strong>Trap question: </strong>{trap.q}</p>
              {trapOpen ? <p className="mt-1 text-ink-2">{trap.a}</p> : <button type="button" onClick={() => setTrapOpen(true)} className="mt-1 text-[13px] text-ink-3 underline underline-offset-2">Answer, then reveal</button>}
            </div>
          )}
          {href && <a href={href} className="w-fit text-[13.5px] text-[var(--role-resid-ink)] underline underline-offset-2">Revisit the topic →</a>}
        </div>
      )}
    </article>
  );
}

export function FrameworkReference({ name, org, version, url, verified, covers, maps, note }: { name: string; org: string; version: string; url: string; verified: string; covers: string; maps: React.ReactNode; note?: string }) {
  return (
    <article className="grid gap-1.5 rounded-xl border border-rule bg-paper p-4 text-[14.5px] text-ink-2">
      <h3 className="text-[16px] font-semibold text-ink">{name}</h3>
      <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1">
        <dt className="text-ink-3">Organization</dt><dd>{org}</dd>
        <dt className="text-ink-3">Version / date</dt><dd>{version}</dd>
        <dt className="text-ink-3">Verified</dt><dd>{verified}</dd>
        <dt className="text-ink-3">Scope</dt><dd>{covers}</dd>
        <dt className="text-ink-3">In LatentLens</dt><dd>{maps}</dd>
      </dl>
      {note && <p className="text-[13px] text-ink-3">{note}</p>}
      <a href={url} target="_blank" rel="noopener noreferrer" className="w-fit text-[13.5px] text-[var(--role-resid-ink)] underline underline-offset-2">Official source</a>
    </article>
  );
}

/** A numbered list of observations from a run, each tagged with what produced it. */
export function LabObservation({ items }: { items: { tone: "neutral" | "bad" | "good" | "warn"; text: string; tag?: string }[] }) {
  const tone = { neutral: "border-rule text-ink-2", bad: "border-[var(--role-mlp)] bg-[var(--role-mlp-soft)] text-ink", good: "border-[var(--role-norm)] bg-[var(--role-norm-soft)] text-ink", warn: "border-dashed border-[var(--role-mlp)] text-ink" };
  return (
    <ol className="grid gap-1.5">
      {items.map((it, i) => (
        <li key={i} className={cn("flex flex-wrap items-baseline gap-x-2 rounded-lg border px-3 py-1.5 text-[14px]", tone[it.tone])}>
          <span className="num text-[12px] text-ink-4">{i + 1}</span><span className="min-w-0 flex-1">{it.text}</span>{it.tag && <span className="rounded bg-paper px-1.5 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{it.tag}</span>}
        </li>
      ))}
    </ol>
  );
}

/** Side-by-side numbers for several configurations. */
export function DefenseComparison({ rows, caption }: { rows: { label: string; values: [string, string][]; highlight?: boolean }[]; caption: string }) {
  const heads = rows[0]?.values.map(([h]) => h) ?? [];
  return (
    <figure className="scroll-x">
      <table className="w-full min-w-[520px] text-left text-[14px]">
        <thead><tr className="text-ink-3"><th className="py-1.5 pr-3 font-medium">Configuration</th>{heads.map((h) => <th key={h} className="py-1.5 pr-3 font-medium">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r) => <tr key={r.label} className={cn("border-t border-rule", r.highlight && "bg-[var(--role-norm-soft)]")}><td className="py-1.5 pr-3 text-ink">{r.label}</td>{r.values.map(([h, v]) => <td key={h} className="num py-1.5 pr-3 text-ink">{v}</td>)}</tr>)}</tbody>
      </table>
      <figcaption className="mt-2 text-[13px] text-ink-3">{caption}</figcaption>
    </figure>
  );
}
