import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }), usePathname: () => "/latent/professor" }));

import ProfessorPage from "@/app/latent/professor/page";
import { ChecklistPanel, ExperimentPanel, HypothesesPanel, LatentPanel, NormCompare, ReganPanel, TracePanel } from "@/components/latent/professor/panels";
import { CHECKLIST, FUTURE_EXTENSION, LENS_CAVEAT, PROF_SECTIONS, PROF_TOTAL_MINUTES, QUESTIONS, REGAN_REPORT } from "@/lib/latent/professor";
import type { Architecture, Metadata, TokenTrace } from "@/lib/latent/types";

const text = (el: React.ReactElement) => renderToString(el).replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const DATA = path.join(__dirname, "..", "public", "data", "latent", "qwen3-8b");
const read = <T,>(f: string): T => JSON.parse(readFileSync(path.join(DATA, f), "utf-8"));
const arch = read<Architecture>("architecture.json");
const trace = read<TokenTrace>("token_trace.json");
const meta = read<Metadata>("metadata.json");
const all = PROF_SECTIONS.flatMap((s) => [s.title, s.lead, ...(s.flow ?? []), ...s.points]).join(" ");

describe("/latent/professor", () => {
  it("renders the first section and the full section list, in an academic register", async () => {
    const h = text(await ProfessorPage());
    expect(h).toContain("From outputs to internals");
    expect(h).toContain("After our discussion, I wanted to understand what happens inside the model");
    for (const s of PROF_SECTIONS) expect(h).toContain(s.title);
    for (const banned of ["Pip", "sticker", "Sticker"]) expect(h).not.toContain(banned);
  });
  it("follows the meeting sequence and fits a 5 to 7 minute demo", () => {
    expect(PROF_SECTIONS.map((s) => s.id)).toEqual(["outputs-to-internals", "block", "latent", "rmsnorm", "trace", "regan", "hypotheses", "experiment", "checklist"]);
    expect(PROF_TOTAL_MINUTES).toBeGreaterThanOrEqual(5);
    expect(PROF_TOTAL_MINUTES).toBeLessThanOrEqual(7);
  });
  it("quotes only verified architecture numbers", () => {
    const v = arch.verified;
    for (const n of [arch.parameters.total.toLocaleString("en-US"), v.vocab_size.toLocaleString("en-US"), v.tokenizer_size.toLocaleString("en-US"), "1e-6", v.intermediate_size.toLocaleString("en-US"), "[B, T, 4096]", "36 blocks", "32 heads of 128", "8 heads of 128", "1,000,000"]) expect(all).toContain(n);
    expect([v.hidden_size, v.num_hidden_layers, v.num_attention_heads, v.num_key_value_heads, v.head_dim, v.rope_theta, v.tie_word_embeddings]).toEqual([4096, 36, 32, 8, 128, 1000000, false]);
    expect(all).toContain("untied");
    const norm = text(<NormCompare arch={arch} trace={trace} />);
    expect(norm).toContain("32 × 128");
    expect(norm).toContain("8 × 128");
    expect(norm).toContain("ε = 1e-6");
  });
  it("shows the real trace with its recorded values, provenance and the logit-lens caveat", () => {
    const h = text(<TracePanel trace={trace} meta={meta} />);
    expect(h).toContain("Real Qwen trace");
    expect(h).toContain("One recorded example, not a population-level result.");
    expect(h).toContain(LENS_CAVEAT);
    for (const s of [trace.model_id, trace.revision, trace.text, trace.dtype, trace.provenance.timestamp, trace.provenance.git_commit!, "token_trace.json", "RTX 3050 Ti"]) expect(h).toContain(s);
    const lens = trace.diagnostic_lens_last_position;
    expect(lens[0].final_top_rank.toLocaleString("en-US")).toBe("74,658");
    expect(h).toContain(lens[0].final_top_rank.toLocaleString("en-US"));
    expect(lens[trace.n_layers].final_top_rank).toBe(1);
    for (const p of trace.positions) expect(h).toContain(p.rank.toLocaleString("en-US"));
  });
  it("derives the latent-state magnitude from the artifact, with careful wording", () => {
    const h = text(<LatentPanel trace={trace} />);
    const last = trace.tokens.length - 1;
    const ratio = Math.round(trace.layers[trace.n_layers - 1].resid_post_rms[last] / trace.embedding_rms[last]);
    expect(h).toContain(`about ${ratio.toLocaleString("en-US")}×`);
    expect(h).toContain("for this recorded example");
    expect(h).toContain("[1, 6, 4,096]");
  });
  it("labels Professor Regan's numbers as reported, not measured, and keeps the wall a hypothesis", () => {
    const h = text(<ReganPanel />);
    expect(h).toContain("Professor-reported observation");
    expect(h).toContain("Not a LatentLens experiment result");
    for (const s of ["86.31%", "86.34%", "about 40 more tokens", "we will", "we shall not", "exact checkpoint to be confirmed"]) expect(h).toContain(s);
    expect(REGAN_REPORT.hypothesis).toContain("hypothesis");
    expect(h).toContain("not yet measured");
    expect(h).not.toMatch(/Qwen\/Qwen[^ ]*(14B|27B|32B)/);
  });
  it("keeps hypotheses and the will/shall plan marked as untested", () => {
    expect(text(<HypothesesPanel />)).toContain("Hypotheses, not results");
    const e = text(<ExperimentPanel recall={null} />);
    expect(e).toContain("Pending professor checkpoint + model access");
    expect(e).toContain("At what depth do the two candidate continuations begin to separate?");
  });
  it("ends with the checklist, the ten questions, and human-vs-AI only as a future extension", () => {
    const h = text(<ChecklistPanel />);
    expect(CHECKLIST).toHaveLength(12);
    expect(QUESTIONS).toHaveLength(10);
    for (const q of QUESTIONS) expect(h).toContain(q);
    expect(h).toContain(FUTURE_EXTENSION);
    expect(PROF_SECTIONS.at(-1)!.evidence).toBe("checklist");
    expect(all).not.toMatch(/human[- ]vs[- ]AI/i);
  });
  it("avoids overclaiming language and em dashes", () => {
    expect(all).not.toMatch(/layer (that )?detects AI|layer \d+ (knows|predicts)/i);
    expect(all).toContain("mixes value vectors across positions");
    expect(all).not.toContain("—");
  });
});
