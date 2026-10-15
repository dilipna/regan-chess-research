"use client";

import { Activity, Cpu, UsersRound } from "lucide-react";
import { useState } from "react";
import { EngineLines } from "@/components/report/position-intel";
import { Cite } from "@/components/site/cite";
import { Prov } from "@/components/site/provenance";
import { KV, TechBlock, TechDetails } from "@/components/site/tech";
import { uciToSan } from "@/lib/chess";
import type { FeaturedPosition } from "@/lib/featured";
import { featureText } from "@/lib/features";
import { fmtEval, fmtNum, fmtPct, isNum, moveLabel } from "@/lib/format";
import { ADDITION_CHECKS, FOUNDATION_CHECKS } from "@/lib/regan";
import { THRESHOLDS, difficultyLevel, engineQuality, humanPlausibility } from "@/lib/semantics";
import type { PlayerReport, TimelineRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PositionCaption } from "./foundation";
import { StoryBoard, type StoryArrow } from "./story-board";
import { Answer, Bar, Concept, Reading } from "./ui";

type Panel = "stockfish" | "maia" | "pattern";

/** Section 2 — what MoveLens adds, on the same position as Section 1. */
export function Addition({ f }: { f: FeaturedPosition }) {
  const [open, setOpen] = useState<Panel | null>(null);
  const toggle = (p: Panel) => setOpen((o) => (o === p ? null : p));
  const row = f.row;
  const san = row.display_san || uciToSan(row.fen, row.move);
  const maiaTop = row.maia_top?.[0];
  const eq = engineQuality(row);
  const hp = humanPlausibility(row.maia_p);

  const arrows: StoryArrow[] =
    open === "stockfish"
      ? [{ uci: row.move, color: "var(--engine)", label: `Stockfish ${row.sf_rank === 1 ? "#1" : `#${row.sf_rank}`} · move studied`, san }]
      : open === "maia" && maiaTop && maiaTop !== row.move
        ? [
            { uci: maiaTop, color: "var(--human)", label: "Maia-3 most probable", san: uciToSan(row.fen, maiaTop) },
            { uci: row.move, color: "var(--ink)", label: "Move studied", san },
          ]
        : [{ uci: row.move, color: "var(--ink)", label: "Move studied", san }];

  return (
    <div>
      <Contrast />
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,500px)_minmax(0,1fr)] lg:gap-14">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <StoryBoard id="board-addition" row={row} arrows={arrows} caption={<PositionCaption f={f} />} />
        </div>
        <div className="min-w-0 space-y-3">
          <Concept
            family="ours"
            label="1 · Stockfish"
            question="How strong is this move?"
            icon={<Cpu className="size-5" />}
            answer={<Answer tone="engine">{eq.label} · rank {row.sf_rank === 1 ? "#1" : `#${row.sf_rank}`}</Answer>}
            open={open === "stockfish"}
            onToggle={() => toggle("stockfish")}
          >
            <StockfishPanel row={row} />
          </Concept>
          <Concept
            family="ours"
            label="2 · Maia-3"
            question="How human is this move?"
            icon={<UsersRound className="size-5" />}
            answer={<Answer tone="human">{hp.label} · {fmtPct(row.maia_p, 1)}</Answer>}
            open={open === "maia"}
            onToggle={() => toggle("maia")}
            star
          >
            <MaiaPanel f={f} />
          </Concept>
          <Concept
            family="ours"
            label="3 · Pattern over time"
            question="Where in the game are unusual decisions occurring?"
            icon={<Activity className="size-5" />}
            answer={
              <Answer tone={row.flag_triple ? "flag" : "ink"}>
                {f.player.timeline.filter((r) => r.flag_triple).length} highlighted moments
              </Answer>
            }
            open={open === "pattern"}
            onToggle={() => toggle("pattern")}
          >
            <PatternPanel f={f} />
          </Concept>
          <p className="pt-2 text-[12.5px] text-ink-3">Same position as Section 1. Select an item to see it on the board.</p>
        </div>
      </div>
    </div>
  );
}

/** The central difference, stated once and visually. */
function Contrast() {
  return (
    <div className="grid overflow-hidden rounded-lg border border-rule-strong sm:grid-cols-2">
      <div className="flex items-center gap-4 bg-engine-soft px-5 py-5 sm:px-6">
        <Cpu aria-hidden className="size-7 shrink-0 text-engine" />
        <div>
          <div className="text-[12px] font-semibold tracking-[0.09em] text-engine uppercase">Stockfish asks</div>
          <div className="font-serif text-[24px] leading-tight text-ink sm:text-[28px]">“What is strongest?”</div>
        </div>
      </div>
      <div className="flex items-center gap-4 border-t border-rule-strong bg-human-soft px-5 py-5 sm:border-t-0 sm:border-l sm:px-6">
        <UsersRound aria-hidden className="size-7 shrink-0 text-human" />
        <div>
          <div className="text-[12px] font-semibold tracking-[0.09em] text-[color-mix(in_oklab,var(--human)_75%,var(--ink))] uppercase">Maia-3 asks</div>
          <div className="font-serif text-[24px] leading-tight text-ink sm:text-[28px]">“What is human-like?”</div>
        </div>
      </div>
    </div>
  );
}

function Lead({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 font-serif text-[19px] leading-snug text-ink">{children}</p>;
}

/* ------------------------------------------------------------------ Stockfish */

function StockfishPanel({ row }: { row: TimelineRow }) {
  const eq = engineQuality(row);
  return (
    <div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Reading label="Engine quality" value={eq.label} tone="engine" />
        <Reading label="Stockfish rank" value={row.sf_rank_censored ? `${row.sf_rank}+` : `#${row.sf_rank}`} tone="engine" sub={`of ${row.n_legal ?? "—"} legal moves`} />
      </div>
      <Lead>
        {eq.label === "Excellent" ? "The move is objectively very strong." : `Stockfish rates the move as ${eq.label.toLowerCase()}.`}
      </Lead>
      <TechDetails>
        <KV
          rows={[
            ["Rank", row.sf_rank_censored ? `${row.sf_rank}+ (outside the 5 analyzed lines)` : `#${row.sf_rank}`],
            ["CP loss", isNum(row.cpl) ? `${fmtNum(row.cpl, 0)} cp` : "—"],
            ["Evaluation", `${fmtEval(row.eval_before)} (best line, side to move)`],
            ["Best − second gap", isNum(row.gap12) ? `${fmtNum(row.gap12, 0)} cp` : "—"],
            ["Search", `Stockfish 19 · depth ${row.sf_depth ?? 12} · MultiPV 5`],
            ["Display rule", `Excellent = rank #1 or loss ≤ ${THRESHOLDS.engine[0].max} cp`],
          ]}
        />
        <EngineLines row={row} />
      </TechDetails>
    </div>
  );
}

/* ------------------------------------------------------------------ Maia-3 (the star) */

function MaiaPanel({ f }: { f: FeaturedPosition }) {
  const row = f.row;
  const san = row.display_san || uciToSan(row.fen, row.move);
  const hp = humanPlausibility(row.maia_p);
  const moves = row.maia_top ?? [];
  const ps = row.maia_top_p ?? [];
  const max = Math.max(...ps.filter(isNum), isNum(row.maia_p) ? row.maia_p : 0, 0.0001);
  const inTop = moves.includes(row.move);
  const playerMove = f.original?.move;
  return (
    <div>
      <div className="grid gap-2.5 sm:grid-cols-3">
        <Reading label="Human plausibility" value={hp.label} tone="human" />
        <Reading label="Maia predicted rank" value={isNum(row.maia_rank) ? `#${row.maia_rank}` : "—"} tone="human" sub={`of ${row.n_legal ?? "—"} legal moves`} />
        <Reading label="Predicted probability" value={fmtPct(row.maia_p, 1)} tone="human" sub={`for a player rated ${f.player.elo}`} />
      </div>
      <Lead>Maia-3 considers this move unusual for a human at approximately this rating.</Lead>

      <div className="mt-5 rounded-md border border-[color-mix(in_oklab,var(--human)_35%,var(--rule))] bg-human-soft/60 p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-[12px] font-semibold tracking-[0.08em] text-ink-2 uppercase">What a {f.player.elo}-rated human tends to play here</div>
          <div className="text-[11px] text-ink-3">Maia-3 predicted probability</div>
        </div>
        <div className="space-y-2">
          {moves.slice(0, 5).map((m, i) => (
            <Bar
              key={m}
              label={`${uciToSan(row.fen, m)}${m === playerMove ? " · player" : ""}`}
              value={ps[i] ?? 0}
              max={max}
              color="var(--human)"
              valueText={fmtPct(ps[i], 1)}
              emphasis={m === playerMove}
            />
          ))}
          {!inTop && isNum(row.maia_p) && (
            <>
              <div aria-hidden className="py-0.5 pl-1 text-[12px] text-ink-4">⋮</div>
              <Bar label={`${san} · studied`} value={row.maia_p} max={max} color="var(--ink)" valueText={fmtPct(row.maia_p, 1)} emphasis />
            </>
          )}
        </div>
        {playerMove && moves[0] === playerMove && (
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-2">
            The move the player actually chose, <span className="num font-medium">{moveLabel(row.move_no, row.color, f.original!.san)}</span>, is
            Maia-3&apos;s most probable move. The engine&apos;s first choice, <span className="num font-medium">{san}</span>, is ranked #
            {row.maia_rank}.
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-engine/30 bg-engine-soft px-4 py-3">
          <div className="text-[11px] font-semibold tracking-[0.08em] text-engine uppercase">Stockfish · what is strongest?</div>
          <div className="num mt-1 text-[16px] text-ink">
            {san} is #{row.sf_rank}
          </div>
        </div>
        <div className="rounded-md border border-human/40 bg-human-soft px-4 py-3">
          <div className="text-[11px] font-semibold tracking-[0.08em] text-[color-mix(in_oklab,var(--human)_75%,var(--ink))] uppercase">Maia-3 · what is human-like?</div>
          <div className="num mt-1 text-[16px] text-ink">
            {san} is #{row.maia_rank ?? "—"} · {fmtPct(row.maia_p, 1)}
          </div>
        </div>
      </div>

      <p className="mt-4 text-[14px] leading-relaxed text-ink-2">
        Maia-3 is a Chessformer-based human-move transformer: a rating-conditioned human chess model trained on Lichess games, not a
        language model. Given a position, recent history and both ratings, it assigns a predicted probability to every legal move{" "}
        <Cite cites={[{ src: "chessformer" }, { src: "maiaCard" }]} />.
      </p>
      <TechDetails>
        <KV
          rows={[
            ["Model", "Maia3-5M (UofTCSSLab), official CSSLab/maia3 inference, pinned commit 1e13597"],
            ["Predicted probability", isNum(row.maia_p) ? fmtNum(row.maia_p, 4) : "—"],
            ["Rank", isNum(row.maia_rank) ? `#${row.maia_rank} of ${row.n_legal ?? "?"} legal moves` : "—"],
            ["Surprisal", isNum(row.surprisal) ? `−ln p = ${fmtNum(row.surprisal, 2)} nats` : "—"],
            ["Expected surprisal (entropy)", isNum(row.maia_entropy) ? `${fmtNum(row.maia_entropy, 2)} nats` : "—"],
            ["Elo conditioning", `player ${f.player.elo ?? "—"} · opponent ${f.player.opp_elo ?? "—"} · current + up to 7 previous positions`],
            ["Display rule", `High ≥ ${fmtPct(THRESHOLDS.human.high)} · Low < ${fmtPct(THRESHOLDS.human.low)} (presentation only)`],
          ]}
        />
        <p className="mt-2 text-[11.5px] text-ink-3">
          <Cite cites={[{ src: "maiaRepo" }, { src: "maiaCard" }, { src: "chessformer" }]} />
        </p>
      </TechDetails>
    </div>
  );
}

/* ------------------------------------------------------------------ pattern over time */

function PatternPanel({ f }: { f: FeaturedPosition }) {
  const row = f.row;
  const feats = f.player.features ?? {};
  const df = difficultyLevel(row.difficulty, f.player);
  const n = f.player.timeline.filter((r) => r.flag_triple).length;
  return (
    <div>
      <Lead>
        {n > 0
          ? `${n} of this player's moves combine high engine quality, low human plausibility and a difficult position${row.flag_triple ? " — including this one" : ""}.`
          : "No move in this game combines all three signals."}
      </Lead>
      <div className="mt-4 rounded-md border border-rule bg-paper p-3 sm:p-4">
        <MiniTimeline player={f.player} currentPly={row.ply} />
      </div>
      <p className="mt-4 text-[14px] leading-relaxed text-ink-2">
        MoveLens also preserves when these signals occur instead of only summarizing the entire game. This position is{" "}
        {df.level === "high" ? "in the hardest third of positions" : `of ${df.label.toLowerCase()} difficulty`}.
      </p>
      <TechDetails>
        <TechBlock title="At this position" prov="ours">
          <KV
            rows={[
              ["Rolling engine agreement (8)", fmtPct(row.roll_t1, 0)],
              ["Rolling Maia surprisal (8)", isNum(row.roll_surprisal) ? `${fmtNum(row.roll_surprisal, 2)} nats` : "—"],
              ["Rolling move loss (8)", isNum(row.roll_loss) ? `${fmtNum(row.roll_loss, 1)} cp` : "—"],
              ["Highlight rule", "Stockfish #1 · Maia-3 probability < 10% · hardest third of training positions"],
            ]}
          />
        </TechBlock>
        <TechBlock title="Game-level sequence features (XGBoost inputs)" prov="ours">
          <KV
            rows={(["acc_hard", "acc_easy", "crit_lift", "triple_count", "triple_rate", "longest_t1_streak", "roll_t1_max", "roll_surprisal_max"] as const)
              .filter((k) => k in feats)
              .map((k) => [featureText(k), fmtFeat(k, feats[k])] as [string, string])}
          />
        </TechBlock>
      </TechDetails>
    </div>
  );
}

function fmtFeat(k: string, v: number | null | undefined) {
  if (!isNum(v)) return "—";
  if (["acc_hard", "acc_easy", "triple_rate", "roll_t1_max"].includes(k)) return fmtPct(v, 1);
  if (k === "crit_lift") return `${v >= 0 ? "+" : "−"}${Math.abs(100 * v).toFixed(1)} pp`;
  if (k.includes("surprisal")) return `${fmtNum(v, 2)} nats`;
  return fmtNum(v, 0);
}

const QUALITY_H: Record<string, number> = { Excellent: 1, Good: 0.72, Inaccurate: 0.48, Mistake: 0.28, "Serious error": 0.12 };

/** Three plain tracks (no overlapping lines); highlighted columns = engine-best + low Maia-3 probability + hard. */
export function MiniTimeline({ player, currentPly }: { player: PlayerReport; currentPly: number | null }) {
  const rows = player.timeline.filter((r) => r.eligible);
  const hard = player.hard_threshold;
  const n = rows.filter((r) => r.flag_triple).length;
  const tracks: { title: string; sub: string; v: (r: TimelineRow) => number | null; c: (r: TimelineRow) => string }[] = [
    { title: "Engine quality", sub: "taller = stronger", v: (r) => QUALITY_H[engineQuality(r).label] ?? null, c: () => "var(--engine)" },
    {
      title: "Human plausibility",
      sub: "taller = more human-typical",
      v: (r) => (isNum(r.maia_p) ? Math.sqrt(r.maia_p) : null),
      c: () => "var(--human)",
    },
    {
      title: "Position difficulty",
      sub: "taller = harder",
      v: (r) => (isNum(r.difficulty) ? r.difficulty : null),
      c: (r) => (isNum(r.difficulty) && isNum(hard) && r.difficulty >= hard ? "var(--ink-2)" : "var(--ink-4)"),
    },
  ];
  return (
    <div role="img" aria-label={`Timeline of ${rows.length} scored moves. ${n} highlighted moments where an engine-best move had low human plausibility in a hard position.`}>
      <div className="space-y-3">
        {tracks.map((t) => (
          <div key={t.title}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-[12px] font-semibold text-ink">{t.title}</span>
              <span className="text-[11px] text-ink-4">{t.sub}</span>
            </div>
            <div className="flex h-9 items-end gap-[2px]">
              {rows.map((r) => {
                const v = t.v(r);
                return (
                  <span
                    key={r.ply}
                    title={moveLabel(r.move_no, r.color, r.display_san || r.san)}
                    className={cn(
                      "relative flex h-full min-w-0 flex-1 items-end rounded-[2px]",
                      r.flag_triple && "bg-flag/15",
                      r.ply === currentPly && "outline outline-[1.5px] outline-offset-1 outline-ink",
                    )}
                  >
                    <span className="block w-full rounded-[2px]" style={{ height: `${Math.max(6, 100 * (v ?? 0))}%`, background: t.c(r), opacity: v === null ? 0.25 : 1 }} />
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-3">
        <span>move {rows[0]?.move_no}</span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[2px] bg-flag/25" /> highlighted moment
          <span aria-hidden className="ml-3 inline-block h-2.5 w-2.5 rounded-[2px] outline outline-[1.5px] outline-ink" /> this position
        </span>
        <span>move {rows[rows.length - 1]?.move_no}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ side-by-side contribution */

export function Contributions() {
  return (
    <div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-lg border-2 border-[color-mix(in_oklab,var(--prov-regan)_45%,var(--rule))] bg-tint-regan p-5 sm:p-6">
          <Prov kind="regan" />
          <h3 className="mt-3 font-serif text-[20px] font-semibold text-ink">Regan&apos;s publicly documented foundation</h3>
          <ul className="mt-4 space-y-2.5">
            {FOUNDATION_CHECKS.map((c) => (
              <li key={c.label} className="flex gap-2.5 text-[14.5px] leading-snug text-ink">
                <span aria-hidden className="mt-px font-semibold text-regan">✓</span>
                <span>
                  {c.label} <Cite cites={c.cites} className="text-[11.5px]" />
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border-2 border-dashed border-[color-mix(in_oklab,var(--prov-ours)_45%,var(--rule))] bg-tint-ours p-5 sm:p-6">
          <Prov kind="ours" />
          <h3 className="mt-3 font-serif text-[20px] font-semibold text-ink">MoveLens addition</h3>
          <ul className="mt-4 space-y-2.5">
            {ADDITION_CHECKS.map((c) => (
              <li key={c} className="flex gap-2.5 text-[14.5px] leading-snug text-ink">
                <span aria-hidden className="mt-px font-semibold text-ours">+</span>
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mx-auto mt-8 max-w-3xl text-center font-serif text-[20px] leading-snug text-ink sm:text-[22px]">
        MoveLens is intended to complement the statistical framework, not reproduce or replace it.
      </p>
    </div>
  );
}
