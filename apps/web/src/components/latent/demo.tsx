"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { blockParts } from "@/lib/latent/parts";
import type { Architecture, LayerProbe, Pending, RecallPrecision } from "@/lib/latent/types";
import { BlockDiagram } from "./block";
import { RankByDepth, useRecall } from "./recall";
import { LayerProbeSection } from "./research";
import { RmsToy } from "./rmsnorm-lab";
import { FiveIdeas, Panel } from "./shell";
import { fmtInt } from "@/lib/latent/toy";

const WALK = ["norm1", "qkv", "qknorm", "rope", "attn", "oproj", "add1", "norm2", "mlp", "add2"];

function Say({ children }: { children: React.ReactNode }) {
  return <blockquote className="border-l-2 border-llm pl-4 font-serif text-[21px] leading-snug text-ink sm:text-[24px]">{children}</blockquote>;
}

function Walkthrough({ arch }: { arch: Architecture }) {
  const [i, setI] = useState(0);
  const [play, setPlay] = useState(true);
  useEffect(() => {
    if (!play) return;
    const t = setInterval(() => setI((x) => (x + 1) % WALK.length), 4000);
    return () => clearInterval(t);
  }, [play]);
  const part = blockParts(arch).find((p) => p.id === WALK[i])!;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_1fr]">
      <BlockDiagram arch={arch} selected={WALK[i]} onSelect={(id) => { const k = WALK.indexOf(id); if (k >= 0) { setI(k); setPlay(false); } }} />
      <div className="grid content-start gap-3">
        <div className="flex gap-2">
          <button type="button" onClick={() => setPlay((p) => !p)} className="rounded border border-rule-strong px-2.5 py-1 text-[12.5px] text-ink-2">{play ? "Pause walk-through" : "Resume walk-through"}</button>
          <span className="self-center text-[12px] text-ink-3">{i + 1} / {WALK.length}</span>
        </div>
        <Panel><FiveIdeas part={part} compact /></Panel>
      </div>
    </div>
  );
}

function RecallStep() {
  const { data } = useRecall();
  if (!data) return <p className="text-[13px] text-ink-3">Loading recall data…</p>;
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {data.passages.map((p) => (
          <Panel key={p.name}><div className="text-[12.5px] text-ink-3">{p.name}</div><div className="num font-serif text-[30px] text-ink">{(p.summary.top1_rate * 100).toFixed(1)}%</div><div className="text-[12px] text-ink-3">top-1 next-token recall over {p.n_scored} tokens</div></Panel>
        ))}
      </div>
      <RankByDepth recall={data} compact />
    </div>
  );
}

export function ProfessorDemo({ arch, layerProbe, precision }: { arch: Architecture; layerProbe: LayerProbe | Pending; precision?: RecallPrecision }) {
  const [s, setS] = useState(0);
  const [notes, setNotes] = useState(false);
  const steps = [
    { title: "From outputs to internals", say: "Last time I analyzed Qwen mainly from its outputs. After our discussion, I wanted to understand what is happening inside the model.",
      notes: `Point at the pipeline. Qwen3-8B-Base: ${arch.verified.num_hidden_layers} blocks, residual width ${fmtInt(arch.verified.hidden_size)}, ${arch.verified.num_attention_heads} query heads and ${arch.verified.num_key_value_heads} KV heads, every number verified against the checkpoint and the installed transformers code.`,
      body: <ArchStrip arch={arch} /> },
    { title: "One complete block", say: "Here is one complete Qwen transformer block.",
      notes: "Let the walk-through run: RMSNorm, Q/K/V, Q/K normalization, RoPE, attention, residual, RMSNorm, MLP, residual. Stress that the rail on the left is only ever added to.",
      body: <Walkthrough arch={arch} /> },
    { title: "Normalization", say: "This is the normalization operation we discussed.",
      notes: `Run the toy vector [2, -1, 4, 1]: squares, mean 5.5, RMS 2.345, divide, gain. Press Scale x by 10 (output unchanged) and Add 5 (output changes, unlike LayerNorm). Then: block RMSNorm is over ${fmtInt(arch.verified.hidden_size)} numbers, Q/K RMSNorm over ${arch.verified.qk_norm_dim}.`,
      body: <RmsToy eps={arch.verified.rms_norm_eps} /> },
    { title: "Freezing Qwen and probing each layer", say: "Now I freeze Qwen and inspect what information is available at each layer.",
      notes: layerProbe.status === "ok" ? "Show the validation curve, the selected depth, then the one-time test numbers and the shuffled-label control." : "Be explicit: the pipeline is built and tested, but the Qwen3-8B human-vs-AI run waits for EditLens access. No curve is shown because none has been measured.",
      body: <LayerProbeSection lp={layerProbe} /> },
    { title: "Connecting to the recall experiments", say: "This connects directly to the recall experiments. Rather than only measuring whether the final next token is correct, we can trace how the true token's rank changes through the model.",
      notes: `Gettysburg vs an unpublished control paragraph. ${precision ? `Precision check: ${precision.passages.map((p) => `${p.name.split(" (")[0]} ${p.top1_flips} of ${p.n_scored} top-1 decisions flip between bfloat16 and float32`).join("; ")}.` : ""} Mention the 14B vs ~27B plateau as the natural next comparison.`,
      body: <RecallStep /> },
  ];
  const n = steps.length + 1;
  const go = useCallback((d: number) => setS((x) => Math.min(n - 1, Math.max(0, x + d))), [n]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [go]);
  const step = steps[s];
  return (
    <div>
      <div className="sticky top-14 z-30 -mx-4 mb-8 flex flex-wrap items-center gap-2 border-b border-rule bg-paper/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <ol className="flex flex-wrap gap-1" aria-label="Demo steps">
          {[...steps.map((x) => x.title), "Closing"].map((t, i) => (
            <li key={t}><button type="button" onClick={() => setS(i)} aria-current={s === i ? "step" : undefined}
              className={cn("rounded px-2 py-1 text-[12.5px]", s === i ? "bg-ink text-paper" : "text-ink-3 hover:text-ink")}><span className="num">{i + 1}</span> {t}</button></li>
          ))}
        </ol>
        <div className="ml-auto flex gap-1.5">
          <button type="button" onClick={() => setNotes((v) => !v)} aria-pressed={notes} className="rounded border border-rule-strong px-2 py-1 text-[12px] text-ink-3">Presenter notes</button>
          <button type="button" onClick={() => go(-1)} disabled={s === 0} className="rounded border border-rule-strong px-2.5 py-1 text-[12.5px] text-ink-2 disabled:opacity-40">Back</button>
          <button type="button" onClick={() => go(1)} disabled={s === n - 1} className="rounded bg-ink px-2.5 py-1 text-[12.5px] text-paper disabled:opacity-40">Next</button>
        </div>
      </div>
      {step ? (
        <div className="reveal grid gap-6" key={s}>
          <div className="eyebrow">Step {s + 1} of {steps.length}</div>
          <Say>{step.say}</Say>
          {notes && <p className="rounded border border-dashed border-rule-strong bg-paper-2/60 p-3 text-[13px] leading-relaxed text-ink-2">{step.notes}</p>}
          <div>{step.body}</div>
        </div>
      ) : (
        <div className="reveal grid gap-6 py-6">
          <Say>The goal is not merely to classify AI text. I want to understand where the distinction becomes encoded inside the transformer and which computations strengthen it.</Say>
          {notes && <p className="rounded border border-dashed border-rule-strong bg-paper-2/60 p-3 text-[13px] text-ink-2">Ask for access to his recall scripts on turing/cerf, and propose the 14B vs ~27B depth-trajectory comparison as the next experiment.</p>}
          <div className="flex flex-wrap gap-2">
            <Link href="/latent/learn" className="rounded border border-rule-strong px-3 py-1.5 text-[13px] text-ink">Learn Mode</Link>
            <Link href="/latent/research" className="rounded border border-rule-strong px-3 py-1.5 text-[13px] text-ink">Research Mode</Link>
            <Link href="/latent/recall" className="rounded border border-rule-strong px-3 py-1.5 text-[13px] text-ink">Recall Microscope</Link>
            <Link href="/latent/methods" className="rounded border border-rule-strong px-3 py-1.5 text-[13px] text-ink">Methods and limitations</Link>
          </div>
        </div>
      )}
    </div>
  );
}

function ArchStrip({ arch }: { arch: Architecture }) {
  const v = arch.verified;
  const items: [string, string][] = [["blocks", String(v.num_hidden_layers)], ["residual width", fmtInt(v.hidden_size)], ["MLP width", fmtInt(v.intermediate_size)],
    ["query / KV heads", `${v.num_attention_heads} / ${v.num_key_value_heads}`], ["head dim", String(v.head_dim)], ["vocabulary", fmtInt(v.vocab_size)], ["parameters", `${(arch.parameters.total / 1e9).toFixed(2)} B`]];
  const stages = ["text", "tokens", "embeddings", `${v.num_hidden_layers} × block`, "final RMSNorm", "LM head", "softmax", "next token"];
  return (
    <div className="grid gap-5">
      <ol className="flex flex-wrap items-center gap-1.5">{stages.map((x, i) => <li key={x} className="flex items-center gap-1.5"><span className={cn("rounded border px-2.5 py-1.5 text-[14px]", i === 3 ? "border-llm/40 bg-llm-soft text-ink" : "border-rule-strong bg-paper-2/60 text-ink")}>{x}</span>{i < stages.length - 1 && <span aria-hidden className="text-ink-4">→</span>}</li>)}</ol>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">{items.map(([k, val]) => <div key={k}><dt className="text-[11.5px] text-ink-3">{k}</dt><dd className="num font-serif text-[24px] text-ink">{val}</dd></div>)}</dl>
      <p className="text-[12px] text-ink-3">Qwen3-8B-Base @ {arch.revision.slice(0, 8)}; {arch.checks.source_order.filter((c) => c.verified).length} order-of-operation facts verified in transformers {arch.sources.transformers_version}.</p>
    </div>
  );
}
