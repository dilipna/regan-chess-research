"use client";

import { ChevronDown } from "lucide-react";
import { useId } from "react";
import { Prov, type ProvKind } from "@/components/site/provenance";
import { cn } from "@/lib/utils";

export type Family = "regan" | "ours" | "finding";

const FAMILY: Record<Family, { band: string; rule: string; num: string; ring: string; soft: string }> = {
  regan: {
    band: "bg-tint-regan",
    rule: "border-regan",
    num: "text-regan",
    ring: "border-[color-mix(in_oklab,var(--prov-regan)_55%,var(--rule))]",
    soft: "bg-[color-mix(in_oklab,var(--prov-regan)_7%,var(--paper))]",
  },
  ours: {
    band: "bg-tint-ours",
    rule: "border-ours",
    num: "text-ours",
    ring: "border-[color-mix(in_oklab,var(--prov-ours)_55%,var(--rule))]",
    soft: "bg-[color-mix(in_oklab,var(--prov-ours)_7%,var(--paper))]",
  },
  finding: {
    band: "bg-tint-finding",
    rule: "border-finding",
    num: "text-finding",
    ring: "border-[color-mix(in_oklab,var(--prov-finding)_55%,var(--rule))]",
    soft: "bg-[color-mix(in_oklab,var(--prov-finding)_7%,var(--paper))]",
  },
};

export const familyCls = (f: Family) => FAMILY[f];

const PROV_OF: Record<Family, ProvKind> = { regan: "regan", ours: "ours", finding: "finding" };

/** One of the three dominant sections of the research story: full-width tinted band, large numeral, badge. */
export function StorySection({
  id,
  n,
  family,
  title,
  sub,
  children,
}: {
  id: string;
  n: number;
  family: Family;
  title: string;
  sub: React.ReactNode;
  children: React.ReactNode;
}) {
  const f = FAMILY[family];
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-14 border-t-[3px]", f.rule, f.band)}>
      <div className="mx-auto max-w-[1240px] px-4 pt-14 pb-16 sm:px-6 sm:pt-20 sm:pb-24">
        <div className="flex flex-wrap items-center gap-3">
          <Prov kind={PROV_OF[family]} />
        </div>
        <div className="mt-5 flex items-start gap-4 sm:gap-6">
          <span aria-hidden className={cn("num -mt-1 font-serif text-[56px] leading-none font-semibold sm:text-[84px]", f.num)}>
            {n}
          </span>
          <div className="min-w-0 max-w-3xl">
            <h2 id={`${id}-title`} className="font-serif text-[30px] leading-[1.08] font-semibold tracking-tight text-ink sm:text-[44px]">
              <span className="sr-only">{n}. </span>
              {title}
            </h2>
            <p className="mt-3 text-[16.5px] leading-relaxed text-ink-2 sm:text-[18px]">{sub}</p>
          </div>
        </div>
        <div className="mt-10 sm:mt-14">{children}</div>
      </div>
    </section>
  );
}

/**
 * Large clickable concept that expands in place (accordion item). The collapsed face shows the question and,
 * optionally, the one-word conclusion; the body follows conclusion → why → evidence → technical details.
 */
export function Concept({
  family,
  label,
  question,
  answer,
  icon,
  open,
  onToggle,
  children,
  star = false,
}: {
  family: Family;
  label: string;
  question: string;
  answer?: React.ReactNode;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  star?: boolean;
}) {
  const id = useId();
  const f = FAMILY[family];
  return (
    <div
      className={cn(
        "rounded-lg border bg-paper transition-[border-color,box-shadow] duration-200",
        open ? cn(f.ring, "shadow-[0_1px_0_var(--rule),0_6px_24px_-12px_color-mix(in_oklab,var(--ink)_25%,transparent)]") : "border-rule-strong hover:border-ink-4",
        star && !open && "border-[color-mix(in_oklab,var(--human)_45%,var(--rule))]",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className="flex w-full items-center gap-4 rounded-lg px-4 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-5 sm:py-5"
      >
        {icon && (
          <span aria-hidden className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", f.soft, f.num)}>
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-semibold tracking-[0.09em] text-ink-2 uppercase">{label}</span>
          <span className="mt-0.5 block font-serif text-[18px] leading-snug text-ink sm:text-[19.5px]">“{question}”</span>
        </span>
        {answer && <span className="hidden shrink-0 sm:block">{answer}</span>}
        <ChevronDown aria-hidden className={cn("size-5 shrink-0 text-ink-3 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {answer && <div className="-mt-2 px-4 pb-4 sm:hidden">{answer}</div>}
      {open && (
        <div id={id} className="reveal border-t border-rule px-4 pt-4 pb-5 sm:px-5">
          {children}
        </div>
      )}
    </div>
  );
}

/** Big plain-language reading: small caps label, large value, one-line meaning. */
export function Reading({
  label,
  value,
  tone = "ink",
  sub,
  className,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "engine" | "human" | "ink" | "flag";
  sub?: React.ReactNode;
  className?: string;
}) {
  const bar = tone === "engine" ? "bg-engine" : tone === "human" ? "bg-human" : tone === "flag" ? "bg-flag" : "bg-ink-3";
  return (
    <div className={cn("relative rounded-md border border-rule bg-paper py-3 pr-4 pl-5", className)}>
      <span aria-hidden className={cn("absolute inset-y-3 left-0 w-[3px] rounded-r", bar)} />
      <div className="text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">{label}</div>
      <div className="mt-1 text-[22px] leading-tight font-semibold text-ink">{value}</div>
      {sub && <div className="mt-1 text-[12.5px] leading-snug text-ink-3">{sub}</div>}
    </div>
  );
}

/** Answer chip shown on a collapsed concept. */
export function Answer({ children, tone }: { children: React.ReactNode; tone: "engine" | "human" | "ink" | "flag" }) {
  const cls =
    tone === "engine"
      ? "border-engine/35 bg-engine-soft text-engine"
      : tone === "human"
        ? "border-human/40 bg-human-soft text-[color-mix(in_oklab,var(--human)_70%,var(--ink))]"
        : tone === "flag"
          ? "border-flag/30 bg-flag-soft text-flag"
          : "border-rule-strong bg-paper-2 text-ink-2";
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12.5px] font-semibold", cls)}>{children}</span>;
}

/** Horizontal probability / proportion bar with a label and value. */
export function Bar({
  label,
  value,
  max = 1,
  color,
  valueText,
  emphasis = false,
  note,
}: {
  label: React.ReactNode;
  value: number;
  max?: number;
  color: string;
  valueText: string;
  emphasis?: boolean;
  note?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(4.5rem,7.5rem)_minmax(0,1fr)_3.75rem] items-center gap-3 text-[13px]">
      <span className={cn("num truncate", emphasis ? "font-semibold text-ink" : "text-ink-2")}>{label}</span>
      <span className="relative h-[10px] rounded-full bg-paper-3">
        <span
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(1.5, Math.min(100, (100 * value) / max))}%`, background: color }}
        />
      </span>
      <span className={cn("num text-right", emphasis ? "font-semibold text-ink" : "text-ink-2")}>{valueText}</span>
      {note && <span className="col-span-3 -mt-1 text-[11.5px] text-ink-3">{note}</span>}
    </div>
  );
}

/** Small "Section ends → next question" transition line. */
export function Transition({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[1240px] flex-col items-center px-4 py-12 text-center sm:px-6 sm:py-16">
      <span aria-hidden className="h-10 w-px bg-rule-strong" />
      <p className="mt-5 max-w-3xl font-serif text-[24px] leading-snug text-ink sm:text-[30px]">{children}</p>
      <span aria-hidden className="mt-5 h-10 w-px bg-rule-strong" />
    </div>
  );
}
