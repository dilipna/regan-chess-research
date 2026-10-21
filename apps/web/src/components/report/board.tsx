"use client";

import { Chess, type Square } from "chess.js";
import { Chessboard, defaultPieces } from "react-chessboard";
import type { Arrow, PieceRenderObject } from "react-chessboard";
import { useMemo, useState } from "react";

// The site's text colours are bright for a black page; on the board's light squares arrows need deeper tones.
// The mapping keeps each arrow's meaning (played = black, Stockfish = blue, Qwen = red, Maia = green).
const ON_BOARD: Record<string, string> = {
  "var(--ink)": "var(--arrow-played)",
  "var(--engine)": "var(--arrow-engine)",
  "var(--llm)": "var(--arrow-llm)",
  "var(--human)": "var(--arrow-human)",
};

const PIECE_NAMES: Record<string, string> = { P: "pawn", N: "knight", B: "bishop", R: "rook", Q: "queen", K: "king" };
// The library's draggable wrapper uses role=button, including on prepared boards.
// Supply its accessible name through the supported piece renderer API.
const NAMED_PIECES: PieceRenderObject = Object.fromEntries(
  Object.entries(defaultPieces).map(([key, Piece]) => [key, (props?: Parameters<PieceRenderObject[string]>[0]) => (
    <>
      <span className="sr-only">{key[0] === "w" ? "White" : "Black"} {PIECE_NAMES[key[1]]}{props?.square ? ` on ${props.square}` : ""}</span>
      <span aria-hidden="true" style={{ display: "block", width: "100%", height: "100%" }}><Piece {...props} /></span>
    </>
  )]),
);

export interface BoardArrow {
  uci: string;
  color: string;
}

const ARROW_OPTIONS = {
  colors: { default: "#888", shift: "#888", ctrl: "#888", alt: "#888", meta: "#888" },
  color: "#888",
  secondaryColor: "#888",
  tertiaryColor: "#888",
  arrowLengthReducerDenominator: 6,
  sameTargetArrowLengthReducerDenominator: 3,
  arrowWidthDenominator: 7,
  activeArrowWidthMultiplier: 0.9,
  opacity: 0.82,
  activeOpacity: 0.6,
  arrowStartOffset: 0,
};

/**
 * Read-only board by default. With `onMove`, the side to move can play any legal move by dragging or by clicking
 * a piece and then a target square (legal targets are marked). Pawns reaching the last rank promote to a queen.
 * `onMove` receives the move in UCI notation.
 */
export function Board({
  id,
  fen,
  orientation,
  arrows,
  highlight,
  onMove,
}: {
  id: string;
  fen: string;
  orientation: "white" | "black";
  arrows: BoardArrow[];
  highlight?: string[];
  onMove?: (uci: string) => void;
}) {
  const [picked, setPicked] = useState<{ fen: string; square: string } | null>(null);
  const from = picked && picked.fen === fen ? picked.square : null;

  const rbArrows: Arrow[] = useMemo(() => {
    const seen = new Set<string>();
    const out: Arrow[] = [];
    for (const a of arrows) {
      if (!a.uci || a.uci.length < 4) continue;
      const k = a.uci.slice(0, 4);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ startSquare: a.uci.slice(0, 2), endSquare: a.uci.slice(2, 4), color: ON_BOARD[a.color] ?? a.color });
    }
    return out;
  }, [arrows]);

  const targets = useMemo(() => {
    if (!onMove || !from) return [];
    try {
      return new Chess(fen).moves({ square: from as Square, verbose: true }).map((m) => m.to as string);
    } catch {
      return [];
    }
  }, [fen, from, onMove]);

  const squareStyles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {};
    for (const sq of highlight ?? []) s[sq] = { boxShadow: "inset 0 0 0 100vmax rgba(255, 214, 102, 0.28)" };
    if (from) s[from] = { boxShadow: "inset 0 0 0 100vmax rgba(31, 95, 168, 0.28)" };
    for (const sq of targets)
      s[sq] = { ...s[sq], backgroundImage: "radial-gradient(circle, rgba(26,26,23,0.32) 17%, transparent 19%)", cursor: "pointer" };
    return s;
  }, [highlight, from, targets]);

  /** Validate with chess.js; auto-queen. Returns true when the move was legal and reported. */
  const tryMove = (a: string, b: string): boolean => {
    if (!onMove) return false;
    try {
      const c = new Chess(fen);
      const m = c.move({ from: a, to: b, promotion: "q" });
      onMove(m.from + m.to + (m.promotion ?? ""));
      setPicked(null);
      return true;
    } catch {
      return false;
    }
  };

  const sideToMove = (fen.split(" ")[1] ?? "w") as "w" | "b";
  const own = (pieceType: string | undefined) => !!pieceType && pieceType[0] === sideToMove;

  return (
    <div className="overflow-hidden rounded-[3px] border border-rule-strong">
      <Chessboard
        options={{
          id,
          pieces: NAMED_PIECES,
          position: fen,
          boardOrientation: orientation,
          allowDragging: !!onMove,
          canDragPiece: onMove ? ({ piece }) => own(piece?.pieceType) : undefined,
          onPieceDrop: onMove ? ({ sourceSquare, targetSquare }) => (targetSquare ? tryMove(sourceSquare, targetSquare) : false) : undefined,
          onSquareClick: onMove
            ? ({ piece, square }) => {
                if (from && targets.includes(square)) {
                  tryMove(from, square);
                  return;
                }
                setPicked(own(piece?.pieceType) && square !== from ? { fen, square } : null);
              }
            : undefined,
          allowDrawingArrows: false,
          clearArrowsOnClick: false,
          arrows: rbArrows,
          arrowOptions: ARROW_OPTIONS,
          squareStyles,
          showAnimations: true,
          animationDurationInMs: 220,
          darkSquareStyle: { backgroundColor: "var(--square-dark)" },
          lightSquareStyle: { backgroundColor: "var(--square-light)" },
          darkSquareNotationStyle: { color: "var(--square-light)", fontSize: "10px", fontWeight: 500 },
          lightSquareNotationStyle: { color: "var(--square-dark)", fontSize: "10px", fontWeight: 500 },
        }}
      />
    </div>
  );
}
