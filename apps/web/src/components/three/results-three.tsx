"use client";

import { Check, Minus } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { fmtNum, fmtPct, isNum } from "@/lib/format";
import { useJson } from "@/lib/data";
import {
  DATA3,
  MODEL_META,
  threeModelFindings,
  verdict,
  type AssistResults,
  type Comparison,
  type Finding,
  type MovePrediction,
  type ThreeBootstrap,
} from "@/lib/three";
import { cn } from "@/lib/utils";
import { ModelBadge } from "./atoms";

type Tab = "human" | "assistance";

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

const COLS: { key: string; model: "R" | "Q" | "M" | null; label: string }[] = [
  { key: "R", model: "R", label: "Regan-inspired" },
  { key: "Q", model: "Q", label: "Qwen3-8B-Base" },
  { key: "M", model: "M", label: "Maia-3 79M" },
  { key: "M5", model: null, label: "Maia-3 5M (secondary)" },
];

const T1_ROWS: { key: string; label: string; fmt: (x: number) => string; better: string }[] = [
  { key: "top1_accuracy", label: "Top-1 move accuracy", fmt: (x) => fmtPct(x, 1), better: "higher" },
  { key: "top3_accuracy", label: "Top-3 move accuracy", fmt: (x) => fmtPct(x, 1), better: "higher" },
  { key: "mean_nll", label: "Mean negative log-likelihood (nats)", fmt: (x) => fmtNum(x, 3), better: "lower" },
  { key: "brier_multiclass", label: "Brier score (multi-class)", fmt: (x) => fmtNum(x, 3), better: "lower" },
  { key: "mean_rank", label: "Mean rank of the played move", fmt: (x) => fmtNum(x, 2), better: "lower" },
  { key: "median_rank", label: "Median rank (descriptive)", fmt: (x) => fmtNum(x, 0), better: "lower" },
  { key: "t1_event_logloss", label: "Engine-first-move event: log-loss", fmt: (x) => fmtNum(x, 3), better: "lower" },
  { key: "t1_event_brier", label: "Engine-first-move event: Brier", fmt: (x) => fmtNum(x, 3), better: "lower" },
  { key: "t3_event_logloss", label: "Engine-top-3 event: log-loss", fmt: (x) => fmtNum(x, 3), better: "lower" },
];

const NAME: Record<string, string> = { R: "Regan-inspired", Q: "Qwen3-8B-Base", Q0: "Qwen (position-only)", M: "Maia-3 79M", M5: "Maia-3 5M" };

export function ResultsThree() {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => "");
  const [chosen, setTab] = useState<Tab | null>(null);
  const tab: Tab = chosen ?? (hash === "#assistance" ? "assistance" : "human");
  const mp = useJson<MovePrediction>(DATA3.movePrediction).data;
  const ar = useJson<AssistResults>(DATA3.assistance).data;
  const bs = useJson<ThreeBootstrap>(DATA3.bootstrap).data;
  const findings = threeModelFindings(bs);
  return (
    <div>
      <div role="tablist" aria-label="Results" className="flex flex-wrap gap-2 border-b border-rule">
        {([["human", "Who Predicts Human Moves Best?"], ["assistance", "Who Best Responds to Controlled Assistance?"]] as const).map(([k, l]) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} id={`tab-${k}`} aria-controls={`panel-${k}`}
            onClick={() => { setTab(k); if (typeof window !== "undefined") history.replaceState(null, "", k === "assistance" ? "#assistance" : "#human"); }}
            className={cn("-mb-px border-b-2 px-3 py-2.5 text-[14px] font-semibold transition-colors sm:text-[15px]",
              tab === k ? "border-ink text-ink" : "border-transparent text-ink-3 hover:text-ink")}>
            {l}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-8">
        {tab === "human" ? <HumanTab mp={mp} bs={bs} findings={findings.filter((f) => f.id.startsWith("task1"))} /> : <AssistTab ar={ar} bs={bs} findings={findings.filter((f) => f.id.startsWith("task2"))} />}
      </div>
    </div>
  );
}

function Cell({ status, value, ci, fmt, undef }: { status?: string; value?: number | null; ci?: [number, number]; fmt: (x: number) => string; undef?: boolean }) {
  if (status === "pending") return <span className="text-ink-4 italic">pending</span>;
  if (undef || !isNum(value)) return <span className="text-ink-4 italic">not defined</span>;
  return (
    <span className="num">
      <span className="font-semibold text-ink">{fmt(value)}</span>
      {ci && <span className="block text-[11px] text-ink-3">[{fmt(ci[0])}, {fmt(ci[1])}]</span>}
    </span>
  );
}

function HumanTab({ mp, bs, findings }: { mp?: MovePrediction; bs?: ThreeBootstrap; findings: Finding[] }) {
  if (!mp) return <p className="text-[13px] text-ink-3">Loading results…</p>;
  const q = mp.models.Q?.status;
  return (
    <div className="space-y-10">
      <div className="max-w-3xl text-[15px] leading-relaxed text-ink-2">
        Task 1: for each of <span className="num font-medium text-ink">{mp.data.positions.toLocaleString()}</span> original, presumed-human
        decisions in the held-out test split ({mp.data.source_games} source games, {mp.data.player_games} player-games), how much
        probability does each model give to the move the human actually played? No synthetic variants; no model was fitted or tuned on these data.
      </div>
      {q === "pending" && (
        <p className="rounded-md border border-dashed border-rule-strong bg-paper-2 p-3 text-[12.5px] text-ink-3">
          The general-purpose LLM (Qwen3-8B-Base) is the next experiment: its scorer and analysis are built, but it has not been run on the held-out data, so it is not
          part of these tables yet. Nothing has been estimated in its place.
        </p>
      )}
      <Findings items={findings} />
      <div className="overflow-x-auto rounded-md border border-rule">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead className="bg-paper-2 text-left">
            <tr>
              <th className="px-3 py-2.5 text-[11px] font-semibold tracking-[0.05em] text-ink-3 uppercase">Metric</th>
              {COLS.filter((c) => c.key !== "Q" || q === "ok").map((c) => (
                <th key={c.key} className="px-3 py-2.5">{c.model ? <ModelBadge model={c.model} kind={false} /> : <span className="text-[11.5px] font-semibold text-ink-3 uppercase">{c.label}</span>}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {T1_ROWS.map((r) => (
              <tr key={r.key} className="border-t border-rule align-top">
                <td className="px-3 py-2 text-ink-2">{r.label}<span className="block text-[11px] text-ink-4">{r.better} is better</span></td>
                {COLS.filter((c) => c.key !== "Q" || q === "ok").map((c) => {
                  const m = mp.models[c.key];
                  return (
                    <td key={c.key} className={cn("px-3 py-2", c.key === "M5" && "text-ink-3")}>
                      <Cell status={m?.status} value={m?.metrics?.[r.key]} ci={m?.ci95?.[r.key]} fmt={r.fmt} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="-mt-6 text-[12px] text-ink-3">
        95% intervals: source-game cluster bootstrap ({bs?.n_boot ?? 2000} resamples). &ldquo;Not defined&rdquo;: the Regan-inspired reconstruction does not output a
        probability for every legal move, so move-level metrics cannot be computed for it; it is compared on the engine-first-move and
        engine-top-3 events, which all three models predict.
      </p>
      <Compatibility mp={mp} />
      <Diffs title="Paired differences (Task 1)" rows={(bs?.comparisons ?? []).filter((c) => c.task === "task1")} />
      <Caveats items={mp.caveats} />
    </div>
  );
}

function Compatibility({ mp }: { mp: MovePrediction }) {
  const withQ = mp.models.Q?.status === "ok";
  return (
    <div>
      <h3 className="font-serif text-[19px] font-semibold text-ink">Which metrics are defined for which approach</h3>
      <div className="mt-3 overflow-x-auto rounded-md border border-rule">
        <table className="w-full min-w-[520px] text-[13px]">
          <thead className="bg-paper-2 text-left text-[11.5px] text-ink-3 uppercase">
            <tr><th className="px-3 py-2">Output</th><th className="px-3 py-2">Regan-inspired</th>{withQ && <th className="px-3 py-2">Qwen</th>}<th className="px-3 py-2">Maia</th></tr>
          </thead>
          <tbody>
            {mp.compatibility.map((r) => (
              <tr key={r.metric} className="border-t border-rule">
                <td className="px-3 py-1.5 text-ink-2">{r.metric}</td>
                {(withQ ? (["R", "Q", "M"] as const) : (["R", "M"] as const)).map((k) => (
                  <td key={k} className="px-3 py-1.5">
                    {r[k] ? <Check className="size-4 text-finding" aria-label="yes" /> : <Minus className="size-4 text-ink-4" aria-label="no" />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AssistTab({ ar, bs, findings }: { ar?: AssistResults; bs?: ThreeBootstrap; findings: Finding[] }) {
  if (!ar) return <p className="text-[13px] text-ink-3">Loading results…</p>;
  const keys = ar.models.Q?.status === "ok" ? ["R", "Q", "M", "M5"] : ["R", "M", "M5"];
  return (
    <div className="space-y-10">
      <div className="max-w-3xl text-[15px] leading-relaxed text-ink-2">
        Task 2: the existing controlled benchmark — <span className="num font-medium text-ink">{ar.data.rows.toLocaleString()}</span> held-out
        player-game rows ({ar.data.positives.toLocaleString()} with controlled decision-level substitutions evaluated in the original positions).
        Each model&apos;s move prediction becomes one fixed, pre-registered game-level score: mean surprisal of the chosen moves for the
        human-move models (Maia; Qwen once it is run); z(top-1) for the Regan-inspired reconstruction, which has no move distribution.
      </div>
      {ar.models.Q?.status === "pending" && (
        <p className="rounded-md border border-dashed border-rule-strong bg-paper-2 p-3 text-[12.5px] text-ink-3">
          The general-purpose LLM (Qwen3-8B-Base) is the next experiment: its scorer and analysis are built, but it has not been run on the held-out data, so it is not
          part of these tables yet. Nothing has been estimated in its place.
        </p>
      )}
      <Findings items={findings} />
      <div className="overflow-x-auto rounded-md border border-rule">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead className="bg-paper-2 text-left text-[11px] font-semibold tracking-[0.05em] text-ink-3 uppercase">
            <tr>
              <th className="px-3 py-2.5">Approach · score</th>
              <th className="px-3 py-2.5">ROC-AUC [95% CI]</th>
              <th className="px-3 py-2.5">PR-AUC</th>
              <th className="px-3 py-2.5">Recall @ 1% target (realized FPR)</th>
              <th className="px-3 py-2.5">Recall @ 5% target (realized FPR)</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => {
              const m = ar.models[k];
              if (!m) return null;
              const pend = m.status === "pending";
              return (
                <tr key={k} className={cn("border-t border-rule align-top", k === "M5" && "text-ink-3")}>
                  <td className="px-3 py-2">
                    {k === "M5" ? <span className="font-medium">Maia-3 5M (secondary)</span> : <ModelBadge model={k as "R" | "Q" | "M"} kind={false} />}
                    <span className="mt-0.5 block text-[11.5px] text-ink-3">{m.score}</span>
                  </td>
                  <td className="px-3 py-2"><Cell status={m.status} value={m.roc_auc} ci={m.roc_auc_ci95} fmt={(x) => fmtNum(x, 3)} /></td>
                  <td className="px-3 py-2"><Cell status={m.status} value={m.pr_auc} fmt={(x) => fmtNum(x, 3)} /></td>
                  {[0, 1].map((i) => (
                    <td key={i} className="px-3 py-2 num">
                      {pend ? <span className="text-ink-4 italic">pending</span> : m.tpr_at_fpr?.[i] ? <>{fmtPct(m.tpr_at_fpr[i].tpr, 1)} <span className="text-ink-3">({fmtPct(m.tpr_at_fpr[i].test_fpr, 1)})</span></> : "—"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="-mt-6 text-[12px] text-ink-3">
        Thresholds are set on validation original player-games ({ar.data.val_original_player_games_for_thresholds}); the realized test FPR is
        shown in parentheses and differs by approach, so recall values at different realized FPRs are not the same operating point and do
        not rank the approaches on their own. Calibration is not reported: none of these scores is a probability of intervention.
      </p>
      <Secondary ar={ar} />
      <ByCell ar={ar} />
      <Diffs title="Paired ROC-AUC differences (Task 2)" rows={(bs?.comparisons ?? []).filter((c) => c.task === "task2")} />
      <Caveats items={ar.caveats} />
    </div>
  );
}

/** Pre-registered secondary score (three_model_plan.py): mean excess surprisal = surprisal − model entropy. */
function Secondary({ ar }: { ar: AssistResults }) {
  const rows = ["Q", "M", "M5"].filter((k) => ar.models[k]?.status === "ok" && ar.models[k].secondary_excess_surprisal);
  if (!rows.length) return null;
  return (
    <div>
      <h3 className="font-serif text-[19px] font-semibold text-ink">Pre-registered secondary score: excess surprisal</h3>
      <p className="mt-1 max-w-3xl text-[12.5px] text-ink-3">
        Mean of (surprisal of the move − the model&apos;s entropy in that position), which adjusts for how uncertain the position is. Fixed in
        the analysis plan before test evaluation; reported as a secondary result, without a bootstrap interval.
      </p>
      <div className="mt-3 overflow-x-auto rounded-md border border-rule">
        <table className="w-full min-w-[420px] text-[12.5px]">
          <thead className="bg-paper-2 text-left text-[11px] text-ink-3 uppercase">
            <tr><th className="px-3 py-2">Model</th><th className="px-3 py-2">ROC-AUC</th><th className="px-3 py-2">PR-AUC</th></tr>
          </thead>
          <tbody>
            {rows.map((k) => (
              <tr key={k} className="border-t border-rule">
                <td className="px-3 py-1.5 text-ink-2">{NAME[k]}</td>
                <td className="px-3 py-1.5 num">{fmtNum(ar.models[k].secondary_excess_surprisal!.roc_auc, 3)}</td>
                <td className="px-3 py-1.5 num">{fmtNum(ar.models[k].secondary_excess_surprisal!.pr_auc, 3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ByCell({ ar }: { ar: AssistResults }) {
  const ok = ["R", "Q", "M"].filter((k) => ar.models[k]?.status === "ok");
  const cells = ar.models.R?.by_cell ?? [];
  return (
    <div>
      <h3 className="font-serif text-[19px] font-semibold text-ink">ROC-AUC by substitution strategy and level</h3>
      <div className="mt-3 overflow-x-auto rounded-md border border-rule">
        <table className="w-full min-w-[560px] text-[12.5px]">
          <thead className="bg-paper-2 text-left text-[11px] text-ink-3 uppercase">
            <tr><th className="px-3 py-2">Strategy · target level</th>{ok.map((k) => <th key={k} className="px-3 py-2" style={{ color: MODEL_META[k as "R"].color }}>{NAME[k]}</th>)}</tr>
          </thead>
          <tbody>
            {cells.map((c) => (
              <tr key={c.strategy + c.level} className="border-t border-rule">
                <td className="px-3 py-1.5 text-ink-2">{c.strategy} · {Math.round(c.level * 100)}%</td>
                {ok.map((k) => (
                  <td key={k} className="px-3 py-1.5 num">{fmtNum(ar.models[k].by_cell?.find((x) => x.strategy === c.strategy && x.level === c.level)?.roc_auc, 3)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Diffs({ title, rows: all }: { title: string; rows: Comparison[] }) {
  const rows = all.filter((c) => c.status === "ok");
  if (!rows.length) return null;
  return (
    <div>
      <h3 className="font-serif text-[19px] font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-[12px] text-ink-3">Difference = second − first, same bootstrap resamples for both (paired). Multiple comparisons; no multiplicity correction.</p>
      <div className="mt-3 overflow-x-auto rounded-md border border-rule">
        <table className="w-full min-w-[600px] text-[12.5px]">
          <thead className="bg-paper-2 text-left text-[11px] text-ink-3 uppercase">
            <tr><th className="px-3 py-2">Comparison</th><th className="px-3 py-2">Metric</th><th className="px-3 py-2">Difference [paired 95% CI]</th><th className="px-3 py-2">Reading</th></tr>
          </thead>
          <tbody>
            {rows.map((c, i) => {
              const v = verdict(c);
              return (
                <tr key={i} className="border-t border-rule">
                  <td className="px-3 py-1.5 text-ink-2">{NAME[c.from]} → {NAME[c.to]}</td>
                  <td className="px-3 py-1.5 text-ink-3">{c.metric.replaceAll("_", " ")}</td>
                  <td className="px-3 py-1.5 num">
                    {c.status !== "ok" ? <span className="text-ink-4 italic">pending</span> : <>{c.delta! >= 0 ? "+" : "−"}{Math.abs(c.delta!).toFixed(4)} [{c.ci95![0].toFixed(4)}, {c.ci95![1].toFixed(4)}]</>}
                  </td>
                  <td className="px-3 py-1.5 text-ink-2">{c.status !== "ok" ? "—" : v.better ? `favours ${NAME[v.better]}` : "interval includes 0"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Findings({ items }: { items: Finding[] }) {
  const real = items.filter((f) => f.kind !== "pending");
  if (!real.length) return null;
  return (
    <div>
      <h3 className="font-serif text-[19px] font-semibold text-ink">Findings (generated from the result files)</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {real.map((f) => (
          <div key={f.id} className="rounded-md border border-finding/30 bg-paper p-4">
            <div className="text-[10.5px] font-semibold tracking-[0.07em] text-finding uppercase">Finding</div>
            <div className="mt-1 font-serif text-[16.5px] leading-snug text-ink">{f.title}</div>
            <dl className="mt-2 space-y-1 text-[12.5px] leading-relaxed">
              <div><dt className="inline font-semibold text-ink-2">Evidence. </dt><dd className="inline num text-ink-2">{f.evidence}</dd></div>
              <div><dt className="inline font-semibold text-ink-2">Interpretation. </dt><dd className="inline text-ink-3">{f.interpretation}</dd></div>
              <div><dt className="inline font-semibold text-ink-2">Limitation. </dt><dd className="inline text-ink-3">{f.limitation}</dd></div>
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

function Caveats({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1 border-t border-rule pt-4 text-[12px] text-ink-3">
      {items.map((c) => <li key={c}>· {c}</li>)}
    </ul>
  );
}
