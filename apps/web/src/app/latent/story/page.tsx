import type { Metadata } from "next";
import { StoryCover } from "@/components/latent/story/book";

export const metadata: Metadata = {
  title: "The LLM Storybook",
  description: "How a computer learns to talk, from a guessing game in 1948 to the models of 2026, in fourteen short read-aloud chapters with something to try in each.",
};

export default function StoryHome() {
  return <StoryCover />;
}
