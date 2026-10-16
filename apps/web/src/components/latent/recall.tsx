"use client";

import { useEffect, useMemo, useState } from "react";
import { loadJson } from "@/lib/data";
import { cn } from "@/lib/utils";
import { PATHS } from "@/lib/latent/paths";
import { fmtInt, fmtProb, showTok } from "@/lib/latent/toy";
import type { Recall, RecallPassage, RecallPrecision } from "@/lib/latent/types";
import { LineChart, SERIES } from "./charts";
import { Callout, Measured, Panel, SectionHead } from "./shell";

export function useRecall() {
  const [data, setData] = useState<Recall | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { loadJson<Recall>(PATHS.recall).then(setData, (e: Error) => setErr(e.message)); }, []);
  return { data, err };
}

function tokText(p: RecallPassage, id: number | null) {
  if (id == null || !p.token_text) return "·";
  return p.token_text[String(id)] ?? `#${id}`;
}

function rankClass(r: number) {
  if (r === 1) return "bg-[color-mix(in_oklab,var(--viz-1)_20%,var(--paper))] underline decoration-[var(--viz-1)] decoration-2 underline-offset-4";
  if (r <= 10) return "bg-paper-2 underline decoration-dotted decoration-ink-3 underline-offset-4";
  return "bg-[color-mix(in_oklab,var(--viz-2)_16%,var(--paper))]";
}

export function RankByDepth({ recall, compact }: { recall: Recall; compact?: boolean }) {
  const series = recall.passages.map((p, i) => ({
    key: p.name, label: p.name.replace(/ \(.*\)$/, ""), color: i === 0 ? SERIES.a : SERIES.b, dash: i === 0 ? undefined : "6 3",
    points: p.depth_summary.map((d) => ({ x: d.depth, y: d.median_rank })),
  }));
  const top1 = recall.passages.map((p, i) => ({
    key: p.name, label: p.name.replace(/ \(.*\)$/, ""), color: i === 0 ? SERIES.a : SERIES.b, dash: i === 0 ? undefined : "6 3",
    points: p.depth_summary.map((d) => ({ x: d.depth, y: d.top1_rate * 100 })),
  }));
  return (
    <div className={cn("grid gap-6", !compact && "lg:grid-cols-2")}>
      <LineChart title="True-token rank vs model depth (median over positions)" series={series} logY reverseY xLabel={`depth (0 = embeddings, ${recall.n_layers} = model output)`} yLabel="median rank of true token (log)"
        refLines={[{ y: 1, label: "" }]} formatY={(v) => fmtInt(v)}
        caption={<>Intermediate diagnostic projection (final RMSNorm + LM head applied to each depth). Only depth {recall.n_layers} is the model&apos;s actual prediction. Rank 1 is at the top.</>} />
      {!compact && (
        <LineChart title="Share of positions where the true token is ranked first" series={top1} xLabel="depth" yLabel="% of positions" yDomain={[0, 100]}
          formatY={(v) => `${v.toFixed(0)}%`} caption="At the last depth this is the recall rate. Earlier depths: diagnostic projection only." />
      )}
    </div>
  );
}

function PositionTrajectory({ p, t, nLayers }: { p: RecallPassage; t: number; nLayers: number }) {
  const pos = p.positions[t];
  const ranks = p.depth_rank.map((r) => r[t]);
  const series = [{ key: "r", label: "true-token rank", color: SERIES.a, points: ranks.map((y, x) => ({ x, y })) }];
  const stab = pos.stabilization_depth;
  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
      <LineChart title={`Position ${t}: true next token "${showTok(pos.true)}"`} series={series} logY reverseY xLabel="depth" yLabel="rank (log)" formatY={(v) => fmtInt(v)}
        refLines={[{ y: 1, label: "" }]} markers={stab != null && stab < nLayers ? [{ x: stab, label: `stable from ${stab}` }] : []}
        markerLabelBottom
        caption={<>Model output (depth {nLayers}): rank {pos.rank}, p = {fmtProb(pos.p_true)}, top token &quot;{showTok(pos.top)}&quot; (p = {fmtProb(pos.p_top)}), entropy {pos.entropy.toFixed(2)} nats,
          margin {pos.margin.toFixed(2)}. &quot;Stable from&quot; = first depth after which the diagnostic top token always equals the final top token.</>} />
      <div className="scroll-x max-h-[330px] overflow-y-auto rounded border border-rule">
        <table className="table-lab">
          <thead><tr><th>depth</th><th>top projected token</th><th className="r">true-token rank</th><th className="r">p (diag.)</th></tr></thead>
          <tbody>{ranks.map((r, d) => (
            <tr key={d} className={cn(d === nLayers && "bg-llm-soft/60")}>
              <td className="num">{d}{d === nLayers && " · output"}</td>
              <td className="font-mono text-[12px] whitespace-pre">{showTok(tokText(p, p.depth_top_id?.[d][t] ?? null))}</td>
              <td className="num r">{fmtInt(r)}</td>
              <td className="num r">{p.depth_log10_p_true[d][t] <= -29 ? "< 1e-5" : fmtProb(10 ** p.depth_log10_p_true[d][t])}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

export function RecallMicroscope({ precision }: { precision?: RecallPrecision }) {
  const { data, err } = useRecall();
  const [k, setK] = useState(0);
  const [t, setT] = useState<number | null>(null);
  const p = data?.passages[k];
  const firstMiss = useMemo(() => p?.positions.find((x) => x.rank > 1 && x.t > 3)?.t ?? 0, [p]);
  if (err) return <p role="alert" className="text-[13px] text-flag">Could not load the recall artifact: {err}</p>;
  if (!data || !p) return <p className="py-10 text-[13px] text-ink-3" aria-live="polite">Loading the recall artifact…</p>;
  const sel = t ?? firstMiss;
  return (
    <div className="grid gap-8">
      <Panel title="Recall summary" badge={<Measured>{`Qwen3-8B-Base, ${data.dtype}, layer-streamed on a laptop GPU`}</Measured>}>
        <div className="scroll-x">
          <table className="table-lab">
            <thead><tr><th>passage</th><th className="r">scored tokens</th><th className="r">top-1 recall</th><th className="r">top-5</th><th className="r">median rank</th><th className="r">perplexity</th><th className="r">median stabilization depth</th></tr></thead>
            <tbody>{data.passages.map((q) => (
              <tr key={q.name}><th scope="row">{q.name}</th><td className="num r">{q.n_scored}</td><td className="num r">{(q.summary.top1_rate * 100).toFixed(1)}%</td>
                <td className="num r">{(q.summary.top5_rate * 100).toFixed(1)}%</td><td className="num r">{q.summary.median_rank}</td><td className="num r">{q.summary.perplexity.toFixed(2)}</td>
                <td className="num r">{q.median_stabilization_depth ?? "n/a"}</td></tr>
            ))}</tbody>
          </table>
        </div>
        {precision && (
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">
            Numerical precision check (same text, same code, only the compute dtype changes): {precision.passages.map((q) => `${q.name.replace(/ \(.*\)$/, "")} ${(q.top1_rate.bfloat16 * 100).toFixed(1)}% in bfloat16 vs ${(q.top1_rate.float32 * 100).toFixed(1)}% in float32 (${q.top1_flips} of ${q.n_scored} top-1 decisions flip)`).join("; ")}.
            Near-ties make recall rates sensitive to precision at the level of a few points.
          </p>
        )}
      </Panel>
      <RankByDepth recall={data} />
      <Panel title="Every position of the passage" badge={<span className="text-[11px] text-ink-3">click a token</span>}>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div role="radiogroup" aria-label="Passage" className="inline-flex rounded-md border border-rule-strong p-0.5">
            {data.passages.map((q, i) => <button key={q.name} role="radio" aria-checked={k === i} onClick={() => { setK(i); setT(null); }} className={cn("rounded px-2.5 py-1 text-[12.5px]", k === i ? "bg-ink text-paper" : "text-ink-3 hover:text-ink")}>{q.name.replace(/ \(.*\)$/, "")}</button>)}
          </div>
          <span className="flex flex-wrap gap-3 text-[11.5px] text-ink-3">
            <span><span className={cn("px-1", rankClass(1))}>abc</span> rank 1 (solid underline)</span>
            <span><span className={cn("px-1", rankClass(5))}>abc</span> rank 2 to 10 (dotted)</span>
            <span><span className={cn("px-1", rankClass(50))}>abc</span> rank above 10</span>
          </span>
        </div>
        {p.text_stored ? (
          <div className="max-h-[260px] overflow-y-auto rounded border border-rule bg-paper p-3 font-serif text-[16px] leading-[2.1]">
            {p.positions.map((x) => (
              <button key={x.t} type="button" onClick={() => setT(x.t)} aria-label={`position ${x.t}, token ${x.true}, rank ${x.rank}`} aria-pressed={sel === x.t}
                className={cn("rounded-[2px] whitespace-pre-wrap text-ink", rankClass(x.rank), sel === x.t && "outline-2 outline-offset-1 outline-ink")}>{x.true}</button>
            ))}
          </div>
        ) : <p className="text-[13px] text-ink-3">This passage was analyzed with --no-store-text; only statistics are available.</p>}
        <div className="mt-5"><PositionTrajectory p={p} t={sel} nLayers={data.n_layers} /></div>
      </Panel>
      <Callout tone="caution">
        The diagnostic projection is not &quot;Qwen&apos;s prediction at layer k&quot;. It reads an intermediate residual through the final RMSNorm and LM head, which were trained on the
        last residual only. A low rank at depth 20 shows that the true token is already linearly readable in that direction, not that the model has &quot;decided&quot;.
      </Callout>
    </div>
  );
}

export function FutureComparison({ nLayers }: { nLayers: number }) {
  return (
    <section className="mt-14">
      <SectionHead kicker="Prepared, not run" title="Comparing model sizes: same final recall, different trajectories?">
        Professor Regan observed that a ~27B Qwen model and an older ~14B model reach almost the same recall rate (about 86.3%) on a famous speech. Final recall alone cannot show
        whether the two models get there the same way. LatentLens can compare them on relative depth (block / number of blocks) once both are run with the same script.
      </SectionHead>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="What would be compared">
          <ul className="list-disc space-y-1 pl-5 text-[13.5px] text-ink-2">
            <li>true-token rank by relative depth, and top-token identity by relative depth</li>
            <li>depth at which the prediction stabilizes</li>
            <li>activation RMS by depth, prediction margin and entropy</li>
            <li>tokenizer differences (the same text can have different token counts)</li>
            <li>bf16 vs fp32 sensitivity of the recall rate itself</li>
          </ul>
        </Panel>
        <Panel title="How to run it">
          <pre className="scroll-x rounded border border-rule bg-paper-2 p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre text-ink-2">{`python scripts/latentlens/run_recall_analysis.py --model <model A> \\
    --loader full --input speech.txt --no-store-text --out A.json
python scripts/latentlens/run_recall_analysis.py --model <model B> \\
    --loader full --input speech.txt --no-store-text --out B.json
python scripts/latentlens/compare_recall_models.py A.json B.json`}</pre>
          <p className="mt-2 text-[12px] text-ink-3">Model ids are left open on purpose: LatentLens does not assume which checkpoints Professor Regan used. Nothing is downloaded automatically. Only Qwen3-8B-Base ({nLayers} blocks) has been run so far.</p>
        </Panel>
      </div>
    </section>
  );
}
