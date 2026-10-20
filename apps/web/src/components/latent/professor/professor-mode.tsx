"use client";

// Professor mode: nine short sections for the Regan meeting, arrow keys to move, recorded evidence where it exists.

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { PROF_SECTIONS, PROF_TOTAL_MINUTES } from "@/lib/latent/professor";
import type { GbManifest } from "@/lib/latent/glassbox";
import type { Architecture, Metadata, TokenTrace } from "@/lib/latent/types";
import type { RecallVersions } from "../versions";
import { RealRmsCheck } from "../glassbox";
import { Prov } from "../kit";
import { RankByDepth, useRecall } from "../recall";
import { BlockTree, ChecklistPanel, ExperimentPanel, HypothesesPanel, LatentPanel, NormCompare, ReganPanel, TracePanel } from "./panels";

const mins = (m: number) => (m < 1 ? "under 1 min" : `about ${m} min`);

function RecallEvidence({ versions }: { versions?: RecallVersions }) {
  const { data, err } = useRecall();
  if (err) return <p className="text-[14px] text-ink-3">Recall data could not be loaded: {err}</p>;
  if (!data) return <p className="text-[14px] text-ink-3">Loading the recorded recall data…</p>;
  return (
    <div className="grid gap-3">
      <ul className="grid gap-1 text-[14.5px] text-ink-2">
        {data.passages.map((p) => <li key={p.name}><strong className="text-ink">{p.name}</strong>: top-1 next-token recall {(100 * p.positions.filter((x) => x.top1).length / p.n_scored).toFixed(1)}% of {p.n_scored} positions ({data.dtype}, teacher forcing).</li>)}
        {versions && <li>Of {versions.misses} Gettysburg misses, {versions.miss_categories["another version"]} match another Lincoln manuscript ({(versions.recall_if_other_versions_accepted * 100).toFixed(1)}% if any manuscript counts).</li>}
      </ul>
      <RankByDepth recall={data} compact />
      <p className="text-[13px] text-ink-3">Median rank of the true token by depth, from diagnostic projections through the final norm and LM head.</p>
    </div>
  );
}

interface Props { arch?: Architecture; trace?: TokenTrace; meta?: Metadata; glassbox?: GbManifest; versions?: RecallVersions }

export function ProfessorMode({ arch, trace, meta, glassbox, versions }: Props) {
  const [i, setI] = useState(0);
  const s = PROF_SECTIONS[i];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") setI((x) => Math.min(PROF_SECTIONS.length - 1, x + 1));
      if (e.key === "ArrowLeft" || e.key === "PageUp") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <nav aria-label="Sections" className="min-w-0 lg:sticky lg:top-6 lg:self-start">
        <ol className="flex gap-1 overflow-x-auto lg:grid lg:overflow-visible">
          {PROF_SECTIONS.map((x, k) => (
            <li key={x.id}><button type="button" onClick={() => setI(k)} aria-current={k === i ? "step" : undefined}
              className={cn("w-full rounded-md px-3 py-2 text-left text-[14px] whitespace-nowrap lg:whitespace-normal", k === i ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2")}>
              <span className="num mr-1.5 opacity-60">{x.n}</span>{x.title}</button></li>
          ))}
        </ol>
        <p className="mt-3 hidden text-[12.5px] text-ink-3 lg:block">About {Math.round(PROF_TOTAL_MINUTES)} minutes. ← / → to move.</p>
      </nav>
      <article aria-labelledby="prof-title" className="grid min-w-0 content-start gap-5">
        <header className="grid gap-2 border-b border-rule pb-4">
          <div className="text-[12.5px] font-semibold tracking-wide text-ink-3 uppercase">{s.n} of {PROF_SECTIONS.length} · {mins(s.minutes)}</div>
          <h2 id="prof-title" className="font-serif text-[32px] leading-tight font-semibold text-ink">{s.title}</h2>
          <p className="max-w-3xl text-[17px] leading-relaxed text-ink">{s.lead}</p>
        </header>
        {s.flow && (
          <ol aria-label="Flow" className="flex flex-wrap items-center gap-1.5">
            {s.flow.map((f, k) => <li key={f} className="flex items-center gap-1.5"><span className="rounded-md border border-rule-strong bg-paper px-2.5 py-1 font-mono text-[13px] text-ink">{f}</span>{k < s.flow!.length - 1 && <span aria-hidden className="text-ink-4">→</span>}</li>)}
          </ol>
        )}
        {s.id === "block" && <BlockTree />}
        {s.points.length > 0 && <ul className="grid max-w-3xl gap-2.5 text-[15.5px] leading-relaxed text-ink-2">{s.points.map((p) => <li key={p} className="border-l-2 border-rule-strong pl-3">{p}</li>)}</ul>}
        {s.evidence === "latent" && <LatentPanel trace={trace} />}
        {s.evidence === "rms" && <NormCompare arch={arch} trace={trace} />}
        {s.evidence === "trace" && <TracePanel trace={trace} meta={meta} />}
        {s.evidence === "regan" && <ReganPanel />}
        {s.evidence === "hypotheses" && <HypothesesPanel />}
        {s.evidence === "experiment" && <ExperimentPanel recall={<><RecallEvidence versions={versions} /><Link href="/latent/recall" className="w-fit text-[14px] text-[var(--role-resid-ink)] underline underline-offset-2">Open the Recall Microscope →</Link></>} />}
        {s.evidence === "checklist" && <ChecklistPanel />}
        {(s.evidence === "glassbox" || s.evidence === "rms") && (
          <section aria-label="Evidence" className="grid gap-3 rounded-xl border border-rule bg-paper p-4 sm:p-5">
            {s.evidence === "glassbox" && <><Prov kind="recorded" detail="re-derived from recorded tensors" /><p className="text-[15px] text-ink-2">For blocks 1, 18 and 36, every operation that needs no weights (both RMSNorms, q_norm, k_norm, RoPE, softmax, the weighted sum, both residual additions, the SwiGLU product) was re-derived from recorded tensors and matched at bfloat16 precision; wrong alternatives fit measurably worse.</p><Link href="/latent/glassbox" className="w-fit text-[14px] text-[var(--role-resid-ink)] underline underline-offset-2">Open the Glass Box →</Link></>}
            {s.evidence === "rms" && (glassbox ? <RealRmsCheck manifest={glassbox} block={1} /> : <p className="text-ink-3">Glass Box data not available.</p>)}
            </section>
        )}
        <nav aria-label="Next and previous" className="flex justify-between gap-3 border-t border-rule pt-4">
          <button type="button" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} className="rounded-lg border border-rule-strong px-4 py-2 text-[14px] text-ink disabled:opacity-40">← Previous</button>
          <button type="button" onClick={() => setI(Math.min(PROF_SECTIONS.length - 1, i + 1))} disabled={i === PROF_SECTIONS.length - 1} className="rounded-lg bg-ink px-4 py-2 text-[14px] text-paper disabled:opacity-40">Next →</button>
        </nav>
      </article>
    </div>
  );
}
