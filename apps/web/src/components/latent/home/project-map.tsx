// The /latent home: a map of the whole project, not a landing page.

import Link from "next/link";

const PATHS = [
  { href: "/latent/story", name: "Storybook", tag: "Build intuition", learn: "Fourteen short read-aloud chapters: next-word guessing, tokens, attention, training, agents, safety, history to 2026.", assumes: "Nothing.", why: "A picture to hang every later mechanism on." },
  { href: "/latent/mastery", name: "Mastery", tag: "Understand the real mechanism", learn: "30 topics across six levels: the Qwen3-8B transformer, training and post-training, inference and serving, RAG, agents and MCP, interpretability.", assumes: "Basic algebra and some Python; the Storybook helps.", why: "Lets you trace one token, one training step and one request without hand-waving." },
  { href: "/latent/security", name: "Security", tag: "Trust boundaries, failure modes, defenses", learn: "17 topics from assets and trust boundaries to prompt injection, poisoning, agent risks and red-team method, plus local synthetic labs.", assumes: "Mastery levels 1, 4 and 5.", why: "Once a model reads untrusted text and can act, security is a design property of the whole system." },
  { href: "/latent/research", name: "Research", tag: "Investigate model internals", learn: "Hidden states by layer, RMSNorm, linear probes, the Recall Microscope, and the human-vs-AI question.", assumes: "Mastery levels 1 and 6.", why: "Moves from what the model outputs to where inside it a signal becomes accessible." },
];
const STAGES = ["Intuition", "Mechanism", "System", "Security", "Research"];

export function ProjectMap() {
  return (
    <section aria-labelledby="pm-title" className="grid gap-8 border-b border-rule pb-12">
      <header className="grid gap-3">
        <div className="text-[13px] font-semibold tracking-wide text-ink-3 uppercase">LatentLens · Version 2 of MoveLens</div>
        <h1 id="pm-title" className="font-serif text-[38px] leading-[1.08] font-semibold text-ink sm:text-[52px]">Understand modern AI from the inside out.</h1>
        <ol className="flex flex-wrap items-center gap-1.5 text-[14px]" aria-label="Progression">
          {STAGES.map((s, i) => <li key={s} className="flex items-center gap-1.5"><span className="rounded-full border border-rule-strong bg-paper px-3 py-1 text-ink">{s}</span>{i < STAGES.length - 1 && <span aria-hidden className="text-ink-4">→</span>}</li>)}
        </ol>
      </header>
      <ol className="grid gap-4 md:grid-cols-2">
        {PATHS.map((p, i) => (
          <li key={p.href}>
            <Link href={p.href} className="ll-panel flex h-full flex-col gap-2 rounded-2xl border border-rule bg-paper p-5 hover:border-ink-3">
              <span className="flex items-baseline gap-2"><span className="num font-serif text-[26px] text-ink-4">{i + 1}</span><span className="font-serif text-[24px] font-semibold text-ink">{p.name}</span><span className="text-[14px] text-ink-3">{p.tag}</span></span>
              <span className="text-[15px] leading-relaxed text-ink-2"><strong className="text-ink">You learn: </strong>{p.learn}</span>
              <span className="text-[14px] text-ink-2"><strong className="text-ink">Assumes: </strong>{p.assumes}</span>
              <span className="text-[14px] text-ink-2"><strong className="text-ink">Why it matters: </strong>{p.why}</span>
            </Link>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-rule bg-paper-2/60 p-4">
        <span className="text-[15px] text-ink-2"><strong className="text-ink">Professor mode:</strong> a concise technical walkthrough of Qwen3-8B internals, normalization, latent states and the Recall Microscope.</span>
        <Link href="/latent/professor" className="ml-auto rounded-lg bg-ink px-4 py-2 text-[14.5px] font-medium text-paper">Open professor mode →</Link>
        <Link href="/latent/review" className="rounded-lg border border-rule-strong px-4 py-2 text-[14.5px] text-ink">Daily review</Link>
      </div>
    </section>
  );
}
