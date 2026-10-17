"use client";

import Link from "next/link";
import { useState } from "react";
import { connectionsOf } from "@/lib/latent/mastery/connections";
import { deeper, type Practice, type Read } from "@/lib/latent/mastery/deeper";
import { LEVELS, topicBySlug, topicHref } from "@/lib/latent/mastery";
import { ConceptCard, FactBadge, MasteryBadge, QuizCard, RevealOutline, TeachBackPrompt } from "../learn/primitives";
import { saveAnswer, saveTeachBack, useConceptStatus, useLearn } from "../learn/progress-hook";
import { TenQuestions } from "./ten-questions";
import { TopicDiagram } from "./diagrams";
import { TopicConnections } from "./topic-connections";

export function MasteryTopic({ slug, defaultOpen = false }: { slug: string; defaultOpen?: boolean }) {
  const t = topicBySlug(slug)!;
  const c = connectionsOf(slug);
  const st = useConceptStatus(slug);
  const saved = useLearn().teach[slug]?.text;
  const [open, setOpen] = useState(defaultOpen);
  const level = LEVELS.find((l) => l.n === t.level)!;
  const home = t.track === "security" ? "/latent/security" : "/latent/mastery";
  const isSec = t.track === "security";
  const more = deeper(t);

  return (
    <article className="grid gap-5" aria-labelledby="topic-title">
      <nav aria-label="Breadcrumb" className="text-[13px] text-ink-3"><Link href={home} className="underline underline-offset-2">{isSec ? "Security" : "Mastery"}</Link> · Level {t.level}: {level.title}</nav>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-rule pb-4">
        <div className="min-w-0">
          <h1 id="topic-title" className="font-serif text-[32px] leading-tight font-semibold text-ink sm:text-[40px]">{t.title}</h1>
          <p className="mt-2 max-w-3xl text-[17px] leading-relaxed text-ink-2"><span className="text-[12px] font-semibold tracking-wide text-ink-3 uppercase">A · 10-second intuition </span>{t.intuition}</p>
        </div>
        <MasteryBadge s={st} />
      </header>

      <QuizCard key={t.quiz[0].id} q={t.quiz[0]} label="Predict before you read" onAnswer={(ok) => { saveAnswer(slug, ok); setOpen(true); }} />
      {!open && <button type="button" onClick={() => setOpen(true)} className="w-fit rounded-lg border border-rule-strong px-4 py-2 text-[14px] text-ink-2">Skip the prediction and open the lesson</button>}

      {open && (
        <>
          <TenQuestions t={t} c={c} />
          <ConceptCard k="B" title="Where it sits"><p>{t.where}</p><TopicDiagram slug={slug} /></ConceptCard>
          <ConceptCard k="C" title="Exact mechanism">
            <ol className="list-decimal space-y-1.5 pl-5">{t.mechanism.map((m) => <li key={m}>{m}</li>)}</ol>
            {t.eq && <div role="math" className="scroll-x mt-3 rounded-md border border-rule bg-paper-2/70 px-4 py-3 font-mono text-[13.5px] leading-relaxed text-ink">{t.eq.map((e) => <div key={e}>{e}</div>)}</div>}
          </ConceptCard>
          <ConceptCard k="D" title={isSec ? "What property of LLMs makes this possible?" : "Real Qwen connection"}>
            <ul className="grid gap-2">{t.qwen.map((q) => <li key={q.text} className="flex flex-wrap items-baseline gap-2"><FactBadge s={q.status} /><span className="min-w-0 flex-1">{q.text}</span></li>)}</ul>
          </ConceptCard>
          {t.shapes && (
            <ConceptCard k="E" title="Tensor shapes">
              <div className="scroll-x"><table className="w-full min-w-[480px] text-left font-mono text-[13px]">
                <thead><tr className="font-sans text-ink-3"><th className="py-1 pr-3 font-medium">Input</th><th className="py-1 pr-3 font-medium">Operation</th><th className="py-1 font-medium">Output</th></tr></thead>
                <tbody>{t.shapes.map((s) => <tr key={s.join()} className="border-t border-rule text-ink"><td className="py-1.5 pr-3">{s[0]}</td><td className="py-1.5 pr-3 font-sans text-ink-2">{s[1]}</td><td className="py-1.5">{s[2]}</td></tr>)}</tbody>
              </table></div>
            </ConceptCard>
          )}
          {t.code && <ConceptCard k="F" title="Code connection (simplified)"><pre className="scroll-x rounded-md border border-rule bg-paper-2/70 p-3 font-mono text-[12.5px] leading-relaxed whitespace-pre text-ink">{t.code}</pre></ConceptCard>}
          <div className="grid gap-4 lg:grid-cols-2">
            <ConceptCard k="G" title="Why it exists"><p>{t.why}</p></ConceptCard>
            <ConceptCard k="H" title="What breaks without it"><p>{t.breaks}</p></ConceptCard>
            <ConceptCard k="I" title="Training vs inference"><p>{t.trainInfer}</p></ConceptCard>
            <ConceptCard k="J" title="Security lens"><p>{t.security}</p></ConceptCard>
          </div>
          <ConceptCard k="K" title="Common confusion" className="border-[var(--role-mlp)]"><p className="text-ink">{t.confusion}</p></ConceptCard>
          <TopicConnections c={c} track={t.track} />
          <ConceptCard k="L" title="Teach it back">
            <TeachBackPrompt key={slug} prompt={t.teachBack.prompt} points={t.teachBack.points} saved={saved} onSave={(text, n) => saveTeachBack(slug, text, n)} />
          </ConceptCard>
          <ConceptCard k="M" title={`Interview question · level ${t.interview.level}`}><RevealOutline q={t.interview.q} outline={t.interview.outline} /></ConceptCard>
          {t.quiz.slice(1).map((q) => <QuizCard key={q.id} q={q} label="Check yourself" onAnswer={(ok) => saveAnswer(slug, ok)} />)}
          <GoDeeper read={more.read} practice={more.practice} story={t.story} />
        </>
      )}

      <nav aria-label="Topic order" className="flex flex-wrap justify-between gap-3 border-t border-rule pt-5">
        {c.prev ? <Link href={topicHref(c.prev)} className="rounded-lg border border-rule-strong px-4 py-2 text-[14.5px] text-ink">← {c.prev.title}</Link> : <Link href={home} className="rounded-lg border border-rule-strong px-4 py-2 text-[14.5px] text-ink">← Curriculum</Link>}
        {c.next && <Link href={topicHref(c.next)} className="rounded-lg bg-ink px-4 py-2 text-[14.5px] font-medium text-paper">{c.next.title} →</Link>}
      </nav>
    </article>
  );
}

function GoDeeper({ read, practice, story }: { read: Read[]; practice: Practice[]; story?: string }) {
  const ext = (h: string) => h.startsWith("http");
  return (
    <section aria-labelledby="go-deeper" className="grid gap-4 rounded-3xl border border-rule bg-paper p-5 sm:p-6">
      <h2 id="go-deeper" className="font-serif text-[22px] font-semibold text-ink">Go deeper</h2>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-[11px] font-medium tracking-[0.14em] text-[var(--role-resid-ink)] uppercase">Practise it</h3>
          <ul className="mt-2 grid gap-1.5">
            {practice.map((p) => (
              <li key={p.href + p.label}>
                {ext(p.href)
                  ? <a href={p.href} target="_blank" rel="noopener noreferrer" className="text-[14px] text-ink-2 underline decoration-rule-strong underline-offset-4 hover:text-ink">{p.label} ↗</a>
                  : <Link href={p.href} className="text-[14px] text-ink-2 underline decoration-rule-strong underline-offset-4 hover:text-ink">{p.label}</Link>}
              </li>
            ))}
            {story && <li><Link href={`/latent/story/${story}`} className="text-[14px] text-ink-2 underline decoration-rule-strong underline-offset-4 hover:text-ink">Storybook: the intuition</Link></li>}
          </ul>
        </div>
        <div>
          <h3 className="text-[11px] font-medium tracking-[0.14em] text-[var(--role-attn-ink)] uppercase">Read the source</h3>
          <ul className="mt-2 grid gap-1.5">
            {read.map((r) => <li key={r.url}><a href={r.url} target="_blank" rel="noopener noreferrer" className="text-[14px] text-ink-2 underline decoration-rule-strong underline-offset-4 hover:text-ink">{r.label} ↗</a></li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}
