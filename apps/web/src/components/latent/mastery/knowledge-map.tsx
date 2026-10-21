"use client";

// The knowledge map as lanes of steps. Pick a node to see where it sits, what comes before, what depends on it,
// and how it connects to the other lanes. Plain HTML: readable at any width.

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { LANES, MAP_LINKS, MAP_NODES, hrefFor, type Lane } from "@/lib/latent/mastery";

export function KnowledgeMap() {
  const [lane, setLane] = useState<Lane | "all">("all");
  const [sel, setSel] = useState("stream");
  const node = MAP_NODES.find((n) => n.id === sel)!;
  const laneNodes = MAP_NODES.filter((n) => n.lane === node.lane);
  const i = laneNodes.indexOf(node);
  const links = MAP_LINKS.filter((l) => l.a === sel || l.b === sel);
  const label = (id: string) => MAP_NODES.find((n) => n.id === id)!.label;
  const linked = new Set(links.flatMap((l) => [l.a, l.b]));
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter lanes">
        {[{ id: "all" as const, label: "All" }, ...LANES].map((l) => (
          <button key={l.id} type="button" onClick={() => setLane(l.id)} aria-pressed={lane === l.id} className={cn("rounded-full border px-3 py-1 text-[13px]", lane === l.id ? "border-ink bg-ink text-paper" : "border-rule-strong text-ink")}>{l.label}</button>
        ))}
      </div>
      <div className="grid gap-3">
        {LANES.filter((l) => lane === "all" || l.id === lane).map((l) => (
          <div key={l.id} className="grid gap-1.5">
            <div className="text-[12px] font-semibold tracking-wide text-ink-3 uppercase">{l.label}</div>
            <ol className="flex flex-wrap items-center gap-1">
              {MAP_NODES.filter((n) => n.lane === l.id).map((n, k, arr) => (
                <li key={n.id} className="flex items-center gap-1">
                  <button type="button" onClick={() => setSel(n.id)} aria-pressed={sel === n.id}
                    className={cn("rounded-lg border px-2.5 py-1 text-[13px]", sel === n.id ? "border-ink bg-ink text-paper" : linked.has(n.id) ? "border-[var(--role-attn)] bg-[var(--role-attn-soft)] text-ink" : "border-rule-strong bg-paper text-ink")}>{n.label}</button>
                  {k < arr.length - 1 && <span aria-hidden className="text-ink-4">→</span>}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <section aria-live="polite" className="grid gap-2 rounded-xl border border-ink bg-paper p-4 text-[14.5px] text-ink-2">
        <h3 className="text-[17px] font-semibold text-ink">{node.label}</h3>
        <p><strong className="text-ink">Where am I?</strong> {LANES.find((l) => l.id === node.lane)!.label}, step {i + 1} of {laneNodes.length}.</p>
        <p><strong className="text-ink">What comes before?</strong> {i > 0 ? laneNodes[i - 1].label : "nothing in this lane: it is the start"}.</p>
        <p><strong className="text-ink">What comes after?</strong> {i < laneNodes.length - 1 ? laneNodes[i + 1].label : "nothing in this lane: it is the end"}.</p>
        {links.length > 0 && <div><strong className="text-ink">Connections to other lanes</strong> (highlighted):<ul className="mt-1 list-disc space-y-0.5 pl-5">{links.map((l) => <li key={l.a + l.b}><strong>{label(l.a === sel ? l.b : l.a)}</strong>: {l.why}</li>)}</ul></div>}
        <Link href={hrefFor(node.topic)} className="w-fit text-[var(--role-resid-ink)] underline underline-offset-2">Open the lesson →</Link>
      </section>
    </div>
  );
}
