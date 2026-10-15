import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Nav } from "@/components/site/nav";
import { Footer } from "@/components/site/footer";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Chess-book typography: a classical Garamond for headings, IBM Plex for text and figures.
const body = IBM_Plex_Sans({ variable: "--font-body", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const mono = IBM_Plex_Mono({ variable: "--font-figures", subsets: ["latin"], weight: ["400", "500", "600"] });
const display = Cormorant_Garamond({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700"] });
const displayItalic = Cormorant_Garamond({ variable: "--font-display-italic", subsets: ["latin"], weight: ["500", "600"], style: "italic" });

export const metadata: Metadata = {
  metadataBase: new URL("https://chessassistlens.vercel.app"),
  alternates: { canonical: "./" },
  openGraph: {
    type: "website",
    siteName: "MoveLens",
    title: "MoveLens — Three ways to understand a chess move",
    description:
      "Statistics, language models, and human chess behavior on the same positions: a Regan-inspired statistical model, Qwen3-8B-Base and Maia-3 79M. Independent research prototype.",
  },
  robots: { index: true, follow: true },
  title: { default: "MoveLens — Three ways to understand a chess move", template: "%s · MoveLens" },
  description:
    "Statistics, language models, and human chess behavior on the same positions. An independent research prototype; its statistical model is reconstructed from publicly documented concepts and is not Professor Kenneth W. Regan's production analyzer.",
};

export const viewport: Viewport = {
  themeColor: "#f6f3ec",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${mono.variable} ${display.variable} ${displayItalic.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider delayDuration={150}>
          <Nav />
          {children}
          <Footer />
        </TooltipProvider>
      </body>
    </html>
  );
}
