"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { TOY_VOCAB, TOY_WEIGHTS, seededDraws, trainStep } from "@/lib/latent/toy-model";
import type { Distribution } from "@/lib/latent/types";
import { AnalogyLimit, Check, Deeper, Prov, RoleTag, Segment, Slider, TensorCard, VectorBars, showTok } from "../kit";
import { SceneFrame, SceneText, byLevel, type SceneProps } from "./common";

/** Exact probabilities of the recorded top tokens at temperature T (normalised over the FULL vocabulary with a
 *  recorded log-sum-exp), plus the probability left for all unrecorded tokens. T = 0 means greedy. */
export function probsAt(d: Distribution, T: number): { p: number[]; other: number } {
  if (T === 0) return { p: d.top.map((_, i) => (i === 0 ? 1 : 0)), other: 0 };
  const key = Object.keys(d.logsumexp_by_temperature).find((k) => Number(k) === T);
  if (key === undefined) throw new Error(`no normaliser recorded for T=${T}`);
  const lse = d.logsumexp_by_temperature[key];
  const p = d.top.map((t) => Math.exp(t.logit / T - lse));
  return { p, other: Math.max(0, 1 - p.reduce((a, b) => a + b, 0)) };
}

function Bars({ items, highlight, role = "out" }: { items: { label: string; value: number; sub?: string }[]; highlight?: number; role?: "out" | "attn" }) {
  const M = Math.max(...items.map((i) => i.value), 1e-9);
  return (
    <ol className="grid gap-1.5">
      {items.map((it, i) => (
        <li key={i} className={cn("grid grid-cols-[96px_1fr_64px] items-center gap-2 text-[14px]", highlight === i && "font-semibold")}>
          <span className="truncate font-mono whitespace-pre">{it.label}</span>
          <span className="relative h-5 rounded-r bg-paper-2"><span className={cn("ll-anim absolute inset-y-0 left-0 rounded-r", role === "attn" ? "bg-[var(--role-attn)]" : "bg-[var(--role-resid)]", highlight === i && "ring-2 ring-ink")} style={{ width: `${(it.value / M) * 100}%` }} /></span>
          <span className="num text-right">{it.sub}</span>
        </li>
      ))}
    </ol>
  );
}

// ===================================================================================== Scene 7: output
export function SceneOutput({ st, data }: SceneProps) {
  const lvl = st.level, g = data.gen;
  const [mode, setMode] = useState<"greedy" | "sample">("greedy");
  const temps = g ? Object.keys(g.step1.logsumexp_by_temperature).map(Number).sort((a, b) => a - b) : [];
  const [T, setT] = useState(1);
  const [seed, setSeed] = useState(7);
  const [appended, setAppended] = useState<number | null>(null);
  if (!g) return <p className="text-[14px] text-ink-3">The recorded generation steps are missing from this build.</p>;
  const d = g.step1, show = 10;
  const { p, other } = probsAt(d, mode === "greedy" ? 0 : T);
  const pT1 = probsAt(d, 1).p;
  const draws = mode === "sample" ? seededDraws([...p, other], 20, seed) : [];
  const chosen = mode === "greedy" ? 0 : draws[0];
  const chosenTok = chosen < d.top.length ? d.top[chosen] : null;
  const next = appended !== null ? g.step2.find((s) => s.appended.id === appended) : undefined;
  const counts = new Map<number, number>();
  draws.forEach((x) => counts.set(x, (counts.get(x) ?? 0) + 1));
  return (
    <SceneFrame
      visual={
        <div className="ll-panel grid gap-5 rounded-2xl border border-rule bg-paper p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2"><RoleTag role="out">final RMSNorm → LM head → shares → choice</RoleTag><Prov kind="recorded" detail="Qwen3-8B-Base, one forward pass" /></div>
          <p className="font-serif text-[24px] text-ink">The researcher opened the notebook<span className="text-ink-4">{appended !== null ? "" : " ▢"}</span>{appended !== null && <span className="ll-pop rounded bg-[var(--role-resid-soft)] px-1 font-mono">{showTok(g.step2.find((s) => s.appended.id === appended)?.appended.text ?? "")}</span>}{appended !== null && <span className="text-ink-4"> ▢</span>}</p>
          <div className="flex flex-wrap items-center gap-4">
            <Segment label="Choosing rule" value={mode} onChange={(m) => { setMode(m); setAppended(null); }} options={[{ value: "greedy", label: "Greedy (always the top)" }, { value: "sample", label: "Sample" }]} />
            {mode === "sample" && <>
              <Segment label="Temperature" value={T} onChange={(v) => { setT(v); setAppended(null); }} options={temps.map((x) => ({ value: x, label: `T=${x}` }))} />
              <label className="flex items-center gap-2 text-[14px] text-ink-2">seed <input type="number" value={seed} onChange={(e) => { setSeed(Number(e.target.value) || 0); setAppended(null); }} className="w-20 rounded border-2 border-rule-strong bg-paper px-2 py-0.5" /></label>
            </>}
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {lvl !== "story" && <div><div className="mb-2 text-[13px] font-medium text-ink-2">Scores (logits), top {show}</div><Bars items={d.top.slice(0, show).map((t) => ({ label: showTok(t.text), value: Math.max(0, t.logit - d.top[show - 1].logit + 0.5), sub: t.logit.toFixed(2) }))} /></div>}
            <div className={cn(lvl === "story" && "md:col-span-2")}><div className="mb-2 text-[13px] font-medium text-ink-2">{mode === "greedy" ? "Shares of the total (T = 1); greedy takes the top one" : `Shares of the total at temperature ${T}`}</div>
              <Bars items={d.top.slice(0, show).map((t, i) => ({ label: showTok(t.text), value: mode === "greedy" ? pT1[i] : p[i], sub: `${((mode === "greedy" ? pT1[i] : p[i]) * 100).toFixed(1)}%` }))} highlight={chosen < show ? chosen : undefined} />
              <p className="mt-1 text-[12.5px] text-ink-3">All other {(data.arch.verified.vocab_size - d.top.length).toLocaleString("en-US")} rows together: {(((mode === "greedy" ? probsAt(d, 1).other : other)) * 100).toFixed(1)}%.</p>
            </div>
          </div>
          {mode === "sample" && (
            <div className="rounded-xl bg-paper-2/50 p-4">
              <div className="mb-1 text-[13px] font-medium text-ink-2">20 seeded draws (seed {seed}): the first draw is the choice</div>
              <p className="font-mono text-[14px] break-words">{draws.map((x) => (x < d.top.length ? showTok(d.top[x].text) : "⟨other⟩")).join("  ")}</p>
              <p className="mt-1 text-[12.5px] text-ink-3">{[...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([x, c]) => `${x < d.top.length ? showTok(d.top[x].text) : "⟨other⟩"} ×${c}`).join(" · ")}. Same seed, same draws: press Reset to reproduce.</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[15px] text-ink">Chosen: <strong className="font-mono">{chosenTok ? showTok(chosenTok.text) : "a token outside the 20 recorded"}</strong></span>
            <button type="button" disabled={!chosenTok} onClick={() => chosenTok && setAppended(chosenTok.id)} className="rounded-lg bg-ink px-4 py-1.5 text-[14px] font-medium text-paper disabled:opacity-40">Append and look at the next step</button>
            <button type="button" onClick={() => { setAppended(null); setSeed(7); setT(1); setMode("greedy"); }} className="rounded-lg border-2 border-rule-strong px-3 py-1.5 text-[14px]">↺ Reset</button>
          </div>
          {appended !== null && (next ? (
            <div className="ll-pop rounded-xl border-2 border-[var(--role-resid)] p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="text-[14px] font-medium">Next step after “{showTok(next.appended.text)}” (recorded, T = 1)</span><Prov kind="recorded" /></div>
              <Bars items={next.top.slice(0, 6).map((t) => ({ label: showTok(t.text), value: t.p, sub: `${(t.p * 100).toFixed(1)}%` }))} />
            </div>
          ) : (
            <p className="ll-pop rounded-xl border-2 border-dashed border-rule-strong p-4 text-[14px] text-ink-2">The next step after “{showTok(d.top.find((t) => t.id === appended)?.text ?? "")}” was not recorded (only the top {g.step2.length} candidates were). This page does not run the model, so it shows nothing rather than a guess.</p>
          ))}
          {lvl === "research" && (
            <Deeper label="Two recordings of the same sentence differ slightly">
              This scene uses one recording (sdpa attention, bfloat16): p(“.”) = {(d.top[0].p * 100).toFixed(1)}%. The trace used in earlier scenes (eager attention, bfloat16) gives {(data.trace.final.top[0].p * 100).toFixed(1)}% for the same token. Same model and text; the difference comes from bfloat16 rounding in different kernels. Near-ties can change order between such runs.
            </Deeper>
          )}
        </div>
      }
      side={<>
        <SceneText
          tryThis={mode === "greedy" ? "Switch to “Sample”, try T = 0.25 and T = 2, then change the seed. Finally press “Append”." : "Change the temperature and the seed, then append the chosen token."}
          consequence={mode === "greedy" ? <>Greedy always picks “{showTok(d.top[0].text)}”, the highest share ({(pT1[0] * 100).toFixed(1)}%).</> : <>At T = {T}, “{showTok(d.top[0].text)}” has {(p[0] * 100).toFixed(1)}% (it was {(pT1[0] * 100).toFixed(1)}% at T = 1). The first draw chose {chosenTok ? `“${showTok(chosenTok.text)}”` : "a token outside the recorded 20"}.</>}
          explain={byLevel(lvl, {
            story: <>The last vector becomes one <strong>score</strong> for every possible token. To <strong>turn scores into shares of the total</strong> (this step is called <em>softmax</em>), larger scores get larger shares. Then a rule picks one token, and the whole process repeats with the new token added.</>,
            mechanics: <><span className="font-mono">p_i = exp(z_i/T) / Σ_j exp(z_j/T)</span>. Greedy is the limit T → 0 and is handled as argmax (no division by zero). Shares here use exact normalizers over all {data.arch.verified.vocab_size.toLocaleString("en-US")} rows recorded for each T.</>,
            research: <>Qwen3-8B-Base: final RMSNorm (model.norm), then lm_head [{data.arch.verified.vocab_size.toLocaleString("en-US")} × {data.arch.verified.hidden_size.toLocaleString("en-US")}], not tied to the embedding. Two real generation steps were recorded; nothing here is computed live.</>,
          })}
        />
        <AnalogyLimit analogy="A raffle: each token holds tickets in proportion to its share, and temperature changes how evenly tickets are handed out." limit="Temperature is applied when generating, after the model has computed its scores. It does not change the weights, add knowledge, or make an answer more or less factual." />
        <Link href="/latent/play" className="rounded-xl border-2 border-[var(--role-resid)] bg-[var(--role-resid-soft)] p-4 text-[15px] text-ink hover:border-ink">
          <span className="block text-[12px] font-semibold tracking-wide text-[var(--role-resid-ink)] uppercase">You vs Qwen</span>
          Try predicting the next word yourself, against Qwen&apos;s recorded answers →
        </Link>
        <Check id="output-temperature" prompt="Does increasing the temperature guarantee a better answer?" options={[
          { label: "Yes, it makes the model think harder", feedback: "Temperature does not change the computation that produced the scores. It only reshapes the shares before sampling." },
          { label: "No, it only makes choices more varied", correct: true, feedback: "Higher T flattens the shares, so less likely tokens are chosen more often. That can help variety or hurt accuracy." },
        ]} />
      </>}
    />
  );
}

// ===================================================================================== Scene 8: learning vs using
export function SceneLearning({ st, data, toy }: SceneProps) {
  const lvl = st.level;
  const h = toy.finalNorm[5].out;
  const [W, setW] = useState<number[][]>(TOY_WEIGHTS.Wlm);
  const [target, setTarget] = useState(2);
  const [lr, setLr] = useState(0.5);
  const [guess, setGuess] = useState<"up" | "down" | "same" | null>(null);
  const [applied, setApplied] = useState<{ before: number; after: number; lossB: number; lossA: number } | null>(null);
  const [steps, setSteps] = useState(0);
  const [mode, setMode] = useState<"train" | "infer">("train");
  const r = trainStep({ W, h }, target, lr);
  const checksum = (M: number[][]) => M.flat().reduce((a, b) => a + b, 0).toFixed(4);
  const apply = () => { setApplied({ before: r.p[target], after: r.pNext[target], lossB: r.loss, lossA: r.lossNext }); setW(r.next); setSteps(steps + 1); };
  const reset = () => { setW(TOY_WEIGHTS.Wlm); setApplied(null); setGuess(null); setSteps(0); };
  return (
    <SceneFrame
      visual={
        <div className="ll-panel grid gap-5 rounded-2xl border border-rule bg-paper p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segment label="Mode" value={mode} onChange={setMode} options={[{ value: "train", label: "Training (weights change)" }, { value: "infer", label: "Using the model (weights fixed)" }]} />
            <Prov kind="toy" detail="one toy output layer, 8 tokens" />
          </div>
          {mode === "train" ? (<>
            <div className="flex flex-wrap items-center gap-3 text-[15px]">
              <span>Correct next token (target):</span>
              <Segment label="Target token" value={target} onChange={(v) => { setTarget(v); setApplied(null); setGuess(null); }} options={TOY_VOCAB.map((t, i) => ({ value: i, label: <span className="font-mono">{showTok(t)}</span> }))} />
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div><div className="mb-2 text-[13px] font-medium text-ink-2">Prediction now (shares)</div>
                <ol className="grid gap-1">{TOY_VOCAB.map((t, i) => (
                  <li key={i} className={cn("grid grid-cols-[64px_1fr_56px] items-center gap-2 text-[14px]", i === target && "font-semibold")}>
                    <span className="font-mono">{showTok(t)}{i === target && " ◎"}</span>
                    <span className="relative h-4 rounded-r bg-paper-2"><span className="ll-anim absolute inset-y-0 left-0 rounded-r bg-[var(--role-resid)]" style={{ width: `${r.p[i] * 100}%` }} /></span>
                    <span className="num text-right">{(r.p[i] * 100).toFixed(1)}%</span></li>))}</ol>
                <p className="mt-2 text-[14px]">Loss = −log p(target) = <strong className="num">{r.loss.toFixed(3)}</strong></p>
              </div>
              <div>
                <VectorBars values={r.dz} role="mlp" label="gradient of the loss w.r.t. each score (p − target)" height={110} />
                <p className="mt-1 text-[12.5px] text-ink-3">Negative for the target (raising its score lowers the loss), positive for the others.</p>
              </div>
            </div>
            <div className="grid gap-3 rounded-xl bg-paper-2/50 p-4">
              <Slider label="learning rate" value={lr} min={0.1} max={2} step={0.1} onChange={(v) => { setLr(v); setApplied(null); setGuess(null); }} />
              <div className="flex flex-wrap items-center gap-2 text-[15px]">
                <span>Predict: after one update, p(target) will…</span>
                {(["up", "same", "down"] as const).map((x) => <button key={x} type="button" aria-pressed={guess === x} onClick={() => setGuess(x)} className={cn("rounded-lg border-2 px-3 py-1", guess === x ? "border-ink bg-ink text-paper" : "border-rule-strong")}>{x === "up" ? "go up" : x === "down" ? "go down" : "stay the same"}</button>)}
                <button type="button" disabled={!guess} onClick={apply} className="rounded-lg bg-[var(--role-resid)] px-4 py-1.5 font-medium text-[var(--on-role)] disabled:opacity-40">Apply one update</button>
                <button type="button" onClick={reset} className="rounded-lg border-2 border-rule-strong px-3 py-1">↺ Reset weights</button>
              </div>
              {applied && (
                <p className="ll-pop text-[15px]" aria-live="polite">
                  p(target) went from {(applied.before * 100).toFixed(1)}% to <strong>{(applied.after * 100).toFixed(1)}%</strong>; loss {applied.lossB.toFixed(3)} → {applied.lossA.toFixed(3)}.{" "}
                  {guess === "up" ? "Your prediction was right: a gradient step moves the target's score up." : "The target's share went up: the update moves weights in the direction that lowers the loss for this example."} Updates so far: {steps}.
                </p>
              )}
            </div>
          </>) : (
            <div className="grid gap-3 text-[15px]">
              <p>When the model is used, the same forward pass runs, a token is chosen, appended, and the pass runs again. The weights are read, never written.</p>
              <p className="rounded-xl bg-paper-2/60 p-4 font-mono text-[14px]">toy weight checksum: {checksum(W)} → generate 5 tokens → {checksum(W)} (unchanged)</p>
              <p className="text-[13px] text-ink-3">This website never trains Qwen. The real model&apos;s weights were fixed when it was released.</p>
            </div>
          )}
          {lvl !== "story" && (
            <TensorCard title="Real training objective on our sentence (no weights changed)" kind="recorded" captured="final logits of one forward pass, each position scored against the true next token" shape="5 targets" shown="loss = −log p(true next token) per position">
              <table className="table-lab"><tbody>{data.trace.positions.map((p, i) => (
                <tr key={i}><td className="font-mono text-[13px]">{p.context ? showTok(p.context) : "⟨start⟩"} → <strong>{showTok(p.true_next)}</strong></td><td className="num r">{p.loss_nats.toFixed(2)} nats</td></tr>
              ))}</tbody></table>
              <p className="mt-2 text-[12.5px] text-ink-3">Average {data.trace.sentence_loss_nats.toFixed(2)} nats. Pretraining lowers this average over trillions of tokens.</p>
            </TensorCard>
          )}
          <div className="overflow-x-auto">
            <table className="table-lab">
              <thead><tr><th>Stage</th><th>What it trains on</th><th>Applies to the inspected checkpoint?</th></tr></thead>
              <tbody>
                <tr><th scope="row">Pretraining</th><td>predict the next token of large text corpora</td><td>Yes: the model card lists Qwen3-8B-Base&apos;s training stage as “{data.arch.model_card.training_stage}”.</td></tr>
                <tr><th scope="row">Supervised fine-tuning</th><td>example prompts with desired responses</td><td>Used for instruction/chat models. Not claimed for this base checkpoint.</td></tr>
                <tr><th scope="row">Preference optimization</th><td>comparisons between better and worse responses</td><td>Used for aligned chat models. Not claimed for this base checkpoint.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      }
      side={<>
        <SceneText
          tryThis="Pick a target token, predict what one update will do, then apply it. Switch to “Using the model” and compare."
          consequence={applied ? <>One update raised p(target) by {((applied.after - applied.before) * 100).toFixed(1)} percentage points and lowered the loss.</> : <>Current loss for the target: {r.loss.toFixed(3)}. Nothing has changed yet.</>}
          explain={byLevel(lvl, {
            story: <>During <strong>training</strong>, the model guesses the next token, is told the right answer, and every weight is nudged so that answer becomes a little more likely. When the model is <strong>used</strong>, the weights stay fixed.</>,
            mechanics: <>Loss L = −log p_target. For softmax scores the gradient is ∂L/∂z = p − onehot(target); the chain rule carries it back to every weight, and the optimizer applies <span className="font-mono">W ← W − η ∂L/∂W</span>.</>,
            research: <>Pretraining applies this to all {data.arch.parameters.total.toLocaleString("en-US")} parameters with teacher forcing (true previous tokens). The table shows the real per-position loss on our sentence from one forward pass; no gradient was computed.</>,
          })}
        />
        {lvl === "story" && <AnalogyLimit analogy="Like practising with an answer key: after each guess you see the right answer and adjust a little. Using the model is the exam, with no answer key and no adjusting." limit="Training does not file the answers away. It nudges billions of shared numbers, so many examples blend together; the model keeps no list of the individual practice examples." />}
        <Check id="learning-weights" prompt="Does generating another token update the model's weights?" options={[
          { label: "Yes, it learns from each word it writes", feedback: "Generation only runs the forward pass. Weights change only during training." },
          { label: "No, the weights stay fixed", correct: true, feedback: "Using the model reads the weights; only a training step (loss, gradient, update) changes them." },
        ]} />
        <div className="rounded-xl border-2 border-[var(--role-attn)] bg-[var(--role-attn-soft)] p-4">
          <div className="text-[12px] font-semibold tracking-wide text-[var(--role-attn-ink)] uppercase">The research question this leads to</div>
          <p className="mt-1 text-[16px] text-ink">Can we measure whether these internal representations contain information useful for distinguishing human-written from AI-generated text?</p>
          <p className="mt-2 text-[13.5px] text-ink-2">A successful probe would show predictive information under one evaluation protocol. It would not be a reliable proof of who wrote a text. <Prov kind="pending" /></p>
          <Link href="/latent/research" className="mt-3 inline-block rounded-lg bg-ink px-4 py-1.5 text-[14px] font-medium text-paper">Open the research workspace →</Link>
        </div>
      </>}
    />
  );
}
