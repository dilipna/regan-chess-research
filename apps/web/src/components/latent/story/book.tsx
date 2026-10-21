"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CHAPTERS, PARTS, type Chapter } from "@/lib/latent/story";
import { STORY_TO_MASTERY, hrefFor, topicBySlug } from "@/lib/latent/mastery";
import { Prov, type ProvKind } from "../kit";
import { Burst, Narrated, Pip, ReadAloud, Say, earnSticker, resetStickers, useStickers, useStopOnLeave, type Mood } from "./core";

const MOODS: Mood[] = ["happy", "think", "wow", "happy", "think", "wow", "think", "wow", "happy", "cheer", "think", "cheer", "think", "cheer"];

export function ChapterShell({ ch, prov, provDetail, children }: {
  ch: Chapter; prov: ProvKind | ProvKind[]; provDetail?: string; children: (done: () => void) => React.ReactNode;
}) {
  useStopOnLeave();
  const stickers = useStickers();
  const have = stickers.includes(ch.slug);
  const [justEarned, setJustEarned] = useState(false);
  const done = () => { if (!stickers.includes(ch.slug)) { earnSticker(ch.slug); setJustEarned(true); } };
  const prev = CHAPTERS[ch.n - 2], next = CHAPTERS[ch.n];
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [role=slider], [contenteditable]")) return;
      if (e.altKey && e.key === "ArrowRight" && next) router.push(`/latent/story/${next.slug}`);
      if (e.altKey && e.key === "ArrowLeft" && prev) router.push(`/latent/story/${prev.slug}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, router]);

  return (
    <article className="grid grid-cols-[minmax(0,1fr)] gap-8" aria-labelledby="chapter-title">
      <ChapterPath current={ch.n} stickers={stickers} />

      <header className="story-hero grid items-center gap-6 rounded-[28px] border-2 border-rule bg-paper p-5 sm:grid-cols-[auto_1fr] sm:p-8">
        <div className="flex justify-center"><Pip mood={MOODS[ch.n - 1]} size={150} wave={ch.n === 1} /></div>
        <div className="min-w-0">
          <div className="text-[15px] font-bold tracking-wide text-ink-3 uppercase">Chapter {ch.n} of {CHAPTERS.length} · {PARTS[ch.part]}</div>
          <h1 id="chapter-title" className="story-title mt-1 text-[36px] leading-[1.1] font-bold text-ink sm:text-[48px]"><span aria-hidden>{ch.emoji} </span>{ch.title}</h1>
          <ReadAloud id={`story-${ch.slug}`} sentences={[ch.title + ".", ...ch.story]} className="mt-4" />
        </div>
        <Narrated id={`story-${ch.slug}`} sentences={["", ...ch.story]} className="sm:col-span-2 [&>p:first-child]:hidden" />
      </header>

      <section aria-labelledby="your-turn" className="story-card rounded-[28px] border-2 border-[var(--role-resid)] bg-paper p-4 sm:p-7">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 id="your-turn" className="story-title text-[28px] font-bold text-[var(--role-resid-ink)]">Your turn</h2>
          <Say id={`do-${ch.slug}`} text={ch.doIt} />
          <p className="min-w-0 flex-1 text-[19px] text-ink">{ch.doIt}</p>
          <span className="flex flex-wrap gap-1.5">{(Array.isArray(prov) ? prov : [prov]).map((k) => <Prov key={k} kind={k} detail={provDetail} />)}
            {Array.isArray(prov) && !prov.length && provDetail && <span className="rounded-2xl border border-rule-strong px-2.5 py-0.5 text-[12px] font-medium text-ink-2"><span aria-hidden>📎</span> {provDetail}</span>}</span>
        </div>
        {children(done)}
      </section>

      <section className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[minmax(0,1fr)_auto]" aria-label="What you learned">
        <div className="rounded-[24px] bg-[var(--role-norm-soft)] p-5">
          <div className="text-[14px] font-bold tracking-wide text-[var(--role-norm-ink)] uppercase">What you learned</div>
          <p className="story-text mt-1 text-ink">{ch.learned}</p>
        </div>
        <div className={cn("relative flex min-w-0 items-center gap-3 sm:min-w-[220px] rounded-[24px] border-2 p-4", have ? "border-[var(--role-mlp)] bg-[var(--role-mlp-soft)]" : "border-dashed border-rule-strong bg-paper")} aria-live="polite">
          {justEarned && <Burst />}
          <span aria-hidden className={cn("text-[44px]", have ? "story-sticker" : "opacity-25 grayscale")}>{ch.sticker.emoji}</span>
          <span className="text-[16px] text-ink">{have ? <><strong>Sticker earned!</strong><br />{ch.sticker.name}</> : <>Finish &quot;Your turn&quot; to earn the <strong>{ch.sticker.name}</strong> sticker.</>}</span>
        </div>
      </section>

      {(STORY_TO_MASTERY[ch.slug] ?? []).length > 0 && (
        <aside aria-label="Go deeper" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[20px] border-2 border-ink bg-paper px-4 py-3">
          <span className="text-[16px] font-bold text-ink">Ready for the real mechanism?</span>
          {STORY_TO_MASTERY[ch.slug].map((s) => <Link key={s} href={hrefFor(s)} className="text-[16px] text-[var(--role-resid-ink)] underline underline-offset-2">See the real mechanism: {topicBySlug(s)?.title} →</Link>)}
        </aside>
      )}

      <details className="story-grown rounded-[20px] border border-rule bg-paper-2/60 p-4 sm:p-5">
        <summary className="cursor-pointer text-[16px] font-semibold text-ink"><span aria-hidden>🧑‍🏫 </span>Grown-up corner: the precise version</summary>
        <div className="mt-3 grid gap-3 text-[15px] leading-relaxed text-ink-2">
          {ch.words && (
            <ul className="flex flex-wrap gap-2" aria-label="Storybook words and their real names">
              {ch.words.map(([k, r]) => <li key={k} className="rounded-full border border-rule-strong bg-paper px-3 py-1 text-[13.5px]"><strong className="text-ink">{k}</strong> = {r}</li>)}
            </ul>
          )}
          {ch.grown.map((g) => <p key={g}>{g}</p>)}
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {ch.links.map((l) => <li key={l.href}><Link href={l.href} className="font-medium text-[var(--role-resid-ink)] underline underline-offset-2">{l.label} →</Link></li>)}
          </ul>
        </div>
      </details>

      <nav aria-label="Chapters" className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-6">
        {prev ? <Link href={`/latent/story/${prev.slug}`} className="story-btn inline-flex min-h-12 items-center rounded-2xl border-2 border-rule-strong px-5 text-[17px] text-ink">← {prev.n}. {prev.title}</Link> : <Link href="/latent/story" className="story-btn inline-flex min-h-12 items-center rounded-2xl border-2 border-rule-strong px-5 text-[17px] text-ink">← Book cover</Link>}
        {next ? <Link href={`/latent/story/${next.slug}`} className="story-btn inline-flex min-h-12 items-center rounded-2xl bg-ink px-6 text-[18px] font-bold text-paper">{next.n}. {next.title} →</Link>
          : <Link href="/latent/journey" className="story-btn inline-flex min-h-12 items-center rounded-2xl bg-ink px-6 text-[18px] font-bold text-paper">Grown-up journey: inside Qwen3-8B →</Link>}
      </nav>
    </article>
  );
}

/** The fourteen stops, as a path. */
export function ChapterPath({ current, stickers }: { current?: number; stickers: string[] }) {
  return (
    <nav aria-label="Storybook chapters" className="no-scrollbar -mx-4 overflow-x-auto px-4">
      <ol className="flex min-w-max items-center gap-1.5 py-1">
        <li><Link href="/latent/story" className="story-btn mr-1 inline-flex h-10 items-center rounded-full border-2 border-rule-strong bg-paper px-3 text-[14px] font-semibold text-ink">📖 Cover</Link></li>
        {CHAPTERS.map((c, i) => {
          const got = stickers.includes(c.slug), here = c.n === current;
          return (
            <li key={c.slug} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden className={cn("h-1 w-3 rounded-full", CHAPTERS[i - 1] && stickers.includes(CHAPTERS[i - 1].slug) ? "bg-[var(--role-mlp)]" : "bg-rule-strong")} />}
              <Link href={`/latent/story/${c.slug}`} aria-current={here ? "page" : undefined} title={`${c.n}. ${c.title}`}
                aria-label={`Chapter ${c.n}: ${c.title}${got ? ", sticker earned" : ""}`}
                className={cn("story-btn flex h-10 w-10 items-center justify-center rounded-full border-2 text-[19px]",
                  here ? "border-ink bg-ink text-paper" : got ? "border-[var(--role-mlp)] bg-[var(--role-mlp-soft)]" : "border-rule-strong bg-paper")}>
                <span aria-hidden>{got || here ? c.emoji : c.n}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function StoryCover() {
  useStopOnLeave();
  const stickers = useStickers();
  const nextUp = CHAPTERS.find((c) => !stickers.includes(c.slug)) ?? CHAPTERS[0];
  const intro = [
    "Hello! I am Pip.",
    "Have you ever wondered how a computer can talk, write stories, or answer questions?",
    "In this book we will find out together, from the very first idea to the newest models of today.",
    "There are fourteen short chapters. In every chapter you can listen, tap, and play.",
    "Let's go!",
  ];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-12">
      <header className="story-hero relative grid items-center gap-8 overflow-hidden rounded-[32px] border-2 border-rule bg-paper p-6 sm:p-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0">
          <div className="text-[15px] font-bold tracking-wide text-ink-3 uppercase">LatentLens · for young learners and curious grown-ups</div>
          <h1 className="story-title mt-2 text-[44px] leading-[1.05] font-bold text-ink sm:text-[64px]">The LLM Storybook</h1>
          <p className="mt-3 text-[22px] leading-snug text-ink-2">How does a computer learn to talk? From a guessing game in 1948 to the models of 2026.</p>
          <ReadAloud id="story-cover" sentences={intro} label="Listen to Pip" className="mt-6" />
          <Narrated id="story-cover" sentences={intro} className="mt-5" />
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href={`/latent/story/${nextUp.slug}`} className="story-btn inline-flex min-h-14 items-center rounded-2xl bg-ink px-7 text-[21px] font-bold text-paper">
              {stickers.length ? `Keep going: ${nextUp.n}. ${nextUp.title}` : "Start the story"} →
            </Link>
          </div>
        </div>
        <div className="flex flex-col items-center gap-3">
          <Pip mood="cheer" size={220} wave />
          <StickerShelf stickers={stickers} />
        </div>
      </header>

      <section aria-labelledby="map-title">
        <h2 id="map-title" className="story-title text-[32px] font-bold text-ink">The map</h2>
        <ol className="mt-5 grid gap-5 lg:grid-cols-5">
          {PARTS.map((p, pi) => (
            <li key={p} className="story-card rounded-[24px] border-2 border-rule bg-paper p-4">
              <div className="text-[13px] font-bold tracking-wide text-ink-3 uppercase">Part {pi + 1}</div>
              <h3 className="story-title text-[22px] font-bold text-ink">{p}</h3>
              <ol className="mt-3 grid gap-2">
                {CHAPTERS.filter((c) => c.part === pi).map((c) => (
                  <li key={c.slug}>
                    <Link href={`/latent/story/${c.slug}`} className={cn("story-btn flex min-h-12 items-center gap-3 rounded-2xl border-2 px-3 py-2 text-[17px] text-ink", stickers.includes(c.slug) ? "border-[var(--role-mlp)] bg-[var(--role-mlp-soft)]" : "border-rule bg-paper-2/40")}>
                      <span aria-hidden className="text-[26px]">{c.emoji}</span>
                      <span className="min-w-0"><span className="num text-ink-3">{c.n}.</span> {c.title}{stickers.includes(c.slug) && <span className="sr-only"> (sticker earned)</span>}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 rounded-[24px] border border-rule bg-paper-2/60 p-5 text-[15.5px] leading-relaxed text-ink-2 lg:grid-cols-3" aria-labelledby="grownups">
        <div>
          <h2 id="grownups" className="text-[18px] font-bold text-ink">For grown-ups</h2>
          <p className="mt-1">Each chapter has a short story to read aloud, one thing to try, and a &quot;Grown-up corner&quot; with the precise version and links into the full LatentLens journey, labs and Glass Box.</p>
        </div>
        <div>
          <h3 className="font-bold text-ink">What is real here</h3>
          <p className="mt-1">Activities are labelled. <Prov kind="toy" /> means a small calculation in your browser. <Prov kind="recorded" /> means numbers recorded from the real Qwen3-8B-Base. Facts about other models link to their sources.</p>
        </div>
        <div>
          <h3 className="font-bold text-ink">Not yet tested with children</h3>
          <p className="mt-1">The book is written for young learners with a grown-up nearby, but it has not been tried with a group of children yet. Stickers and settings stay in this browser only.
            {stickers.length > 0 && <> <button type="button" onClick={resetStickers} className="underline underline-offset-2">Clear stickers</button>.</>}</p>
        </div>
      </section>
    </div>
  );
}

export function StickerShelf({ stickers }: { stickers: string[] }) {
  return (
    <div className="rounded-[20px] border-2 border-dashed border-rule-strong bg-paper-2/50 p-3" aria-label={`Sticker shelf: ${stickers.length} of ${CHAPTERS.length} stickers`}>
      <div className="mb-1 text-center text-[13px] font-bold tracking-wide text-ink-3 uppercase">My stickers · {stickers.length} / {CHAPTERS.length}</div>
      <ul className="grid grid-cols-7 gap-1.5">
        {CHAPTERS.map((c) => (
          <li key={c.slug} title={stickers.includes(c.slug) ? c.sticker.name : `Chapter ${c.n}`} className={cn("flex h-9 w-9 items-center justify-center rounded-full text-[20px]", stickers.includes(c.slug) ? "bg-[var(--role-mlp-soft)]" : "bg-paper")}>
            <span aria-hidden className={stickers.includes(c.slug) ? "" : "opacity-20 grayscale"}>{c.sticker.emoji}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
