import type { Metadata } from "next";
import Link from "next/link";
import { ConfusionPairs } from "@/components/latent/mastery/confusion-pairs";

export const metadata: Metadata = { title: "I keep confusing these · LLM Mastery", description: "Side-by-side pairs of LLM and AI-security concepts that are easy to mix up." };

export default function ConfusionsPage() {
  return (
    <div className="grid gap-6">
      <header className="grid gap-2 border-b border-rule pb-6">
        <Link href="/latent/mastery" className="text-[13px] text-ink-3 underline underline-offset-2">← Mastery</Link>
        <h1 className="font-serif text-[36px] leading-tight font-semibold text-ink">I keep confusing these</h1>
        <p className="max-w-3xl text-[16px] text-ink-2">Each pair gives the one-sentence difference, the mechanical difference, an example and a trap question. These connections matter more than definitions.</p>
      </header>
      <ConfusionPairs />
    </div>
  );
}
