"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { fmtPct } from "@/lib/format";
import { LIVE_URL, type ThreePosition } from "@/lib/three";

interface LiveSide {
  status?: string;
  played_probability?: number;
  played_rank?: number;
  top?: [string, number][];
  model?: string;
}

/** Optional live re-scoring. Rendered only after a successful health check; any failure leaves the prepared
 * study untouched and shows a short message. */
export function LivePanel({ pos, played }: { pos: ThreePosition; played: string }) {
  const [state, setState] = useState<{ busy: boolean; error?: string; data?: { qwen: LiveSide; maia: LiveSide; provenance?: { elapsed_s?: number } } }>({ busy: false });
  const run = async () => {
    setState({ busy: true });
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 120_000);
    try {
      const r = await fetch(`${LIVE_URL}/compare-position`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fen: pos.fen, elo: pos.elo, opp_elo: pos.opp_elo, played }),
        signal: ctl.signal,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setState({ busy: false, data: await r.json() });
    } catch (e) {
      setState({ busy: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      clearTimeout(timer);
    }
  };
  return (
    <div className="mt-6 rounded-md border border-finding/40 bg-tint-finding p-4 text-[12.5px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-ink">Live re-scoring (GPU service)</div>
        <button type="button" onClick={run} disabled={state.busy}
          className="inline-flex items-center gap-1.5 rounded border border-ink px-2.5 py-1 font-medium text-ink disabled:opacity-60">
          {state.busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />} Score this position live
        </button>
      </div>
      <p className="mt-1 text-ink-3">
        Live single-position Stockfish analysis starts from an empty hash table, so its engine lines (and therefore the Qwen prompt) can
        differ slightly from the prepared, game-sequential analysis. The prepared values above remain the reference.
      </p>
      {state.error && <p className="mt-2 text-flag">Live service unavailable ({state.error}). The prepared study is unaffected.</p>}
      {state.data && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(["qwen", "maia"] as const).map((k) => {
            const s = state.data![k];
            return (
              <div key={k} className="rounded border border-rule bg-paper p-2.5">
                <div className="font-semibold text-ink">{s.model ?? k}</div>
                {s.status === "unavailable" ? (
                  <div className="text-ink-3">unavailable</div>
                ) : (
                  <div className="num text-ink-2">
                    played-move probability {fmtPct(s.played_probability, 1)} · rank #{s.played_rank ?? "—"}
                    <br />top: {(s.top ?? []).slice(0, 3).map(([m, p]) => `${m} ${fmtPct(p, 1)}`).join(", ")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
