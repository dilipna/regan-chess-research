import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FoundationPage } from "@/components/latent/foundations/pages";
import { FOUNDATIONS, foundation } from "@/lib/latent/foundations";

export function generateStaticParams() {
  return FOUNDATIONS.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const f = foundation((await params).slug);
  return f ? { title: `${f.title} · Foundations`, description: f.oneLine } : {};
}

export default async function FoundationRoute({ params }: { params: Promise<{ slug: string }> }) {
  const f = foundation((await params).slug);
  if (!f) notFound();
  return <FoundationPage f={f} />;
}
