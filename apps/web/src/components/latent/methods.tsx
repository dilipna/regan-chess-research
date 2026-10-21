import { PATHS } from "@/lib/latent/paths";
import type { Architecture, Metadata, StreamingCheck } from "@/lib/latent/types";
import { Panel, SectionHead } from "./shell";
import { Prov } from "./kit";

const limits = (a: Architecture) => [
  `One model so far. Every internal measurement is ${a.model_id} at revision ${a.revision.slice(0, 8)}; nothing here generalizes to other models without running them.`,
  "The one-sentence trace and the two recall passages are illustrations measured on real data, not samples large enough for general statements about Qwen.",
  "Learn Mode labs marked Toy use hand-picked numbers to teach an operation. They are not Qwen values.",
  "Diagnostic projections (logit lens) read intermediate residuals through a head trained on the last residual only. They show linear readability, not the model's intermediate decisions.",
  "Measurements on the laptop use layer streaming in bfloat16. Two bfloat16 code paths can differ by a few tenths of a nat on individual log-probabilities; near-tie top-1 decisions can flip.",
  "Human-vs-AI results do not exist yet. The EditLens dataset is gated and access has not been granted. The pipeline is tested only structurally, on a small model and a synthetic fixture.",
  "When they exist, probe results will describe linear accessibility of label-correlated information in one dataset. They will not show causal mechanisms, will not transfer automatically to other generators or domains, and cannot establish authorship of any text.",
  "Black-box API models are never internally probed here; their text can only be data.",
];

const NOT_CLAIM = [
  "\"Layer k detects AI text.\"", "\"RMSNorm causes (or removes) the AI signal.\"", "\"Qwen knows this text is AI-generated.\"",
  "\"These PCA clusters prove the classes separate.\"", "\"The logit lens shows what Qwen predicts at layer k.\"", "\"A detector score proves who wrote a text.\"",
  "\"We probed GPT, Claude or Gemini internals.\"", "\"Qwen's recall plateau is explained.\" (Not measured: only one model has been run.)",
];

export function Methods({ arch, metadata, streaming }: { arch: Architecture; metadata?: Metadata; streaming?: StreamingCheck }) {
  const files = Object.entries(PATHS).filter(([k]) => k !== "recallFp32");
  return (
    <div className="grid gap-14">
      <section>
        <SectionHead n={13} kicker="Methods" title="How every number on these pages was produced" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Model and software">
            <div className="scroll-x"><table className="table-lab [&_td]:[overflow-wrap:anywhere]"><tbody>
              <tr><th scope="row">Model</th><td className="font-mono text-[12px]">{arch.model_id}</td></tr>
              <tr><th scope="row">Revision</th><td className="font-mono text-[12px]">{arch.revision}</td></tr>
              <tr><th scope="row">Tokenizer</th><td className="font-mono text-[12px]">same repository and revision</td></tr>
              <tr><th scope="row">transformers / torch</th><td className="font-mono text-[12px]">{metadata?.transformers_version} / {metadata?.torch_version}</td></tr>
              <tr><th scope="row">Hardware</th><td className="text-[12.5px]">{metadata?.device ?? "n/a"} (layer streaming; one decoder layer on the GPU at a time)</td></tr>
              <tr><th scope="row">Exported</th><td className="font-mono text-[12px]">{metadata?.timestamp}</td></tr>
              <tr><th scope="row">Git commit at export</th><td className="font-mono text-[12px]">{metadata?.git_commit ?? "n/a"}</td></tr>
            </tbody></table></div>
          </Panel>
          <Panel title="Measurement design">
            <ul className="list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-ink-2">
              <li>Architecture: model instantiated on the meta device (exact shapes, no weights), compared with the stored safetensors headers and the model card; operation order checked in the installed source.</li>
              <li>Hidden states: forward hooks at module boundaries (layer input, RMSNorm outputs, attention output, MLP output, layer output), not <span className="font-mono">output_hidden_states</span>, whose last entry is post-norm in this transformers version.</li>
              <li>Layer streaming: the library&apos;s own Qwen3DecoderLayer, loaded one at a time. Tested equal to the full model (1e-4, float32, Qwen3-0.6B-Base).</li>
              {streaming && <li>Real 8B cross-check in bfloat16 against an offloaded transformers model: top-1 agreement {streaming.results.map((r) => `${Math.round(r.top1_agreement * r.positions)}/${r.positions}`).join(" and ")} positions on two sentences, log-probability differences up to {Math.max(...streaming.results.map((r) => r.max_abs_logprob_diff_top20)).toFixed(2)} nats. This is agreement within bfloat16 noise on a small check, not complete numerical equivalence; the runner is still being validated.</li>}
              <li>Documents and passages start with &lt;|endoftext|&gt;, which Qwen&apos;s tokenizer does not add by itself.</li>
            </ul>
          </Panel>
        </div>
      </section>
      <section>
        <SectionHead kicker="Methods" title="How every visual is labelled" />
        <ul className="grid gap-2 md:grid-cols-2">
          <li className="rounded-md border border-rule bg-paper p-3 text-[14px] text-ink-2"><Prov kind="toy" /> Small, hand-made or seeded numbers that teach an operation exactly. Not Qwen values. Controls may change them freely.</li>
          <li className="rounded-md border border-rule bg-paper p-3 text-[14px] text-ink-2"><Prov kind="recorded" /> Saved from the real checkpoint or from a recorded forward pass. Controls only select among what was recorded; new text is never simulated.</li>
          <li className="rounded-md border border-rule bg-paper p-3 text-[14px] text-ink-2"><Prov kind="live" /> Would mean the model runs in your browser or on a server now. Nothing on these pages does, so this label is not used.</li>
          <li className="rounded-md border border-rule bg-paper p-3 text-[14px] text-ink-2"><Prov kind="pending" /> The experiment has not been run. No values or charts are shown; the commands that produce them are listed.</li>
        </ul>
      </section>
      <section>
        <SectionHead kicker="Methods" title="Limitations" />
        <ol className="grid gap-2 md:grid-cols-2">{limits(arch).map((l, i) => <li key={i} className="rounded-md border border-rule bg-paper p-3 text-[13px] leading-relaxed text-ink-2"><span className="num mr-1.5 text-ink-4">{i + 1}</span>{l}</li>)}</ol>
      </section>
      <section>
        <SectionHead kicker="Methods" title="Claims this project does not make" />
        <ul className="grid gap-2 sm:grid-cols-2">{NOT_CLAIM.map((c) => <li key={c} className="rounded border border-dashed border-rule-strong px-3 py-2 text-[13px] text-ink-2">{c}</li>)}</ul>
      </section>
      <section>
        <SectionHead kicker="Methods" title="Reproduce and download" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Commands">
            <pre className="scroll-x rounded border border-rule bg-paper-2 p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre text-ink-2">{`python scripts/latentlens/inspect_qwen_architecture.py --model Qwen/Qwen3-8B-Base
python scripts/latentlens/build_tokenizer_examples.py
python scripts/latentlens/trace_one_token.py --loader stream
python scripts/latentlens/run_recall_analysis.py --loader stream \\
  --input scripts/latentlens/passages/gettysburg_address.txt --name "Gettysburg Address (public domain)" \\
  --input scripts/latentlens/passages/control_original.txt --name "Original control paragraph (unpublished)"
python scripts/latentlens/verify_streaming.py
python scripts/latentlens/export_web_artifacts.py`}</pre>
            <p className="mt-2 text-[12px] text-ink-3">Full GPU workflow for the university machines: docs/LATENTLENS_CSE_RUNBOOK.md.</p>
          </Panel>
          <Panel title="Artifacts (JSON)">
            <ul className="grid gap-1 text-[13px]">{files.map(([k, p]) => (
              <li key={k}><a href={p} className="font-mono text-[12px] text-ink-2 underline underline-offset-2 hover:text-ink">{p.split("/").slice(-2).join("/")}</a>
                {metadata?.artifacts[p.split("/qwen3-8b/")[1]] === "pending" && <span className="ml-2 text-[11px] text-ink-3">pending</span>}</li>
            ))}</ul>
          </Panel>
        </div>
      </section>
    </div>
  );
}
