"use client";

import Link from "next/link";
import { SCENES, useProgress } from "@/lib/latent/journey";
import type { Architecture, LayerProbe, Pending, RecallPrecision } from "@/lib/latent/types";
import { Prov, RoleTag, type Role } from "./kit";
import { LABS } from "@/lib/latent/labs";

const SCENE_ROLE: Role[] = ["out", "resid", "resid", "attn", "mlp", "resid", "out", "norm"];

export function LandingHero() {
  return (
    <div className="grid gap-8 border-b border-rule pb-10 lg:grid-cols-[1.3fr_1fr] lg:items-end">
      <div>
        <div className="text-[13px] font-semibold tracking-wide text-ink-3 uppercase">LatentLens · Version 2 of MoveLens</div>
        <h1 className="mt-2 font-serif text-[40px] leading-[1.05] font-semibold text-ink sm:text-[56px]">How does this piece of text become the next token?</h1>
        <p className="mt-5 max-w-2xl text-[18px] leading-relaxed text-ink-2">
          Follow one sentence through a real language model, Qwen3-8B-Base, one step at a time. You predict, change something, and see what happens.
          No background is needed to start; the Mechanics and Research levels open the mathematics and the recorded measurements.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/latent/journey" className="rounded-xl bg-ink px-6 py-3 text-[17px] font-medium text-paper">Start the journey (about 10 minutes) →</Link>
          <Link href="/latent/demo" className="rounded-xl border-2 border-rule-strong px-5 py-3 text-[16px] text-ink hover:border-ink-3">Professor demo</Link>
        </div>
      </div>
      <div className="ll-panel rounded-2xl border border-rule bg-paper p-5">
        <div className="text-[13px] font-semibold tracking-wide text-ink-3 uppercase">The example</div>
        <p className="mt-2 font-serif text-[26px] text-ink">The researcher opened the notebook <span className="rounded bg-[var(--role-resid-soft)] px-1.5 font-mono text-[22px] text-[var(--role-resid-ink)]">?</span></p>
        <div className="mt-4 flex flex-wrap gap-2"><RoleTag role="resid" /><RoleTag role="norm" /><RoleTag role="attn" /><RoleTag role="mlp" /></div>
        <p className="mt-4 text-[14px] leading-relaxed text-ink-2">Every number on these pages is labelled: <Prov kind="toy" /> <Prov kind="recorded" /> <Prov kind="pending" /></p>
      </div>
    </div>
  );
}

export function JourneyMap() {
  const progress = useProgress();
  return (
    <section className="mt-12">
      <h2 className="font-serif text-[28px] font-semibold text-ink">The journey</h2>
      <p className="mt-1 text-[16px] text-ink-2">Eight connected scenes. Each one asks a question, gives you one thing to change, and shows the consequence.</p>
      <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SCENES.map((s, i) => (
          <li key={s.n}>
            <Link href={`/latent/journey?s=${s.n}`} className="ll-panel flex h-full flex-col gap-2 rounded-2xl border border-rule bg-paper p-4 hover:border-ink-3">
              <span className="flex items-center justify-between"><span className="num font-serif text-[30px] text-ink-4">{s.n}</span><RoleTag role={SCENE_ROLE[i]} /></span>
              <span className="text-[17px] font-semibold text-ink">{s.title}</span>
              <span className="text-[14px] text-ink-2">{s.question}</span>
              {progress[`scene:${s.id}`] && <span className="text-[12.5px] text-[var(--role-norm-ink)]">visited ✓</span>}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function LabsStrip() {
  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h2 className="font-serif text-[28px] font-semibold text-ink">Labs</h2><p className="mt-1 text-[16px] text-ink-2">Focused experiments that go deeper than the journey.</p></div>
        <Link href="/latent/labs" className="text-[15px] text-ink underline underline-offset-2">All labs →</Link>
      </div>
      <ul className="mt-4 flex flex-wrap gap-2">
        {LABS.map((l) => <li key={l.slug}><Link href={`/latent/labs/${l.slug}`} className="inline-block rounded-full border-2 border-rule-strong bg-paper px-4 py-2 text-[15px] text-ink hover:border-ink-3">{l.title}</Link></li>)}
      </ul>
    </section>
  );
}

export function Destinations({ layerProbe, precision }: { layerProbe: LayerProbe | Pending; precision?: RecallPrecision }) {
  const g = precision?.passages[0];
  return (
    <section className="mt-12 grid gap-4 md:grid-cols-3">
      <Link href="/latent/research" className="ll-panel rounded-2xl border border-rule bg-paper p-5 hover:border-ink-3">
        <div className="flex items-center justify-between gap-2"><span className="text-[18px] font-semibold">Research workspace</span>{layerProbe.status === "ok" ? <Prov kind="recorded" /> : <Prov kind="pending" />}</div>
        <p className="mt-2 text-[15px] text-ink-2">Can Qwen&apos;s internal representations tell human-written from AI-generated text, and where? Plan, controls and status.</p>
      </Link>
      <Link href="/latent/recall" className="ll-panel rounded-2xl border border-rule bg-paper p-5 hover:border-ink-3">
        <div className="flex items-center justify-between gap-2"><span className="text-[18px] font-semibold">Recall evidence</span><Prov kind="recorded" /></div>
        <p className="mt-2 text-[15px] text-ink-2">Teacher-forced next-token accuracy on a famous text and an unpublished control{g ? ` (Gettysburg Address ${(g.top1_rate.bfloat16 * 100).toFixed(1)}%, bfloat16)` : ""}, traced through the layers.</p>
      </Link>
      <Link href="/latent/demo" className="ll-panel rounded-2xl border border-rule bg-paper p-5 hover:border-ink-3">
        <div className="flex items-center justify-between gap-2"><span className="text-[18px] font-semibold">Professor demo</span><span className="text-[13px] text-ink-3">5 steps</span></div>
        <p className="mt-2 text-[15px] text-ink-2">A keyboard-controlled presentation with presenter notes and optional deeper sections.</p>
      </Link>
    </section>
  );
}

export function QwenBlockOrder({ arch }: { arch: Architecture }) {
  const v = arch.verified;
  const steps: [Role, string, string][] = [
    ["norm", "input_layernorm", `RMSNorm over ${v.hidden_size.toLocaleString("en-US")} numbers (ε ${v.rms_norm_eps})`],
    ["attn", "q_proj, k_proj, v_proj", `Q: ${v.num_attention_heads} heads × ${v.head_dim}; K and V: ${v.num_key_value_heads} heads × ${v.head_dim}; no bias`],
    ["norm", "q_norm, k_norm", `RMSNorm over each ${v.qk_norm_dim}-number Q and K head vector (V is not normalized)`],
    ["attn", "rotary embedding", `RoPE on Q and K, θ = ${v.rope_theta.toLocaleString("en-US")}, rotate-half pairing`],
    ["attn", "causal attention", `grouped-query: ${v.query_heads_per_kv_head} query heads per KV head; scale 1/√${v.head_dim}`],
    ["attn", "o_proj", `${(v.num_attention_heads * v.head_dim).toLocaleString("en-US")} → ${v.hidden_size.toLocaleString("en-US")}`],
    ["resid", "+ residual", "first residual addition"],
    ["norm", "post_attention_layernorm", "RMSNorm, its own learned gain"],
    ["mlp", "mlp (SwiGLU)", `down(${v.activation.toUpperCase()}(gate(x)) × up(x)): ${v.hidden_size.toLocaleString("en-US")} → ${v.intermediate_size.toLocaleString("en-US")} → ${v.hidden_size.toLocaleString("en-US")}`],
    ["resid", "+ residual", "second residual addition"],
  ];
  return (
    <section className="mt-14">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-[28px] font-semibold text-ink">Real Qwen: the exact block order</h2>
        <Prov kind="recorded" detail="checked in the installed transformers source" />
      </div>
      <p className="mt-1 text-[16px] text-ink-2">{arch.model_id} @ {arch.revision.slice(0, 8)}: {v.num_hidden_layers} blocks like this, then a final RMSNorm and an output projection to {v.vocab_size.toLocaleString("en-US")} scores (not tied to the embedding).</p>
      <ol className="mt-4 grid gap-1.5">
        {steps.map(([r, m, d], i) => (
          <li key={i} className="grid grid-cols-[34px_minmax(150px,auto)_1fr] items-center gap-3 rounded-lg border border-rule bg-paper px-3 py-2">
            <span className="num text-[14px] text-ink-4">{i + 1}</span><RoleTag role={r}>{m}</RoleTag><span className="text-[14px] text-ink-2">{d}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
