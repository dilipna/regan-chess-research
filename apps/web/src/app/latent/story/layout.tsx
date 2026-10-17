import { Andika } from "next/font/google";
import "./story.css";

// Andika was designed by SIL for beginning readers (clear letter shapes such as a single-storey "a").
const andika = Andika({ variable: "--font-story", subsets: ["latin"], weight: ["400", "700"] });

export default function StoryLayout({ children }: { children: React.ReactNode }) {
  return <div data-story className={andika.variable}>{children}</div>;
}
