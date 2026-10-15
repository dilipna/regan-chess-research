"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Primary navigation: the four sections of the one-page MoveLens story. Everything else sits behind "Methods".
const LINKS: { href: string; hash: string; label: string }[] = [
  { href: "/", hash: "", label: "Overview" },
  { href: "/#statistical", hash: "#statistical", label: "Statistical" },
  { href: "/#qwen", hash: "#qwen", label: "Qwen" },
  { href: "/#maia", hash: "#maia", label: "Maia" },
  { href: "/#compare", hash: "#compare", label: "Compare" },
  { href: "/#game", hash: "#game", label: "Game" },
  { href: "/#checks", hash: "#checks", label: "Checks" },
];

export function Nav() {
  const path = usePathname();
  const [hash, setHash] = useState("");
  useEffect(() => {
    const read = () => setHash(window.location.hash);
    const raf = requestAnimationFrame(read);
    window.addEventListener("hashchange", read);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("hashchange", read); };
  }, []);
  const home = path === "/";
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
      <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-ink" aria-label="MoveLens home">
          <LensMark />
          <span className="hidden font-serif text-[18px] font-semibold tracking-tight min-[420px]:inline">MoveLens</span>
        </Link>
        <nav aria-label="Primary" className="no-scrollbar -mr-4 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto pr-4 sm:mr-0 sm:pr-0 lg:justify-end">
          {LINKS.map((l) => {
            const active = home && (l.hash === hash || (l.hash === "" && !LINKS.some((x) => x.hash && x.hash === hash)));
            return (
              <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}
                className={cn("relative shrink-0 rounded px-2 py-1.5 text-[13.5px] whitespace-nowrap text-ink-3 transition-colors hover:text-ink sm:px-2.5",
                  active && "text-ink after:absolute after:inset-x-2 after:-bottom-[11px] after:h-px after:bg-ink sm:after:inset-x-2.5")}>
                {l.label}
              </Link>
            );
          })}
          <span aria-hidden className="mx-1.5 h-4 w-px shrink-0 bg-rule-strong" />
          <Link href="/methodology" aria-current={path === "/methodology" ? "page" : undefined}
            className={cn("shrink-0 rounded px-2 py-1.5 text-[12.5px] whitespace-nowrap text-ink-3 hover:text-ink", path === "/methodology" && "text-ink")}>
            Methods
          </Link>
          <Link href="/latent" aria-current={path.startsWith("/latent") ? "page" : undefined}
            className={cn("shrink-0 rounded border border-rule-strong px-2 py-1 text-[12.5px] whitespace-nowrap text-ink-3 hover:text-ink", path.startsWith("/latent") && "border-ink text-ink")}>
            V2 · Model Internals
          </Link>
        </nav>
      </div>
    </header>
  );
}

function LensMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <rect x="1" y="1" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="1" y="1" width="9" height="9" fill="var(--board-dark)" />
      <rect x="10" y="10" width="9" height="9" fill="var(--board-dark)" />
    </svg>
  );
}
