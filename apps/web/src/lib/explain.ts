// Deterministic plain-language reading of ONE position. Every sentence is filled from stored numbers
// (Stockfish lines, Maia-3 distribution, the reconstruction's projections, Qwen scores when they exist).
// No language model writes any of this text, and nothing is inferred beyond the stored values.
import { fmtEval, fmtPct, isNum } from "./format";
import { candidateOf, topMove, type Candidate, type ThreePosition } from "./three";

export interface Explanation {
  human: string;
  engine: string;
  maia: string;
  statistical: string;
  qwen: string;
  agree: string[];
  disagree: string[];
  meaning: string;
}

const pct = (x: number | null | undefined) => (isNum(x) ? (x < 0.001 ? "<0.1%" : fmtPct(x, 1)) : "—");

function engineSentence(p: ThreePosition, c: Candidate | undefined): string {
  const best = p.sf_lines[0];
  if (!c || c.sf_rank == null)
    return `Stockfish (depth 12, MultiPV 5) prefers ${best.san} (${fmtEval(best.cp)}); the played move ${p.original_san} is not among its top 5 lines.`;
  if (c.sf_rank === 1) return `Stockfish's first choice is the played move ${p.original_san} (${fmtEval(best.cp)}).`;
  return `Stockfish prefers ${best.san} (${fmtEval(best.cp)}); the played move ${p.original_san} is its #${c.sf_rank} line (${fmtEval(c.sf_cp)}).`;
}

export function explainPosition(p: ThreePosition, qwenOk: boolean): Explanation {
  const human = candidateOf(p, p.original_move);
  const sf1 = p.sf_lines[0];
  const sf1c = candidateOf(p, sf1.move);
  const mTop = topMove(p, "M");
  const qTop = qwenOk ? topMove(p, "Q") : null;

  const maia = `Maia-3 (rating ${p.elo}) gives ${p.original_san} ${pct(human?.maia)}, rank #${human?.maia_rank} of ${p.n_legal}; its own top move is ${mTop?.san} at ${pct(mTop?.maia)}.`;
  const statistical =
    `The Regan-inspired reconstruction projects a ${pct(p.regan.p_t1)} chance that a player of this rating plays Stockfish's first move and ${pct(p.regan.p_t3)} for a top-3 line ` +
    `(position difficulty ${isNum(p.regan.difficulty) ? p.regan.difficulty.toFixed(2) : "—"}). It assigns no probability to individual moves, so it cannot rank ${p.original_san} against other moves.`;
  const qwen = qwenOk
    ? `Qwen3-8B-Base gives ${p.original_san} ${pct(human?.qwen)}, rank #${human?.qwen_rank} of ${p.n_legal}; its own top move is ${qTop?.san} at ${pct(qTop?.qwen)}.`
    : "Qwen3-8B-Base: pending. The held-out Qwen evaluation has not been run, so no Qwen value is shown here.";

  const agree: string[] = [];
  const disagree: string[] = [];
  const playedIsSf1 = p.original_move === sf1.move;
  const playedIsMaia = mTop?.move === p.original_move;
  if (playedIsSf1 && playedIsMaia) agree.push("The human move, Stockfish's first choice and Maia-3's top move are the same move.");
  else {
    if (playedIsMaia) agree.push("The human move is Maia-3's top move: the human-move model expected this choice.");
    if (playedIsSf1) agree.push("The human move is also Stockfish's first line.");
    if (!playedIsSf1) disagree.push(`The human move differs from Stockfish's first line (${sf1.san}).`);
    if (!playedIsMaia && mTop) disagree.push(`The human move is not Maia-3's top move (${mTop.san}); Maia-3 ranks it #${human?.maia_rank}.`);
  }
  if (mTop && mTop.move !== sf1.move)
    disagree.push(`Maia-3's top move (${mTop.san}) is not Stockfish's first line (${sf1.san}); Maia-3 gives Stockfish's first line ${pct(sf1c?.maia)}.`);
  else if (mTop) agree.push("Maia-3's top move is Stockfish's first line.");
  if (qTop) {
    if (qTop.move === p.original_move) agree.push("Qwen's top move is the human move.");
    else disagree.push(`Qwen's top move (${qTop.san}) is not the human move; Qwen ranks the human move #${human?.qwen_rank}.`);
    if (mTop && qTop.move !== mTop.move) disagree.push(`Qwen's top move (${qTop.san}) differs from Maia-3's (${mTop.san}); Maia-3 ranks Qwen's choice #${qTop.maia_rank}.`);
    else if (mTop) agree.push("Qwen and Maia-3 share the same top move.");
  }

  let meaning: string;
  if (p.substitute_move) {
    const s = candidateOf(p, p.substitute_move);
    meaning =
      `The controlled substitute ${p.substitute_san} is an engine line (#${s?.sf_rank ?? "—"}) that Maia-3 gives only ${pct(s?.maia)} (rank #${s?.maia_rank} of ${p.n_legal}) for a player of this rating. ` +
      "A move that is engine-optimal but improbable for human players of that strength is the kind of contrast the Maia-derived features carry; it is a property of the controlled substitution, not evidence about a real player.";
  } else if (playedIsSf1 && playedIsMaia) {
    meaning = "When the engine's best move is also the move humans of this strength overwhelmingly play, engine agreement carries little information: matching Stockfish here is expected.";
  } else if (playedIsMaia && !playedIsSf1) {
    meaning = "The human played what players of this rating tend to play, which is not Stockfish's first line. An engine-match statistic counts this as a miss, whereas a human-move model counts it as expected behaviour.";
  } else if (!playedIsMaia && mTop) {
    meaning = "Several moves are plausible for this rating and the player chose one that the human model ranks lower. Disagreement between models here reflects a position with more than one reasonable human choice.";
  } else meaning = "";
  if (!qwenOk) meaning += (meaning ? " " : "") + "The Qwen comparison for this position will be added when real Qwen3-8B-Base scores exist.";
  return { human: `Human played ${p.original_san}.`, engine: engineSentence(p, human), maia, statistical, qwen, agree, disagree, meaning };
}
