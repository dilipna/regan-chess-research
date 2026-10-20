import type { Metadata, Viewport } from "next";
import "./latent.css";

export const metadata: Metadata = {
  title: { default: "LatentLens", template: "%s · LatentLens" },
  description: "LatentLens (Version 2 of MoveLens): the complete transformer, drawn and explained, measured on Qwen3-8B-Base. An interactive atlas, hands-on labs and the Recall Microscope.",
};

export const viewport: Viewport = { themeColor: "#0a0a0a", colorScheme: "dark" };

export default function LatentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-latent-theme="deep" className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 pt-10 pb-20 sm:px-6 sm:pt-12">{children}</main>
    </div>
  );
}
