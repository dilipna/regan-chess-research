"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { babble, END, kidWords, learn, nearest, nextChoices, practiceStep, softmax, surprise, type CodeWord, type Counts } from "@/lib/latent/story-models";
import type { GenerationSteps, TokenizerExamples } from "@/lib/latent/types";
import { Big, Pip } from "./core";

/** How a token reads aloud to a child. */
export function kidTok(t: string): string {
  const names: Record<string, string> = { ".": "a full stop", ",": "a comma", "\n": "a new line", ".\n": "a full stop and a new line", "\n\n": "an empty line", ".\n\n": "a full stop and an empty line", ":": "a colon", "'s": "'s" };
  if (names[t]) return names[t];
  return t.trim() || "a space";
}
const tokFace = (t: string) => (t === "\n" || t === "\n\n" ? "↵" : t.replace(/\n/g, "↵").trim() || "␣");

// ---------- Chapter 1 ----------

const RHYMES = [
  { start: "Twinkle, twinkle, little", options: ["shoe", "star", "fish"], answer: "star", emoji: "⭐" },
  { start: "One, two, three, four,", options: ["five", "blue", "cat"], answer: "five", emoji: "🖐️" },
  { start: "Happy birthday to", options: ["tree", "sock", "you"], answer: "you", emoji: "🎂" },
  { start: "The cow says", options: ["meow", "moo", "quack"], answer: "moo", emoji: "🐄" },
];

export function GuessAct({ gen, onDone }: { gen?: GenerationSteps; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const finished = i >= RHYMES.length;
  const r = RHYMES[Math.min(i, RHYMES.length - 1)];
  const right = picked === r.answer;
  useEffect(() => { if (finished) onDone(); }, [finished, onDone]);
  return (
    <div className="grid gap-6">
      {!finished ? (
        <div className="grid gap-4">
          <div className="text-[15px] font-semibold text-ink-3">Rhyme {i + 1} of {RHYMES.length}</div>
          <p className="story-big text-ink">{r.start} <span className={cn("inline-block min-w-[3ch] rounded-xl border-b-4 px-2 text-center", right ? "story-pop border-[var(--role-norm)] bg-[var(--role-norm-soft)]" : "border-ink-4")}>{right ? r.answer : "?"}</span>{right && <span aria-hidden className="story-pop ml-2">{r.emoji}</span>}</p>
          <div className="flex flex-wrap gap-3" role="group" aria-label="Choose the next word">
            {r.options.map((o) => (
              <Big key={o} tone={picked === o ? (o === r.answer ? "norm" : "soft") : "soft"} onClick={() => setPicked(o)} disabled={right && o !== r.answer} className="min-w-[110px] text-[24px]">{o}</Big>
            ))}
          </div>
          <p aria-live="polite" className="min-h-[1.5em] text-[20px] text-ink">{picked && (right ? "Yes! You guessed it. 🎉" : "Hmm, does that sound right? Try another word.")}</p>
          {right && <div><Big tone="ink" onClick={() => { setI(i + 1); setPicked(null); }}>{i + 1 < RHYMES.length ? "Next rhyme →" : "See a real model guess →"}</Big></div>}
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="flex items-center gap-3"><Pip mood="wow" size={70} /><p className="text-[20px] text-ink">You got all four! Now look how a <strong>real</strong> model guesses.</p></div>
          {gen ? <RealGuess gen={gen} /> : <p className="text-ink-3">The recorded guesses could not be loaded.</p>}
          <div><Big tone="soft" onClick={() => { setI(0); setPicked(null); }}>Play the rhymes again</Big></div>
        </div>
      )}
    </div>
  );
}

function RealGuess({ gen }: { gen: GenerationSteps }) {
  const top = gen.step1.top.slice(0, 6);
  const max = top[0].p;
  return (
    <figure className="rounded-[20px] bg-paper-2/60 p-4">
      <p className="story-big text-ink">{gen.prompt} <span className="rounded-xl bg-[var(--role-resid-soft)] px-2 text-[var(--role-resid-ink)]">?</span></p>
      <figcaption className="mt-2 text-[17px] text-ink-2">A real model never picks just one word. It gives every word a share of its guess. Longer bar, bigger guess.</figcaption>
      <ul className="mt-4 grid gap-2">
        {top.map((t) => (
          <li key={t.id} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-[18px]">
            <span className="truncate text-ink" title={kidTok(t.text)}><span className="rounded bg-paper px-1.5 font-mono">{tokFace(t.text)}</span>{/^[a-z]/i.test(t.text.trim()) ? null : <span className="text-[14px] text-ink-3"> {kidTok(t.text)}</span>}</span>
            <span className="h-6 rounded-full bg-paper"><span className="ll-anim block h-full rounded-full bg-[var(--role-resid)]" style={{ width: `${(t.p / max) * 100}%` }} /></span>
            <span className="num text-[16px] text-ink-2">{Math.round(t.p * 100)} in 100</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[15px] text-ink-3">These shares were recorded from Qwen3-8B-Base. Its top guess, {kidTok(top[0].text)}, has only about {Math.round(top[0].p * 100)} in 100: it is not very sure.</p>
    </figure>
  );
}

// ---------- Chapter 2 ----------

const PIECE_CARDS: { text: string; label: string }[] = [
  { text: "unbelievably", label: "unbelievably" },
  { text: "The researcher opened the notebook", label: "The researcher opened the notebook" },
  { text: "Tokenization is not the same as splitting on spaces.", label: "Tokenization is not the same as…" },
  { text: "In 1863, roughly 2,000 people listened.", label: "In 1863, roughly 2,000…" },
  { text: " notebook | notebook | Notebook | NOTEBOOK", label: "notebook, Notebook, NOTEBOOK" },
  { text: "研究人员打开了笔记本。", label: "研究人员打开了笔记本。 (Chinese)" },
];
const BLOCK = ["bg-[var(--role-resid-soft)] border-[var(--role-resid)]", "bg-[var(--role-mlp-soft)] border-[var(--role-mlp)]", "bg-[var(--role-norm-soft)] border-[var(--role-norm)]", "bg-[var(--role-attn-soft)] border-[var(--role-attn)]"];

export function PiecesAct({ tok, onDone }: { tok?: TokenizerExamples; onDone: () => void }) {
  const [guess, setGuess] = useState<number | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const ex = (t: string) => tok?.examples.find((e) => e.text === t);
  const ub = ex("unbelievably");
  useEffect(() => { if (guess !== null && seen.size >= 3) onDone(); }, [guess, seen, onDone]);
  if (!tok || !ub) return <p className="text-ink-3">The recorded tokenizer examples could not be loaded.</p>;
  const shown = open ? ex(open) : undefined;
  return (
    <div className="grid gap-6">
      <div className="grid gap-3 rounded-[20px] bg-paper-2/60 p-4">
        <p className="text-[20px] text-ink">First, guess: how many blocks will <strong>unbelievably</strong> be cut into?</p>
        <div className="flex flex-wrap gap-3" role="group" aria-label="Your guess">
          {[1, 2, 3, 4].map((n) => <Big key={n} tone={guess === n ? "resid" : "soft"} pressed={guess === n} onClick={() => { setGuess(n); setOpen("unbelievably"); setSeen((s) => new Set(s).add("unbelievably")); }} className="w-16 text-[24px]">{n}</Big>)}
        </div>
        {guess !== null && <p aria-live="polite" className="text-[19px] text-ink">{guess === ub.n_tokens ? `Yes, ${ub.n_tokens} blocks!` : `Good guess! It is really ${ub.n_tokens} blocks.`} Look below.</p>}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Word cards">
        {PIECE_CARDS.map((c) => (
          <Big key={c.text} tone={open === c.text ? "ink" : "soft"} pressed={open === c.text} onClick={() => { setOpen(c.text); setSeen((s) => new Set(s).add(c.text)); }} className="text-[17px] font-semibold">
            {seen.has(c.text) && <span aria-hidden>✓</span>}{c.label}
          </Big>
        ))}
      </div>
      {shown && (
        <figure key={shown.text} className="rounded-[20px] border-2 border-rule bg-paper p-4">
          <figcaption className="text-[18px] text-ink-2">&quot;{shown.text.trim()}&quot; is <strong className="text-ink">{shown.n_tokens} blocks</strong>.</figcaption>
          <ol className="mt-3 flex flex-wrap gap-2" aria-label="Its pieces">
            {shown.tokens.map((t, i) => (
              <li key={i} style={{ animationDelay: `${i * 70}ms` }} className={cn("story-pop flex flex-col items-center rounded-xl border-2 px-3 py-2", BLOCK[i % 4])}>
                <span className="font-mono text-[22px] whitespace-pre text-ink">{t.text.replace(/ /g, "␣")}</span>
                <span className="num text-[12px] text-ink-3">#{t.id.toLocaleString("en-US")}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[15px] text-ink-3">{tok.examples.find((e) => e.text === shown.text)?.note} The ␣ shows a space that is part of the piece. The small number is the piece number.</p>
        </figure>
      )}
      <p className="text-[16px] text-ink-3">Open three cards to earn the sticker. {seen.size < 3 && `(${seen.size} of 3)`}</p>
    </div>
  );
}

// ---------- Chapter 3 ----------

export const CODE_WORDS: CodeWord[] = [
  { word: "kitten", emoji: "🐱", code: [1, 0.15, 0] }, { word: "puppy", emoji: "🐶", code: [1, 0.2, 0] },
  { word: "mouse", emoji: "🐭", code: [1, 0.05, 0] }, { word: "lion", emoji: "🦁", code: [1, 0.65, 0] },
  { word: "elephant", emoji: "🐘", code: [1, 0.95, 0] }, { word: "whale", emoji: "🐋", code: [1, 1, 0.1] },
  { word: "apple", emoji: "🍎", code: [0, 0.1, 1] }, { word: "banana", emoji: "🍌", code: [0, 0.12, 0.95] },
  { word: "carrot", emoji: "🥕", code: [0, 0.08, 0.9] }, { word: "pizza", emoji: "🍕", code: [0, 0.3, 1] },
  { word: "cake", emoji: "🎂", code: [0, 0.25, 0.95] }, { word: "bike", emoji: "🚲", code: [0, 0.35, 0] },
  { word: "car", emoji: "🚗", code: [0, 0.6, 0] }, { word: "bus", emoji: "🚌", code: [0, 0.85, 0] },
  { word: "rocket", emoji: "🚀", code: [0, 1, 0] }, { word: "tree", emoji: "🌳", code: [0.1, 0.9, 0.15] },
];
const CHALLENGES = ["elephant", "pizza", "bike", "mouse"];

export function CodesAct({ firstCoords, onDone }: { firstCoords?: number[]; onDone: () => void }) {
  const [code, setCode] = useState<[number, number, number]>([0.5, 0.5, 0.5]);
  const [ci, setCi] = useState(0);
  const [wins, setWins] = useState(0);
  const near = nearest(CODE_WORDS, code, 3);
  const target = CHALLENGES[ci % CHALLENGES.length];
  const won = near[0].w.word === target;
  const wonRef = useRef(false);
  useEffect(() => {
    if (won && !wonRef.current) { wonRef.current = true; setWins((w) => w + 1); onDone(); }
    if (!won) wonRef.current = false;
  }, [won, onDone]);
  const W = 520, H = 300, P = 34;
  const xy = (c: [number, number, number]) => [P + c[1] * (W - 2 * P), H / 2 - (c[0] - c[2]) * (H / 2 - P)] as const;
  const me = xy(code);
  const sliders: [string, string, string][] = [["Is it an animal?", "no", "yes"], ["How big is it?", "tiny", "huge"], ["Can you eat it?", "no", "yum"]];
  const tEmoji = CODE_WORDS.find((w) => w.word === target)!.emoji;
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
      <div className="grid content-start gap-4">
        <p className="rounded-2xl bg-[var(--role-mlp-soft)] p-3 text-[19px] text-ink">Challenge: make a code that lives right next to the <strong>{target}</strong> <span aria-hidden>{tEmoji}</span></p>
        {sliders.map(([q, lo, hi], i) => (
          <label key={q} className="grid gap-1">
            <span className="text-[19px] font-semibold text-ink">{q} <span className="num text-[15px] font-normal text-ink-3">({code[i].toFixed(2)})</span></span>
            <input type="range" min={0} max={1} step={0.05} value={code[i]} className="story-range w-full"
              onChange={(e) => { const c = [...code] as [number, number, number]; c[i] = Number(e.target.value); setCode(c); }} aria-valuetext={`${q} ${code[i].toFixed(2)}`} />
            <span className="flex justify-between text-[14px] text-ink-3"><span>{lo}</span><span>{hi}</span></span>
          </label>
        ))}
        <div aria-live="polite" className="rounded-2xl border-2 border-rule p-3 text-[18px] text-ink">
          Your code is <span className="num font-mono">[{code.map((v) => v.toFixed(2)).join(", ")}]</span>. Its nearest neighbours: {near.map((n) => `${n.w.emoji} ${n.w.word}`).join(", ")}.
          {won && <div className="story-pop mt-2 font-bold text-[var(--role-norm-ink)]">You did it! Right next to the {target}. 🎉</div>}
        </div>
        {won && <div><Big tone="ink" onClick={() => setCi(ci + 1)}>Next challenge →</Big></div>}
        {wins > 0 && <p className="text-[15px] text-ink-3">Challenges won: {wins}</p>}
      </div>
      <figure className="min-w-0">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-[20px] bg-paper-2/50" role="img" aria-label={`A map of word codes. Your code is nearest to ${near[0].w.word}.`}>
          <text x={W / 2} y={18} textAnchor="middle" className="fill-ink-3 text-[12px]">animals</text>
          <text x={W / 2} y={H - 8} textAnchor="middle" className="fill-ink-3 text-[12px]">things to eat</text>
          <text x={P} y={H / 2 - 6} className="fill-ink-4 text-[11px]">small ←</text>
          <text x={W - P} y={H / 2 - 6} textAnchor="end" className="fill-ink-4 text-[11px]">→ big</text>
          {near.map((n) => { const p = xy(n.w.code); return <line key={n.w.word} x1={me[0]} y1={me[1]} x2={p[0]} y2={p[1]} stroke="var(--role-mlp)" strokeWidth={3} strokeDasharray="5 5" className="ll-anim" />; })}
          {CODE_WORDS.map((w) => { const [x, y] = xy(w.code); return <g key={w.word}><text x={x} y={y + 8} textAnchor="middle" fontSize={26}>{w.emoji}</text><text x={x} y={y + 24} textAnchor="middle" className="fill-ink-3 text-[10px]">{w.word}</text></g>; })}
          <g className="ll-anim" style={{ transform: `translate(${me[0]}px, ${me[1]}px)` }}>
            <circle r={17} fill="var(--role-mlp)" opacity={0.2} /><circle r={9} fill="var(--role-mlp)" /><text y={-20} textAnchor="middle" className="fill-ink text-[12px] font-bold">your word</text>
          </g>
        </svg>
        <figcaption className="mt-2 text-[15px] text-ink-3">Up means more like an animal, down means more like food, right means bigger. The dashed lines go to the three closest codes.</figcaption>
      </figure>
      {firstCoords && (
        <div className="rounded-[20px] border-2 border-[var(--role-resid)] bg-[var(--role-resid-soft)] p-4 lg:col-span-2">
          <p className="text-[18px] text-ink">Our toy code has <strong>3</strong> numbers. A real model, Qwen, gives every piece <strong>4,096</strong> numbers! Here are the first 8 for the piece &quot;The&quot;:</p>
          <p className="num mt-2 font-mono text-[16px] break-words text-[var(--role-resid-ink)]">[{firstCoords.map((v) => v.toFixed(3)).join(", ")}, … 4,088 more]</p>
        </div>
      )}
    </div>
  );
}

// ---------- Chapter 4 ----------

const SENTENCES = ["the cat sat on the mat", "the dog sat on the log", "the cat ate the fish", "the dog ate the bone", "a frog sat on a log",
  "the fish can swim", "the dog can run", "the cat can jump", "the sun is hot", "the moon is bright"];

export function CountingAct({ onDone }: { onDone: () => void }) {
  const [counts, setCounts] = useState<Counts>({});
  const [read, setRead] = useState<string[]>([]);
  const [said, setSaid] = useState<string[] | null>(null);
  const [shown, setShown] = useState(0);
  const [seed, setSeed] = useState(7);
  const [peek, setPeek] = useState("the");
  const [own, setOwn] = useState("");
  const vocab = useMemo(() => Object.keys(counts).filter((w) => w !== END).sort(), [counts]);
  useEffect(() => { if (read.length >= 3 && said) onDone(); }, [read, said, onDone]);
  useEffect(() => {
    if (!said || shown >= said.length) return;
    const t = setTimeout(() => setShown((s) => s + 1), 380);
    return () => clearTimeout(t);
  }, [said, shown]);
  const teach = (s: string) => { if (!kidWords(s).filter((w) => w !== END).length) return; setCounts((c) => learn(c, s)); setRead((r) => [...r, s]); };
  const talk = () => { const out = babble(counts, seed); setSeed(seed + 1); setSaid(out); setShown(0); };
  const ch = nextChoices(counts, peek);
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <div className="grid content-start gap-4">
        <h3 className="text-[20px] font-bold text-ink">1. Read to the machine</h3>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Sentence cards">
          {SENTENCES.map((s) => {
            const n = read.filter((r) => r === s).length;
            return <Big key={s} tone="soft" onClick={() => teach(s)} className="text-[17px] font-semibold">📖 {s}{n > 0 && <span className="num rounded-full bg-[var(--role-norm-soft)] px-2 text-[13px]">×{n}</span>}</Big>;
          })}
        </div>
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); teach(own); setOwn(""); }}>
          <label className="sr-only" htmlFor="own-sentence">Type your own sentence</label>
          <input id="own-sentence" value={own} onChange={(e) => setOwn(e.target.value.replace(/[^a-zA-Z\s]/g, "").slice(0, 60))} placeholder="or type your own sentence"
            className="min-h-12 min-w-0 flex-1 rounded-2xl border-2 border-rule-strong bg-paper px-4 text-[18px] text-ink" />
          <Big tone="resid" disabled={!own.trim()}>Read it</Big>
        </form>
        <p className="text-[17px] text-ink-2" aria-live="polite">It has read <strong className="text-ink">{read.length}</strong> sentence{read.length === 1 ? "" : "s"} and knows <strong className="text-ink">{vocab.length}</strong> words.</p>

        <h3 className="mt-2 text-[20px] font-bold text-ink">2. Let it talk</h3>
        <div className="flex flex-wrap items-center gap-3"><Big tone="mlp" onClick={talk} disabled={!read.length}>🗣️ Let it talk</Big>{!read.length && <span className="text-[17px] text-ink-3">It doesn&apos;t know any words yet!</span>}</div>
        {said && (
          <p className="story-big flex min-h-[2.4em] flex-wrap items-center gap-2 rounded-2xl bg-[var(--role-mlp-soft)] p-3 text-ink" aria-live="polite" aria-label={`The machine said: ${said.join(" ")}`}>
            <Pip mood="happy" size={44} />
            {said.slice(0, shown).map((w, i) => <span key={i} className="story-pop rounded-xl bg-paper px-2">{w === END ? "(the end)" : w}</span>)}
          </p>
        )}
      </div>
      <div className="grid content-start gap-3 rounded-[20px] bg-paper-2/60 p-4">
        <h3 className="text-[20px] font-bold text-ink">Look inside: what comes after…</h3>
        {vocab.length ? (
          <>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pick a word">
              {vocab.map((w) => <button key={w} type="button" onClick={() => setPeek(w)} aria-pressed={peek === w} className={cn("story-btn min-h-10 rounded-full border-2 px-3 text-[16px]", peek === w ? "border-ink bg-ink text-paper" : "border-rule-strong bg-paper text-ink")}>{w}</button>)}
            </div>
            {ch.length ? (
              <ul className="grid gap-1.5" aria-label={`Words that came after ${peek}`}>
                {ch.map((c) => (
                  <li key={c.word} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-2 text-[17px]">
                    <span className="truncate text-ink">{peek} → <strong>{c.word === END ? "(end)" : c.word}</strong></span>
                    <span className="h-5 rounded-full bg-paper"><span className="ll-anim block h-full rounded-full bg-[var(--role-norm)]" style={{ width: `${c.p * 100}%` }} /></span>
                    <span className="num text-[15px] text-ink-2">counted {c.n}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-[16px] text-ink-3">Pick a word to see what it has counted after it.</p>}
            <p className="text-[15px] text-ink-3">It only remembers <em>one</em> word back. That is why its sentences can wander. Real models remember the whole page.</p>
          </>
        ) : <p className="text-[17px] text-ink-3">Empty! Read it a sentence and its counting table appears here.</p>}
      </div>
    </div>
  );
}

// ---------- Chapter 5 ----------

const DRINKS = [{ w: "milk", e: "🥛" }, { w: "water", e: "💧" }, { w: "rocks", e: "🪨" }, { w: "crayons", e: "🖍️" }];
const EXAMPLES = [0, 1, 0, 0, 1];              // milk, water, milk, milk, water
const START: number[] = [0, 0, 1.5, 1];        // at first it wrongly prefers rocks
const STEPS = [{ v: 0.3, label: "tiny steps" }, { v: 1, label: "good steps" }, { v: 12, label: "huge steps" }];
export const BEST_SURPRISE = -(0.6 * Math.log(0.6) + 0.4 * Math.log(0.4));

export function PracticeAct({ onDone }: { onDone: () => void }) {
  const [scores, setScores] = useState(START);
  const [k, setK] = useState(0);
  const [lr, setLr] = useState(1);
  const [hist, setHist] = useState<number[]>([surprise(START, EXAMPLES)]);
  const [auto, setAuto] = useState(0);
  const p = softmax(scores);
  const one = () => {
    const n = practiceStep(scores, EXAMPLES[k % EXAMPLES.length], lr);
    setScores(n);
    setHist((h) => [...h.slice(-59), surprise(n, EXAMPLES)]);
    setK(k + 1);
  };
  useEffect(() => {
    if (auto <= 0) return;
    const t = setTimeout(() => { one(); setAuto((a) => a - 1); }, 140);
    return () => clearTimeout(t);
  });
  useEffect(() => { if (k >= 10) onDone(); }, [k, onDone]);
  const reset = () => { setScores(START); setK(0); setHist([surprise(START, EXAMPLES)]); setAuto(0); };
  const cur = hist[hist.length - 1];
  const face = cur > 1.4 ? "😲" : cur > 0.85 ? "🤔" : "😊";
  const wobbly = lr > 5 && hist.length > 6 && hist.slice(-6).some((h, i, a) => i > 0 && Math.abs(h - a[i - 1]) > 0.5);
  const ex = EXAMPLES[k % EXAMPLES.length];
  const W = 420, H = 150, maxS = Math.max(2.5, ...hist);
  const pts = hist.map((h, i) => `${(i / Math.max(1, hist.length - 1)) * (W - 20) + 10},${H - 10 - (h / maxS) * (H - 20)}`).join(" ");
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="grid content-start gap-4">
        <p className="story-big text-ink">The kitten drinks <span className="rounded-xl bg-[var(--role-resid-soft)] px-2">?</span></p>
        <ul className="grid gap-2" aria-label="The machine's shares">
          {DRINKS.map((d, i) => (
            <li key={d.w} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-2 text-[19px]">
              <span className="text-ink"><span aria-hidden>{d.e}</span> {d.w}</span>
              <span className="h-7 rounded-full bg-paper-2"><span className={cn("ll-anim block h-full rounded-full", i < 2 ? "bg-[var(--role-norm)]" : "bg-[var(--role-mlp)]")} style={{ width: `${p[i] * 100}%` }} /></span>
              <span className="num w-20 text-right text-[16px] text-ink-2">{Math.round(p[i] * 100)} in 100</span>
            </li>
          ))}
        </ul>
        <p className="text-[17px] text-ink-2">Next example to practise: <strong className="text-ink">&quot;The kitten drinks {DRINKS[ex].w}.&quot;</strong> (The examples say milk 3 times and water 2 times.)</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Step size">
          {STEPS.map((s) => <Big key={s.v} tone={lr === s.v ? "ink" : "soft"} pressed={lr === s.v} onClick={() => setLr(s.v)} className="text-[16px]">{s.label}</Big>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <Big tone="resid" onClick={one}>🚲 Practise</Big>
          <Big tone="resid" onClick={() => setAuto(10)} disabled={auto > 0}>Practise 10 times</Big>
          <Big tone="soft" onClick={reset}>Start over</Big>
        </div>
      </div>
      <div className="grid content-start gap-3 rounded-[20px] bg-paper-2/60 p-4">
        <p className="text-[20px] text-ink" aria-live="polite"><span aria-hidden className="text-[34px]">{face}</span> Surprise: <strong className="num">{cur.toFixed(2)}</strong> after {k} practice step{k === 1 ? "" : "s"}</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-paper" role="img" aria-label={`Surprise over practice steps, now ${cur.toFixed(2)}; the best possible is ${BEST_SURPRISE.toFixed(2)}`}>
          <line x1={10} x2={W - 10} y1={H - 10 - (BEST_SURPRISE / maxS) * (H - 20)} y2={H - 10 - (BEST_SURPRISE / maxS) * (H - 20)} stroke="var(--role-norm)" strokeDasharray="6 5" strokeWidth={2} />
          <text x={W - 12} y={H - 16 - (BEST_SURPRISE / maxS) * (H - 20)} textAnchor="end" className="fill-[var(--role-norm-ink)] text-[11px]">best possible</text>
          <polyline points={pts} fill="none" stroke="var(--role-resid)" strokeWidth={3} strokeLinejoin="round" />
        </svg>
        <p className="text-[16px] text-ink-2">The line is how surprised the machine is by the examples. Practice pushes it down. It can never reach zero, because sometimes the answer is milk and sometimes water.</p>
        {wobbly && <p className="story-pop rounded-xl bg-[var(--role-mlp-soft)] p-3 text-[18px] text-ink">Whoa, it is wobbling! Huge steps jump too far, back and forth. That is why real models take tiny steps.</p>}
      </div>
    </div>
  );
}
