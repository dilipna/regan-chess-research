"use client";

// Shared visual kit for the LatentLens journey and labs. Every visual element that shows numbers carries a provenance
// label (Prov). Roles always pair colour with an icon and a word.
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { markProgress } from "@/lib/latent/journey";

// ------------------------------------------------------------------ provenance
export type ProvKind = "toy" | "recorded" | "live" | "pending";
export const PROV_LABEL: Record<ProvKind, string> = {
  toy: "Toy calculation",
  recorded: "Recorded Qwen measurement",
  live: "Live model computation",
  pending: "Experiment pending",
};
export function Prov({ kind, detail }: { kind: ProvKind; detail?: string }) {
  const cls: Record<ProvKind, string> = {
    toy: "border-dashed border-ink-3 text-ink-2 bg-paper",
    recorded: "border-[var(--role-resid)] text-[var(--role-resid-ink)] bg-[var(--role-resid-soft)]",
    live: "border-[var(--role-norm)] text-[var(--role-norm-ink)] bg-[var(--role-norm-soft)]",
    pending: "border-ink bg-ink text-paper",
  };
  const icon: Record<ProvKind, string> = { toy: "✎", recorded: "●", live: "▶", pending: "◷" };
  return (
    <span className={cn("inline-flex max-w-full flex-wrap items-center gap-x-1.5 rounded-2xl border px-2.5 py-0.5 text-[12px] font-medium", cls[kind])}
      title={detail}>
      <span className="whitespace-nowrap"><span aria-hidden>{icon[kind]}</span> {PROV_LABEL[kind]}</span>{detail && <span className="min-w-0 font-normal opacity-80">· {detail}</span>}
    </span>
  );
}

// ------------------------------------------------------------------ roles
export type Role = "resid" | "norm" | "attn" | "mlp" | "out";
export const ROLE: Record<Role, { label: string; icon: string }> = {
  resid: { label: "residual stream", icon: "═" },
  norm: { label: "normalization", icon: "⇕" },
  attn: { label: "attention", icon: "⇄" },
  mlp: { label: "MLP", icon: "◆" },
  out: { label: "output", icon: "▸" },
};
export const roleClass = (r: Role) => (r === "out" ? "role-resid" : `role-${r}`);
export function RoleTag({ role, children }: { role: Role; children?: React.ReactNode }) {
  return (
    <span className={cn(roleClass(role), "inline-flex items-center gap-1.5 rounded-md border border-[var(--role)] bg-[var(--role-soft)] px-2 py-0.5 text-[12.5px] font-medium text-[var(--role-ink)]")}>
      <span aria-hidden>{ROLE[role].icon}</span>{children ?? ROLE[role].label}
    </span>
  );
}

// ------------------------------------------------------------------ vectors
export function VectorBars({ values, role = "resid", label, compare, compareLabel, maxAbs, total, height = 120, showValues = true }: {
  values: number[]; role?: Role; label?: string; compare?: number[]; compareLabel?: string; maxAbs?: number; total?: number; height?: number; showValues?: boolean;
}) {
  const M = maxAbs ?? Math.max(1e-9, ...values.map(Math.abs), ...(compare ?? []).map(Math.abs));
  const n = values.length, bw = 30, gap = 8, W = n * (bw + gap) + 4, mid = height / 2;
  const h = (v: number) => (Math.abs(v) / M) * (mid - 14);
  const desc = `${label ?? "vector"}: ${values.map((v) => v.toFixed(2)).join(", ")}${total && total > n ? `, plus ${(total - n).toLocaleString("en-US")} dimensions not shown` : ""}`;
  return (
    <figure className={cn(roleClass(role), "min-w-0")}>
      {label && <figcaption className="mb-1 text-[13px] font-medium text-ink-2">{label}</figcaption>}
      <div className="flex items-end gap-2">
        <svg viewBox={`0 0 ${W} ${height + 18}`} role="img" aria-label={desc} className="h-auto min-w-0 flex-1" style={{ maxWidth: W }}>
          <line x1="0" x2={W} y1={mid} y2={mid} stroke="var(--rule-strong)" />
          {values.map((v, i) => {
            const x = 2 + i * (bw + gap);
            const c = compare?.[i];
            return (
              <g key={i}>
                {c !== undefined && <rect x={x} y={c >= 0 ? mid - h(c) : mid} width={bw} height={Math.max(1, h(c))} fill="none" stroke="var(--ink-4)" strokeDasharray="3 2" />}
                <rect className="ll-anim" x={x + 4} y={v >= 0 ? mid - h(v) : mid} width={bw - 8} height={Math.max(1.5, h(v))} rx="2" fill="var(--role)" />
                {showValues && <text x={x + bw / 2} y={v >= 0 ? mid - h(v) - 4 : mid + h(v) + 11} textAnchor="middle" fontSize="10.5" fill="var(--ink-2)" className="font-mono">{v.toFixed(2)}</text>}
                <text x={x + bw / 2} y={height + 14} textAnchor="middle" fontSize="10" fill="var(--ink-4)" className="font-mono">{i}</text>
              </g>
            );
          })}
        </svg>
        {total && total > n && <span className="pb-6 text-[12px] whitespace-nowrap text-ink-3">… +{(total - n).toLocaleString("en-US")} dims<br />not shown</span>}
      </div>
      {compare && <p className="mt-0.5 text-[11.5px] text-ink-3">Dashed outline: {compareLabel ?? "before"}. Filled bar: now.</p>}
    </figure>
  );
}

// ------------------------------------------------------------------ matrices
export function Grid({ m, rows, cols, role = "attn", fmt = (v) => v.toFixed(2), highlightRow, caption, colorScale = true }: {
  m: (number | null)[][]; rows: string[]; cols: string[]; role?: Role; fmt?: (v: number) => string; highlightRow?: number; caption?: string; colorScale?: boolean;
}) {
  const vals = m.flat().filter((v): v is number => v !== null && Number.isFinite(v));
  const M = Math.max(1e-9, ...vals.map(Math.abs));
  return (
    <figure className={cn(roleClass(role), "min-w-0")}>
      {caption && <figcaption className="mb-1.5 text-[13px] font-medium text-ink-2">{caption}</figcaption>}
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-[3px] text-[12px]">
          <thead><tr><th className="pr-1 text-left font-normal text-ink-4"><span className="sr-only">row</span></th>{cols.map((c, j) => <th key={j} scope="col" className="max-w-[86px] truncate px-1 text-center font-mono font-normal text-ink-3">{c}</th>)}</tr></thead>
          <tbody>
            {m.map((row, i) => (
              <tr key={i} className={cn(highlightRow !== undefined && highlightRow !== i && "opacity-45")}>
                <th scope="row" className="max-w-[110px] truncate pr-2 text-right font-mono font-normal text-ink-3">{rows[i]}</th>
                {row.map((v, j) => v === null ? (
                  <td key={j} className="h-9 min-w-12 rounded-[3px] text-center text-ink-4" title="future position: masked"
                    style={{ background: "repeating-linear-gradient(135deg, var(--paper-2) 0 5px, var(--paper-3) 5px 7px)" }}>
                    <span aria-label="masked">🔒</span>
                  </td>
                ) : (
                  <td key={j} className="ll-anim num h-9 min-w-12 rounded-[3px] px-1 text-center"
                    style={{ background: colorScale ? `color-mix(in oklab, var(--role) ${Math.round((Math.abs(v) / M) * 55)}%, var(--paper))` : "var(--paper-2)",
                      color: "var(--ink)" }}>{fmt(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

// ------------------------------------------------------------------ tokens
export interface Tok { pos: number; id: number; text: string; piece?: string; prefix?: boolean }
export const showTok = (s: string) => s.replace(/ /g, "␣").replace(/\n/g, "↵");

export function TokenStrip({ tokens, selected, onSelect, showIds = true, label = "Tokens", disabled }: {
  tokens: Tok[]; selected?: number; onSelect?: (pos: number) => void; showIds?: boolean; label?: string; disabled?: (pos: number) => boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {tokens.map((t) => {
        const sel = t.pos === selected, off = disabled?.(t.pos);
        return (
          <button key={t.pos} type="button" role="radio" aria-checked={sel} disabled={off || !onSelect} onClick={() => onSelect?.(t.pos)}
            aria-label={`position ${t.pos}, token ${t.prefix ? "document start" : t.text}${showIds ? `, id ${t.id}` : ""}`}
            className={cn("ll-anim group flex min-w-[64px] flex-col items-start rounded-lg border-2 px-3 py-2 text-left",
              sel ? "border-ink bg-ink text-paper shadow-[0_6px_16px_-8px_rgba(0,0,0,.8)]" : "border-rule-strong bg-paper text-ink hover:border-ink-3",
              t.prefix && !sel && "border-dashed", off && "cursor-not-allowed opacity-40")}>
            <span className={cn("text-[10.5px] font-medium tracking-wide uppercase", sel ? "text-paper/70" : "text-ink-4")}>pos {t.pos}</span>
            <span className="font-mono text-[17px] leading-tight whitespace-pre">{t.prefix ? "⟨start⟩" : showTok(t.text)}</span>
            {showIds && <span className={cn("num text-[11.5px]", sel ? "text-paper/80" : "text-ink-3")}>id {t.id}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ cards and disclosure
export function TensorCard({ title, captured, shape, shown, kind, children, className }: {
  title: string; captured: string; shape: string; shown: string; kind: ProvKind; children?: React.ReactNode; className?: string;
}) {
  return (
    <section className={cn("ll-panel min-w-0 rounded-xl border border-rule bg-paper p-4 sm:p-5", className)}>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <h4 className="text-[15px] font-semibold text-ink">{title}</h4>
        <Prov kind={kind} />
      </div>
      <dl className="mb-3 grid gap-x-4 gap-y-0.5 text-[12.5px] text-ink-3 sm:grid-cols-[auto_1fr]">
        <dt className="font-medium text-ink-2">Captured</dt><dd>{captured}</dd>
        <dt className="font-medium text-ink-2">Shape</dt><dd className="font-mono">{shape}</dd>
        <dt className="font-medium text-ink-2">Shown</dt><dd>{shown}</dd>
      </dl>
      {children}
    </section>
  );
}

export function Deeper({ label = "Inspect the details", children, defaultOpen }: { label?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group rounded-lg border border-rule bg-paper-2/50 px-4 py-2.5" open={defaultOpen}>
      <summary className="cursor-pointer list-none text-[14px] font-medium text-ink-2 select-none hover:text-ink">
        <span aria-hidden className="mr-1.5 inline-block transition-transform group-open:rotate-90">▸</span>{label}
      </summary>
      <div className="mt-3 text-[14px] leading-relaxed text-ink-2">{children}</div>
    </details>
  );
}

export function AnalogyLimit({ analogy, limit }: { analogy: React.ReactNode; limit: React.ReactNode }) {
  return (
    <div className="grid gap-2 rounded-lg border border-rule bg-paper p-3.5 text-[14px] leading-relaxed sm:grid-cols-2">
      <div><div className="mb-0.5 text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">Analogy</div><div className="text-ink-2">{analogy}</div></div>
      <div className="sm:border-l sm:border-rule sm:pl-3"><div className="mb-0.5 text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">Where this analogy stops working</div><div className="text-ink-2">{limit}</div></div>
    </div>
  );
}

// ------------------------------------------------------------------ prediction checks (retry allowed)
export interface CheckOption { label: string; correct?: boolean; feedback: string }
export function Check({ id, prompt, options }: { id: string; prompt: string; options: CheckOption[] }) {
  const [picked, setPicked] = useState<number | null>(null);
  const gid = useId();
  const ok = picked !== null && options[picked].correct;
  useEffect(() => { if (ok) markProgress(`check:${id}`); }, [ok, id]);
  return (
    <fieldset className="rounded-xl border-2 border-dashed border-rule-strong bg-paper p-4">
      <legend className="px-1 text-[12px] font-semibold tracking-wide text-ink-3 uppercase">Predict first</legend>
      <p className="text-[16px] font-medium text-ink" id={gid}>{prompt}</p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-labelledby={gid}>
        {options.map((o, i) => (
          <button key={i} type="button" onClick={() => setPicked(i)} aria-pressed={picked === i}
            className={cn("rounded-lg border-2 px-3.5 py-2 text-[14px] text-left",
              picked === i ? (o.correct ? "border-[var(--role-norm)] bg-[var(--role-norm-soft)] text-ink" : "border-[var(--bad)] bg-[var(--bad-soft)] text-ink") : "border-rule-strong bg-paper text-ink-2 hover:border-ink-3")}>
            {o.label}
          </button>
        ))}
      </div>
      <div aria-live="polite" className="min-h-[1.5em]">
        {picked !== null && (
          <p className={cn("ll-pop mt-3 text-[14.5px] leading-relaxed", options[picked].correct ? "text-[var(--role-norm-ink)]" : "text-[var(--bad-ink)]")}>
            <span className="font-semibold">{options[picked].correct ? "Yes. " : "Not quite. "}</span>{options[picked].feedback}
            {!options[picked].correct && <span className="text-ink-3"> Try another answer.</span>}
          </p>
        )}
      </div>
    </fieldset>
  );
}

// ------------------------------------------------------------------ step controls
export function StepControls({ step, max, onStep, labels, playing, onPlay, onReset }: {
  step: number; max: number; onStep: (s: number) => void; labels?: string[]; playing?: boolean; onPlay?: () => void; onReset?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Step controls">
      <button type="button" onClick={() => onStep(Math.max(0, step - 1))} disabled={step === 0}
        className="rounded-lg border-2 border-rule-strong px-3 py-1.5 text-[14px] text-ink disabled:opacity-35">← Back</button>
      <button type="button" onClick={() => onStep(Math.min(max, step + 1))} disabled={step === max}
        className="rounded-lg border-2 border-ink bg-ink px-4 py-1.5 text-[14px] font-medium text-paper disabled:opacity-35">Next step →</button>
      {onPlay && <button type="button" onClick={onPlay} aria-pressed={playing} className="rounded-lg border-2 border-rule-strong px-3 py-1.5 text-[14px] text-ink">{playing ? "❚❚ Pause" : "▶ Play"}</button>}
      {onReset && <button type="button" onClick={onReset} className="rounded-lg border-2 border-rule-strong px-3 py-1.5 text-[14px] text-ink">↺ Reset</button>}
      <span className="text-[13px] text-ink-3" aria-live="polite">Step {step + 1} of {max + 1}{labels?.[step] ? `: ${labels[step]}` : ""}</span>
    </div>
  );
}

const PREF_EVT = "latentlens:pref";
function usePref(key: string, fallback: string): [string, (v: string) => void] {
  const v = useSyncExternalStore(
    (cb) => { window.addEventListener(PREF_EVT, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(PREF_EVT, cb); window.removeEventListener("storage", cb); }; },
    () => { try { return window.localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
    () => fallback);
  const set = (nv: string) => { try { window.localStorage.setItem(key, nv); } catch { /* storage unavailable */ } window.dispatchEvent(new Event(PREF_EVT)); };
  return [v, set];
}

/** Speed and motion preferences for the LatentLens wrapper (stored locally; reduced-motion is always respected). */
export function MotionControls() {
  const [speed, setSpeed] = usePref("latentlens.speed", "normal");
  const [motion, setMotion] = usePref("latentlens.motion", "on");
  useEffect(() => {
    const el = document.querySelector<HTMLElement>("[data-latent-theme]");
    if (el) { el.dataset.speed = speed; el.dataset.motion = motion; }
  }, [speed, motion]);
  return (
    <div className="flex items-center gap-1.5 text-[12.5px] text-ink-3">
      <button type="button" onClick={() => setSpeed(speed === "slow" ? "normal" : "slow")} aria-pressed={speed === "slow"} className="rounded border border-rule-strong px-2 py-0.5 hover:text-ink">{speed === "slow" ? "Speed: slow" : "Speed: normal"}</button>
      <button type="button" onClick={() => setMotion(motion === "off" ? "on" : "off")} aria-pressed={motion === "off"} className="rounded border border-rule-strong px-2 py-0.5 hover:text-ink">{motion === "off" ? "Motion: off" : "Motion: on"}</button>
    </div>
  );
}

export function Segment<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: React.ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-lg border-2 border-rule-strong bg-paper p-0.5">
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cn("rounded-md px-3 py-1 text-[14px]", value === o.value ? "bg-ink text-paper" : "text-ink-2 hover:text-ink")}>{o.label}</button>
      ))}
    </div>
  );
}

export function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  const id = useId();
  return (
    <div className="min-w-[180px]">
      <label htmlFor={id} className="flex justify-between gap-3 text-[13.5px] text-ink-2"><span>{label}</span><span className="num font-medium text-ink">{format ? format(value) : value}</span></label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="block w-full" />
    </div>
  );
}
