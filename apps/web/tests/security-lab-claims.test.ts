// Every outcome the lab text states (src/lib/latent/security/labs/*.ts) is checked here against the simulator,
// so the lessons cannot drift from what the interactive parts actually show.
import { describe, expect, it } from "vitest";
import {
  LIMITS_ON, PRESETS, blastRadius, calendarScenario, consumptionRun, leakScenario, memoryRun, ragAnswer, retrieve, run, runEvals, summarizeScenario,
} from "@/lib/latent/security/sim";
import { LAB_LIST } from "@/lib/latent/security/labs";
import { IDOR_REQUESTS, SSRF_INPUTS, XSS_INPUTS, checkUrl, isPrivate, lookupOrder, renderOutput, ssrfHit } from "@/lib/latent/security/labs/web-basics";

const ok = (v: Parameters<typeof summarizeScenario>[0], d: object) => run(summarizeScenario(v), d).attackSucceeded;

describe("lab list", () => {
  it("has ten labs numbered in order with unique slugs", () => {
    expect(LAB_LIST.map((l) => l.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(new Set(LAB_LIST.map((l) => l.slug)).size).toBe(10);
  });
});

describe("lab 2: web basics", () => {
  it("escaping stops script but not the markdown-image leak; blocking external images stops that", () => {
    const md = XSS_INPUTS.find((x) => x.id === "md-image")!.text;
    expect(renderOutput(XSS_INPUTS.find((x) => x.id === "img")!.text, {}).safe).toBe(false);
    expect(renderOutput(XSS_INPUTS.find((x) => x.id === "img")!.text, { escape: true }).safe).toBe(true);
    expect(renderOutput(md, { escape: true }).safe).toBe(false);
    expect(renderOutput(md, { escape: true, blockExternalImages: true }).safe).toBe(true);
    for (const x of XSS_INPUTS) expect(renderOutput(x.text, { escape: true, blockExternalImages: true }).safe, x.id).toBe(true);
  });
  it("SSRF: the prefix check is bypassed by user-info; parsing with an allowlist only reaches the public page", () => {
    const at = SSRF_INPUTS.find((u) => u.url.includes("@"))!.url;
    expect(checkUrl(at, "prefix").allowed).toBe(true);
    expect(ssrfHit(checkUrl(at, "prefix"))).toBe(true);
    expect(checkUrl("http://2130706433/admin", "private").host).toBe("127.0.0.1");
    for (const u of SSRF_INPUTS) {
      expect(ssrfHit(checkUrl(u.url, "allowlist")), u.url).toBe(false);
      expect(ssrfHit(checkUrl(u.url, "private")), u.url).toBe(false);
    }
    expect(SSRF_INPUTS.filter((u) => ssrfHit(checkUrl(u.url, "none"))).length).toBe(SSRF_INPUTS.length - 1);
    expect(checkUrl(SSRF_INPUTS[0].url, "allowlist").allowed).toBe(true);
  });
  it("private-address detection covers the usual ranges", () => {
    for (const h of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "localhost", "[::1]"]) expect(isPrivate(h), h).toBe(true);
    for (const h of ["8.8.8.8", "172.32.0.1", "docs.example.test"]) expect(isPrivate(h), h).toBe(false);
  });
  it("access control: the prompt rule gives way to a claim of authority; the server check never does", () => {
    expect(lookupOrder("other", { promptRule: true }).leaked).toBe(false);
    expect(lookupOrder("claim", { promptRule: true }).leaked).toBe(true);
    for (const q of IDOR_REQUESTS) expect(lookupOrder(q.id, { serverCheck: true }).leaked, q.id).toBe(false);
    expect(lookupOrder("own", { serverCheck: true }).result).toContain("Desk lamp");
  });
});

describe("lab 3: prompt injection", () => {
  it("the filter catches only the classic phrasing; spotlighting misses only the fake SYSTEM line", () => {
    expect(ok("classic", { filter: true })).toBe(false);
    for (const v of ["paraphrase", "role-mimic", "image"] as const) expect(ok(v, { filter: true }), v).toBe(true);
    for (const v of ["classic", "paraphrase", "image"] as const) expect(ok(v, { spotlight: true }), v).toBe(false);
    expect(ok("role-mimic", { filter: true, spotlight: true })).toBe(true);
  });
  it("taint alone still leaks the secret in the answer; taint plus secrets-out stops every phrasing", () => {
    expect(run(summarizeScenario("paraphrase"), { taint: true }).leaked).toBe(true);
    for (const v of ["classic", "paraphrase", "role-mimic", "image"] as const) expect(ok(v, { taint: true, secretsOut: true }), v).toBe(false);
  });
});

describe("lab 4: secrets", () => {
  it("direct requests beat prompt-level defenses; spotlighting stops the indirect one; secrets-out stops both", () => {
    for (const d of [{}, { filter: true }, { spotlight: true }, { taint: true }]) expect(run(leakScenario("direct"), d).leaked).toBe(true);
    expect(run(leakScenario("indirect"), { filter: true }).leaked).toBe(true);
    expect(run(leakScenario("indirect"), { spotlight: true }).leaked).toBe(false);
    for (const k of ["direct", "indirect"] as const) expect(run(leakScenario(k), { secretsOut: true }).leaked).toBe(false);
  });
});

describe("lab 5: excessive agency", () => {
  const sc = calendarScenario(true);
  it("no controls: blast radius 12; spotlighting does not help", () => {
    expect(blastRadius(run(sc, {}))).toBe(12);
    expect(blastRadius(run(sc, { spotlight: true }))).toBe(12);
  });
  it("argument checks leave the deletion; sandboxing leaves the email", () => {
    expect(run(sc, { argCheck: true }).executed.map((a) => a.tool)).toEqual(["read_demo_calendar", "delete_demo_record"]);
    expect(run(sc, { sandbox: true }).executed.map((a) => a.tool)).toEqual(["read_demo_calendar", "send_demo_email"]);
  });
  it("allowlist, least privilege, approval and taint each bring it to 0 with the task still done", () => {
    for (const d of [{ allowlist: true }, { leastPriv: true }, { approval: true }, { taint: true }]) {
      const r = run(sc, d);
      expect(blastRadius(r), JSON.stringify(d)).toBe(0);
      expect(r.taskCompleted).toBe(true);
    }
  });
});

describe("lab 6: memory", () => {
  it("provenance alone is not enough; each listed control stops the bcc and the report is still sent", () => {
    expect(memoryRun({}).poisoned).toBe(true);
    expect(memoryRun({ memProvenance: true }).poisoned).toBe(true);
    for (const d of [{ memWriteAuth: true }, { memConfirm: true }, { memExpiry: true }, { memScope: true }, { memProvenance: true, taint: true }]) {
      const r = memoryRun(d);
      expect(r.poisoned, JSON.stringify(d)).toBe(false);
      expect(r.r2.taskCompleted).toBe(true);
    }
  });
});

describe("lab 7: RAG", () => {
  it("the stuffed upload outranks the real policy (0.66 vs 0.57); the sanitizer catches nothing", () => {
    const hits = retrieve("what is the refund policy", "acme", {});
    expect(hits[0].doc.id).toBe("d6");
    expect(hits[0].score.toFixed(2)).toBe("0.66");
    expect(hits.find((h) => h.doc.id === "d1")!.score.toFixed(2)).toBe("0.57");
    const s = ragAnswer("what is the refund policy", "acme", { sanitize: true });
    expect(s.followed && s.leakedCode).toBe(true);
  });
  it("spotlighting stops the instruction but not the cross-tenant leak; authz plus provenance fixes both", () => {
    const sp = ragAnswer("refund policy exceptions override code", "acme", { spotlight: true });
    expect(sp.followed).toBe(false);
    expect(sp.leakedCode).toBe(true);
    for (const q of ["what is the refund policy", "refund policy exceptions override code"]) {
      const a = ragAnswer(q, "acme", { authz: true, provenance: true });
      expect(a.followed || a.leakedCode, q).toBe(false);
      expect(a.answer).toContain("30 days");
    }
    expect(ragAnswer("shipping times", "acme", { authz: true, provenance: true }).answer).toContain("three to five");
  });
});

describe("lab 9: consumption", () => {
  it("matches the numbers in the text", () => {
    expect(consumptionRun("loop", {}).total).toBe(346_500);
    expect(consumptionRun("fanout", {}).total).toBe(346_500);
    expect(consumptionRun("fanout", { loopDetect: true }).total).toBe(346_500);
    expect(consumptionRun("loop", LIMITS_ON).total).toBe(4_500);
    expect(consumptionRun("fanout", LIMITS_ON).total).toBe(15_000);
    expect(consumptionRun("huge", LIMITS_ON).total).toBe(2_000);
  });
});

describe("lab 10: eval suite", () => {
  const res = Object.fromEntries(PRESETS.map((p) => [p.id, runEvals(p)]));
  it("4 benign and 17 attacks; prompt-level leaves 12 (70.6%); architectural leaves only I5 (5.9%)", () => {
    expect(res.none.nBenign).toBe(4);
    expect(res.none.nAttacks).toBe(17);
    expect(res.prompt.rows.filter((x) => x.c.attack && x.r.success).length).toBe(12);
    expect((res.prompt.asr * 100).toFixed(1)).toBe("70.6");
    expect(res.prompt.rows.find((x) => x.c.id === "M1")!.r.success).toBe(false);
    for (const id of ["arch", "all"]) {
      expect(res[id].rows.filter((x) => x.c.attack && x.r.success).map((x) => x.c.id)).toEqual(["I5"]);
      expect((res[id].asr * 100).toFixed(1)).toBe("5.9");
    }
  });
});
