import type { Metadata } from "next";
import { ProjectMap } from "@/components/latent/home/project-map";
import { Destinations, JourneyMap, LabsStrip, LandingHero, OnlyHere, QwenBlockOrder } from "@/components/latent/landing";
import { ArchitectureOverview, OpenVsClosed, Progression } from "@/components/latent/overview";
import { loadLatent } from "@/lib/latent/data";

export const metadata: Metadata = { title: "Project overview" };

export default async function LatentProject() {
  const d = await loadLatent();
  if (!d.arch) return <p role="alert" className="text-[14px] text-flag">The architecture artifact could not be loaded.</p>;
  return (
    <>
      <ProjectMap />
      <div className="mt-12"><LandingHero /></div>
      <OnlyHere versionsHeadline={d.recallVersions ? `${d.recallVersions.miss_categories["another version"]} of Qwen's ${d.recallVersions.misses} Gettysburg misses are another Lincoln manuscript's wording` : undefined} />
      <JourneyMap />
      <LabsStrip />
      <Destinations layerProbe={d.layerProbe} precision={d.recallPrecision} />
      <QwenBlockOrder arch={d.arch} />
      <ArchitectureOverview arch={d.arch} />
      <Progression />
      <OpenVsClosed />
    </>
  );
}
