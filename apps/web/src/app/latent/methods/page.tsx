import type { Metadata } from "next";
import { Methods } from "@/components/latent/methods";
import { loadLatent } from "@/lib/latent/data";

export const metadata: Metadata = { title: "Methods and limitations" };

export default async function MethodsPage() {
  const d = await loadLatent();
  if (!d.arch) return <p role="alert" className="text-[13px] text-flag">Artifacts could not be loaded.</p>;
  return <Methods arch={d.arch} metadata={d.metadata} streaming={d.streaming} />;
}
