import type { Metadata } from "next";
import Link from "next/link";
import { ProfessorMode } from "@/components/latent/professor/professor-mode";
import { loadLatent } from "@/lib/latent/data";

export const metadata: Metadata = { title: "Professor mode: Qwen3-8B internals", description: "A concise technical walkthrough of Qwen3-8B-Base internals, RMSNorm, latent states, the Recall Microscope and the human-vs-AI question." };

export default async function ProfessorPage() {
  const d = await loadLatent();
  return (
    <div className="grid gap-8">
      <header className="grid gap-2 border-b border-rule pb-6">
        <div className="text-[13px] font-semibold tracking-wide text-ink-3 uppercase">LatentLens · Professor mode</div>
        <h1 className="font-serif text-[34px] leading-tight font-semibold text-ink sm:text-[42px]">From outputs to internal representations in Qwen3-8B-Base</h1>
        <p className="max-w-3xl text-[15px] text-ink-2">A 5 to 10 minute technical walkthrough. For the step-by-step interactive version see the <Link href="/latent/demo" className="underline underline-offset-2">five-step demo</Link>; for every mechanism in depth see <Link href="/latent/mastery" className="underline underline-offset-2">Mastery</Link>.</p>
      </header>
      <ProfessorMode glassbox={d.glassbox} layerProbe={d.layerProbe} versions={d.recallVersions} />
    </div>
  );
}
