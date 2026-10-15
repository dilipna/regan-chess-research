import type { Metadata } from "next";
import Link from "next/link";
import { ResultsClient } from "@/components/compare/results-client";
import { Prov } from "@/components/site/provenance";
import { PageHeader, PageShell } from "@/components/site/page";
import { HybridE } from "@/components/three/hybrid-e";
import { ResultsThree } from "@/components/three/results-three";
import { DataProvider } from "@/lib/data";
import { preload } from "@/lib/server-data";
import { DATA3 } from "@/lib/three";

export const metadata: Metadata = { title: "Results" };

export default async function ResultsPage() {
  const data = await preload([
    "/data/metrics.json", "/data/roc_curves.json",
    DATA3.movePrediction, DATA3.assistance, DATA3.bootstrap, DATA3.hybridE,
  ]);
  return (
    <PageShell>
      <PageHeader
        eyebrow="Results"
        title="Two questions, the same held-out decisions"
        lede="The direct comparison of the predictive approaches comes first. Every number is read from the exported result files. The held-out LLM (Qwen3-8B-Base) evaluation has not been run yet and is not part of these tables; seven demo positions scored locally appear on the home page only."
      >
        <Prov kind="finding" />
      </PageHeader>
      <nav aria-label="More views" className="-mt-4 mb-10 flex flex-wrap gap-x-5 gap-y-1.5 text-[13.5px] text-ink-2">
        <span className="text-ink-3">More views:</span>
        <Link href="/compare" className="underline underline-offset-4 hover:text-ink">Compare models</Link>
        <Link href="/examples" className="underline underline-offset-4 hover:text-ink">Where the models disagree</Link>
        <Link href="/demo" className="underline underline-offset-4 hover:text-ink">Hybrid demo</Link>
        <Link href="/analyze" className="underline underline-offset-4 hover:text-ink">Full game report</Link>
      </nav>
      <DataProvider value={data}>
        <ResultsThree />
        <section id="hybrid" aria-labelledby="hybrid-title" className="mt-24 scroll-mt-20 border-t-[3px] border-ours pt-10">
          <div className="eyebrow mb-2">Hybrid extension · secondary</div>
          <h2 id="hybrid-title" className="font-serif text-[28px] leading-tight font-semibold tracking-tight text-ink sm:text-[34px]">
            Can the Signals Be Combined?
          </h2>
          <p className="mt-3 max-w-3xl text-[15.5px] leading-relaxed text-ink-2">
            The direct comparison tests individual predictive approaches. The existing hybrid experiment asks whether combining Stockfish,
            Maia, sequence/context and statistical features in nested systems A → B → C → D improves the controlled benchmark. These results
            are unchanged from the validated experiment.
          </p>
          <div className="mt-10">
            <HybridE />
            <ResultsClient />
          </div>
        </section>
      </DataProvider>
    </PageShell>
  );
}
