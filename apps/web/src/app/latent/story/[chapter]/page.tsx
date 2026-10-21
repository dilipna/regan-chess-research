import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChapterView, type StoryData } from "@/components/latent/story/chapter";
import { CHAPTERS, chapterBySlug } from "@/lib/latent/story";
import { loadLatent } from "@/lib/latent/data";

export const dynamicParams = false;
export function generateStaticParams() {
  return CHAPTERS.map((c) => ({ chapter: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ chapter: string }> }): Promise<Metadata> {
  const ch = chapterBySlug((await params).chapter);
  return ch ? { title: `${ch.n}. ${ch.title} · The LLM Storybook`, description: ch.learned } : {};
}

export default async function StoryChapter({ params }: { params: Promise<{ chapter: string }> }) {
  const { chapter } = await params;
  if (!chapterBySlug(chapter)) notFound();
  const d = await loadLatent();
  const data: StoryData = {
    gen: d.generation,
    tok: d.tok,
    firstCoords: d.tok?.embedding?.tokens?.[0]?.first_coords,
    floors: d.arch?.verified.num_hidden_layers ?? 36,
    width: d.arch?.verified.hidden_size ?? 4096,
    versions: d.recallVersions,
  };
  return <ChapterView slug={chapter} data={data} />;
}
