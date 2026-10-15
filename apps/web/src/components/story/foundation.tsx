"use client";

import { ListOrdered, Scale, UserRound } from "lucide-react";
import { useState } from "react";
import { ZDot } from "@/components/report/pvo";
import { Cite } from "@/components/site/cite";
import { Prov } from "@/components/site/provenance";
import { KV, TechBlock, TechDetails } from "@/components/site/tech";
import { uciToSan } from "@/lib/chess";
import type { FeaturedPosition } from "@/lib/featured";
import { fmtEval, fmtNum, fmtPct, fmtSigned, isNum, moveLabel } from "@/lib/format";
import { EWN_NOTE, REGAN_VERIFIED, SOURCES } from "@/lib/regan";
import type { PvoRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StoryBoard, type StoryArrow } from "./story-board";
import { Bar, Concept } from "./ui";

type Panel = "engine" | "model" | "compare";

const SHADE = [
  "var(--engine)",
  "color-mix(in oklab, var(--engine) 78%, var(--paper))",
  "color-mix(in oklab, var(--engine) 62%, var(--paper))",
  "color-mix(in oklab, var(--engine) 48%, var(--paper))",
  "color-mix(in oklab, var(--engine) 36%, var(--paper))",
];

const verified = (key: string) => REGAN_VERIFIED.find((c) => c.key === key)!;

/** Section 1 — Regan's statistical foundation, explained on the featured position. */
export function Foundation({ f }: { f: FeaturedPosition }) {
  const [open, setOpen] = useState<Panel | null>(null);
  const toggle = (p: Panel) => setOpen((o) => (o === p ? null : p));
  const row = f.row;
  const lines = (row.sf_lines ?? []).slice(0, 5);
  const best = row.sf_best ?? lines[0]?.move;
  const san = (u: string) => uciToSan(row.fen, u);

  const arrows: StoryArrow[] =
    open === "engine"
      ? lines.map((l, i) => ({ uci: l.move, color: SHADE[i], label: `Engine line ${String.fromCharCode(65 + i)}`, san: san(l.move) }))
      : open === "model" && best
        ? [{ uci: best, color: "var(--engine)", label: "Engine's first choice", san: san(best) }]
        : open === "compare"
          ? [{ uci: row.move, color: "var(--ink)", label: "Move studied", san: row.display_san || san(row.move) }]
          : [];

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,500px)_minmax(0,1fr)] lg:gap-14">
      <div className="lg:sticky lg:top-20 lg:self-start">
        <StoryBoard id="board-foundation" row={row} arrows={arrows} caption={<PositionCaption f={f} />} />
      </div>
      <div className="min-w-0 space-y-3">
        <Concept
          family="regan"
          label="A. Engine view"
          question="What alternatives does the engine see?"
          icon={<ListOrdered className="size-5" />}
          open={open === "engine"}
          onToggle={() => toggle("engine")}
        >
          <EnginePanel f={f} />
        </Concept>
        <Concept
          family="regan"
          label="B. Human model"
          question="Given player strength and engine utilities, what behavior is expected?"
          icon={<UserRound className="size-5" />}
          open={open === "model"}
          onToggle={() => toggle("model")}
        >
          <ModelPanel f={f} />
        </Concept>
        <Concept
          family="regan"
          label="C. Projected vs observed"
          question="How did actual play compare with the projection?"
          icon={<Scale className="size-5" />}
          open={open === "compare"}
          onToggle={() => toggle("compare")}
        >
          <ComparePanel f={f} />
        </Concept>
        <p className="pt-2 text-[12.5px] text-ink-3">Select an item to see it on the board.</p>
        <p className="rounded-md border border-regan/30 bg-paper px-3 py-2 text-[12.5px] leading-relaxed text-ink-2">
          This is a reconstruction based on Professor Regan&apos;s publicly documented framework, not his private production analyzer.
        </p>
      </div>
    </div>
  );
}

export function PositionCaption({ f }: { f: FeaturedPosition }) {
  const row = f.row;
  const subSan = row.display_san || uciToSan(row.fen, row.move);
  return (
    <>
      From the <span className="text-ink-2">Controlled Selective Assistance</span> study (player rated {f.player.elo}). The move
      studied, <span className="num text-ink-2">{moveLabel(row.move_no, row.color, subSan)}</span>, is a controlled engine
      substitution evaluated in this original position; the player actually chose{" "}
      <span className="num text-ink-2">{moveLabel(row.move_no, row.color, row.san)}</span>. The same position is used in every
      section.
    </>
  );
}

function Lead({ children }: { children: React.ReactNode }) {
  return <p className="font-serif text-[19px] leading-snug text-ink">{children}</p>;
}

function Why({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{children}</p>;
}

function OurNumbers({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-3">
      <Prov kind="approx" short />
      <span>{children}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ engine analysis */

function EnginePanel({ f }: { f: FeaturedPosition }) {
  const row = f.row;
  const lines = (row.sf_lines ?? []).slice(0, 5);
  const orig = f.original;
  const top = lines[0]?.cp;
  return (
    <div>
      <Lead>
        {isNum(row.near_opt) && row.near_opt >= 2
          ? `${row.near_opt === lines.length ? "All" : row.near_opt} of the engine's ${lines.length} candidate moves are within a quarter of a pawn of the best. There is no single “right” move here.`
          : `The engine compares ${lines.length} candidate moves, not only its first choice.`}
      </Lead>
      <ol className="mt-4 divide-y divide-rule rounded-md border border-rule">
        {lines.map((l, i) => {
          const isStudied = l.move === row.move;
          return (
            <li key={l.move} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 px-3 py-2 text-[14px]">
              <span className="text-[12px] text-ink-3">Move {String.fromCharCode(65 + i)}</span>
              <span className="num font-medium text-ink">
                {uciToSan(row.fen, l.move)}
                {isStudied && <span className="ml-2 text-[11px] font-normal text-ink-3">move studied</span>}
              </span>
              <span className="num text-ink-2">{fmtEval(l.cp)}</span>
            </li>
          );
        })}
        {orig && !lines.some((l) => l.move === orig.move) && isNum(top) && isNum(orig.cpl) && (
          <li className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 bg-paper-2 px-3 py-2 text-[14px]">
            <span className="text-[12px] text-ink-3">Player</span>
            <span className="num font-medium text-ink">
              {orig.san}
              <span className="ml-2 text-[11px] font-normal text-ink-3">outside the five lines</span>
            </span>
            <span className="num text-ink-2">{fmtEval(top - orig.cpl)}</span>
          </li>
        )}
      </ol>
      <p className="mt-1.5 text-[11.5px] text-ink-3">Engine value in pawns, from the side to move.</p>
      <Why>
        Regan&apos;s workflow uses MultiPV engine analysis rather than treating the position as having only one meaningful move{" "}
        <Cite cites={verified("multipv").cites} />.
      </Why>
      <OurNumbers>Values from our Stockfish 19 analysis (depth 12, MultiPV 5), not from Regan&apos;s engine runs.</OurNumbers>
      <TechDetails>
        <TechBlock title="In Regan's framework" prov="regan">
          <ul className="space-y-1.5 text-ink-2">
            <li>
              <span className="font-medium text-ink">MultiPV.</span> {verified("multipv").technical} <Cite cites={verified("multipv").cites} />
            </li>
            <li>
              <span className="font-medium text-ink">Move utility.</span> {verified("utilities").technical}{" "}
              <Cite cites={verified("utilities").cites} />
            </li>
            <li>
              <span className="font-medium text-ink">AIF.</span> Analysis Interchange Format, the analyzer&apos;s input: game plus
              per-move engine lines and values <Cite cites={[{ src: "aif" }]} />.
            </li>
          </ul>
        </TechBlock>
        <TechBlock title="This position, in our analysis" prov="approx">
          <KV
            rows={[
              ["Legal moves", String(row.n_legal ?? "—")],
              ["Engine / depth", `Stockfish 19 · depth ${row.sf_depth ?? 12} · MultiPV 5 · Threads 1`],
              ["Evaluation", `${fmtEval(row.eval_before)} (best line, side to move)`],
              ["Best − second gap", isNum(row.gap12) ? `${fmtNum(row.gap12, 0)} cp` : "—"],
              ["Near-optimal moves", isNum(row.near_opt) ? `${row.near_opt} within 25 cp of the best` : "—"],
              ["Utility", "one fixed depth, unscaled centipawns; no depth-by-depth utilities or value scaling"],
              ["AIF", "experimental AIF-compatible export; not tested with Regan's analyzer"],
            ]}
          />
        </TechBlock>
      </TechDetails>
    </div>
  );
}

/* ------------------------------------------------------------------ player model */

function ModelPanel({ f }: { f: FeaturedPosition }) {
  const row = f.row;
  const best = row.sf_best ?? row.sf_lines?.[0]?.move;
  const p = row.p_t1;
  const others = isNum(row.n_legal) ? row.n_legal - 1 : null;
  return (
    <div>
      <Lead>
        A {f.player.elo}-rated player in a position this difficult is expected to choose the engine&apos;s first choice only about{" "}
        {fmtPct(p, 0)} of the time.
      </Lead>
      {isNum(p) && best && (
        <div className="mt-4 space-y-2.5 rounded-md border border-rule bg-paper p-4">
          <Bar label={`${uciToSan(row.fen, best)} · engine #1`} value={p} color="var(--prov-regan)" valueText={fmtPct(p, 1)} emphasis />
          <Bar
            label={others !== null ? `other ${others} moves` : "any other move"}
            value={1 - p}
            color="color-mix(in oklab, var(--prov-regan) 30%, var(--paper))"
            valueText={fmtPct(1 - p, 1)}
          />
        </div>
      )}
      <Why>
        The statistical model estimates how likely a player of this skill level is to choose each move. In Regan&apos;s
        framework, Elo-trained parameters generate a probability pᵢ for every legal move <Cite cites={verified("probs").cites} />.
      </Why>
      <OurNumbers>
        Our public-data approximation estimates only the chance of matching the engine&apos;s first choice, so the remaining{" "}
        {fmtPct(isNum(p) ? 1 - p : null, 0)} is not split across individual moves here.
      </OurNumbers>
      <TechDetails>
        <TechBlock title="In Regan's framework" prov="regan">
          <ul className="space-y-1.5 text-ink-2">
            <li>
              <span className="font-medium text-ink">s, c, h.</span> {verified("params").technical} <Cite cites={verified("params").cites} />
            </li>
            <li>
              <span className="font-medium text-ink">Elo conditioning.</span> The parameters are trained against Elo, so the expected
              behaviour changes with the player&apos;s rating <Cite cites={[{ src: "talk", loc: "p. 10" }]} />.
            </li>
            <li>
              <span className="font-medium text-ink">pᵢ over legal moves.</span> {verified("probs").technical}{" "}
              <Cite cites={verified("probs").cites} />
            </li>
          </ul>
          <p className="mt-2 text-[11.5px] text-ink-3">Regan&apos;s equations and calibration are not reproduced on this site.</p>
        </TechBlock>
        <TechBlock title="This position, in our approximation" prov="approx">
          <KV
            rows={[
              ["Player / opponent Elo", `${f.player.elo ?? "—"} / ${f.player.opp_elo ?? "—"}`],
              ["Position difficulty", `${fmtNum(row.difficulty, 3)} (hardest third ≥ ${fmtNum(f.player.hard_threshold, 3)})`],
              ["Expected top-1 match", `${fmtNum(p, 4)} = training-set rate in this Elo band × difficulty decile`],
              ["Not implemented", "s, c, h · value scaling · a probability for each legal move"],
            ]}
          />
        </TechBlock>
      </TechDetails>
    </div>
  );
}

/* ------------------------------------------------------------------ statistical comparison */

function ComparePanel({ f }: { f: FeaturedPosition }) {
  const get = (k: string) => f.pvo.find((r) => r.key === k);
  const t1 = get("t1"), ev = get("ev"), loss = get("loss"), hard = get("t1_hard");
  const z = t1?.z;
  const verdict = !isNum(z) ? "—" : z >= 2 ? "well above" : z <= -2 ? "well below" : "within the normal range of";
  const studied = f.row.display_san || uciToSan(f.row.fen, f.row.move);
  return (
    <div>
      <Lead>
        Across this player&apos;s {t1?.n ?? f.player.n_decisions} scored decisions, agreement with the engine was {verdict} what the
        model projected.
      </Lead>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {t1 && <Pair title="Engine top choice" sub="T1-match" r={t1} />}
        {ev && <Pair title="Equal-value match" sub="EV-match (ties count)" r={ev} />}
        {loss && <Pair title="Move-quality statistic" sub="mean loss · not Regan's ASD" r={loss} lowerIsBetter />}
        {t1 && (
          <div className="rounded-md border border-rule bg-paper p-4">
            <div className="text-[13px] font-medium text-ink">Deviation from expected</div>
            <div className="text-[11.5px] text-ink-3">for engine top choice</div>
            <div className="num mt-2 text-[26px] leading-none font-semibold text-ink">z = {fmtSigned(z, 2)}</div>
            <div className="mt-2 -ml-2.5 max-w-full overflow-hidden">
              <ZDot z={z ?? null} />
            </div>
            <div className="num mt-0.5 text-[10.5px] text-ink-4">shaded: |z| &lt; 2</div>
          </div>
        )}
      </div>
      <Why>
        Comparing projected with observed play, with a correction for dependence between decisions, is the core of Regan&apos;s
        test <Cite cites={verified("pva").cites} />. The move studied, <span className="num">{studied}</span>, is one of the{" "}
        {t1?.n ?? "scored"} decisions counted.
      </Why>
      <OurNumbers>Expected and observed values from our Regan-inspired approximation, not from Regan&apos;s analyzer.</OurNumbers>
      <TechDetails>
        <TechBlock title="In Regan's framework" prov="regan">
          <ul className="space-y-1.5 text-ink-2">
            <li>
              <span className="font-medium text-ink">T1, EV, ASD, IPR.</span> {verified("outputs").technical}{" "}
              <Cite cites={verified("outputs").cites} />
            </li>
            <li>
              <span className="font-medium text-ink">z-scores.</span> {verified("pva").technical} <Cite cites={verified("pva").cites} />
            </li>
            <li>
              <span className="font-medium text-ink">Confidence intervals.</span> Derived from the per-move probabilities{" "}
              <Cite cites={verified("probs").cites} />.
            </li>
            <li>
              <span className="font-medium text-ink">Difficulty and EWN.</span> {verified("difficulty").technical} {EWN_NOTE}{" "}
              <Cite cites={[{ src: "guide", loc: "pp. 1, 10–11" }]} />
            </li>
            <li>
              <span className="font-medium text-ink">Projection hits.</span> {verified("proj").technical} <Cite cites={verified("proj").cites} />
            </li>
          </ul>
        </TechBlock>
        <TechBlock title="This game, in our approximation" prov="approx">
          <KV
            rows={[
              ["z formula", "z = (observed − Σpᵢ) / √(κ · Σpᵢ(1 − pᵢ)), κ estimated on original validation games"],
              ...(f.pvo.map((r) => [r.metric, `projected ${fmtVal(r)} · observed ${fmtVal(r, true)} · n = ${r.n} · z = ${fmtSigned(r.z, 2)}`]) as [string, string][]),
              ["Hard positions", hard ? `our statistic (hardest third of training positions); neither EWN nor Regan's difficulty model` : "—"],
              ["Not implemented", "ASD · IPR · Proj1…Proj7+ · EWN · Regan's confidence intervals"],
            ]}
          />
          <p className="mt-2 text-[11.5px] text-ink-3">
            Sources: <a className="underline" href={SOURCES.talk.href} target="_blank" rel="noreferrer">{SOURCES.talk.short}</a>,{" "}
            <a className="underline" href={SOURCES.guide.href} target="_blank" rel="noreferrer">{SOURCES.guide.short}</a>.
          </p>
        </TechBlock>
      </TechDetails>
    </div>
  );
}

function fmtVal(r: PvoRow, observed = false) {
  const v = observed ? r.observed : r.projected;
  if (r.unit === "rate") return fmtPct(v, 1);
  if (r.unit === "cp") return `${fmtNum(v, 1)} cp`;
  return fmtNum(v, 2);
}

function Pair({ title, sub, r, lowerIsBetter = false }: { title: string; sub: string; r: PvoRow; lowerIsBetter?: boolean }) {
  const rate = r.unit === "rate";
  const max = rate ? 1 : Math.max(r.projected ?? 0, r.observed ?? 0) * 1.1 || 1;
  const txt = (v: number | null) => (rate ? fmtPct(v, 0) : `${fmtNum(v, 1)} cp`);
  return (
    <div className="rounded-md border border-rule bg-paper p-4">
      <div className="text-[13px] font-medium text-ink">{title}</div>
      <div className="text-[11.5px] text-ink-3">
        {sub}
        {lowerIsBetter && " · lower = stronger"}
      </div>
      <dl className="mt-3 space-y-2">
        <div className="grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-2 text-[12.5px]">
          <dt className="text-ink-3">Expected</dt>
          <dd className="relative h-2.5 rounded-full bg-paper-3">
            <span
              className="absolute inset-y-0 left-0 rounded-full border border-[var(--prov-regan)] bg-paper"
              style={{ width: `${Math.max(2, (100 * (r.projected ?? 0)) / max)}%` }}
            />
          </dd>
          <dd className="num text-right text-ink-2">{txt(r.projected)}</dd>
        </div>
        <div className="grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-2 text-[12.5px]">
          <dt className="font-medium text-ink">Observed</dt>
          <dd className="relative h-2.5 rounded-full bg-paper-3">
            <span className="absolute inset-y-0 left-0 rounded-full bg-[var(--prov-regan)]" style={{ width: `${Math.max(2, (100 * (r.observed ?? 0)) / max)}%` }} />
          </dd>
          <dd className={cn("num text-right font-semibold text-ink")}>{txt(r.observed)}</dd>
        </div>
      </dl>
    </div>
  );
}
