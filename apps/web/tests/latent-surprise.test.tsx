import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GlassBox } from "@/components/latent/glassbox";
import { normWord, pickRounds } from "@/components/latent/play";
import { VersionsFinding, type RecallVersions } from "@/components/latent/versions";
import type { GbManifest } from "@/lib/latent/glassbox";
import type { Recall } from "@/lib/latent/types";

const DATA = path.join(__dirname, "..", "public", "data", "latent", "qwen3-8b");
const read = <T,>(f: string): T => JSON.parse(readFileSync(path.join(DATA, f), "utf-8"));
const versions = read<RecallVersions>("recall_versions.json");
const recall = read<Recall>("recall_probe.json");
const manifest = read<GbManifest>("glassbox/manifest.json");
const text = (el: React.ReactElement) => renderToString(el).replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/\s+/g, " ");

describe("Mistake, or another version?", () => {
  it("is consistent with the recorded recall data", () => {
    const g = recall.passages.find((p) => p.name === versions.passage)!;
    expect(versions.n_scored).toBe(g.n_scored);
    expect(versions.top1_hits).toBe(g.positions.filter((x) => x.top1).length);
    expect(Object.values(versions.miss_categories).reduce((a, b) => a + b, 0)).toBe(versions.misses);
    expect(versions.recall_if_other_versions_accepted).toBeCloseTo((versions.top1_hits + versions.miss_categories["another version"]) / versions.n_scored, 6);
    for (const d of versions.misses_detail) {
      const pos = g.positions[d.t];
      expect(pos.top1).toBe(false);
      expect(pos.true).toBe(d.true);
      expect(pos.top).toBe(d.predicted);
    }
  });
  it("every 'another version' case is backed by that manuscript's own text containing the predicted word", () => {
    const src = JSON.parse(readFileSync(path.join(__dirname, "..", "..", "..", "scripts", "latentlens", "passages", "gettysburg_versions.json"), "utf-8"));
    const cases = versions.misses_detail.filter((d) => d.category === "another version");
    expect(cases.length).toBeGreaterThan(0);
    for (const d of cases) {
      const w = d.predicted.trim().replace(/^-/, "");
      expect(d.versions_with_prediction.length).toBeGreaterThan(0);
      for (const name of d.versions_with_prediction) {
        const ev = d.evidence[name];
        expect(ev, `${name} evidence`).toBeTruthy();
        expect(src.versions[name]).toContain(ev!.trim().slice(0, 20));
        expect(ev!.toLowerCase()).toContain(w.toLowerCase());
      }
      expect(d.predicted).not.toBe(d.true);        // the Bliss copy (the scored text) has a different token here
    }
  });
  it("renders the headline with the measured counts and the caveats", () => {
    const h = text(<VersionsFinding v={versions} />);
    expect(h).toContain(`${versions.miss_categories["another version"]} of Qwen's ${versions.misses} misses`);
    expect(h).toContain("Recorded Qwen measurement");
    for (const c of versions.caveats) expect(h).toContain(c);
  });
});

describe("You vs Qwen", () => {
  it("picks deterministic rounds where the next word is a single whole token", () => {
    const p = recall.passages[0];
    const a = pickRounds(p, 10, 1), b = pickRounds(p, 10, 1);
    expect(a).toEqual(b);
    expect(a).toHaveLength(10);
    expect(pickRounds(p, 10, 2)).not.toEqual(a);
    for (const r of a) {
      expect(p.positions[r.t].true).toBe(` ${r.word}`);
      expect(/^[A-Za-z]/.test(p.positions[r.t + 1].true ?? "")).toBe(false);
    }
  });
  it("compares typed words case- and punctuation-insensitively", () => {
    expect(normWord(" Liberty,")).toBe(normWord("liberty"));
    expect(normWord("upon")).not.toBe(normWord("on"));
  });
});

describe("Glass Box page", () => {
  it("renders its framing before the tensors load and never claims a live model", () => {
    const h = text(<GlassBox manifest={manifest} />);
    expect(h).toContain("One real block of Qwen3-8B, opened and re-checked in your browser");
    expect(h).toContain("Recorded Qwen measurement");
    expect(h).not.toContain("Live model computation");
    expect(h).toContain("What this does and does not show");
  });
});
