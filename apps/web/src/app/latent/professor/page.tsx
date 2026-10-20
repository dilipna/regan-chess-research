import type { Metadata } from "next";
import { ProfessorMode } from "@/components/latent/professor/professor-mode";
import { loadLatent } from "@/lib/latent/data";

export const metadata: Metadata = { title: "Professor mode: Qwen recall, layer by layer", description: "Qwen3-8B-Base internals, one recorded trace, and a proposed layerwise comparison for Professor Regan's 14B vs ~27B recall observation." };

export default async function ProfessorPage() {
  const d = await loadLatent();
  return (
    <div className="grid gap-8">
      <header className="grid gap-2 border-b border-rule pb-6">
        <div className="text-[13px] font-semibold tracking-wide text-ink-3 uppercase">LatentLens · Professor mode</div>
        <h1 className="font-serif text-[34px] leading-tight font-semibold text-ink sm:text-[42px]">Recall from the inside: tracing tokens through Qwen</h1>
        <p className="max-w-3xl text-[15px] text-ink-2">A 5 to 7 minute walkthrough. Recorded measurements, professor-reported observations, hypotheses and pending work are labelled separately.</p>
      </header>
      <ProfessorMode arch={d.arch} trace={d.trace} meta={d.metadata} glassbox={d.glassbox} versions={d.recallVersions} />
    </div>
  );
}
