import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-rule">
      <div className="mx-auto grid max-w-[1180px] gap-6 px-4 py-10 text-[12.5px] text-ink-3 sm:px-6 md:grid-cols-[1fr_auto]">
        <p className="max-w-2xl leading-relaxed">
          MoveLens is an independent research prototype. Its statistical model is reconstructed from publicly documented concepts and is not Professor
          Kenneth W. Regan&apos;s production cheating-detection system. Scores are not proof that any player cheated.
        </p>
        <div className="flex flex-wrap items-start gap-x-5 gap-y-2 md:justify-end">
          <Link className="hover:text-ink" href="/methodology">Methods</Link>
          <Link className="hover:text-ink" href="/results">Full results</Link>
          <Link className="hover:text-ink" href="/methodology#repro">Provenance</Link>
          <Link className="hover:text-ink" href="/about">Earlier views</Link>
        </div>
      </div>
    </footer>
  );
}
