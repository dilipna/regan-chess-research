import type { Metadata } from "next";
import Link from "next/link";
import maia from "../../../public/data/engineering/maia-verification.json";
import hybrid from "../../../public/data/engineering/hybrid-verification.json";

export const metadata: Metadata = {
  title: "Engineering evidence",
  description: "Reproducing saved research metrics and protecting interrupted transformer extraction from stale artifacts.",
};

const labels: Record<string, string> = {
  A0_zt1: "Top-1 statistical z-score", A_stat: "Statistical features", B_sf: "Stockfish features",
  C_sf_maia: "Stockfish + Maia", D_sf_maia_seq: "Sequence extension",
};

export default function EngineeringPage() {
  return (
    <main className="mx-auto grid w-full max-w-[1000px] flex-1 gap-12 px-4 py-14 sm:px-6">
      <header className="grid gap-4 border-b border-rule pb-8">
        <p className="text-[13px] font-medium tracking-wide text-ink-3 uppercase">Research engineering · October 21, 2026</p>
        <h1 className="font-serif text-[38px] leading-tight font-semibold text-ink sm:text-[48px]">Can you reproduce the result—and trust the restart?</h1>
        <p className="max-w-3xl text-[18px] leading-relaxed text-ink-2">Two engineering boundaries behind this project: independently recalculating reported metrics from saved outputs, and resuming a long transformer extraction without binding stale vectors to new documents.</p>
      </header>

      <section className="grid gap-4" aria-labelledby="reproduction">
        <h2 id="reproduction" className="font-serif text-[28px] font-semibold">Recalculate the saved evidence</h2>
        <p className="leading-relaxed text-ink-2">The minimal CPU verifier checks frozen input hashes and recomputes top-1/top-3 accuracy, mean negative log-likelihood and mean rank for two Maia models on {maia.positions.toLocaleString("en-US")} paired positions. Eight model intervals and four paired intervals use 2,000 shared source-game resamples. They match the stored references within the predeclared absolute tolerance of 1e-10.</p>
        <p className="leading-relaxed text-ink-2">A separate optional command requires the exact frozen, locally supplied split/variant/prediction snapshots. It checks recorded player/game separation and independently reproduces the hybrid ROC-AUC points and seven paired intervals within 1e-9. Those private input files are not bundled with this website or available from a fresh clone.</p>
        <div className="overflow-x-auto rounded border border-rule" tabIndex={0} role="region" aria-label="Reproduced hybrid ROC-AUC table">
          <table className="w-full text-left text-[14px]">
            <caption className="p-3 text-left text-ink-3">{hybrid.n_rows.toLocaleString("en-US")} saved held-out rows · {hybrid.n_clusters} source games · controlled move substitutions</caption>
            <thead><tr className="border-y border-rule"><th scope="col" className="p-3">Saved score</th><th scope="col" className="p-3 text-right">Recomputed ROC-AUC</th></tr></thead>
            <tbody>{Object.entries(hybrid.auc).map(([key, value]) => <tr key={key} className="border-b border-rule last:border-0"><th scope="row" className="p-3 font-normal">{labels[key]}</th><td className="p-3 text-right font-mono">{value.toFixed(6)}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-3 text-[14px]">
          <a className="rounded border border-rule-strong px-3 py-2 underline underline-offset-4" href="/data/engineering/maia-verification.json" download>Maia verification report (JSON)</a>
          <a className="rounded border border-rule-strong px-3 py-2 underline underline-offset-4" href="/data/engineering/hybrid-verification.json" download>Hybrid verification report (JSON)</a>
        </div>
        <p className="text-[14px] leading-relaxed text-ink-3">Reports retain exact values, intervals, input/verifier/contract hashes and numerical runtime. These are snapshots of executed local checks, not a live health monitor or a claim that CI ran remotely.</p>
      </section>

      <section className="grid gap-4" aria-labelledby="recovery">
        <h2 id="recovery" className="font-serif text-[28px] font-semibold">Make interrupted extraction safe to resume</h2>
        <p className="leading-relaxed text-ink-2">The old extractor skipped a chunk if its filename existed. A deterministic CLI fixture changed a source document and demonstrated stale vectors under rewritten metadata. A second fixture exposed mixing a new split with an existing run under a changed numerical runtime. These are reproduced code defects; they do not establish that published experiments encountered them.</p>
        <ol className="grid list-decimal gap-3 pl-6 leading-relaxed text-ink-2">
          <li>Bind the shared model revision, configuration, numerical runtime, execution device and code identity before adding any split.</li>
          <li>Bind each split&apos;s ordered text, tokenization, metadata and chunk layout before publishing metadata.</li>
          <li>Reuse a chunk only after its completion receipt, hash, exact keys, dimensions, precision and valid values agree.</li>
          <li>Publish data atomically, then its completion receipt. Recompute unfinished work; reject corrupt completed work.</li>
          <li>Serialize writers with an OS-held lock and validate final split/run identities before downstream reading.</li>
        </ol>
        <p className="leading-relaxed text-ink-2">Failure/recovery tests cover changed content/order/settings, interrupted writes, process-death lock release, corrupted artifacts and clean-versus-resumed parity. Real cached-model regressions separately check extraction, streaming, hooks and probing. Historical artifacts stay intact; old unverified chunks require a new output directory.</p>
      </section>

      <section className="grid gap-4" aria-labelledby="limits">
        <h2 id="limits" className="font-serif text-[28px] font-semibold">What this evidence establishes</h2>
        <p className="leading-relaxed text-ink-2">It establishes saved-output arithmetic, recorded split-identifier consistency, and tested local extraction integrity. It does not regenerate the original model predictions, establish true human identities, prove real-world cheating detection, complete the pending held-out Qwen evaluation, or measure a production speedup. The Regan-inspired reconstruction remains independent of Professor Regan&apos;s production system.</p>
        <p className="leading-relaxed text-ink-2">Checkpoint coordination is for a single host with normal filesystem locking and atomic replacement. Hashes detect accidental drift; they do not defend against an authorized operator rewriting both data and receipts. Final consolidation still loads arrays in memory.</p>
        <div className="flex flex-wrap gap-5 text-[14px] underline underline-offset-4"><Link href="/methodology">Chess methodology</Link><Link href="/latent/methods">Model-internals methods</Link><Link href="/results">Scientific results</Link><a href="https://github.com/dilipna/regan-chess-research">Source repository</a></div>
      </section>
    </main>
  );
}
