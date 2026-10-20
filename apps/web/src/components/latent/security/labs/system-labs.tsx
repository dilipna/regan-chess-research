"use client";

// Labs 2 and 7 to 10: web basics, RAG, output handling, resource limits and the eval harness.

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  EVAL_CASES, LIMITS_ON, OUTPUT_CASES, PRESETS, consumptionRun, ragAnswer, runEvals, type Limits, type RagDefenses,
} from "@/lib/latent/security/sim";
import {
  IDOR_REQUESTS, SIGNED_IN, SSRF_INPUTS, SSRF_MODES, XSS_INPUTS, checkUrl, lookupOrder, renderOutput, ssrfHit, type IdorDefenses, type SsrfMode, type XssDefenses,
} from "@/lib/latent/security/labs/web-basics";
import { Choice, H, Outcome } from "./sim-ui";

function Toggle({ on, onClick, label, what }: { on: boolean; onClick: () => void; label: string; what: string }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={cn("flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors", on ? "border-[var(--role-norm)] bg-[var(--role-norm-soft)]" : "border-rule bg-paper hover:border-rule-strong")}>
      <span aria-hidden className={cn("mt-0.5 flex h-4 w-7 shrink-0 items-center rounded-full p-0.5", on ? "bg-[var(--role-norm)]" : "bg-paper-3")}>
        <span className={cn("h-3 w-3 rounded-full bg-paper transition-transform", on && "translate-x-3")} />
      </span>
      <span><span className="block text-[13.5px] font-medium text-ink">{label}</span><span className="mt-0.5 block text-[12px] leading-snug text-ink-3">{what}</span></span>
    </button>
  );
}

const Code = ({ children, bad }: { children: React.ReactNode; bad?: boolean }) => (
  <pre className={cn("overflow-x-auto rounded-xl border p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-words", bad ? "border-[color-mix(in_oklab,var(--bad)_40%,transparent)] bg-[var(--bad-soft)] text-ink" : "border-rule bg-paper-2 text-ink-2")}>{children}</pre>
);

// ---------- lab 2 ----------

export function WebBasicsLab() {
  const [xi, setXi] = useState(XSS_INPUTS[1].id);
  const [xd, setXd] = useState<XssDefenses>({});
  const [mode, setMode] = useState<SsrfMode>("none");
  const [idd, setIdd] = useState<IdorDefenses>({});
  const x = XSS_INPUTS.find((i) => i.id === xi)!;
  const xr = renderOutput(x.text, xd);
  const ssrf = SSRF_INPUTS.map((u) => ({ ...u, r: checkUrl(u.url, mode) }));
  const hits = ssrf.filter((s) => ssrfHit(s.r)).length;
  return (
    <div className="grid gap-8">
      <section className="grid gap-4">
        <H n={1}>Model output shown in a web page</H>
        <Choice label="Model output" value={xi} onChange={setXi} options={XSS_INPUTS.map((i) => ({ id: i.id, label: i.label }))} />
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle on={!!xd.escape} onClick={() => setXd({ ...xd, escape: !xd.escape })} label="Escape HTML before display" what={"Turns < > & \" ' into entities so the text is shown, not interpreted."} />
          <Toggle on={!!xd.blockExternalImages} onClick={() => setXd({ ...xd, blockExternalImages: !xd.blockExternalImages })} label="Block external images (CSP img-src)" what="The page may only load images from the app's own host." />
        </div>
        <div className="grid gap-2">
          <span className="text-[12px] text-ink-4">What the page would contain (shown as text here, never rendered):</span>
          <Code bad={!xr.safe}>{xr.shown}</Code>
          <ul className="grid gap-1 text-[13.5px]">{xr.effects.length ? xr.effects.map((e) => <li key={e} className={e.startsWith("Image from") ? "text-[var(--role-norm-ink)]" : "text-[var(--bad-ink)]"}>{e}</li>) : <li className="text-[var(--role-norm-ink)]">Displayed as plain text; nothing runs and nothing is fetched.</li>}</ul>
        </div>
      </section>

      <section className="grid gap-4">
        <H n={2}>A &ldquo;read this URL&rdquo; tool on the server</H>
        <Choice label="URL check" value={mode} onChange={setMode} options={SSRF_MODES.map((m) => ({ id: m.id, label: m.label }))} />
        <p className="text-[13px] text-ink-3">{SSRF_MODES.find((m) => m.id === mode)!.what}</p>
        <div className="overflow-x-auto rounded-xl border border-rule">
          <table className="w-full min-w-[640px] text-[12.5px]">
            <thead><tr className="border-b border-rule text-left text-[11px] tracking-wide text-ink-4 uppercase"><th className="px-3 py-2 font-medium">URL the model chose</th><th className="px-3 py-2 font-medium">Parsed host</th><th className="px-3 py-2 font-medium">Decision</th><th className="px-3 py-2 font-medium">Would reach</th></tr></thead>
            <tbody>
              {ssrf.map((s) => (
                <tr key={s.url} className={cn("border-b border-rule last:border-0", ssrfHit(s.r) && "bg-[var(--bad-soft)]")}>
                  <td className="px-3 py-2 align-top"><div className="font-mono break-all text-ink">{s.url}</div><div className="mt-0.5 text-ink-4">{s.note}</div></td>
                  <td className="px-3 py-2 align-top font-mono text-ink-2">{s.r.host || "(none)"}</td>
                  <td className="px-3 py-2 align-top"><span className={s.r.allowed ? "text-ink" : "text-[var(--role-norm-ink)]"}>{s.r.allowed ? "fetched" : "refused"}</span><div className="text-ink-4">{s.r.reason}</div></td>
                  <td className={cn("px-3 py-2 align-top", ssrfHit(s.r) ? "text-[var(--bad-ink)]" : "text-ink-3")}>{s.r.allowed ? s.r.reaches : "nothing"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Outcome items={[{ label: hits ? `${hits} of ${ssrf.length} URLs reach something other than a public page` : "Only the public page is reachable", bad: hits > 0 }]} />
      </section>

      <section className="grid gap-4">
        <H n={3}>An order-lookup tool (signed in as {SIGNED_IN})</H>
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle on={!!idd.promptRule} onClick={() => setIdd({ ...idd, promptRule: !idd.promptRule })} label="Rule in the system prompt" what={"“Only show the signed-in user's own orders.”"} />
          <Toggle on={!!idd.serverCheck} onClick={() => setIdd({ ...idd, serverCheck: !idd.serverCheck })} label="Ownership check in the API" what="The server compares the order's owner with the signed-in user on every request." />
        </div>
        <ul className="grid gap-2">
          {IDOR_REQUESTS.map((q) => {
            const r = lookupOrder(q.id, idd);
            return (
              <li key={q.id} className={cn("rounded-xl border p-3", r.leaked ? "border-[color-mix(in_oklab,var(--bad)_40%,transparent)] bg-[var(--bad-soft)]" : "border-rule bg-paper")}>
                <div className="text-[13.5px] text-ink">&ldquo;{q.text}&rdquo;</div>
                <div className={cn("mt-1 font-mono text-[12px]", r.leaked ? "text-[var(--bad-ink)]" : "text-ink-2")}>{r.result}</div>
                {r.by && <div className="mt-0.5 text-[11.5px] text-ink-4">stopped by: {r.by}</div>}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

// ---------- lab 7 ----------

const QUERIES = ["what is the refund policy", "refund policy exceptions override code", "shipping times"];
const RAG_KEYS: { k: keyof RagDefenses; label: string; what: string }[] = [
  { k: "authz", label: "Authorize before retrieval", what: "Only the user's tenant (and public files) can be retrieved." },
  { k: "provenance", label: "Provenance filter", what: "Only vetted internal documents can be used as answer sources." },
  { k: "sanitize", label: "Keyword sanitizer", what: "Strips known attack phrases from retrieved text." },
  { k: "spotlight", label: "Spotlight retrieved text", what: "Tells the model that retrieved text is data, not instructions." },
  { k: "citations", label: "Cite sources", what: "Each sentence names the document it came from." },
];

export function RagLab() {
  const [q, setQ] = useState(QUERIES[0]);
  const [d, setD] = useState<RagDefenses>({});
  const a = ragAnswer(q, "acme", d);
  return (
    <div className="grid gap-6">
      <H n={1}>An Acme customer asks</H>
      <Choice label="Query" value={q} onChange={setQ} options={QUERIES.map((x) => ({ id: x, label: `“${x}”` }))} />
      <H n={2}>Defenses</H>
      <div className="grid gap-1.5 sm:grid-cols-2">{RAG_KEYS.map((x) => <Toggle key={x.k} on={!!d[x.k]} onClick={() => setD({ ...d, [x.k]: !d[x.k] })} label={x.label} what={x.what} />)}</div>
      <H n={3}>Retrieved (top 3 by cosine similarity)</H>
      <ol className="grid gap-1.5">
        {a.hits.map((h) => (
          <li key={h.doc.id} className={cn("grid gap-1 rounded-xl border p-3 sm:grid-cols-[64px_1fr]", h.doc.poisoned || h.doc.tenant === "globex" ? "border-[color-mix(in_oklab,var(--bad)_40%,transparent)] bg-[var(--bad-soft)]" : "border-rule bg-paper")}>
            <span className="num font-mono text-[13px] text-ink">{h.score.toFixed(2)}</span>
            <span>
              <span className="text-[13.5px] font-medium text-ink">{h.doc.title}</span>
              <span className="ml-2 text-[11.5px] text-ink-4">{h.doc.id} · tenant {h.doc.tenant} · {h.doc.source}</span>
              <span className="mt-1 block font-mono text-[12px] text-ink-3">{h.doc.text}</span>
            </span>
          </li>
        ))}
        {!a.hits.length && <li className="text-[13px] text-ink-3">Nothing retrieved.</li>}
      </ol>
      {a.notes.map((n) => <p key={n} className="text-[12.5px] text-[var(--role-attn-ink)]">{n}</p>)}
      <H n={4}>The answer</H>
      <Code bad={a.followed || a.leakedCode}>{a.answer || "(no answer)"}</Code>
      <Outcome items={[
        { label: a.followed ? "Poisoned instruction followed" : "No planted instruction followed", bad: a.followed },
        { label: a.leakedCode ? "Globex's confidential code shown to Acme" : "No cross-tenant data in the answer", bad: a.leakedCode },
      ]} />
    </div>
  );
}

// ---------- lab 8 ----------

export function OutputLab() {
  const [id, setId] = useState(OUTPUT_CASES[0].id);
  const c = OUTPUT_CASES.find((x) => x.id === id)!;
  const [edits, setEdits] = useState<Record<string, string>>({});
  const text = edits[id] ?? c.output;
  const res = c.check(text);
  return (
    <div className="grid gap-6">
      <H n={1}>Where the output goes</H>
      <Choice label="Output destination" value={id} onChange={setId} options={OUTPUT_CASES.map((x) => ({ id: x.id, label: { html: "Web page", sql: "SQL database", shell: "Shell", "tool-args": "Tool arguments" }[x.kind] }))} />
      <H n={2}>The model&apos;s output (edit it)</H>
      <textarea value={text} onChange={(e) => setEdits({ ...edits, [id]: e.target.value })} rows={3} aria-label="Model output"
        className="w-full rounded-xl border border-rule-strong bg-paper-2 p-3 font-mono text-[12.5px] text-ink outline-none focus:border-[var(--role-resid)]" />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setEdits({ ...edits, [id]: c.output })} className="rounded-full border border-rule-strong px-3 py-1 text-[12.5px] text-ink-2 hover:text-ink">Reset to the attack</button>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div><div className="mb-1.5 text-[11px] font-medium tracking-[0.12em] text-[var(--bad-ink)] uppercase">Passed straight through</div><Code bad>{c.naive}</Code></div>
        <div><div className="mb-1.5 text-[11px] font-medium tracking-[0.12em] text-[var(--role-norm-ink)] uppercase">With validation</div><Code>{res.result}</Code></div>
      </div>
      <Outcome items={[{ label: c.kind === "html" ? "Escaped: shown as text" : res.ok ? "Accepted: matches the allowed shape" : "Rejected before reaching the interpreter", bad: false }]} />
    </div>
  );
}

// ---------- lab 9 ----------

const LIMIT_KEYS: { k: keyof Limits; label: string; what: string }[] = [
  { k: "maxSteps", label: `Step limit (${LIMITS_ON.maxSteps})`, what: "Stop after a fixed number of agent steps." },
  { k: "maxToolCalls", label: `Tool-call limit (${LIMITS_ON.maxToolCalls})`, what: "Stop after a fixed number of tool calls." },
  { k: "loopDetect", label: "Loop detection", what: "Stop when the same call repeats 3 times." },
  { k: "budget", label: `Token budget (${LIMITS_ON.budget?.toLocaleString("en-US")})`, what: "Circuit breaker on total tokens for the task." },
  { k: "maxOutput", label: `Output cap (${LIMITS_ON.maxOutput?.toLocaleString("en-US")})`, what: "Maximum tokens in one generated answer." },
];

export function ConsumptionLab() {
  const [kind, setKind] = useState<"loop" | "fanout" | "huge">("loop");
  const [lim, setLim] = useState<Limits>({});
  const r = consumptionRun(kind, lim);
  const ceiling = 346_500;
  return (
    <div className="grid gap-6">
      <H n={1}>What the planted document makes the agent do</H>
      <Choice label="Pattern" value={kind} onChange={setKind} options={[{ id: "loop", label: "Repeat one search forever" }, { id: "fanout", label: "Every search spawns two" }, { id: "huge", label: "Write an enormous answer" }]} />
      <H n={2}>Limits</H>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {LIMIT_KEYS.map((x) => <Toggle key={x.k} on={lim[x.k] !== undefined} label={x.label} what={x.what}
          onClick={() => setLim((l) => { const n = { ...l }; if (n[x.k] !== undefined) delete n[x.k]; else (n as Record<string, unknown>)[x.k] = LIMITS_ON[x.k]; return n; })} />)}
      </div>
      <H n={3}>Simulated cost</H>
      <div className="grid gap-2">
        <div className="flex items-end gap-[2px] rounded-xl border border-rule bg-paper-2 p-3" style={{ height: 140 }} role="img" aria-label={`Cumulative tokens over ${r.steps} steps, ending at ${r.total}`}>
          {r.costs.map((c, i) => <div key={i} className="flex-1 rounded-t-[2px]" style={{ height: `${Math.max(2, (c / ceiling) * 100)}%`, background: c > 20000 ? "var(--bad)" : "var(--role-resid)" }} />)}
        </div>
        <div className="flex flex-wrap justify-between gap-2 text-[13px] text-ink-2">
          <span>{r.steps} steps · <span className="num font-mono text-ink">{r.total.toLocaleString("en-US")}</span> tokens</span>
          <span className="text-ink-3">Stopped by: {r.stopped || "finished"}</span>
        </div>
      </div>
      <Outcome items={[{ label: r.total > 20000 ? "Over the 20,000-token budget for this task" : "Within budget", bad: r.total > 20000 }]} />
    </div>
  );
}

// ---------- lab 10 ----------

export function EvalLab() {
  const [pid, setPid] = useState(PRESETS[0].id);
  const p = PRESETS.find((x) => x.id === pid)!;
  const res = runEvals(p);
  return (
    <div className="grid gap-6">
      <H n={1}>Choose a defense configuration</H>
      <Choice label="Preset" value={pid} onChange={setPid} options={PRESETS.map((x) => ({ id: x.id, label: x.label }))} />
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-rule bg-rule sm:grid-cols-4">
        {[["Attack success rate", `${(res.asr * 100).toFixed(1)}%`, res.asr > 0.1], ["Attacks that worked", `${res.rows.filter((x) => x.c.attack && x.r.success).length} / ${res.nAttacks}`, res.asr > 0.1], ["Benign tasks done", `${res.rows.filter((x) => !x.c.attack && x.r.completed).length} / ${res.nBenign}`, res.benignDone < 1], ["False positives", String(res.falsePositives), res.falsePositives > 0]].map(([k, v, bad]) => (
          <div key={k as string} className="bg-paper px-4 py-3"><dt className="text-[11px] text-ink-4">{k}</dt><dd className={cn("num mt-0.5 font-mono text-[20px]", bad ? "text-[var(--bad-ink)]" : "text-[var(--role-norm-ink)]")}>{v}</dd></div>
        ))}
      </dl>
      <H n={2}>Every case</H>
      <div className="overflow-x-auto rounded-xl border border-rule">
        <table className="w-full min-w-[620px] text-[12.5px]">
          <thead><tr className="border-b border-rule text-left text-[11px] tracking-wide text-ink-4 uppercase"><th className="px-3 py-2 font-medium">Case</th><th className="px-3 py-2 font-medium">Category</th><th className="px-3 py-2 font-medium">Description</th><th className="px-3 py-2 font-medium">Result</th></tr></thead>
          <tbody>
            {res.rows.map(({ c, r }) => {
              const bad = c.attack ? r.success : !r.completed;
              return (
                <tr key={c.id} className={cn("border-b border-rule last:border-0", bad && "bg-[var(--bad-soft)]")}>
                  <td className="px-3 py-2 font-mono text-ink">{c.id}</td>
                  <td className="px-3 py-2 text-ink-3">{c.category}</td>
                  <td className="px-3 py-2 text-ink-2">{c.describe}</td>
                  <td className={cn("px-3 py-2 whitespace-nowrap", bad ? "text-[var(--bad-ink)]" : "text-[var(--role-norm-ink)]")}>{c.attack ? (r.success ? "attack worked" : "stopped") : (r.completed ? "task done" : "task blocked")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[13px] text-ink-3">{EVAL_CASES.length} cases, recomputed live in your browser from the simulator each time you switch presets.</p>
    </div>
  );
}
