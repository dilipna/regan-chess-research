import type { Metadata } from "next";
import { FutureComparison, RecallMicroscope } from "@/components/latent/recall";
import { SectionHead } from "@/components/latent/shell";
import { VersionsFinding } from "@/components/latent/versions";
import { loadLatent } from "@/lib/latent/data";

export const metadata: Metadata = { title: "Recall Microscope" };

export default async function RecallPage() {
  const d = await loadLatent();
  if (!d.arch) return <p role="alert" className="text-[13px] text-flag">Artifacts could not be loaded.</p>;
  return (
    <>
      <SectionHead n={12} kicker="Recall Microscope" title="At what depth does a known continuation begin to dominate?">
        Teacher-forced next-token recall on a famous public-domain text and on an original paragraph the model cannot have seen. For every position we record the true
        token&apos;s rank, probability and margin at the output, and at every depth through an intermediate diagnostic projection.
      </SectionHead>
      {d.recallVersions && <div className="mb-10"><VersionsFinding v={d.recallVersions} /></div>}
      <RecallMicroscope precision={d.recallPrecision} />
      <FutureComparison nLayers={d.arch.verified.num_hidden_layers} />
    </>
  );
}
