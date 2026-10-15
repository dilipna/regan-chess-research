"use client";

import { MODEL_META } from "@/lib/features";
import { fmtNum, fmtSigned, isNum } from "@/lib/format";
import type { Metrics, ScoreKey } from "@/lib/types";
import { cn } from "@/lib/utils";

/** ROC-AUC point estimates with 95% cluster-bootstrap CIs on a shared, data-driven axis. */
export function AucForest({
  metrics,
  keys,
  compact = false,
  showDelta = false,
}: {
  metrics: Metrics;
  keys: ScoreKey[];
  compact?: boolean;
  showDelta?: boolean;
}) {
  const rows = keys
    .map((k) => ({ k, c: metrics.experiments[k]?.classifier, label: metrics.experiments[k]?.label }))
    .filter((r) => r.c && isNum(r.c.roc_auc));
  if (!rows.length) return <p className="text-[13px] text-ink-3">—</p>;
  const vals = rows.flatMap((r) => [r.c!.roc_auc!, ...(r.c!.roc_auc_ci95 ?? [])]).filter(isNum);
  let lo = Math.floor((Math.min(...vals) - 0.01) * 50) / 50;
  let hi = Math.ceil((Math.max(...vals) + 0.01) * 50) / 50;
  lo = Math.max(0.5, lo);
  hi = Math.min(1, hi);
  if (hi - lo < 0.06) hi = Math.min(1, lo + 0.06);
  const ticks: number[] = [];
  const step = hi - lo > 0.2 ? 0.05 : 0.02;
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) ticks.push(Number(t.toFixed(3)));
  const pos = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;

  return (
    <div className={cn("text-[12.5px]", compact ? "space-y-1.5" : "space-y-2")}>
      {rows.map((r, i) => {
        const meta = MODEL_META[r.k];
        const ci = r.c!.roc_auc_ci95;
        const prev = i > 0 ? rows[i - 1].c!.roc_auc! : null;
        const d = prev !== null ? r.c!.roc_auc! - prev : null;
        return (
          <div
            key={r.k}
            className={cn(
              "grid items-center gap-3",
              showDelta ? "grid-cols-[minmax(0,10rem)_minmax(0,1fr)_3.5rem_3.75rem]" : "grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_3.5rem]",
            )}
          >
            <div className="min-w-0 truncate text-ink-2" title={r.label ?? meta.name}>
              <span className="num mr-1.5 text-ink-4">{meta.code}</span>
              {compact ? meta.short : r.label ?? meta.name}
            </div>
            <div className="relative h-5">
              <div className="absolute inset-x-0 top-1/2 h-px bg-rule" />
              {ticks.map((t) => (
                <div key={t} className="absolute top-1 bottom-1 w-px bg-rule" style={{ left: pos(t) }} />
              ))}
              {ci && (
                <div
                  className="absolute top-1/2 h-[2px] -translate-y-1/2 rounded"
                  style={{ left: pos(ci[0]), width: `calc(${pos(ci[1])} - ${pos(ci[0])})`, background: meta.color }}
                />
              )}
              <div
                className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper"
                style={{ left: pos(r.c!.roc_auc!), background: meta.color, boxSizing: "content-box" }}
              />
            </div>
            <div className="num text-right text-ink">{fmtNum(r.c!.roc_auc, 3)}</div>
            {showDelta && (
              <div className={cn("num text-right", d !== null && d < 0 ? "text-flag" : "text-ink-3")}>
                {d === null ? "" : fmtSigned(d, 3)}
              </div>
            )}
          </div>
        );
      })}
      <div
        className={cn(
          "grid gap-3",
          showDelta ? "grid-cols-[minmax(0,10rem)_minmax(0,1fr)_3.5rem_3.75rem]" : "grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_3.5rem]",
        )}
      >
        <div className="text-[10.5px] text-ink-4">ROC-AUC, 95% CI</div>
        <div className="relative h-4">
          {ticks.map((t) => (
            <span key={t} className="num absolute -translate-x-1/2 text-[10px] text-ink-4" style={{ left: pos(t) }}>
              {t.toFixed(2)}
            </span>
          ))}
        </div>
        <div />
        {showDelta && <div className="text-right text-[10.5px] text-ink-4">Δ step</div>}
      </div>
    </div>
  );
}
