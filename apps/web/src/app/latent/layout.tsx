import type { Metadata, Viewport } from "next";
import { LatentSubNav } from "@/components/latent/shell";
import "./latent.css";

export const metadata: Metadata = {
  title: { default: "LatentLens", template: "%s · LatentLens" },
  description: "LatentLens (Version 2 of MoveLens): tracing human and machine writing through the transformer layers of Qwen3-8B-Base. Learn Mode, Research Mode and the Recall Microscope.",
};

export const viewport: Viewport = { themeColor: "#fbf8f2", colorScheme: "light" };

export default function LatentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-latent-theme="museum" className="flex flex-1 flex-col">
      <LatentSubNav />
      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 pt-10 pb-20 sm:px-6 sm:pt-12">{children}</main>
    </div>
  );
}
