import type { Metadata } from "next";
import Link from "next/link";
import { CurriculumPath } from "@/components/latent/mastery/curriculum-path";
import { CorePrinciples, FoundationsGlossary } from "@/components/latent/security/security-foundations";

export const metadata: Metadata = { title: "AI Security Lab", description: "Understand the system, find the broken assumptions, design the defense. AI security from foundations to red-team method." };

export default function SecurityHome() {
  return (
    <div className="grid gap-12">
      <header className="grid gap-3 border-b border-rule pb-8">
        <div className="text-[13px] font-semibold tracking-wide text-ink-3 uppercase">LatentLens · Security</div>
        <h1 className="font-serif text-[38px] leading-tight font-semibold text-ink sm:text-[48px]">Security begins with the system, not the prompt.</h1>
        <p className="max-w-3xl text-[18px] leading-relaxed text-ink-2">Understand the system, find the assumption that breaks, design the defense, and retest. Levels 7 to 10 of the curriculum, built on the mechanisms in <Link href="/latent/mastery" className="underline underline-offset-2">Mastery</Link> (levels 1, 4 and 5 are the prerequisites).</p>
      </header>

      <section aria-labelledby="found">
        <h2 id="found" className="mb-1 font-serif text-[28px] font-semibold text-ink">Foundations first</h2>
        <p className="mb-4 text-[15px] text-ink-2">The words a security engineer uses, each mapped to what it means in an LLM application.</p>
        <FoundationsGlossary />
      </section>

      <section aria-labelledby="princ">
        <h2 id="princ" className="mb-4 font-serif text-[28px] font-semibold text-ink">Two principles to keep</h2>
        <CorePrinciples />
      </section>

      <section aria-labelledby="path">
        <h2 id="path" className="mb-4 font-serif text-[28px] font-semibold text-ink">The path</h2>
        <CurriculumPath levels={[7, 8, 9, 10]} />
      </section>

      <section aria-labelledby="more" className="grid gap-3 sm:grid-cols-2">
        <h2 id="more" className="sr-only">More</h2>
        <Link href="/latent/security/frameworks" className="ll-panel rounded-xl border border-rule bg-paper p-4 hover:border-ink-3"><span className="block text-[16px] font-semibold text-ink">Frameworks</span><span className="mt-1 block text-[14px] text-ink-2">OWASP, NIST, MITRE ATLAS, SAIF and the MCP specification, with editions, verification dates and mapped topics.</span></Link>
        <Link href="/latent/mastery/request" className="ll-panel rounded-xl border border-rule bg-paper p-4 hover:border-ink-3"><span className="block text-[16px] font-semibold text-ink">Follow one request: security view</span><span className="mt-1 block text-[14px] text-ink-2">Every trust boundary in a real email-assistant request.</span></Link>
      </section>
    </div>
  );
}
