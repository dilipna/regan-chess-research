import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MasteryTopic } from "@/components/latent/mastery/mastery-topic";
import { TOPICS, topicBySlug } from "@/lib/latent/mastery";

export const dynamicParams = false;
export function generateStaticParams() {
  return TOPICS.filter((t) => t.track === "security").map((t) => ({ topic: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }): Promise<Metadata> {
  const t = topicBySlug((await params).topic);
  return t ? { title: `${t.title} · Security Lab`, description: t.intuition } : {};
}

export default async function SecurityTopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  const t = topicBySlug(topic);
  if (!t || t.track !== "security") notFound();
  return <MasteryTopic slug={topic} />;
}
