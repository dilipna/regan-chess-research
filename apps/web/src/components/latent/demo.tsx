"use client";

// Professor demo: a keyboard-controlled presentation. Nothing plays automatically; the presenter moves with
// ← / → (or the buttons), can reset, show notes, and open optional deeper sections during questions.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { EXAMPLE, toyForward } from "@/lib/latent/toy-model";
import type { Architecture, LayerProbe, Pending, RecallPrecision, TokenizerExamples, TokenTrace } from "@/lib/latent/types";
import { BLOCK_STEPS, BlockDiagram } from "./journey/scenes-a";
import { MotionControls, Prov, StepControls, TokenStrip, VectorBars, showTok } from "./kit";
import { QwenBlockOrder } from "./landing";
import { RmsCore } from "./labs/norm";
import { RankByDepth, useRecall } from "./recall";
import { LayerProbeSection, ResearchWorkspace } from "./research";

function Say({ children }: { children: React.ReactNode }) {
  return <blockquote className="border-l-4 border-[var(--role-attn)] pl-4 font-serif text-[22px] leading-snug text-ink sm:text-[26px]">{children}</blockquote>;
}

function StepTokens({ tok, trace }: { tok: TokenizerExamples; trace: TokenTrace }) {
  const [sel, setSel] = useState(5);
  const toy = useMemo(() => toyForward(EXAMPLE.tokens.map((t) => t.id)), []);
  const t = trace.tokens[sel];
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2"><Prov kind="recorded" detail="real tokenizer" /><span className="text-[14px] text-ink-3">Click a token to follow it.</span></div>
      <TokenStrip tokens={trace.tokens.map((x) => ({ pos: x.pos, id: x.id, text: x.text, prefix: x.prefix }))} selected={sel} onSelect={setSel} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-paper-2/60 p-4 text-[16px]">“{t.prefix ? "⟨start⟩" : showTok(t.text)}” → id <strong className="num">{t.id}</strong> → one row of the embedding table → a vector of {tok.embedding.shape[1].toLocaleString("en-US")} numbers in Qwen.</div>
        <div><div className="mb-1 flex items-center gap-2 text-[13px] text-ink-3">its starting vector (8 numbers) <Prov kind="toy" /></div><VectorBars values={toy.embed[sel]} height={80} /></div>
      </div>
      <p className="text-[15px] text-ink-2">From here the vector passes through {trace.n_layers} blocks, a final RMSNorm and the output layer, which gives a score for each of {tok.embedding.shape[0].toLocaleString("en-US")} vocabulary rows.</p>
    </div>
  );
}

function StepBlock({ arch }: { arch: Architecture }) {
  const [step, setStep] = useState(0);
  const toy = useMemo(() => toyForward(EXAMPLE.tokens.map((t) => t.id)), []);
  const t = 5;
  const vals = [toy.embed[t], toy.norm1[t].out, toy.attnUpdate[t], toy.mid[t], toy.norm2[t].out, toy.mlp[t].down, toy.out[t]];
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2"><Prov kind="toy" detail="one block, untrained weights" /></div>
      <BlockDiagram step={step} />
      <StepControls step={step} max={6} onStep={setStep} labels={BLOCK_STEPS} onReset={() => setStep(0)} />
      <VectorBars values={vals[step]} label={`${BLOCK_STEPS[step]} (token “␣notebook”)`} role={step === 2 ? "attn" : step === 5 ? "mlp" : step === 1 || step === 4 ? "norm" : "resid"} compare={step === 3 ? toy.embed[t] : step === 6 ? toy.mid[t] : undefined} compareLabel="before the addition" />
      <details className="rounded-lg border border-rule bg-paper-2/50 px-4 py-2"><summary className="cursor-pointer text-[14px] font-medium">Deeper: the exact Qwen3 order</summary><QwenBlockOrder arch={arch} /></details>
    </div>
  );
}

function StepRecall() {
  const { data } = useRecall();
  if (!data) return <p className="text-[14px] text-ink-3">Loading the recorded recall data…</p>;
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2"><Prov kind="recorded" detail={`Qwen3-8B-Base, ${data.dtype}, teacher forcing`} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.passages.map((p) => (
          <div key={p.name} className="rounded-xl border border-rule bg-paper p-4"><div className="text-[13px] text-ink-3">{p.name}</div>
            <div className="num font-serif text-[34px] text-ink">{(p.summary.top1_rate * 100).toFixed(1)}%</div>
            <div className="text-[13px] text-ink-3">next-token top-1 accuracy with the true text as input, {p.n_scored} tokens</div></div>
        ))}
      </div>
      <RankByDepth recall={data} compact />
      <p className="text-[14px] text-ink-2">Earlier depths are intermediate diagnostic projections, not the model&apos;s output. One passage of each kind: consistent with familiarity, not proof of memorization.</p>
    </div>
  );
}

const NOTES = [
  "Point at the token strip, then at the id and the starting vector. Mention that real token splits come from the Qwen tokenizer and the 8-number vector is a toy stand-in for 4,096 numbers.",
  "Step through with the Next step button: copy, attention update, add, copy, MLP update, add. Stress that the residual stream is only added to. Open “Deeper” for the verified Qwen order if asked about Q/K normalization or RoPE.",
  "Scale × 10: RMSNorm output unchanged. Offset +2: RMSNorm changes, LayerNorm does not. Then the gains: learned and separate from the input-dependent denominator. Recorded Qwen gains are on the RMSNorm lab page.",
  "Teacher forcing: true text in, next token scored. 76.9% vs 34.6% (bfloat16). Rank-by-depth chart: diagnostic projection, not intermediate outputs. bfloat16 vs float32 flips up to 5 of 162 decisions on the control text.",
  "The plan and controls are fixed; the dataset is gated and access is pending, so no result is shown. Ask about access to his recall scripts on turing/cerf and suggest the 14B vs ~27B depth comparison.",
];

export function ProfessorDemo({ arch, layerProbe, tok, trace }: { arch: Architecture; layerProbe: LayerProbe | Pending; precision?: RecallPrecision; tok: TokenizerExamples; trace: TokenTrace }) {
  const [s, setS] = useState(0);
  const [notes, setNotes] = useState(false);
  const [deeper, setDeeper] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const steps = [
    { title: "Follow one token", say: "Last time I analyzed Qwen mainly from its outputs. After our discussion, I wanted to understand what is happening inside the model. Here is one sentence, followed token by token.", body: <StepTokens tok={tok} trace={trace} /> },
    { title: "One complete block", say: "Here is one complete Qwen transformer block, step by step.", body: <StepBlock arch={arch} /> },
    { title: "RMSNorm vs LayerNorm", say: "This is the normalization operation we discussed.", body: <RmsCore arch={arch} compact={!deeper} /> },
    { title: "Recall evidence", say: "This connects to the recall experiments. Instead of only checking the final next token, we can trace the true token's rank through the model.", body: <StepRecall /> },
    { title: "Human vs AI: plan and status", say: "Next, I want to measure whether these representations carry information that separates human from AI writing, and where. The plan is ready; the data access is pending.", body: <div className="grid gap-4">{deeper && <ResearchWorkspace arch={arch} />}<LayerProbeSection lp={layerProbe} /></div> },
  ];
  const n = steps.length;
  const go = useCallback((d: number) => setS((x) => Math.min(n - 1, Math.max(0, x + d))), [n]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") go(1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
      if (e.key.toLowerCase() === "n") setNotes((v) => !v);
      if (e.key.toLowerCase() === "d") setDeeper((v) => !v);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [go]);
  const step = steps[s];
  return (
    <div>
      <div className="sticky top-14 z-30 -mx-4 mb-8 flex flex-wrap items-center gap-2 border-b border-rule bg-paper/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
        <ol className="flex flex-wrap gap-1" aria-label="Demo steps">
          {steps.map((x, i) => (
            <li key={x.title}><button type="button" onClick={() => setS(i)} aria-current={s === i ? "step" : undefined}
              className={cn("rounded-full px-3 py-1 text-[13.5px]", s === i ? "bg-ink text-paper" : "text-ink-2 hover:text-ink")}><span className="num">{i + 1}</span> {x.title}</button></li>
          ))}
        </ol>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <MotionControls />
          <button type="button" onClick={() => setNotes((v) => !v)} aria-pressed={notes} className="rounded border border-rule-strong px-2 py-1 text-[12.5px]">Notes (N)</button>
          <button type="button" onClick={() => setDeeper((v) => !v)} aria-pressed={deeper} className="rounded border border-rule-strong px-2 py-1 text-[12.5px]">Deeper (D)</button>
          <button type="button" onClick={() => { setS(0); setDeeper(false); setEpoch((e) => e + 1); }} className="rounded border border-rule-strong px-2 py-1 text-[12.5px]">↺ Reset</button>
          <button type="button" onClick={() => go(-1)} disabled={s === 0} className="rounded-lg border-2 border-rule-strong px-3 py-1 text-[14px] disabled:opacity-35">← Back</button>
          <button type="button" onClick={() => go(1)} disabled={s === n - 1} className="rounded-lg bg-ink px-3 py-1 text-[14px] text-paper disabled:opacity-35">Next →</button>
        </div>
      </div>
      <div className="reveal grid gap-6" key={`${s}-${epoch}`}>
        <div className="text-[13px] font-semibold tracking-wide text-ink-3 uppercase">Step {s + 1} of {n} · {step.title}</div>
        <Say>{step.say}</Say>
        {notes && <p className="rounded-xl border-2 border-dashed border-rule-strong bg-paper-2/60 p-4 text-[14.5px] leading-relaxed text-ink-2"><strong>Presenter notes.</strong> {NOTES[s]}</p>}
        <div>{step.body}</div>
        {s === n - 1 && (
          <div className="mt-4 grid gap-3">
            <Say>The goal is not only to classify AI text. I want to understand where the distinction becomes encoded inside the transformer and which computations strengthen it.</Say>
            <div className="flex flex-wrap gap-2 text-[14px]">
              <Link href="/latent/journey" className="rounded-lg border-2 border-rule-strong px-3 py-1.5">Full journey</Link>
              <Link href="/latent/labs" className="rounded-lg border-2 border-rule-strong px-3 py-1.5">Labs</Link>
              <Link href="/latent/recall" className="rounded-lg border-2 border-rule-strong px-3 py-1.5">Recall page</Link>
              <Link href="/latent/research" className="rounded-lg border-2 border-rule-strong px-3 py-1.5">Research workspace</Link>
            </div>
          </div>
        )}
      </div>
      <p className="mt-10 text-[12.5px] text-ink-3">Keys: ← → move between steps, N notes, D deeper sections. Nothing advances automatically.</p>
    </div>
  );
}
