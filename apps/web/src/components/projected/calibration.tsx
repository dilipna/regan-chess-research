"use client";

import { useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Legend, Segmented } from "@/components/site/atoms";
import { Figure } from "@/components/site/page";
import { fmtInt, fmtNum, fmtPct, isNum } from "@/lib/format";
import type { Metrics } from "@/lib/types";

export const Z_LABELS: Record<string, string> = {
  z_t1: "z(top-1 match)",
  z_t3: "z(top-3 match)",
  z_loss: "z(move loss)",
  z_t1_hard: "z(top-1, hard positions)",
  z_maia: "z(human surprisal)",
};
const Z_KEYS = Object.keys(Z_LABELS);

function normalPdf(x: number) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export function BaselineCalibration({ metrics }: { metrics: Metrics | undefined }) {
  const cal = metrics?.baseline_calibration;
  const [key, setKey] = useState("z_t1_hard");
  const c = cal?.[key];
  // statistics with a clearly heavier z > 3 tail than N(0,1): at least 3 games and at least twice the normal share
  const heavy = Z_KEYS.map((k) => ({ k, r: cal?.[k] })).filter(
    (x) =>
      isNum(x.r?.frac_gt3) && isNum(x.r?.normal_frac_gt3) && isNum(x.r?.n) &&
      x.r!.frac_gt3! * x.r!.n! >= 3 && x.r!.frac_gt3! >= 2 * x.r!.normal_frac_gt3!,
  );

  const data = useMemo(() => {
    const e = c?.hist_edges;
    const h = c?.hist;
    if (!e || !h || e.length !== h.length + 1) return null;
    const total = isNum(c?.n) && c!.n! > 0 ? c!.n! : h.reduce((a, b) => a + b, 0);
    if (!total) return null;
    return h.map((cnt, i) => {
      const lo = e[i];
      const hi = e[i + 1];
      const mid = (lo + hi) / 2;
      return { mid, lo, hi, cnt, density: cnt / (total * (hi - lo)), normal: normalPdf(mid) };
    });
  }, [c]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <Figure
        title={`Original test games: distribution of ${Z_LABELS[key]}`}
        actions={
          <Segmented
            size="sm"
            label="z statistic"
            value={key}
            onChange={setKey}
            options={Z_KEYS.map((k) => ({ value: k, label: k.replace("z_", "") }))}
          />
        }
        caption="Bars: empirical density of the statistic on held-out original player-games. Line: standard normal density N(0,1). A similar centre and spread do not show that the tails match."
      >
        {data ? (
          <>
            <Legend
              className="mb-2"
              items={[
                { label: "Original test games (density)", color: "var(--ink-4)", kind: "bar" },
                { label: "N(0,1)", color: "var(--engine)" },
              ]}
            />
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={1}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="mid"
                  type="number"
                  domain={[data[0].lo, data[data.length - 1].hi]}
                  ticks={[-4, -3, -2, -1, 0, 1, 2, 3, 4].filter((t) => t >= data[0].lo && t <= data[data.length - 1].hi)}
                  tickLine={false}
                  axisLine={{ stroke: "var(--rule-strong)" }}
                />
                <YAxis width={40} tickLine={false} axisLine={false} tickCount={4} tickFormatter={(v: number) => v.toFixed(2)} />
                <ReferenceLine x={2} stroke="var(--rule-strong)" strokeDasharray="3 3" />
                <ReferenceLine x={-2} stroke="var(--rule-strong)" strokeDasharray="3 3" />
                <Tooltip
                  cursor={{ fill: "var(--paper-3)", fillOpacity: 0.5 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as (typeof data)[number];
                    return (
                      <div className="rounded-md border border-rule-strong bg-paper px-3 py-2 text-[12px] shadow-sm">
                        <div className="num text-ink">
                          [{fmtNum(d.lo, 2)}, {fmtNum(d.hi, 2)})
                        </div>
                        <div className="text-ink-3">
                          games <span className="num text-ink-2">{d.cnt}</span> · density{" "}
                          <span className="num text-ink-2">{fmtNum(d.density, 3)}</span> · N(0,1){" "}
                          <span className="num text-ink-2">{fmtNum(d.normal, 3)}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="density" fill="var(--ink-4)" fillOpacity={0.7} isAnimationActive={false} radius={[2, 2, 0, 0]} />
                <Line dataKey="normal" type="monotone" stroke="var(--engine)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        ) : (
          <div className="flex h-[220px] items-center justify-center rounded bg-paper-2 text-[12.5px] text-ink-3">
            — Calibration histogram not available in this export.
          </div>
        )}
      </Figure>

      <Figure
        title="Centre, spread and tails on original test games"
        caption="Under N(0,1): mean 0, SD 1 and the bracketed tail shares. Mean ≈ 0 and SD ≈ 1 follow largely from how κ is estimated; a heavier observed tail means a fixed z threshold flags original games more often than nominal. Tail shares here rest on a few games each."
      >
        {heavy.length > 0 && (
          <div className="mb-3 rounded-md border border-flag/25 bg-flag-soft px-3 py-2 text-[12.5px] leading-relaxed text-ink-2">
            <span className="font-medium text-ink">Upper tail heavier than N(0,1): </span>
            {heavy
              .map(
                (x) =>
                  `${Z_LABELS[x.k]} exceeds 3 in ${fmtPct(x.r!.frac_gt3, 2)} of games${isNum(x.r!.n) ? ` (${Math.round(x.r!.frac_gt3! * x.r!.n!)} of ${x.r!.n})` : ""} vs ${fmtPct(x.r!.normal_frac_gt3, 2)} expected`,
              )
              .join("; ")}
            .
          </div>
        )}
        <div className="scroll-x">
          <table className="table-lab min-w-[480px]">
            <thead>
              <tr>
                <th>Statistic</th>
                <th className="r">n</th>
                <th className="r">Mean</th>
                <th className="r">SD</th>
                <th className="r">z &gt; 2 (normal)</th>
                <th className="r">z &gt; 3 (normal)</th>
              </tr>
            </thead>
            <tbody>
              {Z_KEYS.map((k) => {
                const r = cal?.[k];
                return (
                  <tr key={k} className={k === key ? "bg-paper-2" : undefined}>
                    <td className="text-ink">{Z_LABELS[k]}</td>
                    <td className="r num text-ink-3">{fmtInt(r?.n)}</td>
                    <td className="r num">{fmtNum(r?.mean, 2)}</td>
                    <td className="r num">{fmtNum(r?.std, 2)}</td>
                    <td className="r num whitespace-nowrap">
                      {fmtPct(r?.frac_gt2, 1)} <span className="text-ink-4">({fmtPct(r?.normal_frac_gt2, 1)})</span>
                    </td>
                    <td className="r num whitespace-nowrap">
                      {fmtPct(r?.frac_gt3, 2)} <span className="text-ink-4">({fmtPct(r?.normal_frac_gt3, 2)})</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!cal && <p className="mt-3 text-[12px] text-ink-3">The calibration summary is not present in this export of metrics.json.</p>}
      </Figure>
    </div>
  );
}
