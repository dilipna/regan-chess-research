// The learning route as one checklist: what exists at each stage, and which items you have marked done.
// Quiz-based mastery of topics comes from the existing learning record (./mastery/progress.ts); this store only
// holds the things the site cannot observe itself (finishing a module, passing a Build step's checks locally,
// drawing the Atlas from memory, finishing a lab). Stored only in this browser (localStorage).

import { BUILD_STEPS } from "./build";
import { FOUNDATIONS, ROUTE } from "./foundations";
import { LABS } from "./labs";
import { TOPICS, topicHref } from "./mastery";
import { LAB_LIST } from "./security/labs";

export interface RouteItem { id: string; label: string; href: string; kind: "check" | "topic"; topic?: string }
export interface RouteStage { n: number; title: string; line: string; href: string; items: RouteItem[] }

const check = (id: string, label: string, href: string): RouteItem => ({ id, label, href, kind: "check" });
const topic = (slug: string): RouteItem => {
  const t = TOPICS.find((x) => x.slug === slug)!;
  return { id: `t:${slug}`, label: t.title, href: topicHref(t), kind: "topic", topic: slug };
};

export const ATLAS_CHECKS = [
  { id: "a:model", label: "Draw the whole model from memory, top to bottom", part: "model.text" },
  { id: "a:block", label: "Draw one block: norm, attention, add, norm, MLP, add", part: "block.resid_in" },
  { id: "a:attention", label: "Name every step inside attention, in order", part: "attention.a_in" },
  { id: "a:mlp", label: "Explain the SwiGLU MLP and its widths", part: "mlp.m_in" },
];

export const STAGES: RouteStage[] = ROUTE.map((r) => {
  const items: RouteItem[] = (() => {
    switch (r.n) {
      case 0: return FOUNDATIONS.map((f) => check(`f:${f.slug}`, f.title, `/latent/foundations/${f.slug}`));
      case 1: return ATLAS_CHECKS.map((a) => check(a.id, a.label, `/latent?part=${a.part}#atlas`));
      case 2: return BUILD_STEPS.map((b) => check(`b:${b.n}`, `Step ${b.n}: ${b.title} (checks pass)`, "/latent/build"));
      case 3: return TOPICS.filter((t) => t.track === "mastery").map((t) => topic(t.slug));
      case 4: return TOPICS.filter((t) => t.track === "security").map((t) => topic(t.slug));
      default: return [
        ...LAB_LIST.map((l) => check(`l:${l.slug}`, `Security lab ${l.n}: ${l.title}`, `/latent/security/labs/${l.slug}`)),
        ...LABS.map((l) => check(`p:${l.slug}`, `Lab: ${l.title}`, `/latent/labs/${l.slug}`)),
      ];
    }
  })();
  return { ...r, items };
});

// ---------- the checklist store ----------

export interface RouteState { v: 1; done: Record<string, number> }
export const EMPTY_ROUTE: RouteState = { v: 1, done: {} };

export function toggle(s: RouteState, id: string, now: number): RouteState {
  const done = { ...s.done };
  if (done[id]) delete done[id]; else done[id] = now;
  return { ...s, done };
}

const KEY = "latentlens.route.v1";
let cache: RouteState | null = null;
const subs = new Set<() => void>();

export function readRoute(): RouteState {
  if (cache) return cache;
  try { const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "null"); cache = raw && raw.v === 1 && typeof raw.done === "object" ? raw : EMPTY_ROUTE; } catch { cache = EMPTY_ROUTE; }
  return cache!;
}
export function writeRoute(next: RouteState) {
  cache = next;
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* kept for this visit only */ }
  subs.forEach((f) => f());
}
export function subscribeRoute(f: () => void) {
  subs.add(f);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) { cache = null; f(); } };
  window.addEventListener("storage", onStorage);
  return () => { subs.delete(f); window.removeEventListener("storage", onStorage); };
}
export const resetRoute = () => writeRoute(EMPTY_ROUTE);
