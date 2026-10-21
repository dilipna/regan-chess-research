import type { Metadata } from "next";
import Link from "next/link";
import { LAB_LIST } from "@/lib/latent/security/labs";

export const metadata: Metadata = { title: "Security labs · Security Lab", description: "Local, simulated, deterministic labs with fixed synthetic fixtures." };

export default function LabsIndex() {
  return (
    <div className="grid gap-6">
      <header className="grid gap-2 border-b border-rule pb-6">
        <Link href="/latent/security" className="text-[13px] text-ink-3 underline underline-offset-2">← Security</Link>
        <h1 className="font-serif text-[36px] leading-tight font-semibold text-ink">Security labs</h1>
        <p className="max-w-3xl text-[16px] text-ink-2">Each lab follows the same twelve steps: system, trust boundary, assumption, fixed fixture, failure, root cause, impact, defense, retest, residual risk, framework mapping, and the LLM property behind it.</p>
        <p className="max-w-3xl text-[14px] text-ink-3">Everything runs locally in your browser against a rule-based teaching simulator. Fixtures are fixed and synthetic, data and secrets are fake, tools are mocks, and nothing is executed or sent anywhere.</p>
      </header>
      <ol className="grid gap-3 md:grid-cols-2">
        {LAB_LIST.map((l) => (
          <li key={l.slug}><Link href={`/latent/security/labs/${l.slug}`} className="ll-panel block h-full rounded-xl border border-rule bg-paper p-4 hover:border-ink-3">
            <span className="block text-[13px] font-semibold tracking-wide text-ink-3 uppercase">Lab {l.n}</span>
            <span className="block text-[17px] font-semibold text-ink">{l.title}</span>
            <span className="mt-1 block text-[14px] text-ink-2">{l.intro}</span>
          </Link></li>
        ))}
      </ol>
    </div>
  );
}
