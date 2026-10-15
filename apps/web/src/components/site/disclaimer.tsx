import { cn } from "@/lib/utils";

export const DISCLAIMER =
  "MoveLens is a research prototype. Its scores measure similarity to patterns in controlled engine-assistance experiments. They are not proof that a real player cheated and must not be used alone for adjudication.";

/** Persistent but unobtrusive research disclaimer. */
export function Disclaimer({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <aside
      role="note"
      className={cn(
        "flex gap-3 rounded-md border border-rule bg-paper-2 text-ink-3",
        compact ? "px-3 py-2 text-[12px]" : "px-4 py-2.5 text-[12.5px]",
        className,
      )}
    >
      <span aria-hidden="true" className="mt-[3px] h-[13px] w-[2px] shrink-0 rounded-full bg-ink-4" />
      <p className="leading-relaxed">
        <span className="font-medium text-ink-2">Research prototype. </span>
        {DISCLAIMER.replace("MoveLens is a research prototype. ", "")}
      </p>
    </aside>
  );
}
