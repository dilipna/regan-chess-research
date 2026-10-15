"use client";

import { useEffect, useState } from "react";
import { Examples } from "@/components/analyze/examples";
import { Segmented } from "@/components/site/atoms";
import { Disclaimer } from "@/components/site/disclaimer";
import { AnalyzeClient } from "./analyze-client";

/** Tab and example selection live in local state (so the default study is in the static HTML);
 *  ?tab=upload and ?demo=<id> links are honoured after load and kept in the URL. */
export function AnalyzeShell() {
  const [tab, setTab] = useState<"examples" | "upload">("examples");
  const [demo, setDemo] = useState<string | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from the URL
    if (q.get("tab") === "upload") setTab("upload");
    if (q.get("demo")) setDemo(q.get("demo"));
  }, []);
  const sync = (t: string, d: string | null) => {
    const q = new URLSearchParams();
    if (t === "upload") q.set("tab", "upload");
    if (d && t !== "upload") q.set("demo", d);
    window.history.replaceState(null, "", `${window.location.pathname}${q.size ? `?${q}` : ""}`);
  };
  const showTab = (v: "examples" | "upload") => {
    setTab(v);
    sync(v, demo);
  };
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Source"
          value={tab}
          onChange={showTab}
          options={[
            { value: "examples", label: "Prepared studies (offline)" },
            { value: "upload", label: "Live analysis (upload PGN)" },
          ]}
        />
        <Disclaimer compact className="max-w-xl" />
      </div>
      <p className="mb-8 max-w-3xl text-[12.5px] leading-relaxed text-ink-3">
        {tab === "examples"
          ? "Prepared studies are precomputed reports bundled with this site; they work without the live server."
          : "Live analysis sends the PGN to the research server, which runs Stockfish and Maia-3 now. If it is unavailable, the prepared studies remain fully usable."}
      </p>
      {tab === "examples" ? (
        <Examples
          value={demo}
          onChange={(id) => {
            setDemo(id);
            sync("examples", id);
          }}
        />
      ) : (
        <AnalyzeClient onShowPrepared={() => showTab("examples")} />
      )}
    </div>
  );
}
