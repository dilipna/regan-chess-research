"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { trainStep } from "@/lib/latent/toy-model";
import { LineChart } from "../charts";
import { Check, Deeper, Prov, Segment, Slider, VectorBars } from "../kit";
import { LabFrame, Panel } from "./frame";

const CANDS = ["cat", "dog", "car", "sun"];
const H = [0.8, -0.4, 0.6];
const W0 = [[0.2, -0.1, 0.4, 0.0], [0.3, 0.2, -0.2, 0.1], [-0.1, 0.5, 0.1, -0.3]];

export function TrainingLab({ params }: { params: number }) {
  const [W, setW] = useState(W0);
  const [target, setTarget] = useState(1);
  const [lr, setLr] = useState(0.5);
  const [guess, setGuess] = useState<string | null>(null);
  const [hist, setHist] = useState<number[]>([]);
  const [last, setLast] = useState<{ before: number; after: number } | null>(null);
  const r = trainStep({ W, h: H }, target, lr);
  const reset = () => { setW(W0); setHist([]); setLast(null); setGuess(null); };
  return (
    <LabFrame slug="training" intro={<>A tiny model with one output layer guesses which of four words comes next. Training compares the guess with the correct word, computes the loss, the gradient, and nudges the weights. <strong>This website never trains Qwen</strong>; only these toy weights change.</>}>
      <Panel title="One example, one update at a time" badge={<Prov kind="toy" detail="3 inputs, 4 candidate words" />}>
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <span className="text-[15px]">Correct next word:</span>
          <Segment label="target" value={target} onChange={(v) => { setTarget(v); setLast(null); setGuess(null); }} options={CANDS.map((c, i) => ({ value: i, label: c }))} />
          <Slider label="learning rate η" value={lr} min={0.1} max={3} step={0.1} onChange={(v) => { setLr(v); setGuess(null); }} format={(v) => v.toFixed(1)} />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div><div className="mb-2 text-[13.5px] font-medium text-ink-2">Prediction (shares)</div>
            <ol className="grid gap-1.5">{CANDS.map((c, i) => (
              <li key={c} className={cn("grid grid-cols-[48px_1fr_60px] items-center gap-2 text-[14px]", i === target && "font-semibold")}>
                <span>{c}{i === target && " ◎"}</span><span className="relative h-4 rounded-r bg-paper-2"><span className="ll-anim absolute inset-y-0 left-0 rounded-r bg-[var(--role-resid)]" style={{ width: `${r.p[i] * 100}%` }} /></span>
                <span className="num text-right">{(r.p[i] * 100).toFixed(1)}%</span></li>))}</ol>
            <p className="mt-2 text-[15px]">Loss = −log p(target) = <strong className="num">{r.loss.toFixed(4)}</strong></p></div>
          <VectorBars values={r.dz} role="mlp" label="∂loss/∂score = p − target" height={110} />
          <div><div className="mb-2 text-[13.5px] font-medium text-ink-2">Update rule</div>
            <p className="font-mono text-[14px]">W ← W − η · hᵀ(p − target)</p>
            <p className="mt-2 text-[13.5px] text-ink-3">Every weight moves a little in the direction that lowers this example&apos;s loss.</p></div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl bg-paper-2/50 p-4 text-[15px]">
          <span>Predict: after one update p({CANDS[target]}) will…</span>
          {["go up", "stay the same", "go down"].map((x) => <button key={x} type="button" aria-pressed={guess === x} onClick={() => setGuess(x)} className={cn("rounded-lg border-2 px-3 py-1", guess === x ? "border-ink bg-ink text-paper" : "border-rule-strong")}>{x}</button>)}
          <button type="button" disabled={!guess} onClick={() => { setLast({ before: r.p[target], after: r.pNext[target] }); setHist([...hist, r.loss]); setW(r.next); }} className="rounded-lg bg-[var(--role-resid)] px-4 py-1.5 font-medium text-white disabled:opacity-40">Apply one update</button>
          <button type="button" onClick={reset} className="rounded-lg border-2 border-rule-strong px-3 py-1">↺ Reset weights</button>
        </div>
        {last && <p className="ll-pop mt-3 text-[15.5px]" aria-live="polite">p({CANDS[target]}) {last.before < last.after ? "rose" : "changed"} from {(last.before * 100).toFixed(1)}% to <strong>{(last.after * 100).toFixed(1)}%</strong>. {guess === "go up" ? "You predicted that." : "One gradient step on this example always raises the target's share here, because it raises the target's score and lowers the others."}</p>}
        {hist.length > 0 && <div className="mt-4"><LineChart title="Loss before each update" xLabel="update" yLabel="loss" height={180} series={[{ key: "l", label: "loss", color: "var(--role-resid)", points: [...hist, r.loss].map((y, x) => ({ x, y })) }]} /></div>}
      </Panel>
      <div className="grid gap-4 md:grid-cols-2">
        <Check id="lab-train-confident" prompt="If p(target) is already 99%, how big is the gradient for the target's score?" options={[
          { label: "Very large", feedback: "The gradient p − 1 is −0.01: the model is already nearly right, so the push is small." },
          { label: "Small (about −0.01)", correct: true, feedback: "Confident correct predictions produce small gradients; confident wrong ones produce large ones." },
        ]} />
        <Check id="lab-train-generate" prompt="Does generating text with a model update its weights?" options={[
          { label: "Yes, a little every time", feedback: "Generation only runs forward passes. Weights change only in a training step like the one above." },
          { label: "No", correct: true, feedback: "Inference reads the weights and never writes them." },
        ]} />
      </div>
      <Deeper label="From this toy to Qwen">Qwen3-8B-Base was pretrained with the same idea (predict the next token, cross-entropy loss, gradients through every layer by the chain rule, an optimizer step) applied to all {params.toLocaleString("en-US")} parameters over a very large corpus. Instruction-tuned and preference-optimized versions add further training stages; they are not claimed for the base checkpoint shown here.</Deeper>
    </LabFrame>
  );
}
