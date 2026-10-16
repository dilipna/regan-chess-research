import type { Metadata } from "next";
import { Prov } from "@/components/latent/kit";
import { ComponentResearch, DatasetAndMethod, LayerProbeSection, PcaSection, ResearchQuestion, ResearchWorkspace, RmsnormResearch } from "@/components/latent/research";
import { loadLatent } from "@/lib/latent/data";

export const metadata: Metadata = { title: "Research workspace: human vs AI inside Qwen" };

export default async function ResearchPage() {
  const d = await loadLatent();
  if (!d.arch) return <p role="alert" className="text-[13px] text-flag">Research artifacts could not be loaded.</p>;
  const ok = d.layerProbe.status === "ok";
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[13px] font-semibold tracking-wide text-ink-3 uppercase">Research workspace</div>
        {ok ? <Prov kind="recorded" /> : <Prov kind="pending" detail="no human-vs-AI result exists yet" />}
      </div>
      <ResearchQuestion />
      <ResearchWorkspace arch={d.arch} />
      <DatasetAndMethod arch={d.arch} streaming={d.streaming} />
      <h2 className="mt-14 font-serif text-[28px] font-semibold text-ink">Results</h2>
      <p className="mt-1 text-[15px] text-ink-2">Each result below is either a recorded measurement or an explicit pending state with the commands that produce it. No placeholder charts are drawn.</p>
      <LayerProbeSection lp={d.layerProbe} />
      <PcaSection pca={d.pca} />
      <RmsnormResearch r={d.rmsnorm} />
      <ComponentResearch c={d.component} />
    </>
  );
}
