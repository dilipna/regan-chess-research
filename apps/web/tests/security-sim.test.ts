import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CORPUS, DEMO_SECRET, EVAL_CASES, OUTPUT_CASES, PRESETS, blastRadius, calendarScenario, consumptionRun, escapeHtml, LIMITS_ON,
  memoryRun, ragAnswer, retrieve, run, runEvals, summarizeScenario,
} from "@/lib/latent/security/sim";

const SRC = readFileSync(path.join(__dirname, "..", "src", "lib", "latent", "security", "sim.ts"), "utf-8");

describe("the simulator is a local toy", () => {
  it("has no network, storage, process or dynamic-code access", () => {
    for (const bad of ["fetch(", "XMLHttpRequest", "WebSocket", "child_process", "require(", "eval(", "new Function", "localStorage", "process."]) expect(SRC).not.toContain(bad);
  });
  it("uses only reserved example domains and fake values", () => {
    const emails = SRC.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? [];
    expect(emails.length).toBeGreaterThan(0);
    for (const e of emails) expect(e, e).toMatch(/\.(example|test)$/);
    expect(DEMO_SECRET).toBe("DEMO_SECRET_123");
    for (const t of ["read_demo_calendar", "send_demo_email", "delete_demo_record", "transfer_demo_credits"]) expect(SRC).toContain(t);
  });
  it("is deterministic", () => {
    for (const p of PRESETS) expect(runEvals(p)).toEqual(runEvals(p));
    expect(run(calendarScenario(true), {})).toEqual(run(calendarScenario(true), {}));
  });
});

describe("behaviour of each defense on the fixed fixtures", () => {
  it("no defenses: injected document causes an outbound email with the fake secret", () => {
    const r = run(summarizeScenario("paraphrase"), {});
    expect(r.attackSucceeded).toBe(true);
    expect(r.leaked).toBe(true);
    expect(r.executed.some((a) => a.tool === "send_demo_email")).toBe(true);
  });
  it("prompt-level defenses stop some phrasings but not a fake role marker", () => {
    expect(run(summarizeScenario("classic"), { filter: true }).attackSucceeded).toBe(false);
    expect(run(summarizeScenario("paraphrase"), { filter: true }).attackSucceeded).toBe(true);
    expect(run(summarizeScenario("paraphrase"), { spotlight: true }).attackSucceeded).toBe(false);
    expect(run(summarizeScenario("role-mimic"), { filter: true, spotlight: true }).attackSucceeded).toBe(true);
  });
  it("architectural controls hold even when the simulated model is fooled", () => {
    const r = run(summarizeScenario("role-mimic"), { taint: true, secretsOut: true });
    expect(r.attackSucceeded).toBe(false);
    expect(r.steps.some((s) => s.kind === "blocked" && s.by === "taint")).toBe(true);
  });
  it("least privilege shrinks the calendar agent's blast radius to zero while the task still completes", () => {
    const open = run(calendarScenario(true), {});
    const tight = run(calendarScenario(true), { leastPriv: true });
    expect(blastRadius(open)).toBeGreaterThan(0);
    expect(blastRadius(tight)).toBe(0);
    expect(tight.taskCompleted).toBe(true);
  });
  it("approval rejects actions the user did not ask for; sandbox neutralizes destructive tools", () => {
    expect(run(calendarScenario(true), { approval: true }).steps.some((s) => s.kind === "rejected" && s.by === "human")).toBe(true);
    const sb = run(calendarScenario(true), { sandbox: true });
    expect(sb.executed.some((a) => a.tool === "delete_demo_record" || a.tool === "transfer_demo_credits")).toBe(false);
  });
  it("memory: an uncontrolled write in session 1 poisons session 2; write authorization or expiry prevents it", () => {
    expect(memoryRun({}).poisoned).toBe(true);
    expect(memoryRun({ memWriteAuth: true }).poisoned).toBe(false);
    expect(memoryRun({ memExpiry: true }).poisoned).toBe(false);
    expect(memoryRun({ memProvenance: true, taint: true }).poisoned).toBe(false);
    expect(memoryRun({ memWriteAuth: true }).r2.taskCompleted).toBe(true);
  });
  it("RAG: real cosine retrieval ranks the stuffed document first; authorization and provenance fix leakage and poisoning", () => {
    expect(retrieve("what is the refund policy", "acme", {})[0].doc.poisoned).toBe(true);
    const open = ragAnswer("refund policy exceptions override code", "acme", {});
    expect(open.leakedCode).toBe(true);
    expect(ragAnswer("refund policy exceptions override code", "acme", { authz: true }).leakedCode).toBe(false);
    expect(ragAnswer("what is the refund policy", "acme", {}).followed).toBe(true);
    const safe = ragAnswer("what is the refund policy", "acme", { authz: true, provenance: true });
    expect(safe.followed).toBe(false);
    expect(safe.answer).toContain("30 days");
    expect(CORPUS.filter((d) => d.poisoned)).toHaveLength(1);
  });
  it("output handling validates instead of executing", () => {
    expect(escapeHtml("<img onerror=x>")).toBe("&lt;img onerror=x&gt;");
    for (const c of OUTPUT_CASES.filter((c) => c.kind !== "html")) expect(c.check(c.output).ok, c.id).toBe(false);
    expect(OUTPUT_CASES.find((c) => c.id === "sql")!.check("SELECT * FROM orders WHERE customer = 'acme'").ok).toBe(true);
  });
  it("resource limits bound simulated cost", () => {
    for (const k of ["loop", "fanout"] as const) {
      expect(consumptionRun(k, {}).total).toBeGreaterThan(20000);
      expect(consumptionRun(k, LIMITS_ON).total).toBeLessThanOrEqual(20000);
    }
  });
});

describe("eval harness: metrics are recomputed from runs", () => {
  const res = Object.fromEntries(PRESETS.map((p) => [p.id, runEvals(p)]));
  it("has benign and adversarial coverage", () => {
    expect(EVAL_CASES.filter((c) => !c.attack).length).toBe(4);
    expect(EVAL_CASES.filter((c) => c.attack).length).toBeGreaterThanOrEqual(15);
    expect(new Set(EVAL_CASES.map((c) => c.id)).size).toBe(EVAL_CASES.length);
  });
  it("orders presets as the defenses imply and never blocks benign tasks", () => {
    expect(res.none.asr).toBe(1);
    expect(res.prompt.asr).toBeLessThan(res.none.asr);
    expect(res.prompt.asr).toBeGreaterThan(res.arch.asr);
    expect(res.all.asr).toBeLessThanOrEqual(res.arch.asr);
    for (const p of PRESETS) { expect(res[p.id].benignDone, p.id).toBe(1); expect(res[p.id].falsePositives, p.id).toBe(0); }
  });
  it("keeps the content-integrity residual case: a planted false claim survives every preset", () => {
    for (const p of PRESETS) expect(res[p.id].rows.find((r) => r.c.id === "I5")!.r.success, p.id).toBe(true);
  });
  it("matches the committed artifact the UI reads", () => {
    const art = JSON.parse(readFileSync(path.join(__dirname, "..", "public", "data", "latent", "security-eval.json"), "utf-8"));
    for (const p of PRESETS) {
      const a = art.presets.find((x: { id: string }) => x.id === p.id);
      expect(a.attack_success_rate).toBeCloseTo(res[p.id].asr, 10);
      expect(a.attack_successes).toBe(res[p.id].rows.filter((r) => r.c.attack && r.r.success).length);
      expect(a.benign_completed).toBe(res[p.id].rows.filter((r) => !r.c.attack && r.r.completed).length);
    }
    expect(art.n_adversarial).toBe(res.none.nAttacks);
    expect(art.n_benign).toBe(res.none.nBenign);
  });
});
