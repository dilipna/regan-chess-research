"use client";

import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

export function Chip({
  children,
  tone = "neutral",
  className,
  title,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "engine" | "human" | "flag" | "solid";
  className?: string;
  title?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "border-rule-strong text-ink-2 bg-paper",
    engine: "border-engine/30 text-engine bg-engine-soft",
    human: "border-human/35 text-[color-mix(in_oklab,var(--human)_75%,var(--ink))] bg-human-soft",
    flag: "border-flag/30 text-flag bg-flag-soft",
    solid: "border-ink bg-ink text-paper",
  };
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-[1px] text-[11px] leading-[18px] font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  className,
  tone,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
  tone?: "engine" | "human" | "flag";
}) {
  const toneCls = tone === "engine" ? "bg-engine" : tone === "human" ? "bg-human" : tone === "flag" ? "bg-flag" : "";
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-center gap-1.5 text-[11.5px] text-ink-3">
        {tone && <span aria-hidden className={cn("inline-block h-2 w-2 rounded-full", toneCls)} />}
        <span className="truncate">{label}</span>
      </div>
      <div className="num mt-0.5 text-[17px] leading-tight text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-[11.5px] leading-snug text-ink-3">{sub}</div>}
    </div>
  );
}

export function LoadState({ error, label = "Loading data" }: { error?: string; label?: string }) {
  if (error)
    return (
      <div className="rounded-md border border-flag/30 bg-flag-soft px-4 py-3 text-[13px] text-ink-2">
        Could not load data: <span className="num">{error}</span>
      </div>
    );
  return (
    <div className="flex items-center gap-3 py-16 text-[13px] text-ink-3" aria-live="polite">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-3" />
      {label}…
    </div>
  );
}

export function DownloadButton({
  onClick,
  href,
  children,
  className,
  download,
}: {
  onClick?: () => void;
  href?: string;
  children: React.ReactNode;
  className?: string;
  download?: boolean | string;
}) {
  const cls = cn(
    "inline-flex items-center gap-1.5 rounded border border-rule-strong bg-paper px-2.5 py-1 text-[12px] text-ink-2 transition-colors duration-150 hover:border-ink-3 hover:text-ink",
    className,
  );
  if (href)
    return (
      <a href={href} className={cls} download={download === true ? "" : download || undefined}>
        <Download className="size-3.5" aria-hidden />
        {children}
      </a>
    );
  return (
    <button type="button" onClick={onClick} className={cls}>
      <Download className="size-3.5" aria-hidden />
      {children}
    </button>
  );
}

/** Segmented control (radio group) styled as hairline buttons. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; title?: string }[];
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex max-w-full overflow-x-auto rounded-md border border-rule-strong bg-paper p-0.5 no-scrollbar", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              "shrink-0 rounded-[4px] whitespace-nowrap transition-colors duration-150",
              size === "sm" ? "px-2 py-0.5 text-[12px]" : "px-3 py-1 text-[13px]",
              active ? "bg-ink text-paper" : "text-ink-3 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Legend({ items, className }: { items: { label: string; color: string; kind?: "line" | "dot" | "dash" | "bar" }[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-ink-3", className)}>
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          {it.kind === "dot" ? (
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: it.color }} />
          ) : it.kind === "bar" ? (
            <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: it.color }} />
          ) : it.kind === "dash" ? (
            <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: it.color }} />
          ) : (
            <span className="inline-block h-[2px] w-4 rounded" style={{ background: it.color }} />
          )}
          {it.label}
        </span>
      ))}
    </div>
  );
}
