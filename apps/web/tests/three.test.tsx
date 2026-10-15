import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CompareThree } from "@/components/three/compare-three";
import { ResultsThree } from "@/components/three/results-three";
import { DataProvider } from "@/lib/data";
import {
  DATA3,
  checkLive,
  featuredPosition,
  positionFen,
  reganForMove,
  shownMove,
  sortedCandidates,
  threeModelFindings,
  verdict,
  type Comparison,
  type ThreeBootstrap,
  type ThreeDemo,
} from "@/lib/three";

const pub = (u: string) => JSON.parse(readFileSync(path.join(__dirname, "..", "public", u), "utf-8"));
const demo: ThreeDemo = pub(DATA3.demo);

/** A copy of the prepared study with every Qwen field removed, as before the GPU run. */
function pendingDemo(): ThreeDemo {
  const d: ThreeDemo = JSON.parse(JSON.stringify(demo));
  d.models.Q.status = "pending";
  for (const p of d.positions) {
    p.entropy.qwen = null;
    for (const c of p.candidates) Object.assign(c, { qwen: null, qwen_rank: null, qwen_logprob: null, qwen_n_tokens: null });
  }
  for (const s of d.studies) s.game_scores.Q_mean_surprisal = null;
  return d;
}

describe("prepared three-model study", () => {
  it("original/substitute toggle always evaluates the ORIGINAL position", () => {
    for (const p of demo.positions) {
      expect(positionFen(p, "substitute")).toBe(p.fen);
      expect(positionFen(p, "original")).toBe(p.fen);
      if (p.substitute_move) {
        expect(shownMove(p, "substitute")).toBe(p.substitute_move);
        expect(p.candidates.some((c) => c.move === p.substitute_move)).toBe(true);
      }
      expect(shownMove(p, "original")).toBe(p.original_move);
    }
  });

  it("Regan-inspired reconstruction never gets a fabricated per-move probability", () => {
    const p = featuredPosition(demo);
    for (const c of p.candidates) expect(reganForMove(p, c.move).probability).toBeNull();
  });

  it("sorting tolerates missing model outputs", () => {
    const p = featuredPosition(pendingDemo());
    expect(sortedCandidates(p, "qwen")).toHaveLength(p.n_legal);
    expect(sortedCandidates(p, "maia")[0].maia).toBeGreaterThan(0);
  });

  it("Qwen not yet run: no Qwen column or numbers, LLM shown only as the next step", () => {
    const html = renderToString(<CompareThree demo={pendingDemo()} />);
    expect(html).not.toContain("General-purpose LLM"); // no Qwen model column (badge subtitle)
    expect(html).not.toContain("Qwen mean surprisal");
    expect(html).not.toContain(">pending<");
    expect(html).toContain("LLM experiment (next step)");
    expect(html).not.toContain("NaN");
    expect(html).toContain("not defined"); // Regan-inspired rank/probability
    expect(html).toContain("decision-level counterfactual evaluated in the original position");
  });

  it("Qwen column appears automatically once real scores exist", () => {
    // Test fixture only: Qwen fields filled with a copy of the Maia values to exercise the rendering path.
    const d = pendingDemo();
    d.models.Q.status = "ok";
    for (const p of d.positions) for (const c of p.candidates) Object.assign(c, { qwen: c.maia, qwen_rank: c.maia_rank, qwen_logprob: -1, qwen_n_tokens: 5 });
    for (const st of d.studies) st.game_scores.Q_mean_surprisal = 1;
    const html = renderToString(<CompareThree demo={d} />);
    expect(html).toContain("Qwen mean surprisal");
    expect(html).toContain("General-purpose LLM"); // Qwen model column present
    expect(html).not.toContain("LLM experiment (next step)");
  });

  it("renders the substitute version by default on the featured position", () => {
    const html = renderToString(<CompareThree demo={demo} />);
    expect(html).toContain("Controlled engine substitute");
  });
});

describe("results and findings", () => {
  const boot: ThreeBootstrap = pub(DATA3.bootstrap);

  it("verdict only when the paired interval excludes zero, respecting metric direction", () => {
    const base: Comparison = { task: "task1", from: "A", to: "B", metric: "mean_nll", status: "ok", a: 1, b: 0.9, delta: -0.1, ci95: [-0.2, -0.05], lower_is_better: true };
    expect(verdict(base).better).toBe("B");
    expect(verdict({ ...base, ci95: [-0.2, 0.05] }).better).toBeNull();
    expect(verdict({ ...base, lower_is_better: false }).better).toBe("A");
    expect(verdict({ ...base, status: "pending" }).better).toBeNull();
  });

  it("findings are generated only from real comparisons; pending ones carry no numbers", () => {
    const f = threeModelFindings(boot);
    for (const x of f) {
      if (x.kind === "pending") expect(x.evidence).not.toMatch(/\d\.\d/);
      else expect(x.evidence).toMatch(/paired/);
    }
    expect(threeModelFindings(null)).toEqual([]);
  });

  it("results page renders with missing files and with real files", () => {
    expect(() => renderToString(<DataProvider value={{}}><ResultsThree /></DataProvider>)).not.toThrow();
    const html = renderToString(
      <DataProvider value={{ [DATA3.movePrediction]: pub(DATA3.movePrediction), [DATA3.assistance]: pub(DATA3.assistance), [DATA3.bootstrap]: boot }}>
        <ResultsThree />
      </DataProvider>,
    );
    expect(html).toContain("Who Predicts Human Moves Best?");
    expect(html).toContain("not defined");
    expect(html).not.toContain("NaN");
  });
});

describe("live backend fallback", () => {
  const ok = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
  it("no URL -> prepared", async () => expect(await checkLive("")).toBe("prepared"));
  it("network error -> prepared", async () => {
    const f = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    expect(await checkLive("https://x", f)).toBe("prepared");
  });
  it("HTTP 503 -> prepared", async () => {
    const f = (async () => new Response("cold", { status: 503 })) as unknown as typeof fetch;
    expect(await checkLive("https://x", f)).toBe("prepared");
  });
  it("models not loaded -> prepared", async () => expect(await checkLive("https://x", ok({ status: "ok", models_loaded: false }))).toBe("prepared"));
  it("timeout -> prepared", async () => {
    const f = ((_u: string, init: RequestInit) => new Promise((_r, rej) => init.signal?.addEventListener("abort", () => rej(new Error("aborted"))))) as unknown as typeof fetch;
    expect(await checkLive("https://x", f, 50)).toBe("prepared");
  });
  it("healthy -> live", async () => expect(await checkLive("https://x", ok({ status: "ok", models_loaded: true }))).toBe("live"));
});
