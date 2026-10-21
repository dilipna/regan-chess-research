"use client";

// "Your route": every stage from Foundations to practice, what is done, and what comes next.

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { STATUS_TEXT, status, type Status } from "@/lib/latent/mastery/progress";
import { EMPTY_ROUTE, STAGES, readRoute, resetRoute, subscribeRoute, toggle, writeRoute, type RouteItem, type RouteState } from "@/lib/latent/route-progress";
import { PAGE_NOW, useLearn } from "../learn/progress-hook";

export const useRoute = (): RouteState => useSyncExternalStore(subscribeRoute, readRoute, () => EMPTY_ROUTE);

/** A small toggle for the things only you can confirm. */
export function MarkDone({ id, label = "Mark as done", className }: { id: string; label?: string; className?: string }) {
  const done = !!useRoute().done[id];
  return (
    <button type="button" aria-pressed={done} onClick={() => writeRoute(toggle(readRoute(), id, Date.now()))}
      className={cn("inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
        done ? "border-[var(--role-norm)] bg-[var(--role-norm-soft)] text-ink" : "border-rule-strong text-ink-2 hover:border-ink-4 hover:text-ink", className)}>
      <span aria-hidden className={cn("flex h-4 w-4 items-center justify-center rounded-full border text-[10px]", done ? "border-[var(--role-norm)] bg-[var(--role-norm)] text-[var(--on-role)]" : "border-ink-4")}>{done ? "✓" : ""}</span>
      {done ? "Done" : label}
    </button>
  );
}

const STATUS_DOT: Record<Status, string> = {
  "not-started": "border-ink-4", learning: "border-[var(--role-resid)] bg-[var(--role-resid-soft)]",
  review: "border-[var(--role-mlp)] bg-[var(--role-mlp-soft)]", mastered: "border-[var(--role-norm)] bg-[var(--role-norm)]",
};

export function RouteMap() {
  const route = useRoute();
  const learn = useLearn();
  const topicStatus = (slug: string) => status(learn.concepts[slug], PAGE_NOW);
  const isDone = (it: RouteItem) => (it.kind === "topic" ? topicStatus(it.topic!) === "mastered" : !!route.done[it.id]);
  const all = STAGES.flatMap((s) => s.items);
  const doneCount = all.filter(isDone).length;
  const next = STAGES.flatMap((s) => s.items.map((it) => ({ it, stage: s }))).find(({ it }) => !isDone(it));

  return (
    <div className="grid gap-10">
      <header className="grid max-w-3xl gap-4">
        <div className="text-[11.5px] font-medium tracking-[0.16em] text-ink-4 uppercase">Your route</div>
        <h1 className="font-serif text-[40px] leading-[1.05] font-semibold text-ink sm:text-[52px]">From zero to red team, one step at a time.</h1>
        <p className="text-[15.5px] leading-relaxed text-ink-2">
          Topics count as done when the review system rates them mastered (answered right on three spaced reviews). Everything else
          (a module, a Build step passing its checks on your machine, a lab) you mark yourself. All of it is stored only in this browser.
        </p>
        <div className="grid gap-2">
          <div className="flex items-baseline justify-between text-[13px] text-ink-3"><span>Overall</span><span className="num font-mono text-ink">{doneCount} / {all.length}</span></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-paper-3">
            <div className="h-full rounded-full bg-gradient-to-r from-[var(--role-resid)] via-[var(--role-attn)] to-[var(--role-norm)] transition-[width] duration-500" style={{ width: `${(doneCount / all.length) * 100}%` }} />
          </div>
        </div>
        {next && (
          <Link href={next.it.href} className="group flex items-center justify-between gap-4 rounded-2xl border border-[var(--role-resid)] bg-[var(--role-resid-soft)] px-5 py-4">
            <span>
              <span className="block text-[11px] font-medium tracking-[0.14em] text-[var(--role-resid-ink)] uppercase">Next up · {next.stage.title}</span>
              <span className="mt-1 block text-[16px] text-ink">{next.it.label}</span>
            </span>
            <span aria-hidden className="text-ink-3 transition-transform group-hover:translate-x-1">→</span>
          </Link>
        )}
      </header>

      <ol className="grid gap-4">
        {STAGES.map((s) => {
          const d = s.items.filter(isDone).length;
          return (
            <li key={s.n} className="rounded-3xl border border-rule bg-paper p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className={cn("num flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 font-mono text-[13px]", d === s.items.length ? "border-[var(--role-norm)] text-[var(--role-norm-ink)]" : "border-rule-strong text-ink")}>{s.n}</span>
                  <div>
                    <Link href={s.href} className="font-serif text-[22px] font-semibold text-ink hover:underline">{s.title}</Link>
                    <p className="mt-0.5 text-[13px] text-ink-3">{s.line}</p>
                  </div>
                </div>
                <span className="num font-mono text-[13px] text-ink-2">{d} / {s.items.length}</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper-3"><div className="h-full rounded-full bg-[var(--role-norm)] transition-[width] duration-500" style={{ width: `${(d / s.items.length) * 100}%` }} /></div>
              <ul className="mt-4 grid gap-1 sm:grid-cols-2">
                {s.items.map((it) => (
                  <li key={it.id} className="flex items-center gap-2.5 rounded-lg px-1 py-1">
                    {it.kind === "topic" ? (
                      <span title={STATUS_TEXT[topicStatus(it.topic!)]} aria-label={STATUS_TEXT[topicStatus(it.topic!)]} className={cn("h-3.5 w-3.5 shrink-0 rounded-full border-2", STATUS_DOT[topicStatus(it.topic!)])} />
                    ) : (
                      <button type="button" aria-pressed={!!route.done[it.id]} aria-label={`Mark ${it.label} as ${route.done[it.id] ? "not done" : "done"}`}
                        onClick={() => writeRoute(toggle(readRoute(), it.id, Date.now()))}
                        className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]", route.done[it.id] ? "border-[var(--role-norm)] bg-[var(--role-norm)] text-[var(--on-role)]" : "border-ink-4 hover:border-ink-2")}>
                        {route.done[it.id] ? "✓" : ""}
                      </button>
                    )}
                    <Link href={it.href} className={cn("min-w-0 truncate text-[13.5px] hover:underline", isDone(it) ? "text-ink-3" : "text-ink-2")}>{it.label}</Link>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-4 text-[12.5px] text-ink-4">
        <span className="flex items-center gap-1.5"><span className={cn("h-3 w-3 rounded-full border-2", STATUS_DOT["not-started"])} />not started</span>
        <span className="flex items-center gap-1.5"><span className={cn("h-3 w-3 rounded-full border-2", STATUS_DOT.learning)} />learning</span>
        <span className="flex items-center gap-1.5"><span className={cn("h-3 w-3 rounded-full border-2", STATUS_DOT.review)} />due for review</span>
        <span className="flex items-center gap-1.5"><span className={cn("h-3 w-3 rounded-full border-2", STATUS_DOT.mastered)} />mastered</span>
        <button type="button" onClick={() => { if (window.confirm("Clear every checkmark on this page? Quiz progress is kept.")) resetRoute(); }}
          className="ml-auto rounded-full border border-rule-strong px-3 py-1 text-ink-3 hover:text-ink">Clear checkmarks</button>
      </div>
    </div>
  );
}
