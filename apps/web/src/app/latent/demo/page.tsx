import type { Metadata } from "next";
import { ProfessorDemo } from "@/components/latent/demo";
import { loadLatent } from "@/lib/latent/data";

export const metadata: Metadata = { title: "5-minute professor demo" };

export default async function DemoPage() {
  const d = await loadLatent();
  if (!d.arch) return <p role="alert" className="text-[13px] text-flag">Artifacts could not be loaded.</p>;
  return <ProfessorDemo arch={d.arch} layerProbe={d.layerProbe} precision={d.recallPrecision} />;
}
