import type { Metadata } from "next";
import { PageShell } from "@/components/site/page";
import { Walkthrough, type WalkthroughData } from "@/components/three/walkthrough";
import { preload } from "@/lib/server-data";
import { DATA3 } from "@/lib/three";

export const metadata: Metadata = { title: "Research Walkthrough" };

export default async function WalkthroughPage() {
  const urls = [DATA3.demo, "/data/curated_examples.json", DATA3.assistance, "/data/paired_bootstrap.json", DATA3.movePrediction];
  const d = await preload(urls);
  const [demo, curated, assist, paired, mp] = urls.map((u) => d[u]);
  if (!demo || !curated || !assist || !paired || !mp)
    return <PageShell><p role="alert" className="text-[13px] text-flag">The walkthrough data could not be loaded.</p></PageShell>;
  const mpd = mp as { data: { positions: number }; models: Record<string, { status: string }> };
  const data = { demo, curated, assist, paired, qwenScored: mpd.models.Q?.status === "ok" ? mpd.data.positions : 0, testPositions: mpd.data.positions } as WalkthroughData;
  return (
    <PageShell>
      <div className="mb-8 border-b border-rule pb-6">
        <div className="eyebrow mb-3">Guided research walkthrough · about 6 minutes</div>
        <h1 className="font-serif text-[30px] leading-[1.1] font-semibold tracking-tight text-ink sm:text-[40px]">MoveLens</h1>
        <p className="mt-3 max-w-3xl text-[15.5px] leading-relaxed text-ink-2">
          Statistical evidence, language-model preference, and human move modeling — evaluated on the same chess positions. Everything here is precomputed
          research output served as static files; no backend is needed.
        </p>
      </div>
      <Walkthrough data={data} />
    </PageShell>
  );
}
