import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MoveLens } from "@/components/movelens/movelens";
import { conclusion, fig, hasPosition, maiaSentence, qwenSentence, readings, statSentence, type MLData, type MLPosition, type ReganChecks } from "@/lib/movelens";

const data: MLData = JSON.parse(readFileSync(path.join(__dirname, "..", "public", "data", "movelens_demo.json"), "utf-8"));
const positions = data.examples.filter(hasPosition) as MLPosition[];
const checks: ReganChecks = JSON.parse(readFileSync(path.join(__dirname, "..", "public", "data", "regan_checks.json"), "utf-8"));

describe("MoveLens demo data", () => {
  it("has at most three examples, at least two with real positions", () => {
    expect(data.examples.length).toBeLessThanOrEqual(3);
    expect(positions.length).toBeGreaterThanOrEqual(2);
  });
  it("statistical label follows the stated rule", () => {
    for (const p of positions) {
      const s = p.statistical;
      const obs = s.engine_match ? s.p_t1 : 1 - s.p_t1;
      expect(s.p_observed_outcome).toBeCloseTo(obs, 5);
      const want = obs < data.label_rule.unusual_below ? "unusual" : obs < data.label_rule.somewhat_unexpected_below ? "somewhat unexpected" : "expected";
      expect(s.label).toBe(want);
      expect(statSentence(p)).toMatch(/statistically/);
    }
  });
  it("Qwen values exist only when the Qwen model status says so", () => {
    for (const p of positions) {
      if (data.models.qwen.status === "not-evaluated") {
        expect(p.qwen).toBeNull();
        expect(qwenSentence(p)).toBeNull();
        expect(readings(p).qwen.word).toBe("not yet evaluated");
      } else {
        expect(p.qwen).not.toBeNull();
        expect(p.qwen!.top3.length).toBe(3);
      }
    }
  });
  it("Maia readings come from rank and probability", () => {
    for (const p of positions) {
      expect(maiaSentence(p).length).toBeGreaterThan(10);
      expect(p.maia.top3[0].rank).toBe(1);
      expect(conclusion(p).length).toBeGreaterThan(10);
    }
  });
  it("renders the overview with the four sections and the demo button", () => {
    const html = renderToString(<MoveLens data={data} checks={checks} />).replace(/<!-- -->/g, "").replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'");
    for (const t of ["MoveLens", "Three ways to understand a chess move.", "Start the 7-minute demo", "1. Statistical Model", "2. Qwen3-8B", "3. Maia-3 79M", "4. Same move. Three interpretations.", "Important limitations", "not Professor Regan"])
      expect(html).toContain(t);
    expect(html).toContain("Unlike Stockfish, Maia is not trying to find the strongest possible move.");
    expect(html).not.toMatch(/KNN Statistical Model/);
    for (const t of ["5", "From one move to a whole game", "Can these numbers be trusted?", "What is not shown yet"]) expect(html).toContain(t);
  });
});

describe("figurine notation and statistician's checks", () => {
  it("converts SAN to figurines without touching pawns or castling", () => {
    expect(fig("Nf3")).toBe("♘f3");
    expect(fig("Rxg5")).toBe("♖xg5");
    expect(fig("e8=Q+")).toBe("e8=♕+");
    expect(fig("O-O-O")).toBe("O-O-O");
    expect(fig("h6")).toBe("h6");
  });
  it("whole-game z values are consistent with expected/actual counts and kappa", () => {
    for (const v of checks.game.variants) {
      const z = (v.actual_t1 - v.projected_t1) / Math.sqrt(checks.game.kappa_t1 * v.var_t1);
      expect(z).toBeCloseTo(v.z_t1, 3);
      expect(v.t1.reduce((a, b) => a + b, 0)).toBe(v.actual_t1);
      expect(v.t1.length).toBe(checks.game.n_decisions);
    }
  });
  it("clean-game histogram counts add up to the number of games", () => {
    expect(checks.clean_z.hist.reduce((a, b) => a + b, 0)).toBe(checks.clean_z.n);
  });
});
