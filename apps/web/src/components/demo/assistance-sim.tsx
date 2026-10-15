"use client";

import { useState } from "react";
import { LoadState, Segmented } from "@/components/site/atoms";
import { KV, TechDetails } from "@/components/site/tech";
import { useMetrics, useSimulator } from "@/lib/data";
import { STUDY_NAMES } from "@/lib/featured";
import { STRATEGY_TEXT } from "@/lib/features";
import { fmtNum, fmtPct, isNum } from "@/lib/format";
import type { DemoIndexEntry, Strategy } from "@/lib/types";
import { cn } from "@/lib/utils";

const STRAT_PLAIN: Record<string, string> = {
  random: "Engine's first choice substituted at randomly chosen decisions.",
  selective: "Engine's first choice substituted at the hardest decisions: help used at critical moments.",
  subtle: "Strong but not always first-choice engine moves substituted, which is harder to see by counting matches.",
};

/**
 * Controlled Assistance Experiment for the prepared game: every nominal level × strategy variant that was scored.
 * Starts at the selected prepared study's own strategy and level (remount with a new key to reset).
 */
export function AssistanceSim({
  initialStrategy,
  initialLevel,
  demos,
  onOpenStudy,
  currentStudy,
}: {
  initialStrategy: Strategy;
  initialLevel: number;
  demos: DemoIndexEntry[];
  onOpenStudy: (id: string) => void;
  currentStudy: string;
}) {
  const { data: sim, error } = useSimulator();
  const { data: m } = useMetrics();
  const [strategy, setStrategy] = useState<Exclude<Strategy, "none">>(initialStrategy === "none" ? "selective" : initialStrategy);
  const [level, setLevel] = useState(initialLevel);
  if (!sim) return <LoadState error={error} label="Loading the controlled experiment" />;
  const pg = sim.player_games[0];
  const v =
    level === 0
      ? pg.variants.find((x) => x.strategy === "none")
      : pg.variants.find((x) => x.strategy === strategy && Math.abs(x.level - level) < 1e-9);
  const est = v?.alpha_estimate?.D_sf_maia_seq;
  const est0 = m?.experiments.D_sf_maia_seq?.regressor?.by_level?.find((r) => r.level === 0)?.mean_estimate;
  const altered = new Set(v?.altered_plies ?? []);
  const match = demos.find((d) => (level === 0 ? d.strategy === "none" : d.strategy === strategy && Math.abs(d.level - level) < 1e-9));

  return (
    <div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:gap-10">
        <div>
          <div id="sim-level" className="text-[12px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
            Target intervention
          </div>
          <div role="radiogroup" aria-labelledby="sim-level" className="mt-2 flex flex-wrap gap-1.5">
            {sim.levels.map((l) => {
              const on = Math.abs(l - level) < 1e-9;
              return (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setLevel(l)}
                  className={cn(
                    "num min-w-[3.75rem] rounded-md border px-3 py-2 text-[15px] transition-colors duration-150",
                    on ? "border-ink bg-ink text-paper" : "border-rule-strong bg-paper text-ink-2 hover:border-ink-3",
                  )}
                >
                  {l === 0 ? (
                    <>
                      0% <span className={cn("text-[11px]", on ? "text-paper/80" : "text-ink-3")}>human</span>
                    </>
                  ) : (
                    fmtPct(l)
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-5 text-[12px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Strategy</div>
          <Segmented
            className="mt-2"
            label="Assistance strategy"
            value={strategy}
            onChange={setStrategy}
            options={[
              { value: "random", label: "Random" },
              { value: "selective", label: "Selective" },
              { value: "subtle", label: "Subtle" },
            ]}
          />
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2" aria-live="polite">
            {level === 0 ? "The original game moves; nothing substituted." : STRAT_PLAIN[strategy]}
          </p>
          {match && match.id !== currentStudy && (
            <button type="button" onClick={() => onOpenStudy(match.id)} className="mt-3 text-[13px] font-medium text-ink underline underline-offset-4">
              This variant is the prepared study “{STUDY_NAMES[match.id]?.name ?? match.title}”: open it above
            </button>
          )}
        </div>

        <div>
          <div className="grid gap-px overflow-hidden rounded-lg border border-rule-strong bg-rule-strong sm:grid-cols-3">
            <Tile label="Target intervention" value={fmtPct(level, 0)} sub={level === 0 ? "original game" : "nominal share of decisions"} />
            <Tile
              label="Realized substitution rate"
              value={fmtPct(v?.realized_alpha, 1)}
              sub={`${v?.n_altered ?? 0} of ${pg.n_decisions} decisions`}
              strong
            />
            <Tile label="Model estimate" value={fmtPct(est, 1)} sub="full model (D) · not a cheating probability" strong />
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
            <span className="font-medium text-ink">Target vs realized. </span>
            {level === 0 ? (
              <>The target is a share of the player&apos;s {pg.n_decisions} scored decisions; at 0% nothing is substituted.</>
            ) : (
              <>
                Substitutions are whole decisions: {fmtPct(level, 0)} of {pg.n_decisions} decisions →{" "}
                {Math.max(1, Math.round(level * pg.n_decisions))} decisions
                {isNum(v?.n_altered) && v.n_altered < Math.max(1, Math.round(level * pg.n_decisions))
                  ? `, capped at the ${v.n_altered} decisions where the player had not already chosen the substitute`
                  : ""}{" "}
                = {fmtPct(v?.realized_alpha, 1)} realized. The model is scored against the realized rate.
              </>
            )}
          </p>
          {level === 0 && isNum(est) && (
            <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
              <span className="font-medium text-ink">Why not 0%? </span>
              Nothing was substituted, yet the model returns {fmtPct(est, 1)}. The estimate has error and cannot go below zero, so
              original games receive a positive estimate on average.
              {isNum(est0) && (
                <>
                  {" "}
                  Average original-test-game estimate: <span className="num font-semibold text-ink">{fmtPct(est0, 1)}</span>.
                </>
              )}
            </p>
          )}
          <div className="mt-5">
            <div className="mb-1.5 text-[12px] font-medium text-ink">The player&apos;s {pg.n_decisions} scored decisions</div>
            <div className="flex flex-wrap gap-[3px]" role="img" aria-label={`${v?.n_altered ?? 0} of ${pg.n_decisions} decisions substituted`}>
              {pg.decisions.map((d) => (
                <span
                  key={d.ply}
                  title={`Move ${d.move_no}${altered.has(d.ply) ? ": engine move substituted" : ""}`}
                  className={cn("h-7 w-[13px] rounded-[2px]", altered.has(d.ply) ? "bg-flag" : "bg-paper-3")}
                  style={!altered.has(d.ply) && isNum(d.difficulty) ? { background: `color-mix(in oklab, var(--ink-4) ${Math.round(15 + 60 * d.difficulty)}%, var(--paper))` } : undefined}
                />
              ))}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 text-[11.5px] text-ink-3">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[2px] bg-flag" /> substituted
              </span>
              <span>grey shade = position difficulty (darker = harder)</span>
            </div>
          </div>
          <TechDetails>
            <KV
              rows={[
                ["Player-game", `${pg.label} · Elo ${pg.elo} · ${pg.band} · test split`],
                ["Definition", "m = max(1, round(α · n)) decisions altered; moves already equal to the substitute cannot be altered"],
                ["Realized α", `${fmtNum(v?.realized_alpha, 4)} = ${v?.n_altered ?? 0} / ${pg.n_decisions} (regression target)`],
                ["Strategy rule", STRATEGY_TEXT[level === 0 ? "none" : strategy]?.def ?? "—"],
                ["Nested levels", "decisions altered at 10% include those altered at 5%, and so on"],
                ["Estimates A / C / D", v ? `${fmtPct(v.alpha_estimate.A_stat, 1)} / ${fmtPct(v.alpha_estimate.C_sf_maia, 1)} / ${fmtPct(v.alpha_estimate.D_sf_maia_seq, 1)}` : "—"],
                ["Scores A / C / D", v ? `${fmtNum(v.scores.A_stat, 3)} / ${fmtNum(v.scores.C_sf_maia, 3)} / ${fmtNum(v.scores.D_sf_maia_seq, 3)}` : "—"],
                ["Limitation", "each substitute is evaluated in the original position; the game is not replayed"],
              ]}
            />
          </TechDetails>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, sub, strong }: { label: string; value: string; sub: string; strong?: boolean }) {
  return (
    <div className="bg-paper p-4 sm:p-5">
      <div className="text-[10.5px] font-semibold tracking-[0.08em] text-ink-3 uppercase">{label}</div>
      <div className={cn("num mt-2 text-[30px] leading-none", strong ? "font-semibold text-ink" : "text-ink-2")}>{value}</div>
      <div className="mt-2 text-[11.5px] leading-snug text-ink-3">{sub}</div>
    </div>
  );
}
