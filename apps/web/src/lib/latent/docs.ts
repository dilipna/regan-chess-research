// Markdown study guides generated from the curriculum data, so the docs and the website cannot drift apart.
// tests/docs-sync.test.ts checks the files in docs/ equal these strings; regenerate with
//   GEN_DOCS=1 npx vitest run tests/docs-sync.test.ts

import { ALL_PAIRS_LIST, EXTRAS } from "./mastery/confusion-extras";
import { CAREER, FINAL_TEST, WALK } from "./mastery/course";
import { LEVELS, TOPICS, topicsAt } from "./mastery";
import { DAILY_PLAN, INTERVALS } from "./mastery/progress";
import { FRAMEWORKS, FRAMEWORKS_CHECKED, OWASP_AGENTIC_2026, OWASP_LLM_2025, OWASP_LLM_2026, REDTEAM_STEPS, REPORT_FIELDS } from "./security/frameworks";
import type { Topic } from "./mastery/types";

const ALL_PAIRS = ALL_PAIRS_LIST();
const HEAD = (title: string, purpose: string) => `# ${title}\n\n${purpose}\n\n_Generated from the LatentLens curriculum data (apps/web/src/lib/latent). Edit the data, then regenerate; do not edit by hand._\n`;
const site = (t: Topic) => (t.track === "security" ? `/latent/security/learn/${t.slug}` : `/latent/mastery/${t.slug}`);

function topicSection(t: Topic) {
  const lines = [`### ${t.title}`, "", `Route: \`${site(t)}\``, "", `**In ten seconds.** ${t.intuition}`, "", `**Where.** ${t.where}`, "", "**Mechanism.**", ...t.mechanism.map((m) => `- ${m}`)];
  if (t.eq) lines.push("", "```", ...t.eq, "```");
  if (t.shapes) lines.push("", "| Input | Operation | Output |", "|---|---|---|", ...t.shapes.map((s) => `| \`${s[0]}\` | ${s[1]} | \`${s[2]}\` |`));
  lines.push("", `**${t.track === "security" ? "LLM property behind it" : "Qwen connection"}.**`, ...t.qwen.map((q) => `- (${q.status}) ${q.text}`));
  lines.push("", `**Why it exists.** ${t.why}`, "", `**Without it.** ${t.breaks}`, "", `**Training vs inference.** ${t.trainInfer}`, "", `**Security lens.** ${t.security}`, "", `**Common confusion.** ${t.confusion}`, "", `**Teach back.** ${t.teachBack.prompt}`, ...t.teachBack.points.map((p) => `- [ ] ${p}`), "", `**Interview (level ${t.interview.level}).** ${t.interview.q}`, "");
  return lines.join("\n");
}

export function masteryDoc() {
  const parts = [HEAD("LLM end-to-end mastery", "From one token to a production AI system: every Mastery topic in the A to M format, traced through Qwen3-8B-Base where facts are verifiable.")];
  for (const l of LEVELS.filter((x) => x.n >= 1 && x.n <= 6)) parts.push(`## Level ${l.n}: ${l.title}\n\n${l.goal}.\n`, ...topicsAt(l.n).map(topicSection));
  parts.push("## Follow one request end to end\n", ...WALK.map((w, i) => `${i + 1}. **${w.stage}** (${w.trust}). ${w.what}${w.risk ? ` Risk: ${w.risk}` : ""}${w.control ? ` Control: ${w.control}` : ""}`), "", "## Final mastery test\n", ...FINAL_TEST.map((f) => `**${f.part}. ${f.title}.** ${f.prompt}\n${f.rubric.map((r) => `- [ ] ${r}`).join("\n")}\n`));
  return parts.join("\n");
}

export function securityDoc() {
  const parts = [HEAD("AI security from zero to red team", "Security begins with the system, not the prompt. Levels 7 to 10 of the LatentLens curriculum. Conceptual only: no operational attack recipes. The model proposes; the system authorizes.")];
  for (const l of LEVELS.filter((x) => x.n >= 7 && x.n <= 10)) parts.push(`## Level ${l.n}: ${l.title}\n\n${l.goal}.\n`, ...topicsAt(l.n).map(topicSection));
  parts.push(`## Frameworks (verified ${FRAMEWORKS_CHECKED})\n`, ...FRAMEWORKS.map((f) => `- **${f.name}** (${f.source}), ${f.version}. ${f.covers} Source: ${f.url}${f.note ? ` Note: ${f.note}` : ""}`), "", "### OWASP Top 10 for LLM Applications, 2025", ...OWASP_LLM_2025.map((x) => `- ${x}`), "", "### OWASP Top 10 for LLM Applications, 2026", ...OWASP_LLM_2026.map((x) => `- ${x}`), "", "### OWASP Top 10 for Agentic Applications (2026 edition)", ...OWASP_AGENTIC_2026.map((x) => `- ${x}`), "");
  return parts.join("\n");
}

export function glossaryDoc() {
  const sec = TOPICS.filter((t) => t.track === "security");
  const pairs = ALL_PAIRS.filter((p) => TOPICS.find((t) => t.slug === p.topic)?.track === "security");
  return [HEAD("AI security glossary", "Short definitions of the AI-security concepts in LatentLens, then the distinctions people most often blur."),
    "## Concepts\n", ...sec.map((t) => `**${t.title}.** ${t.intuition} (Level ${t.level}; \`${site(t)}\`)\n`),
    "## Distinctions\n", ...pairs.map((p) => `**${p.a} vs ${p.b}.** ${p.key}\n`)].join("\n");
}

export function pairsDoc() {
  return [HEAD("LLM and AI-security confusion pairs", "Say the difference aloud before reading it. Each pair: the one-sentence difference, a comparison, an example and a trap question."),
    ...ALL_PAIRS.map((p) => { const x = EXTRAS[`${p.a}|${p.b}`]; return [`## ${p.a} vs ${p.b}`, "", p.key, "", `| | ${p.a} | ${p.b} |`, "|---|---|---|", ...p.rows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} |`), "", x ? `**Example.** ${x.example}\n\n**Trap.** ${x.trap.q} _${x.trap.a}_` : "", ""].join("\n"); })].join("\n");
}

export function checklistDoc() {
  return [HEAD("AI red-team checklist", "A method, not a payload collection. Use only in sandboxes you are authorized to test, with fake data."),
    "## Process\n", ...REDTEAM_STEPS.map(([s, d], i) => `${i + 1}. [ ] **${s}.** ${d}`), "",
    "## Purple-team frame for every finding\n", "- **Red:** what assumption failed?", "- **Attack path:** where did data or control cross a trust boundary without a check?", "- **Observation:** what happened, how often (rate over repeated trials)?", "- **Blue:** which control changes the architecture (not just the prompt)?", "- **Retest:** does the same fixed scenario still succeed?", "- **Residual risk:** what remains, and why?", "",
    "## Types of testing\n", "- Model red teaming: the model's learned behaviour, measured statistically.", "- Application red teaming: the whole system, including retrieval, tools, memory and permissions.", "- Agent red teaming: multi-step actions, identities and approvals.", "- Penetration testing: conventional software and infrastructure flaws.", "- Adversarial ML evaluation: robustness of models to crafted inputs.", "- Safety evaluation: harmful capabilities and policy compliance.", ""].join("\n");
}

const FIELD_HINTS: Record<string, string> = {
  Title: "Component, failure and consequence in one line, e.g. \"Calendar invites can trigger unapproved transfers\".",
  Summary: "Two or three sentences a non-specialist can act on.",
  "Affected component": "Service, tool, model version and configuration.",
  Prerequisites: "What the attacker needs: position (user, document author, server operator), access, timing.",
  "Threat model": "Assets at risk, trust boundary crossed, attacker capability.",
  "Observed behavior": "What the system did, with the success rate over repeated trials.",
  "Expected behavior": "What a secure system should have done.",
  Impact: "Effect on confidentiality, integrity or availability of named assets.",
  Evidence: "Logs, transcripts and configuration from the sandbox run; fake data only.",
  "Root cause": "The design assumption that failed (for example: untrusted content can choose tool arguments).",
  "Recommended mitigation": "Architecture-level control first (permissions, validation, approval), then likelihood reductions.",
  "Reproduction in sandbox": "Exact fixed inputs, configuration, model and decoding settings, and number of trials.",
  "Severity rationale": "Impact on assets, attacker position and prerequisites, reliability (success rate), existing mitigations.",
  "Regression test": "The automated case that must fail before the fix and pass after.",
  "Residual risk": "What the fix does not cover.",
};
export function findingDoc() {
  return [HEAD("AI security finding template", "Copy this for each finding from an authorized, sandboxed test."),
    ...REPORT_FIELDS.map((f) => `## ${f}\n\n_${FIELD_HINTS[f] ?? "…"}_\n`)].join("\n");
}

export function reviewDoc() {
  return [HEAD("Daily LLM review", "Ten minutes a day at /latent/review."),
    "## What a session contains\n", ...DAILY_PLAN.map((p) => `- ${p.n} ${{ arch: "architecture", traininf: "training and inference", app: "RAG and agents", security: "security", connection: "connection" }[p.area]} question${p.n > 1 ? "s" : ""}`), "- 1 teach-back (explain a concept in writing, then tick the rubric)", "",
    "## How questions are chosen\n", "A lightweight deterministic review schedule, not a scientifically optimized algorithm:", "", "1. Concepts you answered wrong last time come first.", "2. Then concepts you marked as guessed (low confidence).", "3. Then concepts whose review date has passed.", "4. Then concepts you have never seen.", "", `Each correct answer moves a concept to the next interval (${INTERVALS.map((ms) => `${ms / 86_400_000}d`).join(", ")}); a wrong answer moves it back to the start. Everything is stored in your browser's local storage; nothing is sent anywhere. "Reset progress" clears it.`, ""].join("\n");
}

export function careerDoc() {
  return [HEAD("Career map: AI security and LLM engineering", "How LatentLens topics map to skills. This is a study map, not a claim about job requirements."),
    "| Skill | What it enables | Where in LatentLens |", "|---|---|---|", ...CAREER.map((c) => `| ${c.skill} | ${c.maps} | \`${c.where}\` |`), ""].join("\n");
}

export const GENERATED_DOCS: Record<string, () => string> = {
  "LLM_END_TO_END_MASTERY.md": masteryDoc,
  "AI_SECURITY_FROM_ZERO_TO_RED_TEAM.md": securityDoc,
  "AI_SECURITY_GLOSSARY.md": glossaryDoc,
  "LLM_CONFUSION_PAIRS.md": pairsDoc,
  "AI_RED_TEAM_CHECKLIST.md": checklistDoc,
  "AI_SECURITY_FINDING_TEMPLATE.md": findingDoc,
  "DAILY_LLM_REVIEW.md": reviewDoc,
  "CAREER_AI_SECURITY_MAP.md": careerDoc,
};
