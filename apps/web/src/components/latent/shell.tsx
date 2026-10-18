"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";
import type { Part } from "@/lib/latent/parts";
import type { Pending } from "@/lib/latent/types";
import { Prov } from "./kit";

// Four destinations up front; everything else lives in one grouped "More" menu.
const PRIMARY = [
  { href: "/latent", label: "Atlas" },
  { href: "/latent/foundations", label: "Foundations" },
  { href: "/latent/build", label: "Build" },
  { href: "/latent/labs", label: "Labs" },
];
const MORE: { group: string; links: { href: string; label: string }[] }[] = [
  { group: "Learn", links: [
    { href: "/latent/progress", label: "Your route" },
    { href: "/latent/mastery", label: "Mastery path" },
    { href: "/latent/story", label: "Storybook" },
    { href: "/latent/journey", label: "Guided journey" },
    { href: "/latent/glassbox", label: "Glass Box" },
    { href: "/latent/learn", label: "Reference notes" },
    { href: "/latent/review", label: "Daily review" },
  ] },
  { group: "Practice", links: [
    { href: "/latent/security", label: "AI security" },
    { href: "/latent/security/labs", label: "Security labs" },
    { href: "/latent/play", label: "You vs Qwen" },
    { href: "/latent/demo", label: "5-step demo" },
    { href: "/latent/professor", label: "Professor mode" },
  ] },
  { group: "Evidence", links: [
    { href: "/latent/research", label: "Research" },
    { href: "/latent/recall", label: "Recall Microscope" },
    { href: "/latent/methods", label: "Methods" },
    { href: "/latent/project", label: "Project overview" },
    { href: "/", label: "MoveLens (Version 1)" },
  ] },
];

function LensGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden className="shrink-0">
      <circle cx="12" cy="12" r="9" fill="none" stroke="var(--role-resid)" strokeWidth="1.6" opacity="0.9" />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="var(--role-attn)" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="1.3" fill="var(--ink)" />
    </svg>
  );
}

export function LatentSubNav() {
  const path = usePathname();
  const isActive = (href: string) => (href === "/latent" ? path === href : path.startsWith(href));
  const moreActive = MORE.some((g) => g.links.some((l) => l.href !== "/" && isActive(l.href)));
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-[#06080d]/80 backdrop-blur-md supports-[backdrop-filter]:bg-[#06080d]/65">
      <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-4 px-4 sm:px-6">
        <Link href="/latent" className="flex shrink-0 items-center gap-2 text-ink">
          <LensGlyph />
          <span className="font-serif text-[16px] font-semibold">LatentLens</span>
        </Link>
        <nav aria-label="LatentLens" className="flex min-w-0 flex-1 items-center justify-end gap-0.5 sm:gap-1">
          <div className="no-scrollbar flex min-w-0 items-center gap-0.5 overflow-x-auto sm:gap-1">
            {PRIMARY.map((l, i) => (
              <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? "page" : undefined}
                className={cn("shrink-0 rounded-full px-3 py-1.5 text-[13px] whitespace-nowrap text-ink-3 transition-colors hover:text-ink",
                  i > 0 && "max-sm:hidden", isActive(l.href) && "bg-paper-3 text-ink")}>
                {l.label}
              </Link>
            ))}
          </div>
          <MoreMenu active={moreActive} isActive={isActive} />
        </nav>
      </div>
    </header>
  );
}

function MoreMenu({ active, isActive }: { active: boolean; isActive: (href: string) => boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const path = usePathname();
  // close on navigation and on Escape
  const [at, setAt] = useState(path);
  if (at !== path) { setAt(path); setOpen(false); }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className="relative shrink-0">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}
        className={cn("flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] text-ink-3 transition-colors hover:text-ink", (open || active) && "bg-paper-3 text-ink")}>
        More
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden className={cn("transition-transform", open && "rotate-180")}><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
      </button>
      {open && (
        <>
          <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div id={id} className="atlas-fade absolute right-0 z-50 mt-2 grid max-h-[80vh] w-[min(92vw,560px)] gap-5 overflow-y-auto rounded-2xl border border-rule-strong bg-paper-2 p-5 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.9)] sm:grid-cols-3">
            {[{ group: "Main", links: PRIMARY.slice(1) }, ...MORE].map((g) => (
              <div key={g.group} className={cn(g.group === "Main" && "sm:hidden")}>
                <div className="mb-2 text-[11px] font-medium tracking-[0.12em] text-ink-4 uppercase">{g.group}</div>
                <ul className="grid gap-0.5">
                  {g.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} aria-current={l.href !== "/" && isActive(l.href) ? "page" : undefined}
                        className={cn("block rounded-lg px-2 py-1.5 text-[13.5px] text-ink-2 hover:bg-paper-3 hover:text-ink", l.href !== "/" && isActive(l.href) && "text-ink")}>
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function SectionHead({ n, kicker, title, children, id }: { n?: number | string; kicker?: string; title: string; children?: React.ReactNode; id?: string }) {
  return (
    <header id={id} className="mb-6 scroll-mt-28">
      {(kicker || n !== undefined) && (
        <div className="eyebrow mb-2 flex items-center gap-2">
          {n !== undefined && <span className="num inline-flex h-5 min-w-5 items-center justify-center rounded-[3px] bg-ink px-1 text-[10.5px] text-paper">{n}</span>}
          {kicker}
        </div>
      )}
      <h2 className="font-serif text-[26px] leading-tight font-semibold tracking-tight text-ink sm:text-[30px]">{title}</h2>
      {children && <div className="mt-3 max-w-3xl text-[15px] leading-relaxed text-ink-2">{children}</div>}
    </header>
  );
}

// The older pages use these names; they now render the four standard provenance labels.
export function Toy({ children }: { children?: React.ReactNode }) {
  return <Prov kind="toy" detail={typeof children === "string" && children !== "Toy example" ? children : undefined} />;
}

export function Measured({ children }: { children?: React.ReactNode }) {
  return <Prov kind="recorded" detail={typeof children === "string" && children !== "Measured on Qwen3-8B-Base" ? children : undefined} />;
}

export function Verified({ children }: { children?: React.ReactNode }) {
  return <Prov kind="recorded" detail={typeof children === "string" && children !== "Verified from the checkpoint" ? children : "verified from the checkpoint"} />;
}

export function Shape({ children }: { children: React.ReactNode }) {
  return <code className="rounded-[3px] border border-rule bg-paper-2 px-1.5 py-[1px] font-mono text-[12px] text-ink">{children}</code>;
}

/** Equation set in mono with a plain-text reading for screen readers. */
export function Eq({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div role="math" aria-label={label ?? (typeof children === "string" ? children : undefined)}
      className="scroll-x my-3 rounded-md border border-rule bg-paper-2/70 px-4 py-3 font-mono text-[13.5px] leading-relaxed text-ink">
      {children}
    </div>
  );
}

export function FiveIdeas({ part, compact }: { part: Part; compact?: boolean }) {
  const rows: [string, React.ReactNode][] = [
    ["Intuition", part.intuition],
    ["Exact mechanism", <>{part.mechanism}{part.equation && <Eq>{part.equation}</Eq>}</>],
    ["Tensor shapes", <Shape key="s">{part.shapes}</Shape>],
    ["Why it exists", part.why],
    ["Common confusion", part.confusion],
  ];
  return (
    <div className="reveal">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-serif text-[20px] font-semibold text-ink">{part.title}</h3>
        {part.module && <code className="font-mono text-[12px] text-ink-3">{part.module}</code>}
      </div>
      <dl className={cn("grid gap-x-6", compact ? "gap-y-2.5" : "gap-y-3.5")}>
        {rows.map(([k, v], i) => (
          <div key={k} className="grid gap-1 sm:grid-cols-[150px_1fr]">
            <dt className="flex items-baseline gap-2 text-[11.5px] font-medium tracking-[0.06em] text-ink-3 uppercase">
              <span className="num text-ink-4">{i + 1}</span>{k}
            </dt>
            <dd className={cn("min-w-0 text-[14px] leading-relaxed text-ink-2", k === "Common confusion" && "text-ink")}>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function PendingCard({ title, artifact, children }: { title: string; artifact: Pending; children?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-rule-strong bg-paper-2/50 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-[3px] bg-ink px-1.5 py-[1px] text-[11px] font-medium text-paper">Experiment pending</span>
        <span className="text-[13.5px] font-medium text-ink">{title}</span>
      </div>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{artifact.reason} No values are shown until the experiment has run.</p>
      {children}
      {artifact.how_to_run.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[12.5px] text-ink-3 hover:text-ink">Commands that produce this result</summary>
          <pre className="scroll-x mt-2 rounded border border-rule bg-paper p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre text-ink-2">{artifact.how_to_run.join("\n")}</pre>
        </details>
      )}
    </div>
  );
}

export function Reveal({ question, answer, topic }: { question: string; answer: string; topic?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="rounded-md border border-rule bg-paper p-4">
      {topic && <div className="eyebrow mb-1">{topic}</div>}
      <p className="text-[14.5px] font-medium text-ink">{question}</p>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}
        className="mt-2 rounded border border-rule-strong px-2 py-0.5 text-[12px] text-ink-3 hover:border-ink-3 hover:text-ink">
        {open ? "Hide explanation" : "Reveal explanation"}
      </button>
      <div id={id} hidden={!open} className="reveal mt-2 text-[13.5px] leading-relaxed text-ink-2">{answer}</div>
    </div>
  );
}

export function Callout({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "caution" }) {
  return (
    <div className={cn("rounded-md border-l-2 px-4 py-3 text-[13.5px] leading-relaxed",
      tone === "caution" ? "border-flag bg-flag-soft/60 text-ink" : "border-ink-3 bg-paper-2/60 text-ink-2")}>
      {children}
    </div>
  );
}

export function Panel({ title, badge, children, className }: { title?: string; badge?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("ll-panel min-w-0 rounded-md border border-rule bg-paper p-4 sm:p-5", className)}>
      {(title || badge) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h3 className="text-[13.5px] font-medium text-ink">{title}</h3>}
          {badge}
        </div>
      )}
      {children}
    </section>
  );
}

export function Rule() {
  return <hr className="my-16 border-rule" />;
}
