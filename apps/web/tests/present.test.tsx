import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Present, PositionThreeViews, type PresentData } from "@/components/present/present";
import { DATA3, featuredPosition, type ThreeDemo } from "@/lib/three";

const pub = (u: string) => JSON.parse(readFileSync(path.join(__dirname, "..", "public", u), "utf-8"));
const data = {
  demo: pub(DATA3.demo) as ThreeDemo, curated: pub("/data/curated_examples.json"), paired: pub("/data/paired_bootstrap.json"),
  mp: pub(DATA3.movePrediction), hybridE: pub(DATA3.hybridE),
} as PresentData;

describe("guided 10-minute demo", () => {
  it("opens on step 1 with the research question, progress and the disclaimer; presenter notes hidden", () => {
    const html = renderToString(<Present data={data} />);
    expect(html).toContain("Can an LLM add anything beyond chess statistics?");
    expect(html.replace(/<!-- -->/g, "")).toContain("Step 1 of 6");
    expect(html).toMatch(/Maia-3 is not an LLM/);
    expect(html).toMatch(/not Professor Kenneth W\. Regan(&#x27;|')s production cheating-detection system/);
    expect(html).not.toContain("Presenter note<");
    expect(html).toMatch(/Presenter notes/);
  });
  it("step 3 shows real Maia values and labels Qwen pending without inventing values", () => {
    const p = featuredPosition(data.demo);
    const html = renderToString(<PositionThreeViews p={p} qwenOk={false} />);
    expect(html).toContain("Qwen evaluation pending");
    expect(html).toContain("The disagreement is the signal we want to study.");
    const c = p.candidates.find((x) => x.move === p.original_move)!;
    expect(html).toContain(`#${c.maia_rank} of ${p.n_legal}`);
    if (data.demo.models.Q.status !== "ok") for (const x of p.candidates) expect([x.qwen, x.qwen_rank]).toEqual([null, null]);
  });
});
