// Every internal link in the curriculum data must resolve to a real page (with a real dynamic parameter), and
// every "Go deeper" entry must exist and be well formed.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { atlasLevels } from "@/lib/latent/atlas";
import { BUILD_STEPS } from "@/lib/latent/build";
import { FOUNDATIONS } from "@/lib/latent/foundations";
import { LABS } from "@/lib/latent/labs";
import { TOPICS } from "@/lib/latent/mastery";
import { CAREER } from "@/lib/latent/mastery/course";
import { PRACTICE, READ, deeper } from "@/lib/latent/mastery/deeper";
import { LAB_LIST } from "@/lib/latent/security/labs";
import { CHAPTERS } from "@/lib/latent/story";
import type { Architecture } from "@/lib/latent/types";

const APP = path.join(__dirname, "..", "src", "app");
const arch = JSON.parse(readFileSync(path.join(__dirname, "..", "public", "data", "latent", "qwen3-8b", "architecture.json"), "utf-8")) as Architecture;
const parts = new Set(atlasLevels(arch).flatMap((l) => l.nodes.map((n) => `${l.id}.${n.id}`)));

/** All page routes under src/app, as segment arrays ("[x]" marks a dynamic segment). */
function routes(dir = APP, base: string[] = []): string[][] {
  const out: string[][] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...routes(p, name.startsWith("(") ? base : [...base, name]));
    else if (name === "page.tsx") out.push(base);
  }
  return out;
}
const ROUTES = routes();

/** Allowed values for each dynamic route, from the same data its generateStaticParams uses. */
const PARAMS: Record<string, string[]> = {
  "latent/mastery/[topic]": TOPICS.filter((t) => t.track === "mastery").map((t) => t.slug),
  "latent/security/learn/[topic]": TOPICS.filter((t) => t.track === "security").map((t) => t.slug),
  "latent/security/labs/[lab]": LAB_LIST.map((l) => l.slug),
  "latent/labs/[lab]": LABS.map((l) => l.slug),
  "latent/foundations/[slug]": FOUNDATIONS.map((f) => f.slug),
  "latent/story/[chapter]": CHAPTERS.map((c) => c.slug),
};

function resolves(href: string): boolean {
  const [pathAndQuery] = href.split("#");
  const [p, query] = pathAndQuery.split("?");
  const segs = p.split("/").filter(Boolean);
  if (p === "/latent" && query?.startsWith("part=")) return parts.has(query.slice(5));
  return ROUTES.some((r) => {
    if (r.length !== segs.length) return false;
    return r.every((s, i) => {
      if (!s.startsWith("[")) return s === segs[i];
      const allowed = PARAMS[r.join("/")];
      return allowed ? allowed.includes(segs[i]) : true;
    });
  });
}

const internal = (h: string) => h.startsWith("/");

describe("internal links", () => {
  it("every topic link, practice link, lab link, foundation link, build link and career link resolves", () => {
    const hrefs: [string, string][] = [
      ...TOPICS.flatMap((t) => t.links.map((l) => [`topic ${t.slug}`, l.href] as [string, string])),
      ...TOPICS.filter((t) => t.story).map((t) => [`story of ${t.slug}`, `/latent/story/${t.story}`] as [string, string]),
      ...Object.entries(PRACTICE).flatMap(([s, ps]) => ps.map((p) => [`practice ${s}`, p.href] as [string, string])),
      ...FOUNDATIONS.flatMap((f) => f.inLLM.map((l) => [`foundation ${f.slug}`, l.atlas ? `/latent?part=${l.atlas}` : l.href!] as [string, string])),
      ...BUILD_STEPS.flatMap((b) => [[`build ${b.n}`, `/latent?part=${b.atlas.part}`], ...(b.foundation ? [[`build ${b.n}`, `/latent/foundations/${b.foundation}`]] : [])] as [string, string][]),
      ...CAREER.map((c) => [`career ${c.skill}`, c.where] as [string, string]),
    ];
    const bad = hrefs.filter(([, h]) => internal(h) && !resolves(h));
    expect(bad).toEqual([]);
    expect(hrefs.length).toBeGreaterThan(150);
  });
  it("the matcher rejects what it should", () => {
    for (const h of ["/latent/security/lab/rag", "/latent/security/redteam-x", "/latent/mastery/not-a-topic", "/latent?part=attention.nope"]) expect(resolves(h), h).toBe(false);
    for (const h of ["/latent/security/redteam", "/latent/security/labs/rag", "/latent?part=attention.rope#atlas"]) expect(resolves(h), h).toBe(true);
  });
});

describe("go deeper", () => {
  it("every topic has something to read and something to practise", () => {
    for (const t of TOPICS) {
      const d = deeper(t);
      expect(d.read.length, `${t.slug} read`).toBeGreaterThan(0);
      expect(d.practice.length, `${t.slug} practice`).toBeGreaterThan(0);
    }
  });
  it("maps only name real topics, and every reading is an https link with an arXiv id where it claims one", () => {
    const slugs = new Set(TOPICS.map((t) => t.slug));
    for (const s of [...Object.keys(READ), ...Object.keys(PRACTICE)]) expect(slugs.has(s), s).toBe(true);
    for (const t of TOPICS) for (const r of deeper(t).read) {
      expect(r.url, r.label).toMatch(/^https:\/\//);
      const id = r.label.match(/arXiv (\d{4}\.\d{4,5})/)?.[1];
      if (id) expect(r.url, r.label).toBe(`https://arxiv.org/abs/${id}`);
    }
    for (const ps of Object.values(PRACTICE)) for (const p of ps) expect(p.href, p.label).toMatch(/^(\/|https:\/\/)/);
  });
});

describe("course order", () => {
  it("levels never go backwards, so every topic sits inside its level's block", () => {
    for (let i = 1; i < TOPICS.length; i++) expect(TOPICS[i].level, `${TOPICS[i - 1].slug} -> ${TOPICS[i].slug}`).toBeGreaterThanOrEqual(TOPICS[i - 1].level);
  });
});

describe("go deeper has no duplicate destinations", () => {
  it("each practice link and each reading appears once per topic", () => {
    for (const t of TOPICS) {
      const d = deeper(t);
      const hrefs = d.practice.map((p) => p.href.split("#")[0]);
      expect(new Set(hrefs).size, t.slug).toBe(hrefs.length);
      expect(new Set(d.read.map((r) => r.url)).size, t.slug).toBe(d.read.length);
    }
  });
});
