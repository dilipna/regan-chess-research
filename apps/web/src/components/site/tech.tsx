"use client";

import { ChevronDown, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Prov, type ProvKind } from "./provenance";

/**
 * Progressive disclosure: summary first, technical details on demand. Native <details> keeps the content
 * in the HTML (readable without JavaScript and by text-only tools) while staying collapsed by default.
 */
export function TechDetails({
  children,
  label = "Technical details",
  className,
  defaultOpen = false,
}: {
  children: React.ReactNode;
  label?: string;
  className?: string;
  defaultOpen?: boolean;
}) {
  return (
    <details className={cn("group/tech mt-3", className)} open={defaultOpen || undefined}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded border border-rule-strong bg-paper px-2.5 py-1 text-[12px] font-medium text-ink-2 transition-colors duration-150 select-none hover:border-ink-3 hover:text-ink [&::-webkit-details-marker]:hidden">
        <ChevronDown className="size-3.5 transition-transform duration-200 group-open/tech:rotate-180" aria-hidden />
        <span className="group-open/tech:hidden">{label}</span>
        <span className="hidden group-open/tech:inline">Hide {label.toLowerCase()}</span>
      </summary>
      <div className="mt-3 rounded-md border border-rule bg-paper-2 p-3.5 text-[12.5px] sm:p-4">{children}</div>
    </details>
  );
}

/** Key/value grid used inside technical panels. */
export function KV({ rows, className }: { rows: [React.ReactNode, React.ReactNode][]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-1.5", className)}>
      {rows.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-ink-3">{k}</dt>
          <dd className="num min-w-0 break-words text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TechBlock({ title, prov, children }: { title: string; prov?: ProvKind; children: React.ReactNode }) {
  return (
    <div className="border-b border-rule pb-3 last:border-0 last:pb-0 [&+&]:pt-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="text-[11.5px] font-semibold tracking-[0.05em] text-ink-2 uppercase">{title}</div>
        {prov && <Prov kind={prov} short />}
      </div>
      {children}
    </div>
  );
}

/** Plain term with a tooltip: what it means, technical name, provenance. */
export function Term({
  children,
  tip,
  technical,
  prov,
}: {
  children: React.ReactNode;
  tip: React.ReactNode;
  technical?: string;
  prov?: ProvKind;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="cursor-help underline decoration-ink-4 decoration-dotted underline-offset-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[300px] border border-rule-strong bg-paper p-3 text-[12px] leading-relaxed text-ink-2 shadow-md">
        <div>{tip}</div>
        {(technical || prov) && (
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-rule pt-2 text-[11px] text-ink-3">
            {technical && <span className="num">{technical}</span>}
            {prov && <Prov kind={prov} short />}
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export function InfoTip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label="More information" className="inline-flex text-ink-4 hover:text-ink-2">
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[300px] border border-rule-strong bg-paper p-3 text-[12px] leading-relaxed text-ink-2 shadow-md">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
