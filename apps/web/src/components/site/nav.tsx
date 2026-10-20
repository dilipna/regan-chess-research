"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { PHASES, headerLinks, phaseOf } from "@/lib/site/phases";

// One header for the whole site: the two phases on top, the numbered subsections of the current phase below.
export function Nav() {
  const path = usePathname();
  const [hash, setHash] = useState("");
  useEffect(() => {
    const read = () => setHash(window.location.hash);
    const raf = requestAnimationFrame(read);
    window.addEventListener("hashchange", read);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("hashchange", read); };
  }, [path]);
  const phase = phaseOf(path);
  const links = phase ? headerLinks(phase) : [];
  const isActive = (href: string) => {
    const [p, h] = href.split("#");
    if (h) return path === p && hash === `#${h}`;
    if (p === "/chess") return path === "/chess" && !links.some((l) => l.href.startsWith("/chess#") && `#${l.href.split("#")[1]}` === hash);
    if (p === "/latent") return path === "/latent";
    return path === p || path.startsWith(`${p}/`);
  };
  return (
    <>
    <header className="sticky top-0 z-40 border-b border-rule bg-[var(--bg)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-3 px-4 sm:gap-5 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-ink" aria-label="Home: both phases">
          <Mark />
          <span className="hidden font-mono text-[13.5px] tracking-tight sm:inline">move<span className="text-ink-4">→</span>latent<span className="text-ink-3">.lens</span></span>
        </Link>
        <nav aria-label="Phases" className="flex min-w-0 flex-1 items-center justify-center gap-1 sm:justify-start">
          {PHASES.map((p) => (
            <Link key={p.id} href={p.home} aria-current={phase?.id === p.id ? "true" : undefined}
              className={cn("flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[12.5px] whitespace-nowrap transition-colors sm:px-3",
                phase?.id === p.id ? "border-ink bg-[color-mix(in_oklab,var(--mint)_12%,transparent)] text-ink" : "border-rule-strong text-ink-3 hover:border-ink-4 hover:text-ink")}>
              <span className="text-ink-4">0{p.n}</span>{p.label}
            </Link>
          ))}
        </nav>
        <Link href="/latent/professor" className="shrink-0 rounded-md bg-ink px-3 py-1.5 font-mono text-[12.5px] font-medium text-[var(--bg)] shadow-[0_0_18px_var(--mint-glow)] hover:opacity-90">
          ▶ Demo
        </Link>
      </div>
    </header>
      {phase && (
        <div className="border-b border-rule">
          <nav aria-label={`Phase ${phase.n} sections`} className="no-scrollbar mx-auto flex h-10 max-w-[1180px] items-center gap-0.5 overflow-x-auto px-4 sm:px-6">
            {links.map((l) => (
              <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? "page" : undefined}
                className={cn("relative shrink-0 rounded px-2 py-1 text-[13px] whitespace-nowrap text-ink-3 transition-colors hover:text-ink",
                  isActive(l.href) && "text-ink after:absolute after:inset-x-2 after:-bottom-[7px] after:h-px after:bg-ink after:shadow-[0_0_8px_var(--mint)]")}>
                <span className="mr-1 font-mono text-[11px] text-ink-4">{l.n}</span>{l.label}
              </Link>
            ))}
            <Link href={`/#phase-${phase.n}`} className="ml-auto shrink-0 rounded px-2 py-1 font-mono text-[12px] whitespace-nowrap text-ink-4 hover:text-ink">all {phase.n}.x →</Link>
          </nav>
        </div>
      )}
    </>
  );
}

function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <rect x="1" y="1" width="20" height="20" rx="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="1" y="1" width="10" height="10" fill="currentColor" opacity="0.28" />
      <rect x="11" y="11" width="10" height="10" fill="currentColor" opacity="0.28" />
      <circle cx="11" cy="11" r="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
