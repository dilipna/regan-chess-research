"use client";

import { Legend } from "@/components/site/atoms";
import { fmtPct, isNum, moveLabel } from "@/lib/format";
import { engineQuality, humanPlausibility } from "@/lib/semantics";
import type { PlayerReport, TimelineRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const QUALITY_H: Record<string, number> = { Excellent: 1, Good: 0.72, Inaccurate: 0.48, Mistake: 0.28, "Serious error": 0.12 };

/** Three plain tracks over the analyzed player's scored decisions, with highlighted co-occurrence columns. */
export function SimpleTimeline({
  player,
  currentPly,
  onSelectPly,
}: {
  player: PlayerReport;
  currentPly: number | null;
  onSelectPly: (ply: number) => void;
}) {
  const rows = player.timeline.filter((r) => r.eligible);
  const hard = player.hard_threshold;
  if (!rows.length) return <p className="text-[13px] text-ink-3">No scored decisions for this player.</p>;
  const highlighted = rows.filter((r) => r.flag_triple);

  const track = (title: string, sub: string, value: (r: TimelineRow) => number | null, color: (r: TimelineRow) => string) => (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-semibold text-ink">{title}</span>
        <span className="text-[11px] text-ink-4">{sub}</span>
      </div>
      <div className="flex h-12 items-end gap-[2px]">
        {rows.map((r) => {
          const v = value(r);
          const cur = r.ply === currentPly;
          return (
            <button
              key={r.ply}
              type="button"
              onClick={() => onSelectPly(r.ply)}
              aria-label={`${moveLabel(r.move_no, r.color, r.display_san || r.san)}${r.flag_triple ? " — highlighted" : ""}`}
              title={moveLabel(r.move_no, r.color, r.display_san || r.san)}
              className={cn(
                "relative flex h-full min-w-0 flex-1 items-end rounded-[2px] transition-colors duration-150",
                r.flag_triple ? "bg-flag/15" : "hover:bg-paper-3",
                cur && "outline outline-[1.5px] outline-offset-1 outline-ink",
              )}
            >
              <span className="block w-full rounded-[2px]" style={{ height: `${Math.max(6, 100 * (v ?? 0))}%`, background: color(r), opacity: v === null ? 0.25 : 1 }} />
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
      <div className="space-y-4">
        {track(
          "Engine quality",
          "taller = stronger move (Stockfish)",
          (r) => QUALITY_H[engineQuality(r).label] ?? null,
          () => "var(--engine)",
        )}
        {track(
          "Human plausibility",
          "taller = higher Maia-3 predicted probability at this rating (square-root scale)",
          (r) => (isNum(r.maia_p) ? Math.sqrt(r.maia_p) : null),
          (r) => (humanPlausibility(r.maia_p).level === "low" ? "color-mix(in oklab, var(--human) 55%, var(--paper))" : "var(--human)"),
        )}
        {track(
          "Position difficulty",
          "taller = harder to find the best move",
          (r) => (isNum(r.difficulty) ? r.difficulty : null),
          (r) => (isNum(r.difficulty) && isNum(hard) && r.difficulty >= hard ? "var(--ink-2)" : "var(--ink-4)"),
        )}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-ink-4">
        <span>move {rows[0].move_no}</span>
        <span>each column = one scored move · click to inspect</span>
        <span>move {rows[rows.length - 1].move_no}</span>
      </div>
      <Legend
        className="mt-3"
        items={[{ label: "Highlighted: engine-best + low Maia-3 probability + hard position", color: "color-mix(in oklab, var(--flag) 22%, transparent)", kind: "bar" }]}
      />
      {highlighted.length > 0 ? (
        <div className="mt-4">
          <div className="mb-2 text-[12px] font-medium text-ink">{highlighted.length} highlighted moment{highlighted.length > 1 ? "s" : ""}</div>
          <div className="flex flex-wrap gap-1.5">
            {highlighted.map((r) => (
              <button
                key={r.ply}
                type="button"
                onClick={() => onSelectPly(r.ply)}
                className={cn(
                  "num rounded border px-2 py-1 text-[12px] transition-colors duration-150",
                  r.ply === currentPly ? "border-ink bg-ink text-paper" : "border-flag/30 bg-flag-soft text-ink hover:border-flag/60",
                )}
              >
                {moveLabel(r.move_no, r.color, r.display_san || r.san)}
                {r.substituted && <span className="ml-1 text-[10.5px] opacity-75">· substitution (original {r.san})</span>}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-[12.5px] text-ink-3">
          No moment combines all three signals in this game ({fmtPct(rows.filter((r) => r.top1).length / rows.length, 0)} of scored
          moves matched Stockfish&apos;s first choice).
        </p>
      )}
    </div>
  );
}
