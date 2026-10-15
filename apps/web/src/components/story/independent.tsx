import { INDEPENDENT_PROTOTYPE, PROTOTYPE_PURPOSE } from "@/lib/regan";

export function IndependentPrototype() {
  return (
    <div className="mx-auto max-w-[760px] border-t border-rule pt-10">
      <h2 className="font-serif text-[22px] font-semibold tracking-tight text-ink">Independent Prototype</h2>
      <div className="mt-3 space-y-2 text-[15px] leading-relaxed text-ink-2">
        <p>
          {INDEPENDENT_PROTOTYPE[0]} {INDEPENDENT_PROTOTYPE[1]}
        </p>
        <p className="text-ink">{PROTOTYPE_PURPOSE}</p>
      </div>
    </div>
  );
}
