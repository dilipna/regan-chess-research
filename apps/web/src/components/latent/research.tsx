"use client";

import { useEffect, useState } from "react";
import { loadJson } from "@/lib/data";
import { BASE } from "@/lib/latent/paths";
import { fmtInt } from "@/lib/latent/toy";
import { isOk, type Architecture, type ComponentProbe, type LayerProbe, type Pending, type PcaIndex, type ProbeMetrics, type RmsnormProbe, type StreamingCheck } from "@/lib/latent/types";
import { LineChart, SERIES } from "./charts";
import { Callout, Measured, Panel, PendingCard, SectionHead } from "./shell";

const f3 = (v: number | null | undefined) => (v == null ? "n/a" : v.toFixed(3));

export function ResearchQuestion() {
  const q = ["At what layer does separation first become linearly accessible?", "Is the strongest layer intermediate or final?", "Does RMSNorm change separability?",
    "Does activation magnitude matter?", "Does attention increase separation?", "Does the MLP increase separation?", "Does the signal generalize across AI generators?", "Does the signal survive domain shift?"];
  return (
    <section>
      <SectionHead kicker="Research Mode" title="Where inside Qwen does information useful for distinguishing human-written from AI-generated text emerge?">
        Qwen3-8B-Base is frozen. For each document we read its hidden states at every depth and ask whether a simple linear classifier can tell human-written from fully
        AI-generated text using only that representation. The model is never fine-tuned.
      </SectionHead>
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Panel title="Secondary questions"><ol className="list-decimal space-y-1 pl-5 text-[13.5px] text-ink-2">{q.map((x) => <li key={x}>{x}</li>)}</ol></Panel>
        <Panel title="How results are worded on this site">
          <ul className="space-y-1.5 text-[13.5px] leading-relaxed text-ink-2">
            <li><span className="text-ink-4 line-through">A layer detects AI.</span> → A linear classifier can access information correlated with the human-vs-AI label from this representation.</li>
            <li><span className="text-ink-4 line-through">RMSNorm causes AI detection.</span> → Separability changed across these representations, suggesting normalization may alter the accessibility of label-related information.</li>
            <li><span className="text-ink-4 line-through">Qwen knows this is AI text.</span> → (never claimed)</li>
            <li><span className="text-ink-4 line-through">A detector proves authorship.</span> → A probe score is evidence about a text&apos;s statistical properties, not proof of who wrote it.</li>
          </ul>
        </Panel>
      </div>
    </section>
  );
}

export function DatasetAndMethod({ arch, streaming }: { arch: Architecture; streaming?: StreamingCheck }) {
  return (
    <section className="mt-14">
      <SectionHead kicker="Data and method" title="Dataset, extraction and probing protocol" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Dataset: Pangram EditLens">
          <p className="text-[13.5px] leading-relaxed text-ink-2">
            <span className="font-mono text-[12.5px]">pangram/editlens_iclr</span> on Hugging Face: human-written, AI-edited and fully AI-generated texts with generator and source
            metadata. The first task uses only human-written vs fully AI-generated text. Published splits: train, val, test, plus <span className="font-mono">test_llama</span> (held-out
            generator family) and <span className="font-mono">test_enron</span> (domain shift: e-mails).
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-flag">Status: access is gated (manual approval, non-commercial terms). Access has not been granted to this project yet, so no human-vs-AI result exists.</p>
        </Panel>
        <Panel title="Hidden-state extraction">
          <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-ink-2">
            <li>document = &lt;|endoftext|&gt; + up to 512 tokens; the start token is excluded from pooling</li>
            <li>all {arch.verified.num_hidden_layers + 1} depths: mean pooling and last-token pooling (one is chosen on validation)</li>
            <li>seven sites inside 5 blocks for the RMSNorm and attention-vs-MLP studies</li>
            <li>per-document mean token RMS and mean next-token loss (perplexity baseline)</li>
            <li>frozen model, inference mode, explicit hooks, nothing stored per token</li>
          </ul>
        </Panel>
        <Panel title="Probing protocol (fixed in advance)">
          <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-ink-2">
            <li>StandardScaler + L2 logistic regression; C by grouped CV inside train</li>
            <li>layer and pooling selected on validation only</li>
            <li>test evaluated once: at the selected depth and at the final depth</li>
            <li>leakage audit (ids, identical texts, EditLens source_id groups) must pass first</li>
            <li>controls: shuffled labels, length, token count, perplexity, stylometry, length-matched test subset, per-generator and held-out splits</li>
          </ul>
        </Panel>
      </div>
      <Callout>
        <span className="font-medium text-ink">Pipeline status.</span> Every script runs end to end and is covered by automated tests on the small Qwen3-0.6B-Base checkpoint with a synthetic
        fixture (a structural test, never shown as a result). The layer-streaming runner used on this laptop reproduces the ordinary forward pass to within 1e-4 in float32.
        {streaming && <> On Qwen3-8B in bfloat16 it agrees with an independent offloaded transformers run on {streaming.results.map((r) => `${Math.round(r.top1_agreement * r.positions)}/${r.positions}`).join(" and ")} top-1 tokens (largest log-probability difference {Math.max(...streaming.results.map((r) => r.max_abs_logprob_diff_top20)).toFixed(2)} nats, from bfloat16 rounding).</>}
      </Callout>
    </section>
  );
}

function MetricsRow({ label, m }: { label: string; m?: ProbeMetrics | null }) {
  return <tr><th scope="row">{label}</th><td className="num r">{f3(m?.roc_auc)}{m?.roc_auc_ci95 && <span className="text-ink-3"> [{f3(m.roc_auc_ci95[0])}, {f3(m.roc_auc_ci95[1])}]</span>}</td><td className="num r">{f3(m?.pr_auc)}</td><td className="num r">{f3(m?.balanced_accuracy)}</td><td className="num r">{f3(m?.f1)}</td><td className="num r">{m ? fmtInt(m.n) : ""}</td></tr>;
}

export function LayerProbeSection({ lp }: { lp: LayerProbe | Pending }) {
  return (
    <section className="mt-14">
      <SectionHead n={8} kicker="Research" title="Human-vs-AI separability across Qwen" id="layers">
        Validation ROC-AUC of a linear probe at every depth. Chance is 0.5. The best depth is chosen on validation; the test set is used once.
      </SectionHead>
      {!isOk<LayerProbe>(lp) ? <PendingCard title="Layerwise probe on Qwen3-8B-Base" artifact={lp} /> : (
        <div className="grid gap-6">
          <Panel badge={<Measured>{`${lp.dataset}, ${lp.pooling} pooling`}</Measured>}>
            <LineChart title="Validation ROC-AUC by depth" series={[{ key: "v", label: "validation ROC-AUC", color: SERIES.a, points: lp.layers.map((r) => ({ x: r.depth, y: r.val.roc_auc })) }]}
              xLabel="depth (0 = embeddings)" yLabel="ROC-AUC" yDomain={[0.4, 1]} refLines={[{ y: 0.5, label: "chance" }]}
              markers={[{ x: lp.selected_depth, label: `selected ${lp.selected_depth}` }, ...(lp.final_depth !== lp.selected_depth ? [{ x: lp.final_depth, label: "final" }] : [])]}
              caption={`Train ${lp.splits.train?.n}, validation ${lp.splits.val?.n}, test ${lp.splits.test?.n} documents.`} />
          </Panel>
          <Panel title="Held-out test (evaluated once)">
            <table className="table-lab">
              <thead><tr><th></th><th className="r">ROC-AUC [95% CI]</th><th className="r">PR-AUC</th><th className="r">bal. acc.</th><th className="r">F1</th><th className="r">n</th></tr></thead>
              <tbody>
                <MetricsRow label={`selected depth ${lp.selected_depth}`} m={lp.test.selected_depth} />
                <MetricsRow label={`final depth ${lp.final_depth}`} m={lp.test.final_depth} />
                {Object.entries(lp.extra_tests).map(([k, m]) => <MetricsRow key={k} label={`${k} (selected depth)`} m={m} />)}
                <MetricsRow label="length-matched test subset" m={lp.length_matched_test} />
                {Object.entries(lp.per_generator_test).map(([k, m]) => <MetricsRow key={k} label={`generator: ${k}`} m={m} />)}
              </tbody>
            </table>
          </Panel>
          <Panel title="Negative controls and simple baselines">
            <table className="table-lab">
              <thead><tr><th></th><th className="r">validation ROC-AUC</th><th className="r">test ROC-AUC</th></tr></thead>
              <tbody>
                {lp.controls.random_labels.map((r) => <tr key={r.seed}><th scope="row">shuffled labels (seed {r.seed})</th><td className="num r">{f3(r.val_roc_auc)}</td><td className="num r">{f3(r.test_roc_auc)}</td></tr>)}
                {Object.entries(lp.controls.baselines).map(([k, b]) => <tr key={k}><th scope="row">{k.replace("_", " ")}</th><td className="num r">{b.val ? f3(b.val.roc_auc) : b.reason}</td><td className="num r">{b.test ? f3(b.test.roc_auc) : ""}</td></tr>)}
              </tbody>
            </table>
          </Panel>
        </div>
      )}
    </section>
  );
}

function Scatter({ file }: { file: string }) {
  const [d, setD] = useState<{ depth: number; points: { x: number; y: number; label: number }[]; explained_variance_ratio: number[] } | null>(null);
  useEffect(() => { loadJson<typeof d>(`${BASE}/pca/${file}`).then(setD); }, [file]);
  if (!d) return <p className="text-[12px] text-ink-3">Loading…</p>;
  const xs = d.points.map((p) => p.x), ys = d.points.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const sx = (x: number) => 10 + ((x - x0) / (x1 - x0 || 1)) * 200, sy = (y: number) => 210 - ((y - y0) / (y1 - y0 || 1)) * 200;
  return (
    <figure>
      <svg viewBox="0 0 220 220" className="w-full" role="img" aria-label={`PCA of validation documents at depth ${d.depth}`}>
        {d.points.map((p, i) => p.label === 0
          ? <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="2.6" fill="none" stroke="var(--viz-1)" strokeWidth="1.2" />
          : <path key={i} d={`M${sx(p.x)},${sy(p.y) - 3} l3,5 h-6 z`} fill="var(--viz-2)" opacity="0.8" />)}
      </svg>
      <figcaption className="text-[11.5px] text-ink-3">depth {d.depth}; PC1 {(d.explained_variance_ratio[0] * 100).toFixed(1)}%, PC2 {(d.explained_variance_ratio[1] * 100).toFixed(1)}% of variance</figcaption>
    </figure>
  );
}

export function PcaSection({ pca }: { pca: PcaIndex | Pending }) {
  return (
    <section className="mt-14">
      <SectionHead n={9} kicker="Research" title="Representation journey (PCA)" id="pca">
        PCA is an exploratory visualization. Quantitative evidence comes from held-out classifier metrics. Fitted on training documents, shown on validation documents.
      </SectionHead>
      {!isOk<PcaIndex>(pca) ? <PendingCard title="PCA of pooled representations" artifact={pca} /> : (
        <Panel badge={<span className="text-[11.5px] text-ink-3">○ human · ▲ AI</span>}>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">{pca.depths.map((d) => <Scatter key={d.file} file={d.file} />)}</div>
          <p className="mt-3 text-[12px] text-ink-3">Visible clusters do not prove separation, and their absence does not disprove it: a label can be linearly readable along a direction outside the top two components.</p>
        </Panel>
      )}
    </section>
  );
}

export function RmsnormResearch({ r }: { r: RmsnormProbe | Pending }) {
  return (
    <section className="mt-14">
      <SectionHead n={10} kicker="Research" title="RMSNorm and activation magnitude" id="rmsnorm-research">
        Does normalization change how linearly accessible the label is, and does activation magnitude carry label-related information? Block RMSNorm only; Q/K RMSNorm is a separate per-head operation.
      </SectionHead>
      {!isOk<RmsnormProbe>(r) ? <PendingCard title="RMSNorm and magnitude probes" artifact={r} /> : (
        <div className="grid gap-6">
          <Panel title="Before vs after block RMSNorm (validation ROC-AUC)">
            <table className="table-lab">
              <thead><tr><th>block</th><th className="r">resid_pre</th><th className="r">attn_norm</th><th className="r">Δ [95% CI]</th><th className="r">resid_mid</th><th className="r">mlp_norm</th><th className="r">Δ [95% CI]</th></tr></thead>
              <tbody>{r.block_rmsnorm.map((b) => (
                <tr key={b.layer}><td className="num">{b.layer + 1}</td><td className="num r">{f3(b.resid_pre.roc_auc)}</td><td className="num r">{f3(b.attn_norm.roc_auc)}</td>
                  <td className="num r">{f3(b.attn_norm_minus_resid_pre.diff)} [{f3(b.attn_norm_minus_resid_pre.ci95[0])}, {f3(b.attn_norm_minus_resid_pre.ci95[1])}]</td>
                  <td className="num r">{f3(b.resid_mid.roc_auc)}</td><td className="num r">{f3(b.mlp_norm.roc_auc)}</td>
                  <td className="num r">{f3(b.mlp_norm_minus_resid_mid.diff)} [{f3(b.mlp_norm_minus_resid_mid.ci95[0])}, {f3(b.mlp_norm_minus_resid_mid.ci95[1])}]</td></tr>
              ))}</tbody>
            </table>
          </Panel>
          <Panel>
            <LineChart title="Raw vs unit-L2 vs magnitude only (validation ROC-AUC)" xLabel="depth" yLabel="ROC-AUC" yDomain={[0.4, 1]} refLines={[{ y: 0.5, label: "chance" }]}
              series={[{ key: "raw", label: "raw pooled vector", color: SERIES.a, points: r.depths.map((d) => ({ x: d.depth, y: d.raw.roc_auc })) },
                { key: "unit", label: "unit L2 norm", color: SERIES.b, dash: "6 3", points: r.depths.map((d) => ({ x: d.depth, y: d.unit_l2.roc_auc })) },
                { key: "mag", label: "magnitude only", color: SERIES.ink, dash: "2 3", points: r.depths.map((d) => ({ x: d.depth, y: d.magnitude_only.roc_auc })) }]}
              caption="A change in separability does not prove a causal role for normalization." />
          </Panel>
        </div>
      )}
    </section>
  );
}

export function ComponentResearch({ c }: { c: ComponentProbe | Pending }) {
  return (
    <section className="mt-14">
      <SectionHead n={11} kicker="Research" title="Attention vs MLP" id="components">
        At which transformation inside a block does linear separability change? Compared between residual-stream states that differ by exactly one update.
      </SectionHead>
      {!isOk<ComponentProbe>(c) ? <PendingCard title="Component probes inside five blocks" artifact={c} /> : (
        <Panel title="Validation ROC-AUC at each site">
          <div className="scroll-x">
            <table className="table-lab">
              <thead><tr><th>block</th>{c.sites.map((s) => <th key={s} className="r font-mono normal-case">{s}</th>)}<th className="r">attention step</th><th className="r">MLP step</th></tr></thead>
              <tbody>{c.layers.map((l) => (
                <tr key={l.layer}><td className="num">{l.layer + 1}</td>{c.sites.map((s) => <td key={s} className="num r">{f3((l[s] as ProbeMetrics).roc_auc)}</td>)}
                  <td className="num r">{f3(l.attention_step.diff)} [{f3(l.attention_step.ci95[0])}, {f3(l.attention_step.ci95[1])}]</td>
                  <td className="num r">{f3(l.mlp_step.diff)} [{f3(l.mlp_step.ci95[0])}, {f3(l.mlp_step.ci95[1])}]</td></tr>
              ))}</tbody>
            </table>
          </div>
        </Panel>
      )}
    </section>
  );
}
