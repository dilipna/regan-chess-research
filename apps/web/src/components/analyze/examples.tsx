"use client";

import { AifLink } from "@/components/demo/aif-link";
import { DemoPicker } from "@/components/demo/demo-picker";
import { ReportView } from "@/components/report/report-view";
import { LoadState } from "@/components/site/atoms";
import { DATA, useDemo, useDemos } from "@/lib/data";

/** The three precomputed example studies (no backend needed). */
export function Examples({ value, onChange }: { value: string | null; onChange: (id: string) => void }) {
  const demos = useDemos();
  const id = value ?? demos.data?.demos[0]?.id ?? null;
  const rep = useDemo(id);
  if (!demos.data) return <LoadState error={demos.error} />;
  return (
    <div>
      <DemoPicker demos={demos.data.demos} value={id} onChange={onChange} />
      {rep.data && (
        <div className="mt-4 space-y-3 text-[12.5px] leading-relaxed text-ink-3">
          {rep.data.selection_rule && (
            <p>
              <span className="font-medium text-ink-2">One original game, three prepared reports. </span>
              {rep.data.selection_rule} The two substitution reports analyze counterfactual engine moves at some of the analyzed
              player&apos;s decisions, each evaluated in the original position; the game record and all later positions stay those of
              the original game. They are not replayed games.
            </p>
          )}
          {id && <AifLink href={DATA.demoAif(id)} />}
        </div>
      )}
      <div className="mt-8">
        {rep.data ? <ReportView key={rep.data.id} report={rep.data} /> : <LoadState error={rep.error} label="Loading game report" />}
      </div>
    </div>
  );
}
