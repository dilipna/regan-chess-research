"use client";

// Labs 3 to 6: prompt injection, secret leakage, excessive agency and memory poisoning, all on the simulator.

import { useState } from "react";
import {
  DEMO_SECRET, TOOLS, blastRadius, calendarScenario, leakScenario, memoryRun, run, summarizeScenario,
  type Defenses, type Phrasing, type Scenario, type Step,
} from "@/lib/latent/security/sim";
import { Choice, ContextWindow, DefenseSwitches, H, Outcome, Presets, Trace } from "./sim-ui";

const same = (a: Step["action"], sc: Scenario) => !!a && sc.taskActions.some((t) => t.tool === a.tool && JSON.stringify(t.args) === JSON.stringify(a.args));
const harmOf = (sc: Scenario) => (s: Step) => s.kind === "executed" && !!s.action && !same(s.action, sc);

// ---------- lab 3 ----------

const VARIANTS: { id: Phrasing | "image" | "none"; label: string }[] = [
  { id: "none", label: "No attack" }, { id: "classic", label: "Classic phrasing" }, { id: "paraphrase", label: "Polite paraphrase" },
  { id: "role-mimic", label: "Fake SYSTEM line" }, { id: "image", label: "Text inside an image" },
];

export function InjectionLab() {
  const [v, setV] = useState<Phrasing | "image" | "none">("paraphrase");
  const [d, setD] = useState<Defenses>({});
  const sc = summarizeScenario(v);
  const r = run(sc, d);
  return (
    <div className="grid gap-6">
      <H n={1}>Choose what the third item says</H>
      <Choice label="Injection variant" value={v} options={VARIANTS} onChange={setV} />
      <H n={2}>The context window the model sees</H>
      <ContextWindow segs={sc.segments.map((s) => (d.secretsOut && s.source === "system" ? { ...s, text: s.text.replace(DEMO_SECRET, "[kept in the tool layer]") } : s))} />
      <H n={3}>Turn defenses on and off</H>
      <Presets onPick={setD} presets={[{ label: "None", d: {} }, { label: "Prompt-level", d: { filter: true, spotlight: true } }, { label: "Architectural", d: { taint: true, secretsOut: true, argCheck: true, approval: true } }]} />
      <DefenseSwitches keys={["filter", "spotlight", "taint", "secretsOut", "argCheck", "approval"]} d={d} onChange={setD} />
      <H n={4}>What happened</H>
      <Trace steps={r.steps} isHarm={harmOf(sc)} />
      <Outcome items={[
        { label: sc.attack ? (r.attackSucceeded ? "Attack succeeded" : "Attack stopped") : "No attack in this run", bad: r.attackSucceeded },
        { label: r.leaked ? `Answer contains ${DEMO_SECRET}` : "No secret in the answer", bad: r.leaked },
        { label: r.executed.some((a) => a.tool === "send_demo_email") ? "An email left the company" : "No email sent", bad: r.executed.some((a) => a.tool === "send_demo_email") },
      ]} />
      {r.answer && <p className="rounded-xl border border-rule bg-paper p-3 text-[14px] text-ink-2"><span className="text-ink-4">Answer shown to the user: </span>{r.answer}</p>}
    </div>
  );
}

// ---------- lab 4 ----------

export function LeakLab() {
  const [k, setK] = useState<"direct" | "indirect">("direct");
  const [d, setD] = useState<Defenses>({});
  const sc = leakScenario(k);
  const r = run(sc, d);
  return (
    <div className="grid gap-6">
      <H n={1}>Who asks for the secret?</H>
      <Choice label="Request" value={k} onChange={setK} options={[{ id: "direct", label: "The user, directly" }, { id: "indirect", label: "A document, indirectly" }]} />
      <ContextWindow segs={sc.segments.map((s) => (d.secretsOut && s.source === "system" ? { ...s, text: s.text.replace(DEMO_SECRET, "[kept in the tool layer]") } : s))} />
      <H n={2}>Defenses</H>
      <DefenseSwitches keys={["filter", "spotlight", "taint", "secretsOut"]} d={d} onChange={setD} />
      <H n={3}>Result</H>
      <Trace steps={r.steps} />
      <Outcome items={[{ label: r.leaked ? `The answer contains ${DEMO_SECRET}` : "The secret did not appear", bad: r.leaked }]} />
      <p className="rounded-xl border border-rule bg-paper p-3 text-[14px] text-ink-2"><span className="text-ink-4">Answer: </span>{r.answer}</p>
    </div>
  );
}

// ---------- lab 5 ----------

export function AgencyLab() {
  const [d, setD] = useState<Defenses>({});
  const sc = calendarScenario(true);
  const r = run(sc, d);
  const radius = blastRadius(r), max = blastRadius(run(sc, {}));
  return (
    <div className="grid gap-6">
      <H n={1}>The context: one external invite</H>
      <ContextWindow segs={sc.segments} />
      <H n={2}>What the agent&apos;s credential can do</H>
      <ul className="grid gap-1.5 sm:grid-cols-5">
        {TOOLS.map((t) => (
          <li key={t.name} className="rounded-xl border border-rule bg-paper px-3 py-2">
            <div className="font-mono text-[11.5px] break-all text-ink">{t.name}</div>
            <div className="mt-1 text-[11.5px] text-ink-3">{t.risk} · impact {t.impact}</div>
          </li>
        ))}
      </ul>
      <H n={3}>Controls (try them one at a time)</H>
      <DefenseSwitches keys={["spotlight", "allowlist", "leastPriv", "argCheck", "approval", "sandbox", "taint", "audit"]} d={d} onChange={setD} />
      <H n={4}>Result</H>
      <Trace steps={r.steps} isHarm={harmOf(sc)} />
      <div className="grid gap-2">
        <div className="flex items-center justify-between text-[13px] text-ink-2"><span>Blast radius (sum of impacts of what really ran, +3 for a leak)</span><span className="num font-mono text-ink">{radius} / {max}</span></div>
        <div className="h-3 rounded-full bg-paper-3"><div className="h-3 rounded-full transition-[width] duration-300" style={{ width: `${(radius / max) * 100}%`, background: radius ? "var(--bad)" : "var(--role-norm)" }} /></div>
      </div>
      <Outcome items={[
        { label: r.attackSucceeded ? "Injected actions ran" : "No injected action ran", bad: r.attackSucceeded },
        { label: r.taskCompleted ? "Calendar question answered" : "The real task was blocked", bad: !r.taskCompleted },
      ]} />
      {d.audit && <p className="text-[12.5px] text-ink-3">Audit log on: every proposed, blocked and executed action above is recorded. Logging detects; it does not prevent.</p>}
    </div>
  );
}

// ---------- lab 6 ----------

export function MemoryLab() {
  const [d, setD] = useState<Defenses>({});
  const m = memoryRun(d);
  return (
    <div className="grid gap-6">
      <H n={1}>Defenses for memory</H>
      <DefenseSwitches keys={["memWriteAuth", "memConfirm", "memProvenance", "memExpiry", "memScope", "taint"]} d={d} onChange={setD} />
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="grid content-start gap-3">
          <H n={2}>Session 1 · {m.s1.task}</H>
          <ContextWindow segs={m.s1.segments} />
          <Trace steps={m.r1.steps} />
          <p className="text-[13px] text-ink-2">Stored for later: {m.stored.length ? <span className="font-mono text-[var(--bad-ink)]">&ldquo;{m.stored[0].args.fact}&rdquo;</span> : <span className="text-[var(--role-norm-ink)]">nothing</span>}</p>
        </section>
        <section className="grid content-start gap-3">
          <H n={3}>Session 2 · days later</H>
          <ContextWindow segs={m.s2.segments} />
          <Trace steps={m.r2.steps} isHarm={(s) => s.kind === "executed" && s.action?.args.to === "audit@attacker.example"} />
        </section>
      </div>
      <Outcome items={[
        { label: m.poisoned ? "The report was also sent to the attacker" : "No hidden recipient", bad: m.poisoned },
        { label: m.r2.taskCompleted ? "The manager got the report" : "The real task failed", bad: !m.r2.taskCompleted },
      ]} />
    </div>
  );
}
