"use client";

import { AucForest } from "@/components/lab/auc-forest";
import { PairedDiffs } from "@/components/lab/paired-diffs";
import { BaselineCalibration } from "@/components/projected/calibration";
import { AucByBand, AucByLevel, CalibrationPlot, EventPower, GlobalShap, RegressionPlot, RocChart, ScoreHistograms } from "@/components/lab/charts";
import { DownloadButton, LoadState } from "@/components/site/atoms";
import { Figure, Section } from "@/components/site/page";
import { Prov } from "@/components/site/provenance";
import { DATA, useMetrics, useRoc } from "@/lib/data";
import { downloadCsv } from "@/lib/export";
import { MODEL_META, SCORE_ORDER, STRATEGY_TEXT } from "@/lib/features";
import { buildFindings, ciOverlap, paired, pseudoEventSummary, stepVerdict, type Finding } from "@/lib/findings";
import { fmtCI, fmtInt, fmtLevel, fmtNum, fmtPP, fmtPct, fmtSigned, isNum } from "@/lib/format";
import type { Metrics, ScoreKey } from "@/lib/types";

const STEP_TEXT: Record<string, string> = {
  A_stat: "Fitting a linear model on all aggregate statistics (A) instead of z(top-1) alone (A0)",
  B_sf: "Adding nonlinear Stockfish aggregates with gradient boosting (B)",
  C_sf_maia: "Adding Maia-3 human-move features (C)",
  D_sf_maia_seq: "Adding sequence and criticality features (D)",
};

function tpr(m: Metrics, k: ScoreKey, fpr: number) {
  return m.experiments[k]?.classifier.tpr_at_fpr?.find((t) => Math.abs(t.target_fpr - fpr) < 1e-9);
}

/** One sentence per step: the numerical change, then the paired evidence, then the (visual-only) overlap note. */
function stepSentences(m: Metrics): string[] {
  const out: string[] = [];
  const sg = (x: number) => (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(3);
  for (let i = 1; i < SCORE_ORDER.length; i++) {
    const prevK = SCORE_ORDER[i - 1];
    const k = SCORE_ORDER[i];
    const a = m.experiments[prevK]?.classifier;
    const b = m.experiments[k]?.classifier;
    if (!a || !b || !isNum(a.roc_auc) || !isNum(b.roc_auc)) continue;
    const d = b.roc_auc - a.roc_auc;
    let s = `${STEP_TEXT[k]} changed ROC-AUC by ${fmtSigned(d, 3)} (${fmtNum(a.roc_auc, 3)} → ${fmtNum(b.roc_auc, 3)}).`;
    const p = paired(m, prevK, k);
    const v = stepVerdict(m, prevK, k);
    if (p) {
      s += ` Paired 95% interval ${sg(p.ci95[0])} to ${sg(p.ci95[1])}: ${
        v === "positive" ? "excludes 0" : v === "negative" ? "entirely below 0" : "includes 0, so no gain is established"
      }.`;
    } else {
      s += " The paired difference was not tested.";
    }
    const o = ciOverlap(m, prevK, k);
    if (o !== null) s += ` (Individual intervals ${o ? "overlap" : "do not overlap"} — a visual comparison only.)`;
    out.push(s);
  }
  return out;
}

const FIGURES = [
  { file: "roc_pooled", title: "Pooled test ROC curves" },
  { file: "auc_by_level", title: "ROC-AUC by substitution level, per strategy" },
  { file: "event_power", title: "Exploratory pseudo-event pooling of different-player games" },
  { file: "baseline_calibration", title: "Distribution of the Regan-inspired z(top-1) on original test games" },
  { file: "regression_by_level", title: "Assistance estimate vs realized substituted fraction, by level" },
];

export function ExpertEvidence() {
  const { data: m, error } = useMetrics();
  const roc = useRoc();
  if (!m) return <LoadState error={error} />;
  const ds = m.dataset ?? {};
  const keys = SCORE_ORDER.filter((k) => m.experiments[k]);
  const pseudo = pseudoEventSummary(m);
  const further = buildFindings(m).filter((f) => !["human-model", "sequence", "low-fpr", "engine-nonlinear"].includes(f.id));
  const pairedCsv = () =>
    downloadCsv(
      "chessassistlens-paired-auc-differences.csv",
      ["from", "to", "delta_auc", "ci95_lo", "ci95_hi", "share_resamples_le_0", "n_boot", "cluster"],
      (m.paired_auc_bootstrap?.comparisons ?? []).map((c) => [
        c.from, c.to, c.delta, c.ci95[0], c.ci95[1], c.share_le_0, m.paired_auc_bootstrap?.n_boot, m.paired_auc_bootstrap?.cluster,
      ]),
    );

  const ablationCsv = () =>
    downloadCsv(
      "chessassistlens-ablation.csv",
      [
        "model",
        "label",
        "n_features",
        "roc_auc",
        "roc_auc_ci_lo",
        "roc_auc_ci_hi",
        "pr_auc",
        "tpr_at_fpr_1pct",
        "test_fpr_1pct",
        "threshold_1pct",
        "tpr_at_fpr_5pct",
        "test_fpr_5pct",
        "threshold_5pct",
        "brier",
        "mae",
        "rmse",
      ],
      keys.map((k) => {
        const e = m.experiments[k]!;
        const t1 = tpr(m, k, 0.01);
        const t5 = tpr(m, k, 0.05);
        return [
          k,
          e.label ?? MODEL_META[k].name,
          e.n_features,
          e.classifier.roc_auc,
          e.classifier.roc_auc_ci95?.[0],
          e.classifier.roc_auc_ci95?.[1],
          e.classifier.pr_auc,
          t1?.tpr,
          t1?.test_fpr,
          t1?.threshold,
          t5?.tpr,
          t5?.test_fpr,
          t5?.threshold,
          e.classifier.brier,
          e.regressor?.mae,
          e.regressor?.rmse,
        ];
      }),
    );

  // best value per column (for emphasis only)
  const best = (f: (k: ScoreKey) => number | null | undefined, lower = false) => {
    let bk: ScoreKey | null = null;
    let bv = lower ? Infinity : -Infinity;
    for (const k of keys) {
      const v = f(k);
      if (isNum(v) && (lower ? v < bv : v > bv)) {
        bv = v;
        bk = k;
      }
    }
    return bk;
  };
  const bestAuc = best((k) => m.experiments[k]?.classifier.roc_auc);
  const bestPr = best((k) => m.experiments[k]?.classifier.pr_auc);
  const bestBrier = best((k) => m.experiments[k]?.classifier.brier, true);
  const bestMae = best((k) => m.experiments[k]?.regressor?.mae, true);
  const bestRmse = best((k) => m.experiments[k]?.regressor?.rmse, true);
  const em = (cond: boolean) => (cond ? "font-semibold text-ink" : "text-ink-2");

  const steps = stepSentences(m);
  const dm = m.decision_model;

  return (
    <div>
      {/* Dataset */}
      <Section
        title="Dataset"
        kicker="Player-disjoint split, variants created after splitting"
        description="Units are nested, not independent: each source game gives up to two player-games (one per colour), and each player-game gives one original row plus 15 substituted variants. All intervals therefore resample whole source games."
      >
        <div className="scroll-x rounded-md border border-rule">
          <table className="table-lab min-w-[640px]">
            <caption className="sr-only">Sample sizes per split</caption>
            <thead>
              <tr>
                <th scope="col">Split</th>
                <th scope="col" className="r">Source games</th>
                <th scope="col" className="r">Original player-games</th>
                <th scope="col" className="r">Injected variants</th>
                <th scope="col" className="r">Rows incl. originals</th>
              </tr>
            </thead>
            <tbody>
              {(["train", "val", "test"] as const).map((sp) => {
                const pg = ds.n_player_games?.[sp], rows = ds.n_variants?.[sp];
                return (
                  <tr key={sp}>
                    <th scope="row" className="capitalize">{sp === "val" ? "validation" : sp}</th>
                    <td className="r num">{fmtInt(ds.n_source_games?.[sp])}</td>
                    <td className="r num">{fmtInt(pg)}</td>
                    <td className="r num">{isNum(rows) && isNum(pg) ? fmtInt(rows - pg) : "—"}</td>
                    <td className="r num">{fmtInt(rows)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">
          Mean eligible decisions per player-game: {fmtNum(ds.mean_decisions_per_player_game, 1)}. Original player-games are
          presumed human with no assistance injected by us; that they contain no real assistance is not established. ·{" "}
          Substitution levels {(ds.levels ?? []).map((l) => fmtLevel(l)).join(", ") || "—"} · strategies{" "}
          {(ds.strategies ?? []).map((s) => STRATEGY_TEXT[s]?.name ?? s).join(", ") || "—"} · test player-games by Elo band:{" "}
          {Object.entries(ds.bands_test ?? {})
            .sort()
            .map(([b, n]) => `${b}: ${n}`)
            .join(", ") || "—"}
          {m.analysis && (
            <>
              {" "}
              · analysis: {m.analysis.engine ?? "—"} depth {m.analysis.depth ?? "—"}, MultiPV {m.analysis.multipv ?? "—"};{" "}
              {m.analysis.maia_model ?? "—"}
            </>
          )}
          .
        </p>
      </Section>

      {/* Ablation */}
      <Section
        title="Ablation: what each layer adds"
        kicker="Test split · original vs substituted variants"
        actions={<DownloadButton onClick={ablationCsv}>Download CSV</DownloadButton>}
        description="All metrics use balanced class weights. TPR thresholds are chosen on validation original games for the target false-positive rate; the realized test FPR is shown beneath each TPR and differs by system. ROC-AUC intervals are 95% cluster-bootstrap intervals resampling source games."
      >
        <div className="scroll-x rounded-md border border-rule">
          <table className="table-lab min-w-[900px]">
            <caption className="sr-only">Full ablation metrics on the held-out test split</caption>
            <thead>
              <tr>
                <th scope="col">Model</th>
                <th scope="col" className="r">Features</th>
                <th scope="col" className="r">ROC-AUC</th>
                <th scope="col" className="r">95% CI</th>
                <th scope="col" className="r">PR-AUC</th>
                <th scope="col" className="r">TPR @ 1% target</th>
                <th scope="col" className="r">TPR @ 5% target</th>
                <th scope="col" className="r">Brier</th>
                <th scope="col" className="r">Intensity MAE</th>
                <th scope="col" className="r">Intensity RMSE</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const e = m.experiments[k]!;
                const c = e.classifier;
                const t1 = tpr(m, k, 0.01);
                const t5 = tpr(m, k, 0.05);
                return (
                  <tr key={k}>
                    <td>
                      <div className="flex items-start gap-2">
                        <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: MODEL_META[k].color }} />
                        <div>
                          <div className="text-ink">
                            <span className="num mr-1.5 text-ink-3">{MODEL_META[k].code}</span>
                            {e.label ?? MODEL_META[k].name}
                          </div>
                          <div className="text-[11.5px] text-ink-3">
                            {e.model ?? (k === "A0_zt1" ? "no training on labels" : "")}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="r num text-ink-3">{e.n_features ?? "—"}</td>
                    <td className={`r num ${em(k === bestAuc)}`}>{fmtNum(c.roc_auc, 3)}</td>
                    <td className="r num text-ink-3">{fmtCI(c.roc_auc_ci95)}</td>
                    <td className={`r num ${em(k === bestPr)}`}>{fmtNum(c.pr_auc, 3)}</td>
                    <td className="r">
                      <div className="num text-ink-2">{fmtPct(t1?.tpr, 1)}</div>
                      <div className="num text-[10.5px] text-ink-3">test FPR {fmtPct(t1?.test_fpr, 1)}</div>
                    </td>
                    <td className="r">
                      <div className="num text-ink-2">{fmtPct(t5?.tpr, 1)}</div>
                      <div className="num text-[10.5px] text-ink-3">test FPR {fmtPct(t5?.test_fpr, 1)}</div>
                    </td>
                    <td className={`r num ${em(k === bestBrier)}`}>{fmtNum(c.brier, 3)}</td>
                    <td className={`r num ${em(k === bestMae)}`}>{fmtPP(e.regressor?.mae)}</td>
                    <td className={`r num ${em(k === bestRmse)}`}>{fmtPP(e.regressor?.rmse)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3">
          Bold marks the best value in ROC-AUC, PR-AUC, Brier and the intensity errors (in percentage points). TPR columns are not
          ranked: each system&apos;s validation-set threshold produced a different realized test FPR, so recall alone does not order
          them (D&apos;s lower recall than C&apos;s at the 1% target comes with a lower realized FPR). A0 is a single z-statistic, so it
          has no Brier score or regressor (—). Brier is computed on scores that are similarity measures, not probabilities of cheating.
        </p>
      </Section>

      {/* Incremental value */}
      <Section
        title="Incremental value of each layer"
        kicker="Numerical change and paired evidence, reported separately"
        description={
          m.paired_auc_bootstrap
            ? `Paired source-game cluster bootstrap on the saved held-out predictions (${fmtInt(m.paired_auc_bootstrap.n_boot)} resamples of ${fmtInt(m.paired_auc_bootstrap.n_clusters)} test source games; the same resample is used for both systems). Post hoc: no model was refitted and nothing was tuned on test data. ${fmtInt(m.paired_auc_bootstrap.comparisons.length)} comparisons without multiplicity correction; the intervals cover resampling of test games, not variation from refitting the models.`
            : "Paired differences were not tested in this export."
        }
        actions={m.paired_auc_bootstrap ? <DownloadButton onClick={pairedCsv}>Download CSV</DownloadButton> : undefined}
      >
        <div className="grid items-start gap-8 lg:grid-cols-2">
          <Figure title="Paired differences in ROC-AUC">
            <PairedDiffs metrics={m} />
          </Figure>
          <Figure
            title="Each system's own ROC-AUC and 95% interval"
            caption="For reference. Overlap of these individual intervals is a visual comparison: it does not show “no gain”, and non-overlap is not a paired test."
          >
            <AucForest metrics={m} keys={keys} showDelta />
          </Figure>
        </div>
        <ol className="mt-6 max-w-4xl space-y-3 text-[13.5px] leading-relaxed text-ink-2">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="num mt-0.5 text-[11px] text-ink-4">{String(i + 1).padStart(2, "0")}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Further findings" kicker="Generated from the measured results" actions={<Prov kind="finding" />}>
        <div className="grid gap-4 lg:grid-cols-2">
          {further.map((f) => (
            <FindingCard key={f.id} f={f} />
          ))}
        </div>
      </Section>

      {roc.data && (
        <Section title="ROC curves" kicker="Pooled test split">
          <RocChart roc={roc.data} metrics={m} />
        </Section>
      )}

      <Section title="Where the models differ" kicker="Strategy, level and rating">
        <div className="space-y-6">
          <AucByLevel metrics={m} />
          <div className="grid gap-6 lg:grid-cols-2">
            <AucByBand metrics={m} />
            <ScoreHistograms metrics={m} />
          </div>
        </div>
      </Section>

      <Section
        title="How do the baseline z-scores behave on original games?"
        kicker="Held-out original test player-games"
        description="κ is chosen so that z has unit variance on validation original games, so a mean near 0 and SD near 1 are expected by construction. The tails are the informative part, and with this sample they rest on a few games."
      >
        <BaselineCalibration metrics={m} />
      </Section>

      <Section title="Calibration and assistance estimates" kicker="Classifier and regressor">
        <div className="grid gap-6 lg:grid-cols-2">
          <CalibrationPlot metrics={m} />
          <RegressionPlot metrics={m} />
        </div>
      </Section>

      <Section title="What the models rely on" kicker="Game-level SHAP">
        <GlobalShap metrics={m} />
      </Section>

      <Section title="Exploratory pooling of different-player games" kicker="Pseudo-events · not a longitudinal result">
        {pseudo && (
          <div className="mb-5 grid gap-4 rounded-md border border-rule bg-paper-2 p-4 text-[13px] leading-relaxed md:grid-cols-2">
            <div>
              <div className="text-[10.5px] font-semibold tracking-[0.06em] text-ink-3 uppercase">Result</div>
              <p className="mt-0.5 text-ink">{pseudo.evidence}</p>
              <p className="mt-1 text-ink-2">{pseudo.interpretation}</p>
            </div>
            <div>
              <div className="text-[10.5px] font-semibold tracking-[0.06em] text-ink-3 uppercase">Limitation</div>
              <p className="mt-0.5 text-ink-2">{pseudo.limitation}</p>
            </div>
          </div>
        )}
        <EventPower metrics={m} />
      </Section>

      <Section
        title="Figures and data for further research"
        kicker="Downloads"
        description="Static figures rendered by the research pipeline from the same test-set predictions, and the exported data files this site reads."
      >
        <ul className="divide-y divide-rule rounded-md border border-rule">
          {[
            { href: DATA.metrics, title: "All exported metrics (metrics.json)" },
            { href: DATA.provenance, title: "Provenance record: file hashes, split counts, consistency checks (provenance.json)" },
            { href: DATA.roc, title: "ROC curve points (roc_curves.json)" },
          ].map((f) => (
            <li key={f.href} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="text-[13.5px] text-ink-2">{f.title}</span>
              <DownloadButton href={f.href} download>
                JSON
              </DownloadButton>
            </li>
          ))}
          {FIGURES.map((f) => (
            <li key={f.file} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="text-[13.5px] text-ink-2">{f.title}</span>
              <span className="flex gap-2">
                <DownloadButton href={`/figures/${f.file}.svg`} download>
                  SVG
                </DownloadButton>
                <DownloadButton href={`/figures/${f.file}.png`} download>
                  PNG
                </DownloadButton>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {dm && (
        <Section
          title="Decision-level explanation model"
          kicker="Used for per-move explanations"
          description="A separate XGBoost classifier, trained on single decisions (label: was this decision substituted?), scores individual moves for resemblance to a synthetic substitution. It is used only to rank and explain moves. Game-level scores do not depend on it, and its per-move SHAP values are not a decomposition of the game-level classifier."
        >
          <div className="grid gap-px overflow-hidden rounded-md border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-paper p-4">
              <div className="eyebrow">Test ROC-AUC</div>
              <div className="num mt-1 text-[22px] text-ink">{fmtNum(dm.test_roc_auc, 3)}</div>
            </div>
            <div className="bg-paper p-4">
              <div className="eyebrow">Test PR-AUC</div>
              <div className="num mt-1 text-[22px] text-ink">{fmtNum(dm.test_pr_auc, 3)}</div>
              <div className="text-[12px] text-ink-3">positive rate {fmtPct(dm.test_pos_rate, 1)}</div>
            </div>
            <div className="bg-paper p-4">
              <div className="eyebrow">ROC-AUC by strategy</div>
              <div className="mt-1 space-y-0.5 text-[12.5px]">
                {Object.entries(dm.by_strategy ?? {}).map(([s, v]) => (
                  <div key={s} className="flex justify-between gap-3">
                    <span className="text-ink-3">{STRATEGY_TEXT[s]?.name ?? s}</span>
                    <span className="num text-ink">{fmtNum(v, 3)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-paper p-4">
              <div className="eyebrow">Training levels</div>
              <div className="num mt-1 text-[15px] text-ink">{(dm.levels_used ?? []).map((l) => fmtLevel(l)).join(", ") || "—"}</div>
              <div className="text-[12px] text-ink-3">{dm.features?.length ?? "—"} per-decision features</div>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}

function FindingCard({ f }: { f: Finding }) {
  return (
    <article className="rounded-md border border-rule bg-paper p-5">
      <h3 className="font-serif text-[16.5px] leading-snug font-semibold text-ink">{f.title}</h3>
      <dl className="mt-3 space-y-2 text-[13px] leading-relaxed">
        {(
          [
            ["Evidence", f.evidence, "text-ink"],
            ["Interpretation", f.interpretation, "text-ink-2"],
            ["Limitation", f.limitation, "text-ink-3"],
          ] as const
        ).map(([k, v, cls]) => (
          <div key={k}>
            <dt className="text-[10.5px] font-semibold tracking-[0.06em] text-ink-3 uppercase">{k}</dt>
            <dd className={`mt-0.5 ${cls}`}>{v}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
