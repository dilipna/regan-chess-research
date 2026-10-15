import { ArrowDown, BookOpen, FlaskConical, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The one diagram that explains the intellectual contribution (not the infrastructure):
 * Regan's statistical view, the MoveLens addition on the same position, and the controlled experiment.
 */
export function ContributionDiagram() {
  return (
    <figure aria-labelledby="diagram-caption" className="mx-auto max-w-[1040px]">
      <div className="grid gap-5 md:grid-cols-2 md:gap-8">
        <Column
          family="regan"
          icon={<BookOpen className="size-4" aria-hidden />}
          kicker="Regan's view"
          sub="Verified public method"
          inputs={["Engine analysis", "Player rating", "Statistical human model"]}
          steps={["Expected move behaviour", "Observed vs projected", "Statistical evidence"]}
        />
        <Column
          family="ours"
          icon={<Plus className="size-4" aria-hidden />}
          kicker="MoveLens addition"
          sub="Our augmentation"
          inputs={["Same chess position", "Maia-3"]}
          question="How plausible is this move for a similarly rated human?"
          steps={["+ Sequence / context features", "XGBoost fusion", "Additional experimental evidence"]}
        />
      </div>
      <div aria-hidden className="flex justify-center py-3 text-ink-4">
        <ArrowDown className="size-5" />
      </div>
      <div className="relative mx-auto max-w-[760px] rounded-lg border-2 border-[color-mix(in_oklab,var(--prov-finding)_50%,var(--rule))] bg-tint-finding px-5 py-5 text-center sm:px-8">
        <div className="flex items-center justify-center gap-2 text-[11.5px] font-semibold tracking-[0.1em] text-finding uppercase">
          <FlaskConical className="size-4" aria-hidden /> Controlled experiment
        </div>
        <p className="mt-2 font-serif text-[19px] leading-snug text-ink sm:text-[22px]">
          “Does the additional signal actually improve detection of known, synthetically assisted decisions?”
        </p>
      </div>
      <figcaption id="diagram-caption" className="sr-only">
        Left, Regan&apos;s view: engine analysis, player rating and a statistical human model give expected move behaviour,
        which is compared with what was observed to produce statistical evidence. Right, the MoveLens addition: the same
        chess position and Maia-3 ask how plausible the move is for a similarly rated human; with sequence features, XGBoost
        fuses the signals into additional experimental evidence. Below, a controlled experiment tests whether the additional
        signal improves detection of known, synthetically assisted decisions.
      </figcaption>
    </figure>
  );
}

function Column({
  family,
  icon,
  kicker,
  sub,
  inputs,
  question,
  steps,
}: {
  family: "regan" | "ours";
  icon: React.ReactNode;
  kicker: string;
  sub: string;
  inputs: string[];
  question?: string;
  steps: string[];
}) {
  const regan = family === "regan";
  const border = regan ? "border-[color-mix(in_oklab,var(--prov-regan)_45%,var(--rule))]" : "border-[color-mix(in_oklab,var(--prov-ours)_45%,var(--rule))] border-dashed";
  const head = regan ? "text-regan" : "text-ours";
  const band = regan ? "bg-tint-regan" : "bg-tint-ours";
  return (
    <div aria-hidden className={cn("flex flex-col rounded-lg border-2 p-5 sm:p-6", border, band)}>
      <div className={cn("flex items-center gap-2 text-[12px] font-semibold tracking-[0.1em] uppercase", head)}>
        {icon}
        {kicker}
        <span className="font-medium tracking-[0.04em] text-ink-3 normal-case">· {sub}</span>
      </div>
      <div className="mt-4 rounded-md border border-rule bg-paper px-4 py-3">
        {inputs.map((x, i) => (
          <div key={x}>
            {i > 0 && <div className="py-0.5 text-center text-[13px] text-ink-4">+</div>}
            <div className="text-center text-[15px] font-medium text-ink">{x}</div>
          </div>
        ))}
      </div>
      {question && (
        <>
          <Down />
          <div className="rounded-md border border-[color-mix(in_oklab,var(--human)_45%,var(--rule))] bg-human-soft px-4 py-3 text-center font-serif text-[16.5px] leading-snug text-ink">
            “{question}”
          </div>
        </>
      )}
      {steps.map((s, i) => (
        <div key={s}>
          {s.startsWith("+ ") ? <div className="py-0.5 text-center text-[13px] text-ink-4">+</div> : <Down />}
          <div
            className={cn(
              "rounded-md px-4 py-2.5 text-center text-[15px]",
              i === steps.length - 1 ? cn("font-semibold text-ink", regan ? "bg-[color-mix(in_oklab,var(--prov-regan)_12%,var(--paper))]" : "bg-[color-mix(in_oklab,var(--prov-ours)_12%,var(--paper))]") : "border border-rule bg-paper text-ink-2",
            )}
          >
            {s.replace(/^\+ /, "")}
          </div>
        </div>
      ))}
    </div>
  );
}

function Down() {
  return (
    <div className="flex justify-center py-1 text-ink-4">
      <ArrowDown className="size-4" />
    </div>
  );
}
