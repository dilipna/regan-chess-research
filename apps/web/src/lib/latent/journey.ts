"use client";

// Journey state lives in the URL (?s=3&level=mechanics&tok=5&layer=18&step=2) so that switching explanation levels
// keeps the example and step, links can be shared, and browser back/forward walk through scenes predictably:
// changing the scene pushes a history entry; changing level, token, layer or sub-step replaces the current one.
import { useCallback, useSyncExternalStore } from "react";

export type Level = "story" | "mechanics" | "research";
export const LEVELS: { id: Level; label: string; hint: string }[] = [
  { id: "story", label: "Story", hint: "plain language and concrete examples" },
  { id: "mechanics", label: "Mechanics", hint: "vectors, operations, shapes and formulas" },
  { id: "research", label: "Research", hint: "the real Qwen3-8B-Base architecture, recordings and limits" },
];

export const SCENES = [
  { n: 1, id: "tokens", title: "Text becomes tokens", question: "What does the model actually read?" },
  { n: 2, id: "vectors", title: "Tokens become vectors", question: "How does a token turn into numbers?" },
  { n: 3, id: "block", title: "A block updates the representation", question: "What happens inside one block, and in what order?" },
  { n: 4, id: "attention", title: "Attention mixes information", question: "Which earlier words can this word look at?" },
  { n: 5, id: "mlp", title: "The MLP transforms each token", question: "What does the MLP do that attention does not?" },
  { n: 6, id: "stack", title: "Blocks repeat", question: "Is block 30 the same as block 3?" },
  { n: 7, id: "output", title: "Scores become the next token", question: "How does a list of scores become one chosen word?" },
  { n: 8, id: "learning", title: "Learning versus using", question: "When do the model's weights change?" },
] as const;

export interface JourneyState { s: number; level: Level; tok: number; layer: number; step: number }
export const DEFAULT_STATE: JourneyState = { s: 1, level: "story", tok: 5, layer: 17, step: 0 };

export function parseState(search: string): JourneyState {
  const q = new URLSearchParams(search);
  const int = (k: string, d: number, lo: number, hi: number) => {
    const v = Number.parseInt(q.get(k) ?? "", 10);
    return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
  };
  const level = q.get("level");
  return {
    s: int("s", DEFAULT_STATE.s, 1, SCENES.length),
    level: level === "mechanics" || level === "research" ? level : "story",
    tok: int("tok", DEFAULT_STATE.tok, 0, 5),
    layer: int("layer", DEFAULT_STATE.layer, 0, 35),
    step: int("step", 0, 0, 20),
  };
}

export function serializeState(s: JourneyState): string {
  const q = new URLSearchParams();
  q.set("s", String(s.s));
  if (s.level !== "story") q.set("level", s.level);
  if (s.tok !== DEFAULT_STATE.tok) q.set("tok", String(s.tok));
  if (s.layer !== DEFAULT_STATE.layer) q.set("layer", String(s.layer));
  if (s.step) q.set("step", String(s.step));
  return `?${q.toString()}`;
}

const EVT = "latentlens:urlstate";
function subscribe(cb: () => void) {
  window.addEventListener("popstate", cb);
  window.addEventListener(EVT, cb);
  return () => { window.removeEventListener("popstate", cb); window.removeEventListener(EVT, cb); };
}

/** URL-backed journey state. The server renders the default state; the client then reads the URL. */
export function useJourneyState(): [JourneyState, (patch: Partial<JourneyState>) => void, () => void] {
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => "");
  const state = parseState(search);
  const set = useCallback((patch: Partial<JourneyState>) => {
    const cur = parseState(window.location.search);
    const next = { ...cur, ...patch };
    if (patch.s !== undefined && patch.s !== cur.s && patch.step === undefined) next.step = 0;
    const url = window.location.pathname + serializeState(next);
    if (next.s !== cur.s) window.history.pushState(window.history.state, "", url);
    else window.history.replaceState(window.history.state, "", url);
    window.dispatchEvent(new Event(EVT));
  }, []);
  const reset = useCallback(() => {
    const cur = parseState(window.location.search);
    window.history.replaceState(window.history.state, "", window.location.pathname + serializeState({ ...DEFAULT_STATE, s: cur.s, level: cur.level }));
    window.dispatchEvent(new Event(EVT));
  }, []);
  return [state, set, reset];
}

// ------------------------------------------------------------------ local progress (visited scenes, answered checks)
const KEY = "latentlens.progress.v1";
export function readProgress(): Record<string, boolean> {
  try { return JSON.parse(window.localStorage.getItem(KEY) ?? "{}"); } catch { return {}; }
}
export function markProgress(id: string) {
  try {
    const p = readProgress();
    if (!p[id]) { p[id] = true; window.localStorage.setItem(KEY, JSON.stringify(p)); window.dispatchEvent(new Event(EVT)); }
  } catch { /* storage unavailable: progress is a convenience only */ }
}
export function useProgress(): Record<string, boolean> {
  const raw = useSyncExternalStore(subscribe, () => { try { return window.localStorage.getItem(KEY) ?? "{}"; } catch { return "{}"; } }, () => "{}");
  try { return JSON.parse(raw); } catch { return {}; }
}
