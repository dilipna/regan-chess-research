// Findings and headlines generated strictly from metrics.json. Each rule is explicit; if the data
// does not support a statement, the statement is not produced (or its negative is).
//
// Evidence rules
//  * A numerical change is reported as such ("+0.047 AUC").
//  * Statistical evidence for a step comes ONLY from the paired source-game cluster bootstrap
//    (metrics.paired_auc_bootstrap, experiments/09_paired_bootstrap.py). If that export is missing,
//    the step is labelled "paired difference not tested".
//  * Overlap of the two models' individual 95% intervals is shown as a visual comparison only: it
//    neither proves "no gain" (overlapping) nor is it a paired test (non-overlapping).
import { fmtNum, fmtPct, fmtPP, isNum } from "./format";
import type { Metrics, ModelKey, PairedComparison, ScoreKey } from "./types";

export interface Finding {
  id: string;
  title: string;
  evidence: string;
  interpretation: string;
  limitation: string;
}

const LEVELS = [0.05, 0.1, 0.2, 0.4, 0.7];
const STRATS = ["random", "selective", "subtle"] as const;
const SNAME: Record<string, string> = { random: "Random", selective: "Selective", subtle: "Subtle" };

export const auc = (m: Metrics, k: ScoreKey) => m.experiments[k]?.classifier?.roc_auc ?? null;
export const ci = (m: Metrics, k: ScoreKey) => m.experiments[k]?.classifier?.roc_auc_ci95 ?? null;
export const mae = (m: Metrics, k: ScoreKey) => m.experiments[k]?.regressor?.mae ?? null;
export const tpr = (m: Metrics, k: ScoreKey, fpr: number) =>
  m.experiments[k]?.classifier?.tpr_at_fpr?.find((t) => Math.abs(t.target_fpr - fpr) < 1e-9) ?? null;

/** True when the two individual 95% intervals overlap (a visual comparison only, not a test). */
export function ciOverlap(m: Metrics, a: ScoreKey, b: ScoreKey): boolean | null {
  const x = ci(m, a), y = ci(m, b);
  if (!x || !y) return null;
  return x[0] <= y[1] && y[0] <= x[1];
}

export function paired(m: Metrics, from: ScoreKey, to: ScoreKey): PairedComparison | null {
  return m.paired_auc_bootstrap?.comparisons?.find((c) => c.from === from && c.to === to) ?? null;
}

/**
 * positive     — paired 95% interval of the AUC difference lies entirely above 0
 * negative     — entirely below 0
 * inconclusive — paired interval includes 0
 * untested     — no paired result in the export
 */
export type Verdict = "positive" | "negative" | "inconclusive" | "untested" | "unknown";
export function stepVerdict(m: Metrics, from: ScoreKey, to: ScoreKey): Verdict {
  const a = auc(m, from), b = auc(m, to);
  if (!isNum(a) || !isNum(b)) return "unknown";
  const p = paired(m, from, to);
  if (!p) return "untested";
  if (p.ci95[0] > 0) return "positive";
  if (p.ci95[1] < 0) return "negative";
  return "inconclusive";
}

export const VERDICT_SHORT: Record<Verdict, string> = {
  positive: "paired 95% CI excludes 0",
  negative: "paired 95% CI below 0",
  inconclusive: "paired 95% CI includes 0",
  untested: "paired difference not tested",
  unknown: "—",
};

const f3 = (x: unknown) => fmtNum(x, 3);
const sgn = (x: number, d = 3) => (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(d);

/** "+0.047 AUC (paired 95% CI +0.040 to +0.054)" or "+0.047 AUC (paired difference not tested)". */
export function deltaText(m: Metrics, from: ScoreKey, to: ScoreKey): string {
  const a = auc(m, from), b = auc(m, to);
  if (!isNum(a) || !isNum(b)) return "—";
  const p = paired(m, from, to);
  return p
    ? `${sgn(b - a)} AUC (paired 95% CI ${sgn(p.ci95[0])} to ${sgn(p.ci95[1])})`
    : `${sgn(b - a)} AUC (paired difference not tested)`;
}

export function cellAuc(m: Metrics, k: ScoreKey, strategy: string, level: number): number | null {
  const c = m.experiments[k]?.classifier?.by_cell?.find((x) => x.strategy === strategy && Math.abs(x.level - level) < 1e-9);
  return c?.roc_auc ?? null;
}

function meanDelta(m: Metrics, from: ScoreKey, to: ScoreKey, strategy: string, levels = LEVELS): number | null {
  const d = levels.map((l) => {
    const a = cellAuc(m, from, strategy, l), b = cellAuc(m, to, strategy, l);
    return isNum(a) && isNum(b) ? b - a : null;
  });
  const v = d.filter(isNum);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

function bestCell(m: Metrics, from: ScoreKey, to: ScoreKey) {
  let best: { strategy: string; level: number; a: number; b: number } | null = null;
  for (const s of STRATS)
    for (const l of LEVELS) {
      const a = cellAuc(m, from, s, l), b = cellAuc(m, to, s, l);
      if (isNum(a) && isNum(b) && (!best || b - a > best.b - best.a)) best = { strategy: s, level: l, a, b };
    }
  return best;
}

/** Headline for the human-model step (Guided demo stage 5, Overview, Compare page). */
export function humanModelHeadline(m: Metrics): string {
  const v = stepVerdict(m, "B_sf", "C_sf_maia");
  if (v === "positive") return "Learned human-move features added predictive signal on our controlled benchmark.";
  if (v === "inconclusive") return "Learned human-move features did not clearly add signal on this benchmark.";
  if (v === "negative") return "Learned human-move features reduced discrimination on this benchmark.";
  if (v === "untested") return "Learned human-move features raised ROC-AUC on this benchmark; the paired difference was not tested.";
  return "Human-move result unavailable.";
}

/** Headline for the sequence step. */
export function sequenceHeadline(m: Metrics): string {
  const per = STRATS.map((s) => ({ s, d: meanDelta(m, "C_sf_maia", "D_sf_maia_seq", s) }));
  const valid = per.filter((x) => isNum(x.d)) as { s: string; d: number }[];
  if (!valid.length) return "Sequence result unavailable.";
  const top = [...valid].sort((a, b) => b.d - a.d)[0];
  const others = valid.filter((x) => x.s !== top.s);
  const v = stepVerdict(m, "C_sf_maia", "D_sf_maia_seq");
  const small = v === "positive" ? "a small pooled gain" : v === "inconclusive" ? "no clear pooled gain" : "a small numerical change";
  if (top.s === "selective" && top.d > 0.01 && others.every((x) => x.d < top.d / 2))
    return `Sequence features gave ${small}, concentrated where substitutions targeted hard positions (Selective).`;
  if (top.d <= 0.005) return "Sequence features added little on this benchmark.";
  return `Sequence features gave ${small}, largest for ${SNAME[top.s]} substitutions.`;
}

/** Low-FPR operating point for the four systems: validation target, test recall and realized test FPR. */
export function lowFprRows(m: Metrics, target = 0.01) {
  return (["A_stat", "B_sf", "C_sf_maia", "D_sf_maia_seq"] as ModelKey[]).map((k) => {
    const t = tpr(m, k, target);
    return { key: k, target, recall: t?.tpr ?? null, testFpr: t?.test_fpr ?? null, threshold: t?.threshold ?? null };
  });
}

function lowFprFinding(m: Metrics): Finding | null {
  const rows = lowFprRows(m);
  if (rows.some((r) => !isNum(r.recall) || !isNum(r.testFpr))) return null;
  const nNeg = m.dataset?.n_player_games?.test;
  const code: Record<string, string> = { A_stat: "A", B_sf: "B", C_sf_maia: "C", D_sf_maia_seq: "D" };
  const fprs = rows.map((r) => r.testFpr as number);
  const equalFpr = Math.max(...fprs) - Math.min(...fprs) < 1e-9;
  const c = rows.find((r) => r.key === "C_sf_maia")!, d = rows.find((r) => r.key === "D_sf_maia_seq")!, a = rows[0];
  return {
    id: "low-fpr",
    title: "At a strict operating point, recall rose with human-move features — at realized false-alarm rates that differ by system.",
    evidence:
      `Threshold set on validation original games for a ${fmtPct(rows[0].target, 0)} target; on test: ` +
      rows.map((r) => `${code[r.key]} recall ${fmtPct(r.recall, 1)} at test FPR ${fmtPct(r.testFpr, 1)}`).join(" · ") + ".",
    interpretation:
      `Recall improved from ${fmtPct(a.recall, 1)} (A) to ${fmtPct(c.recall, 1)} (C).` +
      (!equalFpr && isNum(c.testFpr) && isNum(d.testFpr) && Math.abs((c.testFpr as number) - (d.testFpr as number)) > 1e-9
        ? ` C and D cannot be ranked from recall alone: D's realized test FPR (${fmtPct(d.testFpr, 1)}) differs from C's (${fmtPct(c.testFpr, 1)}).`
        : ""),
    limitation: `A single pre-set threshold per system${isNum(nNeg) ? `; realized FPR is measured on ${nNeg} original test player-games, so each false alarm moves it by ${fmtPct(1 / nNeg, 2)}` : ""}. Recall differences at this operating point were not significance-tested.`,
  };
}

/** The three principal findings shown by default (Compare page, Guided stage 5). */
export function principalFindings(m: Metrics): Finding[] {
  const all = buildFindings(m);
  return ["human-model", "sequence", "low-fpr"].map((id) => all.find((f) => f.id === id)).filter((f): f is Finding => !!f);
}

export function buildFindings(m: Metrics): Finding[] {
  const out: Finding[] = [];
  const nTest = m.dataset?.n_player_games?.test;
  const sample = isNum(nTest) ? `${nTest} original test player-games and their substituted variants` : "the held-out test split";

  // 1. Human model (B -> C)
  {
    const a = auc(m, "B_sf"), b = auc(m, "C_sf_maia"), ma = mae(m, "B_sf"), mb = mae(m, "C_sf_maia");
    const v = stepVerdict(m, "B_sf", "C_sf_maia");
    if (isNum(a) && isNum(b)) {
      out.push({
        id: "human-model",
        title: humanModelHeadline(m),
        evidence: `Adding Maia-3 features to the Stockfish model changed pooled ROC-AUC from ${f3(a)} to ${f3(b)}: ${deltaText(m, "B_sf", "C_sf_maia")}.${isNum(ma) && isNum(mb) ? ` Assistance-intensity MAE went from ${fmtPP(ma)} to ${fmtPP(mb)}.` : ""}`,
        interpretation:
          v === "positive"
            ? "Model-estimated human plausibility carries information about these controlled substitutions that the engine-only features did not capture."
            : "Any contribution of the human model is within the uncertainty of this sample.",
        limitation: "Measured on decision-level substitutions drawn from the same engine used for analysis; real assistance may differ. The paired interval covers resampling of test games, not variation from refitting the models.",
      });
    }
  }
  // 2. Sequence (C -> D)
  {
    const per = STRATS.map((s) => ({ s, d: meanDelta(m, "C_sf_maia", "D_sf_maia_seq", s) })).filter((x) => isNum(x.d)) as { s: string; d: number }[];
    const a = auc(m, "C_sf_maia"), b = auc(m, "D_sf_maia_seq");
    if (per.length && isNum(a) && isNum(b)) {
      const sel5a = cellAuc(m, "C_sf_maia", "selective", 0.05), sel5b = cellAuc(m, "D_sf_maia_seq", "selective", 0.05);
      out.push({
        id: "sequence",
        title: sequenceHeadline(m),
        evidence: `Pooled: ${f3(a)} → ${f3(b)}, ${deltaText(m, "C_sf_maia", "D_sf_maia_seq")}. Mean change per strategy across levels: ${per.map((x) => `${SNAME[x.s]} ${sgn(x.d)}`).join(", ")}.${isNum(sel5a) && isNum(sel5b) ? ` Selective 5%: ${f3(sel5a)} → ${f3(sel5b)}.` : ""}`,
        interpretation:
          "When substitutions are concentrated in difficult moments, how accuracy varies with difficulty across the game is informative beyond per-move totals. Difficulty-aware analysis is not new — Regan's model accounts for position difficulty and offers EWN weighting; this result concerns our learned sequence features.",
        limitation: "Selective substitutions target our own learned difficulty measure, which the sequence features also use — an optimistic setting. Per-strategy changes were not significance-tested.",
      });
    }
  }
  // 3. Low-FPR operating point
  {
    const f = lowFprFinding(m);
    if (f) out.push(f);
  }
  // 4. Where the human model helps most
  {
    const per = STRATS.map((s) => ({ s, d: meanDelta(m, "B_sf", "C_sf_maia", s) })).filter((x) => isNum(x.d)) as { s: string; d: number }[];
    const bc = bestCell(m, "B_sf", "C_sf_maia");
    if (per.length && bc) {
      const top = [...per].sort((x, y) => y.d - x.d)[0];
      const c = m.experiments.C_sf_maia?.classifier?.by_cell?.find((x) => x.strategy === bc.strategy && Math.abs(x.level - bc.level) < 1e-9);
      out.push({
        id: "human-where",
        title: `The human-model gain was largest for ${SNAME[top.s]} substitutions.`,
        evidence: `Mean ROC-AUC change over the five levels: ${per.map((x) => `${SNAME[x.s]} ${sgn(x.d)}`).join(", ")}. Largest single change: ${SNAME[bc.strategy]} ${fmtPct(bc.level)} (${f3(bc.a)} → ${f3(bc.b)}).`,
        interpretation:
          top.s === "subtle"
            ? "Subtle substitutes are often not the engine's first choice, so engine-match counts change little; a plausible explanation is that Maia-3 assigns these substitutes lower predicted probability than the moves players of that rating usually choose."
            : `The human-model signal is strongest where ${SNAME[top.s]} substitutions differ most from moves Maia-3 considers probable.`,
        limitation: `Each condition compares ${c?.n_neg ?? "the"} original with ${c?.n_pos ?? "the"} substituted test player-games; differences between conditions are noisy and not significance-tested.`,
      });
    }
  }
  // 5. Nonlinear engine features (A -> B)
  {
    const a = auc(m, "A_stat"), b = auc(m, "B_sf");
    const v = stepVerdict(m, "A_stat", "B_sf");
    if (isNum(a) && isNum(b)) {
      out.push({
        id: "engine-nonlinear",
        title:
          v === "positive"
            ? "Nonlinear Stockfish features gave a small gain over the statistical baseline."
            : "Nonlinear Stockfish features added little beyond the statistical baseline.",
        evidence: `Pooled ROC-AUC ${f3(a)} (statistical baseline) → ${f3(b)} (Stockfish-XGB): ${deltaText(m, "A_stat", "B_sf")}.`,
        interpretation:
          "Re-using engine statistics in a more flexible model adds far less than adding the human-move features does on this benchmark.",
        limitation: "Our baseline is a simplified, Regan-inspired approximation — not Regan's model, which may extract more from engine data.",
      });
    }
  }
  // 6. Obvious assistance
  {
    const r40 = cellAuc(m, "A_stat", "random", 0.4), r70 = cellAuc(m, "A_stat", "random", 0.7);
    if (isNum(r40) && isNum(r70) && Math.min(r40, r70) >= 0.97) {
      out.push({
        id: "obvious",
        title: "Engine-based statistics alone already separate heavy, obvious substitution.",
        evidence: `Statistical baseline ROC-AUC for Random substitution: ${f3(r40)} at 40% and ${f3(r70)} at 70%.`,
        interpretation: "The open question is low-level, selective or subtle assistance — which is where the additions are tested.",
        limitation: "Detectability of obvious substitution is inflated because substitutes come from the analysis engine itself.",
      });
    }
  }
  // 7. Elo bands
  {
    const bb = m.experiments.B_sf?.classifier?.by_band ?? [], cb = m.experiments.C_sf_maia?.classifier?.by_band ?? [];
    const ds = bb
      .map((x) => ({ band: x.band, d: isNum(x.roc_auc) ? (cb.find((y) => y.band === x.band)?.roc_auc ?? NaN) - x.roc_auc : NaN }))
      .filter((x) => isNum(x.d));
    if (ds.length >= 2) {
      const lo = [...ds].sort((a, b) => a.d - b.d)[0];
      const hi = [...ds].sort((a, b) => b.d - a.d)[0];
      const counts = m.dataset?.bands_test ?? {};
      out.push({
        id: "elo",
        title: `The human-model gain was smallest in the ${lo.band} band.`,
        evidence: `ROC-AUC change from adding Maia-3, by Elo band: ${ds.map((x) => `${x.band} ${sgn(x.d)}`).join(", ")} (largest: ${hi.band}).`,
        interpretation: ds.every((x) => x.d > 0) ? "The change is numerically positive in every band; its size varies." : "The change differs in sign across bands.",
        limitation: `Per-band test samples are small (${Object.entries(counts).map(([b, n]) => `${b}: ${n}`).join(", ")} original player-games); band differences were not tested.`,
      });
    }
  }
  // 8. Baseline calibration (bounded description; tails reported, not assumed)
  {
    const z = m.baseline_calibration?.z_t1, zh = m.baseline_calibration?.z_t1_hard;
    if (z && isNum(z.mean) && isNum(z.std)) {
      const n = z.n;
      const tail =
        zh && isNum(zh.frac_gt3) && isNum(zh.normal_frac_gt3)
          ? ` In the upper tail, z(top-1, hard positions) exceeds 3 for ${fmtPct(zh.frac_gt3, 2)} of games${isNum(zh.n) ? ` (${Math.round(zh.frac_gt3 * zh.n)} of ${zh.n})` : ""} versus ${fmtPct(zh.normal_frac_gt3, 2)} under N(0,1).`
          : "";
      out.push({
        id: "calibration",
        title: "The baseline z-scores are centred with near-unit spread on original test games; their tails are not validated.",
        evidence: `On ${n ?? "the"} original test player-games, z(top-1) has mean ${fmtNum(z.mean, 2)} and SD ${fmtNum(z.std, 2)}; ${fmtPct(z.frac_gt2, 1)} exceed z = 2 (N(0,1): ${fmtPct(z.normal_frac_gt2, 1)}).${tail}`,
        interpretation:
          "Mean near 0 and SD near 1 hold by construction of κ and do not establish normal tails. A heavier tail means a fixed z threshold would flag more original games than nominal.",
        limitation: `Tail shares rest on a handful of games out of ${n ?? "the test set"}; calibration is relative to our projection model and Lichess rapid games, not Regan's reference data.`,
      });
    }
  }
  // 9. Assistance intensity
  {
    const a = mae(m, "A_stat"), d = mae(m, "D_sf_maia_seq");
    const d0 = m.experiments.D_sf_maia_seq?.regressor?.by_level?.find((r) => r.level === 0);
    if (isNum(a) && isNum(d)) {
      out.push({
        id: "intensity",
        title: d < a ? "Assistance-intensity estimates became more accurate with the additions." : "The additions did not improve assistance-intensity estimation.",
        evidence: `Mean absolute error of the synthetic-equivalent assistance estimate: ${fmtPP(a)} (statistical baseline) → ${fmtPP(d)} (full model).${d0 ? ` On original games (0% substituted) the full model's mean estimate is ${fmtPct(d0.mean_estimate, 1)}.` : ""}`,
        interpretation: "The estimate summarizes how closely a game resembles the controlled variants — it is not a probability that a player cheated, and it is biased upward near 0% because it cannot go below zero.",
        limitation: `Evaluated on ${sample}; only meaningful for patterns resembling the three synthetic strategies. MAE differences were not significance-tested.`,
      });
    }
  }
  return out;
}

/** Exploratory pseudo-event pooling (expert detail only; not a headline finding). */
export function pseudoEventSummary(m: Metrics): Finding | null {
  const ep = m.event_power?.D_sf_maia_seq ?? [], e0 = m.event_power?.A_stat ?? [];
  const get = (rows: typeof ep, k: number) => rows.find((r) => r.strategy === "selective" && Math.abs(r.level - 0.05) < 1e-9 && r.k_games === k)?.roc_auc;
  const d1 = get(ep, 1), d9 = get(ep, 9), a1 = get(e0, 1), a9 = get(e0, 9);
  if (!isNum(d1) || !isNum(d9)) return null;
  return {
    id: "pseudo-events",
    title: "Exploratory pooling of different-player games",
    evidence: `Selective 5%: full model ROC-AUC ${f3(d1)} for one game → ${f3(d9)} for nine pooled games${isNum(a1) && isNum(a9) ? `; statistical baseline ${f3(a1)} → ${f3(a9)}` : ""}.`,
    interpretation: "Averaging scores over more games separates the two conditions better, as expected when per-game evidence is weak.",
    limitation:
      "Each pseudo-event pools k games by k DIFFERENT players of one Elo band (every player has one game here), all original or all substituted at the same strategy and level. This does not validate longitudinal detection for a single player, whose games are not independent draws and whose assistance would not be uniform. Regan notes the same caveat for “Frankenstein player” resampling.",
  };
}

export const LADDER: { key: ModelKey; plain: string; technical: string }[] = [
  { key: "A_stat", plain: "Regan-inspired statistical baseline (our approximation)", technical: "Logistic regression on rates + projected-vs-observed z-scores" },
  { key: "B_sf", plain: "+ nonlinear Stockfish features", technical: "XGBoost on baseline + engine aggregates" },
  { key: "C_sf_maia", plain: "+ Maia-3 human-move features", technical: "XGBoost + Maia-3 predicted probability / surprisal / disagreement" },
  { key: "D_sf_maia_seq", plain: "+ sequence / context features = full model", technical: "XGBoost + rolling, streak and critical-position features" },
];

/* ------------------------------------------------------------------ research story (Overview / Results) */

/** The nested ablation as told on the Overview and Results pages. Text only; every number comes from metrics.json. */
export const STORY_STEPS: { key: ModelKey; code: string; title: string; added: string; why: string }[] = [
  {
    key: "A_stat",
    code: "A",
    title: "Statistical baseline",
    added:
      "Engine-agreement rates (top-1, top-3), mean move loss and observed-versus-projected z-scores, including top-1 in hard positions, combined by logistic regression.",
    why: "A Regan-inspired reference point built from his public descriptions. It is our simplified approximation, not his analyzer. Every later system contains these features.",
  },
  {
    key: "B_sf",
    code: "B",
    title: "+ Stockfish aggregates",
    added:
      "Further engine statistics (top-5 rate, rank, loss spread and tails, near-optimal share, best-vs-second gap) and a nonlinear XGBoost model.",
    why: "Checks whether simply extracting more from the engine, with a more flexible model, already accounts for any later gain.",
  },
  {
    key: "C_sf_maia",
    code: "C",
    title: "+ Maia-3",
    added:
      "Maia-3 predicted probability, rank and surprisal of each chosen move, and how often engine-best choices differ from Maia-3's most probable move.",
    why: "The central question: does a learned estimate of what similarly rated humans play add information beyond move strength?",
  },
  {
    key: "D_sf_maia_seq",
    code: "D",
    title: "+ Sequence features",
    added:
      "Rolling agreement, loss and surprisal; streaks; accuracy in hard versus ordinary positions; co-occurrence of engine-best, hard and low-probability moves.",
    why: "Checks whether when unusual decisions occur adds information beyond whole-game totals.",
  },
];

/** "+0.047" with typographic minus. */
export const signed3 = (x: number) => (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(3);

/** Incremental steps A→B, B→C, C→D with their paired results (null where not exported). */
export function storyDeltas(m: Metrics) {
  return STORY_STEPS.slice(1).map((s, i) => {
    const from = STORY_STEPS[i].key;
    const p = paired(m, from, s.key);
    return { from, to: s.key, p, verdict: stepVerdict(m, from, s.key) };
  });
}

/** Key of the step with the largest paired AUC increase (data-driven; not assumed). */
export function largestStep(m: Metrics): ModelKey | null {
  const d = storyDeltas(m).filter((x) => x.p);
  if (!d.length) return null;
  return [...d].sort((a, b) => b.p!.delta - a.p!.delta)[0].to;
}

const NUM_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** The caveat that must accompany every paired comparison. */
export function pairedCaveat(m: Metrics): string {
  const n = m.paired_auc_bootstrap?.comparisons?.length ?? 0;
  const nTxt = NUM_WORDS[n] ?? String(n);
  return `These ${nTxt} paired comparisons use no multiplicity correction, and the bootstrap conditions on the fitted models rather than accounting for variation from refitting them.`;
}

/** The three headline findings (Overview Section 3 and Results). Titles depend on the paired verdicts. */
export function headlineFindings(m: Metrics): (Finding & { from: ModelKey; to: ModelKey })[] {
  const out: (Finding & { from: ModelKey; to: ModelKey })[] = [];
  const big = largestStep(m);
  const ev = (from: ModelKey, to: ModelKey) => {
    const p = paired(m, from, to);
    return p
      ? `${MODEL_CODE[from]} → ${MODEL_CODE[to]}: ${signed3(p.delta)} ROC-AUC, paired 95% CI ${signed3(p.ci95[0])} to ${signed3(p.ci95[1])} (AUC ${f3(auc(m, from))} → ${f3(auc(m, to))}).`
      : `${MODEL_CODE[from]} → ${MODEL_CODE[to]}: ${deltaText(m, from, to)}.`;
  };
  const v1 = stepVerdict(m, "B_sf", "C_sf_maia");
  out.push({
    id: "human-model",
    from: "B_sf",
    to: "C_sf_maia",
    title:
      v1 === "positive" && big === "C_sf_maia"
        ? "Human-model information produced the largest incremental AUC gain."
        : humanModelHeadline(m),
    evidence: ev("B_sf", "C_sf_maia"),
    interpretation:
      v1 === "positive"
        ? "Maia-3's estimate of how plausible each move is for a similarly rated human carried information about these controlled substitutions that the engine aggregates did not."
        : "Any contribution of the human model is within the uncertainty of this sample.",
    limitation:
      "Controlled decision-level substitutions drawn from the same engine used for analysis; real assistance may look different. Compared against our approximation of the statistical framework, not Regan's calibrated model.",
  });
  const v2 = stepVerdict(m, "A_stat", "B_sf");
  out.push({
    id: "engine-aggregates",
    from: "A_stat",
    to: "B_sf",
    title:
      v2 === "positive"
        ? "Stockfish aggregates added a smaller positive increment."
        : "Stockfish aggregates did not clearly add signal beyond the statistical baseline.",
    evidence: ev("A_stat", "B_sf"),
    interpretation:
      "Re-using engine statistics in a more flexible model changed discrimination far less than adding the human-move features did.",
    limitation: "Our baseline is a simplified, Regan-inspired approximation; Regan's model may extract more from the same engine data.",
  });
  const v3 = stepVerdict(m, "C_sf_maia", "D_sf_maia_seq");
  out.push({
    id: "sequence",
    from: "C_sf_maia",
    to: "D_sf_maia_seq",
    title:
      v3 === "positive"
        ? "Sequence features added another small positive increment."
        : "Sequence features did not clearly add signal on this benchmark.",
    evidence: ev("C_sf_maia", "D_sf_maia_seq"),
    interpretation:
      "When substitutions cluster in difficult moments, how accuracy varies across the game is informative beyond totals. Difficulty-aware analysis itself is not new: Regan's model accounts for difficulty and offers EWN weighting.",
    limitation:
      "Selective substitutions target our own learned difficulty measure, which the sequence features also use, so this is an optimistic setting.",
  });
  return out;
}

const MODEL_CODE: Record<string, string> = { A0_zt1: "A0", A_stat: "A", B_sf: "B", C_sf_maia: "C", D_sf_maia_seq: "D" };

/** Plain-language sentence for TPR at a target FPR (target set on validation; realized FPR stated). */
export function tprSentence(t: { target_fpr: number; tpr: number; test_fpr?: number } | null): string {
  if (!t) return "—";
  return `With the threshold set on validation original games for a ${fmtPct(t.target_fpr, 0)} false-alarm target, it flagged ${fmtPct(t.tpr, 1)} of substituted test variants; the realized false-alarm rate on original test games was ${fmtPct(t.test_fpr, 1)}.`;
}
