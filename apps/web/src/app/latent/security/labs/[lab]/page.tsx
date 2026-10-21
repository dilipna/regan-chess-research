import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LabView } from "@/components/latent/security/labs/lab-view";
import { LAB_LIST, labBySlug } from "@/lib/latent/security/labs";

export const dynamicParams = false;
export function generateStaticParams() {
  return LAB_LIST.map((l) => ({ lab: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ lab: string }> }): Promise<Metadata> {
  const l = labBySlug((await params).lab);
  return l ? { title: `Lab ${l.n}: ${l.title} · Security Lab`, description: l.intro } : {};
}

export default async function LabPage({ params }: { params: Promise<{ lab: string }> }) {
  const { lab } = await params;
  if (!labBySlug(lab)) notFound();
  return <LabView slug={lab} />;
}
