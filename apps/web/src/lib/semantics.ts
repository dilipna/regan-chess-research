// Plain-language readings of per-move values. Thresholds are display conventions of MoveLens
// (stated in every Technical details panel); they do not change any score.
import { isNum } from "./format";
import type { PlayerReport, TimelineRow } from "./types";

export type Level3 = "high" | "medium" | "low";

export const THRESHOLDS = {
  engine: [
    { max: 10, label: "Excellent" },
    { max: 50, label: "Good" },
    { max: 100, label: "Inaccurate" },
    { max: 300, label: "Mistake" },
    { max: Infinity, label: "Serious error" },
  ],
  human: { high: 0.3, low: 0.1 }, // Maia predicted probability; 0.10 is also the low-plausibility cut used by the models
  patternDelta: 0.25,
  patternMinWindow: 4,
};

export function engineQuality(row: Pick<TimelineRow, "cpl" | "sf_rank">): { label: string; tone: "good" | "mid" | "bad" } {
  const cpl = isNum(row.cpl) ? row.cpl : null;
  if (row.sf_rank === 1 || (cpl !== null && cpl <= THRESHOLDS.engine[0].max)) return { label: "Excellent", tone: "good" };
  if (cpl === null) return { label: "—", tone: "mid" };
  const t = THRESHOLDS.engine.find((x) => cpl <= x.max)!;
  return { label: t.label, tone: cpl <= 50 ? "good" : cpl <= 100 ? "mid" : "bad" };
}

export function humanPlausibility(p: number | null | undefined): { level: Level3 | null; label: string } {
  if (!isNum(p)) return { level: null, label: "—" };
  if (p >= THRESHOLDS.human.high) return { level: "high", label: "High" };
  if (p >= THRESHOLDS.human.low) return { level: "medium", label: "Medium" };
  return { level: "low", label: "Low" };
}

export function difficultyLevel(d: number | null | undefined, player?: PlayerReport | null): { level: Level3 | null; label: string } {
  if (!isNum(d) || !player) return { level: null, label: "—" };
  if (isNum(player.hard_threshold) && d >= player.hard_threshold) return { level: "high", label: "High" };
  if (isNum(player.easy_threshold) && d <= player.easy_threshold) return { level: "low", label: "Low" };
  return { level: "medium", label: "Medium" };
}

export interface PatternReading {
  label: string;
  unusual: boolean;
  observed: number | null;
  expected: number | null;
  window: number;
}

/** Recent engine agreement vs the projection over the same trailing window (eligible decisions only). */
export function patternContext(player: PlayerReport | null | undefined, ply: number): PatternReading {
  const elig = (player?.timeline ?? []).filter((r) => r.eligible);
  const i = elig.findIndex((r) => r.ply === ply);
  if (i < 0) return { label: "—", unusual: false, observed: null, expected: null, window: 0 };
  const win = elig.slice(Math.max(0, i - 7), i + 1);
  const obs = win.filter((r) => r.top1).length / win.length;
  const ps = win.map((r) => r.p_t1).filter(isNum);
  const exp = ps.length === win.length ? ps.reduce((a, b) => a + b, 0) / ps.length : null;
  if (win.length < THRESHOLDS.patternMinWindow || exp === null)
    return { label: "Too early to tell", unusual: false, observed: obs, expected: exp, window: win.length };
  const d = obs - exp;
  if (d >= THRESHOLDS.patternDelta)
    return { label: "Unusual relative to earlier moves", unusual: true, observed: obs, expected: exp, window: win.length };
  if (d <= -THRESHOLDS.patternDelta)
    return { label: "Below expectation recently", unusual: false, observed: obs, expected: exp, window: win.length };
  return { label: "Consistent with expectation", unusual: false, observed: obs, expected: exp, window: win.length };
}

/** One generated sentence; only restates the readings above. */
export function positionSentence(row: TimelineRow, player: PlayerReport | null | undefined, elo: number | null | undefined): string {
  const eq = engineQuality(row);
  const hp = humanPlausibility(row.maia_p);
  const df = difficultyLevel(row.difficulty, player);
  const pc = patternContext(player, row.ply);
  const eng =
    eq.label === "Excellent"
      ? row.sf_rank === 1
        ? "This move is Stockfish's first choice"
        : "This move is essentially as strong as Stockfish's best"
      : eq.tone === "good"
        ? "This move is a reasonable engine choice"
        : `Stockfish rates this move ${({ Inaccurate: "as inaccurate", Mistake: "as a mistake", "Serious error": "as a serious error" } as Record<string, string>)[eq.label] ?? `as ${eq.label.toLowerCase()}`}`;
  const eloTxt = isNum(elo) ? `a ${Math.round(elo / 50) * 50}-rated player` : "a player of this rating";
  const pTxt = isNum(row.maia_p) ? ` (${(100 * row.maia_p).toFixed(1)}%)` : "";
  const hum =
    hp.level === "low"
      ? `${eq.tone === "good" ? "but" : "and"} Maia-3 assigns it a low predicted probability${pTxt} for ${eloTxt}`
      : hp.level === "high"
        ? `and Maia-3 assigns it a high predicted probability${pTxt} for ${eloTxt}`
        : hp.level === "medium"
          ? `and Maia-3 assigns it a moderate predicted probability${pTxt} for ${eloTxt}`
          : "";
  const ctx =
    df.level === "high"
      ? "in a difficult position"
      : df.level === "low"
        ? "in a straightforward position"
        : df.level === "medium"
          ? "in a position of moderate difficulty"
          : "";
  const pat = pc.unusual ? ", during a stretch where engine agreement runs well above expectation" : "";
  return [eng, hum, ctx].filter(Boolean).join(" ").replace(/ ,/g, ",") + pat + ".";
}

export function whyHighlighted(): string {
  return "Highlighted because three things happen together: the move is Stockfish's first choice, Maia-3 assigns it a predicted probability under 10% for this rating, and the position is in the hardest third of training positions. A display rule, not a verdict.";
}
