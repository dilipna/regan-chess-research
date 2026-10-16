import type { Metadata } from "next";
import { Destinations, JourneyMap, LabsStrip, LandingHero, QwenBlockOrder } from "@/components/latent/landing";
import { ArchitectureOverview, OpenVsClosed, Progression } from "@/components/latent/overview";
import { loadLatent } from "@/lib/latent/data";

export const metadata: Metadata = { title: { absolute: "LatentLens · How text becomes the next token" } };

export default async function LatentHome() {
  const d = await loadLatent();
  if (!d.arch) return <p role="alert" className="text-[14px] text-flag">The architecture artifact could not be loaded.</p>;
  return (
    <>
      <LandingHero />
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
