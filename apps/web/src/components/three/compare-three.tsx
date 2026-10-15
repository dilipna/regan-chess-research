"use client";

import { ArrowLeftRight, Radio, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { KV, TechBlock, TechDetails } from "@/components/site/tech";
import { fmtEval, fmtNum, fmtPct, fmtSigned, isNum, moveLabel } from "@/lib/format";
import {
  LIVE_URL,
  MODEL_META,
  candidateOf,
  checkLive,
  featuredPosition,
  positionFen,
  reganForMove,
  shownMove,
  sortedCandidates,
  surprisal,
  topMove,
  type LiveMode,
  type SortKey,
  type ThreeDemo,
  type ThreePosition,
  type Version,
} from "@/lib/three";
import { cn } from "@/lib/utils";
import { ModelBadge, Prob, ProbBar, ThreeBoard, type ArrowSpec } from "./atoms";
import { LivePanel } from "./live-panel";

const STUDY_LABEL: Record<string, string> = {
  "human-baseline": "Human baseline",
  "obvious-assistance": "Obvious controlled assistance",
  "selective-critical": "Selective controlled assistance",
};

export function CompareThree({ demo, initialPly }: { demo: ThreeDemo; initialPly?: number }) {
  const [ply, setPly] = useState(initialPly ?? featuredPosition(demo).ply);
  const pos = demo.positions.find((p) => p.ply === ply) ?? featuredPosition(demo);
  const [version, setVersion] = useState<Version>(pos.substitute_move ? "substitute" : "original");
  const [picked, setPicked] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("maia");
  const [expert, setExpert] = useState(false);
  const [live, setLive] = useState<LiveMode>("checking");

  useEffect(() => {
    let alive = true;
    checkLive(LIVE_URL).then((m) => alive && setLive(m));
    return () => {
      alive = false;
    };
  }, []);

  const v: Version = pos.substitute_move ? version : "original";
  const played = shownMove(pos, v);
  const selected = picked && candidateOf(pos, picked) ? picked : played;
  const qStatus = demo.models.Q.status;
  const showQ = qStatus === "ok"; // the LLM column appears automatically once real Qwen scores exist

  const choosePly = (p: ThreePosition) => {
    setPly(p.ply);
    setPicked(null);
    setVersion(p.substitute_move ? "substitute" : "original");
  };

  const arrows: ArrowSpec[] = useMemo(() => {
    const out: ArrowSpec[] = [];
    const san = (u: string) => candidateOf(pos, u)?.san ?? u;
    out.push({
      uci: played,
      color: v === "substitute" ? "var(--flag)" : "var(--ink)",
      label: `${v === "substitute" ? "Controlled engine substitute" : "Original human move"}: ${moveLabel(pos.move_no, pos.color, san(played))}`,
    });
    if (selected !== played) out.push({ uci: selected, color: "var(--ink-3)", label: `Selected candidate: ${moveLabel(pos.move_no, pos.color, san(selected))}` });
    const sfb = pos.sf_lines[0]?.move;
    if (sfb && sfb !== played && sfb !== selected) out.push({ uci: sfb, color: "var(--engine)", label: `Stockfish's first line: ${san(sfb)}` });
    return out;
  }, [pos, played, selected, v]);

  return (
    <div>
      <ModeBar live={live} />
      <PositionStrip demo={demo} ply={pos.ply} onPick={choosePly} />

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:gap-10">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <ThreeBoard
            id="board-three"
            fen={positionFen(pos, v)}
            orientation={pos.color}
            title={
              <>
                Move {pos.move_no}, {pos.color === "white" ? "White" : "Black"} to move · player {pos.elo} vs {pos.opp_elo} ·{" "}
                <span className="num">{pos.n_legal}</span> legal moves
              </>
            }
            arrows={arrows}
            caption={
              pos.substitute_move ? (
                <>This is a decision-level counterfactual evaluated in the original position: the board never changes; only the move being
                  evaluated does. Later positions of the game are not replayed.</>
              ) : (
                <>This decision was not altered in any prepared study; only the original human move exists here.</>
              )
            }
          />
        </div>

        <div className="min-w-0">
          <PlayedHeader pos={pos} v={v} setVersion={(x) => { setVersion(x); setPicked(null); }} played={played} />

          <div className={cn("mt-5 grid gap-3", showQ ? "md:grid-cols-3" : "md:grid-cols-2")}>
            <ReganColumn pos={pos} move={selected} expert={expert} />
            {showQ && <ProbColumn model="Q" pos={pos} move={selected} status={qStatus} expert={expert} />}
            <ProbColumn model="M" pos={pos} move={selected} status="ok" expert={expert} />
          </div>
          <p className="mt-2 text-[12px] text-ink-3">
            Showing <span className="num font-medium text-ink-2">{candidateOf(pos, selected)?.san ?? selected}</span>
            {selected === played ? (v === "substitute" ? " (the controlled engine substitute)" : " (the move actually played)") : " (selected candidate)"}.
            Click any legal move below to see what each model assigns to it.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-serif text-[19px] font-semibold text-ink">Every legal move</h3>
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <label className="text-ink-3" htmlFor="sort3">Sort by</label>
              <select id="sort3" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded border border-rule-strong bg-paper px-2 py-1 text-[12px] text-ink">
                <option value="maia">Maia-3 probability</option>
                {showQ && <option value="qwen">Qwen probability</option>}
                <option value="engine">Stockfish rank</option>
              </select>
              <button type="button" onClick={() => setExpert((e) => !e)} aria-pressed={expert}
                className={cn("rounded border px-2.5 py-1 font-medium", expert ? "border-ink bg-ink text-paper" : "border-rule-strong text-ink-2 hover:border-ink-3")}>
                {expert ? "Expert view" : "Beginner view"}
              </button>
            </div>
          </div>
          <CandidateTable pos={pos} sort={sort} selected={selected} played={played} v={v} onPick={setPicked} expert={expert} qStatus={qStatus} />

          <TechDetails label="Technical details for this position" className="mt-6">
            <TechMechanics demo={demo} pos={pos} />
          </TechDetails>

          {live === "live" && <LivePanel pos={pos} played={played} />}
        </div>
      </div>

      <StudyTable demo={demo} />
    </div>
  );
}

function ModeBar({ live }: { live: LiveMode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 text-[12px]">
      {live === "live" ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-finding/40 bg-tint-finding px-2.5 py-0.5 font-semibold tracking-[0.06em] text-finding uppercase">
          <Radio className="size-3.5" aria-hidden /> Live model comparison
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rule-strong bg-paper-2 px-2.5 py-0.5 font-semibold tracking-[0.06em] text-ink-2 uppercase">
          Prepared research study
        </span>
      )}
      <span className="text-ink-3">
        {live === "checking"
          ? "Checking for the live GPU service… the prepared study below is complete without it."
          : live === "live"
            ? "Prepared outputs are shown; the live service can re-score this position on demand."
            : "Precomputed outputs of every model, served with the site. No live backend is needed."}
      </span>
    </div>
  );
}

function PositionStrip({ demo, ply, onPick }: { demo: ThreeDemo; ply: number; onPick: (p: ThreePosition) => void }) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-[12px] text-ink-3">
        <span>
          {demo.positions.length} decisions of one prepared player-game ({demo.player.color}, rated {demo.player.elo}).
          <span className="ml-2 inline-flex items-center gap-1"><span className="inline-block size-2 rounded-full bg-flag" /> substituted in a prepared study</span>
        </span>
        <span className="inline-flex items-center gap-1"><Star className="size-3" aria-hidden /> featured position</span>
      </div>
      <div className="no-scrollbar flex gap-1 overflow-x-auto pb-1" role="listbox" aria-label="Decisions">
        {demo.positions.map((p) => {
          const on = p.ply === ply;
          return (
            <button key={p.ply} type="button" role="option" aria-selected={on} onClick={() => onPick(p)}
              title={`Move ${p.move_no}: ${p.original_san}${p.substitute_san ? ` (substitute ${p.substitute_san})` : ""}`}
              className={cn("relative shrink-0 rounded border px-2 py-1 text-[11.5px] num transition-colors",
                on ? "border-ink bg-ink text-paper" : "border-rule-strong bg-paper text-ink-2 hover:border-ink-3")}>
              {p.move_no}
              {p.ply === demo.featured_ply && <Star className="ml-0.5 inline size-2.5 -translate-y-px" aria-label="featured" />}
              {p.substitute_move && <span aria-label="substituted" className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-flag" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PlayedHeader({ pos, v, setVersion, played }: { pos: ThreePosition; v: Version; setVersion: (v: Version) => void; played: string }) {
  const c = candidateOf(pos, played);
  return (
    <div className="rounded-lg border border-rule-strong bg-paper p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
            {v === "substitute" ? "Controlled engine substitute" : "Played move (original human move)"}
          </div>
          <div className="mt-0.5 font-serif text-[26px] leading-none font-semibold text-ink num">
            {moveLabel(pos.move_no, pos.color, c?.san ?? played)}
          </div>
        </div>
        {pos.substitute_move && (
          <div role="group" aria-label="Which move to evaluate" className="inline-flex items-center rounded-md border border-rule-strong p-0.5 text-[12.5px]">
            <button type="button" aria-pressed={v === "original"} onClick={() => setVersion("original")}
              className={cn("rounded px-2.5 py-1 font-medium", v === "original" ? "bg-ink text-paper" : "text-ink-2 hover:text-ink")}>
              Original human move · {pos.original_san}
            </button>
            <ArrowLeftRight className="mx-1 size-3.5 text-ink-4" aria-hidden />
            <button type="button" aria-pressed={v === "substitute"} onClick={() => setVersion("substitute")}
              className={cn("rounded px-2.5 py-1 font-medium", v === "substitute" ? "bg-flag text-paper" : "text-ink-2 hover:text-ink")}>
              Controlled engine substitute · {pos.substitute_san}
            </button>
          </div>
        )}
      </div>
      {pos.substitute_move && (
        <p className="mt-2 text-[12px] leading-relaxed text-ink-3">
          Substituted in: {pos.substituted_in.map((s) => STUDY_LABEL[s] ?? s).join(", ")}. The player actually chose {pos.original_san}; the
          substitute {pos.substitute_san} is Stockfish&apos;s first line, inserted by the controlled experiment.
        </p>
      )}
    </div>
  );
}

function Column({ model, children, footer }: { model: "R" | "Q" | "M"; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col rounded-lg border bg-paper p-3.5" style={{ borderColor: `color-mix(in oklab, ${MODEL_META[model].color} 35%, var(--rule))` }}>
      <ModelBadge model={model} />
      <div className="mt-3 flex-1 space-y-2.5">{children}</div>
      {footer && <div className="mt-3 border-t border-rule pt-2 text-[11.5px] leading-snug text-ink-3">{footer}</div>}
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[13px]">
      <span className="text-ink-3">{k}</span>
      <span className="text-right font-medium text-ink">{children}</span>
    </div>
  );
}

function ReganColumn({ pos, move, expert }: { pos: ThreePosition; move: string; expert: boolean }) {
  const r = reganForMove(pos, move);
  const first = candidateOf(pos, pos.regan.engine_first_move);
  return (
    <Column
      model="R"
      footer="Statistical projection from Elo and engine-derived position difficulty. It projects how often a player of this rating matches the engine; it does not give every legal move a probability."
    >
      <Row k="Predicted rank">
        <span className="text-ink-4 italic">not defined</span>
      </Row>
      <Row k="Move probability">
        <span className="text-ink-4 italic">not defined</span>
      </Row>
      <Row k="Engine rank of this move">{r.engineRank ? `#${r.engineRank}` : "outside top 5"}</Row>
      <Row k="P(engine's first choice)">
        <Prob value={r.p_t1} />
      </Row>
      <Row k="P(one of engine's top 3)">
        <Prob value={r.p_t3} />
      </Row>
      <Row k="Engine's first choice">{first?.san ?? pos.regan.engine_first_move}</Row>
      {expert && (
        <div className="text-[12px] text-ink-3">
          Position difficulty {fmtNum(r.difficulty, 3)} · expected loss {fmtNum(pos.regan.expected_loss_cp, 1)} cp · P(EV match) {fmtPct(pos.regan.p_ev, 1)}
        </div>
      )}
    </Column>
  );
}

function ProbColumn({ model, pos, move, status, expert }: { model: "Q" | "M"; pos: ThreePosition; move: string; status: "ok" | "pending"; expert: boolean }) {
  const c = candidateOf(pos, move);
  const p = model === "M" ? c?.maia : c?.qwen;
  const rank = model === "M" ? c?.maia_rank : c?.qwen_rank;
  const top = topMove(pos, model);
  const footer =
    model === "M"
      ? "A Chessformer-based transformer trained on human games and conditioned on both players' ratings. Not a language model."
      : "Every legal move is scored by the LLM's token likelihoods and normalized over the legal moves. No verdict or self-reported confidence is asked for.";
  return (
    <Column model={model} footer={footer}>
      {status === "pending" ? (
        <>
          <Row k="Predicted rank"><Prob value={null} status="pending" /></Row>
          <Row k="Move probability"><Prob value={null} status="pending" /></Row>
          <Row k="Top predicted move"><Prob value={null} status="pending" /></Row>
        </>
      ) : (
        <>
          <Row k="Predicted rank">{isNum(rank) ? `#${rank} of ${pos.n_legal}` : "—"}</Row>
          <Row k="Move probability"><Prob value={p} /></Row>
          <ProbBar value={p} color={MODEL_META[model].color} />
          <Row k="Top predicted move">
            {top ? <>{top.san} <span className="font-normal text-ink-3">(<Prob value={model === "M" ? top.maia : top.qwen} />)</span></> : "—"}
          </Row>
          {expert && (
            <div className="space-y-0.5 text-[12px] text-ink-3 num">
              <div>surprisal −ln P = {fmtNum(surprisal(p), 3)} nats</div>
              {model === "Q" && <div>Σ token log-prob = {fmtNum(c?.qwen_logprob, 3)} over {c?.qwen_n_tokens ?? "—"} tokens</div>}
              {model === "M" && <div>Maia-3 5M (existing pipeline): {fmtPct(c?.maia5, 2)} · rank #{c?.maia5_rank ?? "—"}</div>}
              <div>entropy {fmtNum(model === "M" ? pos.entropy.maia : pos.entropy.qwen, 3)} nats</div>
            </div>
          )}
        </>
      )}
    </Column>
  );
}

function CandidateTable({ pos, sort, selected, played, v, onPick, expert, qStatus }: {
  pos: ThreePosition; sort: SortKey; selected: string; played: string; v: Version; onPick: (m: string) => void; expert: boolean; qStatus: "ok" | "pending";
}) {
  const rows = sortedCandidates(pos, sort);
  return (
    <div className="mt-3 max-h-[440px] overflow-auto rounded-md border border-rule">
      <table className="w-full text-[12.5px]">
        <thead className="sticky top-0 z-10 bg-paper-2 text-left text-[11px] tracking-[0.05em] text-ink-3 uppercase">
          <tr>
            <th className="px-2.5 py-2 font-semibold">Move</th>
            <th className="px-2 py-2 font-semibold">Engine</th>
            <th className="px-2 py-2 font-semibold" style={{ color: MODEL_META.M.color }}>Maia-3</th>
            {qStatus === "ok" && <th className="px-2 py-2 font-semibold" style={{ color: MODEL_META.Q.color }}>Qwen3-8B</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const isPlayed = c.move === played;
            const isOrig = c.move === pos.original_move;
            const isSub = c.move === pos.substitute_move;
            const on = c.move === selected;
            return (
              <tr key={c.move} onClick={() => onPick(c.move)} aria-selected={on}
                className={cn("cursor-pointer border-t border-rule transition-colors", on ? "bg-paper-3" : "hover:bg-paper-2")}>
                <td className="px-2.5 py-1.5">
                  <button type="button" onClick={(e) => { e.stopPropagation(); onPick(c.move); }} className="num font-medium text-ink outline-none focus-visible:underline">
                    {c.san}
                  </button>
                  {expert && <span className="ml-1.5 text-[11px] text-ink-4 num">{c.move}</span>}
                  {isOrig && <Tag tone={isPlayed && v === "original" ? "ink" : "muted"}>human</Tag>}
                  {isSub && <Tag tone={isPlayed && v === "substitute" ? "flag" : "muted"}>substitute</Tag>}
                </td>
                <td className="px-2 py-1.5 num text-ink-2">
                  {c.sf_rank ? <>#{c.sf_rank} <span className="text-ink-3">{fmtEval(c.sf_cp)}</span></> : <span className="text-ink-4">—</span>}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-12 shrink-0 text-right"><Prob value={c.maia} digits={expert ? 2 : 1} /></span>
                    <ProbBar value={c.maia} color={MODEL_META.M.color} className="hidden w-16 sm:block" />
                  </div>
                </td>
                {qStatus === "ok" && (
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-12 shrink-0 text-right"><Prob value={c.qwen} digits={expert ? 2 : 1} /></span>
                      <ProbBar value={c.qwen} color={MODEL_META.Q.color} className="hidden w-16 sm:block" />
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone: "ink" | "flag" | "muted" }) {
  return (
    <span className={cn("ml-1.5 rounded px-1 py-px text-[10px] font-semibold tracking-[0.05em] uppercase",
      tone === "ink" ? "bg-ink text-paper" : tone === "flag" ? "bg-flag text-paper" : "border border-rule-strong text-ink-3")}>
      {children}
    </span>
  );
}

function TechMechanics({ demo, pos }: { demo: ThreeDemo; pos: ThreePosition }) {
  const q = demo.models.Q;
  return (
    <div className="space-y-0">
      {q.status !== "ok" ? (
        <TechBlock title="LLM experiment (next step)">
          <p className="text-ink-2">
            Qwen3-8B-Base ({q.model_id} @ {q.revision.slice(0, 12)}) will be scored on this exact position with the frozen prompt below (SHA-256{" "}
            <span className="break-all">{q.prompt_hash.slice(0, 16)}…</span>): every legal move&apos;s token likelihood, normalized over the legal moves. It has not
            been run yet, so no LLM values are shown.
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer text-[12px] text-ink-2 underline decoration-dotted underline-offset-2">Show the exact prompt for this position</summary>
            <pre className="mt-2 max-h-72 overflow-auto rounded border border-rule bg-paper p-2 text-[11px] leading-snug whitespace-pre-wrap text-ink-2">{pos.qwen_prompt}</pre>
          </details>
        </TechBlock>
      ) : (
      <TechBlock title="Qwen3-8B-Base scoring">
        <KV rows={[
          ["Model", `${q.model_id} @ ${q.revision.slice(0, 12)}`],
          ["Status", q.status === "ok" ? "scored" : "pending — held-out run not yet done"],
          ["Prompt (Regan-aligned) SHA-256", <span key="h" className="break-all">{q.prompt_hash}</span>],
          ["Candidate continuation", "“ <uci>\\n” after “Move:”"],
          ["Score", "Σ log P(token) over every candidate token (no length normalization)"],
          ["Normalization", "softmax (log-sum-exp) over the legal moves only"],
          ["Sampling", "none — nothing is generated"],
          ["Candidates", `${pos.n_legal} legal moves (python-chess), lexicographic order in the prompt`],
        ]} />
        <details className="mt-2">
          <summary className="cursor-pointer text-[12px] text-ink-2 underline decoration-dotted underline-offset-2">Show the exact prompt for this position</summary>
          <pre className="mt-2 max-h-72 overflow-auto rounded border border-rule bg-paper p-2 text-[11px] leading-snug whitespace-pre-wrap text-ink-2">{pos.qwen_prompt}</pre>
          <p className="mt-1 text-[11.5px] text-ink-3">The target move is never marked; the played move&apos;s own engine value is shown only if it is one of Stockfish&apos;s five lines.</p>
        </details>
      </TechBlock>
      )}
      <TechBlock title="Maia-3">
        <KV rows={[
          ["Primary checkpoint", `${demo.models.M.checkpoint} @ ${demo.models.M.revision.slice(0, 12)}`],
          ["Existing-pipeline checkpoint", `${demo.models.M5.checkpoint} @ ${demo.models.M5.revision.slice(0, 12)} (used inside hybrid systems C/D)`],
          ["Input", "current position + up to 7 previous positions; side-to-move and opponent Elo"],
          ["Output", "softmax of the policy logits over the legal moves"],
        ]} />
      </TechBlock>
      <TechBlock title="Regan-inspired reconstruction">
        <KV rows={[
          ["Position difficulty", fmtNum(pos.regan.difficulty, 4)],
          ["Projected P(T1 match)", fmtNum(pos.regan.p_t1, 4)],
          ["Projected P(top-3 match)", fmtNum(pos.regan.p_t3, 4)],
          ["Projected P(EV match)", fmtNum(pos.regan.p_ev, 4)],
          ["Expected capped loss", `${fmtNum(pos.regan.expected_loss_cp, 1)} cp`],
          ["Stockfish lines", pos.sf_lines.map((l) => `${l.san} ${fmtSigned(l.cp / 100)}`).join(" · ")],
        ]} />
        <p className="mt-2 text-[11.5px] text-ink-3">
          Elo band × difficulty-decile projection fitted on training decisions only (projection.json). A reconstruction based on
          Professor Regan&apos;s publicly documented framework, not his private production analyzer.
        </p>
      </TechBlock>
    </div>
  );
}

function StudyTable({ demo }: { demo: ThreeDemo }) {
  const q = demo.models.Q.status;
  return (
    <section className="mt-14 border-t border-rule pt-8" aria-labelledby="studies3">
      <h3 id="studies3" className="font-serif text-[21px] font-semibold text-ink">The same player-game in the three prepared studies</h3>
      <p className="mt-1 max-w-3xl text-[13px] text-ink-3">
        Game-level signals over all {demo.positions.length} decisions. Higher z(top-1) = more engine matches than projected; higher mean
        surprisal = moves less expected by the human-move model. These are assistance-sensitive scores, not probabilities of cheating.
      </p>
      <div className="mt-4 overflow-x-auto rounded-md border border-rule">
        <table className="w-full min-w-[560px] text-[12.5px]">
          <thead className="bg-paper-2 text-left text-[11px] tracking-[0.05em] text-ink-3 uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Study</th>
              <th className="px-3 py-2 font-semibold">Substituted</th>
              <th className="px-3 py-2 font-semibold" style={{ color: MODEL_META.R.color }}>Regan-inspired z(top-1)</th>
              {q === "ok" && <th className="px-3 py-2 font-semibold" style={{ color: MODEL_META.Q.color }}>Qwen mean surprisal</th>}
              <th className="px-3 py-2 font-semibold" style={{ color: MODEL_META.M.color }}>Maia-3 mean surprisal</th>
              <th className="px-3 py-2 font-semibold">Hybrid D estimate</th>
            </tr>
          </thead>
          <tbody>
            {demo.studies.map((s) => (
              <tr key={s.id} className="border-t border-rule">
                <td className="px-3 py-2 font-medium text-ink">{STUDY_LABEL[s.id] ?? s.id}</td>
                <td className="px-3 py-2 num text-ink-2">
                  {s.target_level ? `${Math.round(s.target_level * 100)}% target · ${fmtPct(s.realized_alpha, 1)} realized` : "none (original)"}
                </td>
                <td className="px-3 py-2 num">{fmtSigned(s.game_scores.R_z_t1)}</td>
                {q === "ok" && <td className="px-3 py-2 num">{fmtNum(s.game_scores.Q_mean_surprisal, 3)}</td>}
                <td className="px-3 py-2 num">{fmtNum(s.game_scores.M_mean_surprisal, 3)}</td>
                <td className="px-3 py-2 num text-ink-2">{fmtPct(s.existing_hybrid_D_estimate, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11.5px] text-ink-3">
        Hybrid D estimate = the existing &ldquo;synthetic-equivalent assistance estimate&rdquo; of System D (unchanged). Substitutions are controlled
        decision-level substitutions evaluated in the original positions.
      </p>
    </section>
  );
}
