import { isNum } from "@/lib/format";

export interface CIRow {
  label: string;
  sub?: string;
  est?: number | null;
  lo?: number | null;
  hi?: number | null;
  color?: string;
  pending?: string; // text shown instead of a mark when the value does not exist yet
  emphasis?: boolean;
}

/** Plain dot-and-whisker plot (estimate with 95% interval). Pending rows draw no mark, only text. */
export function CIPlot({ rows, min, max, ticks, zero, label, digits = 3, signed = false }: {
  rows: CIRow[]; min: number; max: number; ticks: number[]; zero?: boolean; label: string; digits?: number; signed?: boolean;
}) {
  const W = 760, left = 250, right = 190, rowH = 44, top = 8, bottom = 34;
  const H = top + rows.length * rowH + bottom;
  const x = (v: number) => left + ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * (W - left - right);
  const f = (v: number) => (signed && v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(digits);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-auto w-full text-ink">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={top} y2={H - bottom} stroke="var(--rule)" strokeWidth="1" />
          <text x={x(t)} y={H - bottom + 16} textAnchor="middle" fontSize="11" fill="var(--ink-3)">{signed && t > 0 ? "+" : t < 0 ? "−" : ""}{Math.abs(t).toFixed(digits === 3 ? (Number.isInteger(t * 10) ? 1 : 2) : digits)}</text>
        </g>
      ))}
      {zero && <line x1={x(0)} x2={x(0)} y1={top} y2={H - bottom} stroke="var(--ink-3)" strokeWidth="1.2" strokeDasharray="3 3" />}
      {rows.map((r, i) => {
        const y = top + i * rowH + rowH / 2;
        const has = isNum(r.est) && isNum(r.lo) && isNum(r.hi);
        const c = r.color ?? "var(--ink)";
        return (
          <g key={r.label}>
            <text x={left - 14} y={y - (r.sub ? 3 : -4)} textAnchor="end" fontSize="12.5" fontWeight={r.emphasis ? 700 : 500} fill="var(--ink)">{r.label}</text>
            {r.sub && <text x={left - 14} y={y + 11} textAnchor="end" fontSize="10.5" fill="var(--ink-3)">{r.sub}</text>}
            {has ? (
              <>
                <line x1={x(r.lo as number)} x2={x(r.hi as number)} y1={y} y2={y} stroke={c} strokeWidth={r.emphasis ? 3 : 2} strokeLinecap="round" />
                <line x1={x(r.lo as number)} x2={x(r.lo as number)} y1={y - 5} y2={y + 5} stroke={c} strokeWidth="2" />
                <line x1={x(r.hi as number)} x2={x(r.hi as number)} y1={y - 5} y2={y + 5} stroke={c} strokeWidth="2" />
                <circle cx={x(r.est as number)} cy={y} r={r.emphasis ? 5.5 : 4.5} fill={c} />
                <text x={W - 4} y={y + 4} textAnchor="end" fontSize="11" fill="var(--ink-2)" className="num">{f(r.est as number)} [{f(r.lo as number)}, {f(r.hi as number)}]</text>
              </>
            ) : (
              <text x={left + 8} y={y + 4} fontSize="11.5" fontStyle="italic" fill="var(--ink-3)" stroke="var(--paper)" strokeWidth="5" paintOrder="stroke">{r.pending ?? "pending"}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
