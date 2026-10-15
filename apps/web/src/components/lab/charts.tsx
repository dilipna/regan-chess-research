"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Legend, Segmented } from "@/components/site/atoms";
import { Figure } from "@/components/site/page";
import { MODEL_META, MODEL_ORDER, SCORE_ORDER, STRATEGY_TEXT, featureGroup, featureText } from "@/lib/features";
import { fmtLevel, fmtNum, fmtPct, isNum } from "@/lib/format";
import type { Metrics, ModelKey, RocCurves, ScoreKey } from "@/lib/types";

const AX = { tickLine: false, axisLine: { stroke: "var(--rule-strong)" } } as const;
const YAX = { tickLine: false, axisLine: false, width: 40 } as const;

function legendFor(keys: ScoreKey[], metrics?: Metrics) {
  return keys.map((k) => ({
    label: `${MODEL_META[k].code} · ${metrics?.experiments[k]?.label ?? MODEL_META[k].name}`,
    color: MODEL_META[k].color,
  }));
}

interface TipRow {
  name: string;
  value: number;
  color: string;
}
function SeriesTip({
  active,
  payload,
  label,
  title,
  fmt = (v: number) => fmtNum(v, 3),
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; stroke?: string }[];
  label?: string | number;
  title?: (l: string | number | undefined) => string;
  fmt?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const rows: TipRow[] = payload
    .filter((p) => isNum(p.value))
    .map((p) => ({ name: String(p.name ?? ""), value: p.value as number, color: p.color ?? p.stroke ?? "var(--ink)" }));
  return (
    <div className="rounded-md border border-rule-strong bg-paper px-3 py-2 text-[12px] shadow-sm">
      <div className="mb-1 font-medium text-ink">{title ? title(label) : label}</div>
      {rows.map((r) => (
        <div key={r.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-ink-3">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />
            {r.name}
          </span>
          <span className="num text-ink">{fmt(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

function aucDomain(vals: number[]): [number, number] {
  const v = vals.filter(isNum);
  if (!v.length) return [0.5, 1];
  return [Math.max(0, Math.floor((Math.min(...v) - 0.02) * 20) / 20), 1];
}

function aucTicks(dom: [number, number]): number[] {
  const span = dom[1] - dom[0];
  const step = span > 0.3 ? 0.1 : 0.05;
  const out: number[] = [];
  for (let t = Math.ceil(dom[0] / step - 1e-9) * step; t <= dom[1] + 1e-9; t += step) out.push(Number(t.toFixed(2)));
  return out;
}

// ------------------------------------------------------------------ AUC by level, per strategy
export function AucByLevel({ metrics }: { metrics: Metrics }) {
  const strategies = metrics.dataset?.strategies ?? ["random", "selective", "subtle"];
  const keys = SCORE_ORDER.filter((k) => metrics.experiments[k]?.classifier.by_cell?.length);
  const all = keys.flatMap((k) => (metrics.experiments[k]!.classifier.by_cell ?? []).map((c) => c.roc_auc ?? NaN));
  const dom = aucDomain(all);
  const a0 = metrics.experiments.A0_zt1?.classifier.by_cell ?? [];
  const rnd = a0.filter((c) => c.strategy === "random");
  const sameA0 =
    rnd.length > 0 &&
    rnd.every((c) => {
      const o = a0.find((x) => x.strategy === "selective" && Math.abs(x.level - c.level) < 1e-9);
      return o && isNum(o.roc_auc) && isNum(c.roc_auc) && Math.abs(o.roc_auc - c.roc_auc) < 1e-6;
    });
  return (
    <Figure
      title="ROC-AUC by assistance level, per strategy"
      caption={
        <>
          Each point compares original test player-games with their substituted variants at one nominal level.
          {sameA0 &&
            " In this export z(top-1) alone (A0) has identical ROC-AUC for Random and Selective at every level: it counts top-1 matches but not where they occur, so it cannot see that Selective concentrates substitutions in hard positions."}
        </>
      }
    >
      <Legend items={legendFor(keys, metrics)} className="mb-3" />
      <div className="grid gap-4 md:grid-cols-3">
        {strategies.map((s) => {
          const levels = Array.from(
            new Set(keys.flatMap((k) => (metrics.experiments[k]!.classifier.by_cell ?? []).filter((c) => c.strategy === s).map((c) => c.level))),
          ).sort((a, b) => a - b);
          const data = levels.map((l) => {
            const row: Record<string, number | string | null> = { level: fmtLevel(l) };
            for (const k of keys) {
              const c = metrics.experiments[k]!.classifier.by_cell?.find((x) => x.strategy === s && Math.abs(x.level - l) < 1e-9);
              row[k] = c?.roc_auc ?? null;
            }
            return row;
          });
          return (
            <div key={s} className="min-w-0">
              <div className="mb-1 pl-10 text-[12px] font-medium text-ink-2">{STRATEGY_TEXT[s]?.name ?? s}</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="level" {...AX} />
                  <YAxis domain={dom} ticks={aucTicks(dom)} {...YAX} tickFormatter={(v: number) => v.toFixed(2)} />
                  <Tooltip content={<SeriesTip title={(l) => `${STRATEGY_TEXT[s]?.name ?? s} · ${l}`} />} />
                  {keys.map((k) => (
                    <Line
                      key={k}
                      dataKey={k}
                      name={MODEL_META[k].code}
                      stroke={MODEL_META[k].color}
                      strokeWidth={k === "D_sf_maia_seq" ? 2.25 : 1.5}
                      strokeDasharray={k === "A0_zt1" ? "4 3" : undefined}
                      dot={{ r: 2.5, fill: MODEL_META[k].color, strokeWidth: 0 }}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </Figure>
  );
}

// ------------------------------------------------------------------ AUC by Elo band
export function AucByBand({ metrics }: { metrics: Metrics }) {
  const keys = MODEL_ORDER.filter((k) => metrics.experiments[k]?.classifier.by_band?.length);
  const bands = Array.from(new Set(keys.flatMap((k) => metrics.experiments[k]!.classifier.by_band!.map((b) => b.band)))).sort();
  const nBand = metrics.dataset?.bands_test ?? {};
  const small = bands.filter((b) => isNum(nBand[b]) && nBand[b] < 10);
  const shown = bands.filter((b) => !small.includes(b));
  const data = shown.map((b) => {
    const row: Record<string, number | string | null> = { band: b };
    for (const k of keys) row[k] = metrics.experiments[k]!.classifier.by_band!.find((x) => x.band === b)?.roc_auc ?? null;
    return row;
  });
  const dom = aucDomain(data.flatMap((r) => keys.map((k) => r[k] as number)));
  const smallText = small.map((b) => {
    const vals = keys
      .map((k) => `${MODEL_META[k].code} ${fmtNum(metrics.experiments[k]!.classifier.by_band!.find((x) => x.band === b)?.roc_auc, 3)}`)
      .join(", ");
    return `${b} (only ${nBand[b]} test player-game${nBand[b] === 1 ? "" : "s"}; ROC-AUC ${vals})`;
  });
  return (
    <Figure
      title="ROC-AUC by Elo band"
      caption={
        <>
          Band labels show the number of test player-games.
          {small.length > 0 &&
            ` Bands with fewer than 10 test player-games are omitted from the plot because their estimates are unstable: ${smallText.join("; ")}.`}
        </>
      }
    >
      <Legend items={legendFor(keys, metrics)} className="mb-3" />
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 6, right: 36, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="band"
            {...AX}
            interval={0}
            height={34}
            tick={({ x, y, payload }: { x: number | string; y: number | string; payload: { value: string } }) => (
              <g transform={`translate(${x},${y})`}>
                <text textAnchor="middle" fontSize={10.5} fill="var(--ink-3)" className="num">
                  <tspan x={0} dy={12}>
                    {payload.value}
                  </tspan>
                  {isNum(nBand[payload.value]) && (
                    <tspan x={0} dy={13} fill="var(--ink-4)">
                      n = {nBand[payload.value]}
                    </tspan>
                  )}
                </text>
              </g>
            )}
          />
          <YAxis domain={dom} ticks={aucTicks(dom)} {...YAX} tickFormatter={(v: number) => v.toFixed(2)} />
          <Tooltip content={<SeriesTip title={(l) => `Elo ${l}`} />} />
          {keys.map((k) => (
            <Line
              key={k}
              dataKey={k}
              name={MODEL_META[k].code}
              stroke={MODEL_META[k].color}
              strokeWidth={k === "D_sf_maia_seq" ? 2.25 : 1.5}
              dot={{ r: 3, fill: MODEL_META[k].color, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Figure>
  );
}

// ------------------------------------------------------------------ Calibration
export function CalibrationPlot({ metrics }: { metrics: Metrics }) {
  const keys = MODEL_ORDER.filter((k) => metrics.experiments[k]?.classifier.calibration?.length);
  return (
    <Figure
      title="Calibration (test split, balanced weights)"
      caption="Mean predicted score vs observed share of substituted variants per score decile (balanced weights). The diagonal is perfect calibration on this benchmark only. Scores remain similarity measures for controlled substitution, not probabilities of cheating."
    >
      <Legend items={[...legendFor(keys, metrics), { label: "Perfect calibration", color: "var(--ink-4)", kind: "dash" }]} className="mb-3" />
      <ResponsiveContainer width="100%" height={260}>
        <LineChart margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid />
          <XAxis type="number" dataKey="x" domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} {...AX} />
          <YAxis type="number" domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} {...YAX} />
          <ReferenceLine
            segment={[
              { x: 0, y: 0 },
              { x: 1, y: 1 },
            ]}
            stroke="var(--ink-4)"
            strokeDasharray="4 4"
          />
          <Tooltip content={<SeriesTip title={(l) => `mean predicted ${fmtNum(Number(l), 2)}`} />} />
          {keys.map((k) => (
            <Line
              key={k}
              data={metrics.experiments[k]!.classifier.calibration!.map((c) => ({ x: c.mean_pred, y: c.frac_pos, n: c.n }))}
              dataKey="y"
              name={MODEL_META[k].code}
              stroke={MODEL_META[k].color}
              strokeWidth={k === "D_sf_maia_seq" ? 2.25 : 1.5}
              dot={{ r: 2.5, fill: MODEL_META[k].color, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Figure>
  );
}

// ------------------------------------------------------------------ Regression
export function RegressionPlot({ metrics }: { metrics: Metrics }) {
  const keys = MODEL_ORDER.filter((k) => metrics.experiments[k]?.regressor?.by_level?.length);
  const max = Math.max(
    0.1,
    ...keys.flatMap((k) => metrics.experiments[k]!.regressor!.by_level!.flatMap((r) => [r.mean_true, r.mean_estimate])),
  );
  const top = Math.ceil(max * 10) / 10;
  const ticks = Array.from({ length: Math.round(top / 0.1) + 1 }, (_, i) => Number((i * 0.1).toFixed(1)));
  return (
    <Figure
      title="Synthetic-equivalent estimate vs realized substituted fraction"
      caption="Mean regressor estimate against the mean realized substituted fraction at each nominal level (test split). Points below the diagonal at high levels are under-estimates; at 0% the estimate cannot go below zero, so original games receive a positive mean estimate."
    >
      <Legend items={[...legendFor(keys, metrics), { label: "Estimate = truth", color: "var(--ink-4)", kind: "dash" }]} className="mb-3" />
      <ResponsiveContainer width="100%" height={260}>
        <LineChart margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid />
          <XAxis type="number" dataKey="x" domain={[0, top]} ticks={ticks} {...AX} tickFormatter={(v: number) => fmtPct(v, 0)} />
          <YAxis type="number" domain={[0, top]} ticks={ticks} {...YAX} tickFormatter={(v: number) => fmtPct(v, 0)} />
          <ReferenceLine
            segment={[
              { x: 0, y: 0 },
              { x: top, y: top },
            ]}
            stroke="var(--ink-4)"
            strokeDasharray="4 4"
          />
          <Tooltip
            content={<SeriesTip title={(l) => `true realized ${fmtPct(Number(l), 1)}`} fmt={(v) => fmtPct(v, 1)} />}
          />
          {keys.map((k) => (
            <Line
              key={k}
              data={metrics.experiments[k]!.regressor!.by_level!.map((r) => ({ x: r.mean_true, y: r.mean_estimate }))}
              dataKey="y"
              name={MODEL_META[k].code}
              stroke={MODEL_META[k].color}
              strokeWidth={k === "D_sf_maia_seq" ? 2.25 : 1.5}
              dot={{ r: 2.5, fill: MODEL_META[k].color, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Figure>
  );
}

// ------------------------------------------------------------------ Global SHAP
const SHAP_VIEWS: { value: string; label: string; desc: string }[] = [
  { value: "classifier", label: "D classifier", desc: "full model (D), classification score" },
  { value: "classifier_C", label: "C classifier", desc: "human-aware model (C), classification score" },
  { value: "regressor", label: "D regressor", desc: "full model (D), assistance estimate" },
];

export function GlobalShap({ metrics }: { metrics: Metrics }) {
  const views = SHAP_VIEWS.filter((v) => metrics.shap_global?.[v.value]?.length);
  const [view, setView] = useState(views[0]?.value ?? "classifier");
  const rows = (metrics.shap_global?.[view] ?? []).slice().sort((a, b) => b.mean_abs - a.mean_abs).slice(0, 15);
  const max = Math.max(...rows.map((r) => r.mean_abs), 1e-9);
  const groupsPresent = Array.from(new Set(rows.map((r) => featureGroup(r.feature, metrics.experiments)).filter(Boolean))) as ModelKey[];
  const GROUP_NAME: Record<ModelKey, string> = {
    A_stat: "A · aggregate statistics",
    B_sf: "B · Stockfish aggregates",
    C_sf_maia: "C · Maia-3 human model",
    D_sf_maia_seq: "D · sequence / criticality",
  };
  return (
    <Figure
      title="Global feature importance (mean |SHAP|), top 15"
      actions={
        views.length > 1 ? (
          <Segmented size="sm" label="SHAP model" value={view} onChange={setView} options={views.map((v) => ({ value: v.value, label: v.label }))} />
        ) : undefined
      }
      caption={`Mean absolute SHAP value on the test split for the ${SHAP_VIEWS.find((v) => v.value === view)?.desc ?? view}. Bar color marks the nested feature group in which each feature first enters.`}
    >
      <Legend
        className="mb-3"
        items={MODEL_ORDER.filter((g) => groupsPresent.includes(g)).map((g) => ({ label: GROUP_NAME[g], color: MODEL_META[g].color, kind: "bar" as const }))}
      />
      <ul className="space-y-1.5">
        {rows.map((r) => {
          const g = featureGroup(r.feature, metrics.experiments);
          return (
            <li key={r.feature} className="grid grid-cols-[minmax(0,15rem)_minmax(0,1fr)_3.5rem] items-center gap-3 text-[12px] max-sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3rem]">
              <span className="truncate text-ink-2" title={`${featureText(r.feature)} (${r.feature})`}>
                {featureText(r.feature)}
              </span>
              <span className="relative h-2.5">
                <span
                  className="absolute inset-y-0 left-0 rounded-r-[3px] transition-[width] duration-200"
                  style={{ width: `${(100 * r.mean_abs) / max}%`, background: g ? MODEL_META[g].color : "var(--ink-4)" }}
                />
              </span>
              <span className="num text-right text-ink-2">{fmtNum(r.mean_abs, 3)}</span>
            </li>
          );
        })}
      </ul>
    </Figure>
  );
}

// ------------------------------------------------------------------ Event power
export function EventPower({ metrics }: { metrics: Metrics }) {
  const ep = metrics.event_power ?? {};
  const keys = SCORE_ORDER.filter((k) => ep[k]?.length);
  const allRows = keys.flatMap((k) => ep[k]!);
  const levels = Array.from(new Set(allRows.map((r) => r.level))).sort((a, b) => a - b);
  const strategies = Array.from(new Set(allRows.map((r) => r.strategy)));
  const [lvl, setLvl] = useState<string>(String(levels[0] ?? ""));
  const level = Number(lvl);
  const ks = Array.from(new Set(allRows.map((r) => r.k_games))).sort((a, b) => a - b);
  const dom = aucDomain(allRows.filter((r) => Math.abs(r.level - level) < 1e-9).map((r) => r.roc_auc));
  if (!keys.length) return null;
  return (
    <Figure
      title="Pseudo-events: ROC-AUC when k different-player games are pooled"
      actions={
        <Segmented
          size="sm"
          label="Assistance level"
          value={lvl}
          onChange={setLvl}
          options={levels.map((l) => ({ value: String(l), label: fmtLevel(l) }))}
        />
      }
      caption="Each pseudo-event pools k test player-games by k different players of one Elo band, all original or all substituted with the same strategy and level; the event score is the mean per-game score. Exploratory only: this does not validate longitudinal detection for a single player."
    >
      <Legend items={legendFor(keys, metrics)} className="mb-3" />
      <div className="grid gap-4 md:grid-cols-3">
        {strategies.map((s) => {
          const data = ks.map((k) => {
            const row: Record<string, number | string | null> = { k: `${k}` };
            for (const m of keys)
              row[m] = ep[m]!.find((r) => r.strategy === s && r.k_games === k && Math.abs(r.level - level) < 1e-9)?.roc_auc ?? null;
            return row;
          });
          return (
            <div key={s} className="min-w-0">
              <div className="mb-1 pl-10 text-[12px] font-medium text-ink-2">{STRATEGY_TEXT[s]?.name ?? s}</div>
              <ResponsiveContainer width="100%" height={190}>
                <LineChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="k" {...AX} />
                  <YAxis domain={dom} ticks={aucTicks(dom)} {...YAX} tickFormatter={(v: number) => v.toFixed(2)} />
                  <Tooltip content={<SeriesTip title={(l) => `${STRATEGY_TEXT[s]?.name ?? s} · k = ${l} games`} />} />
                  {keys.map((m) => (
                    <Line
                      key={m}
                      dataKey={m}
                      name={MODEL_META[m].code}
                      stroke={MODEL_META[m].color}
                      strokeWidth={m === "D_sf_maia_seq" ? 2.25 : 1.5}
                      strokeDasharray={m === "A0_zt1" ? "4 3" : undefined}
                      dot={{ r: 2.5, fill: MODEL_META[m].color, strokeWidth: 0 }}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
      <div className="mt-1 pl-10 text-[11px] text-ink-4">k = number of games pooled</div>
    </Figure>
  );
}

// ------------------------------------------------------------------ Score histograms
export function ScoreHistograms({ metrics }: { metrics: Metrics }) {
  const hs = metrics.score_histograms ?? {};
  const keys = MODEL_ORDER.filter((k) => hs[k]);
  const [model, setModel] = useState<ModelKey>(keys.includes("D_sf_maia_seq") ? "D_sf_maia_seq" : keys[0]);
  const h = hs[model];
  const levels = h ? Object.keys(h.by_level).sort((a, b) => Number(a) - Number(b)) : [];
  const [lvl, setLvl] = useState<string>(levels.includes("0.1") ? "0.1" : (levels[0] ?? ""));
  const data = useMemo(() => {
    if (!h) return [];
    const assisted = h.by_level[lvl] ?? [];
    const sc = h.clean.reduce((a, b) => a + b, 0) || 1;
    const sa = assisted.reduce((a, b) => a + b, 0) || 1;
    return h.clean.map((c, i) => ({
      bin: `${h.edges[i].toFixed(2)}–${h.edges[i + 1].toFixed(2)}`,
      mid: (h.edges[i] + h.edges[i + 1]) / 2,
      clean: c / sc,
      assisted: (assisted[i] ?? 0) / sa,
    }));
  }, [h, lvl]);
  if (!h) return null;
  return (
    <Figure
      title="Score distributions: original vs substituted"
      actions={
        <div className="flex flex-wrap gap-2">
          <Segmented size="sm" label="Model" value={model} onChange={setModel} options={keys.map((k) => ({ value: k, label: MODEL_META[k].code }))} />
          <Segmented size="sm" label="Level" value={lvl} onChange={setLvl} options={levels.map((l) => ({ value: l, label: fmtLevel(Number(l)) }))} />
        </div>
      }
      caption="Share of test player-game variants per score bin (all strategies pooled at the selected level). Overlap is where original and substituted games are indistinguishable."
    >
      <Legend
        className="mb-3"
        items={[
          { label: "Original (0%)", color: "var(--ink-4)", kind: "bar" },
          { label: `Substituted (${fmtLevel(Number(lvl))})`, color: "var(--flag)", kind: "bar" },
        ]}
      />
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }} barGap={0} barCategoryGap={2}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="mid" {...AX} tickFormatter={(v: number) => v.toFixed(1)} interval={4} />
          <YAxis {...YAX} tickFormatter={(v: number) => fmtPct(v, 0)} />
          <Tooltip
            cursor={{ fill: "var(--paper-3)", fillOpacity: 0.5 }}
            content={<SeriesTip title={(l) => `score ≈ ${fmtNum(Number(l), 2)}`} fmt={(v) => fmtPct(v, 1)} />}
          />
          <Bar dataKey="clean" name="Original" fill="var(--ink-4)" isAnimationActive={false} radius={[2, 2, 0, 0]} />
          <Bar dataKey="assisted" name="Substituted" fill="var(--flag)" fillOpacity={0.8} isAnimationActive={false} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Figure>
  );
}

// ------------------------------------------------------------------ Pooled ROC curves
export function RocChart({ roc, metrics }: { roc: RocCurves; metrics?: Metrics }) {
  const keys = SCORE_ORDER.filter((k) => roc[k]?.fpr?.length && roc[k]!.fpr.length === roc[k]!.tpr.length);
  if (!keys.length) return null;
  return (
    <Figure
      title="Pooled ROC curves (test split)"
      caption="All test variants pooled (every strategy and level against original player-games), with balanced class weights. Legend values are each model's test ROC-AUC. The dashed diagonal is chance."
    >
      <Legend
        className="mb-3"
        items={[
          ...keys.map((k) => ({
            label: `${MODEL_META[k].code} · ${roc[k]!.label ?? metrics?.experiments[k]?.label ?? MODEL_META[k].name}${isNum(roc[k]!.auc) ? ` (${fmtNum(roc[k]!.auc, 3)})` : ""}`,
            color: MODEL_META[k].color,
          })),
          { label: "Chance", color: "var(--ink-4)", kind: "dash" as const },
        ]}
      />
      <div className="mx-auto max-w-[560px]">
        <ResponsiveContainer width="100%" aspect={1.15}>
          <LineChart margin={{ top: 6, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid />
            <XAxis
              type="number"
              dataKey="x"
              domain={[0, 1]}
              ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]}
              {...AX}
              label={{ value: "False-positive rate (original games flagged)", position: "insideBottom", offset: -2, fill: "var(--ink-3)", fontSize: 11 }}
              height={36}
            />
            <YAxis
              type="number"
              domain={[0, 1]}
              ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]}
              {...YAX}
              label={{ value: "True-positive rate", angle: -90, position: "insideLeft", offset: 12, fill: "var(--ink-3)", fontSize: 11 }}
              width={48}
            />
            <ReferenceLine
              segment={[
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ]}
              stroke="var(--ink-4)"
              strokeDasharray="4 4"
            />
            <Tooltip content={<SeriesTip title={(l) => `FPR ${fmtNum(Number(l), 3)}`} fmt={(v) => `TPR ${fmtNum(v, 3)}`} />} />
            {keys.map((k) => (
              <Line
                key={k}
                data={roc[k]!.fpr.map((x, i) => ({ x, y: roc[k]!.tpr[i] }))}
                dataKey="y"
                name={MODEL_META[k].code}
                type="stepAfter"
                stroke={MODEL_META[k].color}
                strokeWidth={k === "D_sf_maia_seq" ? 2.25 : 1.5}
                strokeDasharray={k === "A0_zt1" ? "4 3" : undefined}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Figure>
  );
}
