import type { Metadata } from "next";
import Link from "next/link";
import { FrameworkMap } from "@/components/latent/security/framework-map";

export const metadata: Metadata = { title: "AI security frameworks · Security Lab" };

export default function FrameworksPage() {
  return (
    <div className="grid gap-6">
      <header className="grid gap-2 border-b border-rule pb-6">
        <Link href="/latent/security" className="text-[13px] text-ink-3 underline underline-offset-2">← Security</Link>
        <h1 className="font-serif text-[36px] leading-tight font-semibold text-ink">Frameworks</h1>
        <p className="max-w-3xl text-[16px] text-ink-2">No single framework is the whole field. Use them as shared vocabulary and as coverage checklists for threat models and red-team plans.</p>
      </header>
      <FrameworkMap />
    </div>
  );
}
