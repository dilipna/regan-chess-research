import type { Metadata } from "next";
import { Journey } from "@/components/latent/journey/shell";
import { loadLatent } from "@/lib/latent/data";

export const metadata: Metadata = { title: "Journey: how text becomes the next token" };

export default async function JourneyPage() {
  const d = await loadLatent();
  if (!d.arch || !d.tok || !d.trace) return <p role="alert" className="text-[14px] text-flag">The recorded artifacts could not be loaded.</p>;
  return <Journey data={{ arch: d.arch, tok: d.tok, trace: d.trace, gen: d.generation }} />;
}
