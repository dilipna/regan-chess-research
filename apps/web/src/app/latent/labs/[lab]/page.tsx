import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AttentionLab } from "@/components/latent/labs/attention";
import { LABS } from "@/lib/latent/labs";
import { KvLab } from "@/components/latent/labs/kvcache";
import { RmsLab } from "@/components/latent/labs/norm";
import { RopeLab } from "@/components/latent/labs/rope";
import { SamplingLab } from "@/components/latent/labs/sampling";
import { TrainingLab } from "@/components/latent/labs/training";
import { loadLatent } from "@/lib/latent/data";

export const dynamicParams = false;
export function generateStaticParams() {
  return LABS.map((l) => ({ lab: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ lab: string }> }): Promise<Metadata> {
  const { lab } = await params;
  return { title: LABS.find((l) => l.slug === lab)?.title ?? "Lab" };
}

export default async function LabPage({ params }: { params: Promise<{ lab: string }> }) {
  const { lab } = await params;
  const d = await loadLatent();
  if (!d.arch || !d.trace) return <p role="alert" className="text-[14px] text-flag">The recorded artifacts could not be loaded.</p>;
  switch (lab) {
    case "rmsnorm": return <RmsLab arch={d.arch} />;
    case "attention": return <AttentionLab trace={d.trace} />;
    case "rope": return <RopeLab arch={d.arch} trace={d.trace} />;
    case "sampling": return <SamplingLab gen={d.generation} />;
    case "kv-cache": return <KvLab arch={d.arch} />;
    case "training": return <TrainingLab params={d.arch.parameters.total} />;
    default: notFound();
  }
}
