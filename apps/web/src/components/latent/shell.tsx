"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import type { Part } from "@/lib/latent/parts";
import type { Pending } from "@/lib/latent/types";
import { Prov } from "./kit";

const SUBNAV = [
  { href: "/latent", label: "Overview" },
  { href: "/latent/story", label: "Storybook" },
  { href: "/latent/journey", label: "Journey" },
  { href: "/latent/labs", label: "Labs" },
  { href: "/latent/glassbox", label: "Glass Box" },
  { href: "/latent/play", label: "You vs Qwen" },
  { href: "/latent/research", label: "Research" },
  { href: "/latent/recall", label: "Recall" },
  { href: "/latent/demo", label: "Professor Demo" },
  { href: "/latent/methods", label: "Methods" },
  { href: "/latent/learn", label: "Reference notes" },
];

export function LatentSubNav() {
  const path = usePathname();
  return (
    <div className="border-b border-rule bg-paper-2/60 backdrop-blur">
      <div className="mx-auto flex h-11 max-w-[1180px] items-center gap-3 px-4 sm:px-6">
        <Link href="/latent" className="shrink-0 font-serif text-[16px] font-semibold tracking-tight text-ink">LatentLens</Link>
        <span aria-hidden className="h-4 w-px shrink-0 bg-rule-strong" />
        <nav aria-label="LatentLens" className="no-scrollbar -mr-4 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto pr-4">
          {SUBNAV.map((l) => {
            const active = l.href === "/latent" ? path === l.href : path.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}
                className={cn("shrink-0 rounded px-2 py-1 text-[13px] whitespace-nowrap text-ink-3 hover:text-ink", active && "bg-paper text-ink shadow-[inset_0_0_0_1px_var(--rule-strong)]")}>
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
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
