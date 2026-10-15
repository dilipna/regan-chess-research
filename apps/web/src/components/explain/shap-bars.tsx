"use client";

import { featureText } from "@/lib/features";
import { fmtNum, fmtSigned, isNum } from "@/lib/format";
import type { ShapRow } from "@/lib/types";

function fmtValue(v: number | null, digits: number) {
  if (!isNum(v)) return "—";
  if (Number.isInteger(v)) return fmtNum(v, 0);
  return fmtNum(v, Math.abs(v) >= 100 ? 1 : digits);
}

/**
 * Diverging horizontal SHAP bars (log-odds contributions).
 * Positive = toward the controlled-assistance pattern (crimson); negative = toward the human pattern (ochre).
 */
export function ShapBars({ rows, limit = 12, valueDigits = 3 }: { rows: ShapRow[] | undefined; limit?: number; valueDigits?: number }) {
  const top = (rows ?? [])
    .filter((r) => isNum(r.contribution))
    .slice()
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, limit);
  if (!top.length) return <p className="text-[13px] text-ink-3">—</p>;
  const max = Math.max(...top.map((r) => Math.abs(r.contribution)), 1e-9);
  return (
    <div>
      <div className="mb-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-3 text-[10.5px] text-ink-4 max-sm:grid-cols-1">
        <span />
        <div className="flex justify-between">
          <span>← toward human pattern</span>
          <span>toward assisted pattern →</span>
        </div>
      </div>
      <ul className="space-y-1.5">
        {top.map((r) => {
          const w = (50 * Math.abs(r.contribution)) / max;
          const pos = r.contribution > 0;
          return (
            <li
              key={r.feature}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-3 text-[12px] max-sm:grid-cols-1 max-sm:gap-1"
            >
              <span className="min-w-0 text-ink-2" title={r.feature}>
                <span className="line-clamp-2 block leading-snug">{featureText(r.feature)}</span>
                <span className="num text-[10.5px] text-ink-4">value {fmtValue(r.value, valueDigits)}</span>
              </span>
              <span className="grid grid-cols-[minmax(0,1fr)_3.25rem] items-center gap-2">
                <span className="relative h-3">
                  <span className="absolute inset-y-[-3px] left-1/2 w-px bg-rule-strong" />
                  <span
                    className="absolute inset-y-0 rounded-[2px] transition-all duration-200"
                    style={{
                      left: pos ? "50%" : `${50 - w}%`,
                      width: `${w}%`,
                      background: pos ? "var(--flag)" : "var(--human)",
                    }}
                  />
                </span>
                <span className="num text-right text-ink-2">{fmtSigned(r.contribution, 2)}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
