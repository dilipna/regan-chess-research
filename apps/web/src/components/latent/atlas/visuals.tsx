"use client";

// "See it": one small picture per Atlas part. Recorded values come from one forward pass of Qwen3-8B-Base over the
// running example; formula and config pictures are exact; anything made up for illustration says so.
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { AtlasExample } from "@/lib/latent/atlas-example";

export interface AtlasDims { L: number; d: number; F: number; V: number; H: number; Hkv: number; G: number; dh: number; theta: number }

type Kind = "recorded" | "formula" | "config" | "illustration";
const KIND: Record<Kind, { label: string; color: string }> = {
  recorded: { label: "Recorded · Qwen3-8B-Base", color: "var(--role-norm)" },
  formula: { label: "Exact formula", color: "var(--role-resid)" },
  config: { label: "From the model config", color: "var(--role-resid)" },
  illustration: { label: "Illustration · made-up numbers", color: "var(--ink-4)" },
};
const fmt = (n: number) => n.toLocaleString("en-US");
const MONO = "var(--font-figures), ui-monospace, monospace";

function Frame({ kind, caption, children }: { kind: Kind; caption: React.ReactNode; children: React.ReactNode }) {
  return (
    <figure className="mt-5 overflow-hidden rounded-2xl border border-rule bg-paper-2">
      <div className="flex items-center justify-between gap-2 border-b border-rule px-3.5 py-2">
        <span className="text-[10.5px] font-medium tracking-[0.14em] text-ink-4 uppercase">See it</span>
        <span className="flex items-center gap-1.5 text-[10.5px] text-ink-3">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: KIND[kind].color }} />{KIND[kind].label}
        </span>
      </div>
      <div className="px-3.5 pt-3.5">{children}</div>
      <figcaption className="px-3.5 pt-2.5 pb-3.5 text-[12.5px] leading-relaxed text-ink-3">{caption}</figcaption>
    </figure>
  );
}

export function SeeIt({ id, ex, d }: { id: string; ex?: AtlasExample; d: AtlasDims }) {
  switch (id) {
    // ---- the whole model ----
    case "text": return ex ? <Sentence ex={ex} /> : null;
    case "tokenizer": return ex ? <Chips ex={ex} /> : null;
    case "ids": return ex ? <Chips ex={ex} ids /> : null;
    case "embedding": return ex && ex.emb.length ? <Embeddings ex={ex} d={d} /> : null;
    case "blocks": case "resid_in": case "next_block": case "final_norm":
      return ex ? <Depth ex={ex} d={d} show="stream" id={id} /> : null;
    case "lm_head": case "logits": return ex ? <Top ex={ex} d={d} mode="logit" /> : null;
    case "softmax": return ex ? <Top ex={ex} d={d} mode="p" /> : null;
    case "next": return ex ? <Appended ex={ex} /> : null;
    // ---- one block ----
    case "norm1": case "a_in": return ex ? <Depth ex={ex} d={d} show="attnNorm" id={id} /> : null;
    case "norm2": case "m_in": return ex ? <Depth ex={ex} d={d} show="mlpNorm" id={id} /> : null;
    case "attn": case "attn_softmax": return ex ? <Heatmap ex={ex} mode="weights" /> : null;
    case "add1": case "a_out": return ex ? <Depth ex={ex} d={d} show="attnOut" id={id} /> : null;
    case "mlp": case "add2": case "m_out": return ex ? <Depth ex={ex} d={d} show="mlpOut" id={id} /> : null;
    // ---- attention ----
    case "q": case "k": case "v": return <Gqa d={d} focus={id as "q" | "k" | "v"} />;
    case "qknorm": return <QkNorm />;
    case "rope": return <Rope d={d} ex={ex} />;
    case "scores": case "mask": return ex ? <Heatmap ex={ex} mode="mask" /> : null;
    case "weighted": return ex ? <Heatmap ex={ex} mode="row" /> : null;
    case "oproj": return <Concat d={d} />;
    // ---- MLP ----
    case "gate": case "up": case "down": return <Widths d={d} focus={id} />;
    case "silu": return <Silu />;
    case "mul": return <GateProduct />;
    default: return null;
  }
}

// ---------- tokens ----------

function Sentence({ ex }: { ex: AtlasExample }) {
  const n = ex.tokens.filter((t) => !t.prefix).length;
  return (
    <Frame kind="recorded" caption={<>{ex.text.length} characters become {n} tokens, plus the document-start token LatentLens puts in front.</>}>
      <p className="font-serif text-[22px] leading-snug text-ink">&ldquo;{ex.text}&rdquo;</p>
    </Frame>
  );
}

function Chips({ ex, ids }: { ex: AtlasExample; ids?: boolean }) {
  return (
    <Frame kind="recorded" caption={ids
      ? <>Each piece is now just a row number. Nothing about &ldquo;notebook&rdquo; is in the number {ex.tokens.at(-1)?.id}.</>
      : <>␣ marks a leading space, which belongs to the next token. &ldquo; notebook&rdquo; and &ldquo;notebook&rdquo; are different tokens.</>}>
      <ul className="flex flex-wrap gap-1.5">
        {ex.tokens.map((t, i) => (
          <li key={i} className={cn("rounded-lg border px-2 py-1", t.prefix ? "border-dashed border-rule-strong" : "border-[color-mix(in_oklab,var(--role-resid)_45%,transparent)] bg-[var(--role-resid-soft)]")}>
            <div className={cn("font-mono text-[12.5px]", t.prefix ? "text-ink-4" : "text-ink")}>{t.label}</div>
            {ids && <div className="num font-mono text-[11px] text-[var(--role-resid-ink)]">{t.id}</div>}
          </li>
        ))}
      </ul>
    </Frame>
  );
}

function Embeddings({ ex, d }: { ex: AtlasExample; d: AtlasDims }) {
  const max = Math.max(...ex.emb.flatMap((e) => e.coords.map(Math.abs)));
  const n = ex.emb[0].coords.length;
  return (
    <Frame kind="recorded" caption={<>The first {n} of {fmt(d.d)} numbers in each token&apos;s row. Blue is negative, amber is positive. The values are small (RMS about {ex.emb[0].rms.toFixed(3)}) and only mean something in combination.</>}>
      <div className="grid gap-1">
        {ex.emb.map((e, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-[84px] shrink-0 truncate font-mono text-[11.5px] text-ink-2">{e.label}</span>
            <div className="flex flex-1 gap-[3px]">
              {e.coords.map((v, j) => (
                <span key={j} title={v.toFixed(4)} className="h-5 flex-1 rounded-[3px]"
                  style={{ background: `color-mix(in oklab, ${v < 0 ? "var(--role-resid)" : "var(--role-mlp)"} ${Math.round(12 + 80 * Math.abs(v) / max)}%, var(--paper))` }} />
              ))}
            </div>
            <span className="shrink-0 font-mono text-[10.5px] text-ink-4">…</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function Appended({ ex }: { ex: AtlasExample }) {
  const t = ex.top[0];
  return (
    <Frame kind="recorded" caption={<>The most likely next token was &ldquo;{t.label}&rdquo; at {(t.p * 100).toFixed(1)}%. It is appended and the whole pass runs again for the token after it.</>}>
      <div className="flex flex-wrap items-center gap-1.5 pb-1">
        {ex.tokens.filter((x) => !x.prefix).map((x, i) => <span key={i} className="rounded-md border border-rule-strong px-1.5 py-0.5 font-mono text-[12px] text-ink-3">{x.label}</span>)}
        <span className="atlas-pulse rounded-md border border-[var(--role-resid)] bg-[var(--role-resid-soft)] px-2 py-0.5 font-mono text-[12.5px] text-ink shadow-[0_0_14px_-2px_var(--role-resid)]">{t.label}</span>
        <span className="font-mono text-[11.5px] text-ink-4">↻ repeat</span>
      </div>
    </Frame>
  );
}

// ---------- depth chart (log scale) ----------

const SERIES = {
  stream: { label: "residual stream", color: "var(--role-resid)" },
  attnNorm: { label: "normalized copy for attention", color: "var(--role-norm)" },
  mlpNorm: { label: "normalized copy for the MLP", color: "var(--role-norm)" },
  attnOut: { label: "attention update", color: "var(--role-attn)" },
  mlpOut: { label: "MLP update", color: "var(--role-mlp)" },
} as const;

function Depth({ ex, d, show, id }: { ex: AtlasExample; d: AtlasDims; show: keyof typeof SERIES; id: string }) {
  const W = 330, H = 150, l = 30, r = 8, t = 8, b = 22;
  const lo = Math.log10(0.005), hi = Math.log10(60);
  const X = (k: number) => l + (k / d.L) * (W - l - r);
  const Y = (v: number) => t + (1 - (Math.log10(Math.max(v, 0.005)) - lo) / (hi - lo)) * (H - t - b);
  const line = (vals: number[], start: number) => vals.map((v, i) => `${i ? "L" : "M"} ${X(i + start).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
  const stream = ex.stream;
  const other = show === "stream" ? null : ex[show];
  const grow = stream[stream.length - 1] / stream[0];
  const last = ex.tokens.at(-1)?.label ?? "";
  const caption = {
    stream: id === "final_norm"
      ? <>The stream at &ldquo;{last}&rdquo; grows to RMS {stream.at(-1)!.toFixed(1)} by the last block. The final RMSNorm rescales it before the LM head reads it.</>
      : <>Size (RMS) of the stream at &ldquo;{last}&rdquo; after each block. Updates pile up, and it grows about {fmt(Math.round(grow))}× from the embedding to block {d.L}.</>,
    attnNorm: <>The stream keeps growing, but the copy attention reads is rescaled every block. Its size is set by the learned gain, not by how big the stream has become.</>,
    mlpNorm: <>Same story for the MLP&apos;s copy: rescaled every block, whatever the stream&apos;s size.</>,
    attnOut: <>Each block&apos;s attention update next to the stream it is added to. Updates are smaller than the stream, so no single block rewrites it.</>,
    mlpOut: <>Each block&apos;s MLP update next to the stream. The final blocks write unusually large updates as the prediction is assembled.</>,
  }[show];
  return (
    <Frame kind="recorded" caption={caption}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Line chart over ${d.L} blocks: ${SERIES.stream.label}${other ? ` and ${SERIES[show].label}` : ""}, log scale`}>
        {[0.01, 0.1, 1, 10].map((v) => (
          <g key={v}>
            <line x1={l} x2={W - r} y1={Y(v)} y2={Y(v)} stroke="var(--rule)" />
            <text x={l - 5} y={Y(v)} textAnchor="end" dominantBaseline="central" fontSize={9} fill="var(--ink-4)" fontFamily={MONO}>{v}</text>
          </g>
        ))}
        {[0, 9, 18, 27, 36].filter((k) => k <= d.L).map((k) => (
          <text key={k} x={X(k)} y={H - 6} textAnchor="middle" fontSize={9} fill="var(--ink-4)" fontFamily={MONO}>{k === 0 ? "emb" : k}</text>
        ))}
        <path d={line(stream, 0)} fill="none" stroke={SERIES.stream.color} strokeWidth={2.2} />
        {other && <path d={line(other, 1)} fill="none" stroke={SERIES[show].color} strokeWidth={2} strokeDasharray={show.endsWith("Norm") ? "4 3" : undefined} />}
        <circle cx={X(stream.length - 1)} cy={Y(stream.at(-1)!)} r={3} fill={SERIES.stream.color} />
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-3">
        <span className="flex items-center gap-1.5"><span className="h-[2px] w-4 rounded" style={{ background: SERIES.stream.color }} />{SERIES.stream.label}</span>
        {other && <span className="flex items-center gap-1.5"><span className="h-[2px] w-4 rounded" style={{ background: SERIES[show].color }} />{SERIES[show].label}</span>}
        <span className="text-ink-4">RMS, log scale · x = block</span>
      </div>
    </Frame>
  );
}

// ---------- attention ----------

function Heatmap({ ex, mode }: { ex: AtlasExample; mode: "weights" | "mask" | "row" }) {
  const [hi, setHi] = useState(0);
  const head = ex.heads[hi];
  const labels = ex.tokens.map((t) => (t.prefix ? "<eot>" : t.label));
  const T = labels.length;
  const picker = ex.heads.length > 1 && mode !== "mask" && (
    <div role="radiogroup" aria-label="Attention head" className="mb-3 flex flex-wrap gap-1">
      {ex.heads.map((h, i) => (
        <button key={i} type="button" role="radio" aria-checked={i === hi} onClick={() => setHi(i)}
          className={cn("rounded-full border px-2.5 py-0.5 font-mono text-[11px]", i === hi ? "border-[var(--role-attn)] bg-[var(--role-attn-soft)] text-ink" : "border-rule-strong text-ink-3 hover:text-ink")}>
          L{h.layer} · H{h.head}
        </button>
      ))}
    </div>
  );

  if (mode === "row") {
    const row = head.w[T - 1];
    return (
      <Frame kind="recorded" caption={<>Where &ldquo;{labels[T - 1]}&rdquo; takes its update from in layer {head.layer}, head {head.head}. This head {head.note}. The weights add up to 1.</>}>
        {picker}
        <div className="grid gap-1">
          {row.map((w, j) => (
            <div key={j} className="flex items-center gap-2">
              <span className="w-[84px] shrink-0 truncate font-mono text-[11.5px] text-ink-2">{labels[j]}</span>
              <div className="h-4 flex-1 rounded-sm bg-paper-3"><div className="h-4 rounded-sm bg-[var(--role-attn)] transition-[width] duration-500" style={{ width: `${w * 100}%` }} /></div>
              <span className="num w-10 shrink-0 text-right font-mono text-[11px] text-ink-3">{w.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </Frame>
    );
  }

  const cell = 100 / T;
  return (
    <Frame kind={mode === "mask" ? "formula" : "recorded"} caption={mode === "mask"
      ? <>Rows are queries, columns are keys. Each token may look at itself and everything before it. The hatched cells are in the future and are set to −∞ before softmax.</>
      : <>Real attention weights in layer {head.layer}, head {head.head}: this head {head.note}. Rows are queries and each row adds up to 1. The empty upper triangle is the causal mask.</>}>
      {picker}
      <div className="grid grid-cols-[64px_1fr] gap-1.5">
        <div />
        <div className="grid" style={{ gridTemplateColumns: `repeat(${T}, 1fr)` }}>
          {labels.map((s, j) => <span key={j} className="truncate px-0.5 text-center font-mono text-[9.5px] text-ink-4">{s}</span>)}
        </div>
        <div className="grid" style={{ gridTemplateRows: `repeat(${T}, 1fr)` }}>
          {labels.map((s, i) => <span key={i} className="flex items-center truncate font-mono text-[10.5px] text-ink-3">{s}</span>)}
        </div>
        <div className="grid aspect-square gap-[2px]" style={{ gridTemplateColumns: `repeat(${T}, ${cell}fr)` }}>
          {Array.from({ length: T * T }, (_, k) => {
            const i = Math.floor(k / T), j = k % T, future = j > i;
            const w = head.w[i][j];
            return (
              <span key={k} title={future ? "masked" : mode === "mask" ? "allowed" : w.toFixed(3)} className="relative flex items-center justify-center rounded-[3px]"
                style={future
                  ? { background: "repeating-linear-gradient(135deg, var(--paper-3) 0 4px, var(--paper) 4px 8px)" }
                  : { background: mode === "mask" ? "color-mix(in oklab, var(--role-attn) 26%, var(--paper))" : `color-mix(in oklab, var(--role-attn) ${Math.round(6 + 90 * w)}%, var(--paper))` }}>
                {mode === "weights" && !future && w >= 0.1 && <span className="num font-mono text-[9.5px] text-ink">{w.toFixed(1).replace(/^0/, "")}</span>}
                {mode === "mask" && future && <span className="font-mono text-[9px] text-ink-4">−∞</span>}
              </span>
            );
          })}
        </div>
      </div>
    </Frame>
  );
}

function Gqa({ d, focus }: { d: AtlasDims; focus: "q" | "k" | "v" }) {
  const W = 330, gw = (W - 8) / d.Hkv;
  return (
    <Frame kind="config" caption={<>{d.H} query heads (top) share {d.Hkv} key/value heads (bottom): every K and V head serves {d.G} query heads. This is grouped-query attention, and it makes the KV cache {d.G}× smaller than giving every query head its own.</>}>
      <svg viewBox={`0 0 ${W} 96`} className="block h-auto w-full" role="img" aria-label={`${d.H} query heads grouped ${d.G} per key/value head`}>
        {Array.from({ length: d.Hkv }, (_, g) => {
          const gx = 4 + g * gw, qw = (gw - 6) / d.G;
          return (
            <g key={g}>
              {Array.from({ length: d.G }, (_, q) => (
                <rect key={q} x={gx + 3 + q * qw} y={6} width={qw - 2} height={18} rx={2}
                  fill={focus === "q" ? "var(--role-attn)" : "color-mix(in oklab, var(--role-attn) 35%, var(--paper))"} />
              ))}
              {Array.from({ length: d.G }, (_, q) => (
                <line key={q} x1={gx + 3 + q * qw + (qw - 2) / 2} y1={26} x2={gx + gw / 2} y2={52} stroke="var(--rule-strong)" />
              ))}
              <rect x={gx + gw / 2 - 13} y={54} width={12} height={18} rx={2} fill={focus === "k" ? "var(--role-attn)" : "color-mix(in oklab, var(--role-attn) 35%, var(--paper))"} />
              <rect x={gx + gw / 2 + 1} y={54} width={12} height={18} rx={2} fill={focus === "v" ? "var(--role-attn)" : "color-mix(in oklab, var(--role-attn) 35%, var(--paper))"} />
              <text x={gx + gw / 2} y={86} textAnchor="middle" fontSize={8.5} fill="var(--ink-4)" fontFamily={MONO}>K V</text>
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}

function QkNorm() {
  const arrows = [{ a: -20, l: 120, c: "var(--role-attn)" }, { a: 25, l: 52, c: "var(--role-resid)" }];
  const ox = 30, oy = 64, R = 80;
  return (
    <Frame kind="illustration" caption={<>Before: a long query and a short key. Their dot product depends as much on length as on direction. After QK-norm both have the same length, so the match mostly measures direction.</>}>
      <svg viewBox="0 0 330 110" className="block h-auto w-full" role="img" aria-label="Two arrows of different length become equal length">
        {[0, 1].map((side) => (
          <g key={side} transform={`translate(${side * 170} 0)`}>
            <text x={ox} y={12} fontSize={10} fill="var(--ink-4)" fontFamily={MONO}>{side ? "after" : "before"}</text>
            {arrows.map((a, i) => {
              const len = side ? R : a.l, rad = (a.a * Math.PI) / 180;
              return <line key={i} x1={ox} y1={oy} x2={ox + len * Math.cos(rad)} y2={oy + len * Math.sin(rad) * -1} stroke={a.c} strokeWidth={3} strokeLinecap="round" />;
            })}
            <circle cx={ox} cy={oy} r={3} fill="var(--ink)" />
          </g>
        ))}
      </svg>
    </Frame>
  );
}

function Rope({ d, ex }: { d: AtlasDims; ex?: AtlasExample }) {
  const labels = ex ? ex.tokens.map((t) => (t.prefix ? "<eot>" : t.label)) : ["0", "1", "2", "3", "4", "5"];
  const slow = 16; // pair index for the second clock
  const wFast = 1, wSlow = Math.pow(d.theta, (-2 * slow) / d.dh);
  const maxWave = 2 * Math.PI * Math.pow(d.theta, (d.dh - 2) / d.dh);
  const clock = (cx: number, w: number, title: string) => (
    <g>
      <circle cx={cx} cy={70} r={52} fill="none" stroke="var(--rule-strong)" />
      {labels.map((s, t) => {
        const a = t * w, x = cx + 46 * Math.cos(a), y = 70 - 46 * Math.sin(a);
        const c = `color-mix(in oklab, var(--role-attn) ${40 + (60 * t) / (labels.length - 1)}%, var(--paper))`;
        return (
          <g key={t}>
            <line x1={cx} y1={70} x2={x} y2={y} stroke={c} strokeWidth={2.2} strokeLinecap="round" />
            {w > 0.5 && <text x={cx + 62 * Math.cos(a)} y={70 - 62 * Math.sin(a)} textAnchor="middle" dominantBaseline="central" fontSize={8.5} fill="var(--ink-3)" fontFamily={MONO}>{s.length > 7 ? s.slice(0, 6) + "…" : s}</text>}
          </g>
        );
      })}
      <circle cx={cx} cy={70} r={3} fill="var(--ink)" />
      <text x={cx} y={146} textAnchor="middle" fontSize={10} fill="var(--ink-3)">{title}</text>
    </g>
  );
  return (
    <Frame kind="formula" caption={<>The same 2-D pair of a key, rotated at each position. The fastest pair turns 1 radian (57°) per token. Pair {slow} turns only {(wSlow * 180 / Math.PI).toFixed(1)}° per token, and the slowest pair takes {fmt(Math.round(maxWave))} tokens for one full turn. Fast pairs encode nearby order, slow pairs encode long distances.</>}>
      <svg viewBox="0 0 330 156" className="block h-auto w-full" role="img" aria-label="Two rotation clocks for a fast and a slow RoPE frequency pair">
        {clock(86, wFast, "pair 0 (fast)")}
        {clock(246, wSlow, `pair ${slow} (slow)`)}
      </svg>
    </Frame>
  );
}

function Concat({ d }: { d: AtlasDims }) {
  return (
    <Frame kind="config" caption={<>{d.H} head outputs of {d.dh} numbers are placed side by side ({d.H} × {d.dh} = {fmt(d.H * d.dh)}), then one learned matrix W<sub>o</sub> mixes them into a {fmt(d.d)}-number update.</>}>
      <div className="flex h-6 gap-[1.5px]">
        {Array.from({ length: d.H }, (_, i) => <span key={i} className="flex-1 rounded-[2px]" style={{ background: `color-mix(in oklab, var(--role-attn) ${30 + (i % 4) * 15}%, var(--paper))` }} />)}
      </div>
      <div className="my-1.5 text-center font-mono text-[11px] text-ink-4">↓ W<sub>o</sub> ({fmt(d.H * d.dh)} → {fmt(d.d)})</div>
      <div className="h-6 rounded-[3px] bg-[var(--role-resid)] opacity-80" />
    </Frame>
  );
}

// ---------- read-out ----------

function Top({ ex, d, mode }: { ex: AtlasExample; d: AtlasDims; mode: "logit" | "p" }) {
  const vals = ex.top.map((t) => (mode === "logit" ? t.logit : t.p));
  const lo = mode === "logit" ? Math.min(...vals) - 1 : 0, hi = Math.max(...vals);
  const gap = ex.top[0].logit - ex.top[1].logit;
  const top8 = ex.top.reduce((s, t) => s + t.p, 0);
  return (
    <Frame kind="recorded" caption={mode === "logit"
      ? <>The 8 highest of {fmt(d.V)} scores after &ldquo;{ex.text}&rdquo;. Only differences matter: a gap of {gap.toFixed(2)} means the first is e<sup>{gap.toFixed(2)}</sup> = {Math.exp(gap).toFixed(2)}× as likely as the second.</>
      : <>After softmax these 8 tokens hold {(top8 * 100).toFixed(0)}% of the probability. The other {fmt(d.V - 8)} entries share the rest. Sampling draws from this distribution and greedy decoding takes the top one.</>}>
      <div className="grid gap-1">
        {ex.top.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-[56px] shrink-0 truncate font-mono text-[12px] text-ink">{t.label}</span>
            <div className="h-4 flex-1 rounded-sm bg-paper-3">
              <div className="h-4 rounded-sm" style={{ width: `${((vals[i] - lo) / (hi - lo)) * 100}%`, background: i === 0 ? "var(--role-resid)" : "color-mix(in oklab, var(--role-resid) 50%, var(--paper))" }} />
            </div>
            <span className="num w-12 shrink-0 text-right font-mono text-[11px] text-ink-3">{mode === "logit" ? t.logit.toFixed(2) : `${(t.p * 100).toFixed(1)}%`}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

// ---------- MLP ----------

function Widths({ d, focus }: { d: AtlasDims; focus: string }) {
  const rows = [
    { k: "in", label: "input", n: d.d, c: "var(--role-norm)" },
    { k: "gate", label: "gate_proj", n: d.F, c: "var(--role-mlp)" },
    { k: "up", label: "up_proj", n: d.F, c: "var(--role-mlp)" },
    { k: "down", label: "down_proj", n: d.d, c: "var(--role-resid)" },
  ];
  return (
    <Frame kind="config" caption={<>Each token&apos;s vector is widened {(d.F / d.d).toFixed(0)}× to {fmt(d.F)} features, gated, then squeezed back to {fmt(d.d)} so it can be added to the stream.</>}>
      <div className="grid gap-1.5">
        {rows.map((r) => (
          <div key={r.k} className="flex items-center gap-2">
            <span className={cn("w-[70px] shrink-0 font-mono text-[11px]", r.k === focus ? "text-ink" : "text-ink-4")}>{r.label}</span>
            <div className="flex-1"><div className="h-4 rounded-sm transition-opacity" style={{ width: `${(r.n / d.F) * 100}%`, background: r.c, opacity: r.k === focus ? 1 : 0.35 }} /></div>
            <span className="num w-12 shrink-0 text-right font-mono text-[11px] text-ink-3">{fmt(r.n)}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function Silu() {
  const W = 330, H = 140, X = (x: number) => 20 + ((x + 5) / 10) * (W - 30), Y = (y: number) => 112 - y * 20;
  const pts = (f: (x: number) => number) => Array.from({ length: 101 }, (_, i) => { const x = -5 + i / 10; return `${i ? "L" : "M"} ${X(x).toFixed(1)} ${Y(f(x)).toFixed(1)}`; }).join(" ");
  return (
    <Frame kind="formula" caption={<>SiLU(x) = x · sigmoid(x) (solid) next to ReLU (dashed). It is smooth, lets small negative values through, and is nearly the identity for large positive inputs.</>}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Plot of SiLU against ReLU from -5 to 5">
        <line x1={X(-5)} x2={X(5)} y1={Y(0)} y2={Y(0)} stroke="var(--rule-strong)" />
        <line x1={X(0)} x2={X(0)} y1={8} y2={H - 8} stroke="var(--rule-strong)" />
        <path d={pts((x) => Math.max(0, x))} fill="none" stroke="var(--ink-4)" strokeDasharray="4 4" strokeWidth={1.5} />
        <path d={pts((x) => x / (1 + Math.exp(-x)))} fill="none" stroke="var(--role-mlp)" strokeWidth={2.4} />
        {[-4, -2, 2, 4].map((x) => <text key={x} x={X(x)} y={Y(0) + 13} textAnchor="middle" fontSize={9} fill="var(--ink-4)" fontFamily={MONO}>{x}</text>)}
      </svg>
    </Frame>
  );
}

function GateProduct() {
  const g = [2.1, -1.8, 0.3, 3.0, -0.4, 1.2, -3.1, 0.8];
  const u = [0.9, 1.5, -1.2, 0.6, 2.0, -0.8, 1.1, 1.4];
  const s = g.map((x) => x / (1 + Math.exp(-x)));
  const rows = [
    { label: "SiLU(gate)", v: s, c: "var(--role-mlp)" },
    { label: "up", v: u, c: "var(--role-mlp-ink)" },
    { label: "product", v: s.map((x, i) => x * u[i]), c: "var(--role-resid)" },
  ];
  const m = Math.max(...rows.flatMap((r) => r.v.map(Math.abs)));
  return (
    <Frame kind="illustration" caption={<>Eight of the {fmt(12288)} features. Where the gate is near zero (features 2, 5 and 7) the product is near zero whatever &ldquo;up&rdquo; says. The gate decides what gets through.</>}>
      <div className="grid gap-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            <span className="w-[70px] shrink-0 font-mono text-[11px] text-ink-3">{r.label}</span>
            <div className="grid h-9 flex-1 grid-cols-8 gap-1">
              {r.v.map((v, i) => (
                <div key={i} className="relative">
                  <span className="absolute inset-x-0 top-1/2 h-px bg-rule-strong" />
                  <span className="absolute inset-x-0.5 rounded-[2px]" style={{ background: r.c, top: v >= 0 ? `${50 - (v / m) * 50}%` : "50%", height: `${(Math.abs(v) / m) * 50}%` }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}
