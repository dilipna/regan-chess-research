import type { Metadata } from "next";
import Link from "next/link";
import { FinalTest } from "@/components/latent/mastery/final-test";

export const metadata: Metadata = { title: "Final mastery test · LLM Mastery" };

export default function FinalPage() {
  return (
    <div className="grid gap-6">
      <header className="grid gap-2 border-b border-rule pb-6">
        <Link href="/latent/mastery" className="text-[13px] text-ink-3 underline underline-offset-2">← Mastery</Link>
        <h1 className="font-serif text-[36px] leading-tight font-semibold text-ink">Final mastery test</h1>
        <p className="max-w-3xl text-[16px] text-ink-2">Ten free-response parts. Write each answer without notes, then tick what it covered. Unticked points are your study list. Answers are saved only in this browser.</p>
      </header>
      <FinalTest />
    </div>
  );
}
