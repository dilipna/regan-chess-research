"use client";

import { Board } from "@/components/report/board";
import { moveLabel } from "@/lib/format";
import type { TimelineRow } from "@/lib/types";

export interface StoryArrow {
  uci: string;
  color: string;
  label: string;
  san: string;
}

/** The one dominant chessboard of a section, with a caption and an explicit legend for every arrow drawn. */
export function StoryBoard({
  id,
  row,
  fen,
  arrows,
  caption,
  highlight,
  onMove,
}: {
  id: string;
  row: TimelineRow;
  fen?: string;
  arrows: StoryArrow[];
  caption?: React.ReactNode;
  highlight?: string[];
  onMove?: (uci: string) => void;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[13px] font-medium text-ink">
          Move {row.move_no}, {row.color === "white" ? "White" : "Black"} to move
        </div>
        <div className="num text-[12px] text-ink-3">{row.n_legal ?? "—"} legal moves</div>
      </div>
      <Board
        id={id}
        fen={fen ?? row.fen}
        orientation={row.color}
        arrows={arrows.map((a) => ({ uci: a.uci, color: a.color }))}
        highlight={highlight}
        onMove={onMove}
      />
      {arrows.length > 0 && (
        <ul className="mt-3 space-y-1 text-[12.5px]" aria-label="Arrows on the board">
          {arrows.map((a) => (
            <li key={a.uci + a.label} className="flex items-center gap-2">
              <ArrowGlyph color={a.color} />
              <span className="text-ink-3">{a.label}</span>
              <span className="num font-medium text-ink">{moveLabel(row.move_no, row.color, a.san)}</span>
            </li>
          ))}
        </ul>
      )}
      {caption && <div className="mt-3 text-[12px] leading-relaxed text-ink-3">{caption}</div>}
    </div>
  );
}

export function ArrowGlyph({ color }: { color: string }) {
  return (
    <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden className="shrink-0">
      <line x1="1" y1="5" x2="15" y2="5" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M14 1 L21 5 L14 9 Z" fill={color} />
    </svg>
  );
}
