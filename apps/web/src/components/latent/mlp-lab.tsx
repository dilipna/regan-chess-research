"use client";

import { useState } from "react";
import { dims } from "@/lib/latent/parts";
import { round, silu } from "@/lib/latent/toy";
import type { Architecture, TokenTrace } from "@/lib/latent/types";
import { LineChart, SERIES } from "./charts";
import { Callout, Eq, Measured, Panel, SectionHead, Shape, Toy } from "./shell";

function MixDiagram() {
  const toks = ["The", "cat", "sat", "down"];
  const W = 300, H = 120, xs = toks.map((_, i) => 40 + i * 73);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <figure>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Attention: the last position receives arrows from all earlier positions">
          {xs.map((x, i) => i < 3 && <path key={i} d={`M${x},34 Q${(x + xs[3]) / 2},${4 - i * 2} ${xs[3]},34`} fill="none" stroke="var(--viz-1)" strokeWidth="1.6" markerEnd="url(#ah)" />)}
          <defs><marker id="ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--viz-1)" /></marker></defs>
          {toks.map((t, i) => <g key={t}><rect x={xs[i] - 26} y={40} width={52} height={26} rx={3} fill="var(--paper-2)" stroke="var(--rule-strong)" /><text x={xs[i]} y={57} textAnchor="middle" fontSize="12" fill="var(--ink)">{t}</text></g>)}
          <text x={W / 2} y={100} textAnchor="middle" fontSize="12" fill="var(--ink-2)">ATTENTION mixes information ACROSS positions</text>
        </svg>
      </figure>
      <figure>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="MLP: each position is transformed on its own, with no arrows between positions">
          {toks.map((t, i) => (
            <g key={t}>
              <rect x={xs[i] - 26} y={8} width={52} height={22} rx={3} fill="color-mix(in oklab, var(--viz-2) 14%, var(--paper))" stroke="var(--viz-2)" />
              <text x={xs[i]} y={23} textAnchor="middle" fontSize="11" fill="var(--ink)">MLP</text>
              <line x1={xs[i]} x2={xs[i]} y1={30} y2={40} stroke="var(--viz-2)" strokeWidth="1.6" />
              <rect x={xs[i] - 26} y={40} width={52} height={26} rx={3} fill="var(--paper-2)" stroke="var(--rule-strong)" /><text x={xs[i]} y={57} textAnchor="middle" fontSize="12" fill="var(--ink)">{t}</text>
            </g>
          ))}
          <text x={W / 2} y={100} textAnchor="middle" fontSize="12" fill="var(--ink-2)">MLP transforms EACH position independently</text>
        </svg>
      </figure>
    </div>
  );
}

function SwiGluToy({ F }: { F: number }) {
  const [g, setG] = useState(1.5);
  const [u, setU] = useState(0.8);
  return (
    <Panel title="One gate unit" badge={<Toy>Toy: one of the {F.toLocaleString("en-US")} intermediate features</Toy>}>
      <div className="grid gap-3 text-[13.5px] text-ink-2 sm:grid-cols-2">
        <label>gate = gate_proj(x) = <span className="num text-ink">{g.toFixed(2)}</span><input type="range" min={-4} max={4} step={0.1} value={g} onChange={(e) => setG(Number(e.target.value))} className="block w-full" /></label>
        <label>up = up_proj(x) = <span className="num text-ink">{u.toFixed(2)}</span><input type="range" min={-2} max={2} step={0.1} value={u} onChange={(e) => setU(Number(e.target.value))} className="block w-full" /></label>
      </div>
      <p className="mt-2 font-mono text-[13px] text-ink">SiLU(gate) = gate · sigmoid(gate) = {round(silu(g), 4)}; &nbsp; combined = SiLU(gate) · up = {round(silu(g) * u, 4)}</p>
      <p className="mt-2 text-[12.5px] text-ink-3">A strongly negative gate gives SiLU near 0 and switches the feature off, whatever up says. That multiplicative gate is the &quot;GLU&quot; in SwiGLU; down_proj then mixes all intermediate features back into the hidden size.</p>
    </Panel>
  );
}

export function MlpLab({ arch, trace }: { arch: Architecture; trace: TokenTrace }) {
  const D = dims(arch);
  const last = trace.tokens.length - 1;
  const L = trace.layers;
  const series = [
    { key: "res", label: "‖residual entering‖", color: SERIES.ink, dash: "4 3", points: L.map((l) => ({ x: l.layer + 1, y: l.last.resid_pre_l2 })) },
    { key: "attn", label: "‖attention update‖", color: SERIES.a, points: L.map((l) => ({ x: l.layer + 1, y: l.last.attn_out_l2 })) },
    { key: "mlp", label: "‖MLP update‖", color: SERIES.b, dash: "6 2", points: L.map((l) => ({ x: l.layer + 1, y: l.last.mlp_out_l2 })) },
  ];
  const fin = L[L.length - 1];
  const midL2 = fin.resid_mid_rms[last] * Math.sqrt(D.d);
  return (
    <section>
      <SectionHead n={6} kicker="Learn" title="SwiGLU MLP and the residual stream" id="mlp">
        After attention has moved information between positions, the MLP transforms what each position holds. Its update is added to the stream: residual addition #2.
      </SectionHead>
      <div className="grid gap-6">
        <Panel title="The exact path in Qwen3MLP" badge={<Measured>Dimensions verified</Measured>}>
          <ol className="grid gap-1.5 font-mono text-[13px] text-ink">
            <li>gate = gate_proj(x) <span className="font-sans text-ink-3">[B, T, {D.d}] → [B, T, {D.F}]</span></li>
            <li>up = up_proj(x) <span className="font-sans text-ink-3">[B, T, {D.d}] → [B, T, {D.F}]</span></li>
            <li>activated_gate = SiLU(gate) <span className="font-sans text-ink-3">elementwise</span></li>
            <li>combined = activated_gate * up <span className="font-sans text-ink-3">elementwise</span></li>
            <li>output = down_proj(combined) <span className="font-sans text-ink-3">[B, T, {D.F}] → [B, T, {D.d}]</span></li>
          </ol>
          <Eq label="MLP of x equals W down times the elementwise product of SiLU of W gate x and W up x">MLP(x) = W_down ( SiLU(W_gate x) ⊙ (W_up x) )</Eq>
          <p className="text-[12.5px] text-ink-3">Three weight matrices, no biases: {arch.parameters.per_layer.mlp.toLocaleString("en-US")} parameters per block, {Math.round((arch.parameters.per_layer.mlp / arch.parameters.per_layer.total) * 100)}% of the block.</p>
        </Panel>
        <Panel title="The distinction to remember"><MixDiagram /></Panel>
        <Callout>
          Why can the MLP change the meaning of a token if it never looks at other positions? Because by the time it runs, attention has already copied information from earlier
          positions into this position&apos;s vector. The MLP then transforms that combined vector. Mixing (attention) and transforming (MLP) alternate {D.L} times.
        </Callout>
        <SwiGluToy F={D.F} />
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Panel badge={<Measured />}>
            <LineChart title="Size of each update, last token, every block" series={series} logY xLabel="block" yLabel="L2 norm (log)"
              caption={<>&quot;{trace.text}&quot;, last token &quot;{trace.tokens[last].text.trim()}&quot;. Updates are added, so the stream after block k is the embedding plus the sum of all {2} × k updates so far.</>} />
          </Panel>
          <Panel title={`Residual addition #2 in block ${D.L}`} badge={<Measured />}>
            <table className="table-lab"><tbody>
              <tr><th scope="row">‖x′‖ after attention</th><td className="num r">{midL2.toFixed(1)}</td></tr>
              <tr><th scope="row">‖MLP update‖</th><td className="num r">{fin.last.mlp_out_l2.toFixed(1)}</td></tr>
              <tr><th scope="row">‖x″ = x′ + update‖</th><td className="num r">{fin.last.resid_post_l2.toFixed(1)}</td></tr>
              <tr><th scope="row">cosine(block input, block output)</th><td className="num r">{fin.last.cos_pre_post.toFixed(3)}</td></tr>
            </tbody></table>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
              {fin.last.mlp_out_l2 > midL2 ? <>In this sentence the last block&apos;s MLP update is larger than the stream it is added to, so the final block changes the direction of the last token&apos;s vector substantially.</>
                : <>In this sentence the last block&apos;s MLP update is smaller than the stream it is added to.</>} One sentence is an illustration, not a general finding.</p>
          </Panel>
        </div>
        <p className="text-[12.5px] text-ink-3">Shapes: <Shape>[B, T, {D.d}]</Shape> in and out; the {D.F}-wide intermediate exists only inside the MLP.</p>
      </div>
    </section>
  );
}
