import type { Metadata } from "next";
import { ComponentResearch, DatasetAndMethod, LayerProbeSection, PcaSection, ResearchQuestion, RmsnormResearch } from "@/components/latent/research";
import { loadLatent } from "@/lib/latent/data";

export const metadata: Metadata = { title: "Research: human vs AI inside Qwen" };

export default async function ResearchPage() {
  const d = await loadLatent();
  if (!d.arch) return <p role="alert" className="text-[13px] text-flag">Research artifacts could not be loaded.</p>;
  return (
    <>
      <ResearchQuestion />
      <DatasetAndMethod arch={d.arch} streaming={d.streaming} />
      <LayerProbeSection lp={d.layerProbe} />
      <PcaSection pca={d.pca} />
      <RmsnormResearch r={d.rmsnorm} />
      <ComponentResearch c={d.component} />
    </>
  );
}
