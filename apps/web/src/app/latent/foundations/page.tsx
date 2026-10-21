import type { Metadata } from "next";
import { FoundationsIndex } from "@/components/latent/foundations/pages";

export const metadata: Metadata = { title: "Foundations", description: "Level 0: vectors, matrices, softmax, loss, gradients, backprop, neural networks, next-token prediction and why attention exists, each with an interactive widget." };

export default function FoundationsHome() {
  return <FoundationsIndex />;
}
