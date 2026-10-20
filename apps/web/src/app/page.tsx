import Link from "next/link";
import { PATHS } from "@/lib/latent/paths";
import type { Architecture, Recall } from "@/lib/latent/types";
import { preload } from "@/lib/server-data";
import { PHASES, type Phase } from "@/lib/site/phases";

// Home: the project as two phases, each an index of numbered subsections. The one figure is a recorded measurement.

function RecallLine({ recall }: { recall: Recall }) {
  const p = recall.passages[0];
  const pts = p.depth_summary;
  const W = 720, H = 150, padX = 8, padY = 14;
  const maxLog = Math.log10(Math.max(...pts.map((d) => d.median_rank)));
  const x = (i: number) => padX + (i / (pts.length - 1)) * (W - 2 * padX);
  const y = (r: number) => padY + (Math.log10(r) / maxLog) * (H - 2 * padY);
  const d = pts.map((q, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(q.median_rank).toFixed(1)}`).join(" ");
  const first = pts[0], last = pts[pts.length - 1];
  return (
    <figure className="grid gap-3 rounded-xl border border-rule bg-paper p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-[11.5px] text-ink-4">
        <span><span className="text-ink">●</span> recorded · {recall.model_id} · {p.name.replace(/ \(.*\)$/, "")}</span>
        <span>rank 1 at top · log scale</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img"
        aria-label={`Median rank of the true next token by layer: ${first.median_rank.toLocaleString("en-US")} at layer 0, ${last.median_rank} at layer ${last.depth}.`}>
        <line x1={padX} x2={W - padX} y1={y(1)} y2={y(1)} stroke="var(--rule-strong)" strokeDasharray="3 5" />
        <path d={d} fill="none" stroke="var(--mint)" strokeWidth="6" opacity="0.18" className="draw-line" pathLength={1} />
        <path d={d} fill="none" stroke="var(--mint)" strokeWidth="2" className="draw-line" pathLength={1} />
        {pts.map((q, i) => <circle key={q.depth} cx={x(i)} cy={y(q.median_rank)} r={i === pts.length - 1 ? 4 : 1.6} fill="var(--mint)" className="draw-dot" style={{ animationDelay: `${0.4 + i * 0.035}s` }} />)}
      </svg>
      <figcaption className="flex flex-wrap justify-between gap-2 text-[13px] text-ink-3">
        <span>layer 0 · median rank <span className="num text-ink-2">{first.median_rank.toLocaleString("en-US")}</span></span>
        <span>layer {last.depth} (model output) · median rank <span className="num text-ink">{last.median_rank}</span></span>
        <span className="w-full text-[12.5px] text-ink-4">The true next token&apos;s rank at every layer of Qwen3-8B-Base on a memorized public-domain text ({p.n_scored} positions). Earlier layers are diagnostic projections through the final norm and LM head, not the model&apos;s predictions.</span>
      </figcaption>
    </figure>
  );
}

function PhaseBlock({ phase, facts }: { phase: Phase; facts?: string[] }) {
  return (
    <section id={`phase-${phase.n}`} aria-labelledby={`phase-${phase.n}-title`} className="grid scroll-mt-20 gap-6 border-t border-rule pt-10 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-10">
      <div className="grid content-start gap-2">
        <div aria-hidden className="font-mono text-[64px] leading-none font-semibold text-transparent [-webkit-text-stroke:1px_var(--ink)] [text-shadow:0_0_24px_var(--mint-glow)]">0{phase.n}</div>
        <div className="font-mono text-[12px] tracking-wide text-ink-4 uppercase">Phase {phase.n}</div>
        <h2 id={`phase-${phase.n}-title`} className="font-serif text-[30px] leading-tight font-semibold text-ink">{phase.label === "LLMs" ? "LLM internals" : phase.label}</h2>
        <div className="font-mono text-[13px] text-ink-3">{phase.name}</div>
        <div className="mt-1 w-fit rounded border border-rule-strong px-2 py-0.5 text-[12px] text-ink-3">{phase.status}</div>
      </div>
      <div className="grid min-w-0 content-start gap-6">
        <p className="max-w-2xl text-[17px] leading-relaxed text-ink-2">{phase.question}</p>
        {facts && <ul className="flex flex-wrap gap-2">{facts.map((f) => <li key={f} className="rounded border border-rule px-2 py-1 font-mono text-[12px] text-ink-3">{f}</li>)}</ul>}
        {phase.groups.map((g) => (
          <div key={g.title} className="grid gap-1">
            <h3 className="mb-1 font-mono text-[11.5px] tracking-[0.12em] text-ink-4 uppercase">{g.title}</h3>
            <ul className="grid gap-px overflow-hidden rounded-lg border border-rule bg-rule sm:grid-cols-2">
              {g.links.map((l) => (
                <li key={l.href} className="bg-[var(--bg)]">
                  <Link href={l.href} className="group grid h-full grid-cols-[3rem_minmax(0,1fr)_1rem] items-baseline gap-2 px-3 py-3 transition-colors hover:bg-paper-2">
                    <span className="font-mono text-[12px] text-ink-4 group-hover:text-ink">{l.n}</span>
                    <span className="grid gap-0.5"><span className="text-[15px] font-medium text-ink">{l.label}</span><span className="text-[13px] leading-snug text-ink-3">{l.blurb}</span></span>
                    <span aria-hidden className="text-ink-4 transition-transform group-hover:translate-x-0.5 group-hover:text-ink">→</span>
                  </Link>
                </li>
              ))}
              {g.links.length % 2 === 1 && <li aria-hidden className="hidden bg-[var(--bg)] sm:block" />}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function Home() {
  const d = await preload([PATHS.recall, PATHS.architecture]);
  const recall = d[PATHS.recall] as Recall | undefined;
  const arch = d[PATHS.architecture] as Architecture | undefined;
  const v = arch?.verified;
  const facts = v && arch ? [`${v.num_hidden_layers} layers`, `width ${v.hidden_size.toLocaleString("en-US")}`, `${v.num_attention_heads} Q / ${v.num_key_value_heads} KV heads`,
    `vocab ${v.vocab_size.toLocaleString("en-US")}`, `${(arch.parameters.total / 1e9).toFixed(2)}B parameters`] : undefined;
  return (
    <main className="mx-auto grid w-full max-w-[1180px] flex-1 gap-14 px-4 pt-14 pb-24 sm:px-6 sm:pt-20">
      <header className="grid gap-6">
        <div className="font-mono text-[12.5px] text-ink-4"><span className="text-ink">$</span> research log · chess → language-model internals<span className="cursor-blink text-ink">▍</span></div>
        <h1 className="max-w-4xl font-serif text-[44px] leading-[1.02] font-semibold tracking-tight text-ink sm:text-[68px]">From chess moves<br />to model internals.</h1>
        <p className="max-w-2xl text-[17px] leading-relaxed text-ink-2 sm:text-[18px]">
          Phase 1 measured what models predict on chess positions. Phase 2 opens Qwen3-8B-Base to see where a prediction forms, layer by layer, and asks whether two
          models with the same final recall get there the same way.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/latent/professor" className="rounded-md bg-ink px-4 py-2.5 font-mono text-[13.5px] font-medium text-[var(--bg)] shadow-[0_0_24px_var(--mint-glow)] hover:opacity-90">▶ Start the demo</Link>
          <Link href="/latent/recall" className="rounded-md border border-ink-4 px-4 py-2.5 font-mono text-[13.5px] text-ink hover:border-ink">Recall Microscope →</Link>
          <Link href="#phase-1" className="rounded-md px-3 py-2.5 font-mono text-[13.5px] text-ink-3 hover:text-ink">All sections ↓</Link>
        </div>
      </header>
      {recall && <RecallLine recall={recall} />}
      <PhaseBlock phase={PHASES[0]} />
      <div aria-hidden className="-my-6 flex items-center gap-3 font-mono text-[12.5px] text-ink-4"><span className="h-px flex-1 bg-rule" />what happens inside the model? ↓<span className="h-px flex-1 bg-rule" /></div>
      <PhaseBlock phase={PHASES[1]} facts={facts} />
    </main>
  );
}
