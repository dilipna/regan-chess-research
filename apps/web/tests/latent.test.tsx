import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AttentionLab } from "@/components/latent/attention-lab";
import { BlockMicroscope } from "@/components/latent/block";
import { FollowOneToken } from "@/components/latent/follow-token";
import { Methods } from "@/components/latent/methods";
import { MlpLab } from "@/components/latent/mlp-lab";
import { OutputLab } from "@/components/latent/output-lab";
import { ArchitectureOverview, Hero, ModeCards } from "@/components/latent/overview";
import { PHASES } from "@/lib/site/phases";
import { ComponentResearch, LayerProbeSection, PcaSection, RmsnormResearch } from "@/components/latent/research";
import { RmsnormLab } from "@/components/latent/rmsnorm-lab";
import { KvCacheLab, TeachBack, TrainingSection } from "@/components/latent/training";
import { blockParts, pipelineParts } from "@/lib/latent/parts";
import { QUESTIONS } from "@/lib/latent/questions";
import {
  backpropStep, causalAttention, dot2, fmtProb, layernorm, probsWithNormalizer, rmsnormSteps, rotate2, softmax, topKMask, topPMask,
} from "@/lib/latent/toy";
import type { Architecture, LayerProbe, Metadata, Pending, Recall, RecallPrecision, StreamingCheck, TokenizerExamples, TokenTrace } from "@/lib/latent/types";

const WEB = path.join(__dirname, "..");
const DATA = path.join(WEB, "public", "data", "latent", "qwen3-8b");
const read = <T,>(f: string): T => JSON.parse(readFileSync(path.join(DATA, f), "utf-8"));
const arch = read<Architecture>("architecture.json");
const tok = read<TokenizerExamples>("tokenizer_examples.json");
const trace = read<TokenTrace>("token_trace.json");
const recall = read<Recall>("recall_probe.json");
const layerProbe = read<LayerProbe | Pending>("layer_probe.json");
const precision = read<RecallPrecision>("recall_precision_check.json");
const streaming = read<StreamingCheck>("streaming_check.json");
const metadata = read<Metadata>("metadata.json");
const text = (el: React.ReactElement) => renderToString(el).replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/\s+/g, " ");

describe("toy mathematics used in Learn Mode", () => {
  it("RMSNorm on [2, -1, 4, 1] matches the hand calculation", () => {
    const s = rmsnormSteps([2, -1, 4, 1], [1, 1, 1, 1], 1e-6);
    expect(s.squares).toEqual([4, 1, 16, 1]);
    expect(s.meanSquare).toBe(5.5);
    expect(s.rms).toBeCloseTo(2.34521, 4);
    expect(s.normalized[2]).toBeCloseTo(1.70561, 4);
    const r = Math.sqrt(s.normalized.reduce((a, v) => a + v * v, 0) / 4);
    expect(r).toBeCloseTo(1, 5);
  });
  it("RMSNorm is scale-invariant but not shift-invariant; LayerNorm is both", () => {
    const x = [2, -1, 4, 1];
    expect(rmsnormSteps(x.map((v) => v * 10), undefined, 0).out).toEqual(rmsnormSteps(x, undefined, 0).out.map((v) => expect.closeTo(v, 10)));
    expect(rmsnormSteps(x.map((v) => v + 5)).out[1]).not.toBeCloseTo(rmsnormSteps(x).out[1], 2);
    const a = layernorm(x).out, b = layernorm(x.map((v) => v + 5)).out;
    a.forEach((v, i) => expect(b[i]).toBeCloseTo(v, 6));
  });
  it("causal attention hides future positions and rows sum to one", () => {
    const Q = [[1, 0], [0, 1], [1, 1]], K = [[1, 0.5], [0, 1], [1, -0.5]], V = [[1, 0], [0, 1], [1, 1]];
    const r = causalAttention(Q, K, V);
    r.weights.forEach((row, t) => {
      expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
      row.forEach((w, j) => { if (j > t) expect(w).toBe(0); });
    });
    expect(r.out[0]).toEqual(V[0]);
  });
  it("RoPE scores depend only on relative position", () => {
    const q: [number, number] = [1, 0.35], k: [number, number] = [0.8, 0.6], th = 0.5;
    const s = (t: number, u: number) => dot2(rotate2(q, t * th), rotate2(k, u * th));
    expect(s(3, 1)).toBeCloseTo(s(7, 5), 10);
    expect(s(3, 1)).not.toBeCloseTo(s(3, 2), 3);
  });
  it("top-k and top-p select the expected sets", () => {
    const p = softmax([3, 2, 1, 0]);
    expect(topKMask(p, 2)).toEqual([true, true, false, false]);
    expect(topPMask(p, p[0] + 1e-9)).toEqual([true, true, false, false]);
    expect(topPMask(p, p[0] - 1e-9)).toEqual([true, false, false, false]);
  });
  it("probabilities rounded to zero are never shown as an exact value", () => {
    expect(fmtProb(0)).toBe("< 1e-5");
    expect(fmtProb(0.162)).toBe("0.162");
    expect(fmtProb(2.1e-5)).toBe("2.1e-5");
  });
  it("backprop gradients match finite differences", () => {
    const f = (w1: number, w2: number) => (w2 * w1 * 1.5 - 3) ** 2;
    const s = backpropStep(1.5, 3, 0.5, 0.8, 0.05), h = 1e-6;
    expect(s.dL_dw1).toBeCloseTo((f(0.5 + h, 0.8) - f(0.5 - h, 0.8)) / (2 * h), 4);
    expect(s.dL_dw2).toBeCloseTo((f(0.5, 0.8 + h) - f(0.5, 0.8 - h)) / (2 * h), 4);
    expect(f(s.next.w1, s.next.w2)).toBeLessThan(s.loss);
  });
});

describe("artifacts", () => {
  it("architecture is verified and internally consistent", () => {
    const v = arch.verified;
    expect(arch.status).toBe("ok");
    expect(arch.model_id).toBe("Qwen/Qwen3-8B-Base");
    expect(v.num_attention_heads % v.num_key_value_heads).toBe(0);
    expect(v.q_proj_out).toBe(v.num_attention_heads * v.head_dim);
    expect(v.kv_proj_out).toBe(v.num_key_value_heads * v.head_dim);
    expect(arch.parameters.total).toBe(arch.parameters.stored_tensor_params);
    expect(arch.checks.source_order.every((c) => c.verified)).toBe(true);
    expect(arch.kv_cache.bytes_per_token_all_layers).toBe(2 * v.num_key_value_heads * v.head_dim * v.num_hidden_layers * 2);
  });
  it("tokenizer examples are real and consistent", () => {
    for (const e of tok.examples) {
      expect(e.tokens.length).toBe(e.n_tokens);
      expect(e.roundtrip_ok).toBe(true);
    }
    expect(tok.embedding.tokens.every((t) => t.dim === arch.verified.hidden_size)).toBe(true);
  });
  it("trace: last diagnostic depth equals the model output, per-position arrays have one value per token", () => {
    expect(trace.layers.length).toBe(arch.verified.num_hidden_layers);
    expect(trace.diagnostic_lens_last_position.at(-1)!.final_top_rank).toBe(1);
    expect(trace.diagnostic_lens_last_position.at(-1)!.top[0].id).toBe(trace.final.top[0].id);
    for (const l of trace.layers) expect(l.resid_post_rms.length).toBe(trace.tokens.length);
  });
  it("every exported temperature gives finite probabilities (regression: '1.0' vs '1' keys)", () => {
    for (const [k, lse] of Object.entries(trace.final.logsumexp_by_temperature)) {
      const p = probsWithNormalizer(trace.final.top.map((t) => t.logit), Number(k), lse);
      expect(p.every(Number.isFinite)).toBe(true);
      expect(p.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(1 + 1e-6);
    }
    const p1 = probsWithNormalizer(trace.final.top.map((t) => t.logit), 1, trace.final.logsumexp_by_temperature["1.0"] ?? trace.final.logsumexp_by_temperature["1"]);
    p1.slice(0, 10).forEach((v, i) => expect(v).toBeCloseTo(trace.final.top[i].p, 4));
  });
  it("recall summaries agree with per-position data, and the last depth equals the model output", () => {
    for (const p of recall.passages) {
      expect(p.positions.length).toBe(p.n_scored);
      expect(p.positions.filter((x) => x.top1).length / p.n_scored).toBeCloseTo(p.summary.top1_rate, 4);
      expect(p.depth_rank.length).toBe(recall.n_layers + 1);
      expect(p.depth_rank.at(-1)).toEqual(p.positions.map((x) => x.rank));
    }
    expect(precision.passages.map((p) => p.name)).toEqual(recall.passages.map((p) => p.name));
  });
  it("unrun experiments are pending and carry no result values", () => {
    for (const f of ["layer_probe.json", "rmsnorm_probe.json", "component_probe.json", "pca/index.json"]) {
      const a = read<Record<string, unknown>>(f);
      if (a.status === "pending") {
        for (const k of ["layers", "test", "depths", "points", "block_rmsnorm"]) expect(a).not.toHaveProperty(k);
        expect((a.how_to_run as string[]).length).toBeGreaterThan(0);
        expect(metadata.artifacts[f]).toBe("pending");
      }
    }
  });
});

describe("rendering", () => {
  it("overview shows verified architecture and the V1 to V2 framing", () => {
    const h = text(<><Hero /><ArchitectureOverview arch={arch} /><ModeCards arch={arch} layerProbe={layerProbe} precision={precision} /></>);
    for (const t of ["LatentLens", "Tracing human and machine writing through transformer layers.", "Start 5-Minute Professor Demo",
      "The original project studied model behavior from the outside. LatentLens looks inside the transformer.", "36 blocks", "32 / 8"]) expect(h).toContain(t);
  });
  it("Learn Mode renders every section with the five ideas", () => {
    const h = text(<><FollowOneToken arch={arch} tok={tok} trace={trace} /><BlockMicroscope arch={arch} /><RmsnormLab arch={arch} trace={trace} />
      <AttentionLab arch={arch} trace={trace} /><MlpLab arch={arch} trace={trace} /><OutputLab arch={arch} trace={trace} /><KvCacheLab arch={arch} />
      <TrainingSection arch={arch} trace={trace} /><TeachBack /></>);
    for (const t of ["Follow one token through Qwen", "Intuition", "Exact mechanism", "Tensor shapes", "Why it exists", "Common confusion",
      "Transformer block microscope", "RMSNorm lab", "Block RMSNorm and Q/K RMSNorm are different operations", "Rotary position embedding",
      "Causal attention on four tokens", "ATTENTION mixes information ACROSS positions", "MLP transforms EACH position independently",
      "LOGIT ≠ PROBABILITY", "Decoding lab", "KV cache", "How Qwen learns", "Teacher forcing", "Backprop explorer", "Test my understanding", "Reveal explanation",
      "not \"Qwen's prediction at layer k\""]) expect(h).toContain(t);
    expect(h).not.toContain("NaN");
  });
  it("every block part and pipeline stage has all five ideas", () => {
    for (const p of [...pipelineParts(arch), ...blockParts(arch)])
      for (const k of ["intuition", "mechanism", "shapes", "why", "confusion"] as const) expect(p[k].length).toBeGreaterThan(5);
    expect(blockParts(arch).map((p) => p.id)).toEqual(["resid_in", "norm1", "qkv", "qknorm", "rope", "attn", "oproj", "add1", "norm2", "mlp", "add2", "next_block"]);
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(16);
  });
  it("pending research shows 'Experiment pending' and no curves or numbers", () => {
    const pend: Pending = { schema: "x", status: "pending", model_id: "Qwen/Qwen3-8B-Base", reason: "Needs data.", how_to_run: ["python x.py"] };
    const h = text(<><LayerProbeSection lp={pend} /><PcaSection pca={pend} /><RmsnormResearch r={pend} /><ComponentResearch c={pend} /></>);
    expect(h.match(/Experiment pending/g)?.length).toBe(4);
    expect(h).not.toMatch(/ROC-AUC by depth|0\.\d{3}/);
  });
  it("a completed layer probe renders its measured values (synthetic test fixture, never exported)", () => {
    const m = (auc: number) => ({ n: 100, n_ai: 50, n_human: 50, roc_auc: auc, pr_auc: auc, balanced_accuracy: auc, f1: auc });
    const lp: LayerProbe = { status: "ok", model_id: "test", n_layers: 2, dataset: "fixture", pooling: "mean",
      layers: [0, 1, 2].map((d) => ({ depth: d, relative_depth: d / 2, C: 1, val: m(0.6 + d * 0.05) })), selected_depth: 2, final_depth: 2,
      test: { selected_depth: { ...m(0.678), roc_auc_ci95: [0.61, 0.73] }, final_depth: m(0.678) }, extra_tests: {}, per_generator_test: {}, length_matched_test: null,
      controls: { random_labels: [{ seed: 0, val_roc_auc: 0.512, test_roc_auc: 0.497 }], baselines: {} }, splits: { train: { n: 10, n_ai: 5, n_human: 5 }, val: { n: 4, n_ai: 2, n_human: 2 }, test: { n: 4, n_ai: 2, n_human: 2 } } };
    const h = text(<LayerProbeSection lp={lp} />);
    expect(h).toContain("0.678");
    expect(h).toContain("shuffled labels");
    expect(h).not.toContain("Experiment pending");
  });
  it("methods page states the limitations and claims not made", () => {
    const h = text(<Methods arch={arch} metadata={metadata} streaming={streaming} />);
    for (const t of ["Limitations", "Claims this project does not make", "Layer k detects AI text.", "Black-box API models are never internally probed"]) expect(h).toContain(t);
  });
});

describe("Version 1 preservation and copy rules", () => {
  it("all Version 1 routes still exist", () => {
    for (const r of ["", "about", "analyze", "compare", "demo", "examples", "methodology", "present", "research", "results", "walkthrough"])
      expect(existsSync(path.join(WEB, "src", "app", r, "page.tsx"))).toBe(true);
  });
  it("the site navigation offers both phases and the sitemap lists the new routes", () => {
    expect(readFileSync(path.join(WEB, "src", "components", "site", "nav.tsx"), "utf-8")).toContain("PHASES.map");
    expect(PHASES.map((p) => [p.n, p.home])).toEqual([[1, "/chess"], [2, "/latent/professor"]]);
    const sm = readFileSync(path.join(WEB, "src", "app", "sitemap.ts"), "utf-8");
    for (const r of ["/latent", "/latent/learn", "/latent/research", "/latent/recall", "/latent/methods", "/latent/demo"]) expect(sm).toContain(`"${r}"`);
  });
  it("the LatentLens theme is scoped to LatentLens pages and leaves Version 1 unchanged", () => {
    const css = readFileSync(path.join(WEB, "src", "app", "latent", "latent.css"), "utf-8");
    expect(readFileSync(path.join(WEB, "src", "app", "latent", "layout.tsx"), "utf-8")).toContain('data-latent-theme="deep"');
    for (const rule of css.match(/^[^\s@/*}][^{]*\{/gm) ?? []) expect(rule).toMatch(/data-latent-theme|^\s*(0%|50%|100%)/);
    expect(readFileSync(path.join(WEB, "src", "app", "globals.css"), "utf-8")).not.toContain("data-latent-theme");
  });
  it("LatentLens public copy uses no em dashes", () => {
    const files: string[] = [];
    const walk = (d: string) => { for (const f of readdirSync(d)) { const p = path.join(d, f); if (statSync(p).isDirectory()) walk(p); else files.push(p); } };
    for (const d of ["src/components/latent", "src/lib/latent", "src/app/latent"]) walk(path.join(WEB, d));
    for (const f of files) expect(readFileSync(f, "utf-8"), f).not.toContain("—");
  });
});
