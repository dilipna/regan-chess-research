"use client";

// The 10-minute review: 2 architecture, 2 training/inference, 2 RAG/agents, 2 security, 1 connection, 1 teach-back.
// Chosen when you press Start, from your local record (wrong first, then low confidence, then overdue, then unseen).

import Link from "next/link";
import { useState } from "react";
import { TOPICS, topicBySlug, topicHref } from "@/lib/latent/mastery";
import { pickDaily, pickTeachBack, readState, status, type LearnState } from "@/lib/latent/mastery/progress";
import type { QuizItem } from "@/lib/latent/mastery/types";
import { MasteryBadge, QuizCard, TeachBackPrompt } from "../learn/primitives";
import { PAGE_NOW, clearProgress, saveAnswer, saveConfidence, saveTeachBack, useLearn } from "../learn/progress-hook";

const AREA: Record<string, string> = { arch: "Architecture", traininf: "Training and inference", app: "RAG and agents", security: "Security", connection: "Connection" };

function summary(s: LearnState) {
  const sts = TOPICS.map((t) => status(s.concepts[t.slug], PAGE_NOW));
  return { mastered: sts.filter((x) => x === "mastered").length, review: sts.filter((x) => x === "review").length, learning: sts.filter((x) => x === "learning").length, fresh: sts.filter((x) => x === "not-started").length };
}

export function DailyReview() {
  const st = useLearn();
  const [set, setSet] = useState<{ items: QuizItem[]; teach: string } | null>(null);
  const [i, setI] = useState(0);
  const [answered, setAnswered] = useState<boolean | null>(null);
  const [results, setResults] = useState<{ topic: string; ok: boolean }[]>([]);
  const sum = summary(st);
  const start = () => {
    const s = readState(), day = Math.floor(Date.now() / 86_400_000);
    setSet({ items: pickDaily(TOPICS.flatMap((t) => t.quiz), s, Date.now(), day), teach: pickTeachBack(TOPICS.map((t) => t.slug), s, Date.now(), day) });
    setI(0); setAnswered(null); setResults([]);
  };
  const missed = TOPICS.filter((t) => st.concepts[t.slug]?.lastWrong || st.concepts[t.slug]?.lowConfidence);

  if (!set) return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-4">
        {([["Mastered", sum.mastered, "mastered"], ["Review needed", sum.review, "review"], ["Learning", sum.learning, "learning"], ["Not started", sum.fresh, "not-started"]] as const).map(([k, v, s]) => (
          <div key={k} className="rounded-xl border border-rule bg-paper p-3"><MasteryBadge s={s} /><div className="num mt-1 font-serif text-[30px] text-ink">{v}</div><div className="text-[13px] text-ink-3">{k} of {TOPICS.length} topics</div></div>
        ))}
      </div>
      {missed.length > 0 && <p className="text-[14.5px] text-ink-2"><strong className="text-ink">Coming up first:</strong> {missed.slice(0, 8).map((t, k) => <span key={t.slug}>{k > 0 && ", "}<Link href={topicHref(t)} className="underline underline-offset-2">{t.title}</Link></span>)}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={start} className="rounded-xl bg-ink px-6 py-3 text-[16px] font-medium text-paper">Start today&apos;s 10 questions</button>
        <button type="button" onClick={() => { if (window.confirm("Clear all local learning progress in this browser?")) clearProgress(); }} className="rounded-xl border border-rule-strong px-4 py-3 text-[14px] text-ink-2">Reset progress</button>
      </div>
    </div>
  );

  const total = set.items.length + 1;
  if (i >= set.items.length) {
    const t = topicBySlug(set.teach)!;
    const right = results.filter((r) => r.ok).length;
    return (
      <div className="grid gap-4">
        <p className="text-[15px] text-ink-2">Question {total} of {total} · teach-back · {right}/{results.length} correct so far</p>
        <section className="rounded-xl border border-rule bg-paper p-4 sm:p-5">
          <h2 className="mb-2 text-[18px] font-semibold text-ink">Explain: <Link href={topicHref(t)} className="underline underline-offset-2">{t.title}</Link></h2>
          <TeachBackPrompt key={t.slug} prompt={t.teachBack.prompt} points={t.teachBack.points} saved={st.teach[t.slug]?.text} onSave={(text, n) => saveTeachBack(t.slug, text, n)} />
        </section>
        {results.some((r) => !r.ok) && <p className="text-[14.5px] text-ink-2"><strong className="text-ink">Revisit:</strong> {results.filter((r) => !r.ok).map((r, k) => { const x = topicBySlug(r.topic)!; return <span key={r.topic + k}>{k > 0 && ", "}<Link href={topicHref(x)} className="underline underline-offset-2">{x.title}</Link></span>; })}</p>}
        <button type="button" onClick={() => setSet(null)} className="w-fit rounded-lg border border-rule-strong px-4 py-2 text-[14px] text-ink">Done</button>
      </div>
    );
  }

  const q = set.items[i];
  return (
    <div className="grid gap-4">
      <p className="text-[15px] text-ink-2">Question {i + 1} of {total} · {AREA[q.area]} · <Link href={topicHref(topicBySlug(q.topic)!)} className="underline underline-offset-2">{topicBySlug(q.topic)!.title}</Link></p>
      <QuizCard key={q.id} q={q} onAnswer={(ok) => { saveAnswer(q.topic, ok); setAnswered(ok); setResults([...results, { topic: q.topic, ok }]); }} />
      {answered !== null && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] text-ink-2">How sure were you?</span>
          <button type="button" onClick={() => { saveConfidence(q.topic, true); setI(i + 1); setAnswered(null); }} className="rounded-lg border border-rule-strong px-3 py-1.5 text-[14px] text-ink">Guessing: keep it in review</button>
          <button type="button" onClick={() => { saveConfidence(q.topic, false); setI(i + 1); setAnswered(null); }} className="rounded-lg bg-ink px-3 py-1.5 text-[14px] text-paper">Sure: next</button>
        </div>
      )}
    </div>
  );
}
