"use client";

// You vs Qwen: guess the next word of a passage with the true text so far in front of you (teacher forcing),
// then compare with Qwen3-8B-Base's recorded prediction for exactly that position.
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { mulberry32 } from "@/lib/latent/toy-model";
import { fmtProb } from "@/lib/latent/toy";
import type { Recall, RecallPassage } from "@/lib/latent/types";
import { Prov, Segment, showTok } from "./kit";
import { useRecall } from "./recall";
import type { RecallVersions } from "./versions";

export interface Round { t: number; word: string; contextStart: number }

/** Positions whose next token is a whole word on its own (leading space, letters, not continued by the next token),
 *  so a typed word can be compared fairly with Qwen's top token. Deterministic for a seed. */
export function pickRounds(p: RecallPassage, n: number, seed: number): Round[] {
  const pos = p.positions;
  const ok: Round[] = [];
  for (let i = 8; i < pos.length - 1; i++) {
    const tr = pos[i].true ?? "", nx = pos[i + 1].true ?? "";
    if (/^ [A-Za-z]{3,}$/.test(tr) && !/^[A-Za-z]/.test(nx)) ok.push({ t: i, word: tr.trim(), contextStart: Math.max(0, i - 40) });
  }
  const r = mulberry32(seed);
  const shuffled = ok.map((x) => ({ x, k: r() })).sort((a, b) => a.k - b.k).map((o) => o.x);
  return shuffled.slice(0, n).sort((a, b) => a.t - b.t);
}

export const normWord = (s: string) => s.toLowerCase().replace(/[^a-z']/g, "");

export function Play({ versions }: { versions?: RecallVersions }) {
  const { data, err } = useRecall();
  return err ? <p role="alert">Could not load the recorded recall data: {err}</p> : !data ? <p className="py-12 text-[15px] text-ink-3" aria-live="polite">Loading the recorded predictions…</p> : <Game data={data} versions={versions} />;
}

function Game({ data, versions }: { data: Recall; versions?: RecallVersions }) {
  const [k, setK] = useState(0);
  const [seed, setSeed] = useState(1);
  const p = data.passages[k];
  const rounds = useMemo(() => pickRounds(p, 10, seed), [p, seed]);
  const [i, setI] = useState(0);
  const [guess, setGuess] = useState("");
  const [answers, setAnswers] = useState<{ you: boolean; qwen: boolean; guess: string }[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const round = rounds[i];
  const done = answers.length === rounds.length;
  const revealed = answers.length > i;
  useEffect(() => { if (!revealed) input.current?.focus(); }, [i, revealed]);
  const restart = (nk = k, ns = seed) => { setK(nk); setSeed(ns); setI(0); setAnswers([]); setGuess(""); };
  const pos = round ? p.positions[round.t] : null;
  const ctx = round ? p.positions.slice(round.contextStart, round.t).map((x) => x.true).join("") : "";
  const vNote = versions && k === 0 && round ? versions.misses_detail.find((d) => d.t === round.t && d.category === "another version") : undefined;
  const submit = () => {
    if (!round || revealed || !guess.trim()) return;
    setAnswers([...answers, { you: normWord(guess) === normWord(round.word), qwen: !!pos?.top1, guess }]);
  };
  const you = answers.filter((a) => a.you).length, qwen = answers.filter((a) => a.qwen).length;
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segment label="Passage" value={k} onChange={(v) => restart(v, seed)} options={data.passages.map((x, j) => ({ value: j, label: x.name.replace(/ \(.*\)$/, "") }))} />
        <div className="flex items-center gap-2 text-[14px] text-ink-2">
          <button type="button" onClick={() => restart(k, seed + 1)} className="rounded-lg border-2 border-rule-strong px-3 py-1">New set of 10</button>
          <button type="button" onClick={() => restart()} className="rounded-lg border-2 border-rule-strong px-3 py-1">↺ Restart</button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-ink p-4 text-paper"><div className="text-[13px] opacity-75">You</div><div className="num font-serif text-[40px]">{you}<span className="text-[20px] opacity-60"> / {answers.length}</span></div></div>
        <div className="rounded-2xl bg-[var(--role-resid)] p-4 text-[var(--on-role)]"><div className="text-[13px] opacity-80">Qwen3-8B-Base (recorded)</div><div className="num font-serif text-[40px]">{qwen}<span className="text-[20px] opacity-70"> / {answers.length}</span></div></div>
        <div className="rounded-2xl border border-rule bg-paper p-4 text-[13.5px] text-ink-2">Round {Math.min(i + 1, rounds.length)} of {rounds.length}. Both of you see the true text so far (teacher forcing). Qwen&apos;s answers were recorded in advance; nothing runs live. <Prov kind="recorded" /></div>
      </div>
      {!done && round && pos && (
        <section className="ll-panel rounded-2xl border border-rule bg-paper p-5 sm:p-7">
          <p className="font-serif text-[22px] leading-relaxed text-ink sm:text-[26px]">
            {round.contextStart > 0 && <span className="text-ink-4">… </span>}{ctx}
            {revealed ? <span className={cn("ll-pop rounded px-1", answers[i].you ? "bg-[var(--role-norm-soft)]" : "bg-[var(--bad-soft)]")}> {round.word}</span> : <span className="rounded bg-[var(--role-resid-soft)] px-2 text-[var(--role-resid-ink)]"> ▢</span>}
          </p>
          {!revealed ? (
            <form className="mt-5 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
              <label htmlFor="guess" className="sr-only">Your guess for the next word</label>
              <input id="guess" ref={input} value={guess} onChange={(e) => setGuess(e.target.value)} autoComplete="off" placeholder="type the next word"
                className="min-w-[220px] flex-1 rounded-xl border-2 border-ink bg-paper px-4 py-2.5 text-[20px]" />
              <button type="submit" disabled={!guess.trim()} className="rounded-xl bg-ink px-5 py-2.5 text-[17px] font-medium text-paper disabled:opacity-40">Check</button>
            </form>
          ) : (
            <div className="ll-pop mt-5 grid gap-3 md:grid-cols-2">
              <div className={cn("rounded-xl p-4", answers[i].you ? "bg-[var(--role-norm-soft)]" : "bg-[var(--bad-soft)]")}>
                <div className="text-[13px] text-ink-3">You</div>
                <div className="text-[18px]"><span className="font-mono">{answers[i].guess}</span> {answers[i].you ? "✓ correct" : `✗ (the text says “${round.word}”)`}</div>
              </div>
              <div className={cn("rounded-xl p-4", pos.top1 ? "bg-[var(--role-norm-soft)]" : "bg-[var(--bad-soft)]")}>
                <div className="text-[13px] text-ink-3">Qwen&apos;s top guess</div>
                <div className="text-[18px]"><span className="font-mono">{showTok(pos.top ?? "")}</span> {pos.top1 ? "✓ correct" : "✗"}</div>
                <div className="mt-1 text-[13.5px] text-ink-2">Probability it gave to “{round.word}”: <strong className="num">{fmtProb(pos.p_true)}</strong> (rank {pos.rank}). Its top guess had {fmtProb(pos.p_top)}.</div>
              </div>
              {vNote && <p className="rounded-xl border-2 border-[var(--role-attn)] bg-[var(--role-attn-soft)] p-3 text-[14.5px] md:col-span-2">Qwen&apos;s “wrong” answer is what the <strong>{vNote.versions_with_prediction.join(" and ")}</strong> {vNote.versions_with_prediction.length > 1 ? "copies say" : "copy says"} here: Lincoln wrote it that way too.</p>}
              <button type="button" onClick={() => { setI(i + 1); setGuess(""); }} className="w-fit rounded-xl bg-ink px-5 py-2 text-[16px] text-paper md:col-span-2">{i + 1 < rounds.length ? "Next word →" : "See the result"}</button>
            </div>
          )}
        </section>
      )}
      {done && (
        <section className="ll-panel ll-pop grid gap-3 rounded-2xl border-2 border-ink bg-paper p-6">
          <h2 className="font-serif text-[30px] font-semibold">You {you} · Qwen {qwen} <span className="text-[18px] font-normal text-ink-3">out of {rounds.length}</span></h2>
          <p className="text-[16px] text-ink-2">
            {k === 0 ? "On a speech this famous, the model has very likely seen it many times in training; how well it does is consistent with that, but one passage is not proof of memorization." : "This paragraph was written for LatentLens and never published, so neither of you can have memorized it: both of you are predicting, not recalling."}
          </p>
          <p className="text-[14px] text-ink-3">Positions were chosen where the next word is a single whole token, so a typed word and Qwen&apos;s token can be compared fairly. Over all {p.n_scored} positions of this passage Qwen&apos;s top-1 recall is {(p.summary.top1_rate * 100).toFixed(1)}%.</p>
          <div className="flex gap-2"><button type="button" onClick={() => restart(k, seed + 1)} className="rounded-xl bg-ink px-5 py-2 text-paper">Play another 10</button>
            <button type="button" onClick={() => restart(k === 0 ? 1 : 0, seed)} className="rounded-xl border-2 border-rule-strong px-5 py-2">Try the other passage</button></div>
        </section>
      )}
    </div>
  );
}
