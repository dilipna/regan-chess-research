"use client";

import { useEffect, useRef } from "react";
import type { GameMove, TimelineRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MoveList({
  moves,
  rowsByPly,
  current,
  onSelect,
}: {
  moves: GameMove[];
  rowsByPly: Map<number, TimelineRow>;
  current: number;
  onSelect: (idx: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>(`[data-idx="${current}"]`);
    const c = box.current;
    if (!el || !c) return;
    const top = el.offsetTop; // box is position:relative, so this is relative to the scroller
    if (top < c.scrollTop + 8 || top > c.scrollTop + c.clientHeight - 32) {
      c.scrollTo({ top: Math.max(0, top - c.clientHeight / 2), behavior: "smooth" });
    }
  }, [current]);

  const startsBlack = moves.length > 0 && moves[0].fen_before.split(" ")[1] === "b";
  const pairs: { no: number; w?: number; b?: number }[] = [];
  moves.forEach((m, i) => {
    const isWhite = (i % 2 === 0) !== startsBlack;
    const no = Number(m.fen_before.split(" ")[5] ?? 0);
    if (isWhite || pairs.length === 0) pairs.push({ no, [isWhite ? "w" : "b"]: i });
    else pairs[pairs.length - 1].b = i;
  });

  const cellFor = (i: number | undefined) => {
    if (i === undefined) return <span />;
    const m = moves[i];
    const row = rowsByPly.get(m.ply);
    const active = i === current;
    return (
      <button
        type="button"
        data-idx={i}
        onClick={() => onSelect(i)}
        title={
          row?.substituted
            ? `Original game move ${row.san}; counterfactual substitution ${row.display_san ?? row.move} was analyzed in this position`
            : row?.flag_triple
              ? "Highlighted: engine-best, hard position, low Maia-3 predicted probability"
              : undefined
        }
        className={cn(
          "num flex items-center gap-1 rounded-[3px] px-1.5 py-0.5 text-left text-[12.5px] transition-colors duration-150",
          active ? "bg-ink text-paper" : row ? "text-ink hover:bg-paper-3" : "text-ink-3 hover:bg-paper-3",
        )}
      >
        <span>{m.san}</span>
        {row?.substituted && (
          <span className={cn("text-[9px] font-semibold", active ? "text-paper" : "text-flag")}>
            <span aria-hidden>S</span>
            <span className="sr-only"> (counterfactual substitution analyzed: {row.display_san ?? row.move})</span>
          </span>
        )}
        {row?.flag_triple && !row.substituted && (
          <>
            <span aria-hidden className={cn("h-1.5 w-1.5 rotate-45", active ? "bg-paper" : "bg-flag")} />
            <span className="sr-only"> (highlighted moment)</span>
          </>
        )}
      </button>
    );
  };

  const anySub = moves.some((m) => rowsByPly.get(m.ply)?.substituted);
  return (
    <div>
      <div className="mb-1.5 text-[11.5px] leading-snug text-ink-3">
        Original game record{anySub && <> · <span className="font-semibold text-flag">S</span> = a counterfactual substitution was analyzed at this move; the record itself is unchanged</>}
      </div>
    <div ref={box} className="relative max-h-[220px] overflow-y-auto rounded-md border border-rule bg-paper-2/60 p-1.5">
      <div className="grid grid-cols-[2.25rem_1fr_1fr] gap-y-0.5">
        {pairs.map((p) => (
          <div key={p.no + "-" + (p.w ?? p.b)} className="contents">
            <span className="num py-0.5 pr-1 text-right text-[11.5px] text-ink-4">{p.no}.</span>
            {cellFor(p.w)}
            {cellFor(p.b)}
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}
