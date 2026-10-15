import { DownloadButton } from "@/components/site/atoms";
import { Prov } from "@/components/site/provenance";
import { KV, TechDetails } from "@/components/site/tech";
import { AIF_SOURCE } from "@/lib/regan";

export const AIF_LABEL =
  "Experimental AIF-compatible export. Compatibility with Professor Regan's current IR analyzer has not been tested.";

export function AifLink({ href, className, label = "Download AIF file" }: { href: string; className?: string; label?: string }) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <DownloadButton href={href} download>
          {label}
        </DownloadButton>
        <Prov kind="ours" short />
        <span className="text-[11.5px] leading-snug text-ink-3">{AIF_LABEL}</span>
      </div>
      <p className="mt-1.5 text-[12px] text-ink-3">AIF stores the chess game together with detailed engine analysis for each position.</p>
      <AifTech />
    </div>
  );
}

export function AifTech() {
  return (
    <TechDetails label="About the AIF export">
      <KV
        rows={[
          ["Format", "Analysis Interchange Format (AIF), the input format of Regan's IR analyzer"],
          ["Contents", "PGN-compatible game · engine ID/settings · per move: FEN, legal moves, engine evaluations, depth, MultiPV lines, principal variation"],
          ["Our data", "MultiPV 5 at one fixed depth (12); shallower depth columns are “n.a.”; node counts not recorded (“n.a.”)"],
          ["Specification", <a key="s" className="underline" href={AIF_SOURCE.href} target="_blank" rel="noreferrer">{AIF_SOURCE.text}</a>],
          ["Compatibility", "Not tested with Regan's current analyzer. Internal storage is JSON/Parquet, not AIF."],
        ]}
      />
    </TechDetails>
  );
}
