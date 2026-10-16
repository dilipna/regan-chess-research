"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { blockParts, dims } from "@/lib/latent/parts";
import type { Architecture } from "@/lib/latent/types";
import { FiveIdeas, Panel, SectionHead } from "./shell";

type Row = { ids: string[]; rail: "start" | "line" | "add" | "end"; group?: "attn" | "mlp"; shape?: string };

/** The block as an ordered list of rows: a residual rail on the left, the sub-layer path on the right. */
export function BlockDiagram({ arch, selected, onSelect, highlight }: { arch: Architecture; selected?: string; onSelect?: (id: string) => void; highlight?: string[] }) {
  const parts = Object.fromEntries(blockParts(arch).map((p) => [p.id, p]));
  const D = dims(arch);
  const rows: Row[] = [
    { ids: ["resid_in"], rail: "start", shape: `[B, T, ${D.d}]` },
    { ids: ["norm1"], rail: "line", group: "attn", shape: `[B, T, ${D.d}]` },
    { ids: ["qkv"], rail: "line", group: "attn", shape: `Q ${D.H}x${D.dh} · K, V ${D.Hkv}x${D.dh}` },
    { ids: ["qknorm"], rail: "line", group: "attn", shape: `per head [${D.dh}]` },
    { ids: ["rope"], rail: "line", group: "attn", shape: "Q, K only" },
    { ids: ["attn"], rail: "line", group: "attn", shape: `${D.H} heads, ${D.Hkv} KV heads` },
    { ids: ["oproj"], rail: "line", group: "attn", shape: `${D.H * D.dh} -> ${D.d}` },
    { ids: ["add1"], rail: "add", shape: "x' = x + update" },
    { ids: ["norm2"], rail: "line", group: "mlp", shape: `[B, T, ${D.d}]` },
    { ids: ["mlp"], rail: "line", group: "mlp", shape: `${D.d} -> ${D.F} -> ${D.d}` },
    { ids: ["add2"], rail: "add", shape: "x'' = x' + update" },
    { ids: ["next_block"], rail: "end", shape: `[B, T, ${D.d}]` },
  ];
  return (
    <ol className="relative grid gap-1.5" aria-label="One Qwen3 transformer block, top to bottom">
      {rows.map((r, k) => {
        const p = parts[r.ids[0]];
        const isSel = selected === p.id;
        const hl = highlight?.includes(p.id);
        const prevGroup = rows[k - 1]?.group, nextGroup = rows[k + 1]?.group;
        return (
          <li key={p.id} className="grid grid-cols-[46px_1fr] items-stretch">
            <div aria-hidden className="relative flex justify-center">
              <div className={cn("ll-rail absolute w-[2px] bg-ink-3", r.rail === "start" ? "top-1/2 bottom-[-6px]" : r.rail === "end" ? "top-[-6px] bottom-1/2" : "top-[-6px] bottom-[-6px]")} />
              {r.rail === "add" && <div className="ll-node relative z-10 flex h-6 w-6 items-center justify-center self-center rounded-full border-2 border-ink bg-paper text-[15px] leading-none font-semibold text-ink">+</div>}
              {(r.rail === "start" || r.rail === "end") && <div className="ll-dot relative z-10 h-2.5 w-2.5 self-center rounded-full bg-ink-3" />}
            </div>
            <div className={cn("relative",
              r.group && "border-x border-dashed px-2", r.group === "attn" && "border-[var(--viz-1)]/40 bg-[color-mix(in_oklab,var(--viz-1)_4%,var(--paper))]",
              r.group === "mlp" && "border-[var(--viz-2)]/40 bg-[color-mix(in_oklab,var(--viz-2)_4%,var(--paper))]",
              r.group && prevGroup !== r.group && "rounded-t-md border-t pt-6", r.group && nextGroup !== r.group && "rounded-b-md border-b pb-2")}>
              {r.group && prevGroup !== r.group && (
                <span className="absolute top-1 left-2 text-[10.5px] font-medium tracking-[0.06em] text-ink-3 uppercase">
                  {r.group === "attn" ? "Attention sub-layer (mixes positions)" : "MLP sub-layer (each position separately)"}
                </span>
              )}
              <button type="button" onClick={() => onSelect?.(p.id)} aria-pressed={isSel}
                className={cn("flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded border px-3 py-2 text-left transition-colors",
                  isSel ? "border-ink bg-ink text-paper" : hl ? "border-llm bg-llm-soft text-ink" : "border-rule-strong bg-paper text-ink hover:border-ink-3",
                  r.rail === "add" && !isSel && "border-ink/60")}>
                <span className="text-[13.5px] font-medium">{p.title}</span>
                <span className={cn("font-mono text-[11px]", isSel ? "text-paper/75" : "text-ink-3")}>{r.shape}</span>
              </button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function BlockMicroscope({ arch }: { arch: Architecture }) {
  const parts = blockParts(arch);
  const [sel, setSel] = useState("norm1");
  const part = parts.find((p) => p.id === sel)!;
  return (
    <section>
      <SectionHead n={3} kicker="Learn" title="Transformer block microscope" id="block">
        One complete Qwen3 block, drawn from the order of operations verified in the installed implementation. The vertical rail on the left is the
        residual stream; it is only ever added to. Click any box.
      </SectionHead>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <BlockDiagram arch={arch} selected={sel} onSelect={setSel} />
        <div className="lg:sticky lg:top-28 lg:self-start"><Panel><FiveIdeas part={part} /></Panel></div>
      </div>
    </section>
  );
}
