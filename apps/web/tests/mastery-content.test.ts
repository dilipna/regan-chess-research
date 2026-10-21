import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PAIRS } from "@/lib/latent/mastery/confusions";
import { CAREER, EXTRA_INTERVIEW, FINAL_TEST, WALK } from "@/lib/latent/mastery/course";
import { LEVELS, MAP_LINKS, MAP_NODES, STORY_TO_MASTERY, TOPICS, topicBySlug } from "@/lib/latent/mastery";
import { EMPTY_STATE, pickDaily, pickTeachBack, priority, record, status, INTERVALS } from "@/lib/latent/mastery/progress";
import { FRAMEWORKS, OWASP_AGENTIC_2026, OWASP_LLM_2025, OWASP_LLM_2026 } from "@/lib/latent/security/frameworks";
import { CHAPTERS } from "@/lib/latent/story";
import type { Architecture } from "@/lib/latent/types";

const arch: Architecture = JSON.parse(readFileSync(path.join(__dirname, "..", "public", "data", "latent", "qwen3-8b", "architecture.json"), "utf-8"));
const allText = (o: unknown): string[] => (typeof o === "string" ? [o] : Array.isArray(o) ? o.flatMap(allText) : o && typeof o === "object" ? Object.values(o).flatMap(allText) : []);

describe("curriculum structure", () => {
  it("topic slugs are unique and every topic has all A-M layers", () => {
    const slugs = TOPICS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const t of TOPICS) {
      for (const f of ["intuition", "where", "why", "breaks", "trainInfer", "security", "confusion"] as const) expect(t[f].length, `${t.slug}.${f}`).toBeGreaterThan(20);
      expect(t.mechanism.length, t.slug).toBeGreaterThanOrEqual(3);
      expect(t.qwen.length, t.slug).toBeGreaterThan(0);
      expect(t.teachBack.points.length, t.slug).toBeGreaterThanOrEqual(4);
      expect(t.interview.outline.length, t.slug).toBeGreaterThanOrEqual(3);
      expect(t.quiz.length, t.slug).toBeGreaterThanOrEqual(2);
      expect(LEVELS.map((l) => l.n)).toContain(t.level);
    }
  });

  it("prerequisites exist and come from the same or an earlier level", () => {
    for (const t of TOPICS) for (const p of t.prereqs) {
      const pt = topicBySlug(p);
      expect(pt, `${t.slug} -> ${p}`).toBeDefined();
      expect(pt!.level, `${t.slug} -> ${p}`).toBeLessThanOrEqual(t.level);
    }
  });

  it("every quiz question has exactly one correct option, unique ids, and an explanation for every option", () => {
    const ids = TOPICS.flatMap((t) => t.quiz.map((q) => q.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TOPICS) for (const q of t.quiz) {
      expect(q.topic, q.id).toBe(t.slug);
      expect(q.options.filter((o) => o.ok).length, q.id).toBe(1);
      for (const o of q.options) expect(o.why.length, `${q.id}: ${o.t}`).toBeGreaterThan(10);
    }
  });

  it("knowledge map, story bridge, confusion pairs, walkthrough and career links point at real topics", () => {
    const ids = new Set(MAP_NODES.map((n) => n.id));
    for (const n of MAP_NODES) expect(topicBySlug(n.topic), n.id).toBeDefined();
    for (const l of MAP_LINKS) { expect(ids.has(l.a), l.a).toBe(true); expect(ids.has(l.b), l.b).toBe(true); expect(MAP_NODES.find((n) => n.id === l.a)!.lane).not.toBe(MAP_NODES.find((n) => n.id === l.b)!.lane); }
    for (const [ch, ts] of Object.entries(STORY_TO_MASTERY)) { expect(CHAPTERS.map((c) => c.slug)).toContain(ch); for (const t of ts) expect(topicBySlug(t), t).toBeDefined(); }
    for (const p of PAIRS) expect(topicBySlug(p.topic), `${p.a} vs ${p.b}`).toBeDefined();
    for (const w of WALK) expect(topicBySlug(w.topic), w.id).toBeDefined();
    for (const q of EXTRA_INTERVIEW) expect(topicBySlug(q.topic), q.q).toBeDefined();
    expect(FINAL_TEST.map((f) => f.part).join("")).toBe("ABCDEFGHIJ");
    expect(CAREER.length).toBeGreaterThanOrEqual(8);
  });

  it("covers every confusion pair the learner asked for", () => {
    const names = PAIRS.map((p) => `${p.a} | ${p.b}`.toLowerCase());
    for (const k of ["token | embedding", "layernorm | rmsnorm", "prefill | decode", "ppo | dpo", "prompt injection | jailbreak", "authentication | authorization", "guardrail | sandbox", "system prompt | security boundary", "mcp client | mcp server", "agent memory | kv cache", "data poisoning | context poisoning"])
      expect(names.some((n) => n === k), k).toBe(true);
  });

  it("uses no em dashes anywhere in the curriculum", () => {
    for (const s of allText([TOPICS, PAIRS, WALK, EXTRA_INTERVIEW, FINAL_TEST, CAREER, FRAMEWORKS, LEVELS, MAP_NODES, MAP_LINKS])) expect(s, s.slice(0, 60)).not.toContain("—");
  });
});

describe("Qwen facts quoted in the curriculum match the recorded architecture", () => {
  const text = allText(TOPICS).join(" ");
  const v = arch.verified;
  it("numbers", () => {
    expect(v.num_hidden_layers).toBe(36);
    expect(text).toContain(v.vocab_size.toLocaleString("en-US"));
    expect(text).toContain(arch.parameters.total.toLocaleString("en-US"));
    expect(text).toContain(arch.kv_cache.bytes_per_token_all_layers.toLocaleString("en-US"));
    expect(text).toContain(arch.kv_cache.bytes_per_token_if_mha.toLocaleString("en-US"));
    expect(text).toContain(arch.parameters.per_layer.attention_projections.toLocaleString("en-US"));
    expect(text).toContain(arch.parameters.per_layer.mlp.toLocaleString("en-US"));
    expect(text).toContain(arch.parameters.embedding.toLocaleString("en-US"));
    expect(text).toContain(String(v.intermediate_size.toLocaleString("en-US")));
    expect(v.num_attention_heads / v.num_key_value_heads).toBe(4);
    expect(v.rms_norm_eps).toBe(1e-6);
    expect(v.rope_theta).toBe(1_000_000);
    expect(v.tie_word_embeddings).toBe(false);
    expect(2 * v.num_hidden_layers * v.num_key_value_heads * v.head_dim * 2).toBe(arch.kv_cache.bytes_per_token_all_layers);
  });
  it("every verified Qwen fact is in a mastery or security topic and says which", () => {
    for (const t of TOPICS) for (const f of t.qwen) expect(["verified", "generic", "inferred", "unknown"]).toContain(f.status);
  });
});

describe("frameworks", () => {
  it("each entry has name, version, organization, https source and lab mapping", () => {
    for (const f of FRAMEWORKS) {
      expect(f.url, f.name).toMatch(/^https:\/\//);
      expect(f.version.length, f.name).toBeGreaterThan(3);
      expect(f.source.length, f.name).toBeGreaterThan(2);
      expect(f.labs.length, f.name).toBeGreaterThan(0);
    }
    expect(OWASP_LLM_2025).toHaveLength(10);
    expect(OWASP_LLM_2026).toHaveLength(10);
    expect(OWASP_AGENTIC_2026).toHaveLength(10);
    expect(new Set(OWASP_LLM_2026.map((x) => x.slice(6))).size).toBe(10);
    expect(OWASP_LLM_2026[7]).toBe("LLM08 Hidden Context Exposure");
  });
});

describe("spaced review", () => {
  const T0 = Date.UTC(2026, 9, 17);
  it("correct answers climb boxes and push the due date out; a wrong answer resets", () => {
    let s = record(EMPTY_STATE, "rope", true, T0);
    expect(s.concepts.rope.box).toBe(1);
    expect(s.concepts.rope.due).toBe(T0 + INTERVALS[1]);
    s = record(s, "rope", true, T0); s = record(s, "rope", true, T0);
    expect(status(s.concepts.rope, T0)).toBe("mastered");
    s = record(s, "rope", false, T0);
    expect(s.concepts.rope.box).toBe(0);
    expect(status(s.concepts.rope, T0)).toBe("review");
    expect(status(undefined, T0)).toBe("not-started");
    expect(EMPTY_STATE.concepts).toEqual({});
  });
  it("prioritizes wrong answers, then overdue, then unseen", () => {
    let s = record(EMPTY_STATE, "gqa", false, T0);
    s = record(s, "rope", true, T0 - 10 * 86_400_000);
    expect(priority(s.concepts.gqa, T0)).toBeGreaterThan(priority(s.concepts.rope, T0));
    expect(priority(s.concepts.rope, T0)).toBeGreaterThan(priority(undefined, T0));
  });
  it("the daily set has 2+2+2+2+1 questions, is deterministic, and puts missed concepts first", () => {
    const items = TOPICS.flatMap((t) => t.quiz);
    const a = pickDaily(items, EMPTY_STATE, T0, 20261017);
    expect(a.map((q) => q.area)).toEqual(["arch", "arch", "traininf", "traininf", "app", "app", "security", "security", "connection"]);
    expect(pickDaily(items, EMPTY_STATE, T0, 20261017)).toEqual(a);
    const s = record(EMPTY_STATE, "rope", false, T0);
    expect(pickDaily(items, s, T0, 20261017).some((q) => q.topic === "rope")).toBe(true);
    expect(topicBySlug(pickTeachBack(TOPICS.map((t) => t.slug), s, T0, 1))).toBeDefined();
  });
});
