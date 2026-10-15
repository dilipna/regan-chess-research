import type { Metadata } from "next";
import { PageHeader, PageShell } from "@/components/site/page";
import { DataProvider } from "@/lib/data";
import { preload } from "@/lib/server-data";
import { MethodologyClient } from "./methodology-client";

export const metadata: Metadata = { title: "Methodology" };

export default async function MethodologyPage() {
  const data = await preload(["/data/metrics.json", "/data/provenance.json", "/data/three_model_move_prediction.json", "/data/movelens_demo.json"]);
  return (
    <PageShell>
      <PageHeader
        eyebrow="Methodology"
        title="How MoveLens measures the gap"
        lede="Exact definitions of every quantity on this site: the statistical baseline, the engine and human-move models, the eligibility rule, how controlled decision-level substitutions are constructed, how results are evaluated, cited sources and reproducibility provenance. Parameter values are read from the exported configuration."
      />
      <DataProvider value={data}>
        <MethodologyClient />
      </DataProvider>
    </PageShell>
  );
}
