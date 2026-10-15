import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Foundation } from "@/components/story/foundation";
import { IndependentPrototype } from "@/components/story/independent";
import { Transition } from "@/components/story/ui";
import { Disclaimer } from "@/components/site/disclaimer";
import { SectionBadge } from "@/components/three/atoms";
import { MaiaSection, QwenSection, ThreePhilosophies } from "@/components/three/overview";
import { LimitationsPanel, ThreeModelCards } from "@/components/three/summary";
import { DataProvider } from "@/lib/data";
import { BASELINE_STUDY, FEATURED_STUDY, buildFeatured } from "@/lib/featured";
import { preload } from "@/lib/server-data";
import { DATA3, MODEL_META, type ModelKey, type ThreeDemo } from "@/lib/three";
import type { Report } from "@/lib/types";

export const metadata = { title: "Research overview" };

export default async function Overview() {
  const sel = `/data/demo-${FEATURED_STUDY}.json`, base = `/data/demo-${BASELINE_STUDY}.json`;
  const data = await preload([sel, base, DATA3.demo]);
  // Section 1 keeps the existing featured-position object; sections 2 and 3 use the three-model export of the SAME position.
  const featured = buildFeatured(data[sel] as Report | undefined, data[base] as Report | undefined);
  const demo = data[DATA3.demo] as ThreeDemo | undefined;
  // The LLM is shown as a full comparator only once real Qwen3-8B-Base scores exist; until then it is the next experiment.
  const withLlm = demo?.models.Q.status === "ok";
  return (
    <main className="flex-1">
      <section className="mx-auto max-w-[1240px] px-4 pt-16 pb-12 sm:px-6 sm:pt-24 sm:pb-16">
        <div className="eyebrow mb-5">Research prototype</div>
        <h1 className="font-serif text-[42px] leading-[1] font-semibold tracking-tight text-ink min-[400px]:text-[48px] sm:text-[76px]">MoveLens</h1>
        <p className="mt-5 max-w-3xl font-serif text-[22px] leading-snug text-ink-2 sm:text-[28px]">
          Can language-model move preferences add signal beyond chess statistics?
        </p>
        <p className="mt-6 max-w-3xl text-[17px] leading-relaxed text-ink sm:text-[19px]">
          Statistical evidence, language-model preference, and human move modeling — evaluated on the same chess positions. MoveLens compares a
          Regan-inspired statistical baseline, Qwen3-8B-Base and Maia-3 on held-out human games and controlled engine-assisted substitutions, then tests
          whether combining the signals adds predictive value.
        </p>
        {withLlm ? null : (
          <p role="status" className="mt-4 max-w-3xl rounded-md border border-dashed border-rule-strong bg-paper-2 px-3.5 py-2.5 text-[14px] leading-relaxed text-ink-2">
            <span className="font-semibold text-ink">Status:</span> the statistical baseline and Maia-3 are evaluated. The Qwen3-8B-Base scorer, prompt and
            evaluation are implemented and tested, but the held-out scoring run is pending. Seven demo positions were scored locally (home page); no held-out Qwen result exists or is estimated.
          </p>
        )}
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link href="/walkthrough"
            className="inline-flex items-center gap-2 rounded-md bg-ink px-5 py-3 text-[14px] font-semibold tracking-[0.04em] text-paper uppercase transition-opacity duration-150 hover:opacity-90">
            Start the walkthrough <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link href="/compare"
            className="inline-flex items-center gap-2 rounded-md border border-ink px-5 py-3 text-[14px] font-semibold tracking-[0.04em] text-ink uppercase transition-colors duration-150 hover:bg-paper-2">
            Compare the models
          </Link>
          <Link href="/examples"
            className="inline-flex items-center gap-2 rounded-md border border-ink px-5 py-3 text-[14px] font-semibold tracking-[0.04em] text-ink uppercase transition-colors duration-150 hover:bg-paper-2">
            Where the models disagree
          </Link>
          <Link href="/results#assistance"
            className="inline-flex items-center gap-2 rounded-md border border-ink px-5 py-3 text-[14px] font-semibold tracking-[0.04em] text-ink uppercase transition-colors duration-150 hover:bg-paper-2">
            Controlled-assistance results
          </Link>
        </div>
      </section>

      <section aria-labelledby="three-models" className="mx-auto max-w-[1240px] px-4 pb-16 sm:px-6 sm:pb-24">
        <h2 id="three-models" className="mb-6 font-serif text-[24px] font-semibold tracking-tight text-ink sm:text-[30px]">Three models, side by side</h2>
        <ThreeModelCards qwenOk={withLlm} />
      </section>

      <section aria-labelledby="philosophies" className="mx-auto max-w-[1240px] px-4 pb-16 sm:px-6 sm:pb-24">
        <h2 id="philosophies" className="mb-6 font-serif text-[24px] font-semibold tracking-tight text-ink sm:text-[30px]">
          {withLlm ? "From Statistical Modeling to LLM Scoring" : "From Statistical Modeling to Learned Human Models"}
        </h2>
        <ThreePhilosophies withLlm={withLlm} />
        <nav aria-label="Sections" className="mx-auto mt-10 flex max-w-[1040px] flex-wrap justify-center gap-x-6 gap-y-2 text-[13.5px]">
          <a href="#regan" className="text-ink-2 underline decoration-regan/50 underline-offset-4 hover:text-ink">1 · Statistical human-move modeling</a>
          {withLlm ? (
            <>
              <a href="#llm" className="text-ink-2 underline decoration-llm/50 underline-offset-4 hover:text-ink">2 · The LLM experiment</a>
              <a href="#maia" className="text-ink-2 underline decoration-human/50 underline-offset-4 hover:text-ink">3 · Chess-specific human model</a>
            </>
          ) : (
            <>
              <a href="#maia" className="text-ink-2 underline decoration-human/50 underline-offset-4 hover:text-ink">2 · Chess-specific human model</a>
              <a href="#llm" className="text-ink-2 underline decoration-llm/50 underline-offset-4 hover:text-ink">3 · Next: the LLM experiment</a>
            </>
          )}
        </nav>
      </section>

      <Band id="regan" model="R" n={1} badge="Regan — verified public method" title="Statistical Human-Move Modeling"
        sub="Professor Regan's public work models how humans of different skill levels choose among engine-evaluated chess moves.">
        <DataProvider value={{}}>{featured ? <Foundation f={featured} /> : <Missing />}</DataProvider>
      </Band>

      {withLlm ? (
        <>
          <Transition>Can a general-purpose LLM solve the same prediction problem?</Transition>
          <Band id="llm" model="Q" n={2} badge="MoveLens — LLM experiment" title="Can a General LLM Solve the Same Prediction Problem?"
            sub="Qwen3-8B-Base, a general-purpose language model, is turned into a legal-move probability model for the same decision.">
            {demo ? <QwenSection demo={demo} /> : <Missing />}
          </Band>
          <Transition>And what does a model built for human chess predict?</Transition>
          <Band id="maia" model="M" n={3} badge="Modern chess benchmark" title="What Does a Chess-Specific Human Model Predict?"
            sub="Maia-3, a Chessformer-based human chess transformer, is the domain-specific comparator.">
            {demo ? <MaiaSection demo={demo} /> : <Missing />}
          </Band>
        </>
      ) : (
        <>
          <Transition>What does the state-of-the-art model built for human chess predict?</Transition>
          <Band id="maia" model="M" n={2} badge="Modern chess benchmark" title="What Does a Chess-Specific Human Model Predict?"
            sub="Maia-3 79M, a Chessformer-based human chess transformer, is the strongest released human-move model and the comparator here.">
            {demo ? <MaiaSection demo={demo} /> : <Missing />}
          </Band>
          <Transition>Next: can a general-purpose LLM solve the same prediction problem?</Transition>
          <Band id="llm" model="Q" n={3} badge="MoveLens — next experiment" title="Next: Can a General LLM Solve the Same Prediction Problem?"
            sub="The LLM experiment is designed, implemented and tested on a small model; the held-out Qwen3-8B-Base run is pending (seven demo positions were scored locally; see the home page).">
            {demo ? <QwenSection demo={demo} /> : <Missing />}
          </Band>
        </>
      )}

      <section className="mx-auto max-w-[1240px] px-4 pt-20 sm:px-6">
        <div className="grid gap-4 md:grid-cols-2">
          <CardLink href="/results" title="Results: two questions"
            body="Who predicts genuine human moves best? Who best responds to controlled engine substitutions? Measured on the same held-out decisions, with paired source-game bootstrap intervals." />
          <CardLink href="/results#hybrid" title="Can the signals be combined?"
            body="The secondary extension: the existing hybrid experiment (Stockfish, Maia, sequence and statistical features in XGBoost), unchanged." />
        </div>
        <div className="mt-16"><IndependentPrototype /></div>
        <h2 id="limitations" className="mt-16 mb-4 scroll-mt-20 font-serif text-[24px] font-semibold tracking-tight text-ink sm:text-[30px]">Limitations</h2>
        <LimitationsPanel id="limitations-panel" />
        <Disclaimer className="mx-auto mt-10 max-w-[760px]" />
      </section>
    </main>
  );
}

function Band({ id, model, n, badge, title, sub, children }: { id: string; model: ModelKey; n: number; badge: string; title: string; sub: string; children: React.ReactNode }) {
  const color = MODEL_META[model].color;
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-14 border-t-[3px]" style={{ borderColor: color, background: MODEL_META[model].soft }}>
      <div className="mx-auto max-w-[1240px] px-4 pt-14 pb-16 sm:px-6 sm:pt-20 sm:pb-24">
        <SectionBadge model={model}>{badge}</SectionBadge>
        <div className="mt-5 flex items-start gap-4 sm:gap-6">
          <span aria-hidden className="num -mt-1 font-serif text-[56px] leading-none font-semibold sm:text-[84px]" style={{ color }}>{n}</span>
          <div className="min-w-0 max-w-3xl">
            <h2 id={`${id}-title`} className="font-serif text-[30px] leading-[1.08] font-semibold tracking-tight text-ink sm:text-[44px]">
              <span className="sr-only">{n}. </span>{title}
            </h2>
            <p className="mt-3 text-[16.5px] leading-relaxed text-ink-2 sm:text-[18px]">{sub}</p>
          </div>
        </div>
        <div className="mt-10 sm:mt-14">{children}</div>
      </div>
    </section>
  );
}

function CardLink({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="group rounded-lg border border-rule-strong bg-paper p-5 transition-colors hover:border-ink-3">
      <div className="flex items-center justify-between gap-3 font-serif text-[19px] font-semibold text-ink">
        {title} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </div>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{body}</p>
    </Link>
  );
}

function Missing() {
  return <p className="text-[13px] text-ink-3">The prepared study data could not be loaded.</p>;
}
