import type { Metadata } from "next";
import Link from "next/link";
import { DailyReview } from "@/components/latent/review/daily-review";

export const metadata: Metadata = { title: "10-minute daily review", description: "Active recall across architecture, training, systems and security, from your local learning record." };

export default function ReviewPage() {
  return (
    <div className="grid gap-6">
      <header className="grid gap-2 border-b border-rule pb-6">
        <div className="text-[13px] font-semibold tracking-wide text-ink-3 uppercase">LatentLens · Review</div>
        <h1 className="font-serif text-[36px] leading-tight font-semibold text-ink">10-minute daily review</h1>
        <p className="max-w-3xl text-[16px] text-ink-2">Two architecture, two training and inference, two RAG and agents, two security, one connection question and one teach-back. Concepts you missed or guessed come first.</p>
        <p className="max-w-3xl text-[14px] text-ink-3">A lightweight deterministic review schedule: each correct answer moves a concept to a longer interval (now, 1, 3, 7, 21 days); a wrong answer moves it back to now. It is simple on purpose, not a scientifically optimized algorithm. Everything is stored only in this browser. Also see <Link href="/latent/mastery/confusions" className="underline underline-offset-2">I keep confusing these</Link>.</p>
      </header>
      <DailyReview />
    </div>
  );
}
