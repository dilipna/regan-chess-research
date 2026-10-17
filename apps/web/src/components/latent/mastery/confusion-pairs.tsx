"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { EXTRAS, MORE_PAIRS } from "@/lib/latent/mastery/confusion-extras";
import { PAIRS } from "@/lib/latent/mastery/confusions";
import { hrefFor, topicBySlug } from "@/lib/latent/mastery";
import { ConfusionPairCard } from "../learn/primitives";

export const ALL_PAIRS = [...MORE_PAIRS.slice(0, 1), ...PAIRS, ...MORE_PAIRS.slice(1)];
const GROUPS = [
  { id: "all", label: "All" },
  { id: "model", label: "Model internals", levels: [1] },
  { id: "train", label: "Training and inference", levels: [2, 3] },
  { id: "app", label: "RAG and agents", levels: [4, 5] },
  { id: "research", label: "Interpretability", levels: [6] },
  { id: "security", label: "Security", levels: [7, 8, 9, 10] },
] as const;

export function ConfusionPairs() {
  const [g, setG] = useState<(typeof GROUPS)[number]["id"]>("all");
  const levels = GROUPS.find((x) => x.id === g) as { levels?: readonly number[] };
  const shown = ALL_PAIRS.filter((p) => !levels.levels || levels.levels.includes(topicBySlug(p.topic)!.level));
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter pairs">
        {GROUPS.map((x) => <button key={x.id} type="button" onClick={() => setG(x.id)} aria-pressed={g === x.id} className={cn("rounded-full border px-3 py-1 text-[13px]", g === x.id ? "border-ink bg-ink text-paper" : "border-rule-strong text-ink")}>{x.label}</button>)}
      </div>
      <p className="text-[14px] text-ink-3">{shown.length} pairs. For each: say the difference aloud first, then reveal.</p>
      <div className="grid gap-3 lg:grid-cols-2">
        {shown.map((p) => { const x = EXTRAS[`${p.a}|${p.b}`]; return <ConfusionPairCard key={p.a + p.b} a={p.a} b={p.b} keyDiff={p.key} rows={p.rows} href={hrefFor(p.topic)} example={x?.example} trap={x?.trap} />; })}
      </div>
    </div>
  );
}
