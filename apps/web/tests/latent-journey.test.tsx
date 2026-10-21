import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SceneBlock, SceneTokens, SceneVectors } from "@/components/latent/journey/scenes-a";
import { SceneAttention, SceneMlp, SceneStack } from "@/components/latent/journey/scenes-b";
import { SceneLearning, SceneOutput, probsAt } from "@/components/latent/journey/scenes-c";
import { ProfessorDemo } from "@/components/latent/demo";
import { AttentionLab } from "@/components/latent/labs/attention";
import { KvLab, kvBytes, kvOps } from "@/components/latent/labs/kvcache";
import { RmsLab } from "@/components/latent/labs/norm";
import { RopeLab } from "@/components/latent/labs/rope";
import { SamplingLab, entropy } from "@/components/latent/labs/sampling";
import { TrainingLab } from "@/components/latent/labs/training";
import { LandingHero, QwenBlockOrder } from "@/components/latent/landing";
import { ResearchWorkspace, LayerProbeSection } from "@/components/latent/research";
import { DEFAULT_STATE, LEVELS, SCENES, parseState, serializeState, type JourneyState, type Level } from "@/lib/latent/journey";
import {
  EXAMPLE, TOY_VOCAB, causalAttention, layernorm, rmsnorm, seededDraws, softmax, toyForward, trainStep,
} from "@/lib/latent/toy-model";
import type { Architecture, GenerationSteps, Pending, TokenizerExamples, TokenTrace } from "@/lib/latent/types";

const DATA = path.join(__dirname, "..", "public", "data", "latent", "qwen3-8b");
const read = <T,>(f: string): T => JSON.parse(readFileSync(path.join(DATA, f), "utf-8"));
const arch = read<Architecture>("architecture.json");
const tok = read<TokenizerExamples>("tokenizer_examples.json");
const trace = read<TokenTrace>("token_trace.json");
const gen = read<GenerationSteps>("generation_steps.json");
const layerProbe = read<Pending>("layer_probe.json");
const text = (el: React.ReactElement) => renderToString(el).replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

describe("normalization (toy math must not teach the wrong concept)", () => {
  it("RMSNorm on [2, -1, 4, 1]: mean square 5.5, no mean subtraction, unit RMS before the gain", () => {
    const r = rmsnorm([2, -1, 4, 1], [1, 1, 1, 1], 1e-6);
    expect(r.meanSquare).toBe(5.5);
    expect(r.denom).toBeCloseTo(Math.sqrt(5.5 + 1e-6), 12);
    expect(Math.sqrt(sum(r.normalized.map((v) => v * v)) / 4)).toBeCloseTo(1, 5);
    expect(sum(r.out) / 4).toBeGreaterThan(0.5);                    // mean is NOT removed
  });
  it("scaling barely changes RMSNorm with a tiny epsilon; a large epsilon breaks scale invariance", () => {
    const a = rmsnorm([2, -1, 4, 1], [1, 1, 1, 1], 1e-6).out, b = rmsnorm([20, -10, 40, 10], [1, 1, 1, 1], 1e-6).out;
    a.forEach((v, i) => expect(b[i]).toBeCloseTo(v, 6));
    const small = rmsnorm([0.02, -0.01, 0.04, 0.01], [1, 1, 1, 1], 4).out;
    expect(Math.sqrt(sum(small.map((v) => v * v)) / 4)).toBeLessThan(0.05);
  });
  it("an offset changes RMSNorm but not LayerNorm; LayerNorm output has mean 0", () => {
    const r1 = rmsnorm([2, -1, 4, 1], [1, 1, 1, 1]).out, r2 = rmsnorm([7, 4, 9, 6], [1, 1, 1, 1]).out;
    expect(Math.abs(r1[1] - r2[1])).toBeGreaterThan(0.3);
    const l1 = layernorm([2, -1, 4, 1]).out, l2 = layernorm([7, 4, 9, 6]).out;
    l1.forEach((v, i) => expect(l2[i]).toBeCloseTo(v, 6));
    expect(sum(l1) / 4).toBeCloseTo(0, 10);
  });
  it("the learned gain multiplies after normalization and is separate from the input-dependent denominator", () => {
    const g = [2, 1, 1, 0.5];
    const r = rmsnorm([2, -1, 4, 1], g);
    r.out.forEach((v, i) => expect(v).toBeCloseTo(r.normalized[i] * g[i], 12));
    expect(rmsnorm([2, -1, 4, 1], [1, 1, 1, 1]).denom).toBe(r.denom);
  });
});

describe("softmax, temperature and sampling", () => {
  it("softmax sums to 1, is stable for large logits, and T = 0 is greedy without dividing by zero", () => {
    for (const T of [0.25, 1, 3]) expect(sum(softmax([1, 2, 3], T))).toBeCloseTo(1, 12);
    expect(softmax([1000, 999, -1000]).every(Number.isFinite)).toBe(true);
    expect(softmax([0.5, 3, 1], 0)).toEqual([0, 1, 0]);
  });
  it("higher temperature flattens (entropy rises) while the order of tokens is unchanged", () => {
    const z = [3.1, 2.4, 1.9, 1.2];
    const lo = softmax(z, 0.5), hi = softmax(z, 2);
    expect(entropy(hi)).toBeGreaterThan(entropy(lo));
    expect(hi.indexOf(Math.max(...hi))).toBe(lo.indexOf(Math.max(...lo)));
  });
  it("seeded draws are reproducible, and greedy draws always return the top token", () => {
    const p = softmax([3, 2, 1, 0]);
    expect(seededDraws(p, 30, 7)).toEqual(seededDraws(p, 30, 7));
    expect(seededDraws(p, 30, 7)).not.toEqual(seededDraws(p, 30, 8));
    expect(new Set(seededDraws(softmax([3, 2, 1, 0], 0), 50, 1))).toEqual(new Set([0]));
  });
  it("recorded probabilities are recomputed exactly from logits and full-vocabulary normalizers", () => {
    const { p, other } = probsAt(gen.step1, 1);
    p.forEach((v, i) => expect(v).toBeCloseTo(gen.step1.top[i].p, 4));
    expect(other).toBeGreaterThanOrEqual(0);
    expect(sum(p) + other).toBeCloseTo(1, 6);
    for (const k of Object.keys(gen.step1.logsumexp_by_temperature)) {
      const r = probsAt(gen.step1, Number(k));
      expect(r.p.every((x) => Number.isFinite(x) && x >= 0)).toBe(true);
      expect(sum(r.p)).toBeLessThanOrEqual(1 + 1e-6);
    }
    expect(probsAt(gen.step1, 0).p[0]).toBe(1);
    expect(() => probsAt(gen.step1, 0.9)).toThrow();       // unrecorded temperatures are refused, not approximated
  });
  it("recorded second steps belong to the recorded top candidates", () => {
    const top = gen.step1.top.slice(0, gen.step2.length).map((t) => t.id);
    for (const s of gen.step2) expect(top).toContain(s.appended.id);
  });
});

describe("attention", () => {
  const X = [[1, 0, 0.5], [0, 1, 0.5], [1, 1, 0], [0.5, -1, 1]];
  const W = [[1, 0], [0, 1], [0.5, 0.5]];
  const a = causalAttention(X, W, W, W);
  it("future positions are masked (null score, zero weight) and each row sums to 1", () => {
    a.weights.forEach((row, t) => {
      expect(sum(row)).toBeCloseTo(1, 12);
      row.forEach((w, j) => { if (j > t) { expect(w).toBe(0); expect(a.masked[t][j]).toBeNull(); } });
    });
  });
  it("scores are scaled by 1/sqrt(d_head) and the output is the weighted sum of values", () => {
    expect(a.scaled[2][1]).toBeCloseTo(a.scores[2][1] / Math.sqrt(2), 12);
    const t = 3;
    const manual = a.v[0].map((_, c) => sum(a.weights[t].map((w, j) => w * a.v[j][c])));
    manual.forEach((v, c) => expect(a.out[t][c]).toBeCloseTo(v, 12));
    expect(a.out[0]).toEqual(a.v[0]);          // the first position can only attend to itself
  });
});

describe("toy block and training", () => {
  const ids = EXAMPLE.tokens.map((t) => t.id);
  it("residual additions hold and switching a branch off passes the stream through", () => {
    const f = toyForward(ids);
    f.mid.forEach((m, t) => m.forEach((v, i) => expect(v).toBeCloseTo(f.embed[t][i] + f.attnUpdate[t][i], 12)));
    const na = toyForward(ids, { attention: true });
    expect(na.attnUpdate.every((u) => u.length === na.embed[0].length && u.every((x) => x === 0))).toBe(true);
    expect(na.out.flat().every(Number.isFinite)).toBe(true);
    na.mid.forEach((m, t) => m.forEach((v, i) => expect(v).toBeCloseTo(na.embed[t][i], 12)));
    const nm = toyForward(ids, { mlp: true });
    nm.out.forEach((o, t) => o.forEach((v, i) => expect(v).toBeCloseTo(nm.mid[t][i], 12)));
    expect(toyForward(ids)).toEqual(toyForward(ids));        // deterministic: resets reproduce the same numbers
  });
  it("one training step lowers the loss and raises the target probability; the gradient p - onehot sums to 0", () => {
    const h = toyForward(ids).finalNorm[5].out;
    const W = Array.from({ length: h.length }, (_, i) => TOY_VOCAB.map((_, j) => ((i * 7 + j * 3) % 5) / 10 - 0.2));
    for (const target of [0, 3, 7]) {
      const r = trainStep({ W, h }, target, 0.5);
      expect(sum(r.dz)).toBeCloseTo(0, 12);
      expect(r.lossNext).toBeLessThan(r.loss);
      expect(r.pNext[target]).toBeGreaterThan(r.p[target]);
    }
  });
});

describe("KV cache", () => {
  it("cache size formula matches the verified per-token value; GQA is 4x smaller than full MHA", () => {
    const v = arch.verified;
    expect(kvBytes(v.num_hidden_layers, v.num_key_value_heads, v.head_dim, 2, 1, 1)).toBe(arch.kv_cache.bytes_per_token_all_layers);
    expect(kvBytes(36, 32, 128, 2, 1, 1) / kvBytes(36, 8, 128, 2, 1, 1)).toBe(4);
  });
  it("operation counts: one new K/V per step with a cache, the whole prefix again without", () => {
    expect(kvOps(4, 3, true)).toBe(7);
    expect(kvOps(4, 3, false)).toBe(4 + 5 + 6 + 7);
  });
});

describe("journey state in the URL", () => {
  it("defaults, clamping and round trips", () => {
    expect(parseState("")).toEqual(DEFAULT_STATE);
    expect(parseState("?s=99&tok=-3&layer=500&level=nonsense")).toEqual({ s: SCENES.length, level: "story", tok: 0, layer: 35, step: 0 });
    const st: JourneyState = { s: 4, level: "mechanics", tok: 2, layer: 9, step: 3 };
    expect(parseState(serializeState(st))).toEqual(st);
    expect(SCENES).toHaveLength(8);
  });
});

describe("every scene at every level: provenance labels, no NaN, no live claims", () => {
  const toy = toyForward(EXAMPLE.tokens.map((t) => t.id));
  const data = { arch, tok, trace, gen };
  const scenes = [SceneTokens, SceneVectors, SceneBlock, SceneAttention, SceneMlp, SceneStack, SceneOutput, SceneLearning];
  for (const level of LEVELS.map((l) => l.id) as Level[]) {
    it(`renders all 8 scenes at level ${level}`, () => {
      scenes.forEach((Scene, i) => {
        const st: JourneyState = { ...DEFAULT_STATE, s: i + 1, level, step: 3 };
        const h = text(<Scene st={st} set={() => {}} data={data} toy={toy} />);
        expect(h, `scene ${i + 1}`).toMatch(/Toy calculation|Recorded Qwen measurement/);
        expect(h, `scene ${i + 1}`).not.toContain("NaN");
        expect(h, `scene ${i + 1}`).not.toContain("Live model computation");
        expect(h).toContain("Predict first");
        if (level === "story") expect(h).toContain("Where this analogy stops working");
      });
    });
  }
  it("the research level shows recorded Qwen evidence in the scenes that have recordings", () => {
    for (const i of [1, 2, 3, 4, 5, 6]) {
      const st: JourneyState = { ...DEFAULT_STATE, s: i + 1, level: "research", tok: 5 };
      const Scene = scenes[i];
      expect(text(<Scene st={st} set={() => {}} data={data} toy={toy} />), `scene ${i + 1}`).toContain("Recorded Qwen measurement");
    }
  });
  it("the stack scene labels intermediate projections as diagnostic, not the model's output", () => {
    const h = text(<SceneStack st={{ ...DEFAULT_STATE, s: 6, level: "research", tok: 5, layer: 20 }} set={() => {}} data={data} toy={toy} />);
    expect(h).toContain("intermediate diagnostic projection, not Qwen's output at this block");
  });
  it("the output scene uses one consistent recording and states the difference from the earlier trace", () => {
    const h = text(<SceneOutput st={{ ...DEFAULT_STATE, s: 7, level: "research" }} set={() => {}} data={data} toy={toy} />);
    expect(h).toContain("Two recordings of the same sentence differ slightly");
  });
});

describe("labs, research, demo, landing", () => {
  it("each lab renders with its provenance and without NaN", () => {
    for (const el of [<RmsLab key="a" arch={arch} />, <AttentionLab key="b" trace={trace} />, <RopeLab key="c" arch={arch} trace={trace} />,
      <SamplingLab key="d" gen={gen} />, <KvLab key="e" arch={arch} />, <TrainingLab key="f" params={arch.parameters.total} />]) {
      const h = text(el);
      expect(h).toContain("Toy calculation");
      expect(h).not.toContain("NaN");
      expect(h).toContain("Predict first");
    }
    expect(text(<KvLab arch={arch} />)).toContain("overhead excluded");
    expect(text(<RmsLab arch={arch} />)).toContain("Recorded Qwen3-8B-Base RMSNorm gains (not the toy sliders)");
  });
  it("research stays pending and states what a probe can and cannot show", () => {
    const h = text(<><ResearchWorkspace arch={arch} /><LayerProbeSection lp={layerProbe} /></>);
    expect(layerProbe.status).toBe("pending");
    expect(h).toContain("Experiment pending");
    expect(h).toContain("has not been granted");
    expect(h).toContain("reliable proof of authorship");
  });
  it("the professor demo opens on step 1 with explicit controls and no autoplay", () => {
    const h = text(<ProfessorDemo arch={arch} layerProbe={layerProbe} tok={tok} trace={trace} />);
    expect(h).toContain("Step 1 of 5");
    expect(h).toContain("Nothing advances automatically");
    for (const t of ["Back", "Next", "Reset", "Notes (N)", "Deeper (D)"]) expect(h).toContain(t);
  });
  it("the landing page asks the central question and shows the verified Qwen block order", () => {
    const h = text(<><LandingHero /><QwenBlockOrder arch={arch} /></>);
    expect(h).toContain("How does this piece of text become the next token?");
    for (const m of ["input_layernorm", "q_norm, k_norm", "rotary embedding", "post_attention_layernorm", "mlp (SwiGLU)"]) expect(h).toContain(m);
    expect(h).toContain(`${arch.verified.num_hidden_layers} blocks`);
  });
});
