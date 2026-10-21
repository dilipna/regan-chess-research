import type { Metadata } from "next";
import { LabsIndex } from "@/components/latent/labs/index";

export const metadata: Metadata = { title: "Labs" };

export default function LabsPage() {
  return <LabsIndex />;
}
