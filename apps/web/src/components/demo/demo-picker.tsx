"use client";

import { STRATEGY_TEXT } from "@/lib/features";
import { fmtPct } from "@/lib/format";
import type { DemoIndexEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Tab-like selector for the three precomputed demos (all labels/values from demos.json). */
export function DemoPicker({
  demos,
  value,
  onChange,
}: {
  demos: DemoIndexEntry[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" aria-label="Prepared study" className="grid gap-2 sm:grid-cols-3">
      {demos.map((d) => {
        const active = d.id === value;
        const strat = STRATEGY_TEXT[d.strategy]?.name ?? d.strategy;
        return (
          <button
            key={d.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(d.id)}
            className={cn(
              "group rounded-md border px-4 py-3 text-left transition-colors duration-200",
              active ? "border-ink bg-paper" : "border-rule bg-paper-2/50 hover:border-rule-strong hover:bg-paper",
            )}
          >
            <div className={cn("text-[14px] font-medium", active ? "text-ink" : "text-ink-2")}>{d.title}</div>
            <div className="num mt-1 text-[11.5px] text-ink-3">
              {d.strategy === "none"
                ? `0% substituted · original moves · ${d.n_decisions} decisions`
                : `${strat} · nominal ${fmtPct(d.level, 0)} · realized ${fmtPct(d.realized_alpha, 1)} substituted`}
            </div>
          </button>
        );
      })}
    </div>
  );
}
