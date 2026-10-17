import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import { LatentSubNav } from "@/components/latent/shell";
import "./latent.css";

// Headings: a geometric grotesk that reads as engineered rather than bookish.
const display = Space_Grotesk({ variable: "--font-latent-display", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "LatentLens", template: "%s · LatentLens" },
  description: "LatentLens (Version 2 of MoveLens): the complete transformer, drawn and explained, measured on Qwen3-8B-Base. An interactive atlas, hands-on labs and the Recall Microscope.",
};

export const viewport: Viewport = { themeColor: "#06080d", colorScheme: "dark" };

export default function LatentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-latent-theme="deep" className={`${display.variable} flex flex-1 flex-col`}>
      <LatentSubNav />
      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 pt-10 pb-20 sm:px-6 sm:pt-12">{children}</main>
    </div>
  );
}
