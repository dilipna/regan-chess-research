import type { Metadata } from "next";
import { CompareDemo } from "@/components/demo/compare-demo";
import { Disclaimer } from "@/components/site/disclaimer";
import { PageShell } from "@/components/site/page";
import { DataProvider } from "@/lib/data";
import { FEATURED_STUDY } from "@/lib/featured";
import { preload } from "@/lib/server-data";

export const metadata: Metadata = { title: "Hybrid Demo" };

export default async function DemoPage() {
  // The default study is rendered into the static HTML; the other studies and the simulator load on demand.
  const data = await preload(["/data/demos.json", `/data/demo-${FEATURED_STUDY}.json`, "/data/metrics.json"]);
  return (
    <PageShell>
      <div className="mb-8 border-b border-rule pb-8">
        <div className="eyebrow mb-3">Hybrid extension · interactive demo</div>
        <h1 className="font-serif text-[34px] leading-[1.1] font-semibold tracking-tight text-ink sm:text-[44px]">The Hybrid Systems on the Same Position</h1>
        <p className="mt-4 max-w-3xl text-[16px] leading-relaxed text-ink-2">
          The secondary extension: how the existing hybrid systems (Stockfish, Maia-3 5M, sequence and statistical features combined in
          XGBoost) read one position, next to the Regan-inspired statistical view. For the direct comparison of the three predictive approaches,
          see Compare Models. Switch between the original human move and the substituted engine move, or between the three prepared studies.
        </p>
        <Disclaimer compact className="mt-5 max-w-3xl" />
      </div>
      <DataProvider value={data}>
        <CompareDemo />
      </DataProvider>
    </PageShell>
  );
}
