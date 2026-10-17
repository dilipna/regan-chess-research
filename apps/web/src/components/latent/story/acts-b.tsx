"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { attend, preferStep, route, sharesAt, spin, type ToyWord } from "@/lib/latent/story-models";
import { KNOBS } from "@/lib/latent/story-timeline";
import type { GenerationSteps } from "@/lib/latent/types";
import { kidTok } from "./acts-a";
import { Big, Pip } from "./core";

const draw = () => Math.random();      // the wheel's random spin (event handlers only)
const reduced = () => typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.querySelector("[data-latent-theme][data-motion=off]") !== null);

// ---------- Chapter 6 ----------

const SENT: ToyWord[] = [
  { text: "The", key: [0, 0] }, { text: "dog", key: [2, 0] }, { text: "chased", key: [0, 0] }, { text: "the", key: [0, 0] },
  { text: "ball", key: [0, 2] }, { text: "because", key: [0, 0] }, { text: "it", key: [0, 0] },
];
const ENDINGS: { w: string; q: [number, number]; who: "dog" | "ball" | "both" }[] = [
  { w: "hungry", q: [1.6, 0], who: "dog" }, { w: "bouncy", q: [0, 1.6], who: "ball" },
  { w: "sleepy", q: [1.6, 0], who: "dog" }, { w: "round", q: [0, 1.6], who: "ball" }, { w: "fun", q: [0.8, 0.8], who: "both" },
];

export function FlashlightAct({ onDone }: { onDone: () => void }) {
  const [e, setE] = useState(0);
  const [tried, setTried] = useState<Set<number>>(new Set([0]));
  const [answer, setAnswer] = useState<string | null>(null);
  const end = ENDINGS[e];
  const w = attend(SENT, end.q);
  const best = w.indexOf(Math.max(...w));
  useEffect(() => { if (tried.size >= 2 && answer) onDone(); }, [tried, answer, onDone]);
  const W = 760, H = 230, step = W / (SENT.length + 1.4);
  const x = (i: number) => step * (i + 0.7);
  const itX = x(6);
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Choose the last word">
        <span className="text-[18px] text-ink-2">Last word:</span>
        {ENDINGS.map((en, i) => <Big key={en.w} tone={e === i ? "attn" : "soft"} pressed={e === i} onClick={() => { setE(i); setTried((t) => new Set(t).add(i)); setAnswer(null); }} className="text-[18px]">{en.w}</Big>)}
      </div>
      <div className="no-scrollbar overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[620px] w-full" role="img" aria-label={`The word "it" shines most on "${SENT[best].text}": ${Math.round(w[best] * 100)} in 100.`}>
          <defs>
            <radialGradient id="beam" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="var(--role-attn)" stopOpacity=".55" /><stop offset="100%" stopColor="var(--role-attn)" stopOpacity="0" /></radialGradient>
          </defs>
          {SENT.map((s, i) => i < 6 && (
            <path key={i} d={`M ${itX} 150 Q ${(itX + x(i)) / 2} ${150 - 40 - (6 - i) * 14} ${x(i)} 150`} fill="none" stroke="var(--role-attn)" strokeOpacity={0.25 + w[i] * 0.75}
              strokeWidth={1 + w[i] * 22} strokeLinecap="round" className="ll-anim" />
          ))}
          <circle cx={x(best)} cy={176} r={44} fill="url(#beam)" className="ll-anim" />
          {SENT.map((s, i) => (
            <g key={i}>
              <text x={x(i)} y={184} textAnchor="middle" className={cn("text-[22px]", i === 6 ? "fill-[var(--role-attn-ink)] font-bold" : "fill-ink")}>{s.text}</text>
              {i < 6 && <text x={x(i)} y={212} textAnchor="middle" className="num fill-ink-3 text-[13px]">{Math.round(w[i] * 100)}</text>}
            </g>
          ))}
          <text x={x(7) + 6} y={184} textAnchor="middle" className="fill-ink text-[22px]">was</text>
          <text x={x(7) + 6} y={212} textAnchor="middle" className="fill-[var(--role-attn-ink)] text-[22px] font-bold">{end.w}</text>
          <text x={itX} y={118} textAnchor="middle" fontSize={28}>🔦</text>
        </svg>
      </div>
      <p className="text-[16px] text-ink-3">The thick lines show where &quot;it&quot; shines its flashlight. The numbers are its shares out of 100.</p>
      <div className="grid gap-2 rounded-[20px] bg-paper-2/60 p-4">
        <p className="text-[20px] text-ink">The dog chased the ball because it was <strong>{end.w}</strong>. What was {end.w}?</p>
        <div className="flex flex-wrap gap-2">{["dog", "ball"].map((a) => <Big key={a} tone={answer === a ? "ink" : "soft"} onClick={() => setAnswer(a)}>{a === "dog" ? "🐶 the dog" : "⚽ the ball"}</Big>)}</div>
        {answer && <p aria-live="polite" className="text-[19px] text-ink">{end.who === "both" ? "Both could be fun! See how the flashlight shines on both of them." : answer === end.who ? `Yes! And the flashlight agrees: it shines most on "${SENT[best].text}".` : `Hmm, look at the flashlight. It shines most on "${SENT[best].text}".`}</p>}
      </div>
    </div>
  );
}

// ---------- Chapter 7 ----------

type Phase = "look" | "think" | "write" | null;
export function TowerAct({ floors, width, gen, onDone }: { floors: number; width: number; gen?: GenerationSteps; onDone: () => void }) {
  const [floor, setFloor] = useState(0);
  const [phase, setPhase] = useState<Phase>(null);
  const [zoom, setZoom] = useState(false);
  const top = floor >= floors;
  useEffect(() => { if (top) onDone(); }, [top, onDone]);
  const zooming = zoom && floor < floors;
  useEffect(() => {
    if (!zooming) return;
    const t = setTimeout(() => setFloor((f) => f + 1), reduced() ? 0 : 70);
    return () => clearTimeout(t);
  }, [zooming, floor]);
  const climb = () => {
    if (top || phase) return;
    if (reduced()) { setFloor(floor + 1); return; }
    setPhase("look");
    setTimeout(() => setPhase("think"), 450);
    setTimeout(() => setPhase("write"), 900);
    setTimeout(() => { setPhase(null); setFloor((f) => f + 1); }, 1300);
  };
  const FH = 13, H = floors * FH + 70, W = 300;
  const y = (f: number) => H - 30 - f * FH;
  return (
    <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-start">
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-[300px]" role="img" aria-label={`A tower of ${floors} floors. The piece is on floor ${Math.min(floor, floors)}.`}>
        <path d={`M 40 ${y(floors) - 4} L ${W / 2} ${y(floors) - 44} L ${W - 40} ${y(floors) - 4} Z`} fill="var(--role-resid-soft)" stroke="var(--role-resid)" strokeWidth={2} />
        <text x={W / 2} y={y(floors) - 14} textAnchor="middle" className="fill-[var(--role-resid-ink)] text-[13px] font-bold">guesses</text>
        {Array.from({ length: floors }, (_, f) => (
          <g key={f}>
            <rect x={50} y={y(f + 1) + 1} width={W - 100} height={FH - 2} rx={3}
              fill={f < floor ? "var(--role-resid-soft)" : f === floor && phase ? (phase === "look" ? "var(--role-attn)" : phase === "think" ? "var(--role-mlp)" : "var(--role-resid)") : "var(--paper-2)"}
              stroke="var(--rule-strong)" strokeWidth={0.6} className="ll-anim" />
            {(f + 1) % 6 === 0 && <text x={44} y={y(f + 1) + 10} textAnchor="end" className="num fill-ink-4 text-[10px]">{f + 1}</text>}
          </g>
        ))}
        <rect x={30} y={H - 30} width={W - 60} height={8} rx={4} fill="var(--ink-3)" />
        <g className="ll-anim" style={{ transform: `translate(${W - 38}px, ${y(Math.min(floor, floors)) - 6}px)` }}>
          <circle r={11} fill="var(--role-resid)" stroke="#fff" strokeWidth={2.5} /><text y={4} textAnchor="middle" className="fill-white text-[10px] font-bold">✦</text>
        </g>
      </svg>
      <div className="grid content-start gap-4">
        <p className="story-big text-ink" aria-live="polite">{top ? "The top! 🎉" : floor === 0 ? "On the ground floor." : `Floor ${floor} of ${floors}.`}</p>
        <ul className="grid gap-2 text-[18px]">
          <li className={cn("rounded-xl border-2 p-2", phase === "look" ? "border-[var(--role-attn)] bg-[var(--role-attn-soft)]" : "border-transparent")}><span aria-hidden>🟣</span> Look around at the other pieces (attention)</li>
          <li className={cn("rounded-xl border-2 p-2", phase === "think" ? "border-[var(--role-mlp)] bg-[var(--role-mlp-soft)]" : "border-transparent")}><span aria-hidden>🟠</span> Think on its own (MLP)</li>
          <li className={cn("rounded-xl border-2 p-2", phase === "write" ? "border-[var(--role-resid)] bg-[var(--role-resid-soft)]" : "border-transparent")}><span aria-hidden>🔵</span> Write it in the notebook, then climb</li>
        </ul>
        <div className="flex flex-wrap gap-2">
          <Big tone="resid" onClick={climb} disabled={top || !!phase || zooming}>⬆️ Climb one floor</Big>
          <Big tone="soft" onClick={() => setZoom(true)} disabled={top || zooming || !!phase}>🚀 Zoom to the top</Big>
          <Big tone="soft" onClick={() => { setFloor(0); setZoom(false); setPhase(null); }}>Back to the ground</Big>
        </div>
        <p className="text-[16px] text-ink-3">The real Qwen3-8B has {floors} floors, and its notebook for each piece holds {width.toLocaleString("en-US")} numbers.</p>
        {top && gen && (
          <div className="story-pop rounded-[20px] bg-[var(--role-resid-soft)] p-4">
            <div className="flex items-center gap-3"><Pip mood="wow" size={56} /><p className="text-[19px] text-ink">At the top, the notebook turns into guesses for the next piece after &quot;{gen.prompt}&quot;:</p></div>
            <ol className="mt-2 grid gap-1 text-[19px]">
              {gen.step1.top.slice(0, 3).map((t, i) => <li key={t.id}><span className="num text-ink-3">{i + 1}.</span> <strong className="font-mono">{t.text.replace(/\n/g, "↵").trim() || "␣"}</strong> <span className="text-[15px] text-ink-3">({kidTok(t.text)}), {Math.round(t.p * 100)} in 100</span></li>)}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Chapter 8 ----------

export function LibraryAct({ onDone }: { onDone: () => void }) {
  const [m, setM] = useState(0);
  const [seenM, setSeenM] = useState<Set<number>>(new Set([0]));
  const [word, setWord] = useState<string | null>(null);
  const [routed, setRouted] = useState<Set<string>>(new Set());
  const [own, setOwn] = useState("");
  useEffect(() => { if (seenM.size >= 2 && routed.size >= 2) onDone(); }, [seenM, routed, onDone]);
  const model = KNOBS[m];
  const full = Math.floor(model.billions), frac = model.billions - full, cols = 60;
  const n = Math.ceil(model.billions);
  const rows = Math.ceil(n / cols), S = 9;
  const helpers = useMemo(() => (word ? new Set([0, ...route(word, 512, 10)]) : new Set<number>()), [word]);
  const pick = (w: string) => { const v = w.trim().toLowerCase(); if (!v) return; setWord(v); setRouted((r) => new Set(r).add(v)); };
  return (
    <div className="grid gap-8">
      <div className="grid gap-3">
        <h3 className="text-[22px] font-bold text-ink">Count the knobs</h3>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Pick a model">
          {KNOBS.map((k, i) => <Big key={k.name} tone={m === i ? "ink" : "soft"} pressed={m === i} onClick={() => { setM(i); setSeenM((s) => new Set(s).add(i)); }} className="text-[16px]">{k.name} <span className="text-[13px] font-normal opacity-75">{k.year}</span></Big>)}
        </div>
        <p className="text-[19px] text-ink" aria-live="polite">
          <strong>{model.name}</strong> has about <strong className="num">{model.billions >= 100 ? Math.round(model.billions).toLocaleString("en-US") : model.billions.toFixed(1)}</strong> billion knobs.
          {model.activeBillions && <> But for each piece only <strong className="num">{model.activeBillions}</strong> billion are used: the orange dots.</>}
        </p>
        <svg viewBox={`0 0 ${cols * S} ${rows * S}`} className="w-full max-w-[640px] rounded-xl bg-paper-2/50" role="img" aria-label={`${n} dots, one for each billion knobs`}>
          {Array.from({ length: n }, (_, i) => (
            <rect key={`${m}-${i}`} x={(i % cols) * S + 1} y={Math.floor(i / cols) * S + 1} width={i === full && frac > 0 ? (S - 2) * frac : S - 2} height={S - 2} rx={1.5}
              fill={model.activeBillions && i < model.activeBillions ? "var(--role-mlp)" : "var(--role-resid)"} opacity={model.activeBillions && i >= model.activeBillions ? 0.35 : 1}
              className="story-dot" style={{ animationDelay: `${Math.min(i, 1200) * 0.6}ms` }} />
          ))}
        </svg>
        <p className="text-[15px] text-ink-3">One dot is one billion knobs. Sources: model papers and model cards (see the grown-up corner and the timeline).</p>
      </div>
      <div className="grid gap-3">
        <h3 className="text-[22px] font-bold text-ink">A school of 512 helpers</h3>
        <p className="text-[18px] text-ink-2">Qwen3.8 has 512 helpers on each floor. For every piece, a little router picks 10 helpers, plus 1 helper who always answers. Tap a word:</p>
        <div className="flex flex-wrap gap-2">
          {["cat", "pizza", "rocket", "seven", "hello", "why"].map((w) => <Big key={w} tone={word === w ? "mlp" : "soft"} onClick={() => pick(w)} className="text-[17px]">{w}</Big>)}
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); pick(own); }}>
            <label htmlFor="helper-word" className="sr-only">Your own word</label>
            <input id="helper-word" value={own} onChange={(e) => setOwn(e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 16))} placeholder="your word" className="min-h-12 w-36 rounded-2xl border-2 border-rule-strong bg-paper px-3 text-[17px]" />
            <Big tone="soft" disabled={!own}>Go</Big>
          </form>
        </div>
        <svg viewBox="0 0 640 330" className="w-full max-w-[640px]" role="img" aria-label={word ? `For "${word}", 11 of 512 helpers answer.` : "512 helpers, waiting for a word"}>
          {Array.from({ length: 512 }, (_, i) => {
            const on = helpers.has(i);
            return <circle key={i} cx={(i % 32) * 20 + 10} cy={Math.floor(i / 32) * 20 + 10} r={on ? 8.5 : 5} fill={i === 0 ? "var(--role-norm)" : on ? "var(--role-mlp)" : "var(--rule-strong)"} className={on ? "story-pop" : "ll-anim"} />;
          })}
        </svg>
        {word && <p className="text-[19px] text-ink" aria-live="polite">For &quot;{word}&quot;, <strong>11 of 512</strong> helpers answer: 10 picked by the router (orange) and the shared helper (green). The other 501 rest.</p>}
        <p className="text-[15px] text-ink-3">Which helpers light up is pretend. The numbers 512, 10 and 1 are from Qwen3.8&apos;s model card.</p>
      </div>
    </div>
  );
}

// ---------- Chapter 9 ----------

const PAIRS: { q: string; a: { t: string; f: [number, number] }; b: { t: string; f: [number, number] } }[] = [
  { q: "What colour is the sky?", a: { t: "It is blue on a sunny day, and orange or pink at sunset.", f: [1, 1] }, b: { t: "What colour is the grass? What colour is the sea? What colour is", f: [0, 0.5] } },
  { q: "Can you help me tie my shoes?", a: { t: "No. Shoes are boring.", f: [0, 0] }, b: { t: "Sure! Make two bunny ears with the laces, cross them, and pull one through the hole.", f: [1, 1] } },
  { q: "I feel sad today.", a: { t: "I'm sorry you feel sad. Would it help to tell a grown-up you trust how you feel?", f: [1, 1] }, b: { t: "Sad has three letters: s, a, d.", f: [0.3, 0] } },
  { q: "What is 2 + 2?", a: { t: "2 + 2 is 22.", f: [0, 0.5] }, b: { t: "2 + 2 is 4.", f: [1, 0.5] } },
];

export function MannersAct({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const [w, setW] = useState([0, 0]);
  const [picks, setPicks] = useState<("a" | "b")[]>([]);
  const finished = i >= PAIRS.length;
  useEffect(() => { if (finished) onDone(); }, [finished, onDone]);
  const choose = (side: "a" | "b") => {
    const p = PAIRS[i];
    const [c, o] = side === "a" ? [p.a, p.b] : [p.b, p.a];
    setW(preferStep(w, c.f, o.f));
    setPicks([...picks, side]);
    setI(i + 1);
  };
  const meter = (v: number) => Math.max(0, Math.min(100, 50 + v * 18));
  const p = PAIRS[Math.min(i, PAIRS.length - 1)];
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      {!finished ? (
        <div className="grid content-start gap-3">
          <div className="text-[15px] font-semibold text-ink-3">Question {i + 1} of {PAIRS.length}</div>
          <p className="story-big text-ink"><span aria-hidden>🙋 </span>{p.q}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["a", "b"] as const).map((s) => (
              <button key={s} type="button" onClick={() => choose(s)} className="story-btn rounded-[20px] border-2 border-rule-strong bg-paper p-4 text-left text-[19px] leading-snug text-ink hover:border-[var(--role-norm)]">
                <span className="mb-1 block text-[13px] font-bold tracking-wide text-ink-3 uppercase">Answer {s.toUpperCase()}</span><span aria-hidden>🤖 </span>{p[s].t}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid content-start gap-3">
          <div className="flex items-center gap-3"><Pip mood={w[0] > 0 ? "cheer" : "think"} size={70} />
            <p className="text-[20px] text-ink">{w[0] > 0 && w[1] >= 0 ? "You taught your model to like answers that help and are kind. That is what real teachers do!" : "Hmm! Your model learned to like unhelpful answers. Teachers really matter. Want to try again?"}</p></div>
          <div><Big tone="soft" onClick={() => { setI(0); setW([0, 0]); setPicks([]); }}>Teach it again</Big></div>
        </div>
      )}
      <div className="grid content-start gap-3 rounded-[20px] bg-paper-2/60 p-4" aria-live="polite">
        <h3 className="text-[19px] font-bold text-ink">What your model is learning to like</h3>
        {[["🙌 Helping", w[0]], ["💛 Kindness", w[1]]].map(([k, v]) => (
          <div key={k as string}>
            <div className="text-[17px] text-ink">{k}</div>
            <div className="relative h-6 rounded-full bg-paper"><span className="absolute top-0 left-1/2 h-full w-0.5 bg-rule-strong" /><span className="ll-anim block h-full rounded-full bg-[var(--role-norm)]" style={{ width: `${meter(v as number)}%` }} /></div>
          </div>
        ))}
        <p className="text-[15px] text-ink-3">The middle line means &quot;doesn&apos;t care yet&quot;. Each pick nudges the meters. Picks so far: {picks.length}.</p>
      </div>
    </div>
  );
}

// ---------- Chapter 10 ----------

const TEMPS: { key: string; t: number; label: string }[] = [
  { key: "0.25", t: 0.25, label: "❄️ freezing" }, { key: "0.5", t: 0.5, label: "cold" }, { key: "0.7", t: 0.7, label: "cool" },
  { key: "1.0", t: 1, label: "normal" }, { key: "1.5", t: 1.5, label: "warm" }, { key: "2.0", t: 2, label: "🔥 hot" },
];
const SLICE = ["#1f5fae", "#c47a00", "#00a08a", "#a274e2", "#d0517a", "#6a8f1f", "#3d8fd6"];

export function WheelAct({ gen, onDone }: { gen?: GenerationSteps; onDone: () => void }) {
  const [ti, setTi] = useState(3);
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [log, setLog] = useState<{ text: string; temp: string }[]>([]);
  const [result, setResult] = useState<string | null>(null);
  useEffect(() => { if (log.length >= 3 && new Set(log.map((l) => l.temp)).size >= 2) onDone(); }, [log, onDone]);
  if (!gen) return <p className="text-ink-3">The recorded scores could not be loaded.</p>;
  const T = TEMPS[ti];
  const lse = gen.step1.logsumexp_by_temperature[T.key];
  const { slices } = sharesAt(gen.step1.top.slice(0, 7), lse, T.t);
  const rest = Math.max(0, 1 - slices.reduce((a, s) => a + s.p, 0));
  const all = [...slices.map((s, i) => ({ ...s, color: SLICE[i], label: s.text.replace(/\n/g, "↵").trim() || "␣" })), { text: "", p: rest, color: "#cbc2b0", label: "others" }];
  let acc = 0;
  const arcs = all.map((s) => { const a0 = acc * 360; acc += s.p; return { ...s, a0, a1: acc * 360 }; });
  const R = 130, C = 150;
  const pt = (a: number, r = R) => [C + r * Math.sin((a * Math.PI) / 180), C - r * Math.cos((a * Math.PI) / 180)];
  const go = () => {
    if (spinning) return;
    const k = spin(all.map((s) => s.p).slice(0, -1), draw());
    const a = arcs[k], mid = (a.a0 + a.a1) / 2;
    const jitter = (draw() - 0.5) * Math.min(20, (a.a1 - a.a0) * 0.6);
    const target = rot - (rot % 360) + 360 * 5 + (360 - mid) + jitter;
    const label = k < slices.length ? kidTok(a.text) : "a rarer word";
    const fin = () => { setSpinning(false); setResult(label); setLog((l) => [...l.slice(-11), { text: k < slices.length ? a.label : "other", temp: T.label }]); };
    setResult(null);
    if (reduced()) { setRot(target); fin(); return; }
    setSpinning(true); setRot(target);
    setTimeout(fin, 2300);
  };
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
      <div className="relative mx-auto w-full max-w-[320px]">
        <svg viewBox="0 0 300 300" className="w-full" role="img" aria-label={`The word wheel at ${T.label}: the biggest slice is "${kidTok(slices[0].text)}", ${Math.round(slices[0].p * 100)} in 100.`}>
          <g style={{ transform: `rotate(${rot}deg)`, transformOrigin: "150px 150px", transition: spinning ? "transform 2.2s cubic-bezier(.15,.75,.2,1)" : "none" }}>
            {arcs.map((s, i) => {
              if (s.p <= 0) return null;
              if (s.p > 0.999) return <circle key={i} cx={C} cy={C} r={R} fill={s.color} />;
              const [x0, y0] = pt(s.a0), [x1, y1] = pt(s.a1), [lx, ly] = pt((s.a0 + s.a1) / 2, R * 0.66);
              return (
                <g key={i}>
                  <path d={`M ${C} ${C} L ${x0} ${y0} A ${R} ${R} 0 ${s.a1 - s.a0 > 180 ? 1 : 0} 1 ${x1} ${y1} Z`} fill={s.color} stroke="#fffdf8" strokeWidth={2} className="ll-anim" />
                  {s.a1 - s.a0 > 16 && <text x={lx} y={ly + 5} textAnchor="middle" className="fill-white text-[15px] font-bold">{s.label}</text>}
                </g>
              );
            })}
            <circle cx={C} cy={C} r={16} fill="#fffdf8" stroke="var(--ink)" strokeWidth={3} />
          </g>
          <path d={`M ${C - 13} 4 L ${C + 13} 4 L ${C} 30 Z`} fill="var(--ink)" />
        </svg>
      </div>
      <div className="grid content-start gap-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Temperature">
          {TEMPS.map((t, i) => <Big key={t.key} tone={ti === i ? "ink" : "soft"} pressed={ti === i} onClick={() => setTi(i)} disabled={spinning} className="text-[16px]">{t.label} <span className="num text-[12px] font-normal opacity-70">{t.t}</span></Big>)}
        </div>
        <div className="flex flex-wrap items-center gap-3"><Big tone="mlp" onClick={go} disabled={spinning} className="text-[22px]">🎡 Spin!</Big>
          <p aria-live="polite" className="text-[21px] text-ink">{spinning ? "Spinning…" : result ? <>It landed on <strong>{result}</strong>!</> : null}</p></div>
        <ul className="grid gap-1 text-[16px]">
          {all.map((s) => (
            <li key={s.label} className="flex min-w-0 items-center gap-2"><span className="inline-block h-4 w-4 shrink-0 rounded" style={{ background: s.color }} />
              <span className="w-16 shrink-0 truncate font-mono text-ink">{s.label}</span><span className="num shrink-0 text-ink-2">{(s.p * 100).toFixed(s.p < 0.1 ? 1 : 0)} in 100</span>
              <span className="min-w-0 truncate text-[13px] text-ink-3">{s.text ? kidTok(s.text) : "every other word"}</span></li>
          ))}
        </ul>
        {rest > 0.5 && <p className="rounded-xl bg-[var(--role-mlp-soft)] p-3 text-[17px] text-ink">So hot that thousands of rare words now share most of the wheel! That is why very hot answers can get strange.</p>}
        {ti === 0 && <p className="rounded-xl bg-[var(--role-resid-soft)] p-3 text-[17px] text-ink">So cold that the biggest slice takes almost the whole wheel. Spin a few times: it nearly always wins.</p>}
        {log.length > 0 && <p className="text-[16px] text-ink-2">Your spins: {log.map((l, i) => <span key={i} className="mr-1 inline-block rounded-full bg-paper-2 px-2 font-mono">{l.text}</span>)}</p>}
        <p className="text-[15px] text-ink-3">The slices are Qwen3-8B-Base&apos;s real shares after &quot;{gen.prompt}&quot;, recorded at these six temperatures. The spin is a random draw in your browser.</p>
      </div>
    </div>
  );
}
