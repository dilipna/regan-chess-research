import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }), usePathname: () => "/latent/story" }));
import { StoryCover } from "@/components/latent/story/book";
import { ChapterView, type StoryData } from "@/components/latent/story/chapter";
import { BEST_SURPRISE, CODE_WORDS } from "@/components/latent/story/acts-a";
import { CHAPTERS } from "@/lib/latent/story";
import { attend, babble, END, kidWords, learn, nearest, nextChoices, practiceStep, preferStep, route, sharesAt, softmax, spin, surprise } from "@/lib/latent/story-models";
import { IDEAS, KNOBS, TIMELINE } from "@/lib/latent/story-timeline";
import type { Architecture, GenerationSteps, TokenizerExamples } from "@/lib/latent/types";
import type { RecallVersions } from "@/components/latent/versions";

const DATA = path.join(__dirname, "..", "public", "data", "latent", "qwen3-8b");
const read = <T,>(f: string): T => JSON.parse(readFileSync(path.join(DATA, f), "utf-8"));
const gen = read<GenerationSteps>("generation_steps.json");
const tok = read<TokenizerExamples>("tokenizer_examples.json");
const arch = read<Architecture>("architecture.json");
const versions = read<RecallVersions>("recall_versions.json");
const data: StoryData = { gen, tok, firstCoords: tok.embedding.tokens[0].first_coords, floors: arch.verified.num_hidden_layers, width: arch.verified.hidden_size, versions };
const text = (el: React.ReactElement) => renderToString(el).replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/\s+/g, " ");

describe("storybook toy models", () => {
  it("the counting machine counts pairs and only says what it has read", () => {
    let c = learn({}, "the cat sat");
    c = learn(c, "the dog sat");
    expect(nextChoices(c, "the")).toEqual([{ word: "cat", n: 1, p: 0.5 }, { word: "dog", n: 1, p: 0.5 }]);
    expect(nextChoices(c, "sat")).toEqual([{ word: END, n: 2, p: 1 }]);
    expect(babble(c, 3)).toEqual(babble(c, 3));
    for (let s = 0; s < 40; s++) {
      const w = [END, ...babble(c, s)];
      for (let i = 0; i + 1 < w.length; i++) expect(c[w[i]]?.[w[i + 1]], `${w[i]} -> ${w[i + 1]}`).toBeGreaterThan(0);
    }
    expect(babble({}, 1)).toEqual([]);
    expect(kidWords("The Cat, sat!")).toEqual(["the", "cat", "sat", END]);
  });

  it("practice with small steps approaches the best possible surprise; huge steps wobble", () => {
    const ex = [0, 1, 0, 0, 1];
    const run = (lr: number, n: number) => { let s = [0, 0, 1.5, 1]; const h: number[] = []; for (let i = 0; i < n; i++) { s = practiceStep(s, ex[i % 5], lr); h.push(surprise(s, ex)); } return { s, h }; };
    const tiny = run(0.3, 600), good = run(1, 400);
    expect(tiny.h[tiny.h.length - 1]).toBeLessThan(BEST_SURPRISE + 0.02);       // settles very close
    expect(Math.max(...good.h.slice(-20))).toBeLessThan(BEST_SURPRISE + 0.15);  // hovers nearby, one example at a time
    for (const h of [...tiny.h, ...good.h]) expect(h).toBeGreaterThanOrEqual(BEST_SURPRISE - 1e-9);
    const p = softmax(good.s);
    expect(p[0] + p[1]).toBeGreaterThan(0.97);
    const huge = run(12, 60);
    expect(Math.min(...huge.h.slice(-10))).toBeGreaterThan(BEST_SURPRISE + 0.3);
    expect(BEST_SURPRISE).toBeCloseTo(0.673, 3);
  });

  it("the word wheel reproduces Qwen's recorded shares exactly at T = 1", () => {
    const { slices, rest } = sharesAt(gen.step1.top, gen.step1.logsumexp_by_temperature["1.0"], 1);
    slices.forEach((s, i) => expect(Math.abs(s.p - gen.step1.top[i].p)).toBeLessThan(2e-5));   // stored p has 6 decimals
    expect(rest).toBeCloseTo(1 - gen.step1.top_mass, 4);
    for (const [k, lse] of Object.entries(gen.step1.logsumexp_by_temperature)) {
      const sh = sharesAt(gen.step1.top, lse, Number(k));
      expect(sh.slices.reduce((a, s) => a + s.p, 0)).toBeLessThanOrEqual(1 + 1e-9);
      expect(sh.slices[0].p).toBeGreaterThanOrEqual(sh.slices[1].p);
    }
    const cold = sharesAt(gen.step1.top, gen.step1.logsumexp_by_temperature["0.25"], 0.25).slices[0].p;
    const hot = sharesAt(gen.step1.top, gen.step1.logsumexp_by_temperature["2.0"], 2).slices[0].p;
    expect(cold).toBeGreaterThan(hot);
    expect(spin([0.5, 0.3], 0)).toBe(0);
    expect(spin([0.5, 0.3], 0.6)).toBe(1);
    expect(spin([0.5, 0.3], 0.95)).toBe(2);
  });

  it("the flashlight shares sum to one and point at the right noun", () => {
    const words = [{ text: "The", key: [0, 0] as [number, number] }, { text: "dog", key: [2, 0] as [number, number] }, { text: "ball", key: [0, 2] as [number, number] }];
    const hungry = attend(words, [1.6, 0]);
    expect(hungry.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(hungry.indexOf(Math.max(...hungry))).toBe(1);
    const bouncy = attend(words, [0, 1.6]);
    expect(bouncy.indexOf(Math.max(...bouncy))).toBe(2);
  });

  it("routing picks 10 distinct helpers, never the shared one, deterministically", () => {
    const r = route("cat", 512, 10);
    expect(r).toHaveLength(10);
    expect(new Set(r).size).toBe(10);
    expect(r.every((i) => i >= 1 && i < 512)).toBe(true);
    expect(route("Cat", 512, 10)).toEqual(r);
    expect(route("dog", 512, 10)).not.toEqual(r);
  });

  it("word codes and preferences behave", () => {
    expect(nearest(CODE_WORDS, [1, 0.95, 0], 1)[0].w.word).toBe("elephant");
    expect(nearest(CODE_WORDS, [0, 0.3, 1], 1)[0].w.word).toBe("pizza");
    const w = preferStep([0, 0], [1, 1], [0, 0.5]);
    expect(w[0]).toBeGreaterThan(0);
    expect(w[1]).toBeGreaterThan(0);
    expect(preferStep([0, 0], [0, 0], [1, 1])[0]).toBeLessThan(0);
  });
});

describe("storybook content", () => {
  const all = [
    ...CHAPTERS.flatMap((c) => [c.title, ...c.story, c.doIt, c.learned, c.sticker.name, ...c.grown, ...c.links.map((l) => l.label), ...(c.words ?? []).flat()]),
    ...TIMELINE.flatMap((m) => [m.name, m.kid, m.grown, m.source.label, m.when]),
  ];

  it("has fourteen chapters in order with unique slugs", () => {
    expect(CHAPTERS.map((c) => c.n)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
    expect(new Set(CHAPTERS.map((c) => c.slug)).size).toBe(14);
  });

  it("uses no em dashes, in the data or in the storybook source files", () => {
    for (const s of all) expect(s, s).not.toContain("—");
    const dir = path.join(__dirname, "..", "src", "components", "latent", "story");
    for (const f of readdirSync(dir)) expect(readFileSync(path.join(dir, f), "utf-8"), f).not.toContain("—");
  });

  it("every grown-up link points at a page that exists", () => {
    const app = path.join(__dirname, "..", "src", "app");
    const labs = ["rmsnorm", "attention", "rope", "sampling", "kv-cache", "training"];
    for (const l of CHAPTERS.flatMap((c) => c.links)) {
      const p = l.href.split("?")[0];
      if (p.startsWith("/latent/labs/")) { expect(labs).toContain(p.split("/").pop()); continue; }
      if (p.startsWith("/latent/story/")) { expect(CHAPTERS.map((c) => c.slug)).toContain(p.split("/").pop()); continue; }
      expect(existsSync(path.join(app, ...p.split("/").filter(Boolean), "page.tsx")), p).toBe(true);
    }
  });

  it("the timeline is in order, sourced, and includes the 2026 models asked about", () => {
    for (let i = 1; i < TIMELINE.length; i++) expect(TIMELINE[i].year).toBeGreaterThanOrEqual(TIMELINE[i - 1].year);
    for (const m of TIMELINE) {
      expect(m.source.url, m.name).toMatch(/^https:\/\//);
      expect(IDEAS.map((x) => x.id)).toContain(m.idea);
    }
    const names = TIMELINE.map((m) => m.name);
    for (const n of ["GPT-6 Astra", "Project Astra", "Muse Spark", "Muse (Microsoft)", "Qwen3", "Qwen3.8", "DeepSeek-V4", "Claude Opus 5.5"]) expect(names).toContain(n);
    expect(KNOBS.find((k) => k.name === "Qwen3-8B")!.billions * 1e9).toBeCloseTo(arch.parameters.total, -1);
  });

  it("numbers quoted in the chapter text match the recorded artifacts", () => {
    const careful = CHAPTERS.find((c) => c.slug === "careful")!;
    expect(careful.grown.join(" ")).toContain(`${(versions.recall_strict * 100).toFixed(1)}%`);
    expect(careful.grown.join(" ")).toContain(`${(versions.recall_if_other_versions_accepted * 100).toFixed(1)}%`);
    expect(careful.grown.join(" ")).toContain(`Of its ${versions.misses} misses, ${versions.miss_categories["another version"]}`);
    expect(careful.story.join(" ")).toContain(`about ${Math.round(versions.recall_strict * 100)} times out of 100`);
    const practice = CHAPTERS.find((c) => c.slug === "practice")!;
    expect(practice.grown.join(" ")).toContain(arch.parameters.total.toLocaleString("en-US"));
    expect(CHAPTERS.find((c) => c.slug === "guess")!.grown.join(" ")).toContain(arch.verified.vocab_size.toLocaleString("en-US"));
    expect(CHAPTERS.find((c) => c.slug === "tower")!.story.join(" ")).toContain(`${arch.verified.num_hidden_layers} floors`);
  });
});

describe("storybook pages", () => {
  it("every chapter renders with honest labels and never claims a live model", () => {
    for (const c of CHAPTERS) {
      const h = text(<ChapterView slug={c.slug} data={data} />);
      expect(h, c.slug).toContain(c.title);
      expect(h, c.slug).toContain("Grown-up corner");
      expect(h, c.slug).not.toContain("Live model computation");
      if (c.slug === "timeline") expect(h).not.toContain("Recorded Qwen measurement");
      if (["pieces", "dice", "careful"].includes(c.slug)) expect(h, c.slug).toContain("Recorded Qwen measurement");
      if (["counting", "practice", "thinking", "agents"].includes(c.slug)) expect(h, c.slug).toContain("Toy calculation");
      expect(h, c.slug).toContain("Ready for the real mechanism?");
    }
  });

  it("the cover says it has not been tested with children", () => {
    const h = text(<StoryCover />);
    expect(h).toContain("The LLM Storybook");
    expect(h).toContain("has not been tried with a group of children yet");
    expect(h).not.toMatch(/first grader(s)? (can|understood)/i);
  });
});
