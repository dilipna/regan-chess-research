"use client";

import { ArrowDown, ArrowRight, Compass, FlaskConical, Layers, UsersRound } from "lucide-react";
import { useState } from "react";
import { LoadState } from "@/components/site/atoms";
import { Prov } from "@/components/site/provenance";
import { InfoTip, TechDetails } from "@/components/site/tech";
import { useMetrics } from "@/lib/data";
import {
  STORY_STEPS,
  auc,
  ci,
  headlineFindings,
  largestStep,
  lowFprRows,
  pairedCaveat,
  signed3,
  storyDeltas,
} from "@/lib/findings";
import { fmtCI, fmtInt, fmtNum, fmtPct, isNum } from "@/lib/format";
import type { Metrics, ModelKey } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Section 3 on the Overview: benchmark → progression → key finding → three findings → why it may matter. */
export function ExperimentStory({ showLowFpr = false }: { showLowFpr?: boolean }) {
  const { data: m, error } = useMetrics();
  if (!m) return <LoadState error={error} label="Loading measured results" />;
  return (
    <div className="space-y-16">
      <BenchmarkIntro m={m} />
      <Progression m={m} />
      <KeyFinding m={m} />
      <FindingCards m={m} />
      {showLowFpr && <LowFpr m={m} />}
      <WhyItMatters />
    </div>
  );
}

/* ------------------------------------------------------------------ benchmark */

export function BenchmarkIntro({ m }: { m: Metrics }) {
  const ds = m.dataset;
  const nPg = ds?.n_player_games?.test, nRows = ds?.n_variants?.test, nSrc = ds?.n_source_games?.test;
  return (
    <div className="max-w-3xl">
      <p className="font-serif text-[21px] leading-snug text-ink sm:text-[24px]">
        We begin with presumed-human source games and make controlled decision-level substitutions, giving us known intervention
        labels without accusing real players.
      </p>
      <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-rule-strong bg-paper px-3 py-1 text-[13px] font-medium text-ink">
        <FlaskConical className="size-3.5 text-finding" aria-hidden /> Evaluated in the original positions.
      </p>
      <TechDetails label="Learn more about the benchmark">
        <ul className="list-disc space-y-1.5 pl-4 text-ink-2">
          <li>
            Source: Lichess rated rapid/classical games, one game per player. They are presumed human; that they contain no real
            assistance is not established.
          </li>
          <li>
            At chosen decisions, an engine move is substituted and evaluated <em>in the original position</em>. Later positions stay
            those of the original game; these are not replayed assisted games.
          </li>
          <li>
            Three strategies (Random, Selective in the hardest positions, Subtle near-best moves) at nominal levels of 5–70% of
            eligible decisions. Substitutes come from the same engine used for analysis, which makes heavy substitution easier to
            detect than real assistance might be.
          </li>
          <li>
            Held-out test split: {fmtInt(nSrc)} source games → {fmtInt(nPg)} original player-games → {fmtInt((nRows ?? 0) - (nPg ?? 0))}{" "}
            substituted variants. Variants of one game are not independent, so every interval resamples whole source games. Test
            players never appear in training.
          </li>
          <li>
            The statistical baseline (A) is our Regan-inspired approximation. Regan&apos;s analyzer was not run or compared here.
          </li>
        </ul>
      </TechDetails>
    </div>
  );
}

/* ------------------------------------------------------------------ progression */

export function Progression({ m }: { m: Metrics }) {
  const big = largestStep(m);
  const [sel, setSel] = useState<ModelKey>(big ?? "C_sf_maia");
  const deltas = storyDeltas(m);
  const step = STORY_STEPS.find((s) => s.key === sel)!;
  const idx = STORY_STEPS.findIndex((s) => s.key === sel);
  const d = idx > 0 ? deltas[idx - 1] : null;
  return (
    <div>
      <h3 className="font-serif text-[22px] font-semibold tracking-tight text-ink">Four nested systems, one held-out test set</h3>
      <p className="mt-1 text-[14px] text-ink-3">Each system adds one source of evidence to the previous one. Select a step.</p>
      <ol className="mt-6 flex flex-col items-stretch lg:flex-row lg:items-center">
        {STORY_STEPS.map((s, i) => {
          const a = auc(m, s.key);
          const active = s.key === sel;
          const dd = i > 0 ? deltas[i - 1] : null;
          return (
            <li key={s.key} className="contents">
              {dd && <Connector delta={dd.p?.delta ?? null} lo={dd.p?.ci95[0] ?? null} hi={dd.p?.ci95[1] ?? null} big={dd.to === big} />}
              <button
                type="button"
                onClick={() => setSel(s.key)}
                aria-pressed={active}
                className={cn(
                  "flex-1 rounded-lg border-2 bg-paper px-4 py-4 text-left transition-[border-color,box-shadow] duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-[132px]",
                  active ? "border-finding shadow-[0_6px_24px_-14px_color-mix(in_oklab,var(--ink)_35%,transparent)]" : "border-rule hover:border-rule-strong",
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "num flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold",
                      active ? "bg-finding text-paper" : "border border-rule-strong text-ink-2",
                    )}
                  >
                    {s.code}
                  </span>
                  <span className="text-[14.5px] leading-tight font-semibold text-ink">{s.title}</span>
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="num text-[24px] leading-none font-semibold text-ink">{fmtNum(a, 3)}</span>
                  <span className="text-[11.5px] text-ink-3">ROC-AUC</span>
                </div>
                <div className="mt-1 text-[11.5px] text-ink-3">
                  {s.key === "A_stat" ? "our approximation" : s.key === "C_sf_maia" ? "adds the human model" : "XGBoost"}
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      <div key={sel} className="reveal mt-6 grid gap-x-8 gap-y-5 rounded-lg border border-rule bg-paper p-5 sm:p-6 md:grid-cols-2">
        <Field k="What was added">{step.added}</Field>
        <Field k="Why it was added">{step.why}</Field>
        <Field k="Measured change">
          {d?.p ? (
            <>
              <span className="num text-[20px] font-semibold text-ink">{signed3(d.p.delta)}</span> ROC-AUC versus {STORY_STEPS[idx - 1].code}{" "}
              <span className="num text-ink-3">
                ({fmtNum(auc(m, d.from), 3)} → {fmtNum(auc(m, sel), 3)})
              </span>
            </>
          ) : (
            <>
              Reference point: ROC-AUC <span className="num font-semibold text-ink">{fmtNum(auc(m, sel), 3)}</span>. Probability that a
              substituted variant scores above an original game; 0.5 = chance.
            </>
          )}
        </Field>
        <Field k="Uncertainty">
          {d?.p ? (
            <>
              Paired 95% CI <span className="num font-medium text-ink">{signed3(d.p.ci95[0])} to {signed3(d.p.ci95[1])}</span>
              {d.verdict === "positive" ? ", which excludes 0." : ", which includes 0, so no gain is established."} Resamples whole test
              source games ({fmtInt(m.paired_auc_bootstrap?.n_boot)} resamples, the same for both systems).
            </>
          ) : (
            <>
              95% cluster-bootstrap interval <span className="num font-medium text-ink">{fmtCI(ci(m, sel))}</span>, resampling test
              source games.
            </>
          )}
        </Field>
      </div>
    </div>
  );
}

function Connector({ delta, lo, hi, big }: { delta: number | null; lo: number | null; hi: number | null; big: boolean }) {
  return (
    <div
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center gap-2 py-2 lg:w-[118px] lg:flex-col lg:gap-1 lg:py-0", big ? "text-finding" : "text-ink-3")}
    >
      <ArrowDown className={cn("lg:hidden", big ? "size-6" : "size-4")} strokeWidth={big ? 2.75 : 2} />
      <ArrowRight className={cn("hidden lg:block", big ? "size-7" : "size-5")} strokeWidth={big ? 2.75 : 2} />
      {isNum(delta) && (
        <div className="text-center leading-tight">
          <div className={cn("num", big ? "text-[16px] font-bold" : "text-[13px] font-medium")}>{signed3(delta)}</div>
          {isNum(lo) && isNum(hi) && (
            <div className="num text-[10.5px] text-ink-3">
              {signed3(lo)} to {signed3(hi)}
            </div>
          )}
          {big && <div className="mt-0.5 text-[10px] font-semibold tracking-[0.08em] uppercase">largest step</div>}
        </div>
      )}
    </div>
  );
}

function Field({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">{k}</div>
      <div className="mt-1 text-[14.5px] leading-relaxed text-ink-2">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ key finding */

export function KeyFinding({ m }: { m: Metrics }) {
  const big = largestStep(m);
  const deltas = storyDeltas(m);
  const bc = deltas.find((d) => d.to === "C_sf_maia");
  const isMaia = big === "C_sf_maia" && bc?.verdict === "positive";
  return (
    <div className="rounded-xl border-2 border-[color-mix(in_oklab,var(--prov-finding)_50%,var(--rule))] bg-paper p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-2">
        <Prov kind="finding" />
        <span className="text-[12px] font-semibold tracking-[0.08em] text-ink-3 uppercase">The key finding</span>
      </div>
      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
        <div>
          <p className="font-serif text-[24px] leading-snug text-ink sm:text-[30px]">
            {isMaia
              ? "In this controlled benchmark, adding the learned human-move model produced the largest incremental AUC increase."
              : "In this controlled benchmark, the human-move step was not the largest incremental change."}
          </p>
          {bc?.p && (
            <p className="mt-4 text-[15px] text-ink-2">
              B → C (+ Maia-3): <span className="num text-[20px] font-semibold text-ink">{signed3(bc.p.delta)}</span> ROC-AUC · paired 95% CI{" "}
              <span className="num font-medium text-ink">
                {signed3(bc.p.ci95[0])} to {signed3(bc.p.ci95[1])}
              </span>
            </p>
          )}
        </div>
        <IncrementChart m={m} />
      </div>
      <div role="note" className="mt-6 flex gap-3 rounded-md border border-rule-strong bg-paper-2 px-4 py-3 text-[13.5px] leading-relaxed text-ink-2">
        <span aria-hidden className="mt-[3px] font-semibold text-ink">!</span>
        <p>
          <span className="font-semibold text-ink">Caveat. </span>
          {pairedCaveat(m)} The benchmark is synthetic; this is not evidence about real players.
        </p>
      </div>
    </div>
  );
}

/** Three incremental steps with paired 95% CI whiskers; zero line; the largest step emphasized. */
function IncrementChart({ m }: { m: Metrics }) {
  const rows = storyDeltas(m).filter((d) => d.p);
  const big = largestStep(m);
  const code = (k: ModelKey) => STORY_STEPS.find((s) => s.key === k)!.code;
  const hi = Math.max(0.01, ...rows.map((r) => r.p!.ci95[1])) * 1.08;
  const lo = Math.min(0, ...rows.map((r) => r.p!.ci95[0]));
  const pos = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const ticks = [0, 0.02, 0.04].filter((t) => t <= hi);
  return (
    <figure className="min-w-0">
      <figcaption className="mb-3 text-[12.5px] font-medium text-ink">Change in ROC-AUC at each step</figcaption>
      <div className="space-y-3">
        {rows.map((r) => {
          const p = r.p!;
          const isBig = r.to === big;
          const tip = `${code(r.from)} → ${code(r.to)}: ${signed3(p.delta)} ROC-AUC, paired 95% CI ${signed3(p.ci95[0])} to ${signed3(p.ci95[1])}`;
          return (
            <div key={r.to} className="grid grid-cols-[3.25rem_minmax(0,1fr)_3.5rem] items-center gap-3" title={tip}>
              <span className={cn("num text-[13px]", isBig ? "font-semibold text-ink" : "text-ink-2")}>
                {code(r.from)} → {code(r.to)}
              </span>
              <div className="relative h-7" aria-hidden>
                <div className="absolute inset-y-0 w-px bg-ink-3" style={{ left: pos(0) }} />
                <div
                  className="absolute top-1/2 h-4 -translate-y-1/2 rounded-r-[4px]"
                  style={{
                    left: pos(0),
                    width: `calc(${pos(p.delta)} - ${pos(0)})`,
                    background: isBig ? "var(--prov-finding)" : "color-mix(in oklab, var(--prov-finding) 40%, var(--paper))",
                  }}
                />
                <div className="absolute top-1/2 h-px -translate-y-1/2 bg-ink" style={{ left: pos(p.ci95[0]), width: `calc(${pos(p.ci95[1])} - ${pos(p.ci95[0])})` }} />
                <div className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-ink" style={{ left: pos(p.ci95[0]) }} />
                <div className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-ink" style={{ left: pos(p.ci95[1]) }} />
              </div>
              <span className={cn("num text-right text-[13px]", isBig ? "font-semibold text-ink" : "text-ink-2")}>{signed3(p.delta)}</span>
            </div>
          );
        })}
        <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_3.5rem] gap-3">
          <span />
          <div className="relative h-4">
            {ticks.map((t) => (
              <span key={t} className="num absolute -translate-x-1/2 text-[10.5px] text-ink-4" style={{ left: pos(t) }}>
                {t === 0 ? "0" : `+${t.toFixed(2)}`}
              </span>
            ))}
          </div>
          <span />
        </div>
      </div>
      <p className="mt-1 text-[11.5px] text-ink-3">Bar = paired difference · whisker = paired 95% CI</p>
      <div className="sr-only">
      <table>
        <caption>Paired bootstrap change in ROC-AUC for each incremental step</caption>
        <thead>
          <tr>
            <th>Step</th>
            <th>Change</th>
            <th>95% CI low</th>
            <th>95% CI high</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.to}>
              <td>
                {code(r.from)} to {code(r.to)}
              </td>
              <td>{signed3(r.p!.delta)}</td>
              <td>{signed3(r.p!.ci95[0])}</td>
              <td>{signed3(r.p!.ci95[1])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}

/* ------------------------------------------------------------------ three findings */

export function FindingCards({ m }: { m: Metrics }) {
  const fs = headlineFindings(m);
  return (
    <div>
      <h3 className="font-serif text-[22px] font-semibold tracking-tight text-ink">Three findings</h3>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {fs.map((f, i) => (
          <article key={f.id} className={cn("flex flex-col rounded-lg border bg-paper p-5", i === 0 ? "border-finding/60 border-2" : "border-rule-strong")}>
            <div className="text-[12px] font-semibold tracking-[0.08em] text-finding uppercase">Finding {i + 1}</div>
            <h4 className="mt-2 font-serif text-[19px] leading-snug font-semibold text-ink">{f.title}</h4>
            <dl className="mt-4 space-y-3 text-[13.5px] leading-relaxed">
              <Row k="Evidence" v={f.evidence} strong />
              <Row k="Interpretation" v={f.interpretation} />
              <Row k="Limitation" v={f.limitation} muted />
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}

function Row({ k, v, strong, muted }: { k: string; v: string; strong?: boolean; muted?: boolean }) {
  return (
    <div>
      <dt className="text-[10.5px] font-semibold tracking-[0.07em] text-ink-3 uppercase">{k}</dt>
      <dd className={cn("mt-0.5", strong ? "tnum text-ink" : muted ? "text-ink-3" : "text-ink-2")}>{v}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ low FPR (expert) */

export function LowFpr({ m }: { m: Metrics }) {
  const rows = lowFprRows(m);
  const nNeg = m.dataset?.n_player_games?.test;
  const code: Record<string, string> = { A_stat: "A", B_sf: "B", C_sf_maia: "C", D_sf_maia_seq: "D" };
  const c = rows.find((r) => r.key === "C_sf_maia"), d = rows.find((r) => r.key === "D_sf_maia_seq");
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-serif text-[22px] font-semibold tracking-tight text-ink">At a strict false-alarm target</h3>
        <span className="rounded-full border border-rule-strong px-2 py-0.5 text-[10.5px] font-semibold tracking-[0.07em] text-ink-3 uppercase">
          Expert detail
        </span>
      </div>
      <p className="mt-1 max-w-3xl text-[14px] leading-relaxed text-ink-2">
        Each system&apos;s threshold was set on validation original games for a {fmtPct(rows[0]?.target, 0)} false-alarm target, then
        applied once to the test set. The realized false-alarm rate on test differs by system.
      </p>
      <div className="scroll-x mt-4 rounded-md border border-rule">
        <table className="table-lab min-w-[520px]">
          <caption className="sr-only">Recall and realized test false-positive rate at a 1% validation target</caption>
          <thead>
            <tr>
              <th scope="col">System</th>
              <th scope="col" className="r">
                <span className="inline-flex items-center gap-1">
                  Recall
                  <InfoTip>Share of substituted test variants above the threshold.</InfoTip>
                </span>
              </th>
              <th scope="col" className="r">
                <span className="inline-flex items-center gap-1">
                  Realized FPR
                  <InfoTip>Share of original test player-games above the threshold.</InfoTip>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row" className="!font-normal">
                  <span className="num mr-2 font-semibold">{code[r.key]}</span>
                  {STORY_STEPS.find((s) => s.key === r.key)?.title}
                </th>
                <td className="r num text-ink">{fmtPct(r.recall, 1)}</td>
                <td className="r num text-ink">{fmtPct(r.testFpr, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-ink-2">
        <span className="font-semibold text-ink">Do not rank C and D by recall alone.</span> C reached {fmtPct(c?.recall, 1)} recall at a
        realized FPR of {fmtPct(c?.testFpr, 1)}; D reached {fmtPct(d?.recall, 1)} at {fmtPct(d?.testFpr, 1)}. They operate at different
        false-alarm rates, so the comparison is not like-for-like.
        {isNum(nNeg) && ` Realized FPR is measured on ${nNeg} original test player-games, so each false alarm moves it by ${fmtPct(1 / nNeg, 2)}.`}{" "}
        Recall differences at this operating point were not significance-tested.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ why it may matter */

export function WhyItMatters() {
  return (
    <div>
      <h3 className="font-serif text-[26px] font-semibold tracking-tight text-ink sm:text-[30px]">Why this may be worth investigating further</h3>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Opportunity n={1} icon={<UsersRound className="size-5" />} title="Learned human prior">
          Maia-3 provides a modern learned estimate of what similarly rated humans tend to play.
        </Opportunity>
        <Opportunity n={2} icon={<Layers className="size-5" />} title="Complementary signal">
          The largest incremental gain in this benchmark appeared when the human-model signal was introduced.
        </Opportunity>
      </div>
      <div className="mt-4 rounded-xl border-2 border-regan bg-tint-regan p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-regan text-paper">
            <Compass className="size-5" />
          </span>
          <div>
            <div className="text-[12px] font-semibold tracking-[0.09em] text-regan uppercase">3 · Next validation</div>
            <div className="text-[13px] text-ink-3">The scientifically useful next step</div>
          </div>
        </div>
        <p className="mt-4 max-w-4xl font-serif text-[22px] leading-snug text-ink sm:text-[27px]">
          The next scientifically useful experiment would be to evaluate whether these learned features add information when combined
          with Professor Regan&apos;s actual reference/calibration framework.
        </p>
      </div>
    </div>
  );
}

function Opportunity({ n, icon, title, children }: { n: number; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-rule-strong bg-paper p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-tint-ours text-ours">
          {icon}
        </span>
        <div className="text-[12px] font-semibold tracking-[0.09em] text-ink-2 uppercase">
          {n} · {title}
        </div>
      </div>
      <p className="mt-3 text-[16px] leading-relaxed text-ink">{children}</p>
    </div>
  );
}
