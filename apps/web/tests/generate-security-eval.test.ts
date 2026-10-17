// Regenerates public/data/latent/security-eval.json from real runs of the local simulator.
// Run with:  GEN_SECURITY_EVAL=1 npx vitest run tests/generate-security-eval.test.ts
// Without the variable this file does nothing; tests/security-sim.test.ts checks the artifact still matches.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { it } from "vitest";
import { EVAL_CASES, PRESETS, runEvals } from "@/lib/latent/security/sim";

it.runIf(process.env.GEN_SECURITY_EVAL === "1")("writes the security eval artifact", () => {
  const src = readFileSync(path.join(__dirname, "..", "src", "lib", "latent", "security", "sim.ts"), "utf-8");
  const presets = PRESETS.map((p) => {
    const r = runEvals(p);
    return {
      id: p.id, label: p.label, defenses: Object.keys(p.d).filter((k) => p.d[k as keyof typeof p.d]), output_handling: p.output, limits: p.limits, rag_controls: p.rag,
      attack_success_rate: r.asr, attack_successes: r.rows.filter((x) => x.c.attack && x.r.success).length,
      benign_completed: r.rows.filter((x) => !x.c.attack && x.r.completed).length, false_blocks: r.falsePositives,
      correct_actions_rate: r.correct, residual_cases: r.rows.filter((x) => x.c.attack && x.r.success).map((x) => x.c.id),
      outcomes: Object.fromEntries(r.rows.map((x) => [x.c.id, { success: x.r.success, completed: x.r.completed, correct: x.r.correct }])),
    };
  });
  const art = {
    schema: "latentlens.security_eval/1",
    note: "Results from the LatentLens synthetic teaching simulator (a rule-based stand-in, not a model). Not benchmark estimates for production AI systems.",
    simulator_sha256: createHash("sha256").update(src.replace(/\r\n/g, "\n")).digest("hex"),
    n_adversarial: EVAL_CASES.filter((c) => c.attack).length, n_benign: EVAL_CASES.filter((c) => !c.attack).length,
    cases: EVAL_CASES.map((c) => ({ id: c.id, category: c.category, attack: c.attack, describe: c.describe })),
    presets,
  };
  writeFileSync(path.join(__dirname, "..", "public", "data", "latent", "security-eval.json"), JSON.stringify(art, null, 1) + "\n");
});
