"use client";

// One hands-on widget per Foundations module. Everything is computed live in the browser from the formula shown.
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const MONO = "var(--font-figures), ui-monospace, monospace";
const f2 = (x: number) => (Math.abs(x) < 0.005 ? "0.00" : x.toFixed(2));

export function FoundationWidget({ slug }: { slug: string }) {
  switch (slug) {
    case "vectors": return <DotProduct />;
    case "matrices": return <MatrixMap />;
    case "softmax": return <SoftmaxPlay />;
    case "loss": return <LossPlay />;
    case "gradients": return <DescentPlay />;
    case "backprop": return <ChainGraph />;
    case "neural-nets": return <LiveFit />;
    case "next-token": return <BigramPlay />;
    case "why-attention": return <ContextPlay />;
    default: return null;
  }
}

// ---------- shared bits ----------

function Readout({ items }: { items: [string, React.ReactNode, string?][] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-rule bg-rule sm:grid-cols-4">
      {items.map(([k, v, c]) => (
        <div key={k} className="bg-[#070b09] px-3 py-2">
          <dt className="text-[10.5px] text-ink-4">{k}</dt>
          <dd className="num mt-0.5 font-mono text-[15px]" style={{ color: c ?? "var(--ink)" }}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Slider({ label, value, min, max, step, onChange, color, fmt }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; color?: string; fmt?: (v: number) => string;
}) {
  return (
    <label className="grid grid-cols-[minmax(64px,auto)_1fr_52px] items-center gap-3 text-[12.5px] text-ink-2">
      <span className="font-mono" style={{ color }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} style={{ accentColor: color }} aria-label={label} />
      <span className="num text-right font-mono text-ink">{fmt ? fmt(value) : f2(value)}</span>
    </label>
  );
}

function Btn({ children, onClick, on, disabled }: { children: React.ReactNode; onClick: () => void; on?: boolean; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={on}
      className={cn("rounded-full border px-3.5 py-1.5 text-[13px] transition-colors disabled:opacity-40",
        on ? "border-[var(--role-resid)] bg-[var(--role-resid-soft)] text-ink" : "border-rule-strong text-ink-2 hover:border-ink-4 hover:text-ink")}>
      {children}
    </button>
  );
}

/** Pointer position in SVG user units. */
function svgPoint(svg: SVGSVGElement, e: React.PointerEvent) {
  const p = svg.createSVGPoint();
  p.x = e.clientX; p.y = e.clientY;
  const m = svg.getScreenCTM();
  return m ? p.matrixTransform(m.inverse()) : { x: 0, y: 0 };
}

function Grid({ S, N, toX, toY }: { S: number; N: number; toX: (v: number) => number; toY: (v: number) => number }) {
  return (
    <g aria-hidden>
      {Array.from({ length: 2 * N + 1 }, (_, i) => i - N).map((k) => (
        <g key={k}>
          <line x1={toX(k)} x2={toX(k)} y1={toY(-N)} y2={toY(N)} stroke={k === 0 ? "var(--rule-strong)" : "var(--rule)"} />
          <line y1={toY(k)} y2={toY(k)} x1={toX(-N)} x2={toX(N)} stroke={k === 0 ? "var(--rule-strong)" : "var(--rule)"} />
        </g>
      ))}
      <rect x={0} y={0} width={S} height={S} fill="none" />
    </g>
  );
}

function Arrow({ x1, y1, x2, y2, color, width = 3 }: { x1: number; y1: number; x2: number; y2: number; color: string; width?: number }) {
  const a = Math.atan2(y2 - y1, x2 - x1), h = 10;
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 1) return null;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2 - Math.cos(a) * h * 0.7} y2={y2 - Math.sin(a) * h * 0.7} stroke={color} strokeWidth={width} strokeLinecap="round" />
      <path d={`M ${x2} ${y2} L ${x2 - h * Math.cos(a - 0.4)} ${y2 - h * Math.sin(a - 0.4)} L ${x2 - h * Math.cos(a + 0.4)} ${y2 - h * Math.sin(a + 0.4)} z`} fill={color} />
    </g>
  );
}

// ---------- 1 · vectors ----------

function DotProduct() {
  const S = 320, N = 4, u = S / (2 * N);
  const toX = (v: number) => S / 2 + v * u, toY = (v: number) => S / 2 - v * u;
  const [a, setA] = useState({ x: 3, y: 1 });
  const [b, setB] = useState({ x: 1, y: 2.5 });
  const [drag, setDrag] = useState<"a" | "b" | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const move = (e: React.PointerEvent) => {
    if (!drag || !svg.current) return;
    const p = svgPoint(svg.current, e);
    const v = { x: Math.max(-N, Math.min(N, Math.round(((p.x - S / 2) / u) * 4) / 4)), y: Math.max(-N, Math.min(N, Math.round(((S / 2 - p.y) / u) * 4) / 4)) };
    (drag === "a" ? setA : setB)(v);
  };
  const dot = a.x * b.x + a.y * b.y, la = Math.hypot(a.x, a.y), lb = Math.hypot(b.x, b.y);
  const cos = la && lb ? dot / (la * lb) : 0;
  const ang = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
  const verdict = cos > 0.7 ? "pointing the same way" : cos > 0.15 ? "somewhat aligned" : cos > -0.15 ? "about perpendicular" : cos > -0.7 ? "somewhat opposed" : "pointing opposite ways";
  return (
    <div className="grid items-center gap-5 md:grid-cols-[minmax(0,340px)_1fr]">
      <svg ref={svg} viewBox={`0 0 ${S} ${S}`} className="w-full touch-none select-none" onPointerMove={move} onPointerUp={() => setDrag(null)} onPointerLeave={() => setDrag(null)}
        role="img" aria-label={`Vector a (${a.x}, ${a.y}) and vector b (${b.x}, ${b.y}); dot product ${f2(dot)}`}>
        <Grid S={S} N={N} toX={toX} toY={toY} />
        <Arrow x1={toX(0)} y1={toY(0)} x2={toX(a.x)} y2={toY(a.y)} color="var(--role-resid)" />
        <Arrow x1={toX(0)} y1={toY(0)} x2={toX(b.x)} y2={toY(b.y)} color="var(--role-mlp)" />
        {(["a", "b"] as const).map((k) => {
          const v = k === "a" ? a : b;
          return (
            <g key={k}>
              <circle cx={toX(v.x)} cy={toY(v.y)} r={14} fill="transparent" className="cursor-grab" onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setDrag(k); }} />
              <circle cx={toX(v.x)} cy={toY(v.y)} r={6} fill="#070b09" stroke={k === "a" ? "var(--role-resid)" : "var(--role-mlp)"} strokeWidth={2.5} pointerEvents="none" />
              <text x={toX(v.x) + 10} y={toY(v.y) - 10} fontSize={14} fontWeight={600} fill={k === "a" ? "var(--role-resid-ink)" : "var(--role-mlp-ink)"} pointerEvents="none">{k}</text>
            </g>
          );
        })}
      </svg>
      <div className="grid gap-3">
        <Readout items={[
          ["a", `(${a.x}, ${a.y})`, "var(--role-resid-ink)"],
          ["b", `(${b.x}, ${b.y})`, "var(--role-mlp-ink)"],
          ["a · b", f2(dot)],
          ["angle", `${ang.toFixed(0)}°`],
        ]} />
        <div className="rounded-xl border border-rule bg-[#070b09] px-4 py-3 font-mono text-[13px] leading-relaxed text-ink-2">
          a · b = {a.x}×{b.x} + {a.y}×{b.y} = <span className="text-ink">{f2(dot)}</span><br />
          cos(angle) = a·b / (|a| |b|) = {f2(dot)} / ({f2(la)} × {f2(lb)}) = <span className="text-ink">{f2(cos)}</span>
        </div>
        <p className="text-[14px] text-ink-2">The arrows are <span className="text-ink">{verdict}</span>.</p>
      </div>
    </div>
  );
}

// ---------- 2 · matrices ----------

const PRESETS: [string, number[]][] = [
  ["Identity", [1, 0, 0, 1]], ["Stretch", [1.8, 0, 0, 0.6]], ["Rotate 45°", [0.71, 0.71, -0.71, 0.71]],
  ["Shear", [1, 0, 0.8, 1]], ["Flatten", [1, 0.5, 2, 1]],
];

function MatrixMap() {
  const S = 320, N = 4, u = S / (2 * N);
  const toX = (v: number) => S / 2 + v * u, toY = (v: number) => S / 2 - v * u;
  const [w, setW] = useState([1, 0.4, -0.3, 1.2]);   // row-major: [[w11, w12], [w21, w22]]
  const map = (x: number, y: number) => ({ x: x * w[0] + y * w[2], y: x * w[1] + y * w[3] });   // [x y] W
  const x = { x: 1.5, y: 1 }, xw = map(x.x, x.y);
  const det = w[0] * w[3] - w[1] * w[2];
  const lines: { p: { x: number; y: number }; q: { x: number; y: number } }[] = [];
  for (let k = -N; k <= N; k++) {
    lines.push({ p: map(k, -N), q: map(k, N) }, { p: map(-N, k), q: map(N, k) });
  }
  const set = (i: number) => (v: number) => setW((old) => old.map((o, j) => (j === i ? v : o)));
  return (
    <div className="grid items-start gap-5 md:grid-cols-[minmax(0,340px)_1fr]">
      <svg viewBox={`0 0 ${S} ${S}`} className="w-full" role="img" aria-label="The plane's grid transformed by the matrix W">
        <defs><clipPath id="mm-clip"><rect width={S} height={S} /></clipPath></defs>
        <Grid S={S} N={N} toX={toX} toY={toY} />
        <g clipPath="url(#mm-clip)">
          {lines.map((l, i) => <line key={i} x1={toX(l.p.x)} y1={toY(l.p.y)} x2={toX(l.q.x)} y2={toY(l.q.y)} stroke="var(--role-attn)" strokeOpacity={0.45} />)}
        </g>
        <Arrow x1={toX(0)} y1={toY(0)} x2={toX(x.x)} y2={toY(x.y)} color="var(--ink-3)" width={2.5} />
        <Arrow x1={toX(0)} y1={toY(0)} x2={toX(xw.x)} y2={toY(xw.y)} color="var(--role-mlp)" />
        <text x={toX(x.x) + 6} y={toY(x.y) + 16} fontSize={13} fill="var(--ink-3)">x</text>
        <text x={toX(xw.x) + 6} y={toY(xw.y) - 8} fontSize={13} fill="var(--role-mlp-ink)">xW</text>
      </svg>
      <div className="grid gap-3">
        <div className="flex flex-wrap gap-1.5">{PRESETS.map(([n, v]) => <Btn key={n} onClick={() => setW(v)} on={v.every((t, i) => t === w[i])}>{n}</Btn>)}</div>
        <div className="grid gap-2 rounded-xl border border-rule bg-[#070b09] p-3">
          <Slider label="w₁₁" value={w[0]} min={-2} max={2} step={0.05} onChange={set(0)} color="var(--role-attn)" />
          <Slider label="w₁₂" value={w[1]} min={-2} max={2} step={0.05} onChange={set(1)} color="var(--role-attn)" />
          <Slider label="w₂₁" value={w[2]} min={-2} max={2} step={0.05} onChange={set(2)} color="var(--role-attn)" />
          <Slider label="w₂₂" value={w[3]} min={-2} max={2} step={0.05} onChange={set(3)} color="var(--role-attn)" />
        </div>
        <div className="rounded-xl border border-rule bg-[#070b09] px-4 py-3 font-mono text-[13px] leading-relaxed text-ink-2">
          xW = [{x.x}, {x.y}] W = [{x.x}×{f2(w[0])} + {x.y}×{f2(w[2])}, {x.x}×{f2(w[1])} + {x.y}×{f2(w[3])}] = <span className="text-[var(--role-mlp-ink)]">[{f2(xw.x)}, {f2(xw.y)}]</span>
        </div>
        <p className="text-[13.5px] text-ink-3">
          Area scale (determinant): <span className="font-mono text-ink">{f2(det)}</span>
          {Math.abs(det) < 0.05 ? " · the plane is squashed onto a line: information is lost and cannot be undone." : det < 0 ? " · negative: the plane is flipped." : ""}
        </p>
      </div>
    </div>
  );
}

// ---------- 3 · softmax ----------

const softmax = (z: number[]) => { const m = Math.max(...z); const e = z.map((v) => Math.exp(v - m)); const s = e.reduce((a, b) => a + b, 0); return e.map((v) => v / s); };

function SoftmaxPlay() {
  const words = [" mat", " floor", " sofa", " roof", " moon"];
  const [z, setZ] = useState([3.2, 2.1, 1.6, 0.4, -1.5]);
  const [T, setT] = useState(1);
  const p = softmax(z.map((v) => v / T));
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="grid content-start gap-2 rounded-xl border border-rule bg-[#070b09] p-3">
        <div className="mb-1 text-[12px] text-ink-3">The cat sat on the …  <span className="text-ink-4">(logits)</span></div>
        {words.map((w, i) => <Slider key={w} label={w} value={z[i]} min={-4} max={6} step={0.1} color="var(--role-resid)" onChange={(v) => setZ((o) => o.map((x, j) => (j === i ? v : x)))} />)}
        <div className="mt-2 border-t border-rule pt-3"><Slider label="temperature" value={T} min={0.1} max={3} step={0.05} color="var(--role-mlp)" onChange={setT} /></div>
      </div>
      <div className="grid content-start gap-2">
        {words.map((w, i) => (
          <div key={w} className="flex items-center gap-3">
            <span className="w-14 font-mono text-[13px] text-ink">{w}</span>
            <div className="h-6 flex-1 rounded bg-paper-3"><div className="h-6 rounded bg-[var(--role-resid)] transition-[width] duration-200" style={{ width: `${(p[i] * 100).toFixed(2)}%` }} /></div>
            <span className="num w-14 text-right font-mono text-[13px] text-ink-2">{(p[i] * 100).toFixed(1)}%</span>
          </div>
        ))}
        <p className="mt-2 font-mono text-[12px] leading-relaxed text-ink-3">p(i) = e^(zᵢ/T) / Σⱼ e^(zⱼ/T) · total = {(p.reduce((a, b) => a + b, 0) * 100).toFixed(0)}%</p>
        <div className="flex flex-wrap gap-1.5">
          <Btn onClick={() => setZ((o) => o.map((v) => v + 1))}>Add 1 to every logit</Btn>
          <Btn onClick={() => setT(0.1)}>Near-greedy (T = 0.1)</Btn>
          <Btn onClick={() => setT(3)}>Hot (T = 3)</Btn>
        </div>
        <p className="text-[12.5px] text-ink-4">Adding the same amount to every logit leaves the bars exactly where they were.</p>
      </div>
    </div>
  );
}

// ---------- 4 · loss ----------

function LossPlay() {
  const [p, setP] = useState(0.4);
  const W = 340, H = 200, l = 36, r = 10, t = 10, b = 26, maxL = 7;
  const X = (v: number) => l + v * (W - l - r), Y = (v: number) => t + (1 - Math.min(v, maxL) / maxL) * (H - t - b);
  const curve = Array.from({ length: 200 }, (_, i) => { const q = 0.001 + (i / 199) * 0.999; return `${i ? "L" : "M"} ${X(q).toFixed(1)} ${Y(-Math.log(q)).toFixed(1)}`; }).join(" ");
  const loss = -Math.log(p);
  return (
    <div className="grid items-center gap-5 md:grid-cols-[minmax(0,360px)_1fr]">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Loss curve; at probability ${p.toFixed(3)} the loss is ${loss.toFixed(2)}`}>
        {[0, 2, 4, 6].map((v) => <g key={v}><line x1={l} x2={W - r} y1={Y(v)} y2={Y(v)} stroke="var(--rule)" /><text x={l - 6} y={Y(v)} textAnchor="end" dominantBaseline="central" fontSize={10} fill="var(--ink-4)" fontFamily={MONO}>{v}</text></g>)}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => <text key={v} x={X(v)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--ink-4)" fontFamily={MONO}>{v}</text>)}
        <path d={curve} fill="none" stroke="var(--role-mlp)" strokeWidth={2.4} />
        <line x1={X(p).toFixed(2)} x2={X(p).toFixed(2)} y1={Y(loss).toFixed(2)} y2={H - b} stroke="var(--ink-4)" strokeDasharray="3 3" />
        <circle cx={X(p).toFixed(2)} cy={Y(loss).toFixed(2)} r={6} fill="var(--role-mlp)" stroke="#070b09" strokeWidth={2} />
      </svg>
      <div className="grid gap-3">
        <Slider label="p(correct)" value={p} min={0.001} max={1} step={0.001} color="var(--role-mlp)" onChange={setP} fmt={(v) => v.toFixed(3)} />
        <Readout items={[["loss = −ln p", loss.toFixed(2), "var(--role-mlp-ink)"], ["perplexity = e^loss", Math.exp(loss).toFixed(1)], ["as bits", (loss / Math.LN2).toFixed(2)], ["knows nothing (Qwen)", Math.log(151936).toFixed(1)]]} />
        <div className="flex flex-wrap gap-1.5">{[0.99, 0.5, 0.1, 0.01].map((v) => <Btn key={v} onClick={() => setP(v)} on={p === v}>p = {v}</Btn>)}</div>
      </div>
    </div>
  );
}

// ---------- 5 · gradient descent ----------

const fLoss = (w: number) => 0.05 * w ** 4 - 0.5 * w ** 2 + 0.35 * w + 1.6;
const dLoss = (w: number) => 0.2 * w ** 3 - w + 0.35;

function DescentPlay() {
  const W = 340, H = 220, lo = -3.6, hi = 3.6, yMin = -0.8, yMax = 3.4;
  const X = (w: number) => 14 + ((w - lo) / (hi - lo)) * (W - 28), Y = (v: number) => 12 + (1 - (v - yMin) / (yMax - yMin)) * (H - 40);
  const [lr, setLr] = useState(0.15);
  const [trail, setTrail] = useState<number[]>([3.2]);
  const [running, setRunning] = useState(false);
  const w = trail[trail.length - 1];
  const out = !Number.isFinite(w) || Math.abs(w) > 6;
  const step = () => setTrail((t) => { const c = t[t.length - 1]; return [...t, c - lr * dLoss(c)].slice(-60); });
  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => {
      if (out || trail.length >= 60) setRunning(false);
      else setTrail((t) => { const c = t[t.length - 1]; return [...t, c - lr * dLoss(c)]; });
    }, 160);
    return () => window.clearTimeout(id);
  }, [running, out, trail.length, lr]);
  const curve = Array.from({ length: 160 }, (_, i) => { const x = lo + (i / 159) * (hi - lo); return `${i ? "L" : "M"} ${X(x).toFixed(1)} ${Y(fLoss(x)).toFixed(1)}`; }).join(" ");
  const g = out ? NaN : dLoss(w);
  return (
    <div className="grid items-center gap-5 md:grid-cols-[minmax(0,360px)_1fr]">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full cursor-crosshair" role="img" aria-label="Loss curve with a ball doing gradient descent; click the curve to choose a start"
        onClick={(e) => { const p = svgPoint(e.currentTarget, e as unknown as React.PointerEvent); setTrail([Math.max(lo, Math.min(hi, lo + ((p.x - 14) / (W - 28)) * (hi - lo)))]); setRunning(false); }}>
        <path d={curve} fill="none" stroke="var(--role-resid)" strokeWidth={2.4} />
        {trail.slice(0, -1).map((t, i) => Math.abs(t) < 4 && <circle key={i} cx={X(t)} cy={Y(fLoss(t))} r={3} fill="var(--role-mlp)" opacity={0.25 + (0.5 * i) / trail.length} />)}
        {!out && <>
          <line x1={X(w - 0.6)} y1={Y(fLoss(w) - 0.6 * g)} x2={X(w + 0.6)} y2={Y(fLoss(w) + 0.6 * g)} stroke="var(--ink-3)" strokeDasharray="4 3" />
          <circle cx={X(w)} cy={Y(fLoss(w))} r={8} fill="var(--role-mlp)" stroke="#070b09" strokeWidth={2} />
        </>}
        <text x={14} y={H - 8} fontSize={10} fill="var(--ink-4)" fontFamily={MONO}>weight w →   (click the curve to drop the ball elsewhere)</text>
      </svg>
      <div className="grid gap-3">
        <Slider label="learning rate" value={lr} min={0.01} max={1.2} step={0.01} color="var(--role-mlp)" onChange={setLr} />
        <div className="flex flex-wrap gap-1.5">
          <Btn onClick={step} disabled={out}>Step</Btn>
          <Btn onClick={() => setRunning((r) => !r)} on={running} disabled={out}>{running ? "Pause" : "Run"}</Btn>
          <Btn onClick={() => { setTrail([3.2]); setRunning(false); }}>Reset</Btn>
        </div>
        <Readout items={[["w", out ? "diverged" : f2(w)], ["loss", out ? "∞" : f2(fLoss(w))], ["slope", out ? "–" : f2(g)], ["steps", String(trail.length - 1)]]} />
        <p className="font-mono text-[12.5px] text-ink-3">w ← w − {lr.toFixed(2)} × slope</p>
        <p className="text-[12.5px] text-ink-4">Try 0.05 (slow), 0.15 (good), 1.0 (overshoots). Starting on the right, small steps settle in the local dip, not the deeper one on the left.</p>
      </div>
    </div>
  );
}

// ---------- 6 · backprop ----------

function ChainGraph() {
  const [w, setW] = useState(1.5), [x, setX] = useState(2), [b, setB] = useState(-1), [y, setY] = useState(1);
  const m = w * x, z = m + b, e = z - y, L = e * e;
  const dE = 2 * e, dZ = dE, dM = dZ, dB = dZ, dW = dM * x, dX = dM * w, dY = -dE;
  type N = { id: string; x: number; y: number; label: string; v: number; g: number; input?: boolean };
  const nodes: N[] = [
    { id: "w", x: 30, y: 40, label: "w", v: w, g: dW, input: true },
    { id: "x", x: 30, y: 130, label: "x", v: x, g: dX, input: true },
    { id: "m", x: 120, y: 85, label: "×", v: m, g: dM },
    { id: "b", x: 120, y: 190, label: "b", v: b, g: dB, input: true },
    { id: "z", x: 200, y: 130, label: "+", v: z, g: dZ },
    { id: "y", x: 200, y: 230, label: "y", v: y, g: dY, input: true },
    { id: "e", x: 275, y: 175, label: "−", v: e, g: dE },
    { id: "L", x: 340, y: 175, label: "²", v: L, g: 1 },
  ];
  const at = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const edges = [["w", "m"], ["x", "m"], ["m", "z"], ["b", "z"], ["z", "e"], ["y", "e"], ["e", "L"]];
  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_280px]">
      <svg viewBox="0 0 380 270" className="mx-auto w-full max-w-[480px]" role="img" aria-label={`Computation graph for L = (w·x + b − y)²; L = ${L.toFixed(2)}; dL/dw = ${dW.toFixed(2)}`}>
        {edges.map(([a, c]) => <line key={a + c} x1={at[a].x} y1={at[a].y} x2={at[c].x} y2={at[c].y} stroke="var(--rule-strong)" strokeWidth={1.5} />)}
        {nodes.map((n) => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={20} fill="#0d1320" stroke={n.input ? "var(--role-resid)" : n.id === "L" ? "var(--role-norm)" : "var(--ink-4)"} strokeWidth={1.6} />
            <text x={n.x} y={n.y + 1} textAnchor="middle" dominantBaseline="central" fontSize={n.input ? 14 : 16} fontWeight={600} fill="var(--ink)">{n.id === "L" ? "L" : n.label}</text>
            <text x={n.x} y={n.y - 28} textAnchor="middle" fontSize={11} fill="var(--ink-2)" fontFamily={MONO}>{f2(n.v)}</text>
            <text x={n.x} y={n.y + 34} textAnchor="middle" fontSize={11} fill="var(--role-mlp-ink)" fontFamily={MONO}>∂ {f2(n.g)}</text>
          </g>
        ))}
      </svg>
      <div className="grid content-start gap-2 rounded-xl border border-rule bg-[#070b09] p-3">
        <div className="text-[12px] text-ink-3">L = (w·x + b − y)²</div>
        <Slider label="w" value={w} min={-3} max={3} step={0.1} color="var(--role-resid)" onChange={setW} />
        <Slider label="x" value={x} min={-3} max={3} step={0.1} color="var(--role-resid)" onChange={setX} />
        <Slider label="b" value={b} min={-3} max={3} step={0.1} color="var(--role-resid)" onChange={setB} />
        <Slider label="y" value={y} min={-3} max={3} step={0.1} color="var(--role-resid)" onChange={setY} />
        <p className="mt-2 font-mono text-[12px] leading-relaxed text-ink-3">
          ∂L/∂e = 2e = {f2(dE)}<br />∂L/∂w = ∂L/∂e · 1 · 1 · x = {f2(dW)}<br />∂L/∂x = ∂L/∂e · w = {f2(dX)}
        </p>
        <p className="text-[12px] text-ink-4">White: forward values. <span className="text-[var(--role-mlp-ink)]">Amber ∂</span>: gradient of L with respect to that node.</p>
      </div>
    </div>
  );
}

// ---------- 7 · a network learning live ----------

function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
const sig = (v: number) => 1 / (1 + Math.exp(-v));

type Net = { w1: number[]; b1: number[]; w2: number[]; b2: number; m: number[]; v: number[]; t: number };
type Act = "silu" | "none";
const FIT_H = 16;
const FIT_DATA = Array.from({ length: 48 }, (_, i) => { const x = -2 + (4 * i) / 47; return { x, y: Math.sin(2.2 * x) * 0.8 + 0.25 * x }; });

/** The same seeded starting network every time, so Reset is reproducible. */
function makeNet(): Net {
  const r = rng(7), H = FIT_H;
  return { w1: Array.from({ length: H }, () => (r() * 2 - 1) * 2), b1: Array.from({ length: H }, () => (r() * 2 - 1) * 2),
    w2: Array.from({ length: H }, () => (r() * 2 - 1) * 0.3), b2: 0, m: Array(3 * H + 1).fill(0), v: Array(3 * H + 1).fill(0), t: 0 };
}
const actFn = (p: number, act: Act) => (act === "silu" ? p * sig(p) : p);
function netOut(n: Net, x: number, act: Act) {
  let y = n.b2;
  for (let j = 0; j < FIT_H; j++) y += n.w2[j] * actFn(n.w1[j] * x + n.b1[j], act);
  return y;
}
function measure(n: Net, act: Act) {
  const loss = FIT_DATA.reduce((s, d) => s + (netOut(n, d.x, act) - d.y) ** 2, 0) / FIT_DATA.length;
  return { step: n.t, loss, curve: Array.from({ length: 81 }, (_, i) => netOut(n, -2.2 + (4.4 * i) / 80, act)) };
}
/** Full-batch Adam on the squared error, with the backward pass written out by hand. */
function trainNet(n: Net, act: Act, steps: number) {
  const H = FIT_H;
  for (let s = 0; s < steps; s++) {
    const g = Array(3 * H + 1).fill(0);
    for (const d of FIT_DATA) {
      const pre = n.w1.map((w, j) => w * d.x + n.b1[j]);
      const h = pre.map((p) => actFn(p, act));
      const y = n.b2 + h.reduce((a, hj, j) => a + n.w2[j] * hj, 0);
      const dy = (2 * (y - d.y)) / FIT_DATA.length;
      for (let j = 0; j < H; j++) {
        const sj = sig(pre[j]);
        const dpre = dy * n.w2[j] * (act === "silu" ? sj * (1 + pre[j] * (1 - sj)) : 1);
        g[j] += dpre * d.x; g[H + j] += dpre; g[2 * H + j] += dy * h[j];
      }
      g[3 * H] += dy;
    }
    n.t++;
    const params = [...n.w1, ...n.b1, ...n.w2, n.b2];
    const lr = 0.03, b1 = 0.9, b2 = 0.999;
    for (let i = 0; i < params.length; i++) {
      n.m[i] = b1 * n.m[i] + (1 - b1) * g[i];
      n.v[i] = b2 * n.v[i] + (1 - b2) * g[i] * g[i];
      params[i] -= (lr * (n.m[i] / (1 - b1 ** n.t))) / (Math.sqrt(n.v[i] / (1 - b2 ** n.t)) + 1e-8);
    }
    n.w1 = params.slice(0, H); n.b1 = params.slice(H, 2 * H); n.w2 = params.slice(2 * H, 3 * H); n.b2 = params[3 * H];
  }
}

function LiveFit() {
  const [act, setAct] = useState<Act>("silu");
  const [running, setRunning] = useState(false);
  const net = useRef<Net | null>(null);
  const [view, setView] = useState(() => measure(makeNet(), "silu"));

  const reset = (a: Act) => { net.current = makeNet(); setView(measure(net.current, a)); };
  useEffect(() => {
    if (!running) return;
    let id = 0;
    const tick = () => {
      const n = (net.current ??= makeNet());
      trainNet(n, act, 8);
      setView(measure(n, act));
      if (n.t < 3000) id = requestAnimationFrame(tick); else setRunning(false);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [running, act]);

  const W = 340, Hh = 220, X = (x: number) => 12 + ((x + 2.2) / 4.4) * (W - 24), Y = (y: number) => Hh / 2 - y * 55;
  const path = view.curve.map((y, i) => `${i ? "L" : "M"} ${X(-2.2 + (4.4 * i) / 80).toFixed(1)} ${Y(Math.max(-2, Math.min(2, y))).toFixed(1)}`).join(" ");
  return (
    <div className="grid items-center gap-5 md:grid-cols-[minmax(0,360px)_1fr]">
      <svg viewBox={`0 0 ${W} ${Hh}`} className="w-full" role="img" aria-label={`A small network fitting a curve; step ${view.step}, loss ${view.loss.toFixed(3)}`}>
        <line x1={12} x2={W - 12} y1={Y(0)} y2={Y(0)} stroke="var(--rule)" />
        {FIT_DATA.map((d, i) => <circle key={i} cx={X(d.x).toFixed(2)} cy={Y(d.y).toFixed(2)} r={3} fill="var(--role-resid)" opacity={0.8} />)}
        <path d={path} fill="none" stroke="var(--role-mlp)" strokeWidth={2.6} />
      </svg>
      <div className="grid gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Btn onClick={() => setRunning((r) => !r)} on={running}>{running ? "Pause" : "Train"}</Btn>
          <Btn onClick={() => { setRunning(false); reset(act); }}>Reset</Btn>
          <Btn onClick={() => { const a: Act = act === "silu" ? "none" : "silu"; setRunning(false); setAct(a); reset(a); }} on={act === "none"}>
            {act === "silu" ? "Remove the activation" : "Restore SiLU"}
          </Btn>
        </div>
        <Readout items={[["activation", act === "silu" ? "SiLU" : "none", act === "silu" ? "var(--role-mlp-ink)" : "var(--bad-ink)"], ["steps", String(view.step)], ["loss (MSE)", view.loss.toFixed(3)], ["hidden neurons", String(FIT_H)]]} />
        <p className="text-[12.5px] text-ink-4">
          {act === "silu" ? "Blue dots: the data. Amber: the network's current guess. 16 neurons, trained with Adam on the squared error." :
            "No activation: 16 neurons collapse into one straight line, however long you train."}
        </p>
      </div>
    </div>
  );
}

// ---------- 8 · next-token (bigram) ----------

const CORPUS = "the cat sat on the mat. the dog sat on the log. a cat saw a dog. the dog ran to the cat. the cat ran up a tree. a bird sat in the tree and sang. the dog and the cat sat on the mat and slept.";

function BigramPlay() {
  const chars = useMemo(() => [...new Set(CORPUS)].sort(), []);
  const counts = useMemo(() => {
    const c: Record<string, Record<string, number>> = {};
    for (let i = 0; i + 1 < CORPUS.length; i++) { (c[CORPUS[i]] ??= {})[CORPUS[i + 1]] = (c[CORPUS[i]][CORPUS[i + 1]] ?? 0) + 1; }
    return c;
  }, []);
  const [cur, setCur] = useState("t");
  const [seed, setSeed] = useState(1);
  const row = Object.entries(counts[cur] ?? {}).sort((a, b) => b[1] - a[1]);
  const tot = row.reduce((s, [, n]) => s + n, 0);
  const sample = useMemo(() => {
    const r = rng(seed);
    let c = "t", out = "t";
    for (let i = 0; i < 90; i++) {
      const opts = Object.entries(counts[c] ?? { " ": 1 });
      const s = opts.reduce((a, [, n]) => a + n, 0);
      let u = r() * s;
      for (const [ch, n] of opts) { u -= n; if (u <= 0) { c = ch; break; } }
      out += c;
    }
    return out;
  }, [seed, counts]);
  const show = (c: string) => (c === " " ? "␣" : c);
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <p className="rounded-xl border border-rule bg-[#070b09] p-3 font-mono text-[12px] leading-relaxed text-ink-3">{CORPUS}</p>
        <div className="mt-3 text-[12px] text-ink-3">After the character…</div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {chars.map((c) => (
            <button key={c} type="button" onClick={() => setCur(c)} aria-pressed={c === cur}
              className={cn("h-8 min-w-8 rounded-md border font-mono text-[13px]", c === cur ? "border-[var(--role-resid)] bg-[var(--role-resid-soft)] text-ink" : "border-rule-strong text-ink-3 hover:text-ink")}>{show(c)}</button>
          ))}
        </div>
      </div>
      <div className="grid content-start gap-1.5">
        <div className="text-[12px] text-ink-3">…the next character is (counted from the text):</div>
        {row.slice(0, 8).map(([c, n]) => (
          <div key={c} className="flex items-center gap-3">
            <span className="w-8 text-center font-mono text-[14px] text-ink">{show(c)}</span>
            <div className="h-5 flex-1 rounded bg-paper-3"><div className="h-5 rounded bg-[var(--role-resid)]" style={{ width: `${(n / tot) * 100}%` }} /></div>
            <span className="num w-20 text-right font-mono text-[12px] text-ink-3">{n}/{tot} = {((n / tot) * 100).toFixed(0)}%</span>
          </div>
        ))}
        <div className="mt-3 flex items-center gap-2"><Btn onClick={() => setSeed((s) => s + 1)}>Generate new text</Btn></div>
        <p className="rounded-xl border border-rule bg-[#070b09] p-3 font-mono text-[13px] leading-relaxed break-words text-[var(--role-mlp-ink)]">{sample}</p>
        <p className="text-[12.5px] text-ink-4">Locally plausible, globally nonsense: it never sees more than one character back.</p>
      </div>
    </div>
  );
}

// ---------- 9 · why attention ----------

function ContextPlay() {
  const words = ["The", "keys", "to", "the", "old", "wooden", "cabinet"];
  const modes = [
    { k: "1", label: "Last word only", see: 1, are: 0.18, w: null as number[] | null },
    { k: "3", label: "Last 3 words", see: 3, are: 0.22, w: null },
    { k: "all", label: "Attention: every earlier word", see: 7, are: 0.86, w: [0.03, 0.62, 0.04, 0.03, 0.05, 0.06, 0.17] },
  ];
  const [mi, setMi] = useState(0);
  const m = modes[mi];
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-1.5">{modes.map((x, i) => <Btn key={x.k} onClick={() => setMi(i)} on={i === mi}>{x.label}</Btn>)}</div>
      <div className="relative rounded-xl border border-rule bg-[#070b09] px-4 pt-10 pb-5">
        <div className="flex flex-wrap items-end gap-x-2 gap-y-6">
          {words.map((w, i) => {
            const visible = i >= words.length - m.see;
            const weight = m.w?.[i];
            return (
              <span key={i} className="relative flex flex-col items-center">
                {weight !== undefined && weight !== null && (
                  <span className="absolute -top-7 font-mono text-[10.5px] text-[var(--role-attn-ink)]">{weight.toFixed(2)}</span>
                )}
                <span className={cn("rounded-md px-1.5 py-0.5 text-[18px] transition-all duration-300", visible ? "text-ink" : "text-ink-4 opacity-40")}
                  style={weight ? { background: `color-mix(in oklab, var(--role-attn) ${Math.round(weight * 85)}%, transparent)` } : undefined}>{w}</span>
              </span>
            );
          })}
          <span className="rounded-md border border-dashed border-[var(--role-resid)] px-2 py-0.5 text-[18px] text-[var(--role-resid-ink)]">___</span>
        </div>
      </div>
      <div className="grid gap-1.5 sm:max-w-md">
        {[["are", m.are], ["is", 1 - m.are]].map(([w, p]) => (
          <div key={w as string} className="flex items-center gap-3">
            <span className="w-10 font-mono text-[14px] text-ink">{w}</span>
            <div className="h-5 flex-1 rounded bg-paper-3"><div className="h-5 rounded transition-[width] duration-300" style={{ width: `${(p as number) * 100}%`, background: w === "are" ? "var(--role-norm)" : "var(--bad)" }} /></div>
            <span className="num w-12 text-right font-mono text-[12px] text-ink-3">{((p as number) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
      <p className="text-[12.5px] text-ink-4">
        {m.k === "all" ? "With attention the blank looks straight back at “keys” (the purple weights) and the plural verb wins." :
          "“cabinet” is singular, so a short window guesses “is”. The word that decides it is out of view."} Illustration: hand-set numbers, not a real model.
      </p>
    </div>
  );
}
