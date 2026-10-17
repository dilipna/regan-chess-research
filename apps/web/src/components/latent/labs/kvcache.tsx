"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { fmtBytes } from "@/lib/latent/toy";
import type { Architecture } from "@/lib/latent/types";
import { Check, Prov, Segment, Slider, TensorCard } from "../kit";
import { LabFrame, Panel } from "./frame";

const PROMPT = ["The", "␣researcher", "␣opened", "␣the"];
const NEW = ["␣notebook", "␣and", "␣wrote", "␣a", "␣note", "."];

/** Illustrative count of key/value projection computations per layer and KV head (not a speed measurement). */
export function kvOps(prompt: number, decoded: number, cached: boolean): number {
  if (cached) return prompt + decoded;
  let total = prompt;
  for (let k = 1; k <= decoded; k++) total += prompt + k;
  return total;
}

/** KV cache size in bytes for a decoder: 2 (K and V) × layers × kv_heads × head_dim × bytes × batch × tokens. */
export function kvBytes(layers: number, kvHeads: number, headDim: number, bytesPerValue: number, batch: number, tokens: number) {
  return 2 * layers * kvHeads * headDim * bytesPerValue * batch * tokens;
}

export function KvLab({ arch }: { arch: Architecture }) {
  const [step, setStep] = useState(0);
  const [cacheMode, setCacheMode] = useState<"yes" | "no">("yes");
  const cached = cacheMode === "yes";
  const P = PROMPT.length, total = P + step;
  const v = arch.verified;
  const [dtype, setDtype] = useState<"bfloat16" | "float32" | "int8">("bfloat16");
  const [batch, setBatch] = useState(1);
  const [seq, setSeq] = useState(4096);
  const bpv = dtype === "float32" ? 4 : dtype === "int8" ? 1 : 2;
  const bytes = kvBytes(v.num_hidden_layers, v.num_key_value_heads, v.head_dim, bpv, batch, seq);
  const mha = kvBytes(v.num_hidden_layers, v.num_attention_heads, v.head_dim, bpv, batch, seq);
  const tokens = [...PROMPT, ...NEW.slice(0, step)];
  return (
    <LabFrame slug="kv-cache" intro={<>Generating text means running the model again for every new token. Each run needs the keys (K) and values (V) of all earlier positions. A <strong>KV cache</strong> keeps them, so only the new position&apos;s Q, K and V are computed.</>}>
      <Panel title="Prefill, then one token at a time" badge={<Prov kind="toy" detail="operation counts are illustrative" />}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Segment label="Cache" value={cacheMode} onChange={setCacheMode} options={[{ value: "yes", label: "with KV cache" }, { value: "no", label: "without cache" }]} />
          <button type="button" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="rounded-lg border-2 border-rule-strong px-3 py-1.5 text-[14px] disabled:opacity-35">← Back</button>
          <button type="button" onClick={() => setStep(Math.min(NEW.length, step + 1))} disabled={step === NEW.length} className="rounded-lg bg-ink px-4 py-1.5 text-[14px] font-medium text-paper disabled:opacity-35">Generate one token →</button>
          <button type="button" onClick={() => setStep(0)} className="rounded-lg border-2 border-rule-strong px-3 py-1.5 text-[14px]">↺ Reset</button>
          <span className="text-[14px] text-ink-3">{step === 0 ? "Prefill: the prompt is processed in one pass." : `Decode step ${step}`}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-[4px] text-[13px]">
            <thead><tr><th className="pr-2 text-left font-normal text-ink-3">position</th>{tokens.map((t, i) => <th key={i} className="min-w-[78px] font-mono font-normal">{i}: {t}</th>)}</tr></thead>
            <tbody>
              {(["K", "V"] as const).map((kv) => (
                <tr key={kv}>
                  <th scope="row" className="pr-2 text-left font-medium">{kv}</th>
                  {tokens.map((_, i) => {
                    const isNew = step === 0 ? true : i === total - 1;
                    const recomputed = !cached && step > 0 && !isNew;
                    return (
                      <td key={i} className={cn("ll-anim h-10 rounded-md border-2 text-center",
                        isNew ? "border-[var(--role-attn)] bg-[var(--role-attn-soft)] font-semibold" : recomputed ? "border-[var(--bad)] bg-[var(--bad-soft)]" : "border-[var(--role-resid)] bg-[var(--role-resid-soft)]")}>
                        {isNew ? "new" : recomputed ? "recomputed" : "cached"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[13px] text-ink-3">Legend (words, not only colour): <strong>new</strong> = computed this step; <strong>cached</strong> = read from memory; <strong>recomputed</strong> = computed again because nothing was kept. Queries are never cached: only the newest position needs one.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-paper-2/60 p-3"><div className="text-[12.5px] text-ink-3">cache entries now</div><div className="num text-[26px]">{cached ? total : 0}</div></div>
          <div className="rounded-xl bg-paper-2/60 p-3"><div className="text-[12.5px] text-ink-3">K/V computations so far (with cache)</div><div className="num text-[26px]">{kvOps(P, step, true)}</div></div>
          <div className="rounded-xl bg-paper-2/60 p-3"><div className="text-[12.5px] text-ink-3">K/V computations so far (without cache)</div><div className="num text-[26px]">{kvOps(P, step, false)}</div></div>
        </div>
        <p className="mt-2 text-[12.5px] text-ink-3">Counts are per layer and per KV head, for this toy prompt of {P} tokens. They illustrate how work grows; they are not timing measurements.</p>
      </Panel>
      <TensorCard title="KV cache size for Qwen3-8B-Base" kind="recorded" captured="computed from the verified configuration (layers, KV heads, head dimension)" shape={`K and V: [batch, ${v.num_key_value_heads} KV heads, tokens, ${v.head_dim}] per layer, ${v.num_hidden_layers} layers`}
        shown="an estimate of the cache tensors only; excludes model weights, activations and allocator or framework overhead">
        <div className="grid gap-4 md:grid-cols-3">
          <div><div className="mb-1 text-[13.5px] text-ink-2">dtype</div><Segment label="dtype" value={dtype} onChange={setDtype} options={[{ value: "bfloat16", label: "bfloat16" }, { value: "float32", label: "float32" }, { value: "int8", label: "int8" }]} /></div>
          <Slider label="batch size" value={batch} min={1} max={16} step={1} onChange={setBatch} />
          <Slider label="sequence length (tokens)" value={seq} min={256} max={v.max_position_embeddings} step={256} onChange={setSeq} format={(x) => x.toLocaleString("en-US")} />
        </div>
        <p className="mt-4 text-[17px]">Estimated KV cache: <strong className="num">{fmtBytes(bytes)}</strong> <span className="text-[14px] text-ink-3">({dtype}, batch {batch}, {seq.toLocaleString("en-US")} tokens, overhead excluded)</span></p>
        <p className="mt-1 text-[14px] text-ink-2">With {v.num_attention_heads} KV heads (no grouping) it would be {fmtBytes(mha)}: {v.num_attention_heads / v.num_key_value_heads} times more. Fewer KV heads is the point of grouped-query attention.</p>
      </TensorCard>
      <div className="grid gap-4 md:grid-cols-2">
        <Check id="lab-kv-store" prompt="What does the KV cache store?" options={[
          { label: "The previous tokens' text", feedback: "Text is not enough: K and V would have to be recomputed from it in every layer." },
          { label: "Keys and values of earlier positions, in every layer", correct: true, feedback: "Exactly what attention needs from the past. Queries are not stored." },
          { label: "The model's weights", feedback: "Weights are stored once and never change during generation. The cache grows with the number of tokens." },
        ]} />
        <Check id="lab-kv-grow" prompt="Without a cache, how does the work for K/V grow as more tokens are generated?" options={[
          { label: "It stays constant per token", feedback: "Without a cache every step recomputes K and V for all earlier positions, so each step is more work than the last." },
          { label: "It grows with every step", correct: true, feedback: "Step k redoes all previous positions; the total grows roughly with the square of the length. With a cache each step adds one position." },
        ]} />
      </div>
    </LabFrame>
  );
}
