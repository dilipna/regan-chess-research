// The proposed 14B → ~27B experiment as a one-page research plan. Static content from lib/latent/proposal.ts.

import Link from "next/link";
import { cn } from "@/lib/utils";
import { REGAN_REPORT } from "@/lib/latent/professor";
import { CASE_STUDY, CATEGORIES, COMPARISON, CONFIRM, FRAMING, LATENT_TRACK, MAIN_QUESTION, OUTCOMES, PIPELINE, PITCH, PROJECTION_CHAIN, PROPOSAL_SUBTITLE, PROPOSAL_TITLE, STAGES, TRACE_NOTE, WHY, type Cell, type Stage } from "@/lib/latent/proposal";
import { Tag } from "./professor/panels";

const Box = ({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) => (
  <section id={id} className={cn("grid min-w-0 scroll-mt-20 gap-4 rounded-xl border border-rule bg-paper p-4 sm:p-6", className)}>{children}</section>
);
const H2 = ({ children }: { children: React.ReactNode }) => <h2 className="font-serif text-[22px] leading-snug font-semibold text-ink sm:text-[24px]">{children}</h2>;
const Q = ({ children }: { children: React.ReactNode }) => (
  <p className="rounded-lg border-l-2 border-ink bg-[color-mix(in_oklab,var(--mint)_6%,transparent)] px-4 py-3 text-[16px] leading-relaxed font-medium text-ink">{children}</p>
);
const Chain = ({ steps, label }: { steps: string[]; label: string }) => (
  <ol aria-label={label} className="flex flex-wrap items-center gap-1.5">
    {steps.map((s, k) => <li key={s} className="flex items-center gap-1.5"><span className="rounded border border-rule-strong px-2 py-1 font-mono text-[12.5px] text-ink-2">{s}</span>{k < steps.length - 1 && <span aria-hidden className="text-ink-4">→</span>}</li>)}
  </ol>
);

function StageCard({ s, children }: { s: Stage; children?: React.ReactNode }) {
  return (
    <Box id={`stage-${s.n}`}>
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[13px] text-ink-4">Stage {s.n}</span>
        <h3 className="font-serif text-[21px] leading-snug font-semibold text-ink">{s.title}</h3>
      </div>
      {s.principle && <p className="w-fit rounded border border-ink px-2.5 py-1 font-mono text-[13px] text-ink">{s.principle}</p>}
      <p className="max-w-3xl text-[15px] leading-relaxed text-ink-2">{s.why}</p>
      {s.items.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {s.items.map((it) => (
            <div key={it.label} className="grid content-start gap-1.5">
              <div className="font-mono text-[11.5px] tracking-[0.1em] text-ink-4 uppercase">{it.label}</div>
              <ul className="grid list-disc gap-0.5 pl-5 text-[14px] text-ink-2">{it.list.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          ))}
        </div>
      )}
      {children}
      {s.question && <Q>{s.question}</Q>}
    </Box>
  );
}

const cellCls: Record<Cell["kind"], string> = { reported: "text-[var(--prov-regan)]", confirm: "text-[var(--role-mlp-ink)]", measure: "text-ink-4" };

export function Proposal() {
  const r = REGAN_REPORT;
  const [s1, s2, s3, s4, s5] = STAGES;
  return (
    <div className="grid gap-8">
      <header className="grid gap-3 border-b border-rule pb-6">
        <div className="font-mono text-[12.5px] text-ink-4">Phase 2 · LLMs · proposed approach</div>
        <h1 className="max-w-4xl font-serif text-[32px] leading-tight font-semibold text-ink sm:text-[42px]">{PROPOSAL_TITLE}</h1>
        <p className="text-[18px] text-ink-2">{PROPOSAL_SUBTITLE}</p>
        <div className="flex flex-wrap gap-2"><Tag kind="pending">Proposal · not yet run</Tag><Tag kind="hypothesis">No results on this page</Tag></div>
      </header>

      <Box>
        <div className="flex flex-wrap items-center gap-2"><Tag kind="regan">Professor-reported observation</Tag><span className="text-[13px] text-ink-3">From Professor Regan&apos;s email; not reproduced yet.</span></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[r.older, r.larger].map((m) => (
            <div key={m.label} className="rounded-lg border border-rule p-3">
              <div className="text-[13px] text-ink-3">{m.label} · {r.text}</div>
              <div className="num font-mono text-[28px] font-semibold text-ink">{m.recall}</div>
              <div className="text-[12.5px] text-ink-4">recall</div>
            </div>
          ))}
        </div>
        <ul className="grid list-disc gap-0.5 pl-5 text-[14.5px] text-ink-2">
          {r.differences.map((d) => <li key={d}>{d}</li>)}
          <li>one continuation where the older model prefers <code className="font-mono text-ink">{r.divergence.older}</code> and the larger model <code className="font-mono text-ink">{r.divergence.larger}</code></li>
        </ul>
        <p className="text-[15px] text-ink-2">This plan does not assume that scaling has hit a wall. <strong className="text-ink">{FRAMING}</strong></p>
        <Q>{MAIN_QUESTION}</Q>
      </Box>

      <Box>
        <H2>Pipeline</H2>
        <ol aria-label="Research pipeline" className="grid gap-1.5 sm:grid-cols-4">
          {PIPELINE.map((p, k) => (
            <li key={p} className="flex items-center gap-2 rounded-lg border border-rule-strong px-3 py-2 text-[13.5px] text-ink-2">
              <span className="font-mono text-[11.5px] text-ink-4">{k + 1}</span>{p}
            </li>
          ))}
        </ol>
        <p className="text-[13px] text-ink-4">Read left to right, top to bottom. Each step depends on the one before it.</p>
      </Box>

      <div className="grid gap-4">
        <H2>Five stages</H2>
        <StageCard s={s1} />
        <StageCard s={s2} />
        <StageCard s={s3}>
          <div className="grid gap-2">
            <div className="font-mono text-[11.5px] tracking-[0.1em] text-ink-4 uppercase">Intermediate diagnostic projection</div>
            <Chain steps={PROJECTION_CHAIN} label="Diagnostic projection" />
            <p className="text-[13.5px] text-ink-3">These are diagnostic projections, not the model&apos;s predictions at those layers. Only the last layer is the model&apos;s output.</p>
          </div>
          <div className="grid gap-2 rounded-lg border border-rule-strong p-3 sm:p-4">
            <div className="text-[14px] font-semibold text-ink">Main graph: true next-token diagnostic rank vs relative transformer depth</div>
            <p className="text-[13.5px] text-ink-3">Relative depth = layer number ÷ total transformer layers, so models with different numbers of layers share one axis.</p>
          </div>
          <div className="grid gap-2 rounded-lg border border-[var(--role-norm)] p-3 sm:p-4">
            <div className="text-[14px] font-semibold text-ink">Latent-state track</div>
            <p className="text-[14px] text-ink-2">At {LATENT_TRACK.depths.join(", ")} depths, measure the representation itself:</p>
            <ul className="grid list-disc gap-0.5 pl-5 text-[14px] text-ink-2 sm:grid-cols-2 sm:gap-x-6">{LATENT_TRACK.measures.map((m) => <li key={m}>{m}</li>)}</ul>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded border border-rule p-2.5 text-[13px] text-ink-2"><span className="font-semibold text-ink">Block RMSNorm</span>: the whole residual vector of a token (before attention, before the MLP, final norm). The pre/post comparison above uses this one.</div>
              <div className="rounded border border-rule p-2.5 text-[13px] text-ink-2"><span className="font-semibold text-ink">Q/K RMSNorm</span>: each query or key head separately, inside attention. Measured separately, never mixed with block-norm results.</div>
            </div>
            <p className="text-[13px] text-ink-3">{LATENT_TRACK.caveat}</p>
            <Q>{LATENT_TRACK.question}</Q>
          </div>
          <p className="text-[13px] text-ink-4">{TRACE_NOTE}</p>
        </StageCard>
        <StageCard s={s4}>
          <ul className="grid gap-1.5 sm:grid-cols-5">
            {CATEGORIES.map((c) => <li key={c.id} className="rounded-lg border border-rule p-2.5 text-[13.5px] text-ink-2"><div className="font-mono text-[13px] text-ink">{c.id}</div>{c.text}</li>)}
          </ul>
          <p className="text-[14px] text-ink-2">Compare the layerwise trajectories within each category.</p>
          <div className="grid gap-2 rounded-lg border border-rule-strong p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2"><span className="text-[14px] font-semibold text-ink">Case study: will vs shall</span><Tag kind="pending">Pending checkpoints and model access</Tag></div>
            <div className="grid gap-0.5 font-mono text-[13px]">
              <span className="text-ink-3">{CASE_STUDY.context}</span>
              <span><span className="inline-block w-16 text-ink-4">14B</span><span className="text-ink">{CASE_STUDY.older}</span></span>
              <span><span className="inline-block w-16 text-ink-4">~27B</span><span className="text-ink">{CASE_STUDY.larger}</span></span>
            </div>
            <p className="text-[13.5px] text-ink-2">Plot against relative depth, for each model:</p>
            <Chain steps={CASE_STUDY.plot.slice(1)} label="Case-study measures" />
            <p className="text-[13px] text-ink-3">{CASE_STUDY.limitation}</p>
          </div>
        </StageCard>
        <StageCard s={s5}>
          <div className="grid gap-2">
            <div className="font-mono text-[11.5px] tracking-[0.1em] text-ink-4 uppercase">Possible outcomes (not predetermined)</div>
            <div className="grid gap-2 md:grid-cols-2">
              {OUTCOMES.map((o) => (
                <div key={o.id} className="grid gap-1 rounded-lg border border-rule p-3">
                  <div className="text-[14px] text-ink"><span className="mr-2 font-mono text-ink-4">{o.id}</span>{o.result}</div>
                  <div className="text-[13.5px] text-ink-3">Consistent with: {o.reading}</div>
                </div>
              ))}
            </div>
          </div>
        </StageCard>
      </div>

      <Box>
        <H2>Central comparison</H2>
        <div className="scroll-x">
          <table className="table-lab">
            <thead><tr><th>Measurement</th><th>Older ~14B</th><th>Larger ~27B</th></tr></thead>
            <tbody>{COMPARISON.map((row) => (
              <tr key={row.m}><td className="text-ink-2">{row.m}</td>{[row.a, row.b].map((c, k) => <td key={k} className={cn("font-mono text-[12.5px]", cellCls[c.kind])}>{c.v}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12px]">
          <span className={cellCls.reported}>■ professor-reported</span>
          <span className={cellCls.confirm}>■ to confirm with Professor Regan</span>
          <span className={cellCls.measure}>■ to measure</span>
        </div>
      </Box>

      <div className="grid gap-4 md:grid-cols-2">
        <Box>
          <H2>Why this approach?</H2>
          <ol className="grid list-decimal gap-1 pl-5 text-[14.5px] text-ink-2">{WHY.map((w) => <li key={w}>{w}</li>)}</ol>
        </Box>
        <Box className="border-[var(--role-mlp)]">
          <H2>Before running this, I need to confirm</H2>
          <ol className="grid list-decimal gap-1 pl-5 text-[14.5px] text-ink-2">{CONFIRM.map((c) => <li key={c}>{c}</li>)}</ol>
        </Box>
      </div>

      <section aria-label="One-sentence summary" className="rounded-xl border border-ink bg-[color-mix(in_oklab,var(--mint)_7%,transparent)] p-5 shadow-[0_0_32px_-8px_var(--mint-glow)] sm:p-7">
        <div className="mb-2 font-mono text-[12px] tracking-[0.1em] text-ink-4 uppercase">In one sentence</div>
        <p className="font-serif text-[20px] leading-snug font-semibold text-ink sm:text-[24px]">&ldquo;{PITCH}&rdquo;</p>
      </section>

      <p className="text-[13.5px] text-ink-3">
        Related: <Link href="/latent/professor" className="underline underline-offset-2 hover:text-ink">Professor demo</Link> (one recorded Qwen3-8B trace) ·{" "}
        <Link href="/latent/recall" className="underline underline-offset-2 hover:text-ink">Recall Microscope</Link> (the per-layer true-token rank already recorded on Qwen3-8B-Base, Gettysburg Address).
      </p>
    </div>
  );
}
