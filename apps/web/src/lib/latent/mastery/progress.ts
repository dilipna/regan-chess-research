// Local learning record: which concepts you got right or wrong, and when each is due for review (Leitner boxes).
// Stored only in this browser (localStorage). Pure functions are exported for tests.

import type { Area, QuizItem } from "./types";

export interface ConceptRecord { seen: number; right: number; wrong: number; box: number; due: number; last: number; lastWrong: boolean; teach?: number }
export interface LearnState { v: 1; concepts: Record<string, ConceptRecord>; teach: Record<string, { text: string; at: number; points: number }> }
export const EMPTY_STATE: LearnState = { v: 1, concepts: {}, teach: {} };

const DAY = 86_400_000;
export const INTERVALS = [0, 1, 3, 7, 21].map((d) => d * DAY);

export function record(s: LearnState, concept: string, correct: boolean, now: number): LearnState {
  const c = s.concepts[concept] ?? { seen: 0, right: 0, wrong: 0, box: 0, due: now, last: 0, lastWrong: false };
  const box = correct ? Math.min(c.box + 1, INTERVALS.length - 1) : 0;
  const next: ConceptRecord = { ...c, seen: c.seen + 1, right: c.right + (correct ? 1 : 0), wrong: c.wrong + (correct ? 0 : 1), box, due: now + INTERVALS[box], last: now, lastWrong: !correct };
  return { ...s, concepts: { ...s.concepts, [concept]: next } };
}

export function recordTeach(s: LearnState, concept: string, text: string, points: number, now: number): LearnState {
  const c = s.concepts[concept] ?? { seen: 0, right: 0, wrong: 0, box: 0, due: now, last: 0, lastWrong: false };
  return { ...s, teach: { ...s.teach, [concept]: { text, at: now, points } }, concepts: { ...s.concepts, [concept]: { ...c, teach: now } } };
}

export type Status = "not-started" | "learning" | "review" | "mastered";
export const STATUS_TEXT: Record<Status, string> = { "not-started": "Not started", learning: "Learning", review: "Review", mastered: "Mastered" };

export function status(c: ConceptRecord | undefined, now: number): Status {
  if (!c || c.seen === 0) return "not-started";
  if (c.lastWrong || (c.box > 0 && c.due <= now)) return "review";
  if (c.box >= 3) return "mastered";
  return "learning";
}

/** Higher = more urgent: wrong last time, then overdue, then never seen, then the rest. */
export function priority(c: ConceptRecord | undefined, now: number): number {
  if (!c || c.seen === 0) return 2;
  if (c.lastWrong) return 4;
  if (c.due <= now) return 3;
  return 1 - c.box / 10;
}

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const DAILY_PLAN: { area: Area; n: number }[] = [
  { area: "arch", n: 2 }, { area: "traininf", n: 2 }, { area: "app", n: 2 }, { area: "security", n: 2 }, { area: "connection", n: 1 },
];

/** The ten-minute review: 2 architecture, 2 training/inference, 2 application, 2 security, 1 connection (+1 teach-back chosen by the caller). */
export function pickDaily(items: QuizItem[], s: LearnState, now: number, seed: number): QuizItem[] {
  const rand = seeded(seed);
  const jitter = new Map(items.map((q) => [q.id, rand()]));
  const out: QuizItem[] = [];
  for (const { area, n } of DAILY_PLAN) {
    const pool = items.filter((q) => q.area === area && !out.includes(q));
    pool.sort((x, y) => priority(s.concepts[y.topic], now) - priority(s.concepts[x.topic], now) || jitter.get(x.id)! - jitter.get(y.id)!);
    const used = new Set<string>();
    for (const q of pool) {
      if (used.size >= n) break;
      if (used.has(q.topic)) continue;   // one question per topic per area, for variety
      used.add(q.topic);
      out.push(q);
    }
  }
  return out;
}

export function pickTeachBack(topics: string[], s: LearnState, now: number, seed: number): string {
  const rand = seeded(seed + 17);
  const scored = topics.map((t) => [t, priority(s.concepts[t], now) + (s.teach[t] ? -0.5 : 0) + rand() * 0.01] as const);
  return scored.sort((a, b) => b[1] - a[1])[0][0];
}

// ---------- browser store ----------

const KEY = "latentlens.mastery.v1";
let cache: LearnState | null = null;
const subs = new Set<() => void>();
export function readState(): LearnState {
  if (cache) return cache;
  try { const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "null"); cache = raw && raw.v === 1 ? { ...EMPTY_STATE, ...raw } : EMPTY_STATE; } catch { cache = EMPTY_STATE; }
  return cache!;
}
export function writeState(next: LearnState) {
  cache = next;
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* kept for this visit only */ }
  subs.forEach((f) => f());
}
export function subscribe(f: () => void) {
  subs.add(f);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) { cache = null; f(); } };
  window.addEventListener("storage", onStorage);
  return () => { subs.delete(f); window.removeEventListener("storage", onStorage); };
}
export function resetState() { writeState(EMPTY_STATE); }
