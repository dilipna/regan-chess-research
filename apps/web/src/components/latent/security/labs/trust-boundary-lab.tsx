"use client";

// Lab 1 interactive part: mark each component, compare with the reference, then see the boundaries and paths.

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ATTRS, FLOWS, PARTS, QUESTIONS, type Attr } from "@/lib/latent/security/labs/trust-boundaries";
import { RevealOutline } from "../../learn/primitives";

const name = (id: string) => PARTS.find((p) => p.id === id)!.name;
const isTrusted = (id: string) => PARTS.find((p) => p.id === id)!.ref.includes("trusted");
const isPrivileged = (id: string) => PARTS.find((p) => p.id === id)!.ref.includes("privileged");

export function TrustBoundaryLab() {
  const [marks, setMarks] = useState<Record<string, Attr[]>>({});
  const [checked, setChecked] = useState(false);
  const [showFlows, setShowFlows] = useState(false);
  const toggle = (id: string, a: Attr) => setMarks((m) => { const cur = m[id] ?? []; return { ...m, [id]: cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a] }; });
  const score = PARTS.filter((p) => { const m = [...(marks[p.id] ?? [])].sort().join(); return m === [...p.ref].sort().join(); }).length;
  const untrustedIn = FLOWS.filter(([a, b]) => b === "llm" && !isTrusted(a));
  const toPrivileged = FLOWS.filter(([a, b]) => a === "llm" && isPrivileged(b));
  return (
    <div className="grid gap-5">
      <h2 className="text-[18px] font-semibold text-ink">1. Mark each component</h2>
      <ul className="grid gap-2 md:grid-cols-2">
        {PARTS.map((p) => {
          const ok = checked && [...(marks[p.id] ?? [])].sort().join() === [...p.ref].sort().join();
          return (
            <li key={p.id} className={cn("rounded-xl border p-3", checked ? (ok ? "border-[var(--role-norm)] bg-[var(--role-norm-soft)]" : "border-[var(--role-mlp)] bg-[var(--role-mlp-soft)]") : "border-rule bg-paper")}>
              <div className="text-[15px] font-semibold text-ink">{p.name}</div>
              <div className="mt-1.5 flex flex-wrap gap-1" role="group" aria-label={`Attributes of ${p.name}`}>
                {ATTRS.map((a) => <button key={a.id} type="button" onClick={() => toggle(p.id, a.id)} aria-pressed={(marks[p.id] ?? []).includes(a.id)}
                  className={cn("rounded-full border px-2.5 py-0.5 text-[12.5px]", (marks[p.id] ?? []).includes(a.id) ? "border-ink bg-ink text-paper" : "border-rule-strong text-ink-2")}>{a.label}</button>)}
              </div>
              {checked && <p className="mt-2 text-[13.5px] text-ink-2"><strong className="text-ink">Reference: </strong>{p.ref.map((r) => ATTRS.find((a) => a.id === r)!.label).join(", ")}. {p.why}</p>}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setChecked(true)} className="rounded-lg bg-ink px-4 py-2 text-[14px] font-medium text-paper">Check my marks</button>
        {checked && <span className="text-[14px] text-ink-2" aria-live="polite">{score} of {PARTS.length} match the reference exactly.</span>}
      </div>

      <h2 className="text-[18px] font-semibold text-ink">2. Draw the trust boundaries</h2>
      {!showFlows ? <button type="button" onClick={() => setShowFlows(true)} className="w-fit rounded-lg border border-rule-strong px-4 py-2 text-[14px] text-ink">Show the flows and boundaries</button> : (
        <div className="grid gap-3">
          <ul className="grid gap-1 text-[14px]">
            {FLOWS.map(([a, b, what]) => {
              const crosses = isTrusted(a) !== isTrusted(b);
              return <li key={a + b + what} className={cn("flex flex-wrap items-center gap-2 rounded-md px-2 py-1", crosses && "border border-dashed border-[var(--role-mlp)]")}>
                <span className="text-ink">{name(a)}</span><span aria-hidden className="text-ink-4">→</span><span className="text-ink">{name(b)}</span><span className="text-ink-3">({what})</span>
                {crosses && <span className="rounded bg-[var(--role-mlp-soft)] px-1.5 text-[11px] font-semibold tracking-wide text-[var(--role-mlp-ink)] uppercase">trust boundary</span>}
              </li>;
            })}
          </ul>
          <div className="rounded-xl bg-paper-2/60 p-3 text-[14px] text-ink-2">
            <p><strong className="text-ink">Paths from outside text to action:</strong> untrusted inputs reach the LLM through {untrustedIn.map(([a]) => name(a)).join(", ")}; the LLM&apos;s output reaches {toPrivileged.map(([, b]) => name(b)).join(" and ")}. Every such path needs an enforcement point between the LLM and the privileged component.</p>
          </div>
        </div>
      )}

      <h2 className="text-[18px] font-semibold text-ink">3. Answer before revealing</h2>
      <ul className="grid gap-3 md:grid-cols-2">{QUESTIONS.map((x) => <li key={x.q} className="rounded-xl border border-rule bg-paper p-3"><RevealOutline q={x.q} outline={[x.a]} /></li>)}</ul>
    </div>
  );
}
