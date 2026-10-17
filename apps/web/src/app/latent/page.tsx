import type { Metadata } from "next";
import { Atlas } from "@/components/latent/atlas/atlas";
import { AtlasHero, Doors, RememberIt } from "@/components/latent/atlas/home";
import { atlasLevels } from "@/lib/latent/atlas";
import { atlasExample } from "@/lib/latent/atlas-example";
import { dims } from "@/lib/latent/parts";
import { loadLatent } from "@/lib/latent/data";

export const metadata: Metadata = { title: { absolute: "LatentLens · The transformer, in one picture" } };

export default async function LatentHome() {
  const d = await loadLatent();
  if (!d.arch) return <p role="alert" className="text-[14px] text-flag">The architecture artifact could not be loaded.</p>;
  const example = atlasExample(d.trace, d.tok);
  const { L, d: width, F, V, H, Hkv, G, dh, theta } = dims(d.arch);
  return (
    <>
      <AtlasHero arch={d.arch} />
      <Atlas levels={atlasLevels(d.arch, example)} example={example} dims={{ L, d: width, F, V, H, Hkv, G, dh, theta }} />
      <RememberIt arch={d.arch} />
      <Doors />
    </>
  );
}
