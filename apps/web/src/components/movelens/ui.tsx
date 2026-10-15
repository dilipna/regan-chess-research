"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Section header in the style of a chess book: the number sits in a dark board square, a checkered strip divides sections. */
export function SectionShell({ id, n, title, sub, children, kicker }: { id: string; n: number; title: string; sub: string; children: React.ReactNode; kicker?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-16">
      <div className="checker-rule" aria-hidden />
      <div className="mx-auto max-w-[1180px] px-4 py-14 sm:px-6 sm:py-20">
        <div className="flex items-start gap-4 sm:gap-6">
          <span aria-hidden className="num mt-1 flex size-12 shrink-0 items-center justify-center rounded-[3px] bg-[var(--board-dark)] font-serif text-[30px] leading-none font-bold text-paper shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)] sm:size-14 sm:text-[34px]">{n}</span>
          <div className="min-w-0">
            {kicker && <div className="text-[11.5px] font-semibold tracking-[0.12em] text-ink-3 uppercase">{kicker}</div>}
            <h2 id={`${id}-title`} className="font-serif text-[36px] leading-[1.02] font-bold tracking-tight text-ink sm:text-[50px]">
              <span className="sr-only">{n}. </span>{title}
            </h2>
            <p className="mt-3 max-w-3xl font-serif text-[20px] leading-snug text-ink-2 italic sm:text-[23px]">{sub}</p>
          </div>
        </div>
        <div className="mt-10 sm:mt-12">{children}</div>
      </div>
    </section>
  );
}

export function Details({ label = "Show technical details", children, className }: { label?: string; children: React.ReactNode; className?: string }) {
  return (
    <details className={cn("group mt-4", className)}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium text-ink-2 underline decoration-rule-strong underline-offset-4 select-none hover:text-ink [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />{label}
      </summary>
      <div className="mt-3 rounded-md border border-rule bg-paper-2 p-4 text-[13px] leading-relaxed text-ink-2">{children}</div>
    </details>
  );
}

export function KV({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(9rem,auto)_1fr] gap-x-4 gap-y-1">
      {rows.map(([k, v]) => (<div key={k} className="contents"><dt className="text-ink-3">{k}</dt><dd className="num min-w-0 break-words text-ink">{v}</dd></div>))}
    </dl>
  );
}

/** Small data table used as the accessible "table view" of every chart. */
export function DataTable({ head, rows, caption }: { head: string[]; rows: (string | number)[][]; caption: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12.5px]">
        <caption className="sr-only">{caption}</caption>
        <thead><tr className="border-b border-rule-strong text-left text-ink-3">{head.map((h) => <th key={h} scope="col" className="py-1 pr-4 font-medium">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-rule last:border-0">{r.map((c, j) => <td key={j} className="num py-1 pr-4 text-ink">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

/** A question-and-answer panel: question in the chess-book serif, the evidence, then a one-line answer. */
export function CheckPanel({ q, answer, children, source }: { q: string; answer: React.ReactNode; children: React.ReactNode; source: string }) {
  return (
    <article className="flex min-w-0 flex-col rounded-lg border border-rule-strong bg-paper p-5 sm:p-6">
      <h3 className="font-serif text-[23px] leading-snug font-bold text-ink">{q}</h3>
      <div className="mt-4 flex-1">{children}</div>
      <p className="mt-4 border-l-[3px] border-ink pl-3 text-[14.5px] leading-relaxed text-ink">{answer}</p>
      <p className="mt-2 text-[11.5px] text-ink-3">Source: {source}</p>
    </article>
  );
}
