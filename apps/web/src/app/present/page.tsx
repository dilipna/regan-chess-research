import type { Metadata } from "next";
import { PageShell } from "@/components/site/page";
import { Present, type PresentData } from "@/components/present/present";
import { preload } from "@/lib/server-data";
import { DATA3 } from "@/lib/three";

export const metadata: Metadata = { title: "10-minute research demo" };

export default async function PresentPage() {
  const urls = [DATA3.demo, "/data/curated_examples.json", "/data/paired_bootstrap.json", DATA3.movePrediction, DATA3.hybridE];
  const d = await preload(urls);
  const [demo, curated, paired, mp, hybridE] = urls.map((u) => d[u]);
  if (!demo || !curated || !paired || !mp)
    return <PageShell><p role="alert" className="text-[13px] text-flag">The demo data could not be loaded.</p></PageShell>;
  return (
    <PageShell className="pt-0 sm:pt-0">
      <Present data={{ demo, curated, paired, mp, hybridE: hybridE ?? {} } as PresentData} />
    </PageShell>
  );
}
