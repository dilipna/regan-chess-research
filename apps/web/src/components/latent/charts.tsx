"use client";

import { useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export const SERIES = { a: "var(--viz-1)", b: "var(--viz-2)", ink: "var(--ink-3)" } as const;

export interface Series {
  key: string;
  label: string;
  color: string;
  dash?: string;
  points: { x: number; y: number | null }[];
}

interface Props {
  series: Series[];
  xLabel: string;
  yLabel: string;
  logY?: boolean;
  yDomain?: [number, number];
  reverseY?: boolean;
  height?: number;
  refLines?: { y?: number; x?: number; label: string }[];
  markers?: { x: number; label: string }[];
  formatY?: (v: number) => string;
  formatX?: (v: number) => string;
  caption?: React.ReactNode;
  title: string;
  markerLabelBottom?: boolean;
}

function niceTicks(lo: number, hi: number, n = 5) {
  const span = hi - lo || 1;
  const step = 10 ** Math.floor(Math.log10(span / n));
  const err = (span / n) / step;
  const m = err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
  const s = m * step;
  const out = [];
  for (let v = Math.ceil(lo / s) * s; v <= hi + 1e-9; v += s) out.push(Number(v.toFixed(10)));
  return out;
}

/** Thin-line chart with a crosshair tooltip, direct end labels and a table view. One y axis only. */
export function LineChart({ series, xLabel, yLabel, logY, yDomain, reverseY, height = 260, refLines = [], markers = [], formatY, formatX, caption, title, markerLabelBottom }: Props) {
  const W = 640, H = height, m = { l: 56, r: 118, t: 14, b: 40 };
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const id = useId();
  const xs = useMemo(() => Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.x)))).sort((a, b) => a - b), [series]);
  const ys = series.flatMap((s) => s.points.map((p) => p.y).filter((y): y is number => y != null && (!logY || y > 0)));
  const tf = (v: number) => (logY ? Math.log10(v) : v);
  const [yLo, y1] = yDomain ?? [Math.min(...ys), Math.max(...ys)];
  const y0 = logY ? Math.max(yLo, 1e-12) : yLo;
  const ty0 = tf(y0), ty1 = tf(y1) === ty0 ? ty0 + 1 : tf(y1);
  const x0 = xs[0] ?? 0, x1 = xs[xs.length - 1] ?? 1;
  const sx = (x: number) => m.l + ((x - x0) / (x1 - x0 || 1)) * (W - m.l - m.r);
  const syRaw = (y: number) => (tf(y) - ty0) / (ty1 - ty0);
  const sy = (y: number) => m.t + (reverseY ? syRaw(y) : 1 - syRaw(y)) * (H - m.t - m.b);
  const fy = formatY ?? ((v: number) => (Math.abs(v) >= 1000 ? v.toLocaleString("en-US") : String(Number(v.toPrecision(3)))));
  const fx = formatX ?? ((v: number) => String(v));
  const yTicks = logY
    ? Array.from({ length: Math.floor(ty1) - Math.ceil(ty0) + 1 }, (_, i) => 10 ** (Math.ceil(ty0) + i))
    : niceTicks(y0, y1);
  const xTicks = niceTicks(x0, x1, 8).filter((v) => Number.isInteger(v));
  const hx = hover != null ? xs[hover] : null;
  const path = (s: Series) => {
    let d = "", pen = false;
    for (const p of s.points) {
      if (p.y == null || (logY && p.y <= 0)) { pen = false; continue; }
      d += `${pen ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`;
      pen = true;
    }
    return d;
  };
  const last = (s: Series) => [...s.points].reverse().find((p) => p.y != null);
  // keep end labels apart
  const ends = series.map((s) => ({ s, p: last(s) })).filter((e) => e.p).map((e) => ({ ...e, ly: sy(e.p!.y!) }));
  ends.sort((a, b) => a.ly - b.ly);
  for (let i = 1; i < ends.length; i++) if (ends[i].ly - ends[i - 1].ly < 14) ends[i].ly = ends[i - 1].ly + 14;

  return (
    <figure className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <figcaption id={id} className="text-[13px] font-medium text-ink">{title}</figcaption>
        <button type="button" onClick={() => setTable((t) => !t)} aria-pressed={table}
          className="rounded border border-rule-strong px-2 py-0.5 text-[11.5px] text-ink-3 hover:text-ink">{table ? "Show chart" : "Show table"}</button>
      </div>
      {series.length > 1 && (
        <div className="mb-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-ink-3" aria-hidden>
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} /></svg>{s.label}
            </span>
          ))}
        </div>
      )}
      {table ? (
        <div className="scroll-x max-h-[320px] overflow-y-auto rounded border border-rule">
          <table className="table-lab">
            <thead><tr><th>{xLabel}</th>{series.map((s) => <th key={s.key} className="r">{s.label}</th>)}</tr></thead>
            <tbody>{xs.map((x) => (
              <tr key={x}><td className="num">{fx(x)}</td>{series.map((s) => { const p = s.points.find((q) => q.x === x); return <td key={s.key} className="num r">{p?.y != null ? fy(p.y) : ""}</td>; })}</tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full touch-none" role="img" aria-labelledby={id}
            onMouseLeave={() => setHover(null)}
            onPointerMove={(e) => {
              const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
              const x = ((e.clientX - r.left) / r.width) * W;
              let best = 0;
              xs.forEach((v, i) => { if (Math.abs(sx(v) - x) < Math.abs(sx(xs[best]) - x)) best = i; });
              setHover(best);
            }}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") setHover((h) => Math.min((h ?? -1) + 1, xs.length - 1));
              if (e.key === "ArrowLeft") setHover((h) => Math.max((h ?? xs.length) - 1, 0));
            }}>
            {yTicks.map((t) => (
              <g key={t}>
                <line x1={m.l} x2={W - m.r} y1={sy(t)} y2={sy(t)} stroke="var(--rule)" strokeWidth="1" />
                <text x={m.l - 6} y={sy(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--ink-3)" className="font-mono">{fy(t)}</text>
              </g>
            ))}
            {xTicks.map((t) => (
              <text key={t} x={sx(t)} y={H - m.b + 16} textAnchor="middle" fontSize="11" fill="var(--ink-3)" className="font-mono">{fx(t)}</text>
            ))}
            <line x1={m.l} x2={W - m.r} y1={H - m.b} y2={H - m.b} stroke="var(--rule-strong)" />
            <text x={(m.l + W - m.r) / 2} y={H - 6} textAnchor="middle" fontSize="11.5" fill="var(--ink-3)">{xLabel}</text>
            <text transform={`translate(13 ${(m.t + H - m.b) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11.5" fill="var(--ink-3)">{yLabel}</text>
            {refLines.map((r) => r.y != null ? (
              <g key={r.label}>
                <line x1={m.l} x2={W - m.r} y1={sy(r.y)} y2={sy(r.y)} stroke="var(--ink-4)" strokeDasharray="2 3" />
                {r.label && <text x={W - m.r + 4} y={sy(r.y)} dy="0.32em" fontSize="11" fill="var(--ink-3)">{r.label}</text>}
              </g>
            ) : null)}
            {markers.map((mk) => (
              <g key={mk.label}>
                <line x1={sx(mk.x)} x2={sx(mk.x)} y1={m.t} y2={H - m.b} stroke="var(--ink-3)" strokeDasharray="3 3" />
                <text x={markerLabelBottom ? sx(mk.x) - 4 : sx(mk.x) + 4} y={markerLabelBottom ? H - m.b - 6 : m.t + 10} textAnchor={markerLabelBottom ? "end" : "start"} fontSize="11" fill="var(--ink-2)">{mk.label}</text>
              </g>
            ))}
            {series.map((s) => <path key={s.key} d={path(s)} fill="none" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} strokeLinejoin="round" />)}
            {ends.map(({ s, p, ly }) => (
              <text key={s.key} x={sx(p!.x) + 6} y={ly} dy="0.32em" fontSize="11.5" fill="var(--ink-2)">{s.label.length > 18 ? s.label.slice(0, 17) + "…" : s.label}</text>
            ))}
            {hx != null && (
              <g pointerEvents="none">
                <line x1={sx(hx)} x2={sx(hx)} y1={m.t} y2={H - m.b} stroke="var(--ink-4)" />
                {series.map((s) => { const p = s.points.find((q) => q.x === hx); return p?.y != null && (!logY || p.y > 0) ? <circle key={s.key} cx={sx(hx)} cy={sy(p.y)} r="4" fill={s.color} stroke="var(--paper)" strokeWidth="2" /> : null; })}
              </g>
            )}
          </svg>
          {hx != null && (
            <div className={cn("pointer-events-none absolute top-2 rounded border border-rule-strong bg-paper px-2.5 py-1.5 text-[11.5px] shadow-sm", sx(hx) > W / 2 ? "left-16" : "right-32")} role="status">
              <div className="mb-0.5 font-medium text-ink">{xLabel} {fx(hx)}</div>
              {series.map((s) => { const p = s.points.find((q) => q.x === hx); return (
                <div key={s.key} className="flex items-center gap-1.5 text-ink-2">
                  <svg width="12" height="4" aria-hidden><line x1="0" y1="2" x2="12" y2="2" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} /></svg>
                  {s.label}: <span className="num text-ink">{p?.y != null ? fy(p.y) : "n/a"}</span>
                </div>
              ); })}
            </div>
          )}
        </div>
      )}
      {caption && <p className="mt-2 text-[12px] leading-relaxed text-ink-3">{caption}</p>}
    </figure>
  );
}

/** Small heatmap for attention matrices. Rows = query positions, columns = key positions. */
export function Heatmap({ m, rowLabels, colLabels, title, masked }: { m: number[][]; rowLabels: string[]; colLabels: string[]; title: string; masked?: (r: number, c: number) => boolean }) {
  const [h, setH] = useState<[number, number] | null>(null);
  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 text-[13px] font-medium text-ink">{title}</figcaption>
      <div className="scroll-x">
        <table className="border-separate border-spacing-[2px] text-[11px]" onMouseLeave={() => setH(null)}>
          <thead>
            <tr><th className="px-1 text-left font-normal text-ink-4">query \ key</th>{colLabels.map((c, j) => <th key={j} scope="col" className="max-w-[64px] truncate px-1 font-mono font-normal text-ink-3">{c}</th>)}</tr>
          </thead>
          <tbody>
            {m.map((row, i) => (
              <tr key={i}>
                <th scope="row" className="max-w-[90px] truncate pr-1 text-right font-mono font-normal text-ink-3">{rowLabels[i]}</th>
                {row.map((v, j) => {
                  const off = masked?.(i, j);
                  return (
                    <td key={j} onMouseEnter={() => setH([i, j])} title={off ? "masked (future position)" : v.toFixed(3)}
                      className="num h-8 w-12 min-w-10 rounded-[2px] text-center"
                      style={{ background: off ? "repeating-linear-gradient(135deg, var(--paper-2) 0 4px, var(--paper-3) 4px 6px)" : `color-mix(in oklab, var(--viz-1) ${Math.round(v * 100)}%, var(--paper))`, color: v > 0.55 && !off ? "var(--paper)" : "var(--ink-2)" }}>
                      {off ? "" : v.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-[11.5px] text-ink-3" aria-live="polite">
        {h ? <>Query <span className="font-mono">{rowLabels[h[0]]}</span> to key <span className="font-mono">{colLabels[h[1]]}</span>: {masked?.(h[0], h[1]) ? "masked (future position)" : <span className="num">{m[h[0]][h[1]].toFixed(4)}</span>}</> : "Each row sums to 1. Hatched cells are future positions the causal mask hides."}
      </p>
    </figure>
  );
}
