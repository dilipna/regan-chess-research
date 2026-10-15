import { BookOpen, EqualApproximately, FlaskConical, Plus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Provenance badges. Every important concept or number on the site belongs to exactly one family:
 *   regan    — REGAN — VERIFIED PUBLIC METHOD          (concepts cited from Regan's public materials; see Sources)
 *   ours     — CHESSASSISTLENS — OUR AUGMENTATION      (Maia-3, XGBoost, sequence features, SHAP, simulation, UI)
 *   approx   — CHESSASSISTLENS — OUR APPROXIMATION     (our simplified implementation of a Regan concept)
 *   finding  — EXPERIMENTAL FINDING                    (a measured result of our benchmark)
 * Each family has its own color, icon and wording, so color is never the only cue.
 */
export type ProvKind = "regan" | "ours" | "approx" | "finding";

const META: Record<ProvKind, { full: string; short: string; icon: LucideIcon; cls: string; title: string }> = {
  regan: {
    full: "Regan — Verified public method",
    short: "Regan · verified",
    icon: BookOpen,
    cls: "border-[color-mix(in_oklab,var(--prov-regan)_40%,transparent)] bg-[color-mix(in_oklab,var(--prov-regan)_9%,var(--paper))] text-[color-mix(in_oklab,var(--prov-regan)_85%,var(--ink))]",
    title: "Concept documented in Professor Regan's public materials (cited, with page numbers). Not implemented by MoveLens unless stated.",
  },
  ours: {
    full: "MoveLens — Our augmentation",
    short: "MoveLens",
    icon: Plus,
    cls: "border-[color-mix(in_oklab,var(--prov-ours)_40%,transparent)] bg-[color-mix(in_oklab,var(--prov-ours)_9%,var(--paper))] text-[color-mix(in_oklab,var(--prov-ours)_82%,var(--ink))]",
    title: "Added by MoveLens. Not part of Regan's documented framework.",
  },
  approx: {
    full: "MoveLens — Our approximation",
    short: "Our approximation",
    icon: EqualApproximately,
    cls: "border-[color-mix(in_oklab,var(--prov-ours)_40%,transparent)] border-dashed bg-paper text-[color-mix(in_oklab,var(--prov-ours)_82%,var(--ink))]",
    title: "Our simplified, empirical implementation inspired by a Regan concept. It does not reproduce his model or calibration.",
  },
  finding: {
    full: "Experimental finding",
    short: "Finding",
    icon: FlaskConical,
    cls: "border-[color-mix(in_oklab,var(--prov-finding)_40%,transparent)] bg-[color-mix(in_oklab,var(--prov-finding)_9%,var(--paper))] text-[color-mix(in_oklab,var(--prov-finding)_85%,var(--ink))]",
    title: "Measured on the held-out test split of our controlled decision-level substitution benchmark.",
  },
};

export function Prov({ kind, className, short = false }: { kind: ProvKind; className?: string; short?: boolean }) {
  const m = META[kind];
  const Icon = m.icon;
  return (
    <span
      title={m.title}
      className={cn(
        "relative inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-[1px] text-[10px] leading-[17px] font-semibold tracking-[0.06em] whitespace-nowrap uppercase",
        m.cls,
        className,
      )}
    >
      <Icon aria-hidden className="size-3" strokeWidth={2.25} />
      <span aria-hidden>{short ? m.short : m.full}</span>
      <span className="sr-only">
        Provenance: {m.full}. {m.title}
      </span>
    </span>
  );
}

export function ProvLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Prov kind="regan" />
      <Prov kind="ours" />
      <Prov kind="approx" />
      <Prov kind="finding" />
    </div>
  );
}
