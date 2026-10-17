import type { Metadata } from "next";
import Link from "next/link";
import { CurriculumPath } from "@/components/latent/mastery/curriculum-path";
import { KnowledgeMap } from "@/components/latent/mastery/knowledge-map";

export const metadata: Metadata = { title: "LLM Mastery", description: "From one token to a production AI system: a rigorous curriculum traced through Qwen3-8B." };

const TOOLS = [
  { href: "/latent/review", t: "10-minute daily review", d: "Ten questions chosen from what you missed or have not reviewed lately." },
  { href: "/latent/mastery/confusions", t: "I keep confusing these", d: "31 side-by-side pairs, from token vs embedding to MCP client vs server." },
  { href: "/latent/mastery/request", t: "Follow one request end to end", d: "One email-assistant request through the UI, the model and every trust boundary." },
  { href: "/latent/mastery/interview", t: "Interview questions", d: "Six levels: explain, trace, compare, debug, threat-model, design." },
  { href: "/latent/mastery/final", t: "Final mastery test", d: "Ten free-response parts, from drawing the model to Professor Regan's research question." },
];

export default function MasteryHome() {
  return (
    <div className="grid gap-12">
      <header className="grid gap-3 border-b border-rule pb-8">
        <div className="text-[13px] font-semibold tracking-wide text-ink-3 uppercase">LatentLens · Mastery</div>
        <h1 className="font-serif text-[38px] leading-tight font-semibold text-ink sm:text-[48px]">LLM Mastery</h1>
        <p className="max-w-3xl text-[18px] leading-relaxed text-ink-2">From one token to a production AI system. Every topic answers the same ten questions and follows the same A to M format, using the real Qwen3-8B-Base architecture wherever a fact can be verified.</p>
        <p className="text-[14px] text-ink-3">New to all of this? Start with the <Link href="/latent/story" className="underline underline-offset-2">Storybook</Link> (level 0) for intuition. Progress is stored only in this browser.</p>
      </header>

      <section aria-labelledby="path">
        <h2 id="path" className="mb-4 font-serif text-[28px] font-semibold text-ink">The path</h2>
        <CurriculumPath levels={[0, 1, 2, 3, 4, 5, 6]} />
        <p className="mt-3 text-[14px] text-ink-3">Levels 7 to 10 continue in the <Link href="/latent/security" className="underline underline-offset-2">Security Lab</Link>; level 11 is the <Link href="/latent/research" className="underline underline-offset-2">research workspace</Link>.</p>
      </section>

      <section aria-labelledby="tools">
        <h2 id="tools" className="mb-4 font-serif text-[28px] font-semibold text-ink">Practice</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((x) => <li key={x.href}><Link href={x.href} className="ll-panel block h-full rounded-xl border border-rule bg-paper p-4 hover:border-ink-3"><span className="block text-[16px] font-semibold text-ink">{x.t}</span><span className="mt-1 block text-[14px] text-ink-2">{x.d}</span></Link></li>)}
        </ul>
      </section>

      <section aria-labelledby="map">
        <h2 id="map" className="mb-1 font-serif text-[28px] font-semibold text-ink">How it all connects</h2>
        <p className="mb-4 text-[15px] text-ink-2">Five lanes of one system. Pick any step to see where it sits and what it touches in the other lanes.</p>
        <KnowledgeMap />
      </section>
    </div>
  );
}
