"use client";

import { MODEL_META } from "@/lib/features";
import { fmtNum, fmtPct, isNum } from "@/lib/format";
import type { Metrics } from "@/lib/types";
import { cn } from "@/lib/utils";

const sg = (x: number) => (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(3);

/** Paired cluster-bootstrap differences in ROC-AUC with a zero reference line. */
export function PairedDiffs({ metrics }: { metrics: Metrics }) {
  const pb = metrics.paired_auc_bootstrap;
  if (!pb?.comparisons?.length)
    return (
      <p className="text-[13px] text-ink-3">
        Paired differences were not tested in this export: only the individual intervals are available, and their overlap is a
        visual comparison, not a test.
      </p>
    );
  const rows = pb.comparisons;
  const vals = rows.flatMap((r) => [r.delta, ...r.ci95]).filter(isNum);
  const lo = Math.min(0, ...vals) - 0.005, hi = Math.max(0, ...vals) + 0.005;
  const pos = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / 0.02) * 0.02; t <= hi + 1e-9; t += 0.02) ticks.push(Number(t.toFixed(2)));
  return (
    <div className="relative">
      <div className="space-y-2 text-[12.5px]">
        {rows.map((r) => {
          const excl = r.ci95[0] > 0 || r.ci95[1] < 0;
          return (
            <div key={r.from + r.to} className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_minmax(0,9.5rem)] items-center gap-3 max-sm:grid-cols-[minmax(0,5.5rem)_minmax(0,1fr)_minmax(0,7.5rem)]">
              <div className="num text-ink-2">
                {MODEL_META[r.from].code} → {MODEL_META[r.to].code}
              </div>
              <div className="relative h-5" aria-hidden>
                <div className="absolute inset-x-0 top-1/2 h-px bg-rule" />
                <div className="absolute top-0 bottom-0 w-px bg-ink-3" style={{ left: pos(0) }} />
                <div
                  className="absolute top-1/2 h-[2px] -translate-y-1/2 rounded"
                  style={{ left: pos(r.ci95[0]), width: `calc(${pos(r.ci95[1])} - ${pos(r.ci95[0])})`, background: MODEL_META[r.to].color }}
                />
                <div
                  className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper"
                  style={{ left: pos(r.delta), background: MODEL_META[r.to].color, boxSizing: "content-box" }}
                />
              </div>
              <div className={cn("num text-right", excl ? "text-ink" : "text-ink-3")}>
                {sg(r.delta)} <span className="text-[11px] text-ink-3">[{sg(r.ci95[0])}, {sg(r.ci95[1])}]</span>
              </div>
            </div>
          );
        })}
        <div className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_minmax(0,9.5rem)] gap-3 max-sm:grid-cols-[minmax(0,5.5rem)_minmax(0,1fr)_minmax(0,7.5rem)]">
          <div className="text-[10.5px] text-ink-4">Δ ROC-AUC</div>
          <div className="relative h-4">
            {ticks.map((t) => (
              <span key={t} className="num absolute -translate-x-1/2 text-[10px] text-ink-4" style={{ left: pos(t) }}>
                {t === 0 ? "0" : t.toFixed(2)}
              </span>
            ))}
          </div>
          <div className="text-right text-[10.5px] text-ink-4">paired 95% CI</div>
        </div>
      </div>
      <div className="sr-only">
      <table>
        <caption>Paired bootstrap differences in ROC-AUC</caption>
        <thead>
          <tr>
            <th>Comparison</th>
            <th>Difference</th>
            <th>95% interval</th>
            <th>Share of resamples ≤ 0</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.from + r.to}>
              <td>
                {MODEL_META[r.from].name} to {MODEL_META[r.to].name}
              </td>
              <td>{fmtNum(r.delta, 4)}</td>
              <td>
                {fmtNum(r.ci95[0], 4)} to {fmtNum(r.ci95[1], 4)}
              </td>
              <td>{fmtPct(r.share_le_0, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
