import type { Metadata } from "next";
import { Disclaimer } from "@/components/site/disclaimer";
import { PageShell } from "@/components/site/page";
import { CompareThreeLoader } from "@/components/three/compare-loader";
import { DataProvider } from "@/lib/data";
import { preload } from "@/lib/server-data";
import { DATA3, type ThreeDemo } from "@/lib/three";

export const metadata: Metadata = { title: "Same Position, Different Predictive Approaches" };

export default async function ComparePage() {
  const data = await preload([DATA3.demo]);
  const withLlm = (data[DATA3.demo] as ThreeDemo | undefined)?.models.Q.status === "ok";
  return (
    <PageShell>
      <div className="mb-8 border-b border-rule pb-8">
        <div className="eyebrow mb-3">Compare the models</div>
        <h1 className="font-serif text-[32px] leading-[1.1] font-semibold tracking-tight text-ink sm:text-[44px]">
          Same Position. {withLlm ? "Three" : "Two"} Predictive Approaches.
        </h1>
        <p className="mt-4 max-w-3xl text-[16px] leading-relaxed text-ink-2">
          {withLlm
            ? "A statistical human-move model, a general-purpose LLM and a chess-specific human-move transformer, all asked the same question about the same real decision: "
            : "A statistical human-move model and the state-of-the-art chess-specific human-move transformer, both asked the same question about the same real decision: "}
          <em>what move is this player most likely to choose?</em> Click any legal move to see what each approach assigns to it, or switch
          between the original human move and the controlled engine substitute.
        </p>
        <Disclaimer compact className="mt-5 max-w-3xl" />
      </div>
      <DataProvider value={data}>
        <CompareThreeLoader />
      </DataProvider>
    </PageShell>
  );
}
