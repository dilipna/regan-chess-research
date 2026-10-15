import type { Color, GameMove, Report, TimelineRow } from "@/lib/types";
import { uciToSan } from "@/lib/chess";
import type { BoardArrow } from "./board";

export const ARROW = {
  played: "var(--ink)",
  best: "var(--engine)",
  maia: "var(--human)",
  human: "var(--flag)",
};

export interface PlyView {
  idx: number;
  nMoves: number;
  isFinal: boolean;
  fen: string;
  move?: GameMove;
  moveColor: Color;
  moveNo: number;
  row?: TimelineRow;
}

export function plyView(report: Report, rowsByPly: Map<number, TimelineRow>, idx: number): PlyView {
  const moves = report.game.moves;
  const n = moves.length;
  const i = Math.max(0, Math.min(idx, n));
  if (i >= n) {
    const lastColor: Color = n % 2 === 0 ? "white" : "black";
    return { idx: i, nMoves: n, isFinal: true, fen: report.game.final_fen, moveColor: lastColor, moveNo: Math.floor(n / 2) + 1 };
  }
  const mv = moves[i];
  const moveColor: Color = (mv.fen_before.split(" ")[1] ?? "w") === "w" ? "white" : "black";
  const moveNo = Number(mv.fen_before.split(" ")[5] ?? Math.floor(i / 2) + 1);
  return { idx: i, nMoves: n, isFinal: false, fen: mv.fen_before, move: mv, moveColor, moveNo, row: rowsByPly.get(mv.ply) };
}

export interface ArrowLegendItem {
  key: "played" | "best" | "maia" | "human";
  label: string;
  san: string;
  color: string;
  note?: string;
  drawn: boolean;
}

/** Arrows for the current decision + legend describing which arrows coincide. */
export function arrowsFor(view: PlyView): { arrows: BoardArrow[]; legend: ArrowLegendItem[]; highlight: string[] } {
  if (view.isFinal || !view.move) return { arrows: [], legend: [], highlight: [] };
  const row = view.row;
  if (!row) {
    const u = view.move.uci;
    return {
      arrows: [{ uci: u, color: ARROW.played }],
      legend: [{ key: "played", label: "Played", san: view.move.san, color: ARROW.played, drawn: true }],
      highlight: [u.slice(0, 2), u.slice(2, 4)],
    };
  }
  const fen = row.fen;
  const played = row.move;
  const best = row.sf_best ?? row.sf_lines?.[0]?.move;
  const maia = row.maia_top?.[0];
  const arrows: BoardArrow[] = [];
  const legend: ArrowLegendItem[] = [];

  arrows.push({ uci: played, color: ARROW.played });
  legend.push({
    key: "played",
    label: row.substituted ? "Counterfactual substitution" : "Played",
    san: row.display_san || uciToSan(fen, played),
    color: ARROW.played,
    drawn: true,
  });
  if (row.substituted && row.human_move && row.human_move !== played) {
    arrows.push({ uci: row.human_move, color: ARROW.human });
    legend.push({ key: "human", label: "Original game move", san: row.san, color: ARROW.human, drawn: true });
  }
  if (best) {
    const same = best === played;
    if (!same) arrows.push({ uci: best, color: ARROW.best });
    legend.push({
      key: "best",
      label: "Stockfish #1",
      san: uciToSan(fen, best),
      color: ARROW.best,
      note: same ? (row.substituted ? "same as substitution" : "same as played move") : undefined,
      drawn: !same,
    });
  }
  if (maia) {
    const same = maia === played || maia === best || (row.substituted && maia === row.human_move);
    if (!same) arrows.push({ uci: maia, color: ARROW.maia });
    legend.push({
      key: "maia",
      label: "Maia-3 most probable move",
      san: uciToSan(fen, maia),
      color: ARROW.maia,
      note:
        maia === played
          ? (row.substituted ? "same as substitution" : "same as played move")
          : maia === best
            ? "same as Stockfish #1"
            : row.substituted && maia === row.human_move
              ? "same as original game move"
              : undefined,
      drawn: !same,
    });
  }
  return { arrows, legend, highlight: [played.slice(0, 2), played.slice(2, 4)] };
}

export function sfRankText(row: Pick<TimelineRow, "sf_rank" | "sf_rank_censored">): string {
  if (row.sf_rank == null) return "—";
  return row.sf_rank_censored ? `${row.sf_rank}+` : `#${row.sf_rank}`;
}
