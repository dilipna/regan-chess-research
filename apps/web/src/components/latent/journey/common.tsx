"use client";

import type { JourneyState, Level } from "@/lib/latent/journey";
import { EXAMPLE, toyForward } from "@/lib/latent/toy-model";
import type { Architecture, GenerationSteps, TokenizerExamples, TokenTrace } from "@/lib/latent/types";

export interface JourneyData { arch: Architecture; tok: TokenizerExamples; trace: TokenTrace; gen?: GenerationSteps }
export interface SceneProps { st: JourneyState; set: (p: Partial<JourneyState>) => void; data: JourneyData; toy: ReturnType<typeof toyForward> }

export const exampleTokens = EXAMPLE.tokens.map((t) => ({ ...t }));

export function SceneFrame({ visual, side, below }: { visual: React.ReactNode; side: React.ReactNode; below?: React.ReactNode }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
      <div className="min-w-0">{visual}</div>
      <aside className="grid min-w-0 content-start gap-4">{side}</aside>
      {below && <div className="grid min-w-0 gap-4 xl:col-span-2">{below}</div>}
    </div>
  );
}

/** Short text for the current scene: a question, one thing to try, what changed, and a concise explanation. */
export function SceneText({ tryThis, consequence, explain }: { tryThis: React.ReactNode; consequence: React.ReactNode; explain: React.ReactNode }) {
  return (
    <div className="grid gap-3">
      <div className="rounded-xl border-2 border-ink bg-paper p-4">
        <div className="text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">Try this</div>
        <p className="mt-1 text-[16px] leading-snug text-ink">{tryThis}</p>
      </div>
      <div className="rounded-xl border border-rule bg-paper p-4" aria-live="polite">
        <div className="text-[11.5px] font-semibold tracking-wide text-ink-3 uppercase">What changed</div>
        <div className="mt-1 text-[15px] leading-snug text-ink">{consequence}</div>
      </div>
      <div className="px-1 text-[15px] leading-relaxed text-ink-2">{explain}</div>
    </div>
  );
}

export function byLevel<T>(level: Level, v: Record<Level, T>): T {
  return v[level];
}

