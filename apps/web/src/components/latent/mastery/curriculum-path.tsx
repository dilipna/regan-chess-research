"use client";

// The curriculum as a path of levels; each level opens to show its topics and your local status for each.

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { LEVELS, topicHref, topicsAt } from "@/lib/latent/mastery";
import { status } from "@/lib/latent/mastery/progress";
import { MasteryBadge } from "../learn/primitives";
import { PAGE_NOW, useLearn } from "../learn/progress-hook";

export function CurriculumPath({ levels }: { levels?: number[] }) {
  const st = useLearn();
  const shown = LEVELS.filter((l) => !levels || levels.includes(l.n));
  const [open, setOpen] = useState<number | null>(shown.find((l) => topicsAt(l.n).length)?.n ?? null);
  return (
    <ol className="grid gap-2">
      {shown.map((l) => {
        const ts = topicsAt(l.n);
        const sts = ts.map((t) => status(st.concepts[t.slug], PAGE_NOW));
        const done = sts.filter((s) => s === "mastered").length, review = sts.filter((s) => s === "review").length, started = sts.filter((s) => s !== "not-started").length;
        const isOpen = open === l.n;
        return (
          <li key={l.n} className={cn("rounded-xl border bg-paper", isOpen ? "border-ink" : "border-rule")}>
            <div className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
              <span className="num inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-[14px] text-paper">{l.n}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[16px] font-semibold text-ink">{l.title}</div>
                <div className="text-[13.5px] text-ink-3">{l.goal}{l.prereqs.length > 0 && ` · after level ${l.prereqs.join(" and ")}`}</div>
              </div>
              {ts.length > 0 ? (
                <>
                  <span className="text-[13px] text-ink-3">{done}/{ts.length} mastered{review > 0 && ` · ${review} to review`}{started === 0 && " · not started"}</span>
                  <button type="button" onClick={() => setOpen(isOpen ? null : l.n)} aria-expanded={isOpen} className="rounded-lg border border-rule-strong px-3 py-1.5 text-[13.5px] text-ink">{isOpen ? "Hide" : "Show"} {ts.length} topics</button>
                </>
              ) : l.href && <Link href={l.href} className="rounded-lg border border-rule-strong px-3 py-1.5 text-[13.5px] text-ink">Open</Link>}
            </div>
            {isOpen && ts.length > 0 && (
              <ol className="grid gap-1 border-t border-rule p-2 sm:grid-cols-2">
                {ts.map((t, i) => (
                  <li key={t.slug}><Link href={topicHref(t)} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[14.5px] text-ink hover:bg-paper-2">
                    <span className="min-w-0"><span className="num text-ink-4">{l.n}.{i + 1}</span> {t.title}</span><MasteryBadge s={sts[i]} />
                  </Link></li>
                ))}
              </ol>
            )}
          </li>
        );
      })}
    </ol>
  );
}
