// The LatentLens front page around the Atlas: a short hero, the four-verb memory model, recall prompts, three doors.
import Link from "next/link";
import { dims } from "@/lib/latent/parts";
import { fourVerbs, ROLE_COLOR } from "@/lib/latent/atlas";
import type { Architecture } from "@/lib/latent/types";

const fmt = (n: number) => n.toLocaleString("en-US");

export function AtlasHero({ arch }: { arch: Architecture }) {
  const d = dims(arch);
  const stats: [string, string][] = [
    [`${(arch.parameters.total / 1e9).toFixed(2)}B`, "parameters"],
    [String(d.L), "blocks"],
    [fmt(d.d), "numbers per token"],
    [`${d.H} / ${d.Hkv}`, "query / KV heads"],
    [fmt(d.V), "vocabulary rows"],
  ];
  return (
    <header className="relative mb-10 sm:mb-14">
      <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-[340px] w-[min(900px,100vw)] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(closest-side, color-mix(in oklab, var(--role-resid) 22%, transparent), color-mix(in oklab, var(--role-attn) 10%, transparent) 60%, transparent)" }} />
      <div className="relative">
        <div className="flex items-center gap-2 text-[11.5px] font-medium tracking-[0.16em] text-ink-4 uppercase">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--role-norm)] shadow-[0_0_10px_var(--role-norm)]" />
          Qwen3-8B-Base · every size verified from the checkpoint
        </div>
        <h1 className="mt-4 max-w-4xl font-serif text-[40px] leading-[1.02] font-semibold text-ink sm:text-[60px]">
          The transformer,<br /><span className="bg-gradient-to-r from-[var(--role-resid)] via-[var(--role-attn)] to-[var(--role-mlp)] bg-clip-text text-transparent">in one picture.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">
          Start with the whole model. Click any part to see what it does, what shape its data has and how to remember it.
          Then zoom into a block, and into attention and the MLP. The shapes and sizes are Qwen3-8B&apos;s real ones.
        </p>
        <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-rule bg-rule sm:grid-cols-5 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
          {stats.map(([v, k]) => (
            <div key={k} className="bg-paper px-4 py-3">
              <dt className="text-[11px] text-ink-4">{k}</dt>
              <dd className="num mt-0.5 font-mono text-[18px] text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  );
}

const RECALL: { q: string; a: string }[] = [
  { q: "Where is the only place tokens exchange information?", a: "Attention. The MLP, the norms and the residual additions all work on each position separately." },
  { q: "What does a block do to the residual stream?", a: "It adds two updates, one from attention and one from the MLP. It never overwrites or normalizes the stream itself; the sub-layers read a normalized copy." },
  { q: "Logits or probabilities: what comes out of the LM head?", a: "Logits, one raw score per vocabulary entry. Softmax turns them into probabilities, and a decoding rule picks one token." },
  { q: "Which of Q, K and V get rotated by RoPE?", a: "Only Q and K. Position enters through how well a query matches a key; V passes content and is never rotated or normalized." },
];

export function RememberIt({ arch }: { arch: Architecture }) {
  const verbs = fourVerbs(arch);
  const L = dims(arch).L;
  return (
    <section aria-labelledby="remember" className="mt-24">
      <div className="max-w-2xl">
        <div className="text-[11.5px] font-medium tracking-[0.16em] text-ink-4 uppercase">Remember it</div>
        <h2 id="remember" className="mt-3 font-serif text-[32px] leading-tight font-semibold text-ink sm:text-[40px]">The whole model is four verbs.</h2>
        <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2">
          Hang everything else on these. The middle two repeat {L} times, and every one of them writes onto the same running vector per token.
        </p>
      </div>

      <ol className="relative mt-10 grid gap-3 sm:grid-cols-4">
        {/* the residual stream running under all four */}
        <div aria-hidden className="absolute top-[38px] right-6 left-6 hidden h-[3px] rounded-full bg-gradient-to-r from-[var(--role-resid)] via-[var(--role-attn)] to-[var(--role-mlp)] opacity-60 shadow-[0_0_14px_var(--role-resid)] sm:block" />
        {verbs.map((v, i) => (
          <li key={v.verb} className="relative rounded-2xl border border-rule bg-paper p-5">
            <div className="flex items-center gap-3">
              <span className="num relative flex h-9 w-9 items-center justify-center rounded-full border-2 bg-[#06080d] font-mono text-[13px] text-ink"
                style={{ borderColor: ROLE_COLOR[v.role], boxShadow: `0 0 16px -2px ${ROLE_COLOR[v.role]}` }}>{i + 1}</span>
              {(i === 1 || i === 2) && <span className="rounded-full border border-rule-strong px-2 py-0.5 font-mono text-[10.5px] text-ink-3">×{L}</span>}
            </div>
            <div className="mt-4 font-serif text-[24px] font-semibold text-ink">{v.verb}</div>
            <div className="mt-0.5 text-[12px] font-medium tracking-[0.1em] uppercase" style={{ color: ROLE_COLOR[v.role] }}>{v.what}</div>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{v.line}</p>
          </li>
        ))}
      </ol>

      <div className="mt-14 grid gap-8 lg:grid-cols-[280px_1fr]">
        <div>
          <h3 className="font-serif text-[22px] font-semibold text-ink">Ten-second recall</h3>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-3">Answer in your head before you open each one. Pulling a fact back out is what makes it stick.</p>
        </div>
        <div className="grid gap-2.5">
          {RECALL.map((r) => (
            <details key={r.q} className="group rounded-2xl border border-rule bg-paper px-5 py-4 open:border-rule-strong open:bg-paper-2">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] text-ink [&::-webkit-details-marker]:hidden">
                {r.q}
                <span aria-hidden className="shrink-0 rounded-full border border-rule-strong px-2.5 py-0.5 text-[11.5px] text-ink-3 group-open:hidden">Check</span>
              </summary>
              <p className="atlas-fade mt-3 text-[14px] leading-relaxed text-ink-2">{r.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

const DOORS = [
  { href: "/latent/foundations", role: "norm" as const, kicker: "Level 0 · start here", title: "Foundations", line: "New to the maths? Vectors, matrices, softmax, loss, gradients and backprop, each as something you can play with." },
  { href: "/latent/build", role: "mlp" as const, kicker: "Level 2 · code", title: "Build it", line: "Write autograd, a tokenizer, attention and a tiny Qwen-style GPT yourself. Automatic checks tell you when it is right." },
  { href: "/latent/mastery", role: "attn" as const, kicker: "Level 3 → 4", title: "Mastery and security", line: "Training, inference, RAG, agents and MCP, then the AI-security path from threat models to red teaming." },
];

export function Doors() {
  return (
    <section aria-labelledby="deeper" className="mt-24">
      <h2 id="deeper" className="font-serif text-[28px] font-semibold text-ink">Go deeper</h2>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {DOORS.map((d) => (
          <Link key={d.href} href={d.href}
            className="group relative overflow-hidden rounded-2xl border border-rule bg-paper p-6 transition-colors hover:border-rule-strong">
            <div aria-hidden className="absolute -top-16 -right-16 h-40 w-40 rounded-full opacity-25 blur-2xl transition-opacity group-hover:opacity-50" style={{ background: ROLE_COLOR[d.role] }} />
            <div className="relative">
              <div className="text-[11px] font-medium tracking-[0.14em] uppercase" style={{ color: ROLE_COLOR[d.role] }}>{d.kicker}</div>
              <div className="mt-2 flex items-center justify-between font-serif text-[24px] font-semibold text-ink">{d.title}<span aria-hidden className="text-ink-4 transition-transform group-hover:translate-x-1">→</span></div>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-3">{d.line}</p>
            </div>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-[13px] text-ink-4">
        Everything else, including the Storybook, labs, research and professor mode, is under <span className="text-ink-3">More</span> in the top bar.
      </p>
    </section>
  );
}
