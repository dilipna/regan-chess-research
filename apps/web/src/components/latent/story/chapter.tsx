"use client";

import { chapterBySlug } from "@/lib/latent/story";
import type { GenerationSteps, TokenizerExamples } from "@/lib/latent/types";
import type { RecallVersions } from "../versions";
import type { ProvKind } from "../kit";
import { CodesAct, CountingAct, GuessAct, PiecesAct, PracticeAct } from "./acts-a";
import { FlashlightAct, LibraryAct, MannersAct, TowerAct, WheelAct } from "./acts-b";
import { AgentAct, CarefulAct, ThinkingAct, TimelineAct } from "./acts-c";
import { ChapterShell } from "./book";

export interface StoryData {
  gen?: GenerationSteps;
  tok?: TokenizerExamples;
  firstCoords?: number[];
  floors: number;
  width: number;
  versions?: RecallVersions;
}

const PROV: Record<string, { kind: ProvKind | ProvKind[]; detail?: string }> = {
  guess: { kind: ["toy", "recorded"], detail: undefined },
  pieces: { kind: "recorded", detail: "real Qwen3 tokenizer output" },
  codes: { kind: ["toy", "recorded"] },
  counting: { kind: "toy", detail: "a counting machine running in your browser" },
  practice: { kind: "toy", detail: "real gradient descent on four words" },
  flashlight: { kind: "toy", detail: "the real formula with hand-picked numbers" },
  tower: { kind: ["toy", "recorded"] },
  library: { kind: "toy", detail: "knob counts from papers and model cards" },
  manners: { kind: "toy", detail: "a two-feature reward learned from your picks" },
  dice: { kind: "recorded", detail: "real shares; the spin is random in your browser" },
  thinking: { kind: "toy", detail: "answers written by hand" },
  agents: { kind: "toy", detail: "pretend tools" },
  careful: { kind: "recorded", detail: "Qwen3-8B-Base on the Gettysburg Address" },
  timeline: { kind: [], detail: "public sources, each one linked" },
};

export function ChapterView({ slug, data }: { slug: string; data: StoryData }) {
  const ch = chapterBySlug(slug)!;
  const p = PROV[slug];
  return (
    <ChapterShell ch={ch} prov={p.kind} provDetail={p.detail}>
      {(done) => {
        switch (slug) {
          case "guess": return <GuessAct gen={data.gen} onDone={done} />;
          case "pieces": return <PiecesAct tok={data.tok} onDone={done} />;
          case "codes": return <CodesAct firstCoords={data.firstCoords} onDone={done} />;
          case "counting": return <CountingAct onDone={done} />;
          case "practice": return <PracticeAct onDone={done} />;
          case "flashlight": return <FlashlightAct onDone={done} />;
          case "tower": return <TowerAct floors={data.floors} width={data.width} gen={data.gen} onDone={done} />;
          case "library": return <LibraryAct onDone={done} />;
          case "manners": return <MannersAct onDone={done} />;
          case "dice": return <WheelAct gen={data.gen} onDone={done} />;
          case "thinking": return <ThinkingAct onDone={done} />;
          case "agents": return <AgentAct onDone={done} />;
          case "careful": return <CarefulAct v={data.versions} onDone={done} />;
          case "timeline": return <TimelineAct onDone={done} />;
          default: return null;
        }
      }}
    </ChapterShell>
  );
}
