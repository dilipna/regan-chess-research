"use client";

import { Chip, Stat } from "@/components/site/atoms";
import { pvToSan, uciToSan } from "@/lib/chess";
import { DASH, fmtEval, fmtNum, fmtPct, isNum, moveLabel } from "@/lib/format";
import type { PlayerReport, TimelineRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { sfRankText, type PlyView } from "./derive";

export function difficultyBand(d: number | null | undefined, p?: PlayerReport | null): string | null {
  if (!isNum(d) || !p) return null;
  if (isNum(p.hard_threshold) && d >= p.hard_threshold) return "hard";
  if (isNum(p.easy_threshold) && d <= p.easy_threshold) return "ordinary";
  return "intermediate";
}

export function PositionIntel({
  view,
  player,
  analyzedLabel,
}: {
  view: PlyView;
  player: PlayerReport | null | undefined;
  analyzedLabel: string;
}) {
  if (view.isFinal) {
    return (
      <Shell title="Final position">
        <p className="text-[13px] text-ink-3">End of game. Use ← / → or the move list to step through the decisions.</p>
      </Shell>
    );
  }
  const row = view.row;
  const mv = view.move!;
  if (!row) {
    const own = player && player.color === view.moveColor;
    return (
      <Shell title={moveLabel(view.moveNo, view.moveColor, mv.san)}>
        <p className="text-[13px] leading-relaxed text-ink-3">
          {own
            ? "Not analyzed: the opening phase is skipped (book-like moves) and is not part of any score."
            : `Move by ${view.moveColor === "white" ? "White" : "Black"} — not the analyzed player (${analyzedLabel}). The analysis panel shows the analyzed player's decisions only.`}
        </p>
      </Shell>
    );
  }
  return <RowIntel row={row} player={player} />;
}

function Shell({ title, chips, children }: { title: string; chips?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2 border-b border-rule pb-3">
        <h3 className="font-serif text-[22px] font-semibold tracking-tight text-ink">{title}</h3>
        {chips && <div className="flex flex-wrap gap-1.5">{chips}</div>}
      </div>
      <div className="pt-4">{children}</div>
    </div>
  );
}

export function RowIntel({ row, player, compact = false }: { row: TimelineRow; player?: PlayerReport | null; compact?: boolean }) {
  const san = row.display_san || uciToSan(row.fen, row.move);
  const band = difficultyBand(row.difficulty, player);
  const chips = (
    <>
      {row.substituted && <Chip tone="flag">Counterfactual substitution</Chip>}
      {row.flag_triple && (
        <Chip tone="flag" title="Engine-best AND hard position AND low Maia-3 predicted probability">
          Triple flag
        </Chip>
      )}
      {!row.eligible && <Chip>Not eligible</Chip>}
      {row.phase && <Chip>{row.phase}</Chip>}
    </>
  );
  return (
    <Shell title={moveLabel(row.move_no, row.color, san)} chips={chips}>
      {row.substituted && (
        <div className="mb-4 rounded-md border border-flag/25 bg-flag-soft px-3 py-2 text-[12.5px] leading-relaxed text-ink-2">
          <span className="font-medium text-ink">Synthetic substitution — </span>
          the engine move <span className="num">{san}</span> replaces the human move in this position. The human played{" "}
          <span className="num font-medium text-ink">{row.san}</span>; the game continues from the original move.
        </div>
      )}
      {!row.eligible && (
        <p className="mb-4 text-[12.5px] leading-relaxed text-ink-3">
          Excluded by the eligibility rule (opening, forced or already-decided position); shown for context only and not part of
          any score.
          {row.sf_quick &&
            ` Decided position: only the quick prefilter line${isNum(row.sf_depth) ? ` (depth ${row.sf_depth})` : ""} was computed, so engine rank and loss are approximate.`}
        </p>
      )}
      <div className={cn("grid gap-x-6 gap-y-4", compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2")}>
        <Stat
          tone="engine"
          label="Stockfish rank"
          value={sfRankText(row)}
          sub={row.sf_rank_censored ? "outside the top lines" : row.top1 ? "engine's first choice" : undefined}
        />
        <Stat tone="engine" label="Centipawn loss" value={isNum(row.cpl) ? `${fmtNum(row.cpl, 0)} cp` : DASH} />
        <Stat tone="human" label="Maia human rank" value={isNum(row.maia_rank) ? `#${row.maia_rank}` : DASH} />
        <Stat tone="human" label="Maia-3 predicted probability" value={fmtPct(row.maia_p, 1)} sub="model estimate, this rating" />
        <Stat
          label="Position difficulty"
          value={fmtNum(row.difficulty, 2)}
          sub={band ? `${band} · projected top-1 ${fmtPct(row.p_t1, 0)}` : undefined}
        />
        <Stat
          tone="engine"
          label="Engine agreement"
          value={row.top1 === undefined ? DASH : row.top1 ? "Top-1 match" : "No top-1 match"}
          sub={isNum(row.roll_t1) ? `rolling top-1 ${fmtPct(row.roll_t1, 0)} (8 decisions)` : undefined}
        />
        <Stat
          tone="human"
          label="Human surprisal"
          value={isNum(row.surprisal) ? `${fmtNum(row.surprisal, 2)} nats` : DASH}
          sub={isNum(row.maia_entropy) ? `Maia entropy ${fmtNum(row.maia_entropy, 2)} nats` : undefined}
        />
        <Stat
          tone="flag"
          label="Decision-model score"
          value={fmtNum(row.dm_score, 2)}
          sub="resemblance to a synthetic substitution"
        />
      </div>

      {!compact && <EngineLines row={row} />}
      {!compact && <MaiaTop row={row} />}
    </Shell>
  );
}

export function EngineLines({ row }: { row: TimelineRow }) {
  const lines = row.sf_lines ?? [];
  if (!lines.length) return null;
  return (
    <div className="mt-6">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="eyebrow">Stockfish lines</div>
        <div className="text-[11px] text-ink-4">eval in pawns, side to move</div>
      </div>
      <table className="w-full text-[12.5px]">
        <tbody>
          {lines.slice(0, 5).map((l, i) => {
            const pv = pvToSan(row.fen, l.pv, 5);
            const isPlayed = l.move === row.move;
            const isHuman = row.substituted && l.move === row.human_move;
            return (
              <tr key={l.move + i} className={cn("border-b border-rule last:border-0", isPlayed && "bg-engine-soft")}>
                <td className="num w-7 py-1.5 pl-1 text-ink-4">{i + 1}</td>
                <td className="num w-14 py-1.5 font-medium text-ink">{uciToSan(row.fen, l.move)}</td>
                <td className="num w-14 py-1.5 text-right text-ink-2">{fmtEval(l.cp)}</td>
                <td className="num hidden truncate py-1.5 pr-1 pl-3 text-[11.5px] text-ink-4 sm:table-cell">
                  <span className="block max-w-[220px] truncate">{pv.slice(1).join(" ")}</span>
                </td>
                <td className="w-20 py-1.5 pr-1 text-right">
                  {isPlayed && <span className="text-[10.5px] text-engine">{row.substituted ? "substitution" : "played"}</span>}
                  {isHuman && <span className="text-[10.5px] text-flag">original</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function MaiaTop({ row }: { row: TimelineRow }) {
  const moves = row.maia_top ?? [];
  const ps = row.maia_top_p ?? [];
  if (!moves.length) return null;
  const max = Math.max(...ps.filter(isNum), 0.0001);
  return (
    <div className="mt-6">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="eyebrow">Maia-3 most probable moves</div>
        <div className="text-[11px] text-ink-4">predicted probability at this rating</div>
      </div>
      <ul className="space-y-1.5">
        {moves.slice(0, 5).map((m, i) => {
          const p = ps[i];
          const isPlayed = m === row.move;
          const isHuman = row.substituted && m === row.human_move;
          return (
            <li key={m} className="grid grid-cols-[3.5rem_1fr_3.5rem_3.5rem] items-center gap-2 text-[12.5px]">
              <span className="num font-medium text-ink">{uciToSan(row.fen, m)}</span>
              <span className="relative h-[7px] rounded-full bg-paper-3">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-human transition-[width] duration-200"
                  style={{ width: isNum(p) ? `${Math.max(2, (100 * p) / max)}%` : 0 }}
                />
              </span>
              <span className="num text-right text-ink-2">{fmtPct(p, 1)}</span>
              <span className="text-right text-[10.5px]">
                {isPlayed && <span className="text-engine">{row.substituted ? "substitution" : "played"}</span>}
                {isHuman && <span className="text-flag">original</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
