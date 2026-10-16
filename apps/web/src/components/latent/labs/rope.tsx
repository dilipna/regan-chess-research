"use client";

import { useState } from "react";
import type { Architecture, TokenTrace } from "@/lib/latent/types";
import { Check, Deeper, Prov, Slider, TensorCard, showTok } from "../kit";
import { LabFrame, Panel } from "./frame";

const rot = (v: [number, number], a: number): [number, number] => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];

function Dial({ angle, label, size = 120, color = "var(--role-attn)" }: { angle: number; label: string; size?: number; color?: string }) {
  const c = size / 2, r = c - 10;
  return (
    <figure className="grid justify-items-center">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`${label}: rotated ${((angle * 180) / Math.PI).toFixed(1)} degrees`}>
        <circle cx={c} cy={c} r={r} fill="var(--paper-2)" stroke="var(--rule-strong)" />
        <line x1={c} y1={c} x2={c + r} y2={c} stroke="var(--ink-4)" strokeDasharray="3 3" />
        <line className="ll-anim" x1={c} y1={c} x2={c + r * Math.cos(-angle)} y2={c + r * Math.sin(-angle)} stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      </svg>
      <figcaption className="text-center text-[12.5px] text-ink-2">{label}</figcaption>
    </figure>
  );
}

export function RopeLab({ arch, trace }: { arch: Architecture; trace: TokenTrace }) {
  const [t, setT] = useState(3);
  const [s, setS] = useState(1);
  const theta = 0.5;
  const q: [number, number] = [1, 0.35], k: [number, number] = [0.8, 0.6];
  const qr = rot(q, t * theta), kr = rot(k, s * theta);
  const score = qr[0] * kr[0] + qr[1] * kr[1];
  const [shift, setShift] = useState(0);
  const shifted = (() => { const a = rot(q, (t + shift) * theta), b = rot(k, (s + shift) * theta); return a[0] * b[0] + a[1] * b[1]; })();
  const v = arch.verified, dh = v.head_dim, base = v.rope_theta;
  const pairs = [0, 8, 16, 32, 48, dh / 2 - 1];
  const freq = (i: number) => base ** (-(2 * i) / dh);
  const [pos, setPos] = useState(5);
  const S = 240, c = S / 2, R = 92;
  const P = (u: [number, number]) => [c + u[0] * R, c - u[1] * R] as const;
  return (
    <LabFrame slug="rope" intro={<>RoPE does not add a position number to the token. It <strong>rotates</strong> the query and key vectors by an angle that grows with position, so the attention score between two tokens depends on how far apart they are.</>}>
      <Panel title="One rotating pair" badge={<Prov kind="toy" detail="2 numbers, 0.5 rad per position" />}>
        <div className="grid gap-6 md:grid-cols-[260px_1fr]">
          <svg viewBox={`0 0 ${S} ${S}`} className="w-full max-w-[260px]" role="img" aria-label={`query at position ${t} and key at position ${s}; score ${score.toFixed(3)}`}>
            <circle cx={c} cy={c} r={R} fill="none" stroke="var(--rule-strong)" />
            {[q, k].map((u, i) => { const [x, y] = P(u); return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--ink-4)" strokeDasharray="3 3" />; })}
            {([[qr, "var(--role-attn)", `q, pos ${t}`], [kr, "var(--role-mlp)", `k, pos ${s}`]] as const).map(([u, col, lab]) => { const [x, y] = P(u); return (
              <g key={lab}><line className="ll-anim" x1={c} y1={c} x2={x} y2={y} stroke={col} strokeWidth="3.5" strokeLinecap="round" /><circle cx={x} cy={y} r="5" fill={col} /><text x={x + 7} y={y - 6} fontSize="13" fill="var(--ink)">{lab}</text></g>
            ); })}
          </svg>
          <div className="grid content-start gap-4">
            <Slider label="query position t" value={t} min={0} max={12} step={1} onChange={setT} />
            <Slider label="key position s" value={s} min={0} max={12} step={1} onChange={setS} />
            <p className="text-[15.5px]">Score q·k after rotation: <strong className="num">{score.toFixed(4)}</strong> (offset t − s = {t - s}).</p>
            <Slider label="move both positions forward by" value={shift} min={0} max={10} step={1} onChange={setShift} />
            <p className="text-[15.5px]" aria-live="polite">Score after moving both by {shift}: <strong className="num">{shifted.toFixed(4)}</strong>{Math.abs(shifted - score) < 1e-9 ? ": the same, because only the offset t − s matters." : ""}</p>
          </div>
        </div>
      </Panel>
      <Panel title={`The full model rotates ${v.rope_frequencies} pairs at different speeds`} badge={<Prov kind="recorded" detail="exact angles from the recorded configuration" />}>
        <p className="mb-3 text-[15px] text-ink-2">Each {dh}-number Q or K head vector is split into {v.rope_frequencies} pairs (dimension i with i + {dh / 2}). Pair i turns by θ<sub>i</sub> = {base.toLocaleString("en-US")}<sup>−2i/{dh}</sup> radians per position. Slow pairs barely move over a sentence; fast pairs spin quickly.</p>
        <Slider label="position in the real example" value={pos} min={0} max={trace.tokens.length - 1} step={1} onChange={setPos}
          format={(p) => `${p}: ${trace.tokens[p].prefix ? "⟨start⟩" : showTok(trace.tokens[p].text)}`} />
        <div className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-6">
          {pairs.map((i) => <Dial key={i} angle={pos * freq(i)} label={`pair ${i}: ${(pos * freq(i)).toFixed(i < 8 ? 2 : 5)} rad`} />)}
        </div>
        <p className="mt-3 text-[13px] text-ink-3">Angles are computed exactly from the verified θ = {base.toLocaleString("en-US")} and head dimension {dh}; wavelengths range from {v.rope_wavelength_min_tokens.toFixed(2)} to about {Math.round(v.rope_wavelength_max_tokens).toLocaleString("en-US")} tokens. Rotation happens inside attention after Q/K RMSNorm, for Q and K only.</p>
      </Panel>
      <TensorCard title="Where RoPE acts in Qwen3" kind="recorded" captured="order verified in the installed transformers Qwen3Attention source" shape="Q: [B, 32, T, 128], K: [B, 8, T, 128]" shown="the operation order, not tensor values">
        <ol className="grid gap-1 font-mono text-[14px]"><li>q = q_norm(q_proj(x)), k = k_norm(k_proj(x))</li><li>q, k = rotate(q, k, positions 0 … T−1)</li><li>scores = q kᵀ / √{dh}</li><li>v = v_proj(x): never rotated</li></ol>
      </TensorCard>
      <Check id="lab-rope-add" prompt="Does RoPE work by adding the position number to the token's embedding?" options={[
        { label: "Yes, position is added to the vector", feedback: "Nothing is added. Q and K are rotated, and the embedding and V are left alone." },
        { label: "No, it rotates Q and K", correct: true, feedback: "Because both are rotated, their dot product depends on the difference of positions." },
      ]} />
      <Deeper label="Why rotations give relative position">(R(t)q)·(R(s)k) = qᵀR(t)ᵀR(s)k = qᵀR(s − t)k, because rotations are orthogonal and angles add. This holds for each pair, so it holds for the whole head vector.</Deeper>
    </LabFrame>
  );
}
