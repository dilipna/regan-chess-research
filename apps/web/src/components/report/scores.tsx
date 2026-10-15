"use client";

import { MODEL_META, SCORE_ORDER, STRATEGY_TEXT } from "@/lib/features";
import { DASH, fmtPct, fmtScore, fmtSigned, isNum } from "@/lib/format";
import type { PlayerReport, SyntheticInfo } from "@/lib/types";

export function ScoreBar({ value, color }: { value: number | null | undefined; color: string }) {
  return (
    <span className="relative inline-block h-[6px] w-full min-w-16 rounded-full bg-paper-3 align-middle">
      {isNum(value) && (
        <span
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-200"
          style={{ width: `${Math.max(1.5, Math.min(1, value) * 100)}%`, background: color }}
        />
      )}
    </span>
  );
}

export function ScoreSummary({ player, synthetic }: { player: PlayerReport; synthetic: SyntheticInfo | null }) {
  if (player.sufficient === false || !player.scores) {
    return <p className="text-[13px] text-ink-3">{player.note ?? "Not enough eligible decisions to compute scores."}</p>;
  }
  const s = player.scores;
  const pct = player.score_percentile_vs_clean ?? {};
  const est = player.alpha_estimate ?? {};
  const syn = synthetic && synthetic.color === player.color ? synthetic : null;
  const estD = est.D_sf_maia_seq;

  return (
    <div className="space-y-6">
      {syn && (
        <div className="grid gap-4 rounded-md border border-rule bg-paper-2 p-4 sm:grid-cols-3">
          <div>
            <div className="eyebrow">Ground truth · realized substituted fraction</div>
            <div className="num mt-1 text-[22px] text-ink">{fmtPct(syn.realized_alpha, 1)}</div>
            <div className="text-[12px] text-ink-3">
              {syn.n_altered} of {player.n_decisions} eligible decisions substituted · nominal {fmtPct(syn.level, 0)} ·{" "}
              {STRATEGY_TEXT[syn.strategy]?.name ?? syn.strategy}
            </div>
          </div>
          <div>
            <div className="eyebrow">Synthetic-equivalent estimate (D)</div>
            <div className="num mt-1 text-[22px] text-ink">{fmtPct(estD, 1)}</div>
            <div className="text-[12px] text-ink-3">regression output, share of eligible decisions</div>
          </div>
          <div>
            <div className="eyebrow">Estimate − truth</div>
            <div className="num mt-1 text-[22px] text-ink">
              {isNum(estD) ? `${fmtSigned((estD - syn.realized_alpha) * 100, 1)} pp` : DASH}
            </div>
            <div className="text-[12px] text-ink-3">percentage points</div>
          </div>
        </div>
      )}
      <div className="scroll-x">
        <table className="table-lab min-w-[560px]">
          <thead>
            <tr>
              <th>Model</th>
              <th className="r">Score</th>
              <th className="w-[28%]"></th>
              <th className="r">Above original val. games</th>
              <th className="r">Synthetic-equiv. estimate</th>
            </tr>
          </thead>
          <tbody>
            {SCORE_ORDER.map((k) => {
              const m = MODEL_META[k];
              const v = s[k];
              return (
                <tr key={k}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: m.color }} />
                      <span className="text-ink">
                        <span className="num mr-1.5 text-ink-3">{m.code}</span>
                        {m.name}
                      </span>
                    </div>
                  </td>
                  <td className="r num whitespace-nowrap text-ink">{m.isZ ? `z = ${fmtSigned(v, 2)}` : fmtScore(v)}</td>
                  <td>{!m.isZ && <ScoreBar value={v} color={m.color} />}</td>
                  <td className="r num text-ink-2">{fmtPct(pct[k], 1)}</td>
                  <td className="r num text-ink-2">{k === "A0_zt1" ? DASH : fmtPct(est[k], 1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] leading-relaxed text-ink-3">
        Scores (0–1) measure <em>similarity to controlled synthetic assistance</em>; they are not probabilities of cheating.
        A0 is a z-statistic. “Above original val. games” is the share of original (presumed-human) validation player-games with a lower score. The
        synthetic-equivalent estimate is the regressor&apos;s estimate of the fraction of eligible decisions that would have
        to be engine-substituted to produce a comparable pattern.
      </p>
    </div>
  );
}

export function Narrative({ lines }: { lines?: string[] }) {
  if (!lines?.length) return <p className="text-[13px] text-ink-3">{DASH}</p>;
  return (
    <div className="space-y-3">
      <div className="max-w-3xl font-serif text-[16.5px] leading-[1.7] text-ink-2">
        <p>{lines.join(" ")}</p>
      </div>
      <p className="text-[11.5px] text-ink-4">
        Text is generated deterministically from the structured model outputs above; it does not create or modify scores.
      </p>
    </div>
  );
}
