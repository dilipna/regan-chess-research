"use client";

import { ArrowUp, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, SkipBack, SkipForward } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chip, DownloadButton, Segmented } from "@/components/site/atoms";
import { Section } from "@/components/site/page";
import { downloadJson } from "@/lib/export";
import { STRATEGY_TEXT } from "@/lib/features";
import { fmtPct, moveLabel } from "@/lib/format";
import { difficultyLevel, engineQuality, humanPlausibility } from "@/lib/semantics";
import { uciToSan } from "@/lib/chess";
import type { Color, PlayerReport, Report, TimelineRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Board } from "./board";
import { arrowsFor, plyView } from "./derive";
import { MoveList } from "./move-list";
import { ShapBars } from "@/components/explain/shap-bars";
import { Prov } from "@/components/site/provenance";
import { TechDetails } from "@/components/site/tech";
import { useMetrics } from "@/lib/data";
import { Assessment } from "./assessment";
import { Expectation } from "./expectation";
import { Inspector } from "./inspector";
import { Narrative } from "./scores";
import { SimpleTimeline } from "./simple-timeline";
import { Timeline } from "./timeline";

function firstDecisionIdx(report: Report, color: Color): number {
  const tl = report.players[color]?.timeline ?? [];
  const first = tl.find((r) => r.substituted) ?? tl.find((r) => r.eligible) ?? tl[0];
  if (!first) return 0;
  const i = report.game.moves.findIndex((m) => m.ply === first.ply);
  return i >= 0 ? i : 0;
}

export function ReportView({
  report,
  extraDownloads,
  showPvo = true,
}: {
  report: Report;
  extraDownloads?: React.ReactNode;
  showPvo?: boolean;
}) {
  const [color, setColor] = useState<Color>(report.focus);
  const [mode, setMode] = useState<"simple" | "expert">("simple");
  const { data: metrics } = useMetrics();
  const [idx, setIdx] = useState(() => firstDecisionIdx(report, report.focus));
  const boardRef = useRef<HTMLDivElement>(null);
  const player = report.players[color] ?? null;
  const moves = report.game.moves;
  const n = moves.length;

  const rowsByPly = useMemo(() => {
    const m = new Map<number, TimelineRow>();
    for (const r of player?.timeline ?? []) m.set(r.ply, r);
    return m;
  }, [player]);
  const idxByPly = useMemo(() => new Map(moves.map((m, i) => [m.ply, i])), [moves]);
  const decisionIdx = useMemo(
    () => (player?.timeline ?? []).map((r) => idxByPly.get(r.ply)).filter((x): x is number => x !== undefined),
    [player, idxByPly],
  );

  const view = plyView(report, rowsByPly, idx);
  const { arrows, legend, highlight } = arrowsFor(view);

  const go = useCallback((i: number) => setIdx(Math.max(0, Math.min(n, i))), [n]);
  const nextDecision = useCallback(
    (dir: 1 | -1) => {
      const cand = dir > 0 ? decisionIdx.find((i) => i > idx) : [...decisionIdx].reverse().find((i) => i < idx);
      if (cand !== undefined) go(cand);
    },
    [decisionIdx, idx, go],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, select, [contenteditable=true]") || t.getAttribute("role") === "slider")) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (e.shiftKey) nextDecision(1);
        else go(idx + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (e.shiftKey) nextDecision(-1);
        else go(idx - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        go(0);
      } else if (e.key === "End") {
        e.preventDefault();
        go(n);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, idx, n, nextDecision]);

  const g = report.game;
  const syn = report.synthetic;
  const analyzedLabel = color === "white" ? g.white : g.black;
  const currentPly = view.move?.ply ?? null;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-5">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {report.kind === "live" ? <Chip>Live analysis · computed now</Chip> : <Chip>Prepared report · precomputed</Chip>}
            {syn ? (
              <Chip tone="flag">
                Counterfactual substitutions · {STRATEGY_TEXT[syn.strategy]?.name ?? syn.strategy} · nominal {fmtPct(syn.level, 0)}
              </Chip>
            ) : report.kind === "demo" ? (
              <Chip>Original game moves · no injected assistance</Chip>
            ) : null}
            {g.time_control && <Chip>{g.time_control}</Chip>}
            <Chip>Result {g.result}</Chip>
          </div>
          <div className="text-[14px] text-ink-2">
            <span className={cn(color === "white" && "font-medium text-ink")}>{g.white}</span>
            <span className="mx-2 text-ink-4">vs</span>
            <span className={cn(color === "black" && "font-medium text-ink")}>{g.black}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            size="sm"
            label="Analyzed player"
            value={color}
            onChange={setColor}
            options={[
              { value: "white", label: `White${report.focus === "white" ? " · focus" : ""}` },
              { value: "black", label: `Black${report.focus === "black" ? " · focus" : ""}` },
            ]}
          />
          <DownloadButton onClick={() => downloadJson(`${report.id || "report"}.json`, report)}>Report JSON</DownloadButton>
          {extraDownloads}
        </div>
      </div>

      {/* Board + intelligence */}
      <div
        ref={boardRef}
        tabIndex={-1}
        aria-label="Board and position inspector"
        className="mt-8 grid scroll-mt-20 gap-8 outline-none lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:gap-10"
      >
        <div className="min-w-0">
          <Board id={`board-${report.id}`} fen={view.fen} orientation={color} arrows={arrows} highlight={highlight} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <NavBtn label="Start (Home)" onClick={() => go(0)} icon={<ChevronFirst className="size-4" />} />
              <NavBtn label="Previous decision (Shift+←)" onClick={() => nextDecision(-1)} icon={<SkipBack className="size-3.5" />} />
              <NavBtn label="Previous move (←)" onClick={() => go(idx - 1)} icon={<ChevronLeft className="size-4" />} />
              <NavBtn label="Next move (→)" onClick={() => go(idx + 1)} icon={<ChevronRight className="size-4" />} />
              <NavBtn label="Next decision (Shift+→)" onClick={() => nextDecision(1)} icon={<SkipForward className="size-3.5" />} />
              <NavBtn label="End (End)" onClick={() => go(n)} icon={<ChevronLast className="size-4" />} />
            </div>
            <div className="num text-[11.5px] text-ink-3">
              ply {Math.min(idx, n)} / {n} · ←/→ move · Shift for decisions
            </div>
          </div>
          {legend.length > 0 && (
            <ul className="mt-3 grid gap-1.5 text-[12px] sm:grid-cols-2">
              {legend.map((l) => (
                <li key={l.key} className="flex items-center gap-2 text-ink-2">
                  <ArrowGlyph color={l.color} faded={!l.drawn} />
                  <span className="text-ink-3">{l.label}</span>
                  <span className="num font-medium text-ink">{l.san}</span>
                  {l.note && <span className="text-[11px] text-ink-4">({l.note})</span>}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <MoveList moves={moves} rowsByPly={rowsByPly} current={idx} onSelect={go} />
          </div>
        </div>
        <div className="min-w-0 lg:pt-1">
          <div className="eyebrow mb-3">Position inspector · {analyzedLabel}</div>
          <Inspector view={view} player={player} analyzedLabel={analyzedLabel} />
        </div>
      </div>

      {player && player.timeline.length > 0 && (
        <Section
          title="The game at a glance"
          kicker="Synchronized with the board"
          description="Three views of every scored move. Highlighted columns are moments where an engine-best move also had a low Maia-3 predicted probability for this rating, in a hard position. Selecting a column moves the board and inspector to that decision; the strip below confirms the selection."
          actions={
            <Segmented
              size="sm"
              label="Timeline detail"
              value={mode}
              onChange={setMode}
              options={[
                { value: "simple", label: "Simple" },
                { value: "expert", label: "Expert" },
              ]}
            />
          }
        >
          <div className="rounded-md border border-rule p-3 sm:p-4">
            {mode === "simple" ? (
              <SimpleTimeline player={player} currentPly={currentPly} onSelectPly={(p) => go(idxByPly.get(p) ?? idx)} />
            ) : (
              <Timeline player={player} currentPly={currentPly} onSelectPly={(p) => go(idxByPly.get(p) ?? idx)} />
            )}
          </div>
          <SelectedStrip
            row={view.row ?? null}
            player={player}
            onView={() => {
              boardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              boardRef.current?.focus({ preventScroll: true });
            }}
          />
        </Section>
      )}

      {player && (
        <Section
          title="Overall assessment"
          kicker={`${analyzedLabel} · ${player.n_decisions} scored moves`}
          description="Why it matters: one number summarizing how much the whole game resembles the controlled substitution examples — a resemblance measure, not a verdict."
        >
          <Assessment player={player} synthetic={syn} kind={report.kind} metrics={metrics} />
        </Section>
      )}

      {showPvo && player?.pvo && (
        <Section
          title="Compared with expectation"
          kicker="Deviation from expected · Regan-inspired statistical view"
          description="Why it matters: strong play alone is not suspicious — the question is whether it is far beyond what players of this rating achieve in positions this difficult."
        >
          <Expectation rows={player.pvo} fileStem={report.id} kappa={metrics?.projection?.kappa} />
        </Section>
      )}

      {player?.narrative && (
        <Section
          title="Why the models score it this way"
          kicker="Explanation"
          description="Why it matters: every score can be traced back to specific, inspectable evidence."
          actions={<Prov kind="ours" short />}
        >
          <Narrative lines={player.narrative} />
          {player.shap?.rows && (
            <TechDetails label="Game-level SHAP contributions">
              <p className="mb-3 text-ink-3">
                Contributions in log-odds of the full game-level model (D) relative to its base value; the largest twelve features by
                magnitude. These decompose the game-level score. The per-move SHAP values in the inspector come from a separate
                decision-level model and do not add up to this score.
              </p>
              <ShapBars rows={player.shap.rows} limit={12} />
            </TechDetails>
          )}
        </Section>
      )}
    </div>
  );
}

/** Compact confirmation of the selected decision, shown beside the timeline; scrolling happens only on request. */
function SelectedStrip({ row, player, onView }: { row: TimelineRow | null; player: PlayerReport | null; onView: () => void }) {
  const san = row ? row.display_san || uciToSan(row.fen, row.move) : "";
  return (
    <div
      className="sticky bottom-0 z-10 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-rule-strong bg-paper/95 px-3 py-2.5 backdrop-blur"
    >
      {row ? (
        <div className="min-w-0 text-[12.5px] leading-snug text-ink-2" aria-live="polite">
          <span className="font-medium text-ink">Selected: </span>
          {row.substituted ? (
            <span className="num">
              {moveLabel(row.move_no, row.color, row.san)} <span className="text-ink-3">(original)</span> →{" "}
              <span className="font-semibold text-flag">{san}</span> <span className="text-ink-3">(counterfactual substitution)</span>
            </span>
          ) : (
            <span className="num font-semibold text-ink">{moveLabel(row.move_no, row.color, san)}</span>
          )}
          <span className="text-ink-3">
            {" "}
            · engine {engineQuality(row).label.toLowerCase()} · Maia-3 probability {humanPlausibility(row.maia_p).label.toLowerCase()}
            {` (${fmtPct(row.maia_p, 1)})`} · difficulty {difficultyLevel(row.difficulty, player).label.toLowerCase()}
          </span>
        </div>
      ) : (
        <div className="text-[12.5px] text-ink-3">No scored decision selected — pick a column above.</div>
      )}
      <button
        type="button"
        onClick={onView}
        className="inline-flex shrink-0 items-center gap-1.5 rounded border border-rule-strong px-2.5 py-1 text-[12px] text-ink transition-colors duration-150 hover:border-ink-3"
      >
        <ArrowUp className="size-3.5" aria-hidden /> View selected position
      </button>
    </div>
  );
}

function NavBtn({ label, onClick, icon }: { label: string; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded border border-rule-strong text-ink-2 transition-colors duration-150 hover:border-ink-3 hover:text-ink"
    >
      {icon}
    </button>
  );
}

function ArrowGlyph({ color, faded }: { color: string; faded?: boolean }) {
  return (
    <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden className="shrink-0" opacity={faded ? 0.35 : 1}>
      <line x1="1" y1="5" x2="15" y2="5" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M14 1 L21 5 L14 9 Z" fill={color} />
    </svg>
  );
}
