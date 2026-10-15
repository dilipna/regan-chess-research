"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MouseHandlerDataParam } from "recharts";
import { Legend, Segmented } from "@/components/site/atoms";
import { fmtNum, fmtPct, isNum, moveLabel } from "@/lib/format";
import type { PlayerReport } from "@/lib/types";

interface Datum {
  ply: number;
  move_no: number;
  label: string;
  eligible: boolean;
  t1hit: number | null;
  t1miss: number | null;
  roll_t1: number | null;
  maia_p: number | null;
  surprisal: number | null;
  roll_surprisal: number | null;
  difficulty: number | null;
  hard: boolean;
  flag: boolean;
  subst: boolean;
  top1?: boolean;
}

const Y_W = 40;
const SYNC = "ply-timeline";

export function Timeline({
  player,
  currentPly,
  onSelectPly,
}: {
  player: PlayerReport;
  currentPly: number | null;
  onSelectPly: (ply: number) => void;
}) {
  const [humanMode, setHumanMode] = useState<"likelihood" | "surprisal">("likelihood");
  const hardThr = player.hard_threshold;

  const data: Datum[] = useMemo(
    () =>
      player.timeline.map((r) => ({
        ply: r.ply,
        move_no: r.move_no,
        label: moveLabel(r.move_no, r.color, r.display_san || r.san),
        eligible: r.eligible,
        t1hit: r.eligible && r.top1 ? 1 : null,
        t1miss: r.eligible && r.top1 === false ? 0 : null,
        roll_t1: r.roll_t1,
        maia_p: r.maia_p,
        surprisal: r.surprisal,
        roll_surprisal: r.roll_surprisal,
        difficulty: r.difficulty,
        hard: isNum(r.difficulty) && isNum(hardThr) && r.difficulty >= hardThr,
        flag: r.flag_triple,
        subst: r.substituted,
        top1: r.top1,
      })),
    [player.timeline, hardThr],
  );

  const flags = data.filter((d) => d.flag).map((d) => d.ply);
  const substs = data.filter((d) => d.subst).map((d) => d.ply);
  const moveNoByPly = useMemo(() => new Map(data.map((d) => [d.ply, d.move_no])), [data]);
  const hasCurrent = currentPly !== null && moveNoByPly.has(currentPly);
  const maxSurprisal = Math.max(1, ...data.map((d) => (isNum(d.surprisal) ? d.surprisal : 0)));

  const click = (s: MouseHandlerDataParam) => {
    const lab = s?.activeLabel;
    const n = Number(lab);
    if (lab !== undefined && Number.isFinite(n) && moveNoByPly.has(n)) return onSelectPly(n);
    const i = Number(s?.activeTooltipIndex);
    if (Number.isFinite(i) && data[i]) onSelectPly(data[i].ply);
  };

  const common = {
    data,
    syncId: SYNC,
    onClick: click,
    margin: { top: 6, right: 8, bottom: 0, left: 0 },
    style: { cursor: "pointer" },
  };

  const backdrop = (
    <>
      {flags.map((p) => (
        <ReferenceLine key={"f" + p} x={p} stroke="var(--flag)" strokeOpacity={0.16} strokeWidth={7} ifOverflow="hidden" />
      ))}
      {hasCurrent && <ReferenceLine x={currentPly!} stroke="var(--ink)" strokeWidth={1.25} />}
    </>
  );

  const xHidden = <XAxis dataKey="ply" hide />;

  return (
    <div className="space-y-1">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Legend
          items={[
            { label: "Top-1 match / miss", color: "var(--engine)", kind: "dot" },
            { label: "Rolling top-1 (8 decisions)", color: "var(--engine)" },
            { label: humanMode === "likelihood" ? "Maia-3 predicted probability" : "Maia-3 surprisal (nats)", color: "var(--human)" },
            { label: "Position difficulty", color: "var(--ink-4)", kind: "bar" },
            { label: "Triple flag", color: "color-mix(in oklab, var(--flag) 30%, transparent)", kind: "bar" },
            { label: "Counterfactual substitution", color: "var(--flag)", kind: "dot" },
          ]}
        />
        <Segmented
          size="sm"
          label="Human track"
          value={humanMode}
          onChange={setHumanMode}
          options={[
            { value: "likelihood", label: "Likelihood" },
            { value: "surprisal", label: "Surprisal" },
          ]}
        />
      </div>

      <Track title="Engine agreement">
        <ResponsiveContainer width="100%" height={104}>
          <ComposedChart {...common}>
            <CartesianGrid vertical={false} strokeDasharray="0" />
            {xHidden}
            <YAxis
              width={Y_W}
              domain={[-0.15, 1.3]}
              ticks={[0, 0.5, 1]}
              tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
              axisLine={false}
              tickLine={false}
            />
            {backdrop}
            <Tooltip content={<TipContent />} cursor={{ stroke: "var(--ink-4)", strokeWidth: 1 }} />
            <Line
              dataKey="roll_t1"
              stroke="var(--engine)"
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              dataKey="t1hit"
              stroke="none"
              dot={{ r: 3, fill: "var(--engine)", stroke: "var(--paper)", strokeWidth: 1 }}
              activeDot={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="t1miss"
              stroke="none"
              dot={{ r: 2.5, fill: "var(--paper)", stroke: "var(--ink-4)", strokeWidth: 1 }}
              activeDot={false}
              isAnimationActive={false}
            />
            {substs.map((p) => (
              <ReferenceDot key={"s" + p} x={p} y={1.2} r={4} fill="var(--flag)" stroke="var(--paper)" ifOverflow="visible" />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </Track>

      <Track title={humanMode === "likelihood" ? "Maia-3 predicted probability" : "Maia-3 surprisal"}>
        <ResponsiveContainer width="100%" height={96}>
          <ComposedChart {...common}>
            <CartesianGrid vertical={false} />
            {xHidden}
            {humanMode === "likelihood" ? (
              <YAxis
                width={Y_W}
                domain={[0, 1]}
                ticks={[0, 0.5, 1]}
                tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                axisLine={false}
                tickLine={false}
              />
            ) : (
              <YAxis
                width={Y_W}
                domain={[0, Math.ceil(maxSurprisal)]}
                tickCount={3}
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
              />
            )}
            {backdrop}
            <Tooltip content={<TipContent />} cursor={{ stroke: "var(--ink-4)", strokeWidth: 1 }} />
            {humanMode === "likelihood" ? (
              <Line
                dataKey="maia_p"
                stroke="var(--human)"
                strokeWidth={1.25}
                strokeOpacity={0.55}
                dot={{ r: 2.5, fill: "var(--human)", stroke: "var(--paper)", strokeWidth: 1 }}
                activeDot={{ r: 4 }}
                connectNulls
                isAnimationActive={false}
              />
            ) : (
              <>
                <Line
                  dataKey="surprisal"
                  stroke="none"
                  dot={{ r: 2.5, fill: "var(--human)", stroke: "var(--paper)", strokeWidth: 1 }}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
                <Line
                  dataKey="roll_surprisal"
                  stroke="var(--human)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </Track>

      <Track title="Position difficulty">
        <ResponsiveContainer width="100%" height={110}>
          <ComposedChart {...common}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="ply"
              tickFormatter={(p: number) => String(moveNoByPly.get(p) ?? "")}
              interval="preserveStartEnd"
              minTickGap={18}
              tickLine={false}
              axisLine={{ stroke: "var(--rule-strong)" }}
              height={22}
            />
            <YAxis width={Y_W} domain={[0, 1]} ticks={[0, 0.5, 1]} axisLine={false} tickLine={false} />
            {backdrop}
            {isNum(hardThr) && (
              <ReferenceLine
                y={hardThr}
                stroke="var(--ink-3)"
                strokeDasharray="3 3"
                label={{ value: "hard", position: "insideTopRight", fill: "var(--ink-3)", fontSize: 10 }}
              />
            )}
            <Tooltip content={<TipContent />} cursor={{ fill: "var(--paper-3)", fillOpacity: 0.6 }} />
            <Bar dataKey="difficulty" isAnimationActive={false} radius={[2, 2, 0, 0]} maxBarSize={10}>
              {data.map((d) => (
                <Cell key={d.ply} fill={d.hard ? "var(--ink-2)" : "var(--ink-4)"} fillOpacity={d.eligible ? 0.85 : 0.35} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </Track>
      <div className="flex justify-between pl-10 text-[11px] text-ink-4">
        <span>Move number · click any point to move the board to that decision</span>
      </div>
    </div>
  );
}

function Track({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="pl-10 text-[11px] font-medium tracking-wide text-ink-3">{title}</div>
      {children}
    </div>
  );
}

function TipContent({ active, payload }: { active?: boolean; payload?: { payload: Datum }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-rule-strong bg-paper px-3 py-2 text-[12px] shadow-sm">
      <div className="num mb-1 font-medium text-ink">{d.label}</div>
      <div className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-ink-2">
        <span className="text-ink-3">Top-1 match</span>
        <span className="num text-right">{d.top1 === undefined ? "—" : d.top1 ? "yes" : "no"}</span>
        <span className="text-ink-3">Rolling top-1</span>
        <span className="num text-right">{fmtPct(d.roll_t1, 0)}</span>
        <span className="text-ink-3">Maia-3 probability</span>
        <span className="num text-right">{fmtPct(d.maia_p, 1)}</span>
        <span className="text-ink-3">Surprisal</span>
        <span className="num text-right">{fmtNum(d.surprisal, 2)}</span>
        <span className="text-ink-3">Difficulty</span>
        <span className="num text-right">{fmtNum(d.difficulty, 2)}</span>
      </div>
      {(d.subst || d.flag || !d.eligible) && (
        <div className="mt-1.5 space-y-0.5 text-[11px]">
          {d.subst && <div className="text-flag">Counterfactual substitution</div>}
          {d.flag && <div className="text-flag">Triple flag</div>}
          {!d.eligible && <div className="text-ink-3">Not an eligible decision</div>}
        </div>
      )}
    </div>
  );
}
