"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { causalAttention } from "@/lib/latent/toy-model";
import type { TokenTrace } from "@/lib/latent/types";
import { Check, Deeper, Grid, Prov, RoleTag, Segment, Slider, TensorCard, VectorBars, showTok } from "../kit";
import { LabFrame, Panel } from "./frame";

const NAMES = ["A", "B", "C", "D"];
const X0 = [[1, 0, 0.5], [0, 1, 0.5], [1, 1, 0], [0.5, -1, 1]];
const WQ = [[1, 0], [0, 1], [0.5, 0.5]];
const WK = [[1, 0.5], [0, 1], [1, -0.5]];
const WV = [[1, 0], [0, 1], [0.5, 0.5]];

export function AttentionLab({ trace }: { trace: TokenTrace }) {
  const [mode, setMode] = useState<"toy" | "recorded">("toy");
  const [X, setX] = useState(X0.map((r) => r.slice()));
  const [edit, setEdit] = useState(2);
  const [q, setQ] = useState(3);
  const base = causalAttention(X0, WQ, WK, WV);
  const a = causalAttention(X, WQ, WK, WV);
  const layers = trace.attention.layers;
  const [L, setL] = useState(layers[3] ?? layers[0]);
  const [head, setHead] = useState(0);
  const labels = trace.tokens.map((t) => (t.prefix ? "⟨start⟩" : showTok(t.text)));
  const rec = trace.attention.weights[L][head].map((row, i) => row.map((w, j) => (j > i ? null : w)));
  return (
    <LabFrame slug="attention" intro={<>Four toy tokens, three input numbers each, one head with d_head = 2. Change one token&apos;s input and follow the effect through every step. The recorded mode shows real Qwen3-8B-Base attention probabilities, with only the controls that recording supports.</>}>
      <Segment label="Data source" value={mode} onChange={setMode} options={[{ value: "toy", label: "Toy calculation (editable)" }, { value: "recorded", label: "Recorded Qwen (view only)" }]} />
      {mode === "toy" ? (<>
        <Panel title="Inputs" badge={<Prov kind="toy" />}>
          <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
            <Grid m={X} rows={NAMES} cols={["x0", "x1", "x2"]} role="resid" caption="X: one row per token (after RMSNorm, in a real block)" />
            <div className="grid content-start gap-3">
              <Segment label="Token to edit" value={edit} onChange={setEdit} options={NAMES.map((n, i) => ({ value: i, label: `edit ${n}` }))} />
              {X[edit].map((v, j) => <Slider key={j} label={`${NAMES[edit]}: x${j}`} value={v} min={-2} max={2} step={0.1} onChange={(n) => setX(X.map((r, i) => (i === edit ? r.map((o, k) => (k === j ? n : o)) : r)))} format={(n) => n.toFixed(1)} />)}
              <button type="button" onClick={() => setX(X0.map((r) => r.slice()))} className="w-fit rounded-lg border-2 border-rule-strong px-3 py-1 text-[14px]">↺ Reset inputs</button>
            </div>
          </div>
        </Panel>
        <Panel title="1. Projections" badge={<RoleTag role="attn">Q = XW_q, K = XW_k, V = XW_v</RoleTag>}>
          <div className="grid gap-4 md:grid-cols-3">
            <Grid m={a.q} rows={NAMES} cols={["q0", "q1"]} caption="Q (queries)" />
            <Grid m={a.k} rows={NAMES} cols={["k0", "k1"]} caption="K (keys)" />
            <Grid m={a.v} rows={NAMES} cols={["v0", "v1"]} caption="V (values)" />
          </div>
        </Panel>
        <Panel title="2–4. Scores, scaling, mask, shares" badge={<span className="text-[13px] text-ink-3">rows = queries, columns = keys</span>}>
          <div className="mb-3"><Segment label="Query row to highlight" value={q} onChange={setQ} options={NAMES.map((n, i) => ({ value: i, label: `query ${n}` }))} /></div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Grid m={a.scores} rows={NAMES} cols={NAMES} highlightRow={q} caption="Q·K (raw scores)" />
            <Grid m={a.masked} rows={NAMES} cols={NAMES} highlightRow={q} caption="÷ √2, future masked 🔒" />
            <Grid m={a.weights.map((r, i) => r.map((w, j) => (j > i ? null : w)))} rows={NAMES} cols={NAMES} highlightRow={q} caption="softmax: shares per row" fmt={(v) => `${(v * 100).toFixed(0)}%`} />
          </div>
          <p className="mt-3 text-[14.5px] text-ink-2" aria-live="polite">
            Query {NAMES[q]} shares: {a.weights[q].slice(0, q + 1).map((w, j) => `${NAMES[j]} ${(w * 100).toFixed(1)}%`).join(", ")}
            {" "}(before your edits: {base.weights[q].slice(0, q + 1).map((w, j) => `${NAMES[j]} ${(w * 100).toFixed(1)}%`).join(", ")}). Each row adds up to 100%.
          </p>
        </Panel>
        <Panel title="5. Weighted sum of values" badge={<Prov kind="toy" />}>
          <div className="grid gap-4 md:grid-cols-2">
            <p className="font-mono text-[14px] leading-relaxed">out({NAMES[q]}) = {a.weights[q].slice(0, q + 1).map((w, j) => `${w.toFixed(2)}·V_${NAMES[j]}`).join(" + ")}</p>
            <VectorBars values={a.out[q]} role="attn" compare={base.out[q]} compareLabel="before your edits" label={`output for ${NAMES[q]}`} />
          </div>
        </Panel>
      </>) : (
        <TensorCard title="Recorded Qwen3-8B-Base attention probabilities" kind="recorded" captured='attention probabilities from eager attention, one forward pass of "The researcher opened the notebook" (bfloat16)'
          shape="[1, 32 heads, 6, 6] per recorded block" shown={`one head; recorded blocks: ${layers.map((l) => Number(l) + 1).join(", ")}`}>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-[14px]">
            <label>block <select value={L} onChange={(e) => setL(e.target.value)} className="rounded border-2 border-rule-strong bg-paper px-1">{layers.map((l) => <option key={l} value={l}>{Number(l) + 1}</option>)}</select></label>
            <label>head <select value={head} onChange={(e) => setHead(Number(e.target.value))} className="rounded border-2 border-rule-strong bg-paper px-1">{Array.from({ length: 32 }, (_, h) => <option key={h} value={h}>{h}</option>)}</select></label>
          </div>
          <Grid m={rec} rows={labels} cols={labels} fmt={(v) => `${(v * 100).toFixed(0)}%`} caption="rows = queries, columns = keys" />
          <p className="mt-2 text-[13.5px] text-ink-3">Only the probabilities were recorded. Q, K, V, raw scores and other sentences are not available, so editing is disabled here rather than simulated.</p>
        </TensorCard>
      )}
      <div className={cn("grid gap-4 md:grid-cols-2")}>
        <Check id="lab-attn-mask" prompt="Which positions may token C attend to?" options={[
          { label: "A, B, C and D", feedback: "D comes after C. The causal mask hides it, so its share is exactly 0." },
          { label: "A, B and C", correct: true, feedback: "Itself and every earlier position." },
          { label: "Only B", feedback: "Attention can reach every earlier position, not only the previous one." },
        ]} />
        <Check id="lab-attn-explain" prompt="Token D gives 70% of its attention to A. Does that prove A caused the model's next prediction?" options={[
          { label: "Yes", feedback: "Attention weights describe one mixing step in one head. Other heads, the MLP and later blocks also shape the output, so a weight alone is not an explanation." },
          { label: "No, it is one ingredient among many", correct: true, feedback: "Weights show how values were mixed here, not why the final prediction came out as it did." },
        ]} />
      </div>
      <Deeper label="Grouped-query attention in Qwen">Qwen3-8B has 32 query heads but only 8 key/value heads: each K/V head is shared by 4 query heads, which makes the KV cache 4 times smaller. Each query head still has its own pattern.</Deeper>
    </LabFrame>
  );
}
