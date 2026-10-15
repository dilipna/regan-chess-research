// Single source of truth for every statement the site makes about Professor Kenneth W. Regan's work,
// and for the external sources the site cites. Every source below was downloaded and read; page
// references are to the PDF page (slide) on which the statement appears.
// Nothing here claims that Regan uses Maia-3, XGBoost, SHAP, sequence features, regression or this UI.

export interface Source {
  key: string;
  short: string;     // compact in-text label
  text: string;      // full reference
  href: string;
}

export const SOURCES: Record<"talk" | "guide" | "seminar" | "aif" | "chessformer" | "maiaRepo" | "maiaCard", Source> = {
  talk: {
    key: "talk",
    short: "Regan, Apr 2026 talk",
    text: "K. W. Regan, “Chess Research and Public Interests”, New Faculty Academy, University at Buffalo, 8 April 2026 (slides; page numbers refer to the no-pause PDF).",
    href: "https://cse.buffalo.edu/~regan/Talks/ChessResearchApr2026np.pdf",
  },
  guide: {
    key: "guide",
    short: "IR user guide",
    text: "K. W. Regan, “User Guide for IR Chess Statistical Analyzer” (public PDF, CSE 702 seminar materials; file dated 13 Feb 2024).",
    href: "https://cse.buffalo.edu/~regan/ChessSeminar/UserGuideIRlite.pdf",
  },
  seminar: {
    key: "seminar",
    short: "CSE 702 Week 6A",
    text: "K. W. Regan, “CSE702 Week 6A: Cross-Validation and Things Out of Whack, and Some Experiments” (public seminar notes; file dated 7 Mar 2024).",
    href: "https://cse.buffalo.edu/~regan/ChessSeminar/CSE702Week6A.pdf",
  },
  aif: {
    key: "aif",
    short: "AIF v0.5 (2015)",
    text: "K. W. Regan & T. Biswas, AIF v0.5, described in “A Computer Chess Analysis Interchange Format”, Gödel’s Lost Letter and P=NP, 20 Jan 2015.",
    href: "https://rjlipton.com/2015/01/20/a-computer-chess-analysis-interchange-format/",
  },
  chessformer: {
    key: "chessformer",
    short: "Chessformer (ICLR 2026)",
    text: "D. Monroe, G. Eilender, P. Chalmers, Z. Tang & A. Anderson, “Chessformer: A Unified Architecture for Chess Modeling”, ICLR 2026; arXiv:2605.19091.",
    href: "https://arxiv.org/abs/2605.19091",
  },
  maiaRepo: {
    key: "maiaRepo",
    short: "CSSLab/maia3",
    text: "CSSLab, maia3 — official inference code and documentation (GitHub). Pinned commit 1e13597 is used here.",
    href: "https://github.com/CSSLab/maia3",
  },
  maiaCard: {
    key: "maiaCard",
    short: "Maia3-5M model card",
    text: "UofTCSSLab/Maia3-5M model card (Hugging Face): encoder-only transformer; trained on Lichess human games, January 2023 – July 2025.",
    href: "https://huggingface.co/UofTCSSLab/Maia3-5M",
  },
};

/** In-text citation with page reference, e.g. cite("talk", "p. 12"). */
export interface Cite {
  src: keyof typeof SOURCES;
  loc?: string;
}

export const REGAN_SOURCE =
  "Professor Kenneth W. Regan's public materials: the 8 April 2026 talk “Chess Research and Public Interests”, the public IR analyzer user guide, and public CSE 702 seminar notes (full references under Methodology › Sources).";

export const AIF_SOURCE = { text: SOURCES.aif.text, href: SOURCES.aif.href };

export interface ReganConcept {
  key: string;
  plain: string;      // beginner wording
  technical: string;  // expert wording
  cites: Cite[];
}

/** Publicly documented statistical foundation (REGAN — DOCUMENTED METHOD). Each item carries its source. */
export const REGAN_VERIFIED: ReganConcept[] = [
  { key: "ir", plain: "A statistical analyzer of “intrinsic” playing strength", technical: "IR Chess Statistical Analyzer — IR = Intrinsic Ratings; runs from a console, text mode only.", cites: [{ src: "guide", loc: "p. 1" }] },
  { key: "multipv", plain: "Uses several engine candidate lines per position", technical: "Input is Multi-PV engine analysis in AIF files; ordinary Single-PV data is deliberately refused.", cites: [{ src: "guide", loc: "p. 4" }] },
  { key: "utilities", plain: "Measures how good each move is at several search depths", technical: "A grid of move utilities across search depths, scaled to perceived values before the player model is applied.", cites: [{ src: "talk", loc: "p. 10" }, { src: "guide", loc: "pp. 12–14" }] },
  { key: "params", plain: "Turns a rating into a model of how a player chooses moves", technical: "Player parameters trained against Elo: s (sensitivity), c (consistency), h (heave/nudge) per the April 2026 talk; the user guide describes s, c and an equal-value parameter ev as the active player parameters.", cites: [{ src: "talk", loc: "p. 10" }, { src: "guide", loc: "p. 3" }] },
  { key: "probs", plain: "Gives every legal move a probability", technical: "Generates a probability pᵢ for each legal move mᵢ (loglog-linear model) and derives confidence intervals from them.", cites: [{ src: "talk", loc: "pp. 11–12" }] },
  { key: "pva", plain: "Compares what was expected with what happened", technical: "z-scores for actual-versus-projected quantities, with an after-the-fact correction because chess decisions are not independent.", cites: [{ src: "talk", loc: "p. 12" }, { src: "guide", loc: "p. 13" }] },
  { key: "outputs", plain: "Reports engine-agreement and error statistics", technical: "T1-match (move listed first), EV-match (includes equal-optimal moves), ASD (average scaled difference) and an Intrinsic Performance Rating (IPR).", cites: [{ src: "talk", loc: "p. 12" }] },
  { key: "difficulty", plain: "Accounts for how difficult the positions were", technical: "Difficulty of the positions a player faced enters through the model's per-move probabilities and the fitting regression, which the user guide contrasts with simple “box-score” tallies.", cites: [{ src: "guide", loc: "p. 10" }] },
  { key: "ewn", plain: "Offers an optional extra weight for complex positions", technical: "EWN (“expectation weights normalized”) is an alternative to unit weighting (UW) that up-weights complex, difficult positions, aimed at “smart” selective cheating; the guide notes it can lower z-scores for non-selective cheating and that unit weighting is used over 99% of the time.", cites: [{ src: "guide", loc: "pp. 1, 11" }] },
  { key: "proj", plain: "Also reports how often moves hit the model's projections", technical: "Analyzer output includes projection-hit rows (ProjectionHitsW, Proj1 … Proj7+), listed alongside the main tests as uncalibrated prediction tests.", cites: [{ src: "seminar", loc: "pp. 2, 5" }] },
];

/** MoveLens augmentation (CHESSASSISTLENS — OUR AUGMENTATION). Only B, C and D were ablated. */
export const OUR_ADDITIONS: { plain: string; technical: string; ablated: boolean }[] = [
  { plain: "A learned model of human move choice", technical: "Maia-3 (5M) predicted probabilities over all legal moves, conditioned on both players' Elo and 8 positions of history.", ablated: true },
  { plain: "Engine-vs-human-model disagreement", technical: "Engine-best choices in positions where Maia's most probable move differs (non-human engine rate).", ablated: true },
  { plain: "Patterns over time, not just totals", technical: "Sequence features: streaks, rolling agreement / loss / surprisal, critical-position lift, co-occurrence of engine-best + hard + low predicted probability.", ablated: true },
  { plain: "Nonlinear fusion of the signals", technical: "XGBoost over nested feature groups (ablation A ⊂ B ⊂ C ⊂ D).", ablated: true },
  { plain: "A controlled benchmark with known interventions", technical: "Decision-level substitutions (Random / Selective / Subtle, 0–70%) in original games, split leakage-safely.", ablated: false },
  { plain: "An estimate of assistance intensity", technical: "Regression on the realized substituted fraction — the “synthetic-equivalent assistance estimate”.", ablated: false },
  { plain: "Explanations for every score", technical: "Game-level SHAP, a separate decision-level model with its own SHAP, and deterministic text that only restates computed values.", ablated: false },
  { plain: "Visual, position-by-position inspection", technical: "Interactive board, synchronized timeline and evidence navigation.", ablated: false },
];

/** Relationship to Regan's work, row by row (Methodology). */
export const RELATIONSHIP: { topic: string; verified: string; approx: string; addition: string; cites?: Cite[] }[] = [
  {
    topic: "Engine input",
    verified: "Multi-PV engine analysis stored in AIF; move utilities across search depths. Single-PV not accepted.",
    approx: "Stockfish 19, MultiPV 5, one fixed depth (12). No depth-by-depth utilities. Experimental AIF-compatible export (untested with his analyzer).",
    addition: "—",
    cites: [{ src: "guide", loc: "p. 4" }, { src: "talk", loc: "p. 10" }],
  },
  {
    topic: "Value scaling",
    verified: "Engine values are scaled to perceived values before the player model.",
    approx: "No scaling. Centipawns clipped to ±10.00; move loss capped at 3.00 pawns.",
    addition: "—",
    cites: [{ src: "talk", loc: "p. 10" }, { src: "guide", loc: "p. 14" }],
  },
  {
    topic: "Model of human move choice",
    verified: "Elo-trained parameters (s, c, h in the 2026 talk) generate a probability pᵢ for every legal move.",
    approx: "No s/c/h model. An empirical projection table (Elo band × Stockfish-measured difficulty decile, fitted on training games) gives each decision an expected top-1 / EV / top-3 / loss value.",
    addition: "Maia-3: a Chessformer-based transformer that assigns a predicted probability to every legal move, conditioned on both players' Elo.",
    cites: [{ src: "talk", loc: "pp. 10–12" }],
  },
  {
    topic: "T1-match",
    verified: "Agreement with the move the engine lists first.",
    approx: "Same definition, at depth 12 / MultiPV 5.",
    addition: "—",
    cites: [{ src: "talk", loc: "p. 12" }],
  },
  {
    topic: "EV-match",
    verified: "Agreement including moves of equal-optimal value not listed first.",
    approx: "Move value equals the best line's value at depth 12 (ties count).",
    addition: "—",
    cites: [{ src: "talk", loc: "p. 12" }],
  },
  {
    topic: "ASD",
    verified: "Average scaled difference in value from inferior moves.",
    approx: "Not implemented. We report unscaled centipawn loss (capped at 300), which is not ASD.",
    addition: "—",
    cites: [{ src: "talk", loc: "p. 12" }],
  },
  {
    topic: "IPR / projection hits",
    verified: "Intrinsic Performance Rating; projection-hit rows (Proj1 … Proj7+) in analyzer output.",
    approx: "Not implemented.",
    addition: "—",
    cites: [{ src: "talk", loc: "p. 12" }, { src: "seminar", loc: "p. 5" }],
  },
  {
    topic: "Statistical test",
    verified: "Actual-versus-projected z-scores; confidence intervals; correction for dependence between decisions.",
    approx: "z = (observed − projected) / √(κ · Σ pᵢ(1−pᵢ)), with variance inflation κ estimated on validation original games.",
    addition: "Cluster-bootstrap intervals for ML metrics, and paired cluster-bootstrap intervals for AUC differences between nested models.",
    cites: [{ src: "talk", loc: "p. 12" }],
  },
  {
    topic: "Difficult positions",
    verified: "Position difficulty enters through the model's probabilities and fitting; EWN is an optional weighting that up-weights complex positions (unit weighting is used in most analyses).",
    approx: "Top-1 z restricted to the hardest third of positions (learned difficulty). This is neither EWN nor Regan's difficulty model.",
    addition: "Sequence/criticality features (critical-accuracy lift, engine-best + hard + low-probability co-occurrence) used inside the ML models. Difficulty awareness itself is not our contribution.",
    cites: [{ src: "guide", loc: "pp. 1, 10, 11" }],
  },
  {
    topic: "Fusion, evaluation and explanation",
    verified: "—",
    approx: "—",
    addition: "XGBoost fusion, controlled decision-level substitution benchmark with leakage-safe splits, assistance-intensity regression, SHAP, interactive UI.",
  },
];

/** Side-by-side comparison (Overview, end of Section 2). Citations are the verified ones above. */
export const FOUNDATION_CHECKS: { label: string; cites: Cite[] }[] = [
  { label: "Engine MultiPV analysis", cites: [{ src: "guide", loc: "p. 4" }] },
  { label: "Elo-conditioned statistical model (s, c, h)", cites: [{ src: "talk", loc: "p. 10" }] },
  { label: "A probability for every legal move", cites: [{ src: "talk", loc: "pp. 11–12" }] },
  { label: "Projected versus observed", cites: [{ src: "talk", loc: "p. 12" }] },
  { label: "T1-match / EV-match / ASD", cites: [{ src: "talk", loc: "p. 12" }] },
  { label: "z-tests with dependence correction", cites: [{ src: "talk", loc: "p. 12" }, { src: "guide", loc: "p. 13" }] },
  { label: "Intrinsic Performance Rating (IPR)", cites: [{ src: "talk", loc: "p. 12" }] },
  { label: "Position difficulty in the model; EWN weighting", cites: [{ src: "guide", loc: "pp. 1, 10–11" }] },
];

export const ADDITION_CHECKS: string[] = [
  "Maia-3 learned human plausibility",
  "Engine-versus-human-model disagreement",
  "Sequence-aware patterns",
  "Nonlinear XGBoost fusion",
  "Controlled assistance experiments",
  "Assistance-intensity regression",
  "SHAP explanations",
  "Interactive position inspection",
];

/** EWN, worded exactly once for every page. */
export const EWN_NOTE =
  "Regan's EWN (“expectation weights normalized”) can give greater influence to complex positions. It is an optional alternative to unit weighting, which the user guide says is used over 99% of the time. Difficulty awareness is part of Regan's framework, not a MoveLens contribution.";

export const INDEPENDENT_PROTOTYPE = [
  "MoveLens was developed from publicly available research, documentation, open-source chess engines, released models and independently constructed experiments.",
  "It does not use Professor Regan's private reference files, adjudication records or proprietary calibrations.",
];
export const PROTOTYPE_PURPOSE =
  "The purpose of the prototype is to determine which modern AI signals may be worth validating against the full reference framework.";

export const INDEPENDENT_NOTE =
  "MoveLens was independently developed from publicly available research, documentation, open-source chess engines and released models. It does not use Professor Regan's private reference datasets, private analysis files, private adjudication records, or proprietary calibrations, and it has not been run against his analyzer. The objective is to investigate whether modern learned human-behavior signals can complement the publicly documented statistical framework.";

export const COMPLEMENT_NOTE =
  "MoveLens is designed to complement, not reproduce or replace, Professor Regan's statistical framework.";

/** The one contribution claim the site makes. */
export const CONTRIBUTION_NOTE =
  "The defensible contribution is added predictive signal from learned human-move features on our documented controlled benchmark. We make no claim to outperform Professor Regan's analyzer, which was not run or compared here.";
