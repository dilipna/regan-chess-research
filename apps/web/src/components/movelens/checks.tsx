"use client";

import { useState } from "react";
import { fig, normalPdf, pct, type ReganChecks } from "@/lib/movelens";
import { CheckPanel, DataTable, Details, SectionShell } from "./ui";

const AX = { fontSize: 11, fill: "var(--ink-3)" } as const;

function Readout({ text }: { text: string | null }) {
  return <p className="mt-1 min-h-[1.5rem] text-[12.5px] text-ink-2" aria-live="polite">{text ?? "Hover or focus a mark for its values."}</p>;
}

/* 1 ---------------------------------------------------------------------------------------- calibration */
function Calibration({ c }: { c: ReganChecks["calibration"] }) {
  const [h, setH] = useState<number | null>(null);
  const W = 360, H = 300, L = 44, B = 36, T = 10, R = 12;
  const x = (v: number) => L + v * (W - L - R), y = (v: number) => H - B - v * (H - B - T);
  const b = h != null ? c.by_bin[h] : null;
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Projected versus actual engine-match rate on held-out decisions" className="h-auto w-full max-w-[420px]">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={x(0)} x2={x(1)} y1={y(t)} y2={y(t)} stroke="var(--rule)" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" {...AX} className="num">{t * 100}%</text>
            <text x={x(t)} y={H - B + 16} textAnchor="middle" {...AX} className="num">{t * 100}%</text>
          </g>
        ))}
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="var(--ink-3)" strokeDasharray="4 4" />
        <text x={x(0.98)} y={y(0.98) + 16} textAnchor="end" fontSize={10.5} fill="var(--ink-3)">perfect calibration</text>
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" {...AX}>projected chance of engine&apos;s first move</text>
        <text transform={`translate(12 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" {...AX}>actual rate</text>
        {c.by_bin.map((d, i) => (
          <g key={d.bin} tabIndex={0} onMouseEnter={() => setH(i)} onFocus={() => setH(i)} onMouseLeave={() => setH(null)} onBlur={() => setH(null)} className="outline-none">
            <circle cx={x(d.projected)} cy={y(d.actual)} r={14} fill="transparent" />
            <circle cx={x(d.projected)} cy={y(d.actual)} r={h === i ? 7 : 5.5} fill="var(--viz-1)" stroke="var(--paper)" strokeWidth={2} />
          </g>
        ))}
      </svg>
      <Readout text={b ? `Projection bin ${b.bin}: projected ${pct(b.projected)}, actual ${pct(b.actual)} (${b.n.toLocaleString()} decisions)` : null} />
      <Details label="Show table">
        <DataTable caption="Calibration by projection bin" head={["Bin", "Decisions", "Projected", "Actual"]} rows={c.by_bin.map((d) => [d.bin, d.n.toLocaleString(), pct(d.projected), pct(d.actual)])} />
        <div className="mt-3"><DataTable caption="Calibration by rating band" head={["Rating band", "Decisions", "Projected", "Actual"]} rows={c.by_band.map((d) => [d.band, d.n.toLocaleString(), pct(d.projected), pct(d.actual)])} /></div>
      </Details>
    </>
  );
}

/* 2 ---------------------------------------------------------------------------------------- clean z histogram */
function CleanZ({ z }: { z: ReganChecks["clean_z"] }) {
  const [h, setH] = useState<number | null>(null);
  const W = 400, H = 260, L = 36, B = 36, T = 10, R = 10;
  const e = z.hist_edges, lo = e[0], hi = e[e.length - 1], w = e[1] - e[0];
  const ymax = Math.max(...z.hist, z.n * w * normalPdf(0)) * 1.1;
  const x = (v: number) => L + ((v - lo) / (hi - lo)) * (W - L - R), y = (v: number) => H - B - (v / ymax) * (H - B - T);
  const curve = Array.from({ length: 81 }, (_, i) => lo + (i * (hi - lo)) / 80).map((v) => `${x(v)},${y(z.n * w * normalPdf(v))}`).join(" ");
  const bar = h != null ? { lo: e[h], hi: e[h + 1], n: z.hist[h], exp: z.n * w * normalPdf((e[h] + e[h + 1]) / 2) } : null;
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Histogram of z(top-1) on presumed-clean held-out games with a standard normal reference curve" className="h-auto w-full max-w-[460px]">
        {[0, 50, 100].filter((t) => t < ymax).map((t) => (
          <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--rule)" /><text x={L - 6} y={y(t) + 4} textAnchor="end" {...AX} className="num">{t}</text></g>
        ))}
        {z.hist.map((n, i) => (
          <g key={i} tabIndex={0} onMouseEnter={() => setH(i)} onFocus={() => setH(i)} onMouseLeave={() => setH(null)} onBlur={() => setH(null)} className="outline-none">
            <rect x={x(e[i]) + 1} y={T} width={x(e[i + 1]) - x(e[i]) - 2} height={H - B - T} fill="transparent" />
            {n > 0 && <rect x={x(e[i]) + 1} y={y(n)} width={x(e[i + 1]) - x(e[i]) - 2} height={y(0) - y(n)} rx={3} fill="var(--viz-1)" opacity={h === i ? 1 : 0.85} />}
          </g>
        ))}
        <polyline points={curve} fill="none" stroke="var(--ink)" strokeWidth={2} strokeDasharray="5 4" />
        {[-4, -2, 0, 2, 4].map((t) => <text key={t} x={x(t)} y={H - B + 16} textAnchor="middle" {...AX} className="num">{t}</text>)}
        <line x1={x(2)} x2={x(2)} y1={T} y2={H - B} stroke="var(--ink-3)" strokeDasharray="2 3" />
        <text x={x(2) + 4} y={T + 10} fontSize={10.5} fill="var(--ink-3)">z = 2</text>
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" {...AX}>z (top-1) of the original game</text>
      </svg>
      <div className="flex flex-wrap gap-x-5 text-[12px] text-ink-3">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[2px] bg-[var(--viz-1)]" />{z.n} held-out games</span>
        <span className="inline-flex items-center gap-1.5"><svg width="22" height="6" aria-hidden><line x1="0" y1="3" x2="22" y2="3" stroke="var(--ink)" strokeWidth="2" strokeDasharray="5 4" /></svg>standard normal, same total</span>
      </div>
      <Readout text={bar ? `z from ${bar.lo} to ${bar.hi}: ${bar.n} games (normal reference ≈ ${bar.exp.toFixed(1)})` : null} />
      <Details label="Show table">
        <DataTable caption="Tail fractions" head={["Threshold", "Games above", "Observed", "Standard normal"]} rows={z.tails.map((t) => [`z > ${t.threshold}`, t.count, pct(t.observed, 2), pct(t.normal, 2)])} />
      </Details>
    </>
  );
}

/* 3 ---------------------------------------------------------------------------------------- screening power */
function Screening({ s }: { s: ReganChecks["screening"] }) {
  const [h, setH] = useState<string | null>(null);
  const levels = [0, 0.05, 0.1, 0.2, 0.4, 0.7];
  const base = s.rows.find((r) => r.strategy === "none")!;
  const series = [
    { key: "random", label: "Engine first-choice substitutes", color: "var(--viz-1)" },
    { key: "subtle", label: "Subtle substitutes (≤ 30 cp from best)", color: "var(--viz-2)" },
  ];
  const W = 420, H = 270, L = 44, B = 38, T = 12, R = 16;
  const x = (i: number) => L + (i / (levels.length - 1)) * (W - L - R), y = (v: number) => H - B - v * (H - B - T);
  const pt = (k: string, lv: number) => (lv === 0 ? base : s.rows.find((r) => r.strategy === k && Math.abs(r.level - lv) < 1e-9)!);
  const hr = h ? (() => { const [k, i] = h.split("|"); const r = pt(k, levels[+i]); return { k, r }; })() : null;
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Share of held-out games with z(top-1) above 2, by share of moves replaced" className="h-auto w-full max-w-[480px]">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--rule)" /><text x={L - 6} y={y(t) + 4} textAnchor="end" {...AX} className="num">{t * 100}%</text></g>
        ))}
        {levels.map((lv, i) => <text key={lv} x={x(i)} y={H - B + 16} textAnchor="middle" {...AX} className="num">{lv === 0 ? "0" : `${Math.round(lv * 100)}%`}</text>)}
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" {...AX}>share of moves replaced</text>
        {series.map((se) => (
          <g key={se.key}>
            <polyline fill="none" stroke={se.color} strokeWidth={2} points={levels.map((lv, i) => `${x(i)},${y(pt(se.key, lv).share_z_gt2)}`).join(" ")} />
            {levels.map((lv, i) => (
              <g key={lv} tabIndex={0} onMouseEnter={() => setH(`${se.key}|${i}`)} onFocus={() => setH(`${se.key}|${i}`)} onMouseLeave={() => setH(null)} onBlur={() => setH(null)} className="outline-none">
                <circle cx={x(i)} cy={y(pt(se.key, lv).share_z_gt2)} r={12} fill="transparent" />
                <circle cx={x(i)} cy={y(pt(se.key, lv).share_z_gt2)} r={h === `${se.key}|${i}` ? 6 : 4.5} fill={se.color} stroke="var(--paper)" strokeWidth={2} />
              </g>
            ))}
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-ink-3">
        {series.map((se) => <span key={se.key} className="inline-flex items-center gap-1.5"><span className="h-[3px] w-5 rounded" style={{ background: se.color }} />{se.label}</span>)}
      </div>
      <Readout text={hr ? `${hr.k === "random" ? "Engine first-choice" : "Subtle"} substitutes, ${Math.round(hr.r.level * 100)}% replaced: ${pct(hr.r.share_z_gt2)} of games above z = 2, ${pct(hr.r.share_z_gt3)} above z = 3 (median z ${hr.r.median_z.toFixed(2)})` : null} />
      <Details label="Show table">
        <DataTable caption="Share of games flagged" head={["Replaced", "Engine #1: z>2", "Engine #1: z>3", "Subtle: z>2", "Subtle: z>3"]}
          rows={levels.map((lv) => [lv === 0 ? "none" : `${Math.round(lv * 100)}%`, pct(pt("random", lv).share_z_gt2), pct(pt("random", lv).share_z_gt3), pct(pt("subtle", lv).share_z_gt2), pct(pt("subtle", lv).share_z_gt3)])} />
        <p className="mt-2">Selective (hardest-move) substitution gives the same values as random here, for the reason given in section 5.</p>
      </Details>
    </>
  );
}

/* 4 ---------------------------------------------------------------------------------------- Maia by band */
function MaiaBands({ m }: { m: ReganChecks["maia_by_band"] }) {
  return (
    <div className="space-y-2.5">
      {m.map((b) => (
        <div key={b.band} className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-3 text-[13.5px]">
          <span className="num text-ink-2">{b.band}</span>
          <span className="relative h-5 rounded-[3px] bg-paper-3"><span className="absolute inset-y-0 left-0 rounded-[3px] bg-[var(--viz-1)]" style={{ width: `${b.top1_accuracy * 100}%` }} /></span>
          <span className="num text-right font-semibold text-ink">{pct(b.top1_accuracy)}</span>
        </div>
      ))}
      <p className="text-[12px] text-ink-3">Top-1 accuracy on original held-out moves (n = {m.reduce((a, b) => a + b.n, 0).toLocaleString()}).</p>
    </div>
  );
}

/* 5 ---------------------------------------------------------------------------------------- Qwen engine echo */
function QwenEcho({ q }: { q: ReganChecks["qwen_ablation"] }) {
  if (q.status !== "precomputed-local")
    return <p role="status" className="rounded-md border border-dashed border-rule-strong bg-paper-2 p-4 text-[14px] text-ink-2"><b className="text-ink">Not yet evaluated.</b> {q.note ?? "The position-only Qwen scores do not exist yet."}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <caption className="sr-only">Qwen&apos;s top move with and without Stockfish lines in the prompt</caption>
        <thead>
          <tr className="border-b border-rule-strong text-left text-ink-3">
            <th scope="col" className="py-1.5 pr-3 font-medium">Played</th>
            <th scope="col" className="py-1.5 pr-3 font-medium">Engine #1</th>
            <th scope="col" className="py-1.5 pr-3 font-medium">Qwen top, with engine lines</th>
            <th scope="col" className="py-1.5 pr-3 font-medium">Qwen top, position only</th>
            <th scope="col" className="py-1.5 pr-3 font-medium">Played move&apos;s Qwen rank (with / without)</th>
          </tr>
        </thead>
        <tbody>
          {q.rows.map((r) => (
            <tr key={r.position_id} className="border-b border-rule last:border-0">
              <td className="fig py-1.5 pr-3 text-ink">{fig(r.played_san)}</td>
              <td className="fig py-1.5 pr-3 text-ink">{fig(r.engine_first_san)}</td>
              <td className="py-1.5 pr-3"><span className="fig font-semibold text-ink">{fig(r.regan_aligned.top_san)}</span>{r.regan_aligned.top_is_engine_first && <span className="ml-1.5 text-[11px] text-ink-3">= engine #1</span>}</td>
              <td className="py-1.5 pr-3"><span className="fig font-semibold text-ink">{fig(r.position_only.top_san)}</span>{r.position_only.top_is_engine_first && <span className="ml-1.5 text-[11px] text-ink-3">= engine #1</span>}</td>
              <td className="num py-1.5 pr-3 text-ink">#{r.regan_aligned.played_rank} / #{r.position_only.played_rank}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Checks({ c }: { c: ReganChecks }) {
  const cal = c.calibration, z = c.clean_z, t2 = z.tails.find((t) => t.threshold === 2)!;
  const r20 = c.screening.rows.find((r) => r.strategy === "random" && r.level === 0.2)!, s20 = c.screening.rows.find((r) => r.strategy === "subtle" && r.level === 0.2)!;
  const band = (k: number) => c.maia_by_band[k];
  const maxGap = Math.max(...cal.by_bin.map((b) => Math.abs(b.projected - b.actual)));
  const q = c.qwen_ablation;
  const qAnswer = q.status === "precomputed-local"
    ? (() => {
        const a = q.summary.regan_aligned, b = q.summary.position_only;
        const drift = b.median_rank_engine_first > a.median_rank_engine_first && b.median_played_rank > a.median_played_rank;
        return `With the engine lines in the prompt, Qwen's top move was Stockfish's first choice in ${a.top_is_engine_first} of ${q.n_positions} demo positions; without them, in ${b.top_is_engine_first} of ${q.n_positions}. ` +
          `The median rank of the engine's first choice moves from ${a.median_rank_engine_first} to ${b.median_rank_engine_first}, and of the human move from ${a.median_played_rank} to ${b.median_played_rank}. ` +
          (drift ? "On these positions the engine numbers drive much of Qwen's ranking; any added value must be measured against that. " : "") +
          `Seven positions are a qualitative check, not a test; the held-out ablation is planned.`;
      })()
    : "Not answered yet: it needs Qwen scores without the engine lines.";
  return (
    <SectionShell id="checks" n={6} title="Can these numbers be trusted?" kicker="Checks a statistician would ask for"
      sub="Before comparing models, check that the statistical yardstick is calibrated, know how often it misfires on honest games, and know what each model is really reading.">
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <CheckPanel q="Are the projections calibrated on games the model never saw?" source="regan_checks.json · calibration (held-out test split, original moves)"
          answer={<>Across {cal.n.toLocaleString()} held-out human decisions the model projected {pct(cal.projected_mean)} engine-first matches; {pct(cal.actual_mean)} happened. In every bin with at least 30 decisions, projected and actual rates differ by at most {(100 * maxGap).toFixed(1)} percentage points.</>}>
          <Calibration c={cal} />
        </CheckPanel>
        <CheckPanel q="How often would an honest player be flagged?" source="regan_checks.json · clean_z (605 presumed-clean held-out player-games)"
          answer={<>z on clean games has mean {z.mean >= 0 ? "+" : "−"}{Math.abs(z.mean).toFixed(2)} and SD {z.sd.toFixed(2)}. {t2.count} of {z.n} games ({pct(t2.observed)}) exceed z = 2, where a standard normal predicts about {(z.n * t2.normal).toFixed(0)} ({pct(t2.normal)}){t2.observed > t2.normal ? ", so the tail is a little heavier than normal and thresholds need some margin" : ""}.</>}>
          <CleanZ z={z} />
        </CheckPanel>
        <CheckPanel q="How much substitution does the statistic need to notice?" source="regan_checks.json · screening (605 held-out games per cell)"
          answer={<>With 20% of moves replaced by engine first choices, {pct(r20.share_z_gt2)} of games exceed z = 2. Replace them with near-best moves that are not the first choice and only {pct(s20.share_z_gt2)} do, against {pct(t2.observed)} of untouched games. Counting engine first-choice matches is largely insensitive to subtle help.</>}>
          <Screening s={c.screening} />
        </CheckPanel>
        <CheckPanel q="Does the human-move model track playing strength?" source="three_model_move_prediction.json · Maia-3 79M by rating band"
          answer={<>Maia-3 79M predicts the exact human move {pct(band(0).top1_accuracy)} of the time for 1000–1399 players and {pct(band(3).top1_accuracy)} for 2200+; it is the rating conditioning that lets it act as a human-behavior control.</>}>
          <MaiaBands m={c.maia_by_band} />
        </CheckPanel>
      </div>
      <div className="mt-5">
        <CheckPanel q="Is Qwen just echoing the engine lines it is shown?" source="regan_checks.json · qwen_ablation (7 demo positions, local precomputed Qwen3-8B-Base runs with two frozen prompts)" answer={qAnswer}>
          <p className="mb-3 text-[14px] leading-relaxed text-ink-2">The main Qwen prompt contains Stockfish&apos;s top-5 evaluations. If Qwen&apos;s preference is mostly a copy of those numbers, it cannot add information beyond the engine. The same frozen prompt without the engine lines separates the two.</p>
          <QwenEcho q={q} />
        </CheckPanel>
      </div>
      <div className="mt-8 rounded-lg border border-dashed border-rule-strong p-5">
        <h3 className="font-serif text-[22px] font-bold text-ink">What is not shown yet</h3>
        <ul className="mt-2 grid gap-x-8 gap-y-1.5 text-[14px] leading-relaxed text-ink-2 md:grid-cols-2">
          <li>The held-out Qwen evaluation (12,863 positions) and the paired test of whether Qwen adds information beyond the statistical model and Maia.</li>
          <li>Sensitivity to engine depth and version (all analysis is Stockfish 19 at depth 12).</li>
          <li>Real, adjudicated cheating cases; only controlled substitutions are used.</li>
          <li>Over-the-board and classical games; the data are one month of online Lichess rapid/classical games.</li>
          <li>An intrinsic performance rating: the reconstruction does not fit per-player skill parameters.</li>
          <li>Comparison with Professor Regan&apos;s actual analyzer on the same games.</li>
        </ul>
      </div>
    </SectionShell>
  );
}
