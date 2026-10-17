"use client";

import { Prov, showTok } from "./kit";

export interface RecallVersions {
  status: "ok"; model_id: string; dtype: string; passage: string; reference_copy: string; compared_copies: string[];
  versions_source: string; versions_source_name: string; versions_retrieved: string;
  n_scored: number; top1_hits: number; misses: number; miss_categories: Record<string, number>;
  recall_strict: number; recall_if_other_versions_accepted: number;
  misses_detail: { t: number; context_tail: string; true: string; predicted: string; rank: number; p_true: number; p_top: number; category: string; versions_with_prediction: string[]; evidence: Record<string, string | null> }[];
  caveats: string[];
}

const CAT_STYLE: Record<string, { label: string; cls: string }> = {
  "another version": { label: "another Lincoln manuscript's wording", cls: "bg-[var(--role-attn)]" },
  "punctuation / form": { label: "punctuation or formatting", cls: "bg-[var(--role-mlp)]" },
  "inside a word": { label: "inside a word", cls: "bg-[var(--role-norm)]" },
  other: { label: "other", cls: "bg-ink-4" },
};

function highlight(evidence: string, word: string) {
  const w = word.trim().replace(/^-/, "");
  // first occurrence of the word that starts at a word boundary (no regular expression needed)
  const lower = evidence.toLowerCase(), target = w.toLowerCase();
  let at = -1;
  for (let i = lower.indexOf(target); w && i >= 0; i = lower.indexOf(target, i + 1)) {
    if (i === 0 || !/[a-z]/.test(lower[i - 1])) { at = i; break; }
  }
  if (at < 0) return <>{evidence}</>;
  return <>{evidence.slice(0, at)}<mark className="rounded bg-[var(--role-attn-soft)] px-0.5 font-semibold text-ink">{evidence.slice(at, at + w.length)}</mark>{evidence.slice(at + w.length)}</>;
}

export function VersionsFinding({ v, compact }: { v: RecallVersions; compact?: boolean }) {
  const cases = v.misses_detail.filter((d) => d.category === "another version");
  const cats = Object.entries(v.miss_categories).filter(([, n]) => n > 0);
  return (
    <section className="ll-panel grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 rounded-2xl border-2 border-[var(--role-attn)] bg-paper p-5 [overflow-wrap:anywhere] sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] font-semibold tracking-wide text-[var(--role-attn-ink)] uppercase">Mistake, or another version?</div>
        <Prov kind="recorded" detail={`teacher-forced recall, ${v.dtype}; analysis of recorded predictions`} />
      </div>
      <h2 className="font-serif text-[26px] leading-tight font-semibold text-ink sm:text-[32px]">
        {cases.length} of Qwen&apos;s {v.misses} misses on the Gettysburg Address are the wording of another Lincoln manuscript.
      </h2>
      <p className="max-w-3xl text-[16px] leading-relaxed text-ink-2">
        Lincoln wrote out five copies of the speech, and they differ. The text scored here is the {v.reference_copy} copy. Where Qwen&apos;s top prediction was &quot;wrong&quot;, it
        sometimes produced exactly what the {v.compared_copies.join(", ")} copies say at that point.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-paper-2/60 p-4"><div className="text-[13px] text-ink-3">top-1 recall against the {v.reference_copy} copy</div><div className="num font-serif text-[36px] text-ink">{(v.recall_strict * 100).toFixed(1)}%</div></div>
        <div className="rounded-xl bg-[var(--role-attn-soft)] p-4"><div className="text-[13px] text-ink-3">if any of the five manuscripts&apos; wording counts</div><div className="num font-serif text-[36px] text-ink">{(v.recall_if_other_versions_accepted * 100).toFixed(1)}%</div></div>
        <div className="rounded-xl bg-paper-2/60 p-4"><div className="text-[13px] text-ink-3">scored positions</div><div className="num font-serif text-[36px] text-ink">{v.n_scored}</div><div className="text-[12.5px] text-ink-3">{v.top1_hits} hits, {v.misses} misses</div></div>
      </div>
      <figure>
        <figcaption className="mb-1.5 text-[14px] font-medium text-ink-2">What the {v.misses} misses are</figcaption>
        <div className="flex h-9 w-full overflow-hidden rounded-lg" role="img" aria-label={cats.map(([k, n]) => `${CAT_STYLE[k]?.label ?? k}: ${n}`).join(", ")}>
          {cats.map(([k, n]) => <div key={k} className={`${CAT_STYLE[k]?.cls} ll-anim h-full border-r-2 border-paper`} style={{ width: `${(n / v.misses) * 100}%` }} />)}
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13.5px] text-ink-2">
          {cats.map(([k, n]) => <li key={k} className="flex items-center gap-1.5"><span className={`${CAT_STYLE[k]?.cls} inline-block h-3 w-3 rounded-sm`} />{CAT_STYLE[k]?.label ?? k}: <strong className="num">{n}</strong></li>)}
        </ul>
      </figure>
      <ol className={`grid gap-3 ${compact ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3"}`}>
        {(compact ? cases.slice(0, 4) : cases).map((d) => (
          <li key={d.t} className="rounded-xl border border-rule bg-paper p-4">
            <p className="font-serif text-[16px] text-ink-2">…{d.context_tail.slice(-38)}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[14px]">
              <div className="rounded-lg bg-paper-2 p-2"><div className="text-[11.5px] text-ink-3 uppercase">{v.reference_copy} copy</div><div className="font-mono">{showTok(d.true)}</div></div>
              <div className="rounded-lg bg-[var(--role-attn-soft)] p-2"><div className="text-[11.5px] text-ink-3 uppercase">Qwen&apos;s top guess</div><div className="font-mono">{showTok(d.predicted)}</div></div>
            </div>
            <ul className="mt-2 grid gap-1 text-[13.5px] text-ink-2">
              {Object.entries(d.evidence).map(([name, ev]) => ev && <li key={name}><strong className="text-ink">{name} copy:</strong> <span className="font-serif">…{highlight(ev, d.predicted)}…</span></li>)}
            </ul>
          </li>
        ))}
      </ol>
      {compact && cases.length > 4 && <p className="text-[13.5px] text-ink-3">{cases.length - 4} more on the Recall page.</p>}
      <div className="grid gap-2 rounded-xl bg-paper-2/60 p-4 text-[14.5px] text-ink-2">
        <p><strong className="text-ink">Why this matters for recall plateaus.</strong> A recall score is measured against one reference text. For a famous text that exists in several authentic versions, some &quot;errors&quot; are disagreements between versions, so the measurable ceiling can sit below 100% even for a model that has seen all of them. Before comparing two models&apos; recall (for example around 86%), it is worth checking which transcript was used and whether the misses coincide with known variants.</p>
        <ul className="list-disc space-y-1 pl-5 text-[13.5px]">{v.caveats.map((c) => <li key={c}>{c}</li>)}</ul>
        <p className="text-[12.5px] text-ink-3">Manuscript transcriptions: {v.versions_source_name}, retrieved {v.versions_retrieved} ({v.versions_source}).</p>
      </div>
    </section>
  );
}
