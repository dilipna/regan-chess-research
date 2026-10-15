import type { Metadata } from "next";
import { ArchitectureOverview, Hero, ModeCards, OpenVsClosed, Progression } from "@/components/latent/overview";
import { loadLatent } from "@/lib/latent/data";

export const metadata: Metadata = { title: { absolute: "LatentLens · Inside Qwen3-8B-Base" } };

export default async function LatentHome() {
  const d = await loadLatent();
  if (!d.arch) return <p role="alert" className="text-[13px] text-flag">The architecture artifact could not be loaded.</p>;
  return (
    <>
      <Hero />
      <Progression />
      <ArchitectureOverview arch={d.arch} />
      <ModeCards arch={d.arch} layerProbe={d.layerProbe} precision={d.recallPrecision} />
      <OpenVsClosed />
    </>
  );
}
