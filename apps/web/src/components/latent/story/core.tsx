"use client";

// Shared pieces of the LLM Storybook: read-aloud with word highlighting (the browser's own speech synthesis, nothing
// leaves the device), stickers kept in this browser only, and Pip, the guide.

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

// ---------- read aloud ----------

interface NarrState { id: string | null; sentence: number; char: number }
const IDLE: NarrState = { id: null, sentence: -1, char: -1 };
let narr: NarrState = IDLE;
let run = 0;
const narrSubs = new Set<() => void>();
const setNarr = (s: NarrState) => { narr = s; narrSubs.forEach((f) => f()); };
const synth = () => (typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null);

const RATE_KEY = "latentlens.story.rate";
let rate = 0.9;
try { if (typeof window !== "undefined") rate = Number(window.localStorage.getItem(RATE_KEY)) || 0.9; } catch { /* storage blocked */ }

function voice(): SpeechSynthesisVoice | undefined {
  const vs = synth()?.getVoices() ?? [];
  const en = vs.filter((v) => /^en[-_]/i.test(v.lang));
  const liked = /Samantha|Google US English|Aria|Jenny|Libby|Sonia|Natural|Karen|Moira|Google UK English Female/i;
  return en.find((v) => liked.test(v.name) && v.localService) ?? en.find((v) => liked.test(v.name)) ?? en.find((v) => v.default) ?? en[0];
}

export function speak(id: string, sentences: string[]) {
  const s = synth();
  if (!s) return;
  s.cancel();
  const me = ++run;
  const v = voice();
  sentences.forEach((text, i) => {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate; u.pitch = 1.05;
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-US";
    u.onstart = () => { if (me === run) setNarr({ id, sentence: i, char: -1 }); };
    u.onboundary = (e) => { if (me === run && (e.name === "word" || !e.name)) setNarr({ id, sentence: i, char: e.charIndex }); };
    u.onend = () => { if (me === run && i === sentences.length - 1) setNarr(IDLE); };
    u.onerror = () => { if (me === run && i === sentences.length - 1) setNarr(IDLE); };
    s.speak(u);
  });
  setNarr({ id, sentence: 0, char: -1 });
}

export function stopSpeaking() {
  run++;
  synth()?.cancel();
  setNarr(IDLE);
}

const subNarr = (f: () => void) => { narrSubs.add(f); return () => { narrSubs.delete(f); }; };
export const useNarration = () => useSyncExternalStore(subNarr, () => narr, () => IDLE);
const noSub = () => () => {};
export const useCanSpeak = () => useSyncExternalStore(noSub, () => synth() !== null, () => false);

export function useSpeechRate(): [number, (r: number) => void] {
  const r = useSyncExternalStore(subNarr, () => rate, () => 0.9);
  return [r, (v: number) => { rate = v; try { window.localStorage.setItem(RATE_KEY, String(v)); } catch { /* ignore */ } narrSubs.forEach((f) => f()); }];
}

/** Stop talking when the page that started it goes away. */
export function useStopOnLeave() {
  useEffect(() => () => stopSpeaking(), []);
}

export function ReadAloud({ id, sentences, label = "Read it to me", className }: { id: string; sentences: string[]; label?: string; className?: string }) {
  const can = useCanSpeak();
  const n = useNarration();
  const [r, setR] = useSpeechRate();
  if (!can) return null;
  const on = n.id === id;
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <button type="button" onClick={() => (on ? stopSpeaking() : speak(id, sentences))} aria-pressed={on}
        className={cn("story-btn inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-[18px] font-bold", on ? "bg-[var(--role-mlp)] text-[var(--on-role)]" : "bg-ink text-paper")}>
        <span aria-hidden className="text-[22px]">{on ? "⏹" : "🔊"}</span>{on ? "Stop" : label}
      </button>
      <button type="button" onClick={() => setR(r < 0.85 ? 0.9 : 0.75)} aria-pressed={r < 0.85}
        className="story-btn min-h-12 rounded-full border-2 border-rule-strong bg-paper px-4 text-[15px] text-ink-2">
        <span aria-hidden>🐢</span> {r < 0.85 ? "Slow voice: on" : "Slow voice"}
      </button>
    </div>
  );
}

/** A small speaker button that reads one instruction. */
export function Say({ text, id }: { text: string; id: string }) {
  const can = useCanSpeak();
  const n = useNarration();
  if (!can) return null;
  const on = n.id === id;
  return (
    <button type="button" onClick={() => (on ? stopSpeaking() : speak(id, [text]))} aria-label={on ? "Stop reading" : `Read aloud: ${text}`}
      className={cn("story-btn inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[20px]", on ? "bg-[var(--role-mlp)] text-[var(--on-role)]" : "bg-paper-2 text-ink")}>
      <span aria-hidden>{on ? "⏹" : "🔊"}</span>
    </button>
  );
}

/** Story sentences; the one being read is highlighted, and so is the current word when the voice reports it. */
export function Narrated({ id, sentences, className }: { id: string; sentences: string[]; className?: string }) {
  const n = useNarration();
  return (
    <div className={cn("story-text grid gap-3", className)}>
      {sentences.map((s, i) => {
        const active = n.id === id && n.sentence === i;
        return (
          <p key={i} className={cn("rounded-xl px-2 py-0.5 transition-colors", active && "bg-[var(--role-resid-soft)]")}>
            {active && n.char >= 0 ? <Words text={s} at={n.char} /> : s}
          </p>
        );
      })}
    </div>
  );
}

function Words({ text, at }: { text: string; at: number }) {
  const parts: React.ReactNode[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null, last = 0, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const hit = at >= m.index && at < m.index + m[0].length;
    parts.push(hit ? <mark key={k++} className="story-word rounded bg-[var(--role-mlp)] px-0.5 text-[var(--on-role)]">{m[0]}</mark> : m[0]);
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

// ---------- stickers (this browser only) ----------

const STICKER_KEY = "latentlens.story.stickers.v1";
const stickerSubs = new Set<() => void>();
let stickerCache: string[] | null = null;
function readStickers(): string[] {
  if (stickerCache) return stickerCache;
  try { stickerCache = JSON.parse(window.localStorage.getItem(STICKER_KEY) ?? "[]"); } catch { stickerCache = []; }
  if (!Array.isArray(stickerCache)) stickerCache = [];
  return stickerCache;
}
const EMPTY: string[] = [];
export const useStickers = () => useSyncExternalStore(
  (f) => { stickerSubs.add(f); const onStorage = (e: StorageEvent) => { if (e.key === STICKER_KEY) { stickerCache = null; f(); } }; window.addEventListener("storage", onStorage); return () => { stickerSubs.delete(f); window.removeEventListener("storage", onStorage); }; },
  readStickers, () => EMPTY);
export function earnSticker(slug: string) {
  const cur = readStickers();
  if (cur.includes(slug)) return;
  stickerCache = [...cur, slug];
  try { window.localStorage.setItem(STICKER_KEY, JSON.stringify(stickerCache)); } catch { /* kept for this visit only */ }
  stickerSubs.forEach((f) => f());
}
export function resetStickers() {
  stickerCache = [];
  try { window.localStorage.removeItem(STICKER_KEY); } catch { /* ignore */ }
  stickerSubs.forEach((f) => f());
}

// ---------- Pip ----------

export type Mood = "happy" | "think" | "wow" | "cheer";
export function Pip({ mood = "happy", size = 120, className, wave }: { mood?: Mood; size?: number; className?: string; wave?: boolean }) {
  const bulb = { happy: "var(--role-norm)", think: "var(--role-attn)", wow: "var(--role-mlp)", cheer: "var(--role-mlp)" }[mood];
  return (
    <svg viewBox="0 0 120 130" width={size} height={size * 130 / 120} role="img" aria-label={`Pip the robot, looking ${mood === "think" ? "thoughtful" : mood === "wow" ? "amazed" : "happy"}`} className={cn("pip shrink-0", className)}>
      <line x1="60" y1="22" x2="60" y2="8" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="60" cy="8" r="6.5" fill={bulb} className="pip-bulb" />
      <rect x="14" y="22" width="92" height="74" rx="26" fill="var(--role-resid)" />
      <rect x="25" y="33" width="70" height="50" rx="17" fill="var(--paper)" />
      <g className="pip-eyes">
        {mood === "think" ? (
          <><path d="M38 55 q6 -6 12 0" stroke="var(--ink)" strokeWidth="4" fill="none" strokeLinecap="round" /><circle cx="76" cy="54" r="5.5" fill="var(--ink)" /></>
        ) : (
          <><circle cx="44" cy="54" r={mood === "wow" ? 7 : 5.5} fill="var(--ink)" /><circle cx="76" cy="54" r={mood === "wow" ? 7 : 5.5} fill="var(--ink)" />
            <circle cx="46" cy="52" r="1.8" fill="#fff" /><circle cx="78" cy="52" r="1.8" fill="#fff" /></>
        )}
      </g>
      {mood === "wow" ? <ellipse cx="60" cy="72" rx="6" ry="5" fill="var(--ink)" />
        : mood === "think" ? <path d="M50 72 h20" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
        : <path d="M47 68 q13 12 26 0" stroke="var(--ink)" strokeWidth="4" fill="none" strokeLinecap="round" />}
      <circle cx="33" cy="68" r="4.5" fill="var(--role-mlp)" opacity=".35" /><circle cx="87" cy="68" r="4.5" fill="var(--role-mlp)" opacity=".35" />
      <rect x="34" y="98" width="52" height="24" rx="10" fill="var(--role-resid-ink)" />
      <rect x="44" y="104" width="10" height="10" rx="3" fill="var(--role-attn)" /><rect x="66" y="104" width="10" height="10" rx="3" fill="var(--role-mlp)" />
      <path d={wave || mood === "cheer" ? "M106 52 q12 -12 8 -28" : "M106 60 q10 8 6 20"} stroke="var(--role-resid)" strokeWidth="8" fill="none" strokeLinecap="round" className={wave ? "pip-wave" : undefined} />
      <path d={mood === "cheer" ? "M14 52 q-12 -12 -8 -28" : "M14 60 q-10 8 -6 20"} stroke="var(--role-resid)" strokeWidth="8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** A friendly burst of dots around a newly earned sticker. Decorative only. */
export function Burst() {
  return (
    <span aria-hidden className="story-burst pointer-events-none absolute inset-0">
      {Array.from({ length: 12 }, (_, i) => <i key={i} style={{ "--a": `${i * 30}deg`, "--c": ["var(--role-resid)", "var(--role-norm)", "var(--role-attn)", "var(--role-mlp)"][i % 4] } as React.CSSProperties} />)}
    </span>
  );
}

/** Call once when an activity is finished. */
export function useDone(onDone?: () => void) {
  const fired = useRef(false);
  return useCallback(() => { if (!fired.current) { fired.current = true; onDone?.(); } }, [onDone]);
}

/** Big friendly button used across activities. */
export function Big({ children, onClick, tone = "ink", disabled, pressed, className, label }: {
  children: React.ReactNode; onClick?: () => void; tone?: "ink" | "soft" | "resid" | "norm" | "attn" | "mlp"; disabled?: boolean; pressed?: boolean; className?: string; label?: string;
}) {
  const cls = {
    ink: "bg-ink text-paper", soft: "border-2 border-rule-strong bg-paper text-ink",
    resid: "bg-[var(--role-resid)] text-[var(--on-role)]", norm: "bg-[var(--role-norm-ink)] text-[var(--on-role)]", attn: "bg-[var(--role-attn-ink)] text-[var(--on-role)]", mlp: "bg-[var(--role-mlp-ink)] text-[var(--on-role)]",
  }[tone];
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={pressed} aria-label={label}
      className={cn("story-btn inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[18px] font-bold disabled:opacity-40", cls, className)}>
      {children}
    </button>
  );
}
