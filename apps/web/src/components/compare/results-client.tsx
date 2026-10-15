"use client";

import { ChevronDown } from "lucide-react";
import { ExperimentStory } from "@/components/story/experiment";
import { IndependentPrototype } from "@/components/story/independent";
import { ExpertEvidence } from "./expert-evidence";

export function ResultsClient() {
  return (
    <div>
      <ExperimentStory showLowFpr />
      <details className="group mt-20 border-t border-rule pt-8">
        <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink [&::-webkit-details-marker]:hidden">
          <div>
            <div className="eyebrow mb-1">For experts</div>
            <div className="font-serif text-[22px] font-semibold text-ink">Full experimental evidence</div>
            <div className="mt-1 text-[13px] text-ink-3">
              All paired differences, the full metric table (incl. z-only A0, PR-AUC, Brier, RMSE), ROC curves, strategy × level
              and Elo-band results, baseline calibration and tails, regression, SHAP, exploratory pseudo-events, further findings, and
              downloadable figures and CSV.
            </div>
          </div>
          <ChevronDown className="size-5 shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-180" aria-hidden />
        </summary>
        <ExpertEvidence />
      </details>
      <div className="mt-20">
        <IndependentPrototype />
      </div>
    </div>
  );
}
