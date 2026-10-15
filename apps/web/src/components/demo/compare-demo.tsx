"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, Hand, Layers, Plus, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ShapBars } from "@/components/explain/shap-bars";
import { ZDot } from "@/components/report/pvo";
import { LoadState, Segmented } from "@/components/site/atoms";
import { Cite } from "@/components/site/cite";
import { Prov } from "@/components/site/provenance";
import { KV, TechBlock, TechDetails } from "@/components/site/tech";
import { MiniTimeline } from "@/components/story/addition";
import { StoryBoard, type StoryArrow } from "@/components/story/story-board";
import { Answer, Bar } from "@/components/story/ui";
import { AifLink } from "@/components/demo/aif-link";
import { fenAfter, uciToSan } from "@/lib/chess";
import { DATA, useDemo, useDemos } from "@/lib/data";
import { BASELINE_STUDY, FEATURED_STUDY, STUDY_NAMES, STUDY_ORDER, pickFeaturedRow } from "@/lib/featured";
import { featureText } from "@/lib/features";
import { fmtEval, fmtNum, fmtPct, fmtSigned, isNum, moveLabel } from "@/lib/format";
import { EWN_NOTE, REGAN_VERIFIED } from "@/lib/regan";
import { THRESHOLDS, difficultyLevel, engineQuality, humanPlausibility, patternContext } from "@/lib/semantics";
import type { DemoIndexEntry, PlayerReport, Report, TimelineRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AssistanceSim } from "./assistance-sim";

type View = "regan" | "ours" | "combined";
type Which = "original" | "substituted";
type BoardMode = "before" | "after" | "play";

const verified = (key: string) => REGAN_VERIFIED.find((c) => c.key === key)!;

export function CompareDemo() {
  const demos = useDemos();
  const [studyId, setStudyId] = useState(FEATURED_STUDY);
  const [ply, setPly] = useState<number | null>(null);
  const [which, setWhich] = useState<Which>("substituted");
  const [view, setView] = useState<View>("regan");
  const [mode, setMode] = useState<BoardMode>("before");
  const [tried, setTried] = useState<string | null>(null);
  const rep = useDemo(studyId);
  const featuredRep = useDemo(FEATURED_STUDY);
  const baseRep = useDemo(BASELINE_STUDY);
  const featuredPly = useMemo(() => pickFeaturedRow(featuredRep.data)?.ply ?? null, [featuredRep.data]);

  if (!demos.data || !rep.data) return <LoadState error={demos.error ?? rep.error} label="Loading prepared study" />;
  const report = rep.data;
  const player = report.players[report.focus];
  if (!player) return <LoadState error="No analyzed player in this study" />;
  const eligible = player.timeline.filter((r) => r.eligible);
  const curPly = ply ?? featuredPly ?? eligible[0]?.ply;
  const row = eligible.find((r) => r.ply === curPly) ?? eligible[0];
  const basePlayer = baseRep.data?.players[baseRep.data.focus] ?? null;
  const origRow = row.substituted ? (basePlayer?.timeline.find((r) => r.ply === row.ply) ?? null) : row;
  const showOriginal = row.substituted && which === "original";
  const shown = showOriginal ? origRow : row;
  const shownPlayer = showOriginal ? basePlayer : player;
  const entry = demos.data.demos.find((d) => d.id === studyId);

  const resetBoard = () => {
    setTried(null);
    setMode((m) => (m === "after" ? "before" : m));
  };
  const pick = (id: string) => {
    setStudyId(id);
    resetBoard();
  };
  const choosePly = (p: number) => {
    setPly(p);
    resetBoard();
  };
  const changeMode = (m: BoardMode) => {
    setMode(m);
    setTried(null);
  };

  return (
    <div>
      <StudyPicker demos={demos.data.demos} value={studyId} onChange={pick} />

      <PositionPicker report={report} player={player} current={row.ply} featuredPly={featuredPly} onChange={choosePly} />

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,500px)_minmax(0,1fr)] lg:gap-12">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <Segmented
            className="mb-4"
            label="Board"
            value={mode}
            onChange={changeMode}
            options={[
              { value: "before", label: "Before the move" },
              { value: "after", label: "After the move" },
              {
                value: "play",
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <Hand className="size-3.5" aria-hidden /> Play it yourself
                  </span>
                ),
              },
            ]}
          />
          {mode === "play" ? (
            <PlayBoard row={row} origRow={origRow} tried={tried} onMove={setTried} onReset={() => setTried(null)} />
          ) : shown ? (
            <DemoBoard row={row} shown={shown} showOriginal={showOriginal} view={view} after={mode === "after"} />
          ) : (
            <LoadState error={baseRep.error} label="Loading the original move" />
          )}
        </div>

        <div className="min-w-0">
          <MoveChooser row={row} origRow={origRow} which={showOriginal ? "original" : "substituted"} onChange={(w) => { setWhich(w); }} studyId={studyId} />
          {shown && shownPlayer ? (
            <>
              <QuickReadings row={shown} player={shownPlayer} />
              <ViewTabs value={view} onChange={setView} />
              <div key={view + shown.move} className="reveal mt-5">
                {view === "regan" && <ReganView row={shown} player={shownPlayer} studyPlayer={player} showOriginal={showOriginal} />}
                {view === "ours" && <OursView row={shown} player={shownPlayer} studyPlayer={player} report={report} />}
                {view === "combined" && <CombinedView row={shown} player={shownPlayer} studyPlayer={player} />}
              </div>
            </>
          ) : (
            <LoadState error={baseRep.error} label="Loading the original move" />
          )}
        </div>
      </div>

      <section aria-labelledby="sim-title" className="mt-24 border-t-[3px] border-finding bg-tint-finding px-4 py-10 sm:px-8 sm:py-12">
        <Prov kind="ours" />
        <h2 id="sim-title" className="mt-3 font-serif text-[28px] font-semibold tracking-tight text-ink sm:text-[34px]">
          Controlled Assistance Experiment
        </h2>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink-2">
          The same game, scored at every target level and strategy. The prepared studies above are three of these variants.
        </p>
        <div className="mt-8">
          {entry && (
            <AssistanceSim
              key={studyId}
              initialStrategy={entry.strategy}
              initialLevel={entry.level}
              demos={demos.data.demos}
              onOpenStudy={(id) => {
                pick(id);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              currentStudy={studyId}
            />
          )}
        </div>
      </section>

      <div className="mt-14 grid gap-6 border-t border-rule pt-8 md:grid-cols-[1fr_auto]">
        <AifLink href={DATA.demoAif(studyId)} label="Download this study as AIF" />
        <Link
          href={`/analyze?demo=${studyId}`}
          className="inline-flex h-fit items-center gap-2 self-start rounded-md border border-ink px-4 py-2.5 text-[13.5px] font-semibold text-ink transition-colors duration-150 hover:bg-paper-2"
        >
          Full move-by-move report · live PGN analysis <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ pickers */

function StudyPicker({ demos, value, onChange }: { demos: DemoIndexEntry[]; value: string; onChange: (id: string) => void }) {
  const ordered = STUDY_ORDER.map((id) => demos.find((d) => d.id === id)).filter((d): d is DemoIndexEntry => !!d);
  return (
    <div>
      <div id="study-label" className="text-[12px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
        Prepared study · same game, same player
      </div>
      <div role="radiogroup" aria-labelledby="study-label" className="mt-2 grid gap-2 sm:grid-cols-3">
        {ordered.map((d) => {
          const on = d.id === value;
          return (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(d.id)}
              className={cn(
                "rounded-lg border-2 px-4 py-3 text-left transition-colors duration-200",
                on ? "border-ink bg-paper" : "border-rule bg-paper-2/50 hover:border-rule-strong hover:bg-paper",
              )}
            >
              <div className={cn("text-[15px] font-semibold", on ? "text-ink" : "text-ink-2")}>{STUDY_NAMES[d.id]?.name ?? d.title}</div>
              <div className="num mt-1 text-[12px] text-ink-3">
                {d.strategy === "none"
                  ? "0% · original moves"
                  : `${titleStrategy(d.strategy)} · target ${fmtPct(d.level, 0)} · realized ${fmtPct(d.realized_alpha, 1)}`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const titleStrategy = (s: string) => s[0].toUpperCase() + s.slice(1);

function PositionPicker({
  report,
  player,
  current,
  featuredPly,
  onChange,
}: {
  report: Report;
  player: PlayerReport;
  current: number;
  featuredPly: number | null;
  onChange: (ply: number) => void;
}) {
  const eligible = player.timeline.filter((r) => r.eligible);
  const subs = new Set(report.synthetic?.substitutions.map((s) => s.ply) ?? []);
  const chips = eligible.filter((r) => r.ply === featuredPly || subs.has(r.ply) || r.flag_triple);
  const label = (r: TimelineRow) =>
    r.substituted ? `${moveLabel(r.move_no, r.color, r.san)} → ${r.display_san || uciToSan(r.fen, r.move)}` : moveLabel(r.move_no, r.color, r.display_san || r.san);
  const i = eligible.findIndex((r) => r.ply === current);
  const step = (d: number) => {
    const r = eligible[i + d];
    if (r) onChange(r.ply);
  };
  // left / right arrow keys step through the player's scored decisions (ignored while using a form control)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable=true]")) return;
      const r = e.key === "ArrowLeft" ? eligible[i - 1] : e.key === "ArrowRight" ? eligible[i + 1] : undefined;
      if (!r) return;
      e.preventDefault();
      onChange(r.ply);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2 border-y border-rule py-3">
      <span className="mr-1 text-[12px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Position</span>
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={i <= 0}
          aria-label="Previous scored decision (left arrow)"
          title="Previous scored decision (←)"
          className="inline-flex h-7 w-7 items-center justify-center rounded border border-rule-strong text-ink-2 transition-colors duration-150 hover:border-ink-3 hover:text-ink disabled:opacity-35"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="num min-w-[4.5rem] text-center text-[12px] text-ink-3">
          {i + 1} / {eligible.length}
        </span>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={i >= eligible.length - 1}
          aria-label="Next scored decision (right arrow)"
          title="Next scored decision (→)"
          className="inline-flex h-7 w-7 items-center justify-center rounded border border-rule-strong text-ink-2 transition-colors duration-150 hover:border-ink-3 hover:text-ink disabled:opacity-35"
        >
          <ChevronRight className="size-4" />
        </button>
      </span>
      <span aria-hidden className="mx-1 hidden h-5 w-px bg-rule sm:block" />
      {chips.map((r) => {
        const on = r.ply === current;
        return (
          <button
            key={r.ply}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(r.ply)}
            className={cn(
              "num rounded-full border px-2.5 py-1 text-[12.5px] transition-colors duration-150",
              on ? "border-ink bg-ink text-paper" : r.substituted ? "border-flag/35 bg-flag-soft text-ink hover:border-flag/60" : "border-rule-strong text-ink-2 hover:border-ink-3",
            )}
          >
            {r.ply === featuredPly && <span className={cn("mr-1 text-[10.5px] font-sans font-semibold uppercase", on ? "text-paper/80" : "text-ink-3")}>featured</span>}
            {label(r)}
          </button>
        );
      })}
      <label className="ml-auto flex items-center gap-2 text-[12.5px] text-ink-3">
        <span className="sr-only sm:not-sr-only">Any scored move</span>
        <select
          value={current}
          onChange={(e) => onChange(Number(e.target.value))}
          className="num rounded-md border border-rule-strong bg-paper px-2 py-1 text-[12.5px] text-ink"
        >
          {eligible.map((r) => (
            <option key={r.ply} value={r.ply}>
              {label(r)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

/* ------------------------------------------------------------------ board */

function DemoBoard({ row, shown, showOriginal, view, after }: { row: TimelineRow; shown: TimelineRow; showOriginal: boolean; view: View; after: boolean }) {
  const fen = row.fen;
  const san = (u: string) => uciToSan(fen, u);
  const moveName = showOriginal ? "Original human move" : row.substituted ? "Substituted engine move" : "Move played";
  const sel: StoryArrow = { uci: shown.move, color: "var(--ink)", label: moveName, san: san(shown.move) };
  const other: StoryArrow[] = row.substituted
    ? [
        {
          uci: showOriginal ? row.move : row.human_move,
          color: "color-mix(in oklab, var(--ink) 30%, var(--paper))",
          label: showOriginal ? "Substituted engine move" : "Original human move",
          san: san(showOriginal ? row.move : row.human_move),
        },
      ]
    : [];
  const best = shown.sf_best ?? shown.sf_lines?.[0]?.move;
  const maia = shown.maia_top?.[0];
  const extra: StoryArrow[] = [];
  if (view !== "ours" && best && best !== shown.move) extra.push({ uci: best, color: "var(--engine)", label: "Stockfish #1", san: san(best) });
  if (view === "regan")
    (shown.sf_lines ?? []).slice(1, 3).forEach((l) => {
      if (l.move !== shown.move && l.move !== best) extra.push({ uci: l.move, color: "color-mix(in oklab, var(--engine) 50%, var(--paper))", label: "Engine alternative", san: san(l.move) });
    });
  if (view !== "regan" && maia && maia !== shown.move) extra.push({ uci: maia, color: "var(--human)", label: "Maia-3 most probable", san: san(maia) });
  const seen = new Set<string>();
  const arrows = [sel, ...other, ...extra].filter((a) => a.uci && !seen.has(a.uci) && !!seen.add(a.uci));
  const afterFen = after ? fenAfter(fen, shown.move) : null;
  return (
    <StoryBoard
      id="board-demo"
      row={row}
      fen={afterFen ?? fen}
      arrows={afterFen ? [] : arrows}
      highlight={[shown.move.slice(0, 2), shown.move.slice(2, 4)]}
      caption={afterFen ? `Position after ${moveLabel(row.move_no, row.color, san(shown.move))}; highlighted squares show the move.` : undefined}
    />
  );
}

/* ------------------------------------------------------------------ play it yourself */

function PlayBoard({
  row,
  origRow,
  tried,
  onMove,
  onReset,
}: {
  row: TimelineRow;
  origRow: TimelineRow | null;
  tried: string | null;
  onMove: (uci: string) => void;
  onReset: () => void;
}) {
  const fen = tried ? (fenAfter(row.fen, tried) ?? row.fen) : row.fen;
  return (
    <div>
      <StoryBoard
        id="board-play"
        row={row}
        fen={fen}
        arrows={[]}
        highlight={tried ? [tried.slice(0, 2), tried.slice(2, 4)] : undefined}
        onMove={tried ? undefined : onMove}
        caption={
          tried
            ? undefined
            : "Your turn. Drag a piece, or click a piece and then one of the marked squares. Nothing is revealed until you move."
        }
      />
      {tried && <TryResult row={row} origRow={origRow} uci={tried} onReset={onReset} />}
    </div>
  );
}

/** How the two views read the visitor's move. Uses only analysed values: Stockfish's five lines, Maia-3's top five,
 *  and the exact rows for the original and (if any) substituted move. Anything else is stated as "outside". */
function TryResult({ row, origRow, uci, onReset }: { row: TimelineRow; origRow: TimelineRow | null; uci: string; onReset: () => void }) {
  const fen = row.fen;
  const lines = row.sf_lines ?? [];
  const li = lines.findIndex((l) => l.move === uci);
  const bestCp = lines[0]?.cp;
  const known = [row, origRow].find((r): r is TimelineRow => !!r && r.move === uci);
  const cpl = li >= 0 && isNum(bestCp) ? bestCp - lines[li].cp : isNum(known?.cpl) ? known.cpl : null;
  const sfRank = li >= 0 ? li + 1 : null;
  const eq = engineQuality({ cpl, sf_rank: sfRank ?? 99 });
  const sfHead =
    sfRank === 1 ? "Stockfish's first choice" : sfRank ? `Stockfish line ${sfRank} of ${lines.length}` : `Outside Stockfish's ${lines.length} analysed lines`;
  const sfSub =
    li >= 0
      ? `${fmtEval(lines[li].cp)} · ${cpl === 0 ? "the best value" : `${fmtNum(cpl, 0)} cp below the best`}`
      : isNum(cpl)
        ? `${fmtNum(cpl, 0)} cp below the best`
        : "not among the strongest moves at depth 12";

  const mi = row.maia_top?.indexOf(uci) ?? -1;
  const p = mi >= 0 ? (row.maia_top_p?.[mi] ?? null) : (known?.maia_p ?? null);
  const mRank = mi >= 0 ? mi + 1 : (known?.maia_rank ?? null);
  const top5 = (row.maia_top_p ?? []).filter(isNum);
  const min5 = top5.length ? Math.min(...top5) : null;
  const hp = isNum(p) ? humanPlausibility(p) : null;
  const maiaHead = hp
    ? `${hp.label} human plausibility`
    : isNum(min5) && min5 < THRESHOLDS.human.low
      ? "Low human plausibility"
      : "Outside Maia-3's top 5";
  const maiaSub = isNum(p) ? `${fmtPct(p, 1)} predicted · rank #${mRank ?? "—"}` : isNum(min5) ? `outside Maia-3's top 5 (under ${fmtPct(min5, 1)})` : "—";

  const best = row.sf_best ?? lines[0]?.move;
  const maiaTop = row.maia_top?.[0];
  const matches = [uci === row.human_move && "the player", uci === best && "Stockfish's first choice", uci === maiaTop && "Maia-3's most probable move"].filter(
    (x): x is string => !!x,
  );
  const s = (u?: string) => (u ? moveLabel(row.move_no, row.color, uciToSan(fen, u)) : "—");

  return (
    <div className="reveal mt-4 rounded-lg border-2 border-ink bg-paper p-4 sm:p-5" aria-live="polite">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Your move</div>
          <div className="num text-[24px] font-semibold text-ink">{s(uci)}</div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-md border border-rule-strong px-3 py-1.5 text-[12.5px] font-medium text-ink transition-colors duration-150 hover:border-ink-3"
        >
          <RotateCcw className="size-3.5" aria-hidden /> Try another move
        </button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-engine/30 bg-engine-soft px-3 py-2.5">
          <div className="text-[10.5px] font-semibold tracking-[0.08em] text-engine uppercase">Stockfish · how strong?</div>
          <div className="mt-0.5 text-[15px] font-semibold text-ink">{sfRank || isNum(cpl) ? `${eq.label} · ${sfHead}` : sfHead}</div>
          <div className="num text-[12px] text-ink-3">{sfSub}</div>
        </div>
        <div className="rounded-md border border-human/40 bg-human-soft px-3 py-2.5">
          <div className="text-[10.5px] font-semibold tracking-[0.08em] text-[color-mix(in_oklab,var(--human)_75%,var(--ink))] uppercase">Maia-3 · how human?</div>
          <div className="mt-0.5 text-[15px] font-semibold text-ink">{maiaHead}</div>
          <div className="num text-[12px] text-ink-3">{maiaSub}</div>
        </div>
      </div>
      <dl className="mt-3 grid gap-x-4 gap-y-1 text-[13px] sm:grid-cols-3">
        <div>
          <dt className="text-[11px] text-ink-3">Stockfish&apos;s first choice</dt>
          <dd className="num font-medium text-ink">{s(best)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-ink-3">Maia-3&apos;s most probable</dt>
          <dd className="num font-medium text-ink">{s(maiaTop)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-ink-3">The player chose</dt>
          <dd className="num font-medium text-ink">{s(row.human_move)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
        {matches.length
          ? `You played the same move as ${matches.join(" and ")}.`
          : "Your move differs from the player's, from Stockfish's first choice and from Maia-3's most probable move."}
        {row.substituted && ` In this study, the player's move was replaced by ${s(row.move)}.`}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ original vs substituted */

function MoveChooser({
  row,
  origRow,
  which,
  onChange,
  studyId,
}: {
  row: TimelineRow;
  origRow: TimelineRow | null;
  which: Which;
  onChange: (w: Which) => void;
  studyId: string;
}) {
  if (!row.substituted)
    return (
      <div className="rounded-lg border border-rule-strong bg-paper px-4 py-3">
        <div className="text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Original human move</div>
        <div className="num mt-1 text-[22px] font-semibold text-ink">{moveLabel(row.move_no, row.color, row.display_san || row.san)}</div>
        <div className="mt-1 text-[12.5px] text-ink-3">
          {studyId === BASELINE_STUDY ? "Human baseline: no move is substituted in this study." : "Not substituted in this study; the original move is shown."}
        </div>
      </div>
    );
  const sub = row.display_san || uciToSan(row.fen, row.move);
  const opts: { w: Which; label: string; san: string; r: TimelineRow | null }[] = [
    { w: "original", label: "Original human move", san: row.san, r: origRow },
    { w: "substituted", label: "Substituted engine move", san: sub, r: row },
  ];
  return (
    <div>
      <div id="move-chooser" className="text-[12px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
        Compare the two moves in this position
      </div>
      <div role="radiogroup" aria-labelledby="move-chooser" className="mt-2 grid grid-cols-2 gap-2">
        {opts.map((o) => {
          const on = o.w === which;
          return (
            <button
              key={o.w}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.w)}
              className={cn(
                "rounded-lg border-2 px-3 py-3 text-left transition-colors duration-150 sm:px-4",
                on ? (o.w === "original" ? "border-human bg-human-soft" : "border-ink bg-paper") : "border-rule bg-paper-2/50 hover:border-rule-strong",
              )}
            >
              <div className="text-[10.5px] font-semibold tracking-[0.08em] text-ink-3 uppercase">{o.label}</div>
              <div className="num mt-1 text-[22px] leading-tight font-semibold text-ink">{moveLabel(row.move_no, row.color, o.san)}</div>
              {o.r && (
                <div className="num mt-1 text-[11.5px] text-ink-3">
                  Stockfish {o.r.sf_rank_censored ? `${o.r.sf_rank}+` : `#${o.r.sf_rank}`} · Maia {fmtPct(o.r.maia_p, 1)}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
        The substitute is evaluated in this original position; later positions are those of the original game, not a replayed game.
      </p>
    </div>
  );
}

/** Always-visible readings for the selected move: engine evaluation, Maia prediction, difficulty, model contribution. */
function QuickReadings({ row, player }: { row: TimelineRow; player: PlayerReport }) {
  const eq = engineQuality(row);
  const hp = humanPlausibility(row.maia_p);
  const df = difficultyLevel(row.difficulty, player);
  const top = row.sf_lines?.[0]?.cp;
  return (
    <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-rule bg-rule sm:grid-cols-4">
      <Q k="Stockfish" v={eq.label} sub={`${row.sf_rank_censored ? `${row.sf_rank}+` : `#${row.sf_rank}`} · ${isNum(top) && isNum(row.cpl) ? fmtEval(top - row.cpl) : "—"}`} dot="bg-engine" />
      <Q k="Maia-3" v={hp.label} sub={`#${row.maia_rank ?? "—"} · ${fmtPct(row.maia_p, 1)}`} dot="bg-human" />
      <Q k="Difficulty" v={df.label} sub={fmtNum(row.difficulty, 2)} dot="bg-ink-3" />
      <Q k="Model contribution" v={fmtNum(row.dm_score, 2)} sub="per-move resemblance" dot="bg-ours" />
    </dl>
  );
}

function Q({ k, v, sub, dot }: { k: string; v: string; sub: string; dot: string }) {
  return (
    <div className="bg-paper px-3.5 py-3">
      <dt className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
        <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", dot)} />
        {k}
      </dt>
      <dd className="mt-1 text-[18px] leading-tight font-semibold text-ink">{v}</dd>
      <dd className="num mt-0.5 text-[11.5px] text-ink-3">{sub}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ view tabs */

function ViewTabs({ value, onChange }: { value: View; onChange: (v: View) => void }) {
  const tabs: { v: View; label: string; icon: React.ReactNode; cls: string }[] = [
    { v: "regan", label: "Regan-inspired view", icon: <BookOpen className="size-4" />, cls: "border-regan text-regan" },
    { v: "ours", label: "MoveLens view", icon: <Plus className="size-4" />, cls: "border-ours text-ours" },
    { v: "combined", label: "Combined view", icon: <Layers className="size-4" />, cls: "border-ink text-ink" },
  ];
  return (
    <div role="tablist" aria-label="View" className="mt-8 grid grid-cols-3 border-b border-rule">
      {tabs.map((t) => {
        const on = t.v === value;
        return (
          <button
            key={t.v}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.v)}
            className={cn(
              "-mb-px flex items-center justify-center gap-2 border-b-[3px] px-2 py-3 text-[12.5px] font-semibold tracking-[0.04em] uppercase transition-colors duration-150 sm:text-[13px]",
              on ? t.cls : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            <span aria-hidden className="hidden sm:inline">{t.icon}</span>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function Block({ title, children, cite }: { title: string; children: React.ReactNode; cite?: React.ReactNode }) {
  return (
    <div className="border-b border-rule py-4 first:pt-0 last:border-0">
      <div className="text-[12px] font-semibold tracking-[0.08em] text-ink-2 uppercase">{title}</div>
      <div className="mt-2 text-[14px] leading-relaxed text-ink-2">{children}</div>
      {cite && <div className="mt-1.5 text-[12px]">{cite}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ Regan-inspired */

function ReganView({ row, player, studyPlayer, showOriginal }: { row: TimelineRow; player: PlayerReport; studyPlayer: PlayerReport; showOriginal: boolean }) {
  const lines = (row.sf_lines ?? []).slice(0, 5);
  const inLines = lines.some((l) => l.move === row.move);
  const top = lines[0]?.cp;
  const best = row.sf_best ?? lines[0]?.move;
  const pvo = studyPlayer.pvo ?? [];
  const t1 = pvo.find((r) => r.key === "t1"), ev = pvo.find((r) => r.key === "ev");
  const dev = isNum(row.p_t1) && row.top1 !== undefined ? (row.top1 ? 1 : 0) - row.p_t1 : null;
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Prov kind="regan" />
        <Prov kind="approx" short />
      </div>
      <Block title="Engine alternatives" cite={<Cite cites={verified("multipv").cites} />}>
        <ol className="divide-y divide-rule rounded-md border border-rule">
          {lines.map((l, i) => (
            <li key={l.move} className={cn("grid grid-cols-[2rem_1fr_auto] gap-3 px-3 py-1.5", l.move === row.move && "bg-engine-soft")}>
              <span className="num text-ink-4">{i + 1}</span>
              <span className="num font-medium text-ink">
                {uciToSan(row.fen, l.move)}
                {l.move === row.move && <span className="ml-2 text-[11px] font-normal text-ink-3">selected move</span>}
              </span>
              <span className="num">{fmtEval(l.cp)}</span>
            </li>
          ))}
          {!inLines && isNum(top) && isNum(row.cpl) && (
            <li className="grid grid-cols-[2rem_1fr_auto] gap-3 bg-paper-2 px-3 py-1.5">
              <span className="num text-ink-4">{row.sf_rank}+</span>
              <span className="num font-medium text-ink">
                {uciToSan(row.fen, row.move)} <span className="ml-1 text-[11px] font-normal text-ink-3">selected · outside the 5 lines</span>
              </span>
              <span className="num">{fmtEval(top - row.cpl)}</span>
            </li>
          )}
        </ol>
      </Block>
      <Block title="Expected human behaviour" cite={<Cite cites={verified("probs").cites} />}>
        {isNum(row.p_t1) && best && (
          <div className="mb-2 space-y-2">
            <Bar label={`${uciToSan(row.fen, best)} · engine #1`} value={row.p_t1} color="var(--prov-regan)" valueText={fmtPct(row.p_t1, 1)} emphasis />
            <Bar label="any other move" value={1 - row.p_t1} color="color-mix(in oklab, var(--prov-regan) 30%, var(--paper))" valueText={fmtPct(1 - row.p_t1, 1)} />
          </div>
        )}
        A {player.elo}-rated player in a position of this difficulty is expected to match the engine&apos;s first choice about{" "}
        {fmtPct(row.p_t1, 0)} of the time. Regan&apos;s model assigns a probability to every legal move; our approximation estimates
        only this top-1 probability.
      </Block>
      <Block title="Projected vs observed · this study's game" cite={<Cite cites={verified("pva").cites} />}>
        <div className="grid gap-2 sm:grid-cols-2">
          {[t1, ev].map((r) =>
            r ? (
              <div key={r.key} className="rounded-md border border-rule px-3 py-2.5">
                <div className="text-[12.5px] font-medium text-ink">{r.key === "t1" ? "Engine top choice (T1)" : "Equal-value match (EV)"}</div>
                <div className="num mt-1 text-[13px] text-ink-2">
                  expected <span className="text-[16px] text-ink">{fmtPct(r.projected, 0)}</span> · observed{" "}
                  <span className="text-[16px] font-semibold text-ink">{fmtPct(r.observed, 0)}</span>
                </div>
              </div>
            ) : null,
          )}
        </div>
        {showOriginal && <p className="mt-2 text-[12px] text-ink-3">Game-level values are for this study&apos;s version of the game.</p>}
      </Block>
      <Block title="Statistical deviation">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="num text-[22px] font-semibold text-ink">z = {fmtSigned(t1?.z, 2)}</span>
          <ZDot z={t1?.z ?? null} />
        </div>
        <p className="mt-1">
          Across {t1?.n ?? "the"} decisions, engine top-choice agreement was{" "}
          {isNum(t1?.z) ? (t1.z >= 2 ? "well above" : t1.z <= -2 ? "well below" : "within the normal range of") : "—"} expectation.
          {isNum(dev) && ` This move ${row.top1 ? "matched" : "did not match"} the engine's first choice (contribution ${fmtSigned(dev, 2)} to observed − expected).`}
        </p>
      </Block>
      <TechDetails>
        <TechBlock title="Regan's framework" prov="regan">
          <ul className="space-y-1.5 text-ink-2">
            {(["multipv", "params", "probs", "pva", "outputs"] as const).map((k) => (
              <li key={k}>
                {verified(k).technical} <Cite cites={verified(k).cites} />
              </li>
            ))}
            <li>
              {EWN_NOTE} <Cite cites={[{ src: "guide", loc: "pp. 1, 10–11" }]} />
            </li>
          </ul>
        </TechBlock>
        <TechBlock title="Our approximation, this move" prov="approx">
          <KV
            rows={[
              ["Expected top-1", fmtNum(row.p_t1, 4)],
              ["Observed", row.top1 === undefined ? "—" : row.top1 ? "1 (top-1 match)" : "0"],
              ["Difficulty", `${fmtNum(row.difficulty, 3)} (hard ≥ ${fmtNum(player.hard_threshold, 3)})`],
              ...((studyPlayer.pvo ?? []).map((r) => [r.metric, `proj. ${fmtNum(r.projected, 3)} · obs. ${fmtNum(r.observed, 3)} · z ${fmtSigned(r.z, 2)}`]) as [string, string][]),
              ["Not implemented", "s, c, h · value scaling · ASD · IPR · EWN · Proj1…Proj7+"],
            ]}
          />
        </TechBlock>
      </TechDetails>
    </div>
  );
}

/* ------------------------------------------------------------------ MoveLens */

function OursView({ row, player, studyPlayer, report }: { row: TimelineRow; player: PlayerReport; studyPlayer: PlayerReport; report: Report }) {
  const eq = engineQuality(row);
  const hp = humanPlausibility(row.maia_p);
  const pc = patternContext(player, row.ply);
  const df = difficultyLevel(row.difficulty, player);
  const moves = row.maia_top ?? [];
  const ps = row.maia_top_p ?? [];
  const max = Math.max(...ps.filter(isNum), isNum(row.maia_p) ? row.maia_p : 0, 0.0001);
  const shap = [...(row.dm_shap ?? [])].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 3);
  return (
    <div>
      <div className="mb-4">
        <Prov kind="ours" />
      </div>
      <Block title="Engine quality">
        <div className="flex flex-wrap items-center gap-3">
          <Answer tone="engine">{eq.label}</Answer>
          <span className="num text-[13px] text-ink-3">
            Stockfish {row.sf_rank_censored ? `${row.sf_rank}+` : `#${row.sf_rank}`} · loss {fmtNum(row.cpl, 0)} cp
          </span>
        </div>
      </Block>
      <Block title="Maia-3 human plausibility" cite={<Cite cites={[{ src: "chessformer" }, { src: "maiaCard" }]} />}>
        <div className="flex flex-wrap items-center gap-3">
          <Answer tone="human">{hp.label}</Answer>
          <span className="num text-[13px] text-ink-3">
            predicted {fmtPct(row.maia_p, 1)} · rank #{row.maia_rank ?? "—"} of {row.n_legal ?? "—"}
          </span>
        </div>
        <div className="mt-3 space-y-1.5 rounded-md border border-[color-mix(in_oklab,var(--human)_30%,var(--rule))] bg-human-soft/50 p-3">
          {moves.slice(0, 5).map((m, i) => (
            <Bar key={m} label={uciToSan(row.fen, m)} value={ps[i] ?? 0} max={max} color="var(--human)" valueText={fmtPct(ps[i], 1)} emphasis={m === row.move} />
          ))}
          {!moves.includes(row.move) && isNum(row.maia_p) && (
            <Bar label={`${uciToSan(row.fen, row.move)} · selected`} value={row.maia_p} max={max} color="var(--ink)" valueText={fmtPct(row.maia_p, 1)} emphasis />
          )}
        </div>
        <p className="mt-2 text-[12.5px] text-ink-3">
          Maia-3 is a rating-conditioned human chess model (Chessformer-based transformer), not a language model.
        </p>
      </Block>
      <Block title="Pattern context">
        <p>
          {df.level === "high" ? "Hard position" : df.level === "low" ? "Straightforward position" : "Position of moderate difficulty"} ·{" "}
          {pc.label.toLowerCase()}
          {isNum(pc.observed) && isNum(pc.expected) && ` (last ${pc.window} decisions: ${fmtPct(pc.observed, 0)} engine agreement vs ${fmtPct(pc.expected, 0)} expected)`}.
        </p>
        <div className="mt-3 rounded-md border border-rule p-3">
          <MiniTimeline player={player} currentPly={row.ply} />
        </div>
      </Block>
      <Block title="XGBoost contribution">
        <p>
          A separate per-move model scores this single move{" "}
          <span className="num font-semibold text-ink">{fmtNum(row.dm_score, 2)}</span> for resemblance to a controlled substitution
          (0 to 1).
          {shap.length > 0 && ` Main drivers: ${shap.map((s) => `${featureText(s.feature)} (${s.contribution >= 0 ? "+" : "−"}${Math.abs(s.contribution).toFixed(2)})`).join("; ")}.`}
        </p>
        <p className="mt-2 text-[13px] text-ink-3">
          Whole game in this study: full-model score {fmtNum(studyPlayer.scores?.D_sf_maia_seq, 2)}, synthetic-equivalent assistance
          estimate {fmtPct(studyPlayer.alpha_estimate?.D_sf_maia_seq, 1)}{report.synthetic ? ` (realized ${fmtPct(report.synthetic.realized_alpha, 1)})` : ""}.
        </p>
      </Block>
      <TechDetails>
        <TechBlock title="Maia-3" prov="ours">
          <KV
            rows={[
              ["Model", "Maia3-5M, CSSLab/maia3 commit 1e13597"],
              ["Probability · rank", `${fmtNum(row.maia_p, 4)} · #${row.maia_rank ?? "—"} of ${row.n_legal ?? "—"}`],
              ["Surprisal · entropy", `${fmtNum(row.surprisal, 2)} · ${fmtNum(row.maia_entropy, 2)} nats`],
              ["Elo conditioning", `player ${player.elo ?? "—"} · opponent ${player.opp_elo ?? "—"}`],
              ["Display rule", `High ≥ ${fmtPct(THRESHOLDS.human.high)} · Low < ${fmtPct(THRESHOLDS.human.low)}`],
            ]}
          />
        </TechBlock>
        <TechBlock title="Sequence features at this move" prov="ours">
          <KV
            rows={[
              ["Rolling engine agreement (8)", fmtPct(row.roll_t1, 0)],
              ["Rolling surprisal (8)", `${fmtNum(row.roll_surprisal, 2)} nats`],
              ["Rolling loss (8)", `${fmtNum(row.roll_loss, 1)} cp`],
              ["Highlighted moment", row.flag_triple ? "yes: engine-best + Maia < 10% + hardest third" : "no"],
            ]}
          />
        </TechBlock>
        {row.dm_shap && (
          <TechBlock title="Decision-level model · SHAP (log-odds)" prov="ours">
            <ShapBars rows={row.dm_shap} limit={8} valueDigits={3} />
          </TechBlock>
        )}
      </TechDetails>
    </div>
  );
}

/* ------------------------------------------------------------------ combined */

function CombinedView({ row, player, studyPlayer }: { row: TimelineRow; player: PlayerReport; studyPlayer: PlayerReport }) {
  const eq = engineQuality(row);
  const hp = humanPlausibility(row.maia_p);
  const df = difficultyLevel(row.difficulty, player);
  const pc = patternContext(player, row.ply);
  const t1 = studyPlayer.pvo?.find((r) => r.key === "t1");
  const expectation = !isNum(row.p_t1)
    ? { v: "—", sub: "" }
    : row.top1
      ? { v: row.p_t1 < 0.5 ? "Above expected" : "As expected", sub: `matched the engine's first choice; expected ${fmtPct(row.p_t1, 0)}` }
      : { v: "Not the engine's first choice", sub: `expected match ${fmtPct(row.p_t1, 0)}` };
  const seq =
    df.level === "high" && pc.unusual
      ? "Hard position, during a run of unusually high engine agreement"
      : df.level === "high"
        ? "Hard position"
        : pc.unusual
          ? "During a run of unusually high engine agreement"
          : "No unusual pattern around this move";
  const good = eq.tone === "good";
  const conclusion =
    good && hp.level === "low"
      ? "This position contributes additional human-model evidence beyond move strength alone: the move is strong, but Maia-3 considers it unusual for this rating."
      : good && hp.level === "high"
        ? "Here Maia-3 considers the move typical for this rating, so the human model adds no evidence beyond move strength."
        : good
          ? "Maia-3 considers the move moderately plausible for this rating; the human model adds little beyond move strength here."
          : "The move is not among the strongest, so neither view points to engine-like play here.";
  const rows: { k: string; v: string; sub: string; dot: string; prov: "regan" | "approx" | "ours" }[] = [
    { k: "Engine", v: `${eq.label} move`, sub: `Stockfish ${row.sf_rank_censored ? `${row.sf_rank}+` : `#${row.sf_rank}`}`, dot: "bg-engine", prov: "ours" },
    { k: "Regan-inspired expectation", v: expectation.v, sub: `${expectation.sub}${isNum(t1?.z) ? ` · game z = ${fmtSigned(t1.z, 2)}` : ""}`, dot: "bg-regan", prov: "approx" },
    { k: "Maia-3", v: `${hp.label} human plausibility`, sub: `${fmtPct(row.maia_p, 1)} · rank #${row.maia_rank ?? "—"}`, dot: "bg-human", prov: "ours" },
    { k: "Sequence", v: seq, sub: row.flag_triple ? "a highlighted moment" : "", dot: "bg-ink-3", prov: "ours" },
  ];
  return (
    <div>
      <p className="font-serif text-[22px] leading-snug text-ink">What additional information did the AI view contribute?</p>
      <dl className="mt-5 divide-y divide-rule rounded-lg border border-rule-strong">
        {rows.map((r) => (
          <div key={r.k} className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
            <dt className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.06em] text-ink-3 uppercase">
              <span aria-hidden className={cn("h-2 w-2 rounded-full", r.dot)} />
              {r.k}
            </dt>
            <dd>
              <div className="text-[16px] font-semibold text-ink">{r.v}</div>
              {r.sub && <div className="num text-[12px] text-ink-3">{r.sub}</div>}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 border-l-[3px] border-ours pl-4 text-[16px] leading-relaxed text-ink">{conclusion}</p>
      <p className="mt-3 text-[12.5px] text-ink-3">
        A description of signals on a controlled example, not a judgement about the player. Display thresholds: Low human plausibility
        &lt; {fmtPct(THRESHOLDS.human.low)}; hard = hardest third of training positions.
      </p>
    </div>
  );
}
