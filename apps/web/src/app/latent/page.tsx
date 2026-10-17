import type { Metadata } from "next";
import { Destinations, JourneyMap, LabsStrip, LandingHero, OnlyHere, QwenBlockOrder, StorybookInvite } from "@/components/latent/landing";
import { ArchitectureOverview, OpenVsClosed, Progression } from "@/components/latent/overview";
import { loadLatent } from "@/lib/latent/data";

export const metadata: Metadata = { title: { absolute: "LatentLens · How text becomes the next token" } };

export default async function LatentHome() {
  const d = await loadLatent();
  if (!d.arch) return <p role="alert" className="text-[14px] text-flag">The architecture artifact could not be loaded.</p>;
  return (
    <>
      <LandingHero />
      <StorybookInvite />
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
