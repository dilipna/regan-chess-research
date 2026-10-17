"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { BASE } from "@/lib/latent/paths";
import { CHECKS, MATCH_TOLERANCE, NOT_DERIVABLE, absMax, parseLayer, rankVariants, rmsOf, type GbArrays, type GbCheck, type GbManifest } from "@/lib/latent/glassbox";
import { Grid, Prov, RoleTag, Segment, Slider, VectorBars, showTok, type Role } from "./kit";

const cache = new Map<string, Promise<GbArrays>>();
function loadBlock(m: GbManifest, idx: number): Promise<GbArrays> {
  const meta = m.layers[idx];
  let p = cache.get(meta.file);
  if (!p) {
    p = fetch(`${BASE}/glassbox/${meta.file}`).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); }).then((b) => parseLayer(meta, b));
    p.catch(() => cache.delete(meta.file));
    cache.set(meta.file, p);
  }
  return p;
}

const pct = (x: number) => (x < 0.0001 ? "< 0.01%" : `${(x * 100).toFixed(x < 0.01 ? 2 : 1)}%`);
const first = (x: ArrayLike<number>, n = 12) => Array.from({ length: n }, (_, i) => x[i]);

function Stage({ n, role, title, module, children, derived }: { n: number; role: Role; title: string; module: string; children: React.ReactNode; derived?: "checked" | "weights" }) {
  return (
    <li className="relative grid grid-cols-[34px_1fr] gap-3">
      <div aria-hidden className="flex flex-col items-center">
        <span className="num flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink bg-paper text-[13px] font-semibold">{n}</span>
        <span className="w-[3px] flex-1 bg-[var(--role-resid)] opacity-40" />
      </div>
      <section className="ll-panel mb-4 min-w-0 rounded-2xl border border-rule bg-paper p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2"><RoleTag role={role}>{title}</RoleTag><code className="font-mono text-[12px] text-ink-3">{module}</code></div>
          {derived === "checked" ? <span className="rounded-full border border-[var(--role-norm)] bg-[var(--role-norm-soft)] px-2.5 py-0.5 text-[12px] font-medium text-[var(--role-norm-ink)]">re-derived in your browser</span>
            : derived === "weights" ? <span className="rounded-full border border-dashed border-ink-3 px-2.5 py-0.5 text-[12px] text-ink-3">needs the weight matrix: recorded input → output</span> : null}
        </div>
        {children}
      </section>
    </li>
  );
}

function CheckPanel({ check, A, m, onResult }: { check: GbCheck; A: GbArrays; m: GbManifest; onResult?: (ok: boolean) => void }) {
  const correctId = check.variants.find((v) => v.correct)!.id;
  const [variant, setVariant] = useState(correctId);
  const [pos, setPos] = useState(m.query_position);
  const ranked = useMemo(() => rankVariants(check, A, m, pos), [check, A, m, pos]);
  const r = ranked.find((x) => x.id === variant)!;
  const { got, ref } = useMemo(() => check.run(A, m, variant, pos), [check, A, m, variant, pos]);
  const correct = ranked.find((x) => x.correct)!;
  const reproduces = correct.best && correct.cmp.maxRel < MATCH_TOLERANCE && pos === m.query_position;
  useEffect(() => { onResult?.(reproduces); }, [reproduces, onResult]);
  return (
    <div className="grid gap-3 rounded-xl border-2 border-dashed border-[var(--role-norm)] p-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[14px] text-ink-2">Which formula reproduces Qwen&apos;s recorded output? <span className="font-mono text-ink">{check.operation}</span></span>
      </div>
      <Segment label={`Candidate formula for ${check.title}`} value={variant} onChange={setVariant} options={check.variants.map((v) => ({ value: v.id, label: v.label }))} />
      {check.usesPosition && <Slider label="position used for the rotation" value={pos} min={0} max={10} step={1} onChange={setPos} format={(p) => (p === m.query_position ? `${p} (the token's real position)` : String(p))} />}
      <p className={cn("text-[15px]", r.best && r.cmp.maxRel < MATCH_TOLERANCE ? "text-[var(--role-norm-ink)]" : "text-[var(--bad-ink)]")} aria-live="polite">
        {r.best && r.cmp.maxRel < MATCH_TOLERANCE
          ? <><strong>Reproduces the recorded output</strong> to bfloat16 precision: median error {pct(r.cmp.medianRel)}, largest error {pct(r.cmp.maxRel)} of the vector&apos;s largest value.</>
          : <><strong>Does not reproduce it as well:</strong> median error {pct(r.cmp.medianRel)}, {r.ratio.toFixed(r.ratio < 10 ? 1 : 0)}× worse than the best candidate{r.cmp.maxRel < 0.1 ? " (close, but measurably worse)" : ""}.</>}
      </p>
      <VectorBars values={first(got)} compare={first(ref)} compareLabel="recorded Qwen output" label={`first 12 of ${ref.length.toLocaleString("en-US")} numbers: computed with this formula`} role="norm" height={90} />
      <details className="text-[13.5px]"><summary className="cursor-pointer text-ink-2">All candidates, ranked</summary>
        <table className="table-lab mt-2"><thead><tr><th>candidate</th><th className="r">median error</th><th className="r">largest error</th><th className="r">vs best</th></tr></thead>
          <tbody>{[...ranked].sort((a, b) => a.cmp.medianRel - b.cmp.medianRel).map((x) => (
            <tr key={x.id}><td>{x.label}{x.correct ? " (Qwen's documented formula)" : ""}</td><td className="num r">{pct(x.cmp.medianRel)}</td><td className="num r">{pct(x.cmp.maxRel)}</td><td className="num r">{x.best ? "best" : `${x.ratio.toFixed(1)}×`}</td></tr>
          ))}</tbody></table></details>
    </div>
  );
}

function Stat({ label, x }: { label: string; x: ArrayLike<number> }) {
  const mx = absMax(x);
  return <span className="text-[13.5px] text-ink-2">{label}: RMS <strong className="num text-ink">{rmsOf(x).toFixed(3)}</strong>, largest |value| <strong className="num text-ink">{mx.value.toFixed(2)}</strong> (dimension {mx.index})</span>;
}

export function GlassBox({ manifest }: { manifest: GbManifest }) {
  const m = manifest;
  const [idx, setIdx] = useState(1);
  const [A, setA] = useState<GbArrays | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let live = true;
    loadBlock(m, idx).then((a) => { if (live) { setA(a); setErr(null); } }, (e: Error) => live && setErr(e.message));
    return () => { live = false; };
  }, [m, idx]);
  const layer = m.layers[idx];
  const C = Object.fromEntries(CHECKS.map((c) => [c.id, c]));
  const report = (id: string) => (v: boolean) => setOk((o) => (o[`${idx}:${id}`] === v ? o : { ...o, [`${idx}:${id}`]: v }));
  const nOk = CHECKS.filter((c) => ok[`${idx}:${c.id}`]).length;
  const q = m.tokens[m.query_position];
  const mean = A ? A.resid_pre.reduce((s, v) => s + v, 0) / A.resid_pre.length : 0;
  return (
    <div>
      <div className="grid gap-6 border-b border-rule pb-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div>
          <div className="text-[13px] font-semibold tracking-wide text-ink-3 uppercase">Glass Box</div>
          <h1 className="mt-1 font-serif text-[34px] leading-tight font-semibold text-ink sm:text-[44px]">One real block of Qwen3-8B, opened and re-checked in your browser</h1>
          <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-ink-2">
            Every number on this page was recorded from the real model while it read “{m.text}”. Your browser then redoes each step that does not need the 16 GB of weights,
            and tests which formula reproduces Qwen&apos;s numbers. Try the wrong ones: only the operations Qwen actually uses fit.
          </p>
        </div>
        <div className="ll-panel grid gap-3 rounded-2xl border border-rule bg-paper p-5">
          <Prov kind="recorded" detail="re-derived in your browser" />
          <Segment label="Block" value={idx} onChange={(v) => { setIdx(v); setA(null); }} options={m.layers.map((l, i) => ({ value: i, label: `block ${l.layer + 1} of ${m.n_layers}` }))} />
          <p className="text-[14px] text-ink-2">Following the last token, <span className="font-mono">{showTok(q.text)}</span> (position {m.query_position}); the other {m.query_position} positions provide keys and values.</p>
          <div className="rounded-xl bg-[var(--role-norm-soft)] p-3 text-[15px]" aria-live="polite">
            {A ? <><strong className="num text-[22px]">{nOk} / {CHECKS.length}</strong> operations reproduced at bfloat16 precision in block {layer.layer + 1}. {NOT_DERIVABLE.length} matrix multiplications need the weights.</> : err ? `Could not load the block: ${err}` : "Loading 0.4 MB of recorded tensors…"}
          </div>
        </div>
      </div>
      {A && (
        <ol className="mt-8" key={idx}>
          <Stage n={1} role="resid" title="Residual stream entering the block" module="layer input">
            <Stat label={`${m.hidden_size.toLocaleString("en-US")} numbers`} x={A.resid_pre} />
            <div className="mt-2"><VectorBars values={first(A.resid_pre)} label="first 12 numbers" height={80} /></div>
          </Stage>
          <Stage n={2} role="norm" title="RMSNorm #1" module="input_layernorm" derived="checked">
            <CheckPanel check={C.rms1} A={A} m={m} onResult={report("rms1")} />
            <p className="mt-3 rounded-lg bg-paper-2/60 p-3 text-[14.5px] text-ink-2">
              <strong className="text-ink">Why LayerNorm comes close:</strong> on this real vector the mean is only {(Math.abs(mean) / rmsOf(A.resid_pre) * 100).toFixed(1)}% of the RMS, so subtracting it changes little.
              RMSNorm still fits clearly better. Measured on one token in three blocks; it is an observation, not a general proof.
            </p>
          </Stage>
          <Stage n={3} role="attn" title="Q, K, V projections" module="q_proj, k_proj, v_proj" derived="weights">
            <div className="grid gap-2"><Stat label="normalized input" x={A.attn_norm} /><Stat label={`query (${m.n_heads} heads × ${m.head_dim})`} x={A.q_raw} /><Stat label={`key (${m.n_kv_heads} heads × ${m.head_dim})`} x={A.k_raw} /></div>
          </Stage>
          <Stage n={4} role="norm" title="Q and K RMSNorm" module="q_norm, k_norm" derived="checked">
            <div className="grid gap-3"><CheckPanel check={C.qnorm} A={A} m={m} onResult={report("qnorm")} /><CheckPanel check={C.knorm} A={A} m={m} onResult={report("knorm")} /></div>
          </Stage>
          <Stage n={5} role="attn" title="RoPE rotation" module="apply_rotary_pos_emb" derived="checked">
            <CheckPanel check={C.rope} A={A} m={m} onResult={report("rope")} />
          </Stage>
          <Stage n={6} role="attn" title="Scores, scaling, softmax" module="eager attention" derived="checked">
            <CheckPanel check={C.softmax} A={A} m={m} onResult={report("softmax")} />
            <details className="mt-3"><summary className="cursor-pointer text-[14px] text-ink-2">Recorded attention shares of all {m.n_heads} heads</summary>
              <div className="mt-2"><Grid m={Array.from({ length: m.n_heads }, (_, h) => first(A.attn_probs.subarray(h * (m.query_position + 1)), m.query_position + 1))}
                rows={Array.from({ length: m.n_heads }, (_, h) => `head ${h}`)} cols={m.tokens.map((t) => (t.prefix ? "⟨start⟩" : showTok(t.text)))} fmt={(v) => `${(v * 100).toFixed(0)}%`} /></div></details>
          </Stage>
          <Stage n={7} role="attn" title="Weighted sum of values" module="grouped-query attention" derived="checked">
            <CheckPanel check={C.wsum} A={A} m={m} onResult={report("wsum")} />
          </Stage>
          <Stage n={8} role="attn" title="Output projection" module="o_proj" derived="weights">
            <Stat label="attention update" x={A.o_out} />
          </Stage>
          <Stage n={9} role="resid" title="Residual addition #1" module="x + update" derived="checked">
            <CheckPanel check={C.res1} A={A} m={m} onResult={report("res1")} />
          </Stage>
          <Stage n={10} role="norm" title="RMSNorm #2" module="post_attention_layernorm" derived="checked">
            <CheckPanel check={C.rms2} A={A} m={m} onResult={report("rms2")} />
          </Stage>
          <Stage n={11} role="mlp" title="SwiGLU MLP" module="gate_proj, up_proj, down_proj" derived="checked">
            <div className="mb-3 grid gap-1"><Stat label={`gate (${m.intermediate_size.toLocaleString("en-US")} features)`} x={A.gate} /><Stat label="up" x={A.up} /></div>
            <CheckPanel check={C.swiglu} A={A} m={m} onResult={report("swiglu")} />
            <p className="mt-2 text-[13px] text-ink-3">gate_proj, up_proj and down_proj themselves need the weight matrices; the elementwise SiLU(gate) × up between them is re-derived.</p>
          </Stage>
          <Stage n={12} role="resid" title="Residual addition #2" module="x′ + update" derived="checked">
            <CheckPanel check={C.res2} A={A} m={m} onResult={report("res2")} />
            <div className="mt-3"><Stat label="leaving the block" x={A.resid_post} /></div>
          </Stage>
        </ol>
      )}
      <section className="mt-6 grid gap-3 rounded-2xl border border-rule bg-paper-2/50 p-5 text-[14.5px] text-ink-2">
        <h2 className="text-[17px] font-semibold text-ink">What this does and does not show</h2>
        <p>It shows that the recorded tensors are consistent with Qwen3&apos;s documented operations, step by step, to bfloat16 precision, and that plausible alternatives (LayerNorm, no √d scaling, a different rotation pairing, a different KV grouping, ReLU) fit worse.</p>
        <p>It does not re-derive the matrix multiplications ({NOT_DERIVABLE.map((x) => x.name).join("; ")}), which need the learned weights, and it covers one token in three blocks.</p>
        <p className="text-[13px] text-ink-3">Captured with scripts/latentlens/capture_glassbox.py ({m.model_id} @ {m.revision.slice(0, 8)}, {m.dtype}, eager attention). The same checks were run in Python at capture time and agree.</p>
        <Link href="/latent/journey?s=3" className="w-fit text-[14px] text-ink underline underline-offset-2">Back to the journey: the same block with toy numbers →</Link>
      </section>
    </div>
  );
}

/** The RMSNorm check on one recorded block, for use inside other pages (demo, journey). */
export function RealRmsCheck({ manifest, block = 1 }: { manifest: GbManifest; block?: number }) {
  const [A, setA] = useState<GbArrays | null>(null);
  useEffect(() => { let live = true; loadBlock(manifest, block).then((a) => { if (live) setA(a); }); return () => { live = false; }; }, [manifest, block]);
  const check = CHECKS.find((c) => c.id === "rms1")!;
  const meta = manifest.layers[block];
  if (!A) return <p className="text-[14px] text-ink-3" aria-live="polite">Loading block {meta.layer + 1} of the real model…</p>;
  const mean = A.resid_pre.reduce((s, v) => s + v, 0) / A.resid_pre.length;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2"><Prov kind="recorded" detail={`Qwen3-8B-Base block ${meta.layer + 1}, re-derived in your browser`} /></div>
      <CheckPanel check={check} A={A} m={manifest} />
      <p className="text-[14px] text-ink-2">On this real vector the mean is {(Math.abs(mean) / rmsOf(A.resid_pre) * 100).toFixed(1)}% of the RMS, which is why LayerNorm comes close; RMSNorm still fits clearly better.</p>
    </div>
  );
}
