"use client";

import Link from "next/link";
import { useProgress } from "@/lib/latent/journey";
import { LABS } from "@/lib/latent/labs";

export function LabsIndex() {
  const progress = useProgress();
  return (
    <div>
      <h1 className="font-serif text-[34px] leading-tight font-semibold text-ink sm:text-[42px]">Labs</h1>
      <p className="mt-2 max-w-3xl text-[17px] text-ink-2">Six focused experiments built from the same components as the journey. Each one starts from a question, lets you change one thing, and shows the exact numbers.</p>
      <ol className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {LABS.map((l, i) => (
          <li key={l.slug}>
            <Link href={`/latent/labs/${l.slug}`} className="ll-panel flex h-full flex-col rounded-2xl border border-rule bg-paper p-5 hover:border-ink-3">
              <span className="text-[12.5px] font-semibold tracking-wide text-ink-3 uppercase">Lab {String.fromCharCode(65 + i)}{progress[`lab:${l.slug}`] ? " · opened ✓" : ""}</span>
              <span className="mt-1 font-serif text-[22px] font-semibold text-ink">{l.title}</span>
              <span className="mt-2 text-[15px] text-ink-2">{l.question}</span>
              <span className="mt-auto pt-4 text-[14px] font-medium text-ink">Open the lab →</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
