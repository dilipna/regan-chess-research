"use client";

import { Prov, type ProvKind } from "@/components/site/provenance";
import { KV, TechDetails } from "@/components/site/tech";
import { fmtNum, fmtPct, fmtSigned, isNum } from "@/lib/format";
import type { PvoRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PvoTable } from "./pvo";

export const PVO_PLAIN: Record<string, { name: string; prov: ProvKind; tech: string }> = {
  t1: { name: "Agreement with the engine's first choice", prov: "approx", tech: "T1-match analogue (first-listed Stockfish line, depth 12)" },
  ev: { name: "Agreement with an engine-best move (ties count)", prov: "approx", tech: "EV-match analogue (value equal to the best line)" },
  t3: { name: "Agreement with the engine's top three", prov: "ours", tech: "top-3 match (MoveLens statistic)" },
  loss: { name: "Average move error", prov: "ours", tech: "mean unscaled centipawn loss, capped at 300 — not Regan's ASD" },
  t1_hard: { name: "Hard-position performance", prov: "approx", tech: "top-1 match on the hardest third of positions (not EWN)" },
  t1_easy: { name: "Ordinary-position performance", prov: "approx", tech: "top-1 match on the easiest third of positions" },
  maia: { name: "Human-typicality of the moves", prov: "ours", tech: "Maia-3 surprisal vs its expectation (entropy)" },
};

function verdict(r: PvoRow): { text: string; tone: "flag" | "neutral" | "low" } {
  const z = r.z;
  const human = r.key === "maia";
  if (!isNum(z)) return { text: "—", tone: "neutral" };
  if (r.key === "loss") {
    // z is sign-flipped for loss: positive = less error than projected
    if (z >= 3) return { text: "Far less error than expected", tone: "flag" };
    if (z >= 2) return { text: "Clearly less error than expected", tone: "flag" };
    if (z <= -2) return { text: "More error than expected", tone: "low" };
    return { text: "Within the normal range", tone: "neutral" };
  }
  if (z >= 3) return { text: human ? "Much less human-typical than expected" : "Far above expectation", tone: "flag" };
  if (z >= 2) return { text: human ? "Clearly less human-typical than expected" : "Clearly above expectation", tone: "flag" };
  if (z <= -2) return { text: human ? "More human-typical than expected" : "Clearly below expectation", tone: "low" };
  return { text: "Within the normal range", tone: "neutral" };
}

function fmtVal(v: number | null, unit: string) {
  if (!isNum(v)) return "—";
  if (unit === "rate") return fmtPct(v, 0);
  if (unit === "cp") return `${fmtNum(v, 0)} cp`;
  return fmtNum(v, 2);
}

export function Expectation({ rows, fileStem, kappa }: { rows?: PvoRow[]; fileStem?: string; kappa?: Record<string, number> }) {
  if (!rows?.length) return <p className="text-[13px] text-ink-3">Not enough scored moves to compare with expectation.</p>;
  return (
    <div>
      <ul className="divide-y divide-rule rounded-md border border-rule">
        {rows.map((r) => {
          const p = PVO_PLAIN[r.key ?? ""] ?? { name: r.metric, prov: "ours" as ProvKind, tech: r.metric };
          const v = verdict(r);
          return (
            <li key={r.metric} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-medium text-ink">{p.name}</span>
                  <Prov kind={p.prov} short />
                </div>
                <div className="mt-0.5 text-[12px] text-ink-3">
                  expected {fmtVal(r.projected, r.unit)} · observed {fmtVal(r.observed, r.unit)} · {r.n} moves
                </div>
              </div>
              <div
                className={cn(
                  "text-[13px] font-medium",
                  v.tone === "flag" ? "text-flag" : v.tone === "low" ? "text-engine" : "text-ink-2",
                )}
              >
                {v.text}
              </div>
              <div className="num text-[12px] text-ink-3 sm:text-right">z = {fmtSigned(r.z, 2)}</div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">
        “Expected” is what players of this rating achieve in positions of this difficulty, learned from original training games.
        Results beyond about two standard deviations (|z| ≥ 2) are uncommon for genuine human play — but one game is a small
        sample.
      </p>
      <TechDetails>
        <div className="space-y-4">
          <KV
            rows={[
              ["Formula", "z = (observed − projected) / √(κ · Σ pᵢ(1 − pᵢ)); for move loss Var = Σ σᵢ² and the sign is flipped"],
              ["Projection", "Elo band × difficulty decile table fitted on original training-split decisions"],
              ["κ (variance inflation)", kappa ? Object.entries(kappa).map(([k, v]) => `${k} ${fmtNum(v, 3)}`).join(" · ") : "—"],
              ["κ estimated on", "original validation player-games (so that their z has unit variance)"],
              ["Provenance", "Regan-inspired approximation; the projected-vs-actual z-test concept is Regan's, this implementation is ours"],
            ]}
          />
          <div className="space-y-1 text-[12px] text-ink-3">
            {rows.map((r) => (
              <div key={r.metric}>
                <span className="text-ink-2">{PVO_PLAIN[r.key ?? ""]?.name ?? r.metric}:</span> {PVO_PLAIN[r.key ?? ""]?.tech ?? r.note}
              </div>
            ))}
          </div>
          <PvoTable rows={rows} fileStem={fileStem} />
        </div>
      </TechDetails>
    </div>
  );
}
