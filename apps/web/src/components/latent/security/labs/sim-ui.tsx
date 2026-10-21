"use client";

// Shared pieces for the simulator labs: defense switches, the context window, the step trace and outcome badges.

import { cn } from "@/lib/utils";
import { DEFENSE_INFO, type Defenses, type Seg, type Step } from "@/lib/latent/security/sim";

export function H({ n, children }: { n: number; children: React.ReactNode }) {
  return <h2 className="flex items-center gap-2.5 text-[17px] font-semibold text-ink"><span className="num flex h-6 w-6 items-center justify-center rounded-full border border-rule-strong font-mono text-[11.5px] text-ink-3">{n}</span>{children}</h2>;
}

export function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={o.id === value} onClick={() => onChange(o.id)}
          className={cn("rounded-full border px-3 py-1.5 text-[13px] transition-colors", o.id === value ? "border-[var(--role-resid)] bg-[var(--role-resid-soft)] text-ink" : "border-rule-strong text-ink-2 hover:text-ink")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const KIND_STYLE = { likelihood: "text-[var(--role-attn-ink)]", impact: "text-[var(--role-norm-ink)]", detection: "text-ink-3" } as const;

export function DefenseSwitches({ keys, d, onChange }: { keys: (keyof Defenses)[]; d: Defenses; onChange: (d: Defenses) => void }) {
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2">
      {keys.map((k) => {
        const info = DEFENSE_INFO[k], on = !!d[k];
        return (
          <li key={k}>
            <button type="button" aria-pressed={on} onClick={() => onChange({ ...d, [k]: !on })}
              className={cn("flex h-full w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors", on ? "border-[var(--role-norm)] bg-[var(--role-norm-soft)]" : "border-rule bg-paper hover:border-rule-strong")}>
              <span aria-hidden className={cn("mt-0.5 flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors", on ? "bg-[var(--role-norm)]" : "bg-paper-3")}>
                <span className={cn("h-3 w-3 rounded-full bg-paper transition-transform", on && "translate-x-3")} />
              </span>
              <span>
                <span className="block text-[13.5px] font-medium text-ink">{info.label}</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-ink-3"><span className={cn("font-medium", KIND_STYLE[info.kind])}>{info.kind === "likelihood" ? "Lowers the odds" : info.kind === "impact" ? "Limits the damage" : "Detects"}</span> · {info.what}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function ContextWindow({ segs }: { segs: Seg[] }) {
  return (
    <ol className="grid gap-1.5" aria-label="Context window">
      {segs.map((s, i) => (
        <li key={i} className={cn("rounded-xl border px-3 py-2", s.trust === "untrusted" ? "border-[color-mix(in_oklab,var(--bad)_40%,transparent)] bg-[var(--bad-soft)]" : "border-rule bg-paper")}>
          <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
            <span className="font-medium text-ink-2">{s.label}</span>
            <span className={cn("rounded-full px-2 py-px font-medium", s.trust === "untrusted" ? "bg-[color-mix(in_oklab,var(--bad)_25%,transparent)] text-[var(--bad-ink)]" : "bg-paper-3 text-ink-3")}>{s.trust}</span>
          </div>
          <p className="mt-1 font-mono text-[12px] leading-relaxed break-words whitespace-pre-wrap text-ink-2">{s.text}</p>
        </li>
      ))}
    </ol>
  );
}

const STEP_STYLE: Record<Step["kind"], { tag: string; cls: string }> = {
  context: { tag: "read", cls: "text-ink-4" },
  dropped: { tag: "filtered", cls: "text-[var(--role-attn-ink)]" },
  ignored: { tag: "ignored", cls: "text-[var(--role-attn-ink)]" },
  proposed: { tag: "proposed", cls: "text-[var(--role-mlp-ink)]" },
  blocked: { tag: "blocked", cls: "text-[var(--role-norm-ink)]" },
  held: { tag: "approval", cls: "text-[var(--role-resid-ink)]" },
  rejected: { tag: "rejected", cls: "text-[var(--role-norm-ink)]" },
  executed: { tag: "executed", cls: "text-ink" },
  sandboxed: { tag: "sandboxed", cls: "text-[var(--role-norm-ink)]" },
  leak: { tag: "leak", cls: "text-[var(--bad-ink)]" },
  memory: { tag: "memory", cls: "text-[var(--role-mlp-ink)]" },
};

export function Trace({ steps, isHarm }: { steps: Step[]; isHarm?: (s: Step) => boolean }) {
  const shown = steps.filter((s) => s.kind !== "context");
  return (
    <ol className="grid gap-1 rounded-xl border border-rule bg-paper-2 p-3 font-mono text-[12px] leading-relaxed" aria-label="What happened">
      {shown.length === 0 && <li className="text-ink-4">Nothing beyond reading the context.</li>}
      {shown.map((s, i) => {
        const harm = s.kind === "leak" || (isHarm?.(s) ?? false);
        const st = STEP_STYLE[s.kind];
        return (
          <li key={i} className="grid grid-cols-[84px_1fr] gap-2">
            <span className={cn("uppercase tracking-wide", harm ? "text-[var(--bad-ink)]" : st.cls)}>{harm && s.kind === "executed" ? "harm" : st.tag}</span>
            <span className={cn("break-words", harm ? "text-[var(--bad-ink)]" : "text-ink-2")}>{s.text}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function Outcome({ items }: { items: { label: string; bad: boolean; detail?: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-live="polite">
      {items.map((x) => (
        <li key={x.label} className={cn("rounded-xl border px-3 py-2 text-[13px]", x.bad ? "border-[color-mix(in_oklab,var(--bad)_50%,transparent)] bg-[var(--bad-soft)] text-ink" : "border-[color-mix(in_oklab,var(--role-norm)_50%,transparent)] bg-[var(--role-norm-soft)] text-ink")}>
          <span className={cn("mr-1.5 font-semibold", x.bad ? "text-[var(--bad-ink)]" : "text-[var(--role-norm-ink)]")}>{x.bad ? "✗" : "✓"}</span>{x.label}
          {x.detail && <span className="ml-1 text-ink-3">· {x.detail}</span>}
        </li>
      ))}
    </ul>
  );
}

export function Presets({ presets, onPick }: { presets: { label: string; d: Defenses }[]; onPick: (d: Defenses) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[12px] text-ink-4">Quick set:</span>
      {presets.map((p) => <button key={p.label} type="button" onClick={() => onPick(p.d)} className="rounded-full border border-rule-strong px-2.5 py-1 text-[12px] text-ink-2 hover:text-ink">{p.label}</button>)}
    </div>
  );
}
