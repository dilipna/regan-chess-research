"use client";

import { ShapBars } from "@/components/explain/shap-bars";
import { Chip } from "@/components/site/atoms";
import { KV, TechBlock, TechDetails, Term } from "@/components/site/tech";
import { uciToSan } from "@/lib/chess";
import { DASH, fmtEval, fmtNum, fmtPct, isNum, moveLabel } from "@/lib/format";
import { THRESHOLDS, difficultyLevel, engineQuality, humanPlausibility, patternContext, positionSentence, whyHighlighted } from "@/lib/semantics";
import type { PlayerReport, TimelineRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { sfRankText, type PlyView } from "./derive";
import { EngineLines, MaiaTop } from "./position-intel";

/** dim = which view the reading belongs to (sets its color); signal = the reading is part of the highlighted pattern. */
type Dim = "engine" | "human" | "neutral";

function Reading({ label, value, dim, signal = false, tip, technical, prov }: { label: string; value: string; dim: Dim; signal?: boolean; tip: string; technical: string; prov?: "ours" | "approx" }) {
  const dot = signal ? "bg-flag" : dim === "engine" ? "bg-engine" : dim === "human" ? "bg-human" : "bg-ink-4";
  return (
    <div className="rounded-md border border-rule bg-paper px-3.5 py-3">
      <div className="text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase">
        <Term tip={tip} technical={technical} prov={prov}>
          {label}
        </Term>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span aria-hidden className={cn("h-2 w-2 rounded-full", dot)} />
        <span className="text-[17px] font-semibold text-ink">{value}</span>
      </div>
    </div>
  );
}

export function Inspector({ view, player, analyzedLabel }: { view: PlyView; player: PlayerReport | null | undefined; analyzedLabel: string }) {
  if (view.isFinal)
    return <Empty title="Final position" text="End of game. Step back with ← or pick a highlighted moment on the timeline." />;
  const row = view.row;
  const mv = view.move!;
  if (!row) {
    const own = player && player.color === view.moveColor;
    return (
      <Empty
        title={moveLabel(view.moveNo, view.moveColor, mv.san)}
        text={
          own
            ? "Opening move — the first eight moves are skipped because they are usually memorized, so they are not analyzed."
            : `A move by the opponent. The inspector explains the analyzed player's moves (${analyzedLabel}).`
        }
      />
    );
  }
  return <RowInspector row={row} player={player} />;
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="border-b border-rule pb-3 font-serif text-[22px] font-semibold tracking-tight text-ink">{title}</h3>
      <p className="pt-4 text-[13.5px] leading-relaxed text-ink-3">{text}</p>
    </div>
  );
}

export function RowInspector({ row, player, showTech = true }: { row: TimelineRow; player?: PlayerReport | null; showTech?: boolean }) {
  const san = row.display_san || uciToSan(row.fen, row.move);
  const eq = engineQuality(row);
  const hp = humanPlausibility(row.maia_p);
  const df = difficultyLevel(row.difficulty, player);
  const pc = patternContext(player, row.ply);
  const elo = player?.elo;
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2 border-b border-rule pb-3">
        <h3 className="font-serif text-[24px] font-semibold tracking-tight text-ink">
          {row.substituted ? `${moveLabel(row.move_no, row.color, row.san)} → ${san}` : moveLabel(row.move_no, row.color, san)}
        </h3>
        {row.substituted && <Chip tone="flag">Counterfactual substitution</Chip>}
        {row.flag_triple && <Chip tone="flag">Highlighted moment</Chip>}
        {!row.eligible && <Chip>Not scored</Chip>}
      </div>

      {row.substituted && (
        <div className="mt-3 rounded-md border border-flag/25 bg-flag-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-2">
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-[10.5px] font-semibold tracking-[0.06em] text-ink-3 uppercase">Original game move</dt>
              <dd className="num mt-0.5 text-[17px] font-semibold text-ink">{row.san}</dd>
            </div>
            <div>
              <dt className="text-[10.5px] font-semibold tracking-[0.06em] text-flag uppercase">Counterfactual substitution</dt>
              <dd className="num mt-0.5 text-[17px] font-semibold text-ink">{san}</dd>
            </div>
          </dl>
          <p className="mt-2">
            The substitute is evaluated in this original position. The game record continues with the original move{" "}
            <span className="num">{row.san}</span>; later positions are those of the original game, not a replayed game. The readings
            below describe the substitute.
          </p>
        </div>
      )}
      {!row.eligible && (
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">
          Not scored:{" "}
          {row.ply < 16
            ? "opening move (the first eight moves per side are skipped)."
            : isNum(row.n_legal) && row.n_legal < 2
              ? "the move was forced."
              : isNum(row.eval_before) && Math.abs(row.eval_before) > 300
                ? "the game was already decided (advantage above 3 pawns)."
                : "the engine returned fewer than two candidate lines."}{" "}
          Shown for context only.
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <Reading
          label="Engine quality"
          value={eq.label}
          dim="engine"
          signal={eq.tone === "bad"}
          tip="How strong the move is according to Stockfish, the world's strongest open-source engine."
          technical={`Stockfish rank ${sfRankText(row)} · loss ${isNum(row.cpl) ? fmtNum(row.cpl, 0) : DASH} cp`}
        />
        <Reading
          label="Human plausibility"
          value={hp.label}
          dim="human"
          signal={hp.level === "low"}
          tip="Model-estimated human plausibility: the predicted probability Maia-3 assigns to this move for a player of this rating. A model estimate, not an observed frequency of players."
          technical={`Maia-3 predicted probability ${fmtPct(row.maia_p, 1)} · Maia rank ${isNum(row.maia_rank) ? `#${row.maia_rank}` : DASH}`}
          prov="ours"
        />
        <Reading
          label="Position difficulty"
          value={df.label}
          dim="neutral"
          tip="How hard it is for a player of this rating to find the engine's best move in this position."
          technical={`difficulty ${fmtNum(row.difficulty, 2)} = 1 − projected top-1 probability`}
          prov="approx"
        />
        <Reading
          label="Pattern over time"
          value={pc.unusual ? "Unusual" : pc.label === "Too early to tell" ? "Too early" : pc.label.startsWith("Below") ? "Below expected" : "Typical"}
          dim="neutral"
          signal={pc.unusual}
          tip="Whether engine agreement over the last few moves is far above what was expected for these positions."
          technical={`last ${pc.window} decisions: ${fmtPct(pc.observed, 0)} engine agreement vs ${fmtPct(pc.expected, 0)} expected`}
          prov="ours"
        />
      </div>

      <p className="mt-4 text-[14px] leading-relaxed text-ink">{positionSentence(row, player, elo)}</p>
      {row.flag_triple && (
        <p className="mt-2 rounded-md border border-flag/20 bg-flag-soft px-3 py-2 text-[12.5px] leading-relaxed text-ink-2">{whyHighlighted()}</p>
      )}

      {showTech && (
        <TechDetails>
          <div className="space-y-0">
            <TechBlock title="Stockfish">
              <KV
                rows={[
                  ["Rank of move", `${sfRankText(row)}${row.sf_rank_censored ? " (outside the 5 analyzed lines)" : ""}`],
                  ["Centipawn loss", isNum(row.cpl) ? `${fmtNum(row.cpl, 1)} cp` : DASH],
                  ["Evaluation before move", fmtEval(row.eval_before)],
                  ["Best − second-best gap", isNum(row.gap12) ? `${fmtNum(row.gap12, 0)} cp` : DASH],
                  ["Near-optimal alternatives", isNum(row.near_opt) ? `${row.near_opt} within 25 cp` : DASH],
                  ["Search", `depth ${row.sf_depth ?? "—"}, MultiPV 5${row.sf_quick ? " (decided-position prefilter only)" : ""}`],
                  ["Display rule", `Excellent ≤ ${THRESHOLDS.engine[0].max} cp or rank #1; Good ≤ 50; Inaccurate ≤ 100; Mistake ≤ 300`],
                ]}
              />
              <EngineLines row={row} />
            </TechBlock>
            <TechBlock title="Maia-3 human model" prov="ours">
              <KV
                rows={[
                  ["Predicted probability", isNum(row.maia_p) ? fmtNum(row.maia_p, 4) : DASH],
                  ["Maia rank", isNum(row.maia_rank) ? `#${row.maia_rank} of ${row.n_legal ?? "?"} legal moves` : DASH],
                  ["Surprisal", isNum(row.surprisal) && isNum(row.maia_p) ? `−ln(${fmtNum(row.maia_p, 4)}) = ${fmtNum(row.surprisal, 2)} nats` : DASH],
                  ["Expected surprisal (entropy)", isNum(row.maia_entropy) ? `${fmtNum(row.maia_entropy, 2)} nats` : DASH],
                  ["Elo conditioning", `player ${player?.elo ?? "—"} · opponent ${player?.opp_elo ?? "—"}`],
                  ["Display rule", `High ≥ ${fmtPct(THRESHOLDS.human.high)}; Low < ${fmtPct(THRESHOLDS.human.low)}`],
                ]}
              />
              <MaiaTop row={row} />
            </TechBlock>
            <TechBlock title="Statistical view (Regan-inspired approximation)" prov="approx">
              <KV
                rows={[
                  ["Expected: P(top-1 match)", fmtPct(row.p_t1, 1)],
                  ["Observed", row.top1 === undefined ? DASH : row.top1 ? "top-1 match (1)" : "no top-1 match (0)"],
                  ["Deviation for this move", isNum(row.p_t1) && row.top1 !== undefined ? fmtNum((row.top1 ? 1 : 0) - row.p_t1, 2) : DASH],
                  ["Position difficulty", `${fmtNum(row.difficulty, 3)} (hard ≥ ${fmtNum(player?.hard_threshold, 3)})`],
                  ["z-score", "computed per game over all decisions, not per move"],
                ]}
              />
            </TechBlock>
            <TechBlock title="Sequence context" prov="ours">
              <KV
                rows={[
                  ["Rolling engine agreement (8)", fmtPct(row.roll_t1, 0)],
                  ["Rolling move loss (8)", isNum(row.roll_loss) ? `${fmtNum(row.roll_loss, 1)} cp` : DASH],
                  ["Rolling surprisal (8)", isNum(row.roll_surprisal) ? `${fmtNum(row.roll_surprisal, 2)} nats` : DASH],
                  ["Window expected agreement", `${fmtPct(pc.expected, 0)} over ${pc.window} decisions`],
                  ["“Unusual” rule", `observed − expected ≥ ${THRESHOLDS.patternDelta} over ≥ ${THRESHOLDS.patternMinWindow} decisions`],
                ]}
              />
            </TechBlock>
            {row.dm_shap && (
              <TechBlock title="Decision-level model (separate per-move model, SHAP)" prov="ours">
                <p className="mb-2 text-ink-3">
                  Resemblance of this single move to a synthetic substitution: <span className="num text-ink">{fmtNum(row.dm_score, 3)}</span>.
                  Contributions in log-odds. This is a separate model trained on individual decisions; it is not a decomposition of
                  the game-level score.
                </p>
                <ShapBars rows={row.dm_shap} limit={8} valueDigits={3} />
              </TechBlock>
            )}
          </div>
        </TechDetails>
      )}
    </div>
  );
}
