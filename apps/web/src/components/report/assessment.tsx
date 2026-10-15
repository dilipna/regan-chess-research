"use client";

import { Prov } from "@/components/site/provenance";
import { TechDetails, Term } from "@/components/site/tech";
import { STRATEGY_TEXT } from "@/lib/features";
import { fmtPct, fmtSigned, isNum } from "@/lib/format";
import type { Metrics, PlayerReport, SyntheticInfo } from "@/lib/types";
import { ScoreSummary } from "./scores";

function similarityWords(pct: number | null | undefined): string {
  if (!isNum(pct)) return "—";
  if (pct >= 0.99) return "Very high — above almost all original validation games";
  if (pct >= 0.95) return "High — above 95% of original validation games";
  if (pct >= 0.8) return "Elevated";
  if (pct >= 0.2) return "Typical of original validation games";
  return "Low";
}

/** Beginner-first overall assessment for one analyzed player. */
export function Assessment({
  player,
  synthetic,
  kind,
  metrics,
}: {
  player: PlayerReport;
  synthetic: SyntheticInfo | null;
  kind?: string;
  metrics?: Metrics;
}) {
  if (player.sufficient === false || !player.scores)
    return <p className="text-[13px] text-ink-3">{player.note ?? "Not enough scored decisions for an overall assessment."}</p>;
  const pct = player.score_percentile_vs_clean?.D_sf_maia_seq;
  const est = player.alpha_estimate?.D_sf_maia_seq;
  const syn = synthetic && synthetic.color === player.color ? synthetic : null;
  const originalPrepared = !synthetic && kind === "demo";
  const est0 = metrics?.experiments.D_sf_maia_seq?.regressor?.by_level?.find((r) => r.level === 0)?.mean_estimate;
  return (
    <div>
      <div className="grid gap-px overflow-hidden rounded-md border border-rule bg-rule md:grid-cols-[1.2fr_1fr_1fr]">
        <div className="bg-paper p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">
              <Term
                tip="How closely the whole game resembles the controlled substitution examples, compared with original (presumed-human) player-games of the validation set."
                technical="full-model classifier score (Stockfish + Maia-3 + sequence, XGBoost)"
                prov="ours"
              >
                Similarity to controlled substitution
              </Term>
            </span>
          </div>
          <div className="mt-2 text-[18px] font-semibold text-ink">{similarityWords(pct)}</div>
          <div className="mt-1 text-[12px] text-ink-3">higher than {fmtPct(pct, 0)} of original validation player-games</div>
        </div>
        <div className="bg-paper p-4">
          <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">
            <Term
              tip="Synthetic-equivalent assistance intensity: the share of decisions that, in our controlled experiments, would have to be substituted by engine moves to produce a similar pattern. Not a probability of cheating."
              technical="synthetic-equivalent assistance regression (model D)"
              prov="ours"
            >
              Estimated assistance intensity
            </Term>
          </span>
          <div className="num mt-2 text-[22px] font-semibold text-ink">{fmtPct(est, 1)}</div>
          <div className="mt-1 text-[12px] text-ink-3">of scored decisions (synthetic-equivalent)</div>
        </div>
        <div className="bg-paper p-4">
          {syn ? (
            <>
              <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">Ground truth · realized substituted fraction</span>
              <div className="num mt-2 text-[22px] font-semibold text-ink">{fmtPct(syn.realized_alpha, 1)}</div>
              <div className="mt-1 text-[12px] text-ink-3">
                {syn.n_altered} of {player.n_decisions} decisions substituted · {STRATEGY_TEXT[syn.strategy]?.name ?? syn.strategy} ·
                estimate error {isNum(est) ? `${fmtSigned((est - syn.realized_alpha) * 100, 1)} pp` : "—"}
              </div>
            </>
          ) : originalPrepared ? (
            <>
              <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">Ground truth</span>
              <div className="mt-2 text-[15px] font-medium text-ink">No injected assistance</div>
              <div className="mt-1 text-[12px] leading-relaxed text-ink-3">
                Original game moves (presumed human). That the game contains no real assistance is not established.
              </div>
            </>
          ) : (
            <>
              <span className="text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">Ground truth</span>
              <div className="mt-2 text-[15px] font-medium text-ink">Unknown</div>
              <div className="mt-1 text-[12px] leading-relaxed text-ink-3">
                Only the controlled experiments have known interventions. For a real game this is a similarity measurement, not a verdict.
              </div>
            </>
          )}
        </div>
      </div>
      {!syn && isNum(est) && est > 0 && (
        <p className="mt-3 max-w-3xl text-[12.5px] leading-relaxed text-ink-3">
          <span className="font-medium text-ink-2">Why is the estimate above 0%? </span>
          The regressor has estimation error and cannot go below zero, so original games receive a positive estimate on average
          {isNum(est0) ? ` (${fmtPct(est0, 1)} across original test player-games)` : ""}. The estimate also reflects resemblance to
          the synthetic benchmark, not detected assistance.
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-3">
        <Prov kind="ours" short /> scores from models trained and validated on the controlled substitution benchmark
      </div>
      <TechDetails label="All model scores">
        <ScoreSummary player={player} synthetic={synthetic} />
      </TechDetails>
    </div>
  );
}
