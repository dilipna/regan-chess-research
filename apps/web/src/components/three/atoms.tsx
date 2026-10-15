"use client";

import { BookOpen, Brain, Hourglass, Sparkles } from "lucide-react";
import { Board } from "@/components/report/board";
import { fmtPct, isNum } from "@/lib/format";
import { MODEL_META, type ModelKey, type Status } from "@/lib/three";
import { cn } from "@/lib/utils";

const ICON = { R: BookOpen, Q: Sparkles, M: Brain } as const;

/** Model family badge: name + kind; color is never the only cue (icon + text). */
export function ModelBadge({ model, className, kind = true }: { model: ModelKey; className?: string; kind?: boolean }) {
  const m = MODEL_META[model];
  const Icon = ICON[model];
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-full"
        style={{ background: m.soft, color: m.color }}
      >
        <Icon className="size-4" strokeWidth={2.2} />
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] font-semibold tracking-[0.07em] uppercase" style={{ color: m.color }}>
          {m.name}
        </span>
        {kind && <span className="block text-[11.5px] leading-tight text-ink-3">{m.kind}</span>}
      </span>
    </span>
  );
}

/** Section badge used on the overview (REGAN — VERIFIED PUBLIC METHOD etc.). */
export function SectionBadge({ children, model }: { children: React.ReactNode; model: ModelKey }) {
  const m = MODEL_META[model];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[2px] text-[10.5px] leading-[17px] font-semibold tracking-[0.07em] uppercase"
      style={{ borderColor: `color-mix(in oklab, ${m.color} 40%, transparent)`, background: m.soft, color: m.color }}
    >
      {children}
    </span>
  );
}

export function Pending({ what = "Qwen3-8B-Base scores", className }: { what?: string; className?: string }) {
  return (
    <div className={cn("flex items-start gap-2 rounded-md border border-dashed border-rule-strong bg-paper-2 p-3 text-[12.5px] leading-relaxed text-ink-3", className)}>
      <Hourglass className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        <span className="font-semibold text-ink-2">Pending — not yet computed.</span> {what} have not been produced yet. No value is
        shown until real model outputs exist; nothing is estimated or filled in.
      </span>
    </div>
  );
}

/** Probability (or pending / not defined) with a fixed rendering rule for every model. */
export function Prob({ value, status = "ok", digits = 1, undefinedText = "not defined" }: { value: number | null | undefined; status?: Status; digits?: number; undefinedText?: string }) {
  if (status === "pending") return <span className="text-ink-4 italic">pending</span>;
  if (!isNum(value)) return <span className="text-ink-4 italic">{undefinedText}</span>;
  return <span className="num">{value < 0.001 && value > 0 ? "<0.1%" : fmtPct(value, digits)}</span>;
}

export function ProbBar({ value, color, className }: { value: number | null | undefined; color: string; className?: string }) {
  return (
    <span className={cn("relative block h-[7px] w-full rounded-full bg-paper-3", className)}>
      {isNum(value) && (
        <span
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
          style={{ width: `${Math.max(1.5, Math.min(100, value * 100))}%`, background: color }}
        />
      )}
    </span>
  );
}

export interface ArrowSpec {
  uci: string;
  color: string;
  label: string;
}

export function ThreeBoard({
  id,
  fen,
  orientation,
  arrows,
  title,
  caption,
}: {
  id: string;
  fen: string;
  orientation: "white" | "black";
  arrows: ArrowSpec[];
  title?: React.ReactNode;
  caption?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      {title && <div className="mb-3 text-[13px] font-medium text-ink">{title}</div>}
      <Board id={id} fen={fen} orientation={orientation} arrows={arrows.map((a) => ({ uci: a.uci, color: a.color }))} />
      {arrows.length > 0 && (
        <ul className="mt-3 space-y-1 text-[12.5px]" aria-label="Arrows on the board">
          {arrows.map((a) => (
            <li key={a.uci + a.label} className="flex items-center gap-2">
              <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden className="shrink-0">
                <line x1="1" y1="5" x2="15" y2="5" stroke={a.color} strokeWidth="2.5" strokeLinecap="round" />
                <path d="M14 1 L21 5 L14 9 Z" fill={a.color} />
              </svg>
              <span className="text-ink-2">{a.label}</span>
            </li>
          ))}
        </ul>
      )}
      {caption && <div className="mt-3 text-[12px] leading-relaxed text-ink-3">{caption}</div>}
    </div>
  );
}
