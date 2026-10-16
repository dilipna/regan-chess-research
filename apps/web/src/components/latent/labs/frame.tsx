"use client";

import Link from "next/link";
import { useEffect } from "react";
import { markProgress } from "@/lib/latent/journey";

export { LABS } from "@/lib/latent/labs";
import { LABS } from "@/lib/latent/labs";

export function LabFrame({ slug, children, intro }: { slug: string; children: React.ReactNode; intro: React.ReactNode }) {
  const lab = LABS.find((l) => l.slug === slug)!;
  useEffect(() => { markProgress(`lab:${slug}`); }, [slug]);
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule pb-5">
        <div>
          <Link href="/latent/labs" className="text-[13px] text-ink-3 underline underline-offset-2 hover:text-ink">← All labs</Link>
          <h1 className="mt-2 font-serif text-[32px] leading-tight font-semibold text-ink sm:text-[40px]">{lab.title}</h1>
          <p className="mt-1 text-[19px] text-ink-2">{lab.question}</p>
        </div>
        <Link href={`/latent/journey?s=${lab.scene}`} className="rounded-lg border-2 border-rule-strong px-3 py-1.5 text-[14px] text-ink hover:border-ink-3">Back to journey scene {lab.scene}</Link>
      </div>
      <div className="mt-5 max-w-3xl text-[16px] leading-relaxed text-ink-2">{intro}</div>
      <div className="mt-7 grid gap-6">{children}</div>
    </div>
  );
}

export function Panel({ title, badge, children, className = "" }: { title?: string; badge?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`ll-panel min-w-0 rounded-2xl border border-rule bg-paper p-5 sm:p-6 ${className}`}>
      {(title || badge) && <div className="mb-4 flex flex-wrap items-center justify-between gap-2">{title && <h2 className="text-[17px] font-semibold text-ink">{title}</h2>}{badge}</div>}
      {children}
    </section>
  );
}
