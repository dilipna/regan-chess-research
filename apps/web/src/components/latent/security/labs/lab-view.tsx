"use client";

// Chooses the interactive part for a lab and wraps it in the generic twelve-step lesson frame.

import { labBySlug } from "@/lib/latent/security/labs";
import { hrefFor, topicBySlug } from "@/lib/latent/mastery";
import { LabLesson } from "../lab-lesson";
import { TrustBoundaryLab } from "./trust-boundary-lab";

const INTERACTIVE: Record<string, () => React.ReactNode> = {
  "trust-boundaries": () => <TrustBoundaryLab />,
};

export function LabView({ slug }: { slug: string }) {
  const lab = labBySlug(slug)!;
  return (
    <LabLesson title={`Lab ${lab.n}: ${lab.title}`} intro={lab.intro} text={lab.text}
      topicLinks={lab.text.topics.map((t) => ({ href: hrefFor(t), label: topicBySlug(t)?.title ?? t }))}>
      {INTERACTIVE[slug]?.()}
    </LabLesson>
  );
}
