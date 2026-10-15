"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { fmtInt, fmtProb, probsWithNormalizer, renormalize, showTok, topKMask, topPMask } from "@/lib/latent/toy";
import type { Architecture, TokenTrace } from "@/lib/latent/types";
import { Callout, Eq, Measured, Panel, SectionHead } from "./shell";

type Rule = "greedy" | "temperature" | "topk" | "topp";

export function DecodingLab({ trace }: { trace: TokenTrace }) {
  const lse = new Map(Object.entries(trace.final.logsumexp_by_temperature).map(([k, v]) => [Number(k), v] as const));
  const temps = [...lse.keys()].sort((a, b) => a - b);
  const [rule, setRule] = useState<Rule>("temperature");
  const [T, setT] = useState(1);
  const [k, setK] = useState(5);
  const [p, setP] = useState(0.5);
  const top = trace.final.top;
  const z = top.map((t) => t.logit);
  const Tuse = rule === "greedy" ? 1 : T;
  const pT = probsWithNormalizer(z, Tuse, lse.get(Tuse)!);
  const massShown = pT.reduce((a, b) => a + b, 0);
  let mask = top.map(() => true);
  if (rule === "greedy") mask = top.map((_, i) => i === 0);
  if (rule === "topk") mask = topKMask(pT, k);
  let nucleusIncomplete = false;
  if (rule === "topp") {
    mask = topPMask(pT, p);
    nucleusIncomplete = massShown < p;
  }
  const final = rule === "temperature" ? pT : renormalize(pT, mask);
  const show = 15;
  return (
    <Panel title="Decoding lab" badge={<Measured>Real top-50 logits; exact normalizers</Measured>}>
      <div role="radiogroup" aria-label="Decoding rule" className="mb-3 inline-flex flex-wrap rounded-md border border-rule-strong p-0.5">
        {([["greedy", "Greedy"], ["temperature", "Temperature"], ["topk", "Top-k"], ["topp", "Top-p"]] as const).map(([r, l]) => (
          <button key={r} role="radio" aria-checked={rule === r} onClick={() => setRule(r)} className={cn("rounded px-2.5 py-1 text-[12.5px]", rule === r ? "bg-ink text-paper" : "text-ink-3 hover:text-ink")}>{l}</button>
        ))}
      </div>
      <div className="grid gap-3 text-[13px] text-ink-2 sm:grid-cols-3">
        {rule !== "greedy" && (
          <div>temperature T
            <div role="radiogroup" aria-label="Temperature" className="mt-1 flex flex-wrap gap-1">
              {temps.map((t) => <button key={t} role="radio" aria-checked={T === t} onClick={() => setT(t)} className={cn("num rounded border px-1.5 py-0.5 text-[12px]", T === t ? "border-ink bg-ink text-paper" : "border-rule-strong text-ink-3")}>{t}</button>)}
            </div>
          </div>
        )}
        {rule === "topk" && <label>k = <span className="num text-ink">{k}</span><input type="range" min={1} max={20} value={k} onChange={(e) => setK(Number(e.target.value))} className="block w-full" /></label>}
        {rule === "topp" && <label>p = <span className="num text-ink">{p.toFixed(2)}</span><input type="range" min={0.05} max={0.95} step={0.05} value={p} onChange={(e) => setP(Number(e.target.value))} className="block w-full" /></label>}
      </div>
      <div className="scroll-x mt-3">
        <table className="table-lab">
          <thead><tr><th>token</th><th className="r">logit</th><th className="r">p (T={rule === "greedy" ? 1 : T})</th><th className="r">{rule === "temperature" ? "sampling p" : "after rule"}</th><th className="w-2/5" aria-hidden /></tr></thead>
          <tbody>{top.slice(0, show).map((t, i) => (
            <tr key={t.id} className={cn(!mask[i] && "text-ink-4")}>
              <td className="font-mono whitespace-pre">{showTok(t.text)}</td><td className="num r">{t.logit.toFixed(2)}</td><td className="num r">{fmtProb(pT[i])}</td>
              <td className="num r">{mask[i] ? fmtProb(final[i]) : "excluded"}</td>
              <td aria-hidden><div className="h-2 rounded-r-[3px]" style={{ width: `${Math.min(100, final[i] * 100 / Math.max(...final.slice(0, show), 1e-9))}%`, background: mask[i] ? "var(--viz-1)" : "transparent" }} /></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
        {rule === "greedy" && "Greedy decoding always takes the highest-probability token. It is deterministic."}
        {rule === "temperature" && `Logits are divided by T before softmax. T < 1 sharpens the distribution, T > 1 flattens it. The 50 exported tokens hold ${(massShown * 100).toFixed(1)}% of the probability at T = ${T}; the rest is spread over the other ${fmtInt(trace.final.vocab_rows - 50)} rows.`}
        {rule === "topk" && `Only the ${k} highest-probability tokens are kept and renormalised; sampling then draws among them.`}
        {rule === "topp" && (nucleusIncomplete
          ? `At T = ${T} the exported 50 tokens hold only ${(massShown * 100).toFixed(1)}%, less than p; the true nucleus extends beyond them, so this view is incomplete.`
          : "The nucleus is the smallest set of top tokens whose probabilities add up to at least p. It grows when the model is uncertain and shrinks when it is confident.")}
        {" "}These are inference-time decoding strategies. They are not how the model was pretrained.
      </p>
    </Panel>
  );
}

export function LensLastPosition({ trace }: { trace: TokenTrace }) {
  const rows = trace.diagnostic_lens_last_position;
  const finalTop = trace.final.top[0];
  return (
    <Panel title={`Intermediate diagnostic projection of the last position ("${showTok(trace.tokens[trace.tokens.length - 1].text)}")`} badge={<Measured />}>
      <p className="mb-3 text-[12.5px] leading-relaxed text-ink-2">
        Each row applies Qwen&apos;s own final RMSNorm and LM head to the residual stream after a block. This is a diagnostic, not &quot;Qwen&apos;s prediction at layer k&quot;:
        the final norm and LM head were trained to read only the last residual. The model&apos;s actual prediction is the last row.
      </p>
      <div className="scroll-x max-h-[360px] overflow-y-auto rounded border border-rule">
        <table className="table-lab">
          <thead><tr><th>depth</th><th>top projected tokens (diagnostic probability)</th><th className="r">rank of final choice &quot;{showTok(finalTop.text)}&quot;</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.depth} className={cn(r.depth === rows.length - 1 && "bg-llm-soft/60")}>
              <td className="num">{r.depth === 0 ? "0 (embeddings)" : r.depth}{r.depth === rows.length - 1 && " · actual output"}</td>
              <td className="font-mono text-[12px] whitespace-pre">{r.top.slice(0, 3).map((t) => `${showTok(t.text)} ${fmtProb(t.p)}`).join("   ")}</td>
              <td className="num r">{fmtInt(r.final_top_rank)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </Panel>
  );
}

export function OutputLab({ arch, trace }: { arch: Architecture; trace: TokenTrace }) {
  const v = arch.verified;
  return (
    <section>
      <SectionHead n="7a" kicker="Learn · inference" title="Final RMSNorm, LM head, logits and decoding" id="output">
        After the last block, one more RMSNorm and a linear layer turn each position&apos;s {fmtInt(v.hidden_size)}-number vector into {fmtInt(v.vocab_size)} scores.
      </SectionHead>
      <div className="grid gap-6">
        <Panel>
          <ol className="grid gap-1.5 font-mono text-[13px] text-ink">
            <li>h = model.norm(x) <span className="font-sans text-ink-3">[B, T, {v.hidden_size}] → [B, T, {v.hidden_size}]</span></li>
            <li>z = lm_head(h) <span className="font-sans text-ink-3">[B, T, {v.hidden_size}] → [B, T, {fmtInt(v.vocab_size)}]{v.tie_word_embeddings ? " (tied)" : " (separate weights, not tied)"}</span></li>
            <li>p = softmax(z) <span className="font-sans text-ink-3">over the last axis</span></li>
          </ol>
          <Eq label="p i equals exp of z i divided by the sum over j of exp of z j">p_i = exp(z_i) / Σ_j exp(z_j)</Eq>
          <Callout>LOGIT ≠ PROBABILITY. In the table below the top logit is {trace.final.top[0].logit.toFixed(1)} but its probability is {fmtProb(trace.final.top[0].p)}. Adding the same constant to every logit would leave every probability unchanged.</Callout>
        </Panel>
        <DecodingLab trace={trace} />
        <LensLastPosition trace={trace} />
      </div>
    </section>
  );
}
