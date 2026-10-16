"use client";

import { useState } from "react";
import { seededDraws, softmax } from "@/lib/latent/toy-model";
import type { GenerationSteps } from "@/lib/latent/types";
import { Check, Deeper, Prov, Segment, Slider, showTok } from "../kit";
import { probsAt } from "../journey/scenes-c";
import { LabFrame, Panel } from "./frame";

const TOY_TOKENS = ["sunny", "cloudy", "rainy", "windy", "snowy", "purple"];
const TOY_LOGITS = [3.1, 2.4, 1.9, 1.2, 0.3, -1.5];

/** Shannon entropy in nats. */
export const entropy = (p: number[]) => -p.reduce((s, x) => s + (x > 0 ? x * Math.log(x) : 0), 0);

function ProbBars({ labels, p, counts, total }: { labels: string[]; p: number[]; counts?: number[]; total?: number }) {
  return (
    <ol className="grid gap-1.5">
      {labels.map((l, i) => (
        <li key={i} className="grid grid-cols-[96px_1fr_64px_64px] items-center gap-2 text-[14px]">
          <span className="truncate font-mono whitespace-pre">{l}</span>
          <span className="relative h-5 rounded-r bg-paper-2"><span className="ll-anim absolute inset-y-0 left-0 rounded-r bg-[var(--role-resid)]" style={{ width: `${p[i] * 100}%` }} /></span>
          <span className="num text-right">{(p[i] * 100).toFixed(1)}%</span>
          {counts && <span className="num text-right text-ink-3">{counts[i]}/{total}</span>}
        </li>
      ))}
    </ol>
  );
}

export function SamplingLab({ gen }: { gen?: GenerationSteps }) {
  const [src, setSrc] = useState<"toy" | "recorded">("toy");
  const [T, setT] = useState(1);
  const [seed, setSeed] = useState(1);
  const [n, setN] = useState(50);
  const temps = gen ? Object.keys(gen.step1.logsumexp_by_temperature).map(Number).sort((a, b) => a - b) : [];
  const [Tr, setTr] = useState(1);
  const toyP = softmax(TOY_LOGITS, T);
  const draws = seededDraws(toyP, n, seed);
  const counts = TOY_TOKENS.map((_, i) => draws.filter((d) => d === i).length);
  const rec = gen ? probsAt(gen.step1, Tr) : null;
  const recLabels = gen ? [...gen.step1.top.slice(0, 8).map((t) => showTok(t.text)), "⟨all others⟩"] : [];
  const recP = rec ? [...rec.p.slice(0, 8), 1 - rec.p.slice(0, 8).reduce((a, b) => a + b, 0)] : [];
  const recDraws = rec ? seededDraws(recP, n, seed) : [];
  const recCounts = recP.map((_, i) => recDraws.filter((d) => d === i).length);
  return (
    <LabFrame slug="sampling" intro={<>The model produces scores (logits). <strong>Softmax</strong> turns them into shares of the total, and a sampling rule picks one token. Temperature divides the scores before softmax. At temperature 0 the rule is greedy: always the top token (no division by zero is performed).</>}>
      <Segment label="Data source" value={src} onChange={setSrc} options={[{ value: "toy", label: "Toy scores (any temperature)" }, { value: "recorded", label: "Recorded Qwen (fixed temperatures)" }]} />
      {src === "toy" ? (
        <Panel title='Toy: "Tomorrow the weather will be …"' badge={<Prov kind="toy" detail="6 made-up scores" />}>
          <div className="grid gap-5 md:grid-cols-3">
            <Slider label="temperature T" value={T} min={0} max={3} step={0.05} onChange={setT} format={(v) => (v === 0 ? "0 (greedy)" : v.toFixed(2))} />
            <Slider label="number of draws" value={n} min={10} max={200} step={10} onChange={setN} />
            <label className="text-[13.5px] text-ink-2">seed<input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} className="mt-1 block w-24 rounded border-2 border-rule-strong bg-paper px-2 py-1 text-[15px]" /></label>
          </div>
          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div><div className="mb-2 text-[13.5px] font-medium text-ink-2">Scores (logits): fixed by the model</div>
              <ol className="grid gap-1">{TOY_TOKENS.map((t, i) => <li key={t} className="flex justify-between font-mono text-[14px]"><span>{t}</span><span>{TOY_LOGITS[i].toFixed(1)}</span></li>)}</ol></div>
            <div><div className="mb-2 text-[13.5px] font-medium text-ink-2">Shares at T = {T === 0 ? "0 (greedy)" : T.toFixed(2)}, and draws</div>
              <ProbBars labels={TOY_TOKENS} p={toyP} counts={counts} total={n} />
              <p className="mt-2 text-[13.5px] text-ink-3">Entropy {entropy(toyP).toFixed(3)} nats. Shares sum to {(toyP.reduce((a, b) => a + b, 0) * 100).toFixed(1)}%. Same seed and settings give the same draws.</p></div>
          </div>
          <p className="mt-4 text-[15px] text-ink-2" aria-live="polite">{T === 0 ? "Greedy: every draw is “sunny”, the token with the highest score." : T < 0.6 ? "Low temperature: the top token dominates." : T > 1.6 ? "High temperature: even “purple” gets drawn sometimes." : "Moderate temperature: several tokens are drawn."} The scores themselves never changed.</p>
        </Panel>
      ) : gen && rec ? (
        <Panel title='Recorded: next token after "The researcher opened the notebook"' badge={<Prov kind="recorded" detail="exact normalizers per temperature" />}>
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <Segment label="Temperature" value={Tr} onChange={setTr} options={temps.map((x) => ({ value: x, label: `T=${x}` }))} />
            <label className="text-[13.5px] text-ink-2">seed <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} className="w-24 rounded border-2 border-rule-strong bg-paper px-2 py-1" /></label>
          </div>
          <ProbBars labels={recLabels} p={recP} counts={recCounts} total={n} />
          <p className="mt-3 text-[13.5px] text-ink-3">Only the temperatures listed were recorded, each with the exact normalizer over all 151,936 rows. Other temperatures are not offered here because they could not be computed exactly from the recorded top tokens.</p>
        </Panel>
      ) : <p className="text-[14px] text-ink-3">Recorded generation steps are missing from this build.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <Check id="lab-temp-better" prompt="Does increasing the temperature guarantee a better answer?" options={[
          { label: "Yes, the model reasons more", feedback: "Temperature is applied after the scores are computed. It changes which token is drawn, not how the model computed its scores." },
          { label: "No, it only changes how varied the choices are", correct: true, feedback: "Higher T gives unlikely tokens more chances. That adds variety and can also add errors. Factual reliability is not improved by T." },
        ]} />
        <Check id="lab-temp-weights" prompt="Does changing the temperature change the model's weights?" options={[
          { label: "Yes", feedback: "Weights are fixed at inference. Temperature is a setting of the decoding rule." },
          { label: "No", correct: true, feedback: "Temperature only rescales the scores before softmax, at generation time." },
        ]} />
      </div>
      <Deeper label="The formula and the greedy limit">p_i = exp(z_i / T) / Σ_j exp(z_j / T). As T → 0 the largest score takes all the probability, so T = 0 is implemented directly as “choose the argmax”, never by dividing by zero. Top-k and top-p further restrict which tokens can be drawn.</Deeper>
    </LabFrame>
  );
}
