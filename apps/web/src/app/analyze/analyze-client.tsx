"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AIF_LABEL } from "@/components/demo/aif-link";
import { ReportView } from "@/components/report/report-view";
import { DownloadButton } from "@/components/site/atoms";
import { API_URL } from "@/lib/data";
import { fmtInt } from "@/lib/format";
import type { JobState } from "@/lib/types";
import { cn } from "@/lib/utils";

type Health = "checking" | "online" | "degraded" | "offline" | "unconfigured";
interface HealthBody {
  status?: string;
  models?: boolean;
  engine_path_exists?: boolean;
}

/** The server is usable only if it answers "ok" AND reports its models and engine present. */
function classify(h: HealthBody | null): Health {
  if (!h || h.status !== "ok") return "offline";
  return h.models === false || h.engine_path_exists === false ? "degraded" : "online";
}

const API_HOST = (() => {
  try {
    return API_URL ? new URL(API_URL).host : "";
  } catch {
    return API_URL;
  }
})();

const STAGES: { key: JobState["status"]; label: string }[] = [
  { key: "queued", label: "Queued" },
  { key: "stockfish", label: "Stockfish analysis" },
  { key: "maia", label: "Maia-3 human model" },
  { key: "features", label: "Features, scores and explanations" },
  { key: "done", label: "Report ready" },
];

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 8000): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal });
    const body = await r.json().catch(() => null);
    if (!r.ok) {
      const detail = body && typeof body === "object" && "detail" in body ? String((body as { detail: unknown }).detail) : `HTTP ${r.status}`;
      throw new Error(detail);
    }
    return body as T;
  } finally {
    clearTimeout(t);
  }
}

export function AnalyzeClient({ onShowPrepared }: { onShowPrepared?: () => void }) {
  const [health, setHealth] = useState<Health>(API_URL ? "checking" : "unconfigured");
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [pgn, setPgn] = useState("");
  const [elo, setElo] = useState("1500");
  const [gameIndex, setGameIndex] = useState("0");
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const probe = useCallback((alive: () => boolean) => {
    fetchJson<HealthBody>(`${API_URL}/api/health`, { cache: "no-store" }, 8000).then(
      (h) => {
        if (!alive()) return;
        setHealth(classify(h));
        setCheckedAt(new Date());
      },
      () => {
        if (!alive()) return;
        setHealth("offline");
        setCheckedAt(new Date());
      },
    );
  }, []);

  const checkHealth = useCallback(() => {
    if (!API_URL) return;
    setHealth("checking");
    probe(() => true);
  }, [probe]);

  useEffect(() => {
    if (!API_URL) return;
    let alive = true;
    probe(() => alive);
    return () => {
      alive = false;
    };
  }, [probe]);

  // Poll job status.
  useEffect(() => {
    if (!jobId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      fetchJson<JobState>(`${API_URL}/api/jobs/${jobId}`).then(
        (j) => {
          if (!alive) return;
          setJob(j);
          if (j.status !== "done" && j.status !== "error") timer = setTimeout(tick, 1500);
        },
        (e: unknown) => {
          if (!alive) return;
          setJob((prev) => ({ ...(prev ?? { status: "queued" }), status: "error", error: e instanceof Error ? e.message : String(e) }));
        },
      );
    };
    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [jobId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitErr(null);
    if (!pgn.trim()) {
      setSubmitErr("Paste a PGN or choose a .pgn file first.");
      return;
    }
    setBusy(true);
    setJob(null);
    setJobId(null);
    try {
      const r = await fetchJson<{ job_id: string }>(
        `${API_URL}/api/analyze`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pgn, game_index: Math.max(0, Number(gameIndex) || 0), default_elo: Number(elo) || 1500 }),
        },
        20000,
      );
      setJob({ status: "queued", progress: 0, total: 1 });
      setJobId(r.job_id);
    } catch (err) {
      setSubmitErr(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setPgn(await f.text());
  };

  const disabled = health !== "online";

  return (
    <div className="space-y-10">
      <HealthNotice health={health} onRetry={checkHealth} onShowPrepared={onShowPrepared} checkedAt={checkedAt} />

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <label htmlFor="pgn" className="eyebrow mb-1.5 block">
            PGN
          </label>
          <textarea
            id="pgn"
            value={pgn}
            onChange={(e) => setPgn(e.target.value)}
            spellCheck={false}
            rows={12}
            placeholder={'[Event "Rated Rapid game"]\n[White "…"]\n[Black "…"]\n[WhiteElo "1850"]\n[BlackElo "1790"]\n\n1. d4 Nf6 2. c4 e6 …'}
            className="num block w-full resize-y rounded-md border border-rule-strong bg-paper px-3 py-2.5 text-[12.5px] leading-relaxed text-ink placeholder:text-ink-4 focus:border-ink-3 focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-ink-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded border border-rule-strong px-2.5 py-1 text-ink-2 transition-colors duration-150 hover:border-ink-3 hover:text-ink"
            >
              Upload .pgn file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pgn,text/plain,application/x-chess-pgn"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            {pgn && <span className="num">{fmtInt(pgn.length)} characters</span>}
          </div>
        </div>
        <div className="space-y-4">
          <label className="block">
            <span className="eyebrow mb-1.5 block">Default Elo (if missing in PGN)</span>
            <input
              type="number"
              min={600}
              max={3000}
              step={50}
              value={elo}
              onChange={(e) => setElo(e.target.value)}
              className="num block w-full rounded-md border border-rule-strong bg-paper px-3 py-2 text-[13px] text-ink focus:border-ink-3 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="eyebrow mb-1.5 block">Game in file (0 = first)</span>
            <input
              type="number"
              min={0}
              max={50}
              value={gameIndex}
              onChange={(e) => setGameIndex(e.target.value)}
              className="num block w-full rounded-md border border-rule-strong bg-paper px-3 py-2 text-[13px] text-ink focus:border-ink-3 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={disabled || busy}
            className="w-full rounded-md bg-ink px-4 py-2.5 text-[14px] font-medium text-paper transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Submitting…" : "Analyze game"}
          </button>
          <p className="text-[11.5px] leading-relaxed text-ink-3">
            Both players are analyzed. Analysis starts after the opening phase and can take several minutes on a cold server.
          </p>
          {submitErr && <p className="rounded-md border border-flag/30 bg-flag-soft px-3 py-2 text-[12.5px] text-ink-2">{submitErr}</p>}
        </div>
      </form>

      {job && job.status !== "done" && <Progress job={job} />}

      {job?.status === "done" && job.report && jobId && (
        <div className="border-t border-rule pt-10">
          <div className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-[12.5px] text-ink-2">Download experimental AIF export:</span>
            <DownloadButton href={`${API_URL}/api/jobs/${jobId}/aif?color=white`} download>
              White
            </DownloadButton>
            <DownloadButton href={`${API_URL}/api/jobs/${jobId}/aif?color=black`} download>
              Black
            </DownloadButton>
            <span className="text-[11.5px] leading-snug text-ink-3">{AIF_LABEL}</span>
          </div>
          <ReportView report={job.report} />
        </div>
      )}
    </div>
  );
}

function HealthNotice({
  health,
  onRetry,
  onShowPrepared,
  checkedAt,
}: {
  health: Health;
  onRetry: () => void;
  onShowPrepared?: () => void;
  checkedAt: Date | null;
}) {
  const when = checkedAt ? ` · checked ${checkedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "";
  if (health === "online")
    return (
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3" role="status">
        <span aria-hidden className="h-2 w-2 rounded-full bg-engine" /> Live analyzer online (models and engine loaded){when}
        {API_HOST && <span className="num text-ink-4">· {API_HOST}</span>}
      </div>
    );
  if (health === "checking")
    return (
      <div className="flex items-center gap-2 text-[12.5px] text-ink-3" role="status">
        <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-ink-4" /> Checking the live analyzer…
      </div>
    );
  return (
    <div className="rounded-md border border-rule bg-paper-2 px-4 py-4 text-[13.5px] leading-relaxed text-ink-2" role="status">
      <div className="font-medium text-ink">
        {health === "unconfigured"
          ? "The live analyzer is not configured for this deployment."
          : health === "degraded"
            ? "The live analyzer answered, but reports missing models or engine."
            : "The live analyzer is unreachable."}
      </div>
      <p className="mt-1">
        Live analysis runs Stockfish and Maia-3 on a separate research server
        {health === "offline" ? " (it may be asleep, restarting, or behind a changed tunnel address)" : ""}
        {when}. Everything else on this site works without it: the prepared studies are precomputed reports shown in exactly the
        same report view.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {onShowPrepared ? (
          <button
            type="button"
            onClick={onShowPrepared}
            className="rounded bg-ink px-2.5 py-1 text-[12px] font-medium text-paper transition-opacity duration-150 hover:opacity-90"
          >
            Open prepared studies
          </button>
        ) : (
          <Link href="/analyze" className="rounded bg-ink px-2.5 py-1 text-[12px] font-medium text-paper">
            Open prepared studies
          </Link>
        )}
        {health !== "unconfigured" && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded border border-rule-strong px-2.5 py-1 text-[12px] text-ink-2 transition-colors duration-150 hover:border-ink-3 hover:text-ink"
          >
            Check again
          </button>
        )}
      </div>
    </div>
  );
}

function Progress({ job }: { job: JobState }) {
  const cur = STAGES.findIndex((s) => s.key === job.status);
  const frac =
    job.status === "stockfish" && job.total ? Math.min(1, (job.progress ?? 0) / job.total) : job.status === "error" ? 0 : null;
  return (
    <div className="rounded-md border border-rule p-5">
      {job.status === "error" ? (
        <div className="text-[13px] text-ink-2">
          <span className="font-medium text-flag">Analysis failed. </span>
          <span className="num">{job.error ?? "Unknown error"}</span>
        </div>
      ) : (
        <>
          <ol className="grid gap-3 sm:grid-cols-5">
            {STAGES.map((s, i) => (
              <li key={s.key} className="min-w-0">
                <div className={cn("h-[3px] rounded-full", i < cur ? "bg-ink" : i === cur ? "bg-ink-3" : "bg-paper-3")} />
                <div className={cn("mt-2 text-[12px]", i === cur ? "font-medium text-ink" : i < cur ? "text-ink-2" : "text-ink-4")}>
                  {s.label}
                </div>
              </li>
            ))}
          </ol>
          {frac !== null && (
            <div className="mt-5">
              <div className="h-1.5 overflow-hidden rounded-full bg-paper-3">
                <div className="h-full rounded-full bg-engine transition-[width] duration-300" style={{ width: `${frac * 100}%` }} />
              </div>
              <div className="num mt-1.5 text-[11.5px] text-ink-3">
                {job.progress ?? 0} / {job.total ?? "—"} positions
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
