"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { LEVELS, SCENES, markProgress, useJourneyState, useProgress, type JourneyState } from "@/lib/latent/journey";
import { EXAMPLE, toyForward } from "@/lib/latent/toy-model";
import { exampleTokens, type JourneyData, type SceneProps } from "./common";
import { MotionControls, Prov, Segment, TokenStrip, VectorBars } from "../kit";
import { SceneBlock, SceneTokens, SceneVectors } from "./scenes-a";
import { SceneAttention, SceneMlp, SceneStack } from "./scenes-b";
import { SceneLearning, SceneOutput } from "./scenes-c";

/** What the tracker shows as the selected token's current representation in each scene (toy values). */
function trackerVector(st: JourneyState, toy: ReturnType<typeof toyForward>): { label: string; v: number[] } | null {
  const t = st.tok;
  switch (st.s) {
    case 2: return { label: "embedding row", v: toy.embed[t] };
    case 3: return { label: "after one block", v: toy.out[t] };
    case 4: return { label: "attention update", v: toy.attnUpdate[t] };
    case 5: return { label: "MLP update", v: toy.mlp[t].down };
    case 7: return { label: "final RMSNorm output", v: toy.finalNorm[t].out };
    default: return null;
  }
}

export function Journey({ data }: { data: JourneyData }) {
  const [st, set, reset] = useJourneyState();
  const progress = useProgress();
  const toy = useMemo(() => toyForward(EXAMPLE.tokens.map((t) => t.id)), []);
  const scene = SCENES[st.s - 1];
  useEffect(() => { markProgress(`scene:${scene.id}`); }, [scene.id]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA")) return;
      if (e.key === "]") set({ s: Math.min(SCENES.length, st.s + 1) });
      if (e.key === "[") set({ s: Math.max(1, st.s - 1) });
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [st.s, set]);
  useEffect(() => { document.getElementById("scene-top")?.focus({ preventScroll: true }); }, [st.s]);
  const tv = trackerVector(st, toy);
  const props: SceneProps = { st, set, data, toy };
  const Scene = [SceneTokens, SceneVectors, SceneBlock, SceneAttention, SceneMlp, SceneStack, SceneOutput, SceneLearning][st.s - 1];
  const tokNames = exampleTokens;
  return (
    <div>
      {/* header: the one question, the level switch, preferences */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-5">
        <div>
          <div className="text-[13px] font-semibold tracking-wide text-ink-3 uppercase">LatentLens journey · about 10 minutes</div>
          <h1 className="mt-1 font-serif text-[30px] leading-tight font-semibold text-ink sm:text-[38px]">How does this piece of text become the next token?</h1>
        </div>
        <div className="grid justify-items-end gap-2">
          <Segment label="Explanation level" value={st.level} onChange={(v) => set({ level: v })}
            options={LEVELS.map((l) => ({ value: l.id, label: l.label }))} />
          <span className="text-[12.5px] text-ink-3">{LEVELS.find((l) => l.id === st.level)?.hint}</span>
          <MotionControls />
        </div>
      </div>

      {/* scene map */}
      <nav aria-label="Journey scenes" className="mt-4">
        <ol className="flex flex-wrap gap-1.5">
          {SCENES.map((s) => (
            <li key={s.n}>
              <button type="button" onClick={() => set({ s: s.n })} aria-current={st.s === s.n ? "step" : undefined}
                className={cn("flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-[13.5px]",
                  st.s === s.n ? "border-ink bg-ink text-paper" : "border-rule-strong bg-paper text-ink-2 hover:border-ink-3")}>
                <span className="num">{s.n}</span><span className="hidden md:inline">{s.title}</span>
                {progress[`scene:${s.id}`] && st.s !== s.n && <span aria-label="visited" className="text-[var(--role-norm-ink)]">✓</span>}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {/* persistent tracker: the example, the selected token, its current representation */}
      <section aria-label="Your token" className="z-20 mt-4 lg:sticky lg:top-[64px] rounded-xl border border-rule bg-paper/95 p-3 shadow-[0_8px_24px_-20px_rgba(0,0,0,.8)] backdrop-blur sm:p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="min-w-0">
            <div className="mb-1.5 text-[12px] font-semibold tracking-wide text-ink-3 uppercase">Example sentence · selected token</div>
            <TokenStrip tokens={tokNames} selected={st.tok} onSelect={(p) => set({ tok: p })} showIds={st.level !== "story"} label="Choose the token to follow" />
          </div>
          {tv && (
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold tracking-wide text-ink-3 uppercase">Its {tv.label} <Prov kind="toy" /></div>
              <VectorBars values={tv.v} height={56} showValues={false} />
            </div>
          )}
        </div>
      </section>

      {/* the scene */}
      <section aria-labelledby="scene-title" className="mt-8">
        <div id="scene-top" tabIndex={-1} className="outline-none">
          <div className="text-[13px] font-semibold tracking-wide text-ink-3 uppercase">Scene {scene.n} of {SCENES.length}</div>
          <h2 id="scene-title" className="mt-0.5 font-serif text-[28px] leading-tight font-semibold text-ink sm:text-[34px]">{scene.title}</h2>
          <p className="mt-1 text-[19px] text-ink-2">{scene.question}</p>
        </div>
        <div key={`${st.s}`} className="ll-pop mt-6"><Scene {...props} /></div>
      </section>

      {/* scene navigation */}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-5">
        <button type="button" onClick={() => set({ s: st.s - 1 })} disabled={st.s === 1}
          className="rounded-lg border-2 border-rule-strong px-4 py-2 text-[15px] text-ink disabled:opacity-35">← {st.s > 1 ? SCENES[st.s - 2].title : "Previous"}</button>
        <div className="flex items-center gap-3 text-[12.5px] text-ink-3">
          <span>Keys: [ and ] change scenes</span>
          <button type="button" onClick={reset} className="rounded border border-rule-strong px-2 py-0.5 hover:text-ink">Reset this scene&apos;s choices</button>
        </div>
        {st.s < SCENES.length ? (
          <button type="button" onClick={() => set({ s: st.s + 1 })} className="rounded-lg bg-ink px-5 py-2 text-[15px] font-medium text-paper">{SCENES[st.s].title} →</button>
        ) : (
          <Link href="/latent/research" className="rounded-lg bg-ink px-5 py-2 text-[15px] font-medium text-paper">Continue to the research question →</Link>
        )}
      </div>
      <p className="mt-4 text-[12.5px] text-ink-3">Progress is stored only in this browser and records which scenes you visited and which checks you answered. It is not a measure of mastery.</p>
    </div>
  );
}
