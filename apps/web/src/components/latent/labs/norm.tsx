"use client";

import { useState } from "react";
import { layernorm, rmsnorm } from "@/lib/latent/toy-model";
import type { Architecture } from "@/lib/latent/types";
import { LineChart } from "../charts";
import { Check, Deeper, Prov, RoleTag, Segment, Slider, TensorCard } from "../kit";
import { LabFrame, Panel } from "./frame";

const BASE = [2, -1, 4, 1];
const EPS = [1e-6, 0.01, 0.5, 4];
const fmt = (v: number, d = 3) => (Math.abs(v) >= 1000 ? v.toExponential(2) : v.toFixed(d));

/** Rows of signed bars on one shared scale, with optional reference lines (mean, ±RMS). */
function BarRow({ label, values, role, lines = [], scale }: { label: string; values: number[]; role: "resid" | "norm"; lines?: { v: number; label: string; dash?: boolean }[]; scale: number }) {
  const W = 420, H = 150, mid = H / 2, bw = 56, x0 = 70;
  const y = (v: number) => mid - (v / scale) * (mid - 14);
  return (
    <figure className={`role-${role} min-w-0`}>
      <figcaption className="mb-1 text-[13.5px] font-medium text-ink-2">{label}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-[520px]" role="img" aria-label={`${label}: ${values.map((v) => fmt(v, 2)).join(", ")}`}>
        <line x1="0" x2={W} y1={mid} y2={mid} stroke="var(--rule-strong)" />
        {values.map((v, i) => (
          <g key={i}>
            <rect className="ll-anim" x={x0 + i * (bw + 32)} y={Math.min(y(v), mid)} width={bw} height={Math.max(1.5, Math.abs(y(v) - mid))} rx="3" fill="var(--role)" />
            <text x={x0 + i * (bw + 32) + bw / 2} y={v >= 0 ? Math.max(11, y(v) - 4) : Math.min(H - 2, y(v) + 13)} textAnchor="middle" fontSize="12" className="font-mono" fill="var(--ink)">{fmt(v, 2)}</text>
          </g>
        ))}
        {lines.map((l, k) => (
          <g key={l.label}><line x1="64" x2={W} y1={y(l.v)} y2={y(l.v)} stroke="var(--ink)" strokeDasharray={l.dash ? "4 3" : undefined} strokeWidth="1.3" />
            <text x="60" y={y(l.v) + (k === 0 ? 10 : -3)} textAnchor="end" fontSize="11.5" fill="var(--ink)" fontWeight={600}>{l.label}</text></g>
        ))}
      </svg>
    </figure>
  );
}

export function RmsCore({ arch, compact }: { arch: Architecture; compact?: boolean }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState(0);
  const [eps, setEps] = useState(1e-6);
  const [gain, setGain] = useState([1, 1, 1, 1]);
  const x = BASE.map((v) => v * scale + offset);
  const r = rmsnorm(x, gain, eps);
  const ln = layernorm(x, gain, undefined, eps);
  const ref = rmsnorm(BASE, gain, eps);
  const sIn = Math.max(...x.map(Math.abs), 1e-9);
  const sOut = Math.max(...r.out.map(Math.abs), ...ln.out.map(Math.abs), 1e-9) * 1.1;
  const same = Math.max(...r.out.map((v, i) => Math.abs(v - ref.out[i])));
  const reset = () => { setScale(1); setOffset(0); setEps(1e-6); setGain([1, 1, 1, 1]); };
  const g = arch.norm_gains;
  return (
    <>
      <Panel title="Controls" badge={<Prov kind="toy" detail="4 numbers" />}>
        <div className="grid gap-5 md:grid-cols-3">
          <Slider label="scale (multiply every entry)" value={scale} min={0.01} max={10} step={0.01} onChange={setScale} format={(v) => `× ${v.toFixed(2)}`} />
          <Slider label="offset (add to every entry)" value={offset} min={-5} max={5} step={0.1} onChange={setOffset} format={(v) => (v >= 0 ? `+ ${v.toFixed(1)}` : `− ${(-v).toFixed(1)}`)} />
          <div><div className="mb-1 text-[13.5px] text-ink-2">epsilon (ε)</div><Segment label="epsilon" value={eps} onChange={setEps} options={EPS.map((e) => ({ value: e, label: e < 0.001 ? "1e-6 (Qwen)" : String(e) }))} /></div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-4">
          {gain.map((v, i) => <Slider key={i} label={`learned gain g${i}`} value={v} min={0} max={2} step={0.05} onChange={(n) => setGain(gain.map((o, j) => (j === i ? n : o)))} format={(n) => n.toFixed(2)} />)}
        </div>
        <button type="button" onClick={reset} className="mt-4 rounded-lg border-2 border-rule-strong px-3 py-1.5 text-[14px]">↺ Reset to [2, −1, 4, 1]</button>
      </Panel>
      <Panel title="Input" badge={<Prov kind="toy" />}>
        <BarRow label={`x = [${x.map((v) => fmt(v, 2)).join(", ")}]`} values={x} role="resid" scale={sIn * 1.15}
          lines={[{ v: ln.mean, label: `mean ${fmt(ln.mean, 2)}`, dash: true }, { v: Math.sqrt(r.meanSquare), label: `RMS ${fmt(Math.sqrt(r.meanSquare), 2)}` }]} />
      </Panel>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="RMSNorm (used by Qwen)" badge={<RoleTag role="norm">no mean subtraction</RoleTag>}>
          <ol className="mb-3 grid gap-1 font-mono text-[14px] text-ink">
            <li>mean(x²) = {fmt(r.meanSquare, 4)}</li>
            <li>denominator = √(mean(x²) + ε) = {fmt(r.denom, 4)}</li>
            <li>x / denominator, then × gain</li>
          </ol>
          <BarRow label="output" values={r.out} role="norm" scale={sOut} />
        </Panel>
        <Panel title="LayerNorm (for comparison)" badge={<RoleTag role="norm">subtracts the mean</RoleTag>}>
          <ol className="mb-3 grid gap-1 font-mono text-[14px] text-ink">
            <li>mean = {fmt(ln.mean, 4)}; x − mean = [{ln.centered.map((v) => fmt(v, 2)).join(", ")}]</li>
            <li>denominator = √(variance + ε) = {fmt(ln.denom, 4)}</li>
            <li>(x − mean) / denominator, then × gain (+ bias 0)</li>
          </ol>
          <BarRow label="output" values={ln.out} role="norm" scale={sOut} />
        </Panel>
      </div>
      <Panel title="What to notice (computed live)">
        <ul className="grid gap-2 text-[15px] text-ink-2">
          <li>RMSNorm output differs from the output for the original <span className="font-mono">[2, −1, 4, 1]</span> by at most <strong className="num text-ink">{fmt(same, 4)}</strong>. {offset === 0 ? (same < 0.01 ? "Scaling alone barely changes it: the denominator scales with the input." : "With a large ε the denominator no longer scales exactly with the input, so the output shrinks for small vectors.") : "A shift changes it, because RMSNorm does not subtract the mean."}</li>
          <li>LayerNorm output mean: <strong className="num text-ink">{fmt(ln.out.reduce((a, b) => a + b, 0) / 4, 4)}</strong> (with unit gains it is always about 0). RMSNorm output mean: <strong className="num text-ink">{fmt(r.out.reduce((a, b) => a + b, 0) / 4, 4)}</strong>.</li>
          <li>The gain multiplies <em>after</em> dividing: the learned weights g are fixed numbers, while the denominator ({fmt(r.denom, 3)}) is recomputed for every input.</li>
          <li>ε = {eps < 0.001 ? eps.toExponential() : eps}: {eps >= 0.5 ? "large compared with mean(x²) for small inputs, so tiny vectors are not blown up to unit size." : "tiny, so it only matters for vectors that are almost all zeros."} Try scale × 0.05 with ε = 4.</li>
        </ul>
      </Panel>
      {!compact && <TensorCard title="Recorded Qwen3-8B-Base RMSNorm gains (not the toy sliders)" kind="recorded" captured="input_layernorm.weight and post_attention_layernorm.weight in each block, read from the stored checkpoint"
        shape="[4,096] per norm, 36 blocks" shown="mean of the 4,096 gain values in each block">
        <LineChart title="Mean learned gain by block" xLabel="block" yLabel="mean gain" height={220}
          series={[{ key: "a", label: "before attention", color: "var(--role-norm)", points: g.input_layernorm.map((s) => ({ x: (s.layer ?? 0) + 1, y: s.mean })) },
            { key: "b", label: "before MLP", color: "var(--role-mlp)", dash: "6 3", points: g.post_attention_layernorm.map((s) => ({ x: (s.layer ?? 0) + 1, y: s.mean })) }]} />
        <p className="mt-2 text-[13.5px] text-ink-3">Qwen uses ε = {arch.verified.rms_norm_eps.toExponential()} and computes RMSNorm in float32. Block 1&apos;s gain averages {g.input_layernorm[0].mean.toFixed(4)}; the final norm&apos;s averages {g.final_norm.mean.toFixed(2)}. Q/K RMSNorm is a separate operation over {arch.verified.qk_norm_dim}-number head vectors with its own gains.</p>
      </TensorCard>}
      <Check id="lab-rms-scale" prompt="What happens to the RMSNorm output when the input vector is multiplied by ten?" options={[
        { label: "It becomes ten times larger", feedback: "The denominator (the RMS) also becomes ten times larger, so the ratio stays the same. Try the scale slider." },
        { label: "It stays (almost) the same", correct: true, feedback: "Only ε breaks exact scale invariance, and with ε = 1e-6 the effect is negligible unless the vector is almost zero." },
        { label: "Its mean becomes zero", feedback: "Making the mean zero is what LayerNorm does. RMSNorm never subtracts the mean." },
      ]} />
      <Deeper label="The formulas">
        <p className="font-mono">RMSNorm(x) = g ⊙ x / √((1/d) Σ x_i² + ε)</p>
        <p className="mt-1 font-mono">LayerNorm(x) = g ⊙ (x − μ) / √((1/d) Σ (x_i − μ)² + ε) + b</p>
        <p className="mt-2">If the mean μ is 0, the two coincide (apart from the bias). RMSNorm is cheaper and keeps the mean direction of the vector.</p>
      </Deeper>
    </>
  );
}

export function RmsLab({ arch }: { arch: Architecture }) {
  return (
    <LabFrame slug="rmsnorm" intro={<>Start with the toy vector <span className="font-mono">[2, −1, 4, 1]</span>. Change its overall size and shift it, then compare what each normalization does. The gain sliders stand for the <strong>learned</strong> weights, which are separate from the factor computed from the input.</>}>
      <RmsCore arch={arch} />
    </LabFrame>
  );
}
