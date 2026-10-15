// Number formatting. Every function returns "—" for missing / non-finite input.

export const DASH = "—";
const MINUS = "−";

export function isNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function sign(s: string): string {
  return s.startsWith("-") ? MINUS + s.slice(1) : s;
}

/** Plain decimal, typographic minus. */
export function fmtNum(x: unknown, digits = 2): string {
  if (!isNum(x)) return DASH;
  return sign(x.toFixed(digits));
}

/** Signed decimal: +3.24 / −1.01. */
export function fmtSigned(x: unknown, digits = 2): string {
  if (!isNum(x)) return DASH;
  const s = x.toFixed(digits);
  if (Number(s) === 0) return (0).toFixed(digits);
  return x > 0 ? "+" + s : sign(s);
}

/** Fraction (0..1) as percent. */
export function fmtPct(x: unknown, digits = 0): string {
  if (!isNum(x)) return DASH;
  return sign((100 * x).toFixed(digits)) + "%";
}

/** Fraction (0..1) as percentage points: 0.069 -> "6.9 pp". */
export function fmtPP(x: unknown, digits = 1): string {
  if (!isNum(x)) return DASH;
  return sign((100 * x).toFixed(digits)) + " pp";
}

/** Signed fraction as percentage points: +0.47 pp. */
export function fmtSignedPP(x: unknown, digits = 1): string {
  if (!isNum(x)) return DASH;
  return fmtSigned(100 * x, digits) + " pp";
}

export function fmtInt(x: unknown): string {
  if (!isNum(x)) return DASH;
  return Math.round(x).toLocaleString("en-US");
}

/** Centipawns as pawns from the mover's perspective: +0.29 / −1.20. */
export function fmtEval(cp: unknown): string {
  if (!isNum(cp)) return DASH;
  if (Math.abs(cp) >= 9000) return cp > 0 ? "+M" : MINUS + "M";
  return fmtSigned(cp / 100, 2);
}

export function fmtCp(x: unknown, digits = 0): string {
  if (!isNum(x)) return DASH;
  return sign(x.toFixed(digits)) + " cp";
}

/** Score in 0..1 (classifier) with 3 decimals. */
export function fmtScore(x: unknown): string {
  return fmtNum(x, 3);
}

export function fmtLevel(x: unknown): string {
  if (!isNum(x)) return DASH;
  return `${Math.round(x * 100)}%`;
}

export function fmtCI(ci: unknown, digits = 3): string {
  if (!Array.isArray(ci) || ci.length !== 2 || !isNum(ci[0]) || !isNum(ci[1])) return DASH;
  return `[${fmtNum(ci[0], digits)}, ${fmtNum(ci[1], digits)}]`;
}

/** Percentile of a score within the reference (clean validation) distribution. */
export function percentileOf(ref: number[] | undefined | null, x: unknown): number | null {
  if (!ref || !ref.length || !isNum(x)) return null;
  let below = 0;
  for (const r of ref) if (r < x) below++;
  return below / ref.length;
}

export function moveLabel(moveNo: number, color: "white" | "black", san: string): string {
  return `${moveNo}${color === "white" ? "." : "…"}\u00a0${san}`;
}

export function titleCase(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
