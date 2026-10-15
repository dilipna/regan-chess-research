"use client";

import { Hourglass } from "lucide-react";
import { useState } from "react";
import { KV, TechBlock, TechDetails } from "@/components/site/tech";
import { explainPosition } from "@/lib/explain";
import { fmtEval, fmtPct, isNum, moveLabel } from "@/lib/format";
import { MODEL_META, candidateOf, sortedCandidates, topMove, type Candidate, type ThreePosition } from "@/lib/three";
import { cn } from "@/lib/utils";
import { Prob, ProbBar, ThreeBoard, type ArrowSpec } from "./atoms";

export interface CuratedExample {
  id: string;
  title: string;
  rule: string;
  status: "ok" | "pending";
  pending_reason?: string;
  source?: string;
  position: ThreePosition | null;
}

export interface CuratedData {
  schema: string;
  generator: string;
  generated_utc: string;
  pool: { split: string; decisions: number; description: string };
  qwen: { status: "ok" | "pending"; model_id: string; prompt_hash: string };
  examples: CuratedExample[];
  note: string;
}

/** Rows shown by default: Maia top 6, Stockfish's 5 lines, the played move and the substitute. */
export function rowsFor(p: ThreePosition, all: boolean): Candidate[] {
  const byMaia = sortedCandidates(p, "maia");
  if (all) return byMaia;
  const keep = new Set<string>([...byMaia.slice(0, 6).map((c) => c.move), ...p.sf_lines.map((l) => l.move), p.original_move]);
  if (p.substitute_move) keep.add(p.substitute_move);
  return byMaia.filter((c) => keep.has(c.move));
}

function statCell(p: ThreePosition, c: Candidate) {
  if (c.sf_rank === 1) return <>P(engine #1) <span className="num">{fmtPct(p.regan.p_t1, 1)}</span></>;
  if (c.sf_rank != null && c.sf_rank <= 3) return <>top-3 line; P(top-3) <span className="num">{fmtPct(p.regan.p_t3, 1)}</span></>;
  return <span className="text-ink-4 italic">no per-move value</span>;
}

/** The comparison table: Move · engine rank · engine eval · statistical baseline · Qwen · Maia · played indicator. */
export function MoveTable({ p, qwenOk, onPick, selected }: { p: ThreePosition; qwenOk: boolean; onPick?: (m: string) => void; selected?: string }) {
  const [all, setAll] = useState(false);
  const rows = rowsFor(p, all);
  return (
    <div>
      <div className="overflow-x-auto rounded-md border border-rule bg-paper">
        <table className="w-full min-w-[640px] border-collapse text-[12.5px]">
          <caption className="sr-only">Every model&apos;s output for the legal moves of this position</caption>
          <thead>
            <tr className="border-b border-rule-strong bg-paper-2 text-left text-[11px] font-semibold tracking-[0.05em] text-ink-3 uppercase">
              <th scope="col" className="px-3 py-2">Move</th>
              <th scope="col" className="px-2 py-2">Engine rank</th>
              <th scope="col" className="px-2 py-2">Engine eval</th>
              <th scope="col" className="px-2 py-2" style={{ color: MODEL_META.R.color }}>Statistical baseline</th>
              <th scope="col" className="px-2 py-2" style={{ color: MODEL_META.Q.color }}>Qwen3-8B</th>
              <th scope="col" className="px-2 py-2" style={{ color: MODEL_META.M.color }}>Maia-3 79M</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const human = c.move === p.original_move, sub = c.move === p.substitute_move;
              return (
                <tr key={c.move} className={cn("border-b border-rule last:border-0", human && "bg-paper-2", selected === c.move && "outline outline-1 -outline-offset-1 outline-ink-3")}>
                  <th scope="row" className="px-3 py-1.5 text-left font-medium text-ink">
                    {onPick ? (
                      <button type="button" onClick={() => onPick(c.move)} className="num underline decoration-dotted underline-offset-2 hover:text-ink-2">{c.san}</button>
                    ) : (
                      <span className="num">{c.san}</span>
                    )}
                    {human && <span className="ml-1.5 rounded bg-ink px-1 text-[9.5px] font-semibold tracking-wide text-paper uppercase">played</span>}
                    {sub && <span className="ml-1.5 rounded bg-flag px-1 text-[9.5px] font-semibold tracking-wide text-paper uppercase">substitute</span>}
                  </th>
                  <td className="num px-2 py-1.5">{c.sf_rank != null ? `#${c.sf_rank}` : <span className="text-ink-4">&gt;5</span>}</td>
                  <td className="num px-2 py-1.5">{c.sf_cp != null ? fmtEval(c.sf_cp) : <span className="text-ink-4">—</span>}</td>
                  <td className="px-2 py-1.5 text-ink-2">{statCell(p, c)}</td>
                  <td className="px-2 py-1.5">
                    {qwenOk ? (<span><Prob value={c.qwen} /> <span className="text-ink-3">#{c.qwen_rank}</span></span>) : <Prob value={null} status="pending" />}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-12 shrink-0"><Prob value={c.maia} /></span>
                      <span className="hidden w-16 sm:block"><ProbBar value={c.maia} color={MODEL_META.M.color} /></span>
                      <span className="num text-ink-3">#{c.maia_rank}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-ink-3">
        <span>Engine = Stockfish 19, depth 12, MultiPV 5 (moves outside its 5 lines have no rank or eval). Eval is from the side to move&apos;s point of view.</span>
        <button type="button" onClick={() => setAll((a) => !a)} aria-pressed={all} className="rounded border border-rule-strong px-2 py-0.5 font-medium text-ink-2 hover:border-ink-3">
          {all ? `Show key moves only` : `Show all ${p.n_legal} legal moves`}
        </button>
      </div>
    </div>
  );
}

function Line({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-x-3 border-t border-rule py-2 first:border-t-0 sm:grid-cols-[8.5rem_1fr]">
      <div className="text-[11px] font-semibold tracking-[0.07em] uppercase" style={{ color }}>{label}</div>
      <div className="text-[13.5px] leading-relaxed text-ink-2">{children}</div>
    </div>
  );
}

/** "One move explained": deterministic sentences generated from the stored numbers. */
export function OneMoveExplained({ p, qwenOk }: { p: ThreePosition; qwenOk: boolean }) {
  const e = explainPosition(p, qwenOk);
  return (
    <div className="rounded-lg border border-rule-strong bg-paper p-4">
      <div className="font-serif text-[20px] font-semibold text-ink num">{moveLabel(p.move_no, p.color, p.original_san)} — {e.human}</div>
      <div className="mt-2">
        <Line label="Stockfish" color="var(--engine)">{e.engine}</Line>
        <Line label="Statistical" color={MODEL_META.R.color}>{e.statistical}</Line>
        <Line label="Qwen3-8B" color={MODEL_META.Q.color}>{qwenOk ? e.qwen : <span className="inline-flex items-start gap-1.5"><Hourglass className="mt-1 size-3.5 shrink-0" aria-hidden />{e.qwen}</span>}</Line>
        <Line label="Maia-3" color={MODEL_META.M.color}>{e.maia}</Line>
      </div>
      <div className="mt-3 grid gap-3 border-t border-rule pt-3 sm:grid-cols-2">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.07em] text-ink-3 uppercase">Where they agree</div>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-[13px] text-ink-2">{e.agree.length ? e.agree.map((s) => <li key={s}>{s}</li>) : <li>No two of the available signals pick the same move here.</li>}</ul>
        </div>
        <div>
          <div className="text-[11px] font-semibold tracking-[0.07em] text-ink-3 uppercase">Where they disagree</div>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-[13px] text-ink-2">{e.disagree.length ? e.disagree.map((s) => <li key={s}>{s}</li>) : <li>No disagreement among the available signals.</li>}</ul>
        </div>
      </div>
      {e.meaning && <p className="mt-3 rounded-md bg-paper-2 p-3 text-[13px] leading-relaxed text-ink"><span className="font-semibold">What it means. </span>{e.meaning}</p>}
      <p className="mt-2 text-[11.5px] text-ink-3">Sentences are generated from the stored numbers by fixed rules (no language model writes them).</p>
    </div>
  );
}

export function arrowsOf(p: ThreePosition): ArrowSpec[] {
  const san = (u: string) => candidateOf(p, u)?.san ?? u;
  const out: ArrowSpec[] = [{ uci: p.original_move, color: "var(--ink)", label: `Human played: ${san(p.original_move)}` }];
  const sf1 = p.sf_lines[0]?.move;
  if (sf1 && sf1 !== p.original_move) out.push({ uci: sf1, color: "var(--engine)", label: `Stockfish's first line: ${san(sf1)}` });
  const mt = topMove(p, "M");
  if (mt && mt.move !== p.original_move && mt.move !== sf1) out.push({ uci: mt.move, color: "var(--human)", label: `Maia-3's top move: ${mt.san}` });
  if (p.substitute_move && p.substitute_move !== sf1) out.push({ uci: p.substitute_move, color: "var(--flag)", label: `Controlled substitute: ${p.substitute_san}` });
  return out;
}

export function ExamplePanel({ ex, qwenOk }: { ex: CuratedExample; qwenOk: boolean }) {
  const p = ex.position;
  if (!p) {
    return (
      <div className="rounded-lg border border-dashed border-rule-strong bg-paper-2 p-5 text-[13.5px] leading-relaxed text-ink-2" role="status">
        <div className="flex items-center gap-2 font-semibold text-ink"><Hourglass className="size-4" aria-hidden /> Pending — {ex.pending_reason}</div>
        <p className="mt-2">This slot is reserved for a real position selected by a fixed rule once Qwen3-8B-Base has scored the held-out test split. No position, probability or ranking is shown until then, and nothing has been estimated in its place.</p>
        <p className="mt-2 text-ink-3"><span className="font-medium text-ink-2">Selection rule:</span> {ex.rule}</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-10">
      <div className="lg:sticky lg:top-20 lg:self-start">
        <ThreeBoard id={`board-${ex.id}`} fen={p.fen} orientation={p.color} arrows={arrowsOf(p)}
          title={<>Move {p.move_no}, {p.color === "white" ? "White" : "Black"} to move · player {p.elo} vs {p.opp_elo} · <span className="num">{p.n_legal}</span> legal moves</>}
          caption={ex.id === "engine-substitute"
            ? "A decision-level counterfactual evaluated in the original position (the game is not replayed)."
            : "A real held-out decision with the original (presumed-human) move. No substitution was made here."} />
      </div>
      <div className="min-w-0 space-y-5">
        <OneMoveExplained p={p} qwenOk={qwenOk} />
        <MoveTable p={p} qwenOk={qwenOk} />
        <TechDetails label="Why this example was selected">
          <TechBlock title="Selection (fixed rule, applied to the whole held-out test split)">
            <KV rows={[
              ["Position id", p.position_id],
              ["Rule", ex.rule],
              ["Source", ex.source ?? "test split"],
              ["Maia-3 entropy", isNum(p.entropy.maia) ? `${p.entropy.maia.toFixed(3)} nats` : "—"],
              ["Reconstruction difficulty", isNum(p.regan.difficulty) ? p.regan.difficulty.toFixed(3) : "—"],
            ]} />
          </TechBlock>
        </TechDetails>
      </div>
    </div>
  );
}

/** Tabbed explorer. Pending slots stay selectable and explain themselves (no dead buttons). */
export function ExampleExplorer({ data, initial }: { data: CuratedData; initial?: string }) {
  const [id, setId] = useState(initial && data.examples.some((e) => e.id === initial) ? initial : data.examples[0].id);
  const ex = data.examples.find((e) => e.id === id) ?? data.examples[0];
  const qwenOk = data.qwen.status === "ok";
  return (
    <div>
      <div role="tablist" aria-label="Curated examples" className="flex flex-wrap gap-2">
        {data.examples.map((e) => (
          <button key={e.id} type="button" role="tab" id={`tab-${e.id}`} aria-selected={e.id === id} aria-controls="example-panel" onClick={() => setId(e.id)}
            className={cn("rounded-md border px-3 py-1.5 text-left text-[12.5px] font-medium transition-colors",
              e.id === id ? "border-ink bg-ink text-paper" : "border-rule-strong bg-paper text-ink-2 hover:border-ink-3",
              e.status === "pending" && e.id !== id && "border-dashed text-ink-3")}>
            {e.title}{e.status === "pending" && <span className="ml-1.5 text-[10px] font-semibold tracking-wide uppercase opacity-80">pending</span>}
          </button>
        ))}
      </div>
      <div id="example-panel" role="tabpanel" aria-labelledby={`tab-${ex.id}`} className="mt-6">
        <ExamplePanel ex={ex} qwenOk={qwenOk} />
      </div>
    </div>
  );
}
