import type { Metadata } from "next";
import { GlassBox } from "@/components/latent/glassbox";
import { loadLatent } from "@/lib/latent/data";

export const metadata: Metadata = { title: "Glass Box: one real Qwen block, re-checked" };

export default async function GlassBoxPage() {
  const d = await loadLatent();
  if (!d.glassbox) return <p role="alert" className="text-[14px] text-flag">The Glass Box recording is missing from this build.</p>;
  return <GlassBox manifest={d.glassbox} />;
}
