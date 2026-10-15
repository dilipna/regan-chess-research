import type { Metadata } from "next";
import { PageHeader, PageShell } from "@/components/site/page";
import { DataProvider } from "@/lib/data";
import { preload } from "@/lib/server-data";
import { AnalyzeShell } from "./analyze-shell";

export const metadata: Metadata = { title: "Full Game Report" };

export default async function AnalyzePage() {
  // the default example study is rendered into the static HTML; the other two load on demand
  const data = await preload(["/data/demos.json", "/data/demo-human-baseline.json", "/data/metrics.json"]);
  return (
    <PageShell>
      <PageHeader
        eyebrow="Full game report"
        title="Inspect a game move by move"
        lede="Open one of the three prepared studies (precomputed; no server needed), or run live analysis on your own PGN. For every move you see how strong it is, its model-estimated human plausibility, how hard the position was, and how the whole game compares with expectation."
      />
      <DataProvider value={data}>
        <AnalyzeShell />
      </DataProvider>
    </PageShell>
  );
}
