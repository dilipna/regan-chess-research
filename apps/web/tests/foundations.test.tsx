import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/latent/foundations", notFound: () => { throw new Error("NOT_FOUND"); } }));

import FoundationsHome from "@/app/latent/foundations/page";
import FoundationRoute, { generateStaticParams } from "@/app/latent/foundations/[slug]/page";
import Build from "@/app/latent/build/page";
import { atlasLevels } from "@/lib/latent/atlas";
import { BUILD_STEPS } from "@/lib/latent/build";
import { FOUNDATIONS, ROUTE } from "@/lib/latent/foundations";
import type { Architecture } from "@/lib/latent/types";

const text = (el: React.ReactElement) => renderToString(el).replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const arch = JSON.parse(readFileSync("public/data/latent/qwen3-8b/architecture.json", "utf8")) as Architecture;
const parts = new Set(atlasLevels(arch).flatMap((l) => l.nodes.map((n) => `${l.id}.${n.id}`)));

describe("Foundations", () => {
  it("the index shows the whole route and every module", () => {
    const h = text(<FoundationsHome />);
    for (const s of ["Everything an LLM is made of, from zero.", ...ROUTE.map((r) => r.title), ...FOUNDATIONS.map((f) => f.title)]) expect(h).toContain(s);
  });
  it("generates exactly the modules", () => {
    expect(generateStaticParams().map((p) => p.slug)).toEqual(FOUNDATIONS.map((f) => f.slug));
  });
  it("every module page renders its widget, idea, hook, links and recall questions", async () => {
    for (const f of FOUNDATIONS) {
      const h = text(await FoundationRoute({ params: Promise.resolve({ slug: f.slug }) }));
      for (const s of [f.title, "Play with it", "The idea", "Remember it as", "Where it lives in an LLM", "Don't confuse", "Check yourself", f.recall[0].q]) expect(h, `${f.slug}: ${s}`).toContain(s);
    }
  });
  it("every Atlas link points at a real part", () => {
    for (const f of FOUNDATIONS) for (const l of f.inLLM) if (l.atlas) expect(parts.has(l.atlas), `${f.slug} -> ${l.atlas}`).toBe(true);
    for (const s of BUILD_STEPS) expect(parts.has(s.atlas.part), `step ${s.n} -> ${s.atlas.part}`).toBe(true);
  });
  it("rejects unknown modules", async () => {
    await expect(FoundationRoute({ params: Promise.resolve({ slug: "nope" }) })).rejects.toThrow("NOT_FOUND");
  });
});

describe("Build it", () => {
  it("lists the eight steps and each one exists in learn/build", () => {
    const h = text(<Build />);
    for (const s of BUILD_STEPS) expect(h).toContain(s.title);
    const files = readdirSync(path.resolve(process.cwd(), "../../learn/build/solutions"));
    for (const s of BUILD_STEPS) expect(files, s.file).toContain(s.file);
  });
});
