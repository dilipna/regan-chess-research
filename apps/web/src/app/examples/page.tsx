import type { Metadata } from "next";
import { Disclaimer } from "@/components/site/disclaimer";
import { PageShell } from "@/components/site/page";
import { ExampleExplorer, type CuratedData } from "@/components/three/examples";
import { LimitationsPanel } from "@/components/three/summary";
import { preload } from "@/lib/server-data";

export const metadata: Metadata = { title: "Where the Models Disagree" };

export default async function ExamplesPage() {
  const data = (await preload(["/data/curated_examples.json"]))["/data/curated_examples.json"] as CuratedData | undefined;
  const qwenOk = data?.qwen.status === "ok";
  return (
    <PageShell>
      <div className="mb-8 border-b border-rule pb-8">
        <div className="eyebrow mb-3">Curated examples · precomputed research results</div>
        <h1 className="font-serif text-[32px] leading-[1.1] font-semibold tracking-tight text-ink sm:text-[44px]">Where the models disagree</h1>
        <p className="mt-4 max-w-3xl text-[16px] leading-relaxed text-ink-2">
          Real held-out decisions, selected by fixed rules, not by how well any model does. The goal is not to show that one model wins but to see what
          signal each one carries: where Stockfish, the human-move model and the statistical baseline agree, and where they pull apart.
          {!qwenOk && " Qwen3-8B-Base has not been run on the held-out test split yet, so its column here reads “pending” and the two Qwen-specific slots are reserved (a local run on seven demo positions is shown on the home page)."}
        </p>
        <Disclaimer compact className="mt-5 max-w-3xl" />
      </div>
      {data ? (
        <ExampleExplorer data={data} />
      ) : (
        <p role="alert" className="text-[13px] text-flag">The curated examples file could not be loaded.</p>
      )}
      <section className="mt-16" aria-labelledby="ex-lim">
        <h2 id="ex-lim" className="mb-4 font-serif text-[22px] font-semibold text-ink">How to read these examples</h2>
        <LimitationsPanel />
      </section>
    </PageShell>
  );
}
