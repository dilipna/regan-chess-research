"use client";

import { useState } from "react";
import { fmtEps, layernorm, rmsnormSteps, round } from "@/lib/latent/toy";
import type { Architecture, TokenTrace } from "@/lib/latent/types";
import { LineChart, SERIES } from "./charts";
import { Callout, Eq, Measured, Panel, SectionHead, Shape, Toy } from "./shell";

const TOY = [2, -1, 4, 1];

function NumInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <input type="number" step="0.5" value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))}
      className="num w-16 rounded border border-rule-strong bg-paper px-1.5 py-1 text-right text-[13px] text-ink" />
  );
}

const vec = (v: number[], d = 3) => `[${v.map((x) => round(x, d)).join(", ")}]`;

export function RmsToy({ eps }: { eps: number }) {
  const [x, setX] = useState<number[]>(TOY);
  const [g, setG] = useState<number[]>([1, 1, 1, 1]);
  const s = rmsnormSteps(x, g, eps);
  const ln = layernorm(x);
  const cos = (a: number[], b: number[]) => a.reduce((t, v, i) => t + v * b[i], 0) / (Math.hypot(...a) * Math.hypot(...b) || 1);
  return (
    <Panel title="RMSNorm step by step" badge={<Toy>Toy vector, d = 4</Toy>}>
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
        x =
        {x.map((v, i) => <NumInput key={i} value={v} label={`x${i + 1}`} onChange={(n) => setX(x.map((o, j) => (j === i ? n : o)))} />)}
        <span className="ml-2">gain g =</span>
        {g.map((v, i) => <NumInput key={i} value={v} label={`g${i + 1}`} onChange={(n) => setG(g.map((o, j) => (j === i ? n : o)))} />)}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setX(x.map((v) => v * 10))} className="rounded border border-rule-strong px-2 py-0.5 text-[12px] text-ink-2 hover:text-ink">Scale x by 10</button>
        <button type="button" onClick={() => setX(x.map((v) => v + 5))} className="rounded border border-rule-strong px-2 py-0.5 text-[12px] text-ink-2 hover:text-ink">Add 5 to every entry</button>
        <button type="button" onClick={() => { setX(TOY); setG([1, 1, 1, 1]); }} className="rounded border border-rule-strong px-2 py-0.5 text-[12px] text-ink-2 hover:text-ink">Reset to [2, -1, 4, 1]</button>
      </div>
      <ol className="mt-4 grid gap-2 text-[13.5px] text-ink-2">
        <li><span className="text-ink-3">1. squares</span> <span className="font-mono text-ink">{vec(s.squares)}</span></li>
        <li><span className="text-ink-3">2. mean squared magnitude</span> <span className="font-mono text-ink">(1/4) · {round(s.squares.reduce((a, b) => a + b, 0))} = {round(s.meanSquare, 4)}</span></li>
        <li><span className="text-ink-3">3. square root (with eps = {fmtEps(eps)})</span> <span className="font-mono text-ink">RMS = sqrt({round(s.meanSquare, 4)} + {fmtEps(eps)}) = {round(s.rms, 4)}</span></li>
        <li><span className="text-ink-3">4. divide by RMS</span> <span className="font-mono text-ink">x / RMS = {vec(s.normalized)}</span> <span className="text-ink-3">(its RMS is now {round(Math.sqrt(s.normalized.reduce((a, v) => a + v * v, 0) / 4), 4)})</span></li>
        <li><span className="text-ink-3">5. learned gain</span> <span className="font-mono text-ink">g ⊙ (x / RMS) = {vec(s.out)}</span></li>
      </ol>
      <Eq label="RMS of x equals the square root of the mean of x squared plus epsilon. RMSNorm of x equals g times x divided by RMS of x.">
        RMS(x) = sqrt( (1/d) Σ x_i² + ε ) <br />RMSNorm(x) = g ⊙ x / RMS(x)
      </Eq>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded border border-rule bg-paper-2/50 p-3">
          <div className="text-[12px] font-medium text-ink">LayerNorm on the same x (gain 1, bias 0)</div>
          <div className="mt-1 font-mono text-[12.5px] leading-relaxed text-ink-2">mean = {round(ln.mean, 3)}<br />x - mean = {vec(ln.centered)}<br />std = {round(ln.sd, 4)}<br />output = {vec(ln.out)}</div>
        </div>
        <div className="rounded border border-rule bg-paper-2/50 p-3 text-[12.5px] leading-relaxed text-ink-2">
          <div className="text-[12px] font-medium text-ink">What changed and what was kept</div>
          cosine(x, RMSNorm(x)) = <span className="num text-ink">{round(cos(x, s.out), 4)}</span> {g.every((v) => v === g[0]) && g[0] > 0 ? "(direction kept exactly when the gain is uniform)" : "(a non-uniform gain reweights coordinates)"}<br />
          cosine(x, LayerNorm(x)) = <span className="num text-ink">{round(cos(x, ln.out), 4)}</span> (mean subtraction changes the direction)<br />
          Try the two buttons: scaling x leaves both outputs unchanged; adding a constant changes the RMSNorm output but not the LayerNorm output.
        </div>
      </div>
    </Panel>
  );
}

export function RmsnormLab({ arch, trace }: { arch: Architecture; trace: TokenTrace }) {
  const v = arch.verified, g = arch.norm_gains;
  const last = trace.tokens.length - 1;
  const gainSeries = [
    { key: "in", label: "input_layernorm", color: SERIES.a, points: g.input_layernorm.map((s) => ({ x: (s.layer ?? 0) + 1, y: s.mean })) },
    { key: "post", label: "post_attention_layernorm", color: SERIES.b, dash: "5 3", points: g.post_attention_layernorm.map((s) => ({ x: (s.layer ?? 0) + 1, y: s.mean })) },
  ];
  const normSeries = [
    { key: "resid", label: "residual entering block", color: SERIES.a, points: trace.layers.map((l) => ({ x: l.layer + 1, y: l.resid_pre_rms[last] })) },
    { key: "normed", label: "RMSNorm #1 output", color: SERIES.b, dash: "5 3", points: trace.layers.map((l) => ({ x: l.layer + 1, y: l.attn_norm_rms[last] })) },
  ];
  const qk = trace.qk_norm["0"];
  return (
    <section>
      <SectionHead n={4} kicker="Learn" title="RMSNorm lab" id="rmsnorm">
        LayerNorm centers a vector and rescales it. RMSNorm only rescales it, by its root-mean-square magnitude, and then multiplies by a learned gain.
        Qwen3 uses RMSNorm everywhere, in two different roles that must not be confused.
      </SectionHead>
      <div className="grid gap-6">
        <RmsToy eps={v.rms_norm_eps} />
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel badge={<Measured />}>
            <LineChart title="The stream grows by orders of magnitude; the normalized copy follows the learned gain" series={normSeries} logY xLabel="block" yLabel="RMS (log)"
              caption={<>Last token of &quot;{trace.text}&quot;. The residual stream entering each block grows by orders of magnitude; the input that attention actually reads
                has RMS set by the learned gain of that block (compare the gain chart), not by the size of the stream. The stream itself is never normalized between blocks.</>} />
          </Panel>
          <Panel badge={<Measured>Stored weights</Measured>}>
            <LineChart title="Learned gain g, mean over its 4096 entries" series={gainSeries} xLabel="block" yLabel="mean gain"
              caption={<>The gains are learned, not fixed at 1. Block 1&apos;s input gain averages {g.input_layernorm[0].mean.toFixed(4)}; the final norm&apos;s gain averages {g.final_norm.mean.toFixed(2)}.
                Because the gain is a vector, RMSNorm can change the relative sizes of coordinates; a negative gain entry would flip a coordinate&apos;s sign. The smallest
                input_layernorm gain entry in any block is {Math.min(...g.input_layernorm.map((s) => s.min)).toFixed(5)}.</>} />
          </Panel>
        </div>
        <Panel title="Block RMSNorm and Q/K RMSNorm are different operations" badge={<Measured>Layer 1, last token</Measured>}>
          <div className="scroll-x">
            <table className="table-lab">
              <thead><tr><th></th><th>Block RMSNorm</th><th>Q / K RMSNorm</th></tr></thead>
              <tbody>
                <tr><th scope="row">Modules</th><td className="font-mono text-[12px]">input_layernorm, post_attention_layernorm, model.norm</td><td className="font-mono text-[12px]">self_attn.q_norm, self_attn.k_norm</td></tr>
                <tr><th scope="row">Normalizes</th><td>the whole hidden vector of a position</td><td>one head vector (Q or K) of a position</td></tr>
                <tr><th scope="row">Dimension</th><td><Shape>{v.hidden_size}</Shape></td><td><Shape>{v.qk_norm_dim}</Shape></td></tr>
                <tr><th scope="row">Where</th><td>before attention, before the MLP, after the last block</td><td>inside attention, after q_proj/k_proj and reshape, before RoPE</td></tr>
                <tr><th scope="row">Gain shared across</th><td>nothing (one {v.hidden_size}-vector per norm)</td><td>all {v.num_attention_heads} query heads (q_norm) or all {v.num_key_value_heads} KV heads (k_norm) of a layer</td></tr>
                <tr><th scope="row">V normalized?</th><td colSpan={2}>No. Values are neither normalized nor rotated.</td></tr>
                <tr><th scope="row">Measured, block 1</th>
                  <td>residual RMS {trace.layers[0].resid_pre_rms[last].toFixed(4)} → normalized input RMS {trace.layers[0].attn_norm_rms[last].toFixed(4)}</td>
                  <td>query head RMS {Math.min(...qk.q_norm.rms_in).toFixed(3)} to {Math.max(...qk.q_norm.rms_in).toFixed(3)} → {Math.min(...qk.q_norm.rms_out).toFixed(2)} to {Math.max(...qk.q_norm.rms_out).toFixed(2)} across the {qk.q_norm.rms_in.length} heads</td></tr>
              </tbody>
            </table>
          </div>
        </Panel>
        <Callout>
          RMSNorm is applied to a copy of the stream that feeds a sub-layer. In a pre-norm block, <span className="font-mono">x&apos; = x + Attn(RMSNorm(x))</span>: the
          unnormalized x is what gets added to. That is why the stream can keep growing while every sub-layer still sees a well-scaled input.
        </Callout>
      </div>
    </section>
  );
}
