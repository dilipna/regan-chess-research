import { Chess } from "chess.js";

const sanCache = new Map<string, string>();

/** UCI -> SAN in the given position; falls back to the UCI string. */
export function uciToSan(fen: string, uci: string | undefined | null): string {
  if (!uci) return "";
  const key = fen + "|" + uci;
  const hit = sanCache.get(key);
  if (hit) return hit;
  let out = uci;
  try {
    const c = new Chess(fen);
    const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined });
    out = m.san;
  } catch {
    out = uci;
  }
  sanCache.set(key, out);
  return out;
}

/** Principal variation as SAN (stops at the first illegal move). */
export function pvToSan(fen: string, pv: string[] | undefined, max = 6): string[] {
  if (!pv?.length) return [];
  const out: string[] = [];
  try {
    const c = new Chess(fen);
    for (const u of pv.slice(0, max)) {
      const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u.length > 4 ? u[4] : undefined });
      out.push(m.san);
    }
  } catch {
    /* keep what we have */
  }
  return out;
}

export function uciSquares(uci: string | undefined | null): [string, string] | null {
  if (!uci || uci.length < 4) return null;
  return [uci.slice(0, 2), uci.slice(2, 4)];
}

/** FEN after playing a UCI move; null if the move is illegal in that position. */
export function fenAfter(fen: string, uci: string | undefined | null): string | null {
  if (!uci) return null;
  try {
    const c = new Chess(fen);
    c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined });
    return c.fen();
  } catch {
    return null;
  }
}
