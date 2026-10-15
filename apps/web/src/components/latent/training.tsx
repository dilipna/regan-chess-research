"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { dims } from "@/lib/latent/parts";
import { QUESTIONS } from "@/lib/latent/questions";
import { backpropStep, fmtBytes, fmtInt, fmtProb, round, showTok } from "@/lib/latent/toy";
import type { Architecture, TokenTrace } from "@/lib/latent/types";
import { Callout, Eq, Measured, Panel, Reveal, SectionHead, Toy } from "./shell";

export function KvCacheLab({ arch }: { arch: Architecture }) {
  const D = dims(arch);
  const [n, setN] = useState(4096);
  const per = arch.kv_cache.bytes_per_token_all_layers;
  const mha = arch.kv_cache.bytes_per_token_if_mha;
  const mqa = per / D.Hkv;
  const stops = [1, 512, 2048, 4096, 8192, 16384, arch.verified.max_position_embeddings];
  return (
    <Panel title="KV cache" badge={<Measured>Sizes computed from the verified config</Measured>}>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="min-w-0 text-[13.5px] leading-relaxed text-ink-2 [overflow-wrap:anywhere]">
          <p><span className="font-medium text-ink">Without a cache</span>, generating token n+1 would rerun the whole prefix: every previous position&apos;s K and V would be recomputed in every layer, for every new token.</p>
          <p className="mt-2"><span className="font-medium text-ink">With a cache</span>, K and V of past positions are stored once per layer. A new token computes only its own Q, K and V, appends its K and V, and attends over cached + new keys.</p>
          <ol className="mt-3 grid gap-1 font-mono text-[12.5px] text-ink">
            <li>prompt → compute K, V for all positions → cache</li>
            <li>new token → its Q, K, V → append K, V</li>
            <li>attend: Q_new against [K_cache; K_new], weights on [V_cache; V_new]</li>
          </ol>
          <p className="mt-3 text-[12px] text-ink-3">Queries are never cached: only the newest position asks a question. Keys are cached after RoPE.</p>
        </div>
        <div className="min-w-0">
          <label className="text-[13px] text-ink-2">Context length: <span className="num text-ink">{fmtInt(n)}</span> tokens
            <input type="range" min={0} max={stops.length - 1} step={1} value={stops.indexOf(n) >= 0 ? stops.indexOf(n) : 3} onChange={(e) => setN(stops[Number(e.target.value)])} className="block w-full" aria-valuetext={`${n} tokens`} /></label>
          <div className="scroll-x mt-2"><table className="table-lab">
            <thead><tr><th>variant</th><th className="r">KV heads</th><th className="r">per token</th><th className="r">at {fmtInt(n)} tokens</th></tr></thead>
            <tbody>
              <tr className="bg-llm-soft/50"><td>GQA (Qwen3-8B)</td><td className="num r">{D.Hkv}</td><td className="num r">{fmtBytes(per)}</td><td className="num r">{fmtBytes(per * n)}</td></tr>
              <tr><td>MHA</td><td className="num r">{D.H}</td><td className="num r">{fmtBytes(mha)}</td><td className="num r">{fmtBytes(mha * n)}</td></tr>
              <tr><td>MQA</td><td className="num r">1</td><td className="num r">{fmtBytes(mqa)}</td><td className="num r">{fmtBytes(mqa * n)}</td></tr>
            </tbody>
          </table></div>
          <Eq label="bytes per token equals 2 times KV heads times head dimension times layers times bytes per number">2 (K and V) × {D.Hkv} × {D.dh} × {D.L} layers × 2 bytes = {fmtInt(per)} bytes</Eq>
          <p className="text-[12px] text-ink-3">Per sequence, {arch.kv_cache.dtype}. Fewer KV heads means a proportionally smaller cache.</p>
        </div>
      </div>
    </Panel>
  );
}

function TeacherForcing() {
  const seq = ["A", "B", "C", "D", "E"];
  return (
    <Panel title="Teacher forcing" badge={<Toy>Toy sequence</Toy>}>
      <div className="scroll-x">
        <table className="table-lab">
          <thead><tr><th>position</th>{seq.slice(0, 4).map((_, i) => <th key={i} className="r">{i}</th>)}</tr></thead>
          <tbody>
            <tr><th scope="row">input (true tokens)</th>{seq.slice(0, 4).map((s) => <td key={s} className="r font-mono">{s}</td>)}</tr>
            <tr><th scope="row">target (next token)</th>{seq.slice(1).map((s) => <td key={s} className="r font-mono text-llm">{s}</td>)}</tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-2">All four predictions are made in one parallel forward pass. Each position sees the TRUE previous tokens (never its own earlier guesses), and the causal mask stops it from seeing its own target.</p>
    </Panel>
  );
}

function RealLoss({ trace }: { trace: TokenTrace }) {
  return (
    <Panel title="The training objective on our sentence" badge={<Measured>Forward pass only, no weights changed</Measured>}>
      <div className="scroll-x">
        <table className="table-lab">
          <thead><tr><th>context</th><th>target</th><th className="r">p(target)</th><th className="r">rank</th><th className="r">loss −log p</th><th>model&apos;s top 3</th></tr></thead>
          <tbody>{trace.positions.map((p, i) => (
            <tr key={i}><td className="font-mono text-[12px] whitespace-pre">{p.context ? showTok(p.context) : "<|endoftext|>"}</td><td className="font-mono whitespace-pre text-llm">{showTok(p.true_next)}</td>
              <td className="num r">{fmtProb(Math.exp(-p.loss_nats))}</td><td className="num r">{fmtInt(p.rank)}</td><td className="num r">{p.loss_nats.toFixed(2)}</td>
              <td className="font-mono text-[11.5px] whitespace-pre text-ink-3">{p.top.slice(0, 3).map((t) => showTok(t.text)).join("  ")}</td></tr>
          ))}</tbody>
        </table>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">
        Cross-entropy averaged over the {trace.positions.length} targets: <span className="num text-ink">{trace.sentence_loss_nats.toFixed(3)}</span> nats. During pretraining this number,
        averaged over trillions of tokens, is what gradient descent pushes down. A surprising word (&quot;{showTok(trace.positions.reduce((a, b) => (b.loss_nats > a.loss_nats ? b : a)).true_next)}&quot;) costs the most.
      </p>
    </Panel>
  );
}

function Backprop({ params }: { params: number }) {
  const x = 1.5, y = 3, lr = 0.05;
  const [w, setW] = useState({ w1: 0.5, w2: 0.8 });
  const [hist, setHist] = useState<number[]>([]);
  const s = backpropStep(x, y, w.w1, w.w2, lr);
  return (
    <Panel title="Backprop explorer" badge={<Toy>Two-weight network</Toy>}>
      <p className="text-[13px] leading-relaxed text-ink-2">Network: h = w₁ · x, ŷ = w₂ · h, loss = (ŷ − y)². Input x = {x}, target y = {y}, learning rate {lr}.</p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <ol className="grid gap-1 font-mono text-[12.5px] text-ink">
          <li><span className="font-sans text-ink-3">forward</span> h = {round(w.w1, 4)} × {x} = {round(s.h, 4)}</li>
          <li><span className="font-sans text-ink-3">forward</span> ŷ = {round(w.w2, 4)} × {round(s.h, 4)} = {round(s.yhat, 4)}</li>
          <li><span className="font-sans text-ink-3">loss</span> ({round(s.yhat, 4)} − {y})² = {round(s.loss, 5)}</li>
          <li><span className="font-sans text-ink-3">derivative</span> ∂L/∂ŷ = 2(ŷ − y) = {round(s.dL_dyhat, 4)}</li>
          <li><span className="font-sans text-ink-3">chain rule</span> ∂L/∂w₂ = ∂L/∂ŷ · h = {round(s.dL_dw2, 4)}</li>
          <li><span className="font-sans text-ink-3">chain rule</span> ∂L/∂w₁ = ∂L/∂ŷ · w₂ · x = {round(s.dL_dw1, 4)}</li>
          <li><span className="font-sans text-ink-3">update</span> w ← w − lr · ∂L/∂w → w₁ = {round(s.next.w1, 4)}, w₂ = {round(s.next.w2, 4)}</li>
        </ol>
        <div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setHist([...hist, s.loss]); setW(s.next); }} className="rounded bg-ink px-3 py-1 text-[12.5px] text-paper">Take one step</button>
            <button type="button" onClick={() => { setW({ w1: 0.5, w2: 0.8 }); setHist([]); }} className="rounded border border-rule-strong px-3 py-1 text-[12.5px] text-ink-2">Reset</button>
          </div>
          <p className="mt-3 text-[12.5px] text-ink-2">Loss after each step: <span className="font-mono text-ink">{[...hist, s.loss].map((l) => round(l, 4)).join(" → ")}</span></p>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-3">A gradient says how the loss would change if a parameter were nudged. Training Qwen3-8B applies the same chain rule to all {fmtInt(params)} parameters at once (automatic differentiation), and an optimizer such as AdamW turns gradients into updates.</p>
        </div>
      </div>
    </Panel>
  );
}

export function TrainingSection({ arch, trace }: { arch: Architecture; trace: TokenTrace }) {
  const steps = ["tokens", "forward pass", "logits", "cross-entropy", "loss", "backpropagation", "gradients", "optimizer", "weight update"];
  return (
    <section>
      <SectionHead n="7b" kicker="Learn · training, kept separate from inference" title="How Qwen learns" id="training">
        Training and inference use the same forward pass but differ in everything around it. This section is only about training.
      </SectionHead>
      <div className="grid gap-6">
        <Panel>
          <ol className="flex flex-wrap items-center gap-1.5" aria-label="Training loop">
            {steps.map((s, i) => <li key={s} className="flex items-center gap-1.5"><span className="rounded border border-rule-strong bg-paper-2/60 px-2 py-1 text-[13px] text-ink">{s}</span>{i < steps.length - 1 && <span aria-hidden className="text-ink-4">→</span>}</li>)}
          </ol>
          <Eq label="Loss equals minus the average over positions of the log probability of the true next token">L = −(1/T) Σ_t log p_θ(x_(t+1) | x_≤t)</Eq>
          <p className="text-[13px] leading-relaxed text-ink-2">
            All {fmtInt(arch.parameters.total)} parameters change during pretraining. The model does not store documents in a database: what it learns is spread across these weights,
            which is why it can sometimes reproduce famous text (see the Recall Microscope) without holding a copy that can be looked up.
          </p>
        </Panel>
        <TeacherForcing />
        <RealLoss trace={trace} />
        <Backprop params={arch.parameters.total} />
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Training vs inference">
            <table className="table-lab"><thead><tr><th></th><th>Training</th><th>Inference</th></tr></thead><tbody>
              <tr><th scope="row">Weights</th><td>updated</td><td>frozen</td></tr>
              <tr><th scope="row">Inputs</th><td>true tokens (teacher forcing)</td><td>the model&apos;s own previous outputs</td></tr>
              <tr><th scope="row">Positions</th><td>all at once, in parallel</td><td>one new token per step</td></tr>
              <tr><th scope="row">Output used</th><td>loss on every position</td><td>last position only, then a decoding rule</td></tr>
              <tr><th scope="row">KV cache</th><td>not needed</td><td>used to avoid recomputation</td></tr>
            </tbody></table>
          </Panel>
          <Panel title="Base model vs instruction model">
            <p className="text-[13.5px] leading-relaxed text-ink-2">
              <span className="font-medium text-ink">Base</span>: trained mainly by causal language modeling (the loss above) on a large corpus. The checkpoint card lists its training stage as
              &quot;{arch.model_card.training_stage}&quot;. <span className="font-medium text-ink">Instruct</span>: the base model plus post-training (instruction tuning, preference or reinforcement learning).
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
              LatentLens starts with the base model because we want representations of the pretrained language model without making assistant alignment the main confounder. This does
              not mean the base model is &quot;neutral&quot;: its pretraining data and recipe also shape what it represents.
            </p>
          </Panel>
        </div>
        <Callout>Decoding rules (greedy, temperature, top-k, top-p) and the KV cache belong to inference. Teacher forcing, the loss, gradients and the optimizer belong to training.</Callout>
      </div>
    </section>
  );
}

export function TeachBack({ topics }: { topics?: string[] }) {
  const qs = topics ? QUESTIONS.filter((q) => topics.includes(q.topic)) : QUESTIONS;
  const [only, setOnly] = useState<string | null>(null);
  const all = Array.from(new Set(QUESTIONS.map((q) => q.topic)));
  const shown = only ? qs.filter((q) => q.topic === only) : qs;
  return (
    <section>
      <SectionHead kicker="Learn · teach-back" title="Test my understanding" id="teachback">
        Answer out loud first, then reveal the explanation. If an answer surprises you, return to the section it came from.
      </SectionHead>
      {!topics && (
        <div className="mb-4 flex flex-wrap gap-1" role="radiogroup" aria-label="Filter by topic">
          {[null, ...all].map((t) => <button key={t ?? "all"} role="radio" aria-checked={only === t} onClick={() => setOnly(t)} className={cn("rounded border px-2 py-0.5 text-[12px]", only === t ? "border-ink bg-ink text-paper" : "border-rule-strong text-ink-3 hover:text-ink")}>{t ?? "all"}</button>)}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">{shown.map((q) => <Reveal key={q.id} topic={q.topic} question={q.q} answer={q.a} />)}</div>
    </section>
  );
}
