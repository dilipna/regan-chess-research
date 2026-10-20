import Link from "next/link";
import { PATHS } from "@/lib/latent/paths";
import type { Recall } from "@/lib/latent/types";
import { preload } from "@/lib/server-data";
import { PHASES, type Phase } from "@/lib/site/phases";

// Home: the whole project in one glance. Two phases, one picture each, three places to start, and the full index
// folded away at the bottom.

/** Phase 1 picture (an illustration, no data): one position, three readers, three arrows. */
function ThreeReaders() {
  const sq = 26, n = 4;
  const readers = [
    { label: "statistical model", c: "var(--engine)", to: [1, 0] },
    { label: "language model", c: "var(--llm)", to: [3, 1] },
    { label: "human-move model", c: "var(--human)", to: [2, 0] },
  ];
  return (
    <svg viewBox="0 0 300 120" className="h-auto w-full" role="img" aria-label="Illustration: one chess position read by three models, each suggesting a move">
      {Array.from({ length: n * n }, (_, i) => {
        const x = i % n, y = Math.floor(i / n);
        return <rect key={i} x={20 + x * sq} y={8 + y * sq} width={sq} height={sq} fill={(x + y) % 2 ? "var(--square-dark)" : "var(--square-light)"} />;
      })}
      <circle cx={20 + 1.5 * sq} cy={8 + 3.5 * sq} r={8} fill="var(--ink)" />
      {readers.map((r, k) => {
        const tx = 20 + (r.to[0] + 0.5) * sq, ty = 8 + (r.to[1] + 0.5) * sq;
        return (
          <g key={r.label}>
            <line x1={20 + 1.5 * sq} y1={8 + 3.5 * sq} x2={tx} y2={ty} stroke={r.c} strokeWidth={3} strokeLinecap="round" opacity={0.9} />
            <circle cx={tx} cy={ty} r={4} fill={r.c} />
            <circle cx={150} cy={24 + k * 34} r={5} fill={r.c} />
            <text x={162} y={28 + k * 34} fontSize={13} fill="var(--ink-2)">{r.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Phase 2 picture (recorded data): the correct next word's rank, layer by layer. */
function Climb({ recall }: { recall: Recall }) {
  const p = recall.passages[0], pts = p.depth_summary;
  const W = 300, H = 120, x0 = 14, x1 = 290, y0 = 14, y1 = 100;
  const maxLog = Math.log10(Math.max(...pts.map((d) => d.median_rank)));
  const x = (i: number) => x0 + (i / (pts.length - 1)) * (x1 - x0);
  const y = (r: number) => y0 + (Math.log10(r) / maxLog) * (y1 - y0);
  const d = pts.map((q, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(q.median_rank).toFixed(1)}`).join(" ");
  const first = pts[0], last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
      aria-label={`Recorded: the correct next word starts at rank ${first.median_rank.toLocaleString("en-US")} at layer 0 and reaches rank ${last.median_rank} at layer ${last.depth}.`}>
      <line x1={x0} x2={x1} y1={y(1)} y2={y(1)} stroke="var(--rule-strong)" strokeDasharray="3 4" />
      <text x={x0} y={y(1) - 4} fontSize={11} fill="var(--ink-3)">1st choice</text>
      <path d={d} fill="none" stroke="var(--brand)" strokeWidth={2.5} className="draw-line" pathLength={1} />
      <circle cx={x(pts.length - 1)} cy={y(last.median_rank)} r={4.5} fill="var(--brand)" />
      <text x={x0} y={H - 2} fontSize={11} fill="var(--ink-3)">first layer</text>
      <text x={x1} y={H - 2} fontSize={11} fill="var(--ink-3)" textAnchor="end">last layer</text>
    </svg>
  );
}

function PhaseCard({ phase, picture, finding, caption }: { phase: Phase; picture: React.ReactNode; finding: string; caption: string }) {
  return (
    <article className="grid content-start gap-4 rounded-2xl border border-rule bg-paper p-5 shadow-[0_1px_2px_rgba(23,25,30,0.04)] sm:p-7">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[13px] font-medium tracking-wide text-ink-3 uppercase">Phase {phase.n} · {phase.label}</div>
        <span className="rounded-full border border-rule-strong px-2.5 py-0.5 text-[12px] text-ink-3">{phase.status}</span>
      </div>
      <h2 className="font-serif text-[28px] leading-tight font-semibold text-ink">{phase.plain}</h2>
      <p className="text-[16.5px] leading-relaxed text-ink-2">{phase.question}</p>
      <figure className="grid gap-2 rounded-xl bg-paper-2 p-4">
        {picture}
        <figcaption className="text-[12.5px] leading-snug text-ink-3">{caption}</figcaption>
      </figure>
      <p className="text-[15px] leading-relaxed text-ink"><span className="font-semibold">{phase.n === 1 ? "What we found:" : "What we see so far:"}</span> {finding}</p>
      <Link href={phase.home} className="w-fit rounded-lg border border-ink px-4 py-2 text-[14.5px] font-medium text-ink transition-colors hover:bg-ink hover:text-paper">
        Open Phase {phase.n} →
      </Link>
    </article>
  );
}

const START = [
  { href: "/latent/professor", title: "The 5-minute demo", text: "How Qwen works inside, one real measurement, and the question for the next step." },
  { href: "/latent/proposal", title: "The proposed next experiment", text: "Why two model sizes with the same recall may still differ inside, and how to test it." },
  { href: "/latent/recall", title: "The Recall Microscope", text: "Follow the correct next word through every layer of the model, position by position." },
];

export default async function Home() {
  const d = await preload([PATHS.recall]);
  const recall = d[PATHS.recall] as Recall | undefined;
  const g = recall?.passages[0];
  const last = g?.depth_summary[g.depth_summary.length - 1];
  return (
    <main className="mx-auto grid w-full max-w-[1100px] flex-1 gap-14 px-4 pt-14 pb-24 sm:px-6 sm:pt-20">
      <header className="grid max-w-3xl gap-5">
        <div className="text-[13px] font-medium tracking-[0.14em] text-brand uppercase">A research project in two phases</div>
        <h1 className="font-serif text-[38px] leading-[1.1] font-semibold text-ink sm:text-[52px]">What does a language model know, and where inside it does that knowledge appear?</h1>
        <p className="text-[18px] leading-relaxed text-ink-2">
          First we compared what models <em>choose</em> on chess positions. Now we look <em>inside</em> one model, Qwen3-8B, to see how an answer forms layer by layer.
        </p>
      </header>

      <div className="grid items-stretch gap-5 md:grid-cols-[1fr_auto_1fr]">
        <PhaseCard phase={PHASES[0]} picture={<ThreeReaders />}
          caption="Illustration. One position, three models, three suggested moves."
          finding="adding a model of human play made engine-assisted games easier to tell apart, from 0.820 to 0.873 ROC-AUC on held-out games. The language model's held-out evaluation is still pending." />
        <div aria-hidden className="hidden items-center text-[28px] text-ink-4 md:flex">→</div>
        <PhaseCard phase={PHASES[1]} picture={recall ? <Climb recall={recall} /> : <p className="text-ink-3">Recall data not available.</p>}
          caption={g && last ? `Recorded on Qwen3-8B-Base, ${g.n_scored} words of the Gettysburg Address: the median rank of the correct next word goes from ${g.depth_summary[0].median_rank.toLocaleString("en-US")} at the first layer to ${last.median_rank} at the last. Earlier layers are read through a diagnostic projection.` : ""}
          finding="on a memorized text, the correct next word usually becomes the model's top choice only in the last few layers." />
      </div>

      <section aria-labelledby="start-title" className="grid gap-4">
        <h2 id="start-title" className="font-serif text-[26px] font-semibold text-ink">Where to start</h2>
        <ol className="grid gap-3 md:grid-cols-3">
          {START.map((s, k) => (
            <li key={s.href}>
              <Link href={s.href} className="group grid h-full content-start gap-2 rounded-xl border border-rule bg-paper p-5 transition-colors hover:border-ink">
                <span className="text-[13px] text-ink-4">{k + 1}</span>
                <span className="font-serif text-[20px] leading-snug font-semibold text-ink group-hover:text-brand">{s.title} →</span>
                <span className="text-[14.5px] leading-relaxed text-ink-3">{s.text}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <details id="all-pages" className="group scroll-mt-20 rounded-xl border border-rule bg-paper">
        <summary className="cursor-pointer list-none px-5 py-4 text-[15px] font-medium text-ink">
          <span className="mr-2 inline-block transition-transform group-open:rotate-90">›</span>All pages, by phase
        </summary>
        <div className="grid gap-8 border-t border-rule px-5 py-6 md:grid-cols-2">
          {PHASES.map((p) => (
            <div key={p.id} id={`phase-${p.n}`} className="grid content-start gap-4">
              <h3 className="font-serif text-[20px] font-semibold text-ink">Phase {p.n} · {p.label} <span className="text-[15px] font-normal text-ink-3">({p.plain.toLowerCase()})</span></h3>
              {p.groups.map((grp) => (
                <div key={grp.title} className="grid gap-1">
                  <div className="text-[12px] font-medium tracking-wide text-ink-4 uppercase">{grp.title}</div>
                  {grp.compact ? (
                    <p className="text-[14px] leading-relaxed text-ink-3">
                      {grp.links.map((l, k) => <span key={l.href}>{k > 0 && <span aria-hidden> · </span>}<Link href={l.href} className="text-ink-2 underline-offset-2 hover:text-ink hover:underline">{l.label}</Link></span>)}
                    </p>
                  ) : (
                    <ul className="grid gap-0.5">
                      {grp.links.map((l) => (
                        <li key={l.href} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-2 rounded px-1 py-1 text-[14.5px] hover:bg-paper-2">
                          <span className="num text-ink-4">{l.n}</span>
                          <span>
                            <Link href={l.href} className="text-ink hover:underline">{l.label}</Link> <span className="text-ink-3">· {l.blurb}</span>
                            {l.parts && <span className="mt-0.5 block text-[13px] text-ink-4">{l.parts.map((x, k) => <span key={x.href}>{k > 0 && " · "}<Link href={x.href} className="hover:text-ink">{x.label}</Link></span>)}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </details>
    </main>
  );
}
