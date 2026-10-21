// Foundations index, Foundations module page and the Build page. Server components; widgets are client islands.
import Link from "next/link";
import { BUILD_STEPS, SAMPLE_RUN } from "@/lib/latent/build";
import { FOUNDATIONS, ROUTE, type Foundation } from "@/lib/latent/foundations";
import { MarkDone } from "../progress/route-map";
import { FoundationWidget } from "./widgets";

const atlasHref = (part: string) => `/latent?part=${part}#atlas`;
const REPO = "learn/build";

function Kicker({ children }: { children: React.ReactNode }) {
  return <div className="text-[11.5px] font-medium tracking-[0.16em] text-ink-4 uppercase">{children}</div>;
}

export function Route({ current }: { current: number }) {
  return (
    <nav aria-label="Learning route" className="relative">
      <div aria-hidden className="absolute top-[18px] right-4 left-4 hidden h-[2px] bg-gradient-to-r from-[var(--role-resid)] via-[var(--role-attn)] to-[var(--role-mlp)] opacity-50 md:block" />
      <ol className="relative grid gap-2 md:grid-cols-6">
        {ROUTE.map((r) => (
          <li key={r.n}>
            <Link href={r.href} aria-current={r.n === current ? "step" : undefined}
              className="group flex gap-3 rounded-2xl p-2 transition-colors hover:bg-paper md:block md:p-0 md:hover:bg-transparent">
              <span className={`num flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 bg-paper font-mono text-[13px] ${r.n === current ? "border-[var(--role-resid)] text-ink shadow-[0_0_16px_-2px_var(--role-resid)]" : "border-rule-strong text-ink-3 group-hover:border-ink-4"}`}>{r.n}</span>
              <span className="block md:mt-3">
                <span className={`block text-[14px] font-medium ${r.n === current ? "text-ink" : "text-ink-2 group-hover:text-ink"}`}>{r.title}</span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-4">{r.line}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function FoundationsIndex() {
  return (
    <>
      <header className="max-w-3xl">
        <Kicker>Level 0 · Foundations</Kicker>
        <h1 className="mt-4 font-serif text-[40px] leading-[1.05] font-semibold text-ink sm:text-[54px]">Everything an LLM is made of, from zero.</h1>
        <p className="mt-5 text-[16.5px] leading-relaxed text-ink-2">
          Nine short modules. Each one is a single idea you can play with, the reason an LLM needs it, and two questions to check yourself.
          No prior maths beyond multiplying and adding. About 15 minutes each.
        </p>
      </header>

      <section aria-labelledby="route" className="mt-12 rounded-3xl border border-rule bg-paper p-5 sm:p-7">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="route" className="text-[13px] font-medium text-ink-3">The whole route, from zero to red team</h2>
          <Link href="/latent/progress" className="text-[13px] text-[var(--role-resid-ink)] underline underline-offset-2">Track your progress →</Link>
        </div>
        <Route current={0} />
      </section>

      <section aria-labelledby="modules" className="mt-14">
        <h2 id="modules" className="font-serif text-[28px] font-semibold text-ink">The modules</h2>
        <ol className="mt-6 grid gap-3 md:grid-cols-3">
          {FOUNDATIONS.map((f, i) => (
            <li key={f.slug}>
              <Link href={`/latent/foundations/${f.slug}`} className="group flex h-full flex-col rounded-2xl border border-rule bg-paper p-5 transition-colors hover:border-rule-strong">
                <span className="num font-mono text-[12px] text-ink-4">{String(i + 1).padStart(2, "0")}</span>
                <span className="mt-2 font-serif text-[20px] leading-tight font-semibold text-ink">{f.title}</span>
                <span className="mt-2 flex-1 text-[13.5px] leading-relaxed text-ink-3">{f.oneLine}</span>
                <span className="mt-4 text-[13px] text-[var(--role-resid-ink)] group-hover:underline">Play with it →</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

export function FoundationPage({ f }: { f: Foundation }) {
  const i = FOUNDATIONS.findIndex((x) => x.slug === f.slug);
  const prev = FOUNDATIONS[i - 1], next = FOUNDATIONS[i + 1];
  return (
    <article>
      <div className="flex items-center gap-2 text-[12.5px] text-ink-4">
        <Link href="/latent/foundations" className="hover:text-ink">Foundations</Link><span aria-hidden>›</span><span>{i + 1} of {FOUNDATIONS.length}</span>
      </div>
      <h1 className="mt-4 max-w-3xl font-serif text-[36px] leading-[1.08] font-semibold text-ink sm:text-[46px]">{f.title}</h1>
      <p className="mt-4 max-w-3xl text-[17px] leading-relaxed text-ink-2">{f.oneLine}</p>

      <section aria-label="Play with it" className="mt-10 rounded-3xl border border-rule bg-paper p-5 sm:p-7">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[11.5px] font-medium tracking-[0.16em] text-[var(--role-resid-ink)] uppercase">Play with it</h2>
          <p className="text-[13.5px] text-ink-3">{f.play}</p>
        </div>
        <FoundationWidget slug={f.slug} />
      </section>

      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="idea">
          <h2 id="idea" className="font-serif text-[24px] font-semibold text-ink">The idea</h2>
          <div className="mt-4 grid gap-4 text-[15.5px] leading-[1.8] text-ink-2">{f.idea.map((p, k) => <p key={k}>{p}</p>)}</div>
          <div className="mt-8 rounded-2xl border border-[color-mix(in_oklab,var(--bad)_35%,transparent)] bg-[var(--bad-soft)] px-5 py-4">
            <div className="text-[10.5px] font-medium tracking-[0.14em] text-[var(--bad-ink)] uppercase">Don&apos;t confuse</div>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink">{f.confusion}</p>
          </div>
        </section>
        <aside className="grid content-start gap-4">
          <div className="rounded-2xl border border-[color-mix(in_oklab,var(--role-resid)_45%,transparent)] bg-[var(--role-resid-soft)] px-5 py-4">
            <div className="text-[10.5px] font-medium tracking-[0.14em] text-[var(--role-resid-ink)] uppercase">Remember it as</div>
            <p className="mt-1.5 text-[16px] leading-snug text-ink">{f.hook}</p>
          </div>
          <div className="rounded-2xl border border-rule bg-paper px-5 py-4">
            <div className="text-[10.5px] font-medium tracking-[0.14em] text-ink-4 uppercase">Where it lives in an LLM</div>
            <ul className="mt-2 grid gap-1">
              {f.inLLM.map((l) => (
                <li key={l.label}>
                  <Link href={l.atlas ? atlasHref(l.atlas) : l.href ?? "#"} className="group flex items-start gap-2 rounded-lg py-1 text-[13.5px] leading-snug text-ink-2 hover:text-ink">
                    <span aria-hidden className="mt-[3px] text-[var(--role-attn)]">◆</span><span className="group-hover:underline">{l.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {f.build && (
            <Link href="/latent/build" className="rounded-2xl border border-rule bg-paper px-5 py-4 transition-colors hover:border-rule-strong">
              <div className="text-[10.5px] font-medium tracking-[0.14em] text-[var(--role-mlp-ink)] uppercase">Build it · {f.build.step}</div>
              <p className="mt-1.5 text-[13.5px] leading-snug text-ink-2">In <code className="font-mono text-[12.5px] text-ink">{REPO}/{f.build.file}</code> you {f.build.what}.</p>
            </Link>
          )}
        </aside>
      </div>

      <section aria-labelledby="check" className="mt-12">
        <h2 id="check" className="font-serif text-[24px] font-semibold text-ink">Check yourself</h2>
        <div className="mt-4 grid gap-2.5">
          {f.recall.map((r) => (
            <details key={r.q} className="group rounded-2xl border border-rule bg-paper px-5 py-4 open:border-rule-strong open:bg-paper-2">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] text-ink [&::-webkit-details-marker]:hidden">
                {r.q}<span aria-hidden className="shrink-0 rounded-full border border-rule-strong px-2.5 py-0.5 text-[11.5px] text-ink-3 group-open:hidden">Check</span>
              </summary>
              <p className="atlas-fade mt-3 text-[14px] leading-relaxed text-ink-2">{r.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <MarkDone id={`f:${f.slug}`} label="I can explain this: mark the module done" />
        <Link href="/latent/progress" className="text-[13px] text-ink-3 underline underline-offset-2 hover:text-ink">See your route</Link>
      </div>

      <nav aria-label="Modules" className="mt-10 grid gap-3 border-t border-rule pt-6 sm:grid-cols-2">
        {prev ? <Link href={`/latent/foundations/${prev.slug}`} className="rounded-2xl border border-rule px-5 py-4 hover:border-rule-strong"><span className="text-[12px] text-ink-4">← Previous</span><span className="mt-1 block text-[15px] text-ink">{prev.title}</span></Link> : <span />}
        {next
          ? <Link href={`/latent/foundations/${next.slug}`} className="rounded-2xl border border-rule px-5 py-4 text-right hover:border-rule-strong"><span className="text-[12px] text-ink-4">Next →</span><span className="mt-1 block text-[15px] text-ink">{next.title}</span></Link>
          : <Link href="/latent" className="rounded-2xl border border-[var(--role-resid)] bg-[var(--role-resid-soft)] px-5 py-4 text-right"><span className="text-[12px] text-ink-3">Level 1 →</span><span className="mt-1 block text-[15px] text-ink">The Transformer Atlas</span></Link>}
      </nav>
    </article>
  );
}

export function BuildPage() {
  return (
    <>
      <header className="max-w-3xl">
        <Kicker>Level 2 · Build it</Kicker>
        <h1 className="mt-4 font-serif text-[40px] leading-[1.05] font-semibold text-ink sm:text-[54px]">Write an LLM yourself.</h1>
        <p className="mt-5 text-[16.5px] leading-relaxed text-ink-2">
          Eight short coding steps in <code className="font-mono text-[15px] text-ink">{REPO}/</code>. In each you fill in a few marked blocks and run
          its checks, which compare your code with PyTorch&apos;s own. By step 6 you have a working transformer with Qwen3&apos;s block design that learns to write.
        </p>
      </header>

      <section aria-labelledby="how" className="mt-12 grid gap-3 md:grid-cols-3">
        <h2 id="how" className="sr-only">How it works</h2>
        {[
          ["1", "Open a step", "Read the top comment, then find each raise NotImplementedError(\"TODO\"). The comment above it gives the formula."],
          ["2", "Run its checks", "From learn/build: ../../.venv/Scripts/python -m pytest -k s01. Each failing check says what is wrong."],
          ["3", "Run the file", "Every step prints something worth seeing. After step 6, train_tiny_gpt.py trains your own model."],
        ].map(([n, t, d]) => (
          <div key={n} className="rounded-2xl border border-rule bg-paper p-5">
            <span className="num font-mono text-[12px] text-[var(--role-resid-ink)]">{n}</span>
            <div className="mt-1 text-[16px] font-medium text-ink">{t}</div>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-3">{d}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="steps" className="mt-14">
        <h2 id="steps" className="font-serif text-[28px] font-semibold text-ink">The eight steps</h2>
        <ol className="mt-6 grid gap-2.5">
          {BUILD_STEPS.map((s) => (
            <li key={s.n} className="grid gap-3 rounded-2xl border border-rule bg-paper p-5 sm:grid-cols-[48px_minmax(0,1fr)_220px] sm:items-start">
              <span className="num flex h-10 w-10 items-center justify-center rounded-full border-2 border-rule-strong font-mono text-[14px] text-ink">{s.n}</span>
              <div>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-[17px] font-medium text-ink">{s.title}</span>
                  <code className="font-mono text-[12px] text-ink-4">{s.file}</code>
                </div>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{s.write}</p>
              </div>
              <div className="grid gap-1 text-[13px] sm:text-right">
                <Link href={atlasHref(s.atlas.part)} className="text-[var(--role-attn-ink)] hover:underline">Atlas: {s.atlas.label} →</Link>
                {s.foundation && <Link href={`/latent/foundations/${s.foundation}`} className="text-ink-3 hover:text-ink hover:underline">Foundations first →</Link>}
                <MarkDone id={`b:${s.n}`} label="Checks pass" className="mt-1 sm:ml-auto sm:w-fit" />
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="see" className="mt-14 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 id="see" className="font-serif text-[28px] font-semibold text-ink">What step 6 gets you</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
            A real run of the reference solution: a {SAMPLE_RUN.params.toLocaleString("en-US")}-parameter model trained on a small synthetic story corpus.
            The loss falls from {SAMPLE_RUN.loss[0]} to {SAMPLE_RUN.loss.at(-1)} nats per character.
          </p>
          <pre className="mt-5 overflow-x-auto rounded-2xl border border-rule bg-paper-2 p-4 font-mono text-[12.5px] leading-relaxed text-ink-2">{`cd learn/build
../../.venv/Scripts/python -m pytest -k s06
../../.venv/Scripts/python train_tiny_gpt.py`}</pre>
        </div>
        <div className="grid content-start gap-3">
          <div className="rounded-2xl border border-rule bg-paper p-4">
            <div className="text-[10.5px] font-medium tracking-[0.14em] text-ink-4 uppercase">Before training</div>
            <p className="mt-2 font-mono text-[13px] break-all text-ink-3">{SAMPLE_RUN.before}</p>
          </div>
          <div className="rounded-2xl border border-[var(--role-norm)] bg-[var(--role-norm-soft)] p-4">
            <div className="text-[10.5px] font-medium tracking-[0.14em] text-[var(--role-norm-ink)] uppercase">After training</div>
            <p className="mt-2 font-mono text-[13px] text-ink">{SAMPLE_RUN.after}</p>
          </div>
        </div>
      </section>

      <section className="mt-14 rounded-3xl border border-rule bg-paper p-6">
        <h2 className="font-serif text-[22px] font-semibold text-ink">Stuck?</h2>
        <ul className="mt-3 grid gap-2 text-[14px] leading-relaxed text-ink-2">
          <li><code className="font-mono text-[13px] text-ink">solutions/</code> has the reference answers. Try for 20 minutes first: the struggle is where the learning happens.</li>
          <li><code className="font-mono text-[13px] text-ink">python make_exercises.py --force</code> resets every exercise and keeps your old files as <code className="font-mono text-[13px]">.py.bak</code>.</li>
          <li><code className="font-mono text-[13px] text-ink">BUILD_IMPL=solutions python -m pytest</code> shows what passing looks like.</li>
        </ul>
      </section>
    </>
  );
}
