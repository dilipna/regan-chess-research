"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { TOY, TOY_WEIGHTS, matvec, silu } from "@/lib/latent/toy-model";
import { LineChart } from "../charts";
import { AnalogyLimit, Check, Deeper, Grid, Prov, RoleTag, Segment, Slider, StepControls, TensorCard, VectorBars, showTok } from "../kit";
import { SceneFrame, SceneText, byLevel, exampleTokens, type SceneProps } from "./common";

const label = (p: number) => (exampleTokens[p].prefix ? "⟨start⟩" : showTok(exampleTokens[p].text));
const LABELS = exampleTokens.map((t) => label(t.pos));

// ===================================================================================== Scene 4: attention
const ATT_STEPS = ["Compare query with each key (Q·K)", "Divide by √d_head", "Hide future positions (causal mask)", "Turn scores into shares (softmax)", "Weighted sum of values"];

function Arcs({ q, weights }: { q: number; weights: number[] }) {
  const n = exampleTokens.length, W = 760, gap = W / n, y = 236, top = y - 26;
  const cx = (i: number) => gap * i + gap / 2;
  return (
    <svg viewBox={`0 0 ${W} 296`} className="w-full" role="img"
      aria-label={`Query ${LABELS[q]} at position ${q} attends to positions 0 to ${q}: ${weights.slice(0, q + 1).map((w, j) => `${LABELS[j]} ${(w * 100).toFixed(0)} percent`).join(", ")}. Positions after ${q} are masked.`}>
      <g className="role-attn">
        {weights.slice(0, q + 1).map((w, j) => {
          const x1 = cx(q), x2 = cx(j), dist = Math.abs(q - j);
          const ctrl = Math.min(200, 50 + dist * 34);          // control-point height; the arc peaks at 3/4 of it
          const d = j === q ? `M${x1 - 16},${top} C${x1 - 46},${top - 70} ${x1 + 46},${top - 70} ${x1 + 16},${top}` : `M${x1},${top} C${x1},${top - ctrl} ${x2},${top - ctrl} ${x2},${top}`;
          const peak = j === q ? top - 52 : top - ctrl * 0.75;
          return (
            <g key={j}>
              <path className="ll-anim" d={d} fill="none" stroke="var(--role)" strokeWidth={1 + w * 16} strokeOpacity={0.3 + w * 0.65} strokeLinecap="round" />
              {w >= 0.05 && <text x={(x1 + x2) / 2} y={peak - 8} textAnchor="middle" fontSize="14" fontWeight={700} fill="var(--role-ink)" stroke="var(--paper)" strokeWidth="4" paintOrder="stroke">{(w * 100).toFixed(0)}%</text>}
            </g>
          );
        })}
      </g>
      {exampleTokens.map((t, i) => {
        const fut = i > q;
        return (
          <g key={i}>
            <rect x={cx(i) - 56} y={y - 24} width={112} height={44} rx="10" fill={i === q ? "var(--ink)" : fut ? "var(--paper-2)" : "var(--paper)"}
              stroke={fut ? "var(--rule-strong)" : "var(--ink)"} strokeDasharray={fut ? "5 4" : undefined} strokeWidth={i === q ? 2.5 : 1.5} />
            <text x={cx(i)} y={y + 4} textAnchor="middle" fontSize="15" className="font-mono" fill={i === q ? "var(--paper)" : fut ? "var(--ink-4)" : "var(--ink)"}>{LABELS[i]}</text>
            <text x={cx(i)} y={y + 40} textAnchor="middle" fontSize="12" fill="var(--ink-3)">{fut ? "🔒 future" : i === q ? "query" : `pos ${i}`}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function SceneAttention({ st, set, data, toy }: SceneProps) {
  const q = st.tok, step = Math.min(st.step, 4), lvl = st.level, a = toy.attn;
  const mats: (number | null)[][][] = [a.scores, a.scaled, a.masked, a.weights.map((r, i) => r.map((w, j) => (j > i ? null : w)))];
  const layers = data.trace.attention.layers.map(Number);
  const nearest = layers.reduce((b, l) => (Math.abs(l - st.layer) < Math.abs(b - st.layer) ? l : b), layers[0]);
  const [head, setHead] = useState(0);
  const real = data.trace.attention.weights[String(nearest)]?.[head]?.[q];
  const visible = q + 1, future = exampleTokens.length - visible;
  return (
    <SceneFrame
      visual={
        <div className="ll-panel grid gap-5 rounded-2xl border border-rule bg-paper p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2"><RoleTag role="attn">{ATT_STEPS[step]}</RoleTag><Prov kind="toy" detail="one head, d_head = 4" /></div>
          <Arcs q={q} weights={a.weights[q]} />
          <ol className="grid gap-1.5 sm:hidden" aria-label={`Shares for query ${LABELS[q]}`}>
            {exampleTokens.map((tk, j) => (
              <li key={j} className="grid grid-cols-[92px_1fr_56px] items-center gap-2 text-[14px]">
                <span className="truncate font-mono">{LABELS[j]}</span>
                {j > q ? <span className="col-span-2 text-ink-3">🔒 future position: hidden</span> : (<>
                  <span className="role-attn relative h-4 rounded-r bg-paper-2"><span className="ll-anim absolute inset-y-0 left-0 rounded-r bg-[var(--role)]" style={{ width: `${a.weights[q][j] * 100}%` }} /></span>
                  <span className="num text-right">{(a.weights[q][j] * 100).toFixed(0)}%</span></>)}
              </li>
            ))}
          </ol>
          <StepControls step={step} max={4} onStep={(s) => set({ step: s })} labels={ATT_STEPS} onReset={() => set({ step: 0 })} />
          {step < 4 ? (
            <Grid m={mats[step]} rows={LABELS.map((l, i) => `${l} (q${i})`)} cols={LABELS} highlightRow={q}
              caption={`${ATT_STEPS[step]}: each row is one query, each column one key. Row “${LABELS[q]}” is highlighted.`}
              fmt={(v) => (step === 3 ? `${(v * 100).toFixed(0)}%` : v.toFixed(2))} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                {a.weights[q].slice(0, q + 1).map((w, j) => (
                  <div key={j} className="flex items-center gap-3 text-[13px]"><span className="w-24 truncate font-mono">{LABELS[j]}</span><span className="num w-12 text-right">{(w * 100).toFixed(0)}%</span><span className="text-ink-3">× value of pos {j}</span></div>
                ))}
              </div>
              <VectorBars values={a.out[q]} role="attn" label={`weighted sum for “${LABELS[q]}” (${TOY.dHead} numbers)`} />
            </div>
          )}
          {lvl === "research" && (
            <TensorCard title={`Real attention weights, query “${LABELS[q]}”`} kind="recorded" captured={`attention probabilities returned by Qwen3-8B-Base block ${nearest + 1} (eager attention), one forward pass of the sentence`}
              shape="[1, 32 heads, 6 queries, 6 keys]" shown={`one head, one query row; blocks recorded: ${layers.map((l) => l + 1).join(", ")}`}>
              <div className="mb-2 flex flex-wrap items-center gap-3 text-[13px] text-ink-2">
                <span>block {nearest + 1} (nearest recorded to block {st.layer + 1})</span>
                <label>head <select value={head} onChange={(e) => setHead(Number(e.target.value))} className="rounded border border-rule-strong bg-paper px-1">{Array.from({ length: 32 }, (_, h) => <option key={h} value={h}>{h}</option>)}</select></label>
              </div>
              {real && <div className="grid gap-1.5">{real.slice(0, q + 1).map((w, j) => (
                <div key={j} className="flex items-center gap-2 text-[13px]"><span className="w-24 truncate font-mono">{LABELS[j]}</span>
                  <span className="role-attn h-3 rounded-r bg-[var(--role)]" style={{ width: `${Math.max(1, w * 260)}px` }} /><span className="num">{(w * 100).toFixed(1)}%</span></div>
              ))}</div>}
              <p className="mt-2 text-[12.5px] text-ink-3">Only attention probabilities were recorded for this sentence, so the toy controls (scores, scaling) are not available for real data. Weight on ⟨start⟩ is common in later blocks; it does not mean the head &quot;ignores&quot; the sentence.</p>
            </TensorCard>
          )}
        </div>
      }
      side={<>
        <SceneText
          tryThis="Choose a different query token in the strip above, then step to “Turn scores into shares”."
          consequence={<>“{LABELS[q]}” may use <strong>{visible} position{visible > 1 ? "s" : ""}</strong> (0 to {q}); {future} later position{future === 1 ? " is" : "s are"} locked. Largest share: {LABELS[a.weights[q].indexOf(Math.max(...a.weights[q]))]} ({(Math.max(...a.weights[q]) * 100).toFixed(0)}%).</>}
          explain={byLevel(lvl, {
            story: <>Each word compares itself with every <strong>earlier</strong> word, turns the match scores into shares that add up to 100%, and takes that mix of their information. Later words are hidden, because the model is trained to predict what comes next.</>,
            mechanics: <><span className="font-mono">softmax(QKᵀ/√d_head + M)V</span>. Q, K, V are linear projections of the normalized input; M sets future positions to −∞ so their share is exactly 0. Output: <span className="font-mono">[B, T, d_head]</span> per head.</>,
            research: <>Qwen3-8B uses {data.arch.verified.num_attention_heads} query heads sharing {data.arch.verified.num_key_value_heads} key/value heads (grouped-query attention), d_head = {data.arch.verified.head_dim}, with RMSNorm on each Q and K head and RoPE before the scores. The recorded panel shows real probabilities for one head.</>,
          })}
        />
        <AnalogyLimit analogy="Like a reader glancing back over earlier words and borrowing more from the most relevant ones." limit="The model has no intention or understanding of “looking”. Shares come from dot products of learned projections, and a large share does not prove that position caused the prediction. Attention weights are not a complete explanation." />
        <Check id="attention-visible" prompt="Which positions may “␣opened” (position 3) attend to?" options={[
          { label: "All six", feedback: "Positions 4 and 5 come later. The causal mask hides them so the model cannot read ahead." },
          { label: "Positions 0, 1, 2 and 3", correct: true, feedback: "Itself and everything before it. Choose “␣opened” in the strip to see the locked positions." },
          { label: "Only the word just before it", feedback: "Attention can reach any earlier position, not just the previous one." },
        ]} />
      </>}
    />
  );
}

// ===================================================================================== Scene 5: MLP
function SiluCurve({ g }: { g: number }) {
  const W = 220, H = 120, sx = (x: number) => ((x + 5) / 10) * W, sy = (y: number) => H - 14 - ((y + 0.5) / 5.5) * (H - 24);
  const pts = Array.from({ length: 61 }, (_, i) => -5 + i / 6).map((x) => `${sx(x)},${sy(silu(x))}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[240px]" role="img" aria-label={`SiLU curve; current gate ${g.toFixed(2)} gives ${silu(g).toFixed(2)}`}>
      <line x1="0" x2={W} y1={sy(0)} y2={sy(0)} stroke="var(--rule-strong)" /><line x1={sx(0)} x2={sx(0)} y1="0" y2={H} stroke="var(--rule-strong)" />
      <polyline points={pts} fill="none" stroke="var(--role-mlp)" strokeWidth="2.5" />
      <circle className="ll-anim" cx={sx(Math.max(-5, Math.min(5, g)))} cy={sy(silu(Math.max(-5, Math.min(5, g))))} r="6" fill="var(--ink)" />
      <text x="4" y="12" fontSize="11" fill="var(--ink-3)">SiLU(gate)</text>
    </svg>
  );
}

export function SceneMlp({ st, data, toy }: SceneProps) {
  const t = st.tok, lvl = st.level;
  const [k, setK] = useState(0);
  const [push, setPush] = useState(0);
  const base = toy.mlp[t];
  const gate = base.gate.map((g, i) => (i === k ? g + push : g));
  const act = gate.map(silu), prod = act.map((x, i) => x * base.up[i]), down = matvec(prod, TOY_WEIGHTS.Wdown);
  const L = data.trace.layers;
  return (
    <SceneFrame
      visual={
        <div className="ll-panel grid gap-5 rounded-2xl border border-rule bg-paper p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2"><RoleTag role="mlp">SwiGLU MLP for “{label(t)}” only</RoleTag><Prov kind="toy" detail={`${TOY.d} → ${TOY.mlp} → ${TOY.d}`} /></div>
          <div className="grid gap-4">
            <VectorBars values={gate} role="mlp" label="gate = gate_proj(x)" height={90} />
            <VectorBars values={base.up} role="mlp" label="up = up_proj(x)" height={90} />
            <VectorBars values={prod} role="mlp" label="SiLU(gate) × up, element by element" compare={base.prod} compareLabel="before your push" height={90} />
            <VectorBars values={down} role="mlp" label="down_proj: back to 8 numbers (the update)" compare={base.down} compareLabel="before your push" height={90} />
          </div>
          <div className="grid items-center gap-4 rounded-xl bg-paper-2/50 p-4 md:grid-cols-[1fr_auto]">
            <div className="grid gap-3">
              <Segment label="Feature to push" value={k} onChange={setK} options={Array.from({ length: TOY.mlp }, (_, i) => ({ value: i, label: String(i) }))} />
              <Slider label={`push the gate of feature ${k}`} value={push} min={-4} max={4} step={0.1} onChange={setPush} format={(v) => (v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1))} />
              <button type="button" onClick={() => setPush(0)} className="w-fit rounded border border-rule-strong px-2 py-0.5 text-[13px] text-ink-2">Reset push</button>
            </div>
            <SiluCurve g={gate[k]} />
          </div>
          <div className="grid gap-3 rounded-xl border border-rule p-4 md:grid-cols-2">
            <div className="role-attn"><div className="mb-1 text-[14px] font-semibold text-[var(--role-ink)]">⇄ Attention</div><p className="text-[14px] text-ink-2">moves information <strong>between</strong> positions: the output for one token depends on the other tokens.</p></div>
            <div className="role-mlp"><div className="mb-1 text-[14px] font-semibold text-[var(--role-ink)]">◆ MLP</div><p className="text-[14px] text-ink-2">transforms <strong>each position on its own</strong>, with the same weights for every position. It never reads another position.</p></div>
          </div>
          {lvl === "research" && (
            <TensorCard title={`Real MLP update size for “${label(t)}”, all ${L.length} blocks`} kind="recorded" captured="output of mlp (down_proj) in each block, one forward pass" shape="[1, 6, 4,096] per block" shown="RMS of the update for the selected token, per block">
              <LineChart title="MLP update RMS by block" series={[{ key: "m", label: "MLP update RMS", color: "var(--role-mlp)", points: L.map((l) => ({ x: l.layer + 1, y: l.mlp_out_rms[t] })) }]} logY xLabel="block" yLabel="RMS (log)" height={200} />
            </TensorCard>
          )}
        </div>
      }
      side={<>
        <SceneText
          tryThis="Drag the slider to push one gate negative, then positive. Watch the curve, the product and the final update."
          consequence={<>Feature {k}: gate {gate[k].toFixed(2)} → SiLU {act[k].toFixed(2)} → times up {base.up[k].toFixed(2)} = {prod[k].toFixed(2)}. {gate[k] < -2 ? "The gate is closed: this feature contributes almost nothing." : gate[k] > 1 ? "The gate is open: this feature passes its up-value through." : "The gate is partly open."}</>}
          explain={byLevel(lvl, {
            story: <>After attention has gathered information, each token&apos;s description goes through the <strong>same small calculator</strong>. Some internal features switch on or off (the gate), the open ones are combined, and the result is added to the token&apos;s description.</>,
            mechanics: <><span className="font-mono">down(SiLU(gate(x)) ⊙ up(x))</span>, with SiLU(z) = z·sigmoid(z). Shapes <span className="font-mono">[B,T,d] → [B,T,F] → [B,T,d]</span>. Applied to each position independently.</>,
            research: <>Qwen3-8B: d = {data.arch.verified.hidden_size.toLocaleString("en-US")}, F = {data.arch.verified.intermediate_size.toLocaleString("en-US")}, no biases; {data.arch.parameters.per_layer.mlp.toLocaleString("en-US")} parameters per block ({Math.round((data.arch.parameters.per_layer.mlp / data.arch.parameters.per_layer.total) * 100)}% of the block). Gate values were not recorded, so the slider stays on the toy.</>,
          })}
        />
        <AnalogyLimit analogy="Each word visits the same workshop on its own; the workshop has many switchable tools." limit={`The “tools” are learned features (${data.arch.verified.intermediate_size.toLocaleString("en-US")} in Qwen3-8B) that rarely match a single human idea, and the workshop has no memory of other words except what attention already brought in.`} />
        <Check id="mlp-position" prompt="Does the MLP at “␣notebook” read the vector at “␣researcher”?" options={[
          { label: "Yes, the MLP mixes all positions", feedback: "That is attention's job. The MLP sees only the vector of its own position." },
          { label: "No, only its own position", correct: true, feedback: "Information from other words can only reach it if attention already copied it into this position's vector." },
        ]} />
      </>}
    />
  );
}

// ===================================================================================== Scene 6: the stack
export function SceneStack({ st, set, data }: SceneProps) {
  const t = st.tok, lvl = st.level, Lyr = data.trace.layers, n = Lyr.length, l = Lyr[st.layer];
  const g = data.arch.norm_gains;
  const lens = t === exampleTokens.length - 1 ? data.trace.diagnostic_lens_last_position[st.layer + 1] : null;
  return (
    <SceneFrame
      visual={
        <div className="ll-panel grid gap-5 rounded-2xl border border-rule bg-paper p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2"><RoleTag role="resid">{n} blocks in Qwen3-8B-Base</RoleTag><Prov kind="recorded" detail="architecture and one forward pass" /></div>
          <div className="grid gap-6 md:grid-cols-[auto_1fr]">
            <div role="radiogroup" aria-label="Choose a block" className="grid grid-cols-6 gap-1 md:flex md:flex-col-reverse md:gap-[3px]">
              {Lyr.map((x) => (
                <button key={x.layer} type="button" role="radio" aria-checked={st.layer === x.layer} aria-label={`block ${x.layer + 1}`} onClick={() => set({ layer: x.layer })}
                  className={cn("ll-anim num rounded-[4px] border text-[11px] md:h-[11px] md:w-44 md:text-[0px]", st.layer === x.layer ? "border-ink bg-ink text-paper md:h-[22px] md:text-[12px]" : "border-[var(--role-resid)]/40 bg-[var(--role-resid-soft)] text-ink-3 hover:bg-[var(--role-resid)]/30")}>
                  {x.layer + 1}
                </button>
              ))}
            </div>
            <div className="grid content-start gap-4">
              <Slider label="Block" value={st.layer + 1} min={1} max={n} step={1} onChange={(v) => set({ layer: v - 1 })} />
              <TensorCard title={`Block ${st.layer + 1}, token “${label(t)}”`} kind="recorded" captured="module-boundary hooks, one forward pass of the sentence (bfloat16)" shape="[1, 6, 4,096] per site" shown="RMS of the 4,096 numbers for the selected token; gains are stored weights">
                <div className="grid gap-x-6 gap-y-1 text-[14px] sm:grid-cols-2">
                  <span className="text-ink-3">stream entering</span><span className="num">{l.resid_pre_rms[t].toFixed(3)}</span>
                  <span className="text-ink-3">attention update</span><span className="num">{l.attn_out_rms[t].toFixed(3)}</span>
                  <span className="text-ink-3">MLP update</span><span className="num">{l.mlp_out_rms[t].toFixed(3)}</span>
                  <span className="text-ink-3">stream leaving</span><span className="num">{l.resid_post_rms[t].toFixed(3)}</span>
                  <span className="text-ink-3">mean learned gain, RMSNorm #1</span><span className="num">{g.input_layernorm[st.layer].mean.toFixed(3)}</span>
                  <span className="text-ink-3">mean learned gain, RMSNorm #2</span><span className="num">{g.post_attention_layernorm[st.layer].mean.toFixed(3)}</span>
                </div>
              </TensorCard>
              <LineChart title={`Size of the stream for “${label(t)}” after each block`} logY xLabel="depth (0 = embeddings)" yLabel="RMS (log)" height={210}
                markers={[{ x: st.layer + 1, label: `block ${st.layer + 1}` }]}
                series={[{ key: "r", label: "residual RMS", color: "var(--role-resid)", points: [{ x: 0, y: data.trace.embedding_rms[t] }, ...Lyr.map((x) => ({ x: x.layer + 1, y: x.resid_post_rms[t] }))] }]} />
            </div>
          </div>
          {lvl === "research" && (
            lens ? (
              <TensorCard title={`Diagnostic projection after block ${st.layer + 1}`} kind="recorded" captured="final RMSNorm + LM head applied to the residual stream after this block (logit lens)" shape="[151,936] scores" shown="top 3 tokens by diagnostic probability; rank of the final choice">
                <p className="text-[14px]">{lens.top.slice(0, 3).map((x) => `${showTok(x.text)} (${(x.p * 100).toFixed(1)}%)`).join(" · ")} · final choice “{showTok(data.trace.final.top[0].text)}” ranks {lens.final_top_rank.toLocaleString("en-US")}</p>
                <p className="mt-1 text-[12.5px] text-ink-3">This is an intermediate diagnostic projection, not Qwen&apos;s output at this block. The head was trained to read only the last block&apos;s output; only block {n} gives the actual prediction.</p>
              </TensorCard>
            ) : <p className="text-[13px] text-ink-3">Diagnostic projections were recorded for the last token (“␣notebook”) only. Select it to see them.</p>
          )}
        </div>
      }
      side={<>
        <SceneText
          tryThis="Pick block 1, then block 18, then block 36. Your choice stays when you change level or go back to scene 3."
          consequence={<>Block {st.layer + 1}: the stream for “{label(t)}” enters with size {l.resid_pre_rms[t].toFixed(2)} and leaves with {l.resid_post_rms[t].toFixed(2)}. Its RMSNorm #1 gain averages {g.input_layernorm[st.layer].mean.toFixed(3)}, different from other blocks.</>}
          explain={byLevel(lvl, {
            story: <>Qwen stacks <strong>{n} blocks</strong>. Every block has the same design but its own learned numbers, so each one makes a different kind of change.</>,
            mechanics: <>The output of block k is the input of block k+1: <span className="font-mono">x^(k+1) = Block_k(x^(k))</span>. Shapes stay <span className="font-mono">[B, T, d]</span> all the way up. Each block has {data.arch.parameters.per_layer.total.toLocaleString("en-US")} parameters of its own.</>,
            research: <>The chart is a real measurement for one sentence; position 0 develops very large values (a “massive activation”). One sentence is an illustration, not a general finding about Qwen.</>,
          })}
        />
        <AnalogyLimit analogy="Floors of a building built from the same blueprint, each furnished differently." limit="We cannot name a floor's job (“the grammar floor”). No experiment here supports such labels, and information is spread across many blocks." />
        <Check id="stack-weights" prompt="Do block 3 and block 30 use the same weights?" options={[
          { label: "Yes, they are copies", feedback: "The design repeats but each block has its own learned parameters. Compare the gain values of different blocks." },
          { label: "No, each block has its own", correct: true, feedback: "Same architecture, different learned weights, so different computations." },
        ]} />
        <Deeper label="Why does the stream keep growing?">Each block adds updates, so the stream accumulates them. RMSNorm rescales only the copies that feed attention and the MLP, which is why sub-layers still see well-scaled inputs.</Deeper>
      </>}
    />
  );
}
