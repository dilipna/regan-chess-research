"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { CHAPTERS } from "@/lib/latent/story";
import { IDEAS, TIMELINE, TIMELINE_CHECKED, type Idea, type Moment } from "@/lib/latent/story-timeline";
import type { RecallVersions } from "../versions";
import { Big, Pip, useStickers } from "./core";

const byName = (n: string) => TIMELINE.find((m) => m.name === n)!;
const Src = ({ m }: { m: Moment }) => <a href={m.source.url} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[var(--role-resid-ink)] underline underline-offset-2">source: {m.source.label}</a>;

// ---------- Chapter 11 ----------

const PUZZLES = [
  { pic: "🍎🍎🍎", q: "Pip has 3 apples. Pip gets 2 more, and then eats 1. How many apples now?", fast: "5", steps: ["Start with 3 apples.", "Get 2 more: 3 and 2 make 5.", "Eat 1: 5 take away 1 is 4."], answer: "4 apples" },
  { pic: "🐦🐦🐦🐦", q: "4 birds sit on a tree. 2 fly away. Then 3 more come. How many birds are on the tree?", fast: "9", steps: ["Start with 4 birds.", "2 fly away: 4 take away 2 is 2.", "3 more come: 2 and 3 make 5."], answer: "5 birds" },
  { pic: "🪶 ⚖️ 🪨", q: "Which is heavier: a bag of feathers that weighs 1 kilogram, or a bag of rocks that weighs 1 kilogram?", fast: "The rocks!", steps: ["Rocks feel heavy, but wait.", "Both bags weigh 1 kilogram.", "1 kilogram is the same as 1 kilogram."], answer: "They weigh the same" },
];

export function ThinkingAct({ onDone }: { onDone: () => void }) {
  const [pi, setPi] = useState(0);
  const [mode, setMode] = useState<"fast" | "think" | null>(null);
  const [shown, setShown] = useState(0);
  const [thought, setThought] = useState<Set<number>>(new Set());
  const p = PUZZLES[pi];
  useEffect(() => { if (thought.size >= 2) onDone(); }, [thought, onDone]);
  useEffect(() => {
    if (mode !== "think" || shown > p.steps.length) return;
    const t = setTimeout(() => { setShown((s) => s + 1); if (shown === p.steps.length) setThought((s) => new Set(s).add(pi)); }, shown === 0 ? 200 : 900);
    return () => clearTimeout(t);
  }, [mode, shown, p.steps.length, pi]);
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Pick a puzzle">
        {PUZZLES.map((x, i) => <Big key={i} tone={pi === i ? "ink" : "soft"} pressed={pi === i} onClick={() => { setPi(i); setMode(null); setShown(0); }} className="text-[16px]">{thought.has(i) && "✓ "}Puzzle {i + 1}</Big>)}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="grid content-start gap-3">
          <p aria-hidden className="text-[44px] tracking-widest">{p.pic}</p>
          <p className="story-big text-ink">{p.q}</p>
          <div className="flex flex-wrap gap-2">
            <Big tone="mlp" onClick={() => { setMode("fast"); setShown(0); }}>⚡ Fast guess</Big>
            <Big tone="attn" onClick={() => { setMode("think"); setShown(0); }}>🧠 Think step by step</Big>
          </div>
        </div>
        <div className="grid content-start gap-3" aria-live="polite">
          {mode === "fast" && (
            <div className="story-pop flex items-center gap-3 rounded-[20px] bg-[var(--role-mlp-soft)] p-4">
              <Pip mood="wow" size={60} /><p className="text-[21px] text-ink">&quot;{p.fast}&quot; <span className="text-[16px] text-ink-3">Hmm, that was too quick. Was it right?</span></p>
            </div>
          )}
          {mode === "think" && (
            <div className="story-paper rounded-[20px] p-4">
              <div className="flex items-center gap-2"><Pip mood="think" size={48} /><span className="text-[15px] font-bold tracking-wide text-[var(--role-attn-ink)] uppercase">Pip&apos;s thinking notes</span></div>
              <ol className="mt-2 grid gap-1.5 text-[20px] text-ink">
                {p.steps.slice(0, shown).map((s, i) => <li key={i} className="story-pop"><span className="num text-ink-3">{i + 1}.</span> {s}</li>)}
              </ol>
              {shown > p.steps.length && <p className="story-pop mt-3 rounded-xl bg-[var(--role-norm-soft)] p-2 text-[21px] font-bold text-ink">Answer: {p.answer} ✓</p>}
            </div>
          )}
        </div>
      </div>
      <p className="text-[15px] text-ink-3">These puzzle answers are written by hand to show the idea. No model is running here.</p>
      <div>
        <h3 className="text-[20px] font-bold text-ink">Real thinking models</h3>
        <ul className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {["o1", "DeepSeek-R1", "Muse Spark", "Qwen3.8", "GPT-6 Astra"].map((n) => {
            const m = byName(n);
            const note = n === "GPT-6 Astra" ? "Some researchers worry that its thinking is harder for people to read and check." : m.kid;
            return <li key={n} className="rounded-[18px] border-2 border-rule bg-paper p-3"><div className="text-[14px] font-bold text-ink-3">{m.when} · {m.who}</div><div className="text-[19px] font-bold text-ink">{m.name}</div><p className="text-[16px] text-ink-2">{note}</p><Src m={m} /></li>;
          })}
        </ul>
      </div>
    </div>
  );
}

// ---------- Chapter 12 ----------

const AGENT_STEPS = [
  { id: "plan", label: "📝 Make a plan", run: "Plan: check tomorrow's weather. If it will rain, set a reminder." },
  { id: "weather", label: "☁️ Ask the weather tool about tomorrow", run: "Weather tool says: \"Tomorrow: rain is likely.\"" },
  { id: "read", label: "👀 Read what the tool said", run: "Rain is likely, so a reminder is needed." },
  { id: "remind", label: "⏰ Use the reminder tool", run: "Reminder tool says: \"Reminder set: take your umbrella, 8 in the morning.\"" },
  { id: "tell", label: "✅ Tell the person what was done", run: "\"It will probably rain tomorrow, so I set a reminder for you to take your umbrella.\"" },
];
const SHUFFLED = [3, 0, 4, 1, 2];

export function AgentAct({ onDone }: { onDone: () => void }) {
  const [order, setOrder] = useState<number[]>([]);
  const [oops, setOops] = useState<number | null>(null);
  const [ran, setRan] = useState(-1);
  const ready = order.length === AGENT_STEPS.length;
  useEffect(() => { if (ran >= AGENT_STEPS.length) onDone(); }, [ran, onDone]);
  useEffect(() => {
    if (ran < 0 || ran >= AGENT_STEPS.length) return;
    const t = setTimeout(() => setRan((r) => r + 1), 1000);
    return () => clearTimeout(t);
  }, [ran]);
  const tap = (i: number) => {
    if (order.includes(i)) return;
    if (i === order.length) { setOrder([...order, i]); setOops(null); } else setOops(i);
  };
  return (
    <div className="grid gap-8">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="grid content-start gap-3">
          <p className="rounded-[20px] bg-paper-2/60 p-4 text-[20px] text-ink"><span aria-hidden>🙋 </span>Job: &quot;Will it rain tomorrow? If it will, remind me to take my umbrella.&quot;</p>
          <p className="text-[18px] text-ink-2">Tap the steps in the order Pip should do them.</p>
          <div className="grid gap-2" role="group" aria-label="Steps to put in order">
            {SHUFFLED.map((i) => (
              <button key={i} type="button" onClick={() => tap(i)} disabled={order.includes(i)}
                className={cn("story-btn min-h-12 rounded-2xl border-2 px-4 text-left text-[18px]", order.includes(i) ? "border-[var(--role-norm)] bg-[var(--role-norm-soft)] text-ink-3" : oops === i ? "story-shake border-[var(--role-mlp)] bg-paper text-ink" : "border-rule-strong bg-paper text-ink")}>
                {AGENT_STEPS[i].label}{order.includes(i) && <span className="ml-2 font-bold text-[var(--role-norm-ink)]">#{order.indexOf(i) + 1}</span>}
              </button>
            ))}
          </div>
          <p aria-live="polite" className="min-h-[1.5em] text-[18px] text-ink">{oops !== null ? "Not yet! What should Pip do before that?" : ready ? "All in order. Press Go!" : ""}</p>
          <div className="flex gap-2"><Big tone="resid" disabled={!ready || (ran >= 0 && ran < AGENT_STEPS.length)} onClick={() => setRan(0)}>▶️ Go, Pip!</Big><Big tone="soft" onClick={() => { setOrder([]); setRan(-1); setOops(null); }}>Start over</Big></div>
        </div>
        <ol className="grid content-start gap-2" aria-live="polite" aria-label="What Pip did">
          {AGENT_STEPS.map((s, i) => (
            <li key={s.id} className={cn("flex items-start gap-3 rounded-2xl border-2 p-3 text-[17px]", ran > i ? "story-pop border-[var(--role-resid)] bg-[var(--role-resid-soft)] text-ink" : ran === i ? "border-[var(--role-mlp)] bg-paper text-ink" : "border-dashed border-rule bg-paper text-ink-4")}>
              {ran === i ? <Pip mood="think" size={36} /> : <span className="num mt-0.5 w-6 shrink-0 text-center font-bold">{i + 1}</span>}
              <span>{ran > i ? s.run : s.label}</span>
            </li>
          ))}
          {ran >= AGENT_STEPS.length && <li className="story-pop flex items-center gap-2 text-[19px] font-bold text-[var(--role-norm-ink)]"><Pip mood="cheer" size={44} /> Job done!</li>}
          <li className="text-[14px] text-ink-3">The weather and reminder tools are pretend.</li>
        </ol>
      </div>
      <div>
        <h3 className="text-[22px] font-bold text-ink">Same name, different thing!</h3>
        <p className="text-[17px] text-ink-2">Two companies used the name Astra, and two used Muse. Tap a card to flip it.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[["Project Astra", "GPT-6 Astra"], ["Muse (Microsoft)", "Muse Spark"]].map(([a, b]) => (
            <div key={a} className="grid grid-cols-2 gap-3">{[a, b].map((n) => <Flip key={n} m={byName(n)} />)}</div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-[22px] font-bold text-ink">Eyes, ears and hands</h3>
        <ul className="mt-2 grid gap-3 sm:grid-cols-3">
          {[["👀", "Seeing", ["GPT-4", "Gemini"]], ["👂🗣️", "Hearing and talking", ["GPT-4o"]], ["🛠️", "Using tools and computers", ["GPT-6 Astra", "Claude Opus 5.5"]]].map(([e, t, ms]) => (
            <li key={t as string} className="rounded-[18px] border-2 border-rule bg-paper p-3"><div aria-hidden className="text-[34px]">{e}</div><div className="text-[19px] font-bold text-ink">{t}</div>
              <ul className="mt-1 grid gap-2">{(ms as string[]).map((n) => { const m = byName(n); return <li key={n} className="text-[15.5px] text-ink-2"><strong className="text-ink">{m.name}</strong> ({m.when}): {m.kid} <Src m={m} /></li>; })}</ul></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Flip({ m }: { m: Moment }) {
  const [back, setBack] = useState(false);
  return (
    <button type="button" onClick={() => setBack(!back)} aria-pressed={back} className={cn("story-btn flex min-h-[180px] flex-col justify-between rounded-[20px] border-2 p-3 text-left", back ? "border-[var(--role-attn)] bg-[var(--role-attn-soft)]" : "border-rule-strong bg-paper")}>
      {back ? <span className="text-[15.5px] leading-snug text-ink">{m.kid}<span className="mt-1 block text-[12.5px] text-ink-3">{m.source.label}</span></span>
        : <><span className="text-[22px] font-bold text-ink">{m.name}</span><span className="text-[16px] text-ink-2">{m.who}<br />{m.when}</span><span className="text-[13px] text-ink-3">tap to flip ↻</span></>}
    </button>
  );
}

// ---------- Chapter 13 ----------

const SAFETY = [
  { e: "🔍", t: "Check it", b: "Check important facts with a grown-up, a teacher or a good book." },
  { e: "🤫", t: "Keep secrets safe", b: "Never tell a chatbot your password, your address, or other secrets." },
  { e: "🧑‍🏫", t: "Tell a grown-up", b: "If something feels scary or wrong, stop and tell a grown-up you trust." },
  { e: "💬", t: "It is a program", b: "A chatbot is a computer program, not a person, even when it sounds friendly." },
];

export function CarefulAct({ v, onDone }: { v?: RecallVersions; onDone: () => void }) {
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  useEffect(() => { if (flipped.size >= SAFETY.length) onDone(); }, [flipped, onDone]);
  const right = v ? Math.round((v.top1_hits / v.n_scored) * 100) : 0;
  const other = v ? Math.round((v.miss_categories["another version"] / v.n_scored) * 100) : 0;
  const cases = v ? v.misses_detail.filter((d) => d.category === "another version").slice(0, 3) : [];
  return (
    <div className="grid gap-8">
      {v && (
        <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
          <figure>
            <div className="grid w-[260px] grid-cols-10 gap-1" role="img" aria-label={`${right} of 100 squares right, ${other} more match another Lincoln copy, ${100 - right - other} wrong`}>
              {Array.from({ length: 100 }, (_, i) => <span key={i} className={cn("story-dot h-[22px] rounded-[4px]", i < right ? "bg-[var(--role-norm)]" : i < right + other ? "bg-[var(--role-attn)]" : "bg-rule-strong")} style={{ animationDelay: `${i * 12}ms` }} />)}
            </div>
            <figcaption className="mt-2 grid gap-1 text-[16px] text-ink-2">
              <span><span className="inline-block h-3 w-3 rounded-sm bg-[var(--role-norm)]" /> about {right} in 100 next words right</span>
              <span><span className="inline-block h-3 w-3 rounded-sm bg-[var(--role-attn)]" /> about {other} more match another Lincoln copy</span>
              <span><span className="inline-block h-3 w-3 rounded-sm bg-rule-strong" /> the rest were wrong</span>
            </figcaption>
          </figure>
          <div className="grid content-start gap-3">
            <p className="text-[19px] text-ink">Lincoln wrote out his speech five times. When Qwen was &quot;wrong&quot;, sometimes it said exactly what another copy says:</p>
            <ul className="grid gap-3">
              {cases.map((d) => {
                const copy = d.versions_with_prediction[0];
                return (
                  <li key={d.t} className="rounded-[18px] border-2 border-rule bg-paper p-3 text-[17px]">
                    <p className="font-serif text-ink-2">…{d.context_tail.split(" ").slice(-5).join(" ")} <strong className="text-ink">___</strong></p>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-paper-2 p-2"><div className="text-[12px] text-ink-3 uppercase">copy we checked</div><div className="font-mono text-ink">{d.true.trim()}</div></div>
                      <div className="rounded-xl bg-[var(--role-attn-soft)] p-2"><div className="text-[12px] text-ink-3 uppercase">Qwen guessed</div><div className="font-mono text-ink">{d.predicted.trim()}</div></div>
                      <div className="rounded-xl bg-[var(--role-norm-soft)] p-2"><div className="text-[12px] text-ink-3 uppercase">{copy} copy</div><div className="font-mono text-ink">{d.predicted.trim()} ✓</div></div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
      <div>
        <h3 className="text-[22px] font-bold text-ink">Safety cards: tap to flip</h3>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SAFETY.map((s, i) => (
            <li key={s.t}>
              <button type="button" aria-pressed={flipped.has(i)} onClick={() => setFlipped((f) => new Set(f).add(i))}
                className={cn("story-btn flex min-h-[160px] w-full flex-col items-center justify-center gap-2 rounded-[20px] border-2 p-4 text-center", flipped.has(i) ? "border-[var(--role-norm)] bg-[var(--role-norm-soft)]" : "border-rule-strong bg-paper")}>
                <span aria-hidden className="text-[40px]">{s.e}</span>
                <span className="text-[19px] font-bold text-ink">{s.t}</span>
                {flipped.has(i) ? <span className="story-pop text-[16px] text-ink">{s.b}</span> : <span className="text-[13px] text-ink-3">tap to flip ↻</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-[20px] bg-paper-2/60 p-4 text-[17px] text-ink-2">
        <strong className="text-ink">Grown-ups test models too.</strong> OpenAI says GPT-6 Astra was its first model to reach its &quot;critical&quot; level for computer security skills, so at first it let fewer people use it.
        Anthropic says Claude Opus 5.5 is much less likely than recent models to do things that are hard to undo. These are the companies&apos; own statements: <Src m={byName("GPT-6 Astra")} />, <Src m={byName("Claude Opus 5.5")} />.
      </div>
    </div>
  );
}

// ---------- Chapter 14 ----------

export function TimelineAct({ onDone }: { onDone: () => void }) {
  const [idea, setIdea] = useState<Idea | null>(null);
  const list = TIMELINE.filter((m) => !idea || m.idea === idea);
  const [at, setAt] = useState(0);
  const [seen, setSeen] = useState<Set<string>>(new Set([TIMELINE[0].name]));
  const [grown, setGrown] = useState(false);
  const cur = list[Math.min(at, list.length - 1)];
  useEffect(() => { if (seen.size >= 5) onDone(); }, [seen, onDone]);
  const go = (i: number) => { const j = Math.max(0, Math.min(list.length - 1, i)); setAt(j); setSeen((s) => new Set(s).add(list[j].name)); };
  const icon = (i: Idea) => IDEAS.find((x) => x.id === i)!.emoji;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Show only one kind of idea">
        <Big tone={idea === null ? "ink" : "soft"} pressed={idea === null} onClick={() => { setIdea(null); setAt(0); }} className="text-[15px]">All</Big>
        {IDEAS.map((x) => <Big key={x.id} tone={idea === x.id ? "ink" : "soft"} pressed={idea === x.id} onClick={() => { setIdea(x.id); setAt(0); }} className="text-[15px]"><span aria-hidden>{x.emoji}</span> {x.label}</Big>)}
      </div>
      <div className="no-scrollbar -mx-2 overflow-x-auto px-2 pb-2">
        <ol className="relative flex min-w-max items-end gap-1 pt-2" aria-label="Years">
          <span aria-hidden className="absolute right-0 bottom-[22px] left-0 h-1 rounded-full bg-rule-strong" />
          {list.map((m, i) => (
            <li key={m.name} className="relative">
              <button type="button" onClick={() => go(i)} aria-current={i === at ? "step" : undefined} aria-label={`${m.when}: ${m.name}`}
                className={cn("story-btn flex w-[62px] flex-col items-center gap-1 rounded-xl py-1", i === at && "bg-[var(--role-resid-soft)]")}>
                <span aria-hidden className={cn("text-[22px]", !seen.has(m.name) && "opacity-50")}>{icon(m.idea)}</span>
                <span className={cn("relative z-10 h-4 w-4 rounded-full border-2", i === at ? "border-ink bg-ink" : seen.has(m.name) ? "border-[var(--role-mlp)] bg-[var(--role-mlp)]" : "border-rule-strong bg-paper")} />
                <span className="num text-[12.5px] text-ink-2">{m.year}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      {cur && (
        <div key={cur.name} className="story-pop grid gap-4 rounded-[24px] border-2 border-[var(--role-resid)] bg-paper p-5 sm:grid-cols-[auto_1fr]">
          <div aria-hidden className="text-[64px] leading-none">{icon(cur.idea)}</div>
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-ink-3">{cur.when} · {cur.who}</div>
            <h3 className="story-title text-[30px] font-bold text-ink">{cur.name}</h3>
            <p className="story-text mt-1 text-ink">{cur.kid}</p>
            <button type="button" onClick={() => setGrown(!grown)} aria-expanded={grown} className="mt-2 text-[15px] text-ink-3 underline underline-offset-2">{grown ? "Hide" : "Show"} the grown-up detail</button>
            {grown && <p className="mt-1 text-[15.5px] text-ink-2">{cur.grown} <Src m={cur} /></p>}
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Big tone="soft" onClick={() => go(at - 1)} disabled={at === 0}>← Earlier</Big>
            <Big tone="ink" onClick={() => go(at + 1)} disabled={at >= list.length - 1}>Later →</Big>
          </div>
        </div>
      )}
      <p className="text-[14px] text-ink-3">Checked on {TIMELINE_CHECKED}. New models come out almost every week, so this list will go out of date. Visited: {seen.size} of {TIMELINE.length}.</p>
      <Certificate />
    </div>
  );
}

const NAME_KEY = "latentlens.story.name";
let memName: string | null = null;
const nameSubs = new Set<() => void>();
const subName = (f: () => void) => { nameSubs.add(f); return () => { nameSubs.delete(f); }; };
const readName = () => { if (memName === null) { try { memName = window.localStorage.getItem(NAME_KEY) ?? ""; } catch { memName = ""; } } return memName; };

function Certificate() {
  const stickers = useStickers();
  const name = useSyncExternalStore(subName, readName, () => "");
  const save = (n: string) => { memName = n; try { window.localStorage.setItem(NAME_KEY, n); } catch { /* kept for this visit only */ } nameSubs.forEach((f) => f()); };
  const all = stickers.length >= CHAPTERS.length;
  return (
    <section className="story-cert mt-4 grid gap-3 rounded-[28px] border-4 border-double border-[var(--role-mlp)] bg-[var(--role-mlp-soft)] p-6 text-center" aria-label="Certificate">
      <div className="flex justify-center"><Pip mood="cheer" size={90} /></div>
      <div className="text-[15px] font-bold tracking-wide text-[var(--role-mlp-ink)] uppercase">Certificate</div>
      <p className="story-title text-[30px] font-bold text-ink">{name.trim() || "A curious learner"}</p>
      <p className="text-[19px] text-ink">{all ? "finished the whole LLM Storybook and knows how a computer learns to talk!" : `has collected ${stickers.length} of ${CHAPTERS.length} storybook stickers.`}</p>
      <p aria-hidden className="text-[28px] tracking-wider">{CHAPTERS.filter((c) => stickers.includes(c.slug)).map((c) => c.sticker.emoji).join(" ")}</p>
      <div className="story-noprint flex flex-wrap items-center justify-center gap-2">
        <label htmlFor="cert-name" className="text-[16px] text-ink-2">Your name:</label>
        <input id="cert-name" value={name} onChange={(e) => save(e.target.value.slice(0, 40))} className="min-h-12 w-full max-w-[16rem] min-w-0 rounded-2xl border-2 border-rule-strong bg-paper px-3 text-[18px]" />
        <Big tone="soft" onClick={() => window.print()}>🖨️ Print it</Big>
      </div>
      <p className="story-noprint text-[13px] text-ink-3">Your name stays in this browser only.</p>
    </section>
  );
}
