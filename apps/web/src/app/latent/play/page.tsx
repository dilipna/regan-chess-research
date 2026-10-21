import type { Metadata } from "next";
import { Play } from "@/components/latent/play";
import { loadLatent } from "@/lib/latent/data";

export const metadata: Metadata = { title: "You vs Qwen: guess the next word" };

export default async function PlayPage() {
  const d = await loadLatent();
  return (
    <>
      <div className="mb-8 border-b border-rule pb-6">
        <div className="text-[13px] font-semibold tracking-wide text-ink-3 uppercase">You vs Qwen</div>
        <h1 className="mt-1 font-serif text-[34px] leading-tight font-semibold text-ink sm:text-[44px]">Can you predict the next word better than an 8-billion-parameter model?</h1>
        <p className="mt-3 max-w-3xl text-[17px] leading-relaxed text-ink-2">This is the recall experiment, turned into a game. You see the true text so far and type the next word; Qwen3-8B-Base answered the same question for the same position, and its answer was recorded. Try the famous speech, then the paragraph nobody has seen before.</p>
      </div>
      <Play versions={d.recallVersions} />
    </>
  );
}
