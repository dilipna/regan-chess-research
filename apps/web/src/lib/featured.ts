// The single "featured position" used by every section of the research story and as the default of the
// Interactive Demo, so the reader never has to compare two different positions.
//
// Selection rule (fixed, not chosen on model output): in the Controlled Selective Assistance study, among the
// substituted decisions whose substitute is Stockfish's first choice, take the one Maia-3 ranks lowest.
import type { PlayerReport, PvoRow, Report, TimelineRow } from "./types";
import { isNum } from "./format";

export const FEATURED_STUDY = "selective-critical";
export const BASELINE_STUDY = "human-baseline";

export const FEATURED_RULE =
  "Chosen by a fixed rule: in the Controlled Selective Assistance study, the substituted engine-best move that Maia-3 ranks lowest. It is not chosen on any model score.";

/** Plain names for the three prepared studies (ids and all values come from demos.json). */
export const STUDY_NAMES: Record<string, { name: string; short: string }> = {
  "human-baseline": { name: "Human baseline", short: "Human" },
  "obvious-assistance": { name: "Controlled obvious assistance", short: "Obvious" },
  "selective-critical": { name: "Controlled selective assistance", short: "Selective" },
};
export const STUDY_ORDER = ["human-baseline", "obvious-assistance", "selective-critical"];

export function pickFeaturedRow(rep: Report | undefined | null): TimelineRow | null {
  const p = rep?.players[rep.focus];
  if (!p) return null;
  const cands = p.timeline.filter((r) => r.eligible && r.substituted && r.sf_rank === 1 && isNum(r.maia_rank));
  const pool = cands.length ? cands : p.timeline.filter((r) => r.eligible && r.flag_triple);
  return [...pool].sort((a, b) => (b.maia_rank ?? 0) - (a.maia_rank ?? 0))[0] ?? null;
}

export interface FeaturedPosition {
  studyId: string;
  realizedAlpha: number | null;
  level: number | null;
  /** The decision as analyzed in the selective study (the substituted engine move). */
  row: TimelineRow;
  /** The same decision in the original game (the human move), from the Human baseline study. */
  original: TimelineRow | null;
  /** Analyzed player with a light timeline (no per-move engine lines / SHAP), for semantics + timeline. */
  player: PlayerReport;
  pvo: PvoRow[];
  estimateD: number | null;
  scoreD: number | null;
}

const lighten = (r: TimelineRow): TimelineRow => ({ ...r, sf_lines: undefined, maia_top: undefined, maia_top_p: undefined, dm_shap: undefined, explanation: undefined });

/** Built on the server from the exported study reports; only what the story needs is sent to the page. */
export function buildFeatured(sel: Report | undefined, base: Report | undefined): FeaturedPosition | null {
  const row = pickFeaturedRow(sel);
  const p = sel?.players[sel.focus];
  if (!sel || !row || !p) return null;
  const original = base?.players[sel.focus]?.timeline.find((r) => r.ply === row.ply) ?? null;
  return {
    studyId: sel.id,
    realizedAlpha: sel.synthetic?.realized_alpha ?? null,
    level: sel.synthetic?.level ?? null,
    row,
    original,
    player: { ...p, timeline: p.timeline.map(lighten), shap: undefined, narrative: undefined },
    pvo: p.pvo ?? [],
    estimateD: p.alpha_estimate?.D_sf_maia_seq ?? null,
    scoreD: p.scores?.D_sf_maia_seq ?? null,
  };
}
