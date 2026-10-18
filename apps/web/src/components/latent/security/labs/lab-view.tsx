"use client";

// Chooses the interactive part for a lab and wraps it in the generic twelve-step lesson frame.

import { labBySlug } from "@/lib/latent/security/labs";
import { hrefFor, topicBySlug } from "@/lib/latent/mastery";
import { MarkDone } from "../../progress/route-map";
import { LabLesson } from "../lab-lesson";
import { AgencyLab, InjectionLab, LeakLab, MemoryLab } from "./agent-labs";
import { ConsumptionLab, EvalLab, OutputLab, RagLab, WebBasicsLab } from "./system-labs";
import { TrustBoundaryLab } from "./trust-boundary-lab";

const INTERACTIVE: Record<string, () => React.ReactNode> = {
  "trust-boundaries": () => <TrustBoundaryLab />,
  "web-basics": () => <WebBasicsLab />,
  "prompt-injection": () => <InjectionLab />,
  secrets: () => <LeakLab />,
  "excessive-agency": () => <AgencyLab />,
  "memory-poisoning": () => <MemoryLab />,
  rag: () => <RagLab />,
  "output-handling": () => <OutputLab />,
  consumption: () => <ConsumptionLab />,
  evals: () => <EvalLab />,
};

export function LabView({ slug }: { slug: string }) {
  const lab = labBySlug(slug)!;
  return (
    <LabLesson title={`Lab ${lab.n}: ${lab.title}`} intro={lab.intro} text={lab.text}
      topicLinks={lab.text.topics.map((t) => ({ href: hrefFor(t), label: topicBySlug(t)?.title ?? t }))}>
      {INTERACTIVE[slug]?.()}
      <div className="mt-6 border-t border-rule pt-4"><MarkDone id={`l:${slug}`} label="I finished this lab: mark it done" /></div>
    </LabLesson>
  );
}
