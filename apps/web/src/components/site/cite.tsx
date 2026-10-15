import { SOURCES, type Cite as CiteT } from "@/lib/regan";
import { cn } from "@/lib/utils";

/** Compact in-text citation(s) linking to the verified public source, with page reference. */
export function Cite({ cites, className }: { cites?: CiteT[]; className?: string }) {
  if (!cites?.length) return null;
  return (
    <span className={cn("text-[0.92em] whitespace-normal text-ink-3", className)}>
      [
      {cites.map((c, i) => {
        const s = SOURCES[c.src];
        return (
          <span key={c.src + (c.loc ?? "") + i}>
            {i > 0 && "; "}
            <a
              href={s.href}
              target="_blank"
              rel="noreferrer"
              title={s.text}
              className="underline decoration-rule-strong underline-offset-2 hover:text-ink hover:decoration-ink-3"
            >
              {s.short}
              {c.loc ? `, ${c.loc}` : ""}
            </a>
          </span>
        );
      })}
      ]
    </span>
  );
}
