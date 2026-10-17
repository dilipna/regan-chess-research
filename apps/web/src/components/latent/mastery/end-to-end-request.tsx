"use client";

// One request, three views. MODEL: what happens inside Qwen. SYSTEM: every component. SECURITY: trust boundaries.

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { WALK } from "@/lib/latent/mastery/course";
import { hrefFor } from "@/lib/latent/mastery";

type View = "model" | "system" | "security";
const MODEL_STEPS: { t: string; shape: string; topic: string }[] = [
  { t: "Tokenizer: the whole prompt (system + user + document) becomes ids", shape: "string → ids [T ≈ 2,000]", topic: "tokenization" },
  { t: "Embedding lookup: one learned row per id", shape: "[T] → [T, 4096]", topic: "embeddings" },
  { t: "36 blocks, each: RMSNorm → Q (32 heads), K/V (8 heads) → q_norm/k_norm → RoPE → causal attention → o_proj → add", shape: "[T, 4096] → [T, 4096]", topic: "causal-attention" },
  { t: "…then RMSNorm → SwiGLU MLP (4096 → 12288 → 4096) → add", shape: "[T, 4096] → [T, 4096]", topic: "swiglu" },
  { t: "Prefill stores K and V for all T positions in the KV cache", shape: "147,456 bytes per token", topic: "prefill-decode" },
  { t: "Final RMSNorm and LM head at the last position", shape: "[4096] → logits [151936]", topic: "lm-head" },
  { t: "Decoding picks one token; repeat per token, reusing the cache, until the summary and then a tool-call are written", shape: "logits → id, one step at a time", topic: "decoding" },
];
const TRUST: Record<string, string> = { trusted: "Trusted", untrusted: "Untrusted", mixed: "Mixed trust", control: "Enforcement point" };
const TONE: Record<string, string> = { trusted: "border-[var(--role-norm)]", untrusted: "border-[var(--role-mlp)] bg-[var(--role-mlp-soft)]", mixed: "border-[var(--role-attn)] bg-[var(--role-attn-soft)]", control: "border-ink bg-paper-2" };

export function EndToEndRequest() {
  const [view, setView] = useState<View>("system");
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="View">
        {(["model", "system", "security"] as const).map((v) => <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} className={cn("rounded-full border px-4 py-1.5 text-[14px] capitalize", view === v ? "border-ink bg-ink text-paper" : "border-rule-strong text-ink")}>{v} view</button>)}
      </div>
      <p className="text-[14.5px] text-ink-2">
        {view === "model" && "Inside the model: everything between the prompt and the tool-call text. Shapes are Qwen3-8B's."}
        {view === "system" && "Every component the request passes through, in order."}
        {view === "security" && "The same path with trust levels. A dashed line marks each trust boundary: a place where content or authority changes trust level and a control must exist."}
      </p>
      {view === "model" ? (
        <ol className="grid gap-2">
          <li className="rounded-lg border border-dashed border-rule-strong px-3 py-2 text-[14px] text-ink-3">Before: UI, API, authentication, retrieval and prompt construction (see system view).</li>
          {MODEL_STEPS.map((s, i) => (
            <li key={s.t} className="grid gap-1 rounded-lg border border-[var(--role-resid)] bg-[var(--role-resid-soft)] px-3 py-2 sm:grid-cols-[1fr_auto] sm:items-center">
              <span className="text-[14.5px] text-ink"><span className="num text-ink-3">{i + 1}.</span> {s.t} <Link href={hrefFor(s.topic)} className="text-[13px] text-[var(--role-resid-ink)] underline underline-offset-2">lesson</Link></span>
              <code className="font-mono text-[12.5px] text-ink-2">{s.shape}</code>
            </li>
          ))}
          <li className="rounded-lg border border-dashed border-rule-strong px-3 py-2 text-[14px] text-ink-3">After: the application parses the tool call, authorizes, confirms and acts (see security view). The model proposes; the system authorizes.</li>
        </ol>
      ) : (
        <ol className="grid gap-0">
          {WALK.map((w, i) => {
            const boundary = view === "security" && i > 0 && WALK[i - 1].trust !== w.trust;
            return (
              <li key={w.id} className="grid gap-0">
                {boundary && <div role="separator" aria-label="Trust boundary" className="my-1 flex items-center gap-2 text-[11.5px] font-semibold tracking-wide text-[var(--role-mlp-ink)] uppercase"><span className="h-0 flex-1 border-t-2 border-dashed border-[var(--role-mlp)]" />trust boundary<span className="h-0 flex-1 border-t-2 border-dashed border-[var(--role-mlp)]" /></div>}
                <div className={cn("my-1 grid gap-1 rounded-lg border px-3 py-2.5", view === "security" ? TONE[w.trust] : "border-rule bg-paper")}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[15px] font-semibold text-ink"><span className="num text-ink-4">{i + 1}.</span> {w.stage}</span>
                    {view === "security" && <span className="text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">{TRUST[w.trust]}</span>}
                  </div>
                  <p className="text-[14.5px] text-ink-2">{w.what}</p>
                  {view === "system" && <p className="text-[13.5px] text-ink-3">{w.detail}</p>}
                  {view === "security" && (w.risk || w.control) && (
                    <dl className="grid gap-x-3 text-[13.5px] sm:grid-cols-[5rem_1fr]">
                      {w.risk && <><dt className="font-semibold text-[var(--role-mlp-ink)]">Risk</dt><dd className="text-ink-2">{w.risk}</dd></>}
                      {w.control && <><dt className="font-semibold text-[var(--role-norm-ink)]">Control</dt><dd className="text-ink-2">{w.control}</dd></>}
                    </dl>
                  )}
                  <Link href={hrefFor(w.topic)} className="w-fit text-[13px] text-[var(--role-resid-ink)] underline underline-offset-2">Lesson</Link>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
