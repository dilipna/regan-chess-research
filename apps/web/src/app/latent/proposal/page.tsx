import type { Metadata } from "next";
import { Proposal } from "@/components/latent/proposal";
import { PROPOSAL_SUBTITLE, PROPOSAL_TITLE } from "@/lib/latent/proposal";

export const metadata: Metadata = { title: "Proposed approach", description: `${PROPOSAL_TITLE}. ${PROPOSAL_SUBTITLE}.` };

export default function ProposalPage() {
  return <Proposal />;
}
