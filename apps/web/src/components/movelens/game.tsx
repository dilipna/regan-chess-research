"use client";

import { useState } from "react";
import { fig, pct, type GameVariant, type ReganChecks } from "@/lib/movelens";
import { cn } from "@/lib/utils";
import { DataTable, Details, KV, SectionShell } from "./ui";

const LEVELS = [0, 0.05, 0.1, 0.2, 0.4, 0.7];

function signed(z: number, d = 2) {
  return `${z >= 0 ? "+" : "−"}${Math.abs(z).toFixed(d)}`;
}

/** Horizontal z scale with the clean-game false-alarm thresholds marked. */
function ZScale({ z, tails }: { z: number; tails: ReganChecks["clean_z"]["tails"] }) {
  const min = -2, max = 8, W = 640, H = 64, L = 12, R = 12;
  const x = (v: number) => L + ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * (W - L - R);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`z(top-1) = ${signed(z)} on a scale from −2 to 8; thresholds at 2 and 3`} className="h-auto w-full">
      <line x1={x(min)} x2={x(max)} y1={30} y2={30} stroke="var(--rule-strong)" strokeWidth={2} />
      {[-2, 0, 2, 4, 6, 8].map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={26} y2={34} stroke="var(--ink-4)" />
          <text x={x(t)} y={52} textAnchor="middle" fontSize={11} fill="var(--ink-3)" className="num">{t}</text>
        </g>
      ))}
      {tails.filter((t) => t.threshold !== 2.5).map((t) => (
        <g key={t.threshold}>
          <line x1={x(t.threshold)} x2={x(t.threshold)} y1={10} y2={34} stroke="var(--ink-3)" strokeDasharray="3 3" />
          <text x={x(t.threshold) + 4} y={14} fontSize={10.5} fill="var(--ink-3)">z = {t.threshold}</text>
        </g>
      ))}
      <circle cx={x(z)} cy={30} r={8} fill="var(--ink)" stroke="var(--paper)" strokeWidth={2} />
    </svg>
  );
}

export function WholeGame({ checks, exampleOneGame }: { checks: ReganChecks; exampleOneGame: boolean }) {
  const g = checks.game;
  const [mode, setMode] = useState<"engine" | "subtle">("engine");
  const [level, setLevel] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const pick = (lv: number): GameVariant =>
    lv === 0 ? g.variants.find((v) => v.strategy === "none")! : g.variants.find((v) => v.strategy === (mode === "engine" ? "random" : "subtle") && Math.abs(v.level - lv) < 1e-9)!;
  const v = pick(level);
  const altered = new Set(v.altered_plies);
  const t2 = checks.clean_z.tails.find((t) => t.threshold === 2)!, t3 = checks.clean_z.tails.find((t) => t.threshold === 3)!;
  const d = hover != null ? g.decisions[hover] : null;
  const same = g.variants.filter((x) => x.strategy === "random").every((r) => {
    const s = g.variants.find((y) => y.strategy === "selective" && y.level === r.level);
    return s && s.z_t1 === r.z_t1;
  });
  return (
    <SectionShell id="game" n={5} title="From one move to a whole game" kicker="Projected versus actual"
      sub="A single move proves nothing. The statistical method accumulates evidence over a whole game: how many engine matches were expected, and how many happened?">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
        <div className="min-w-0">
          <p className="text-[16px] leading-relaxed text-ink-2">
            {exampleOneGame ? "The same held-out game as Example 1" : "One held-out game"}: all {g.n_decisions} eligible moves by the {g.color === "white" ? "White" : "Black"} player (rated {g.elo}).
            Each square is one move; a filled disc means the move matched Stockfish&apos;s first choice.
          </p>
          <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Substitution strategy">
            {([["engine", "Engine first-choice substitutes"], ["subtle", "Subtle substitutes (near-best, within 30 cp)"]] as const).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)}
                className={cn("rounded-md border px-3 py-1.5 text-[13px] font-medium", mode === k ? "border-ink bg-ink text-paper" : "border-rule-strong text-ink-2 hover:border-ink-3")}>{label}</button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Share of moves replaced">
            <span className="mr-1 text-[12px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Moves replaced</span>
            {LEVELS.map((lv) => (
              <button key={lv} type="button" aria-pressed={level === lv} onClick={() => setLevel(lv)}
                className={cn("num rounded border px-2.5 py-1 text-[13px] font-medium", level === lv ? "border-ink bg-ink text-paper" : "border-rule-strong text-ink-2 hover:border-ink-3")}>
                {lv === 0 ? "None (original)" : `${Math.round(lv * 100)}%`}
              </button>
            ))}
          </div>

          <div className="mt-6 grid max-w-[460px] grid-cols-6 overflow-hidden rounded-[3px] border border-[var(--board-dark)]" role="list" aria-label="Moves of the game">
            {g.decisions.map((dd, i) => {
              const dark = (Math.floor(i / 6) + i) % 2 === 1;
              const hit = v.t1[i] === 1, sub = altered.has(dd.ply);
              return (
                <button key={dd.ply} type="button" role="listitem" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onMouseLeave={() => setHover(null)}
                  aria-label={`Move ${dd.move_no}: ${sub ? "replaced by a controlled substitute" : dd.san}; ${hit ? "engine first choice" : "not the engine's first choice"}; projected ${pct(dd.p_t1, 0)}`}
                  className="relative flex aspect-square flex-col items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-ink"
                  style={{ background: dark ? "var(--board-dark)" : "var(--board-light)" }}>
                  <span className={cn("num absolute top-0.5 left-1 text-[9.5px]", dark ? "text-paper/80" : "text-ink-3")}>{dd.move_no}</span>
                  <span aria-hidden className={cn("size-[38%] rounded-full", hit ? "bg-ink" : "border-[1.5px] border-ink/35")} />
                  {sub && <span aria-hidden className="absolute inset-[3px] rounded-[2px] ring-[2.5px] ring-[var(--flag)]" />}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-ink-3">
            <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full bg-ink" />engine first choice</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full border-[1.5px] border-ink/35" />other move</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-[2px] ring-2 ring-[var(--flag)]" />replaced by the experiment</span>
          </div>
          <p className="mt-2 min-h-[2.75rem] text-[13.5px] leading-relaxed text-ink-2" aria-live="polite">
            {d ? <>Move {d.move_no}: played <span className="fig font-semibold text-ink">{fig(d.san)}</span>{altered.has(d.ply) ? " (replaced in this version)" : ""}; Stockfish&apos;s first choice <span className="fig">{fig(d.engine_first)}</span>; the model expected an engine match with probability {pct(d.p_t1, 0)}.</> : "Hover or focus a square to see that move."}
          </p>
        </div>

        <div className="min-w-0">
          <div className="grid grid-cols-3 gap-4 rounded-lg border border-rule-strong bg-paper p-5">
            <div><div className="text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Expected matches</div><div className="num mt-1 font-sans text-[34px] leading-none font-semibold text-ink">{v.projected_t1.toFixed(1)}</div></div>
            <div><div className="text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Actual matches</div><div className="num mt-1 font-sans text-[34px] leading-none font-semibold text-ink">{v.actual_t1}</div></div>
            <div><div className="text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">z (top-1)</div><div className="num mt-1 font-sans text-[34px] leading-none font-semibold text-ink">{signed(v.z_t1)}</div></div>
          </div>
          <div className="mt-5"><ZScale z={v.z_t1} tails={checks.clean_z.tails} /></div>
          <p className="mt-3 text-[14.5px] leading-relaxed text-ink-2">
            Among the {checks.clean_z.n} presumed-clean held-out games, {pct(t2.observed)} exceed z = 2 ({t2.count} games) and {pct(t3.observed, 2)} exceed z = 3 ({t3.count} game{t3.count === 1 ? "" : "s"}); a standard normal would give {pct(t2.normal)} and {pct(t3.normal, 2)}.
          </p>
          <p className="mt-4 font-serif text-[21px] leading-snug font-semibold text-ink">
            {level === 0
              ? `The original game: ${v.actual_t1} engine matches where ${v.projected_t1.toFixed(1)} were expected (z = ${signed(v.z_t1)}${Math.abs(v.z_t1) < 2 ? ", well inside the range of clean games" : ""}).`
              : `With ${v.n_altered} of ${g.n_decisions} moves replaced, the game shows ${v.actual_t1} matches against ${v.projected_t1.toFixed(1)} expected: z = ${signed(v.z_t1)}.`}
          </p>
          {same && mode === "engine" && (
            <p className="mt-3 text-[13.5px] leading-relaxed text-ink-3">
              Random and selective (hardest-move) substitution give identical z here at every level: each replacement adds exactly one engine match, and a count
              statistic cannot see <em>which</em> moves were replaced. Telling them apart needs position-aware evidence, such as the hard-position statistic or the human-move model.
            </p>
          )}
          <Details>
            <KV rows={[
              ["Formula", g.formula],
              ["κ (top-1)", g.kappa_t1.toFixed(3)],
              ["Variance", `Σ p(1−p) = ${v.var_t1.toFixed(2)} for this game`],
              ["Check", g.check],
              ["Game", `${g.game_id} (${g.color}), held-out test split; substitutions evaluated in the original positions (not replayed)`],
            ]} />
            <div className="mt-3">
              <DataTable caption="z(top-1) by share of moves replaced" head={["Replaced", "Engine #1 subs: actual / expected / z", "Subtle subs: actual / expected / z"]}
                rows={LEVELS.map((lv) => {
                  const a = lv === 0 ? g.variants.find((x) => x.strategy === "none")! : g.variants.find((x) => x.strategy === "random" && Math.abs(x.level - lv) < 1e-9)!;
                  const b = lv === 0 ? a : g.variants.find((x) => x.strategy === "subtle" && Math.abs(x.level - lv) < 1e-9)!;
                  return [lv === 0 ? "none" : `${Math.round(lv * 100)}%`, `${a.actual_t1} / ${a.projected_t1.toFixed(1)} / ${signed(a.z_t1)}`, `${b.actual_t1} / ${b.projected_t1.toFixed(1)} / ${signed(b.z_t1)}`];
                })} />
            </div>
          </Details>
        </div>
      </div>
    </SectionShell>
  );
}
