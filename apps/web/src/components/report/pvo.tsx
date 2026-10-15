"use client";

import { DownloadButton } from "@/components/site/atoms";
import { downloadCsv } from "@/lib/export";
import { fmtNum, fmtPct, fmtSigned, isNum } from "@/lib/format";
import type { PvoRow } from "@/lib/types";

const ZMAX = 4;
const W = 240;
const PAD = 10;

function xOf(z: number) {
  const c = Math.max(-ZMAX, Math.min(ZMAX, z));
  return PAD + ((c + ZMAX) / (2 * ZMAX)) * (W - 2 * PAD);
}

function fmtVal(v: number | null, unit: string) {
  if (!isNum(v)) return "—";
  if (unit === "rate") return fmtPct(v, 1);
  if (unit === "cp") return `${fmtNum(v, 1)} cp`;
  return fmtNum(v, 2);
}

export function ZAxisHeader() {
  return (
    <svg width={W} height={22} className="block" aria-hidden>
      {[-4, -2, 0, 2, 4].map((t) => (
        <g key={t}>
          <line x1={xOf(t)} x2={xOf(t)} y1={16} y2={21} stroke="var(--ink-4)" />
          <text x={xOf(t)} y={11} textAnchor="middle" fontSize={10.5} fill="var(--ink-3)" className="num">
            {t > 0 ? `+${t}` : t < 0 ? `−${-t}` : "0"}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function ZDot({ z, h = 26 }: { z: number | null; h?: number }) {
  const mid = h / 2;
  const out = isNum(z) && Math.abs(z) > ZMAX;
  const sig = isNum(z) && Math.abs(z) >= 2;
  return (
    <svg width={W} height={h} className="block" role="img" aria-label={isNum(z) ? `z = ${z.toFixed(2)}` : "z not available"}>
      <rect x={xOf(-2)} y={2} width={xOf(2) - xOf(-2)} height={h - 4} fill="var(--paper-3)" />
      <line x1={xOf(-2)} x2={xOf(-2)} y1={2} y2={h - 2} stroke="var(--rule-strong)" strokeDasharray="2 2" />
      <line x1={xOf(2)} x2={xOf(2)} y1={2} y2={h - 2} stroke="var(--rule-strong)" strokeDasharray="2 2" />
      <line x1={xOf(0)} x2={xOf(0)} y1={0} y2={h} stroke="var(--ink-4)" />
      {isNum(z) && (
        <>
          <line x1={xOf(0)} x2={xOf(z)} y1={mid} y2={mid} stroke={sig ? "var(--flag)" : "var(--ink-3)"} strokeWidth={1.25} />
          {out ? (
            <path
              d={
                z > 0
                  ? `M ${xOf(z) - 5} ${mid - 5} L ${xOf(z) + 2} ${mid} L ${xOf(z) - 5} ${mid + 5} Z`
                  : `M ${xOf(z) + 5} ${mid - 5} L ${xOf(z) - 2} ${mid} L ${xOf(z) + 5} ${mid + 5} Z`
              }
              fill={sig ? "var(--flag)" : "var(--ink)"}
            />
          ) : (
            <circle cx={xOf(z)} cy={mid} r={4.5} fill={sig ? "var(--flag)" : "var(--ink)"} stroke="var(--paper)" strokeWidth={1.5} />
          )}
        </>
      )}
    </svg>
  );
}

export function PvoTable({ rows, fileStem }: { rows?: PvoRow[]; fileStem?: string }) {
  if (!rows?.length) return <p className="text-[13px] text-ink-3">—</p>;
  return (
    <div>
      <div className="scroll-x">
        <table className="table-lab min-w-[760px]">
          <thead>
            <tr>
              <th>Metric</th>
              <th className="r">n</th>
              <th className="r">Projected</th>
              <th className="r">Observed</th>
              <th className="r">z</th>
              <th className="!pb-0">
                <ZAxisHeader />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.metric}>
                <td className="!py-2">
                  <div className="text-ink">{r.metric}</div>
                  {r.note && <div className="mt-0.5 max-w-[300px] text-[11.5px] leading-snug text-ink-3">{r.note}</div>}
                </td>
                <td className="r num text-ink-3">{r.n}</td>
                <td className="r num text-ink-2">{fmtVal(r.projected, r.unit)}</td>
                <td className="r num text-ink">{fmtVal(r.observed, r.unit)}</td>
                <td className="r num font-medium text-ink">{fmtSigned(r.z, 2)}</td>
                <td className="!py-1.5">
                  <ZDot z={r.z} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11.5px] text-ink-3">
        <span>
          Shaded band: |z| &lt; 2. Points beyond ±4 are drawn as arrows at the edge; the exact z is in the column. Filled
          crimson marks |z| ≥ 2.
        </span>
        {fileStem && (
          <DownloadButton
            onClick={() =>
              downloadCsv(
                `${fileStem}-projected-vs-observed.csv`,
                ["metric", "unit", "n", "projected", "observed", "z", "note"],
                rows.map((r) => [r.metric, r.unit, r.n, r.projected, r.observed, r.z, r.note ?? ""]),
              )
            }
          >
            CSV
          </DownloadButton>
        )}
      </div>
    </div>
  );
}
