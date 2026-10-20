"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { PHASES, headerLinks, phaseOf } from "@/lib/site/phases";

// One quiet header for the whole site: the two phases, then the few key pages of the current phase.
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
    if (p === "/latent") return path === "/latent";
    return path === p || path.startsWith(`${p}/`);
  };
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-rule bg-[var(--bg)]/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-3 px-4 sm:gap-6 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-ink" aria-label="Home">
            <Mark />
            <span className="hidden font-serif text-[17px] font-semibold sm:inline">Chess &amp; Model Internals</span>
          </Link>
          <nav aria-label="Phases" className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2">
            {PHASES.map((p) => (
              <Link key={p.id} href={p.home} aria-current={phase?.id === p.id ? "true" : undefined}
                className={cn("rounded-full px-3 py-1.5 text-[13.5px] whitespace-nowrap transition-colors",
                  phase?.id === p.id ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2 hover:text-ink")}>
                <span className="opacity-60 max-[400px]:hidden">Phase {p.n} ·</span> {p.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {phase && (
        <div className="border-b border-rule bg-paper">
          <nav aria-label={`Phase ${phase.n} pages`} className="no-scrollbar mx-auto flex h-11 max-w-[1180px] items-center gap-1 overflow-x-auto px-4 sm:px-6">
            <span className="mr-2 shrink-0 text-[12.5px] text-ink-4">{phase.plain}</span>
            {links.map((l) => (
              <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? "page" : undefined}
                className={cn("shrink-0 rounded-md px-2.5 py-1 text-[13.5px] whitespace-nowrap text-ink-3 transition-colors hover:text-ink",
                  isActive(l.href) && "bg-brand-soft font-medium text-brand")}>
                {l.label}
              </Link>
            ))}
            <Link href={`/#all-pages`} className="ml-auto shrink-0 px-2 py-1 text-[12.5px] whitespace-nowrap text-ink-4 hover:text-ink">All pages</Link>
          </nav>
        </div>
      )}
    </>
  );
}

function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <rect x="1" y="1" width="20" height="20" rx="2" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <rect x="1" y="1" width="10" height="10" fill="var(--board-dark)" />
      <rect x="11" y="11" width="10" height="10" fill="var(--board-dark)" />
      <circle cx="11" cy="11" r="3.2" fill="var(--paper)" stroke="var(--brand)" strokeWidth="1.5" />
    </svg>
  );
}
