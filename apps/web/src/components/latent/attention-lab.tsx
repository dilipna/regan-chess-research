"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { dims } from "@/lib/latent/parts";
import { causalAttention, dot2, fmtBytes, fmtInt, rotate2, round, showTok } from "@/lib/latent/toy";
import type { Architecture, TokenTrace } from "@/lib/latent/types";
import { Heatmap } from "./charts";
import { Callout, Eq, Measured, Panel, SectionHead, Shape, Toy } from "./shell";

function QKV({ arch }: { arch: Architecture }) {
  const D = dims(arch);
  return (
    <Panel title="Q, K and V are three linear projections of the same normalized input">
      <Eq label="Q equals X times W q. K equals X times W k. V equals X times W v.">Q = X W_q &nbsp;&nbsp; K = X W_k &nbsp;&nbsp; V = X W_v</Eq>
      <div className="grid gap-3 text-[13.5px] leading-relaxed text-ink-2 md:grid-cols-3">
        <div><span className="font-medium text-ink">Q, query.</span> &quot;What am I looking for?&quot;</div>
        <div><span className="font-medium text-ink">K, key.</span> &quot;What do I contain or advertise?&quot;</div>
        <div><span className="font-medium text-ink">V, value.</span> &quot;What should be passed on if I am selected?&quot;</div>
      </div>
      <p className="mt-2 text-[12px] text-ink-3">These phrases are intuitive analogies, not literal semantics. The model learns three matrices that make the computation below useful for predicting the next token.</p>
      <div className="scroll-x mt-4">
        <table className="table-lab">
          <thead><tr><th>Projection</th><th>Weight shape</th><th>Output per position</th><th>After reshape and transpose</th></tr></thead>
          <tbody>
            <tr><td className="font-mono">q_proj</td><td><Shape>[{D.d}, {D.H * D.dh}]</Shape></td><td><Shape>{D.H * D.dh}</Shape></td><td><Shape>[B, {D.H}, T, {D.dh}]</Shape></td></tr>
            <tr><td className="font-mono">k_proj</td><td><Shape>[{D.d}, {D.Hkv * D.dh}]</Shape></td><td><Shape>{D.Hkv * D.dh}</Shape></td><td><Shape>[B, {D.Hkv}, T, {D.dh}]</Shape></td></tr>
            <tr><td className="font-mono">v_proj</td><td><Shape>[{D.d}, {D.Hkv * D.dh}]</Shape></td><td><Shape>{D.Hkv * D.dh}</Shape></td><td><Shape>[B, {D.Hkv}, T, {D.dh}]</Shape></td></tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">
        A linear projection is a matrix multiply: each output number is a weighted sum of the {D.d} inputs. Reshape splits the {D.H * D.dh} query numbers of each position into {D.H} heads of {D.dh};
        transpose moves the head axis before the position axis so that each head can be processed as its own [T, {D.dh}] matrix. No biases (attention_bias = {String(arch.verified.attention_bias)}).
      </p>
    </Panel>
  );
}

function GQA({ arch }: { arch: Architecture }) {
  const D = dims(arch);
  const [mode, setMode] = useState<"gqa" | "mha" | "mqa">("gqa");
  const kv = mode === "gqa" ? D.Hkv : mode === "mha" ? D.H : 1;
  const per = D.H / kv;
  const bytesPerTok = 2 * kv * D.dh * D.L * 2;
  return (
    <Panel title="Grouped-query attention" badge={<Measured>Head counts verified</Measured>}>
      <div role="radiogroup" aria-label="Attention variant" className="mb-3 inline-flex rounded-md border border-rule-strong p-0.5">
        {([["gqa", `GQA (Qwen3-8B: ${D.Hkv} KV heads)`], ["mha", `MHA (${D.H} KV heads)`], ["mqa", "MQA (1 KV head)"]] as const).map(([k, l]) => (
          <button key={k} role="radio" aria-checked={mode === k} onClick={() => setMode(k)} className={cn("rounded px-2.5 py-1 text-[12.5px]", mode === k ? "bg-ink text-paper" : "text-ink-3 hover:text-ink")}>{l}</button>
        ))}
      </div>
      <div className="grid gap-2" aria-label={`${D.H} query heads grouped onto ${kv} key/value heads`}>
        {Array.from({ length: kv }, (_, g) => (
          <div key={g} className="flex items-center gap-2">
            <div className="flex flex-wrap gap-[3px]">
              {Array.from({ length: per }, (_, q) => (
                <span key={q} title={`query head ${g * per + q}`} className="inline-block h-4 w-4 rounded-[2px] border border-[var(--viz-1)] bg-[color-mix(in_oklab,var(--viz-1)_18%,var(--paper))]" />
              ))}
            </div>
            <span aria-hidden className="text-ink-4">→</span>
            <span className="rounded-[2px] border border-[var(--viz-2)] bg-[color-mix(in_oklab,var(--viz-2)_18%,var(--paper))] px-1.5 text-[10.5px] text-ink">K/V {g}</span>
          </div>
        )).slice(0, mode === "mha" ? 8 : kv)}
        {mode === "mha" && <p className="text-[12px] text-ink-3">… {D.H - 8} more one-to-one pairs</p>}
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
        {D.H} query heads; {kv} key/value head{kv > 1 ? "s" : ""}; {per} query head{per > 1 ? "s" : ""} per KV head. KV cache per token (all {D.L} layers, bf16): <span className="num text-ink">{fmtBytes(bytesPerTok)}</span>.
        {mode === "gqa" && <> Qwen3-8B&apos;s verified value is {fmtBytes(arch.kv_cache.bytes_per_token_all_layers)}, {arch.kv_cache.bytes_per_token_if_mha / arch.kv_cache.bytes_per_token_all_layers}x smaller than full multi-head attention.</>}
      </p>
      <p className="mt-2 text-[12px] text-ink-3">Why: during generation the K and V of every past token are stored. Fewer KV heads means less memory and less memory bandwidth per generated token, while keeping {D.H} distinct query heads, each with its own attention pattern.</p>
    </Panel>
  );
}

function Rope({ arch }: { arch: Architecture }) {
  const [t, setT] = useState(3);
  const [s, setS] = useState(1);
  const theta = 0.5;      // toy angle per position
  const q: [number, number] = [1, 0.35], k: [number, number] = [0.8, 0.6];
  const qr = rotate2(q, t * theta), kr = rotate2(k, s * theta);
  const score = dot2(qr, kr);
  const shifted = dot2(rotate2(q, (t + 4) * theta), rotate2(k, (s + 4) * theta));
  const S = 95, c = 130;
  const P = (v: [number, number]) => [c + v[0] * S, c - v[1] * S] as const;
  const v = arch.verified;
  return (
    <Panel title="Rotary position embedding (RoPE)" badge={<Toy>2D toy, angle 0.5 rad per position</Toy>}>
      <div className="grid gap-5 md:grid-cols-[280px_1fr]">
        <svg viewBox="0 0 260 260" className="w-full max-w-[280px]" role="img" aria-label={`Query rotated by ${round(t * theta, 2)} radians, key rotated by ${round(s * theta, 2)} radians; dot product ${round(score, 3)}`}>
          <circle cx={c} cy={c} r={S} fill="none" stroke="var(--rule)" />
          <line x1={c - S - 5} x2={c + S + 5} y1={c} y2={c} stroke="var(--rule)" /><line y1={c - S - 5} y2={c + S + 5} x1={c} x2={c} stroke="var(--rule)" />
          {[q, k].map((u, i) => { const [x, y] = P(u); return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--ink-4)" strokeDasharray="3 3" />; })}
          {([[qr, "var(--viz-1)", `q at position ${t}`], [kr, "var(--viz-2)", `k at position ${s}`]] as const).map(([u, col, lab]) => { const [x, y] = P(u); return (
            <g key={lab}><line x1={c} y1={c} x2={x} y2={y} stroke={col} strokeWidth="2.5" /><circle cx={x} cy={y} r="4" fill={col} /><text x={x + 6} y={y - 4} fontSize="11" fill="var(--ink-2)">{lab}</text></g>
          ); })}
        </svg>
        <div className="text-[13.5px] leading-relaxed text-ink-2">
          <label className="block">Query position t = <span className="num text-ink">{t}</span>
            <input type="range" min={0} max={10} value={t} onChange={(e) => setT(Number(e.target.value))} className="block w-full" /></label>
          <label className="mt-2 block">Key position s = <span className="num text-ink">{s}</span>
            <input type="range" min={0} max={10} value={s} onChange={(e) => setS(Number(e.target.value))} className="block w-full" /></label>
          <p className="mt-3">Position {t} rotates q by {t} × θ = {round(t * theta, 2)} rad; position {s} rotates k by {round(s * theta, 2)} rad (dashed: before rotation).</p>
          <p className="mt-1">Score q·k after rotation: <span className="num text-ink">{round(score, 4)}</span>. Move both positions forward by 4: <span className="num text-ink">{round(shifted, 4)}</span>, the same, because the score depends only on t - s = {t - s}.</p>
          <Callout>RoPE does not add a position vector to the token. It rotates Q and K, so the attention score carries their relative position. V and the residual stream are never rotated.</Callout>
        </div>
      </div>
      <div className="mt-4 border-t border-rule pt-3 text-[12.5px] leading-relaxed text-ink-3">
        <span className="font-medium text-ink-2">In the real model</span> (verified): each {v.head_dim}-dimensional Q and K head vector is split into {v.rope_frequencies} pairs, dimension i paired with i + {v.head_dim / 2} (&quot;rotate half&quot;).
        Pair i rotates at frequency θ<sub>i</sub> = {fmtInt(v.rope_theta)}<sup>-2i/{v.head_dim}</sup>, so wavelengths range from {v.rope_wavelength_min_tokens.toFixed(2)} tokens (fastest pair) to about {fmtInt(Math.round(v.rope_wavelength_max_tokens))} tokens (slowest).
        It is applied after Q/K RMSNorm.
      </div>
    </Panel>
  );
}

const TQ = [[1, 0], [0, 1], [1, 1], [0.5, -1]], TK = [[1, 0.5], [0, 1], [1, -0.5], [0.4, 0.8]], TV = [[1, 0], [0, 1], [1, 1], [-1, 0.5]];
const TL = ["A", "B", "C", "D"];

function CausalToy() {
  const [step, setStep] = useState(0);
  const r = causalAttention(TQ, TK, TV);
  const steps = ["Scores QKᵀ / sqrt(d_head)", "Causal mask (future = -inf)", "Softmax per row", "Weighted sum of V"];
  const M = step === 0 ? r.scores : step === 1 ? r.masked : r.weights;
  return (
    <Panel title="Causal attention on four tokens" badge={<Toy>Toy Q, K, V with d_head = 2</Toy>}>
      <ol className="mb-3 flex flex-wrap gap-1" aria-label="Attention steps">
        {steps.map((s, i) => (
          <li key={s}><button type="button" onClick={() => setStep(i)} aria-current={step === i ? "step" : undefined}
            className={cn("rounded border px-2 py-0.5 text-[12px]", step === i ? "border-ink bg-ink text-paper" : "border-rule-strong text-ink-3 hover:text-ink")}>{i + 1}. {s}</button></li>
        ))}
      </ol>
      {step < 3 ? (
        <div className="scroll-x">
          <table className="border-separate border-spacing-[2px] text-[12px]">
            <thead><tr><th className="px-1 text-left font-normal text-ink-4">query \ key</th>{TL.map((l) => <th key={l} className="px-2 font-mono font-normal text-ink-3">{l}</th>)}</tr></thead>
            <tbody>{M.map((row, i) => (
              <tr key={i}><th scope="row" className="pr-2 text-right font-mono font-normal text-ink-3">{TL[i]}</th>
                {row.map((v, j) => (
                  <td key={j} className={cn("num h-8 w-16 rounded-[2px] text-center", j > i && step >= 1 ? "text-ink-4" : "text-ink")}
                    style={{ background: j > i && step >= 1 ? "repeating-linear-gradient(135deg, var(--paper-2) 0 4px, var(--paper-3) 4px 6px)" : step === 2 ? `color-mix(in oklab, var(--viz-1) ${Math.round(v * 80)}%, var(--paper))` : "var(--paper-2)" }}>
                    {Number.isFinite(v) ? round(v, 3) : "-inf"}
                  </td>
                ))}
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div className="font-mono text-[12.5px] leading-relaxed text-ink-2">
          {r.out.map((o, i) => <div key={i}>out({TL[i]}) = {r.weights[i].map((w, j) => j <= i ? `${round(w, 2)}·V_${TL[j]}` : null).filter(Boolean).join(" + ")} = [{o.map((x) => round(x, 3)).join(", ")}]</div>)}
        </div>
      )}
      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">
        The visible pattern is lower-triangular: at position t the model cannot use positions after t. Training predicts every next token in parallel, so without the mask
        position t could simply read token t+1. A masked score of -infinity becomes a softmax weight of exactly 0.
      </p>
    </Panel>
  );
}

function RealAttention({ trace, kvHeads }: { trace: TokenTrace; kvHeads: number }) {
  const layers = trace.attention.layers;
  const [L, setL] = useState(layers[Math.min(3, layers.length - 1)]);
  const [h, setH] = useState(0);
  const W = trace.attention.weights[L][h];
  const labels = trace.tokens.map((t) => (t.prefix ? "<eot>" : showTok(t.text)));
  const sinkHeads = trace.attention.weights[L].filter((hw) => hw.slice(1).reduce((a, r) => a + r[0], 0) / (hw.length - 1) > 0.5).length;
  return (
    <Panel title="Real attention weights" badge={<Measured>Qwen3-8B-Base, eager attention</Measured>}>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-[12.5px] text-ink-3">
        <label>block <select value={L} onChange={(e) => setL(e.target.value)} className="rounded border border-rule-strong bg-paper px-1 py-0.5 text-ink">
          {layers.map((l) => <option key={l} value={l}>{Number(l) + 1}</option>)}</select></label>
        <label>query head <select value={h} onChange={(e) => setH(Number(e.target.value))} className="rounded border border-rule-strong bg-paper px-1 py-0.5 text-ink">
          {trace.attention.weights[L].map((_, i) => <option key={i} value={i}>{i} (KV head {Math.floor(i / (trace.attention.weights[L].length / kvHeads))})</option>)}</select></label>
      </div>
      <Heatmap m={W} rowLabels={labels} colLabels={labels} masked={(r, c) => c > r} title={`Block ${Number(L) + 1}, head ${h}: "${trace.text}"`} />
      <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
        In block {Number(L) + 1}, {sinkHeads} of {trace.attention.weights[L].length} heads put more than half of their weight (averaged over query positions 1 to {trace.tokens.length - 1})
        on position 0, the document-start token. Weight concentrating on the first position is a commonly reported pattern (often called an attention sink); reading it as
        &quot;the head ignores the sentence&quot; would be an over-interpretation. Only the blocks listed were exported.
      </p>
    </Panel>
  );
}

function AttentionOutput({ arch, trace }: { arch: Architecture; trace: TokenTrace }) {
  const D = dims(arch);
  const l = trace.layers[0], last = trace.tokens.length - 1;
  return (
    <Panel title="From head outputs to residual addition #1">
      <ol className="grid gap-1.5 text-[13.5px] text-ink-2">
        <li>1. Each head returns a weighted sum of values: <Shape>[B, {D.H}, T, {D.dh}]</Shape></li>
        <li>2. Transpose and concatenate the heads: <Shape>[B, T, {D.H * D.dh}]</Shape></li>
        <li>3. Output projection o_proj: <Shape>[B, T, {D.H * D.dh}] → [B, T, {D.d}]</Shape></li>
        <li>4. Residual addition #1: <span className="font-mono text-ink">x&apos; = x + attention update</span></li>
      </ol>
      <p className="mt-3 text-[12.5px] text-ink-3">
        <Measured /> Block 1, last token: ‖x‖ = {l.last.resid_pre_l2.toFixed(2)}, ‖attention update‖ = {l.last.attn_out_l2.toFixed(2)}, RMS of x&apos; = {l.resid_mid_rms[last].toFixed(3)}.
      </p>
    </Panel>
  );
}

export function AttentionLab({ arch, trace }: { arch: Architecture; trace: TokenTrace }) {
  return (
    <section>
      <SectionHead n={5} kicker="Learn" title="Attention, GQA and RoPE" id="attention">
        Attention is the only computation that moves information between positions. Qwen3 adds two details to the textbook version: Q/K RMSNorm and
        grouped-query attention.
      </SectionHead>
      <div className="grid gap-6">
        <QKV arch={arch} />
        <div className="grid gap-6 lg:grid-cols-2"><GQA arch={arch} /><Panel title="Where Q/K RMSNorm sits">
          <ol className="grid gap-1.5 font-mono text-[12.5px] text-ink-2">
            <li>q = q_proj(RMSNorm₁(x)) → view [B, T, {arch.verified.num_attention_heads}, {arch.verified.head_dim}]</li>
            <li>q = q_norm(q) <span className="font-sans text-ink-3">over the last {arch.verified.head_dim} dims, per head</span></li>
            <li>k = k_norm(k_proj(...).view(...)) <span className="font-sans text-ink-3">same for keys</span></li>
            <li>v = v_proj(...).view(...) <span className="font-sans text-ink-3">no norm</span></li>
            <li>q, k = RoPE(q, k)</li>
            <li>scores = q kᵀ · {arch.verified.attention_scaling.toFixed(4)} <span className="font-sans text-ink-3">(= 1/sqrt({arch.verified.head_dim}))</span></li>
          </ol>
          <p className="mt-3 text-[12px] text-ink-3">Order verified in the installed transformers source. Normalizing q and k bounds the size of their dot products.</p>
        </Panel></div>
        <Rope arch={arch} />
        <div className="grid gap-6 lg:grid-cols-2"><CausalToy /><RealAttention trace={trace} kvHeads={arch.verified.num_key_value_heads} /></div>
        <AttentionOutput arch={arch} trace={trace} />
        <Eq label="Attention equals softmax of Q K transpose divided by the square root of d head plus the causal mask, times V">Attention(Q, K, V) = softmax( Q Kᵀ / sqrt(d_head) + M_causal ) V</Eq>
      </div>
    </section>
  );
}
