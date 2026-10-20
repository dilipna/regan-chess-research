import Link from "next/link";
import { dims } from "@/lib/latent/parts";
import { fmtBytes, fmtEps, fmtInt } from "@/lib/latent/toy";
import type { Architecture, LayerProbe, Pending, RecallPrecision } from "@/lib/latent/types";
import { Measured, Panel, SectionHead, Verified } from "./shell";

export function Hero() {
  return (
    <div className="border-b border-rule pb-10">
      <div className="eyebrow mb-3">Version 2 of MoveLens · Model internals</div>
      <h1 className="ll-title font-serif text-[40px] leading-[1.05] font-semibold tracking-tight text-ink sm:text-[54px]">LatentLens</h1>
      <p className="mt-4 max-w-3xl font-serif text-[22px] leading-snug text-ink sm:text-[25px]">Tracing human and machine writing through transformer layers.</p>
      <p className="mt-4 max-w-3xl text-[15.5px] leading-relaxed text-ink-2">
        The original project studied model behavior from the outside. LatentLens looks inside the transformer. It starts with one
        real open-weight model, Qwen3-8B-Base, verifies every architectural detail against the checkpoint itself, and then measures
        what its internal representations contain.
      </p>
      <div className="mt-7 flex flex-wrap gap-2.5">
        <Link href="/latent/demo" className="inline-flex items-center rounded-md bg-ink px-4 py-2 text-[14px] font-medium text-paper hover:bg-ink-2">Start 5-Minute Professor Demo</Link>
        <Link href="/latent/learn" className="inline-flex items-center rounded-md border border-rule-strong px-4 py-2 text-[14px] text-ink hover:border-ink-3">Learn: how Qwen works</Link>
        <Link href="/latent/research" className="inline-flex items-center rounded-md border border-rule-strong px-4 py-2 text-[14px] text-ink hover:border-ink-3">Research: human vs AI</Link>
        <Link href="/latent/recall" className="inline-flex items-center rounded-md border border-rule-strong px-4 py-2 text-[14px] text-ink hover:border-ink-3">Recall Microscope</Link>
      </div>
    </div>
  );
}

export function Progression() {
  const steps = ["Understand the architecture", "Instrument the architecture", "Measure the representations", "Test research hypotheses"];
  return (
    <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <Panel>
          <div className="eyebrow mb-1">Version 1 · MoveLens</div>
          <p className="font-serif text-[20px] text-ink">What does the model output?</p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">A Regan-inspired statistical baseline, Maia-3 and Qwen3-8B compared on the same chess decisions, using their output probabilities.</p>
          <Link href="/chess" className="mt-2 inline-block text-[12.5px] text-ink-3 underline underline-offset-2 hover:text-ink">Open Version 1</Link>
        </Panel>
        <Panel className="border-llm/30">
          <div className="eyebrow mb-1 text-llm">Version 2 · LatentLens</div>
          <p className="font-serif text-[20px] text-ink">What is happening inside the model that produces those outputs?</p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">The same Qwen3-8B-Base checkpoint, opened up: residual stream, normalization, attention, MLP, and what a linear probe can read at each depth.</p>
        </Panel>
      </div>
      <ol className="grid content-start gap-2" aria-label="Research progression">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-3 rounded-md border border-rule bg-paper px-4 py-3">
            <span className="num inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] bg-ink text-[12px] text-paper">{i + 1}</span>
            <span className="text-[15px] text-ink">{s}</span>
            {i < steps.length - 1 && <span aria-hidden className="ml-auto text-ink-4">↓</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ArchitectureOverview({ arch }: { arch: Architecture }) {
  const v = arch.verified, p = arch.parameters, D = dims(arch);
  const rows: [string, React.ReactNode, string][] = [
    ["Model", <span key="m">{arch.model_id} <span className="text-ink-4">@ {arch.revision.slice(0, 8)}</span></span>, "checkpoint"],
    ["Transformer blocks", v.num_hidden_layers, "model object"],
    ["Hidden size (residual stream width)", fmtInt(v.hidden_size), "model object"],
    ["MLP intermediate size", fmtInt(v.intermediate_size), "model object"],
    ["Query heads / KV heads", `${v.num_attention_heads} / ${v.num_key_value_heads} (${v.query_heads_per_kv_head} query heads per KV head)`, "model object"],
    ["Head dimension", v.head_dim, "model object"],
    ["Vocabulary (embedding rows / tokenizer entries)", `${fmtInt(v.vocab_size)} / ${fmtInt(v.tokenizer_size)}`, "model object, tokenizer"],
    ["Normalization", `${v.norm_type} (RMSNorm), eps ${fmtEps(v.rms_norm_eps)}; plus Q/K RMSNorm over ${v.qk_norm_dim} dims`, "implementation source"],
    ["Positions", `RoPE on Q and K, theta ${fmtInt(v.rope_theta)}, rotate-half pairing, ${v.rope_frequencies} frequencies`, "config, implementation source"],
    ["MLP activation", `${v.activation.toUpperCase()} inside SwiGLU (gate, up, down; no bias)`, "config, implementation source"],
    ["Attention bias", v.attention_bias ? "yes" : "none", "config"],
    ["Embedding and LM head tied?", v.tie_word_embeddings ? "yes" : "no, stored separately", "model object, safetensors"],
    ["Context length (max position embeddings)", fmtInt(v.max_position_embeddings), "config, model card"],
    ["Sliding window", v.use_sliding_window ? String(v.sliding_window) : "not used", "config"],
    ["Parameters", `${fmtInt(p.total)} total; ${fmtInt(p.non_embedding)} excluding embedding and LM head`, "model object = stored tensors"],
    ["Per block", `${fmtInt(p.per_layer.total)} (attention ${fmtInt(p.per_layer.attention_projections)}, MLP ${fmtInt(p.per_layer.mlp)}, norms ${fmtInt(p.per_layer.block_norms + p.per_layer.qk_norm)})`, "model object"],
    ["Stored weights", `${v.stored_dtype}, ${p.stored_bytes ? fmtBytes(p.stored_bytes) : "?"}`, "safetensors index"],
  ];
  const checks = arch.checks.source_order;
  return (
    <section className="mt-16">
      <SectionHead n={1} kicker="Architecture overview" title={`Qwen3-8B-Base, verified: ${D.L} blocks, ${fmtInt(D.d)}-wide residual stream`}>
        Every value below was read from the instantiated model, the installed transformers implementation, the checkpoint&apos;s
        config and tensor headers, and the model card. None is typed in from memory or from generic transformer assumptions.
      </SectionHead>
      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Panel badge={<Verified />} title="Verified facts">
          <div className="scroll-x">
            <table className="table-lab">
              <thead><tr><th>Quantity</th><th>Value</th><th>Verified from</th></tr></thead>
              <tbody>
                {rows.map(([k, val, src]) => (
                  <tr key={k}><th scope="row" className="text-ink-2">{k}</th><td className="num text-ink">{val}</td><td className="text-[12px] text-ink-3">{src}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px] text-ink-3">
            Model card ({arch.model_card.training_stage}): {arch.model_card.parameters} parameters, {arch.model_card.non_embedding} non-embedding,
            {" "}{arch.model_card.layers} layers, {arch.model_card.heads}, context {arch.model_card.context_length}. Consistent with the counts above.
          </p>
        </Panel>
        <Panel title={`Order of operations, checked in the installed source (${checks.filter((c) => c.verified).length}/${checks.length})`}
          badge={<span className="font-mono text-[11px] text-ink-3">transformers {arch.sources.transformers_version}</span>}>
          <ul className="grid gap-2">
            {checks.map((c) => (
              <li key={c.fact}>
                <details>
                  <summary className="cursor-pointer text-[13px] leading-snug text-ink-2 hover:text-ink">
                    <span aria-label={c.verified ? "verified" : "not verified"} className={c.verified ? "text-ours" : "text-flag"}>{c.verified ? "✓" : "✗"}</span>{" "}{c.fact}
                  </summary>
                  <pre className="scroll-x mt-1.5 rounded border border-rule bg-paper-2 p-2 font-mono text-[11px] leading-relaxed whitespace-pre text-ink-3">{c.evidence.join("\n")}</pre>
                </details>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <Pipeline arch={arch} />
    </section>
  );
}

function Pipeline({ arch }: { arch: Architecture }) {
  const D = dims(arch);
  const stages: [string, string][] = [
    ["Text", "string"], ["Tokenizer", "T pieces"], ["Token IDs", "[B, T]"], ["Embeddings", `[B, T, ${D.d}]`],
    [`${D.L} transformer blocks`, `[B, T, ${D.d}]`], ["Final RMSNorm", `[B, T, ${D.d}]`], ["LM head", `[B, T, ${fmtInt(D.V)}]`],
    ["Softmax", "probabilities"], ["Next token", "1 id"],
  ];
  return (
    <figure className="mt-6 rounded-md border border-rule bg-paper p-4 sm:p-5">
      <figcaption className="mb-3 text-[13px] font-medium text-ink">The whole forward pass, with verified shapes</figcaption>
      <ol className="flex flex-wrap items-stretch gap-1.5" aria-label="Forward pass stages">
        {stages.map(([s, sh], i) => (
          <li key={s} className="flex items-center gap-1.5">
            <div className={`rounded border px-2.5 py-1.5 ${i === 4 ? "border-llm/40 bg-llm-soft" : "border-rule-strong bg-paper-2/60"}`}>
              <div className="text-[13px] text-ink">{s}</div>
              <div className="font-mono text-[11px] text-ink-3">{sh}</div>
            </div>
            {i < stages.length - 1 && <span aria-hidden className="text-ink-4">→</span>}
          </li>
        ))}
      </ol>
    </figure>
  );
}

export function ModeCards({ arch, layerProbe, precision }: { arch: Architecture; layerProbe: LayerProbe | Pending; precision?: RecallPrecision }) {
  const g = precision?.passages[0];
  return (
    <section className="mt-16 grid gap-4 md:grid-cols-3">
      <Panel title="Learn" badge={<Verified>Ready</Verified>}>
        <p className="text-[13.5px] leading-relaxed text-ink-2">Follow one token through Qwen, open a transformer block, and work through RMSNorm, Q/K/V, GQA, RoPE, causal attention, SwiGLU, decoding, the KV cache and training.</p>
        <Link href="/latent/learn" className="mt-3 inline-block text-[13px] text-ink underline underline-offset-2">Open Learn Mode</Link>
      </Panel>
      <Panel title="Research" badge={layerProbe.status === "ok" ? <Measured>Results</Measured> : <span className="text-[11px] text-ink-3">Experiment pending</span>}>
        <p className="text-[13.5px] leading-relaxed text-ink-2">Where inside Qwen does information that distinguishes human-written from AI-generated text become linearly accessible? Pipeline built and tested; the Qwen3-8B run waits for EditLens data access.</p>
        <Link href="/latent/research" className="mt-3 inline-block text-[13px] text-ink underline underline-offset-2">Open Research Mode</Link>
      </Panel>
      <Panel title="Recall Microscope" badge={<Measured>Measured</Measured>}>
        <p className="text-[13.5px] leading-relaxed text-ink-2">
          Next-token recall with the true token&apos;s rank traced through all {arch.verified.num_hidden_layers + 1} depths (embeddings plus {arch.verified.num_hidden_layers} blocks).
          {g && <> Gettysburg Address: top-1 recall <span className="num">{(g.top1_rate.bfloat16 * 100).toFixed(1)}%</span> in bfloat16 ({g.n_scored} tokens).</>}
        </p>
        <Link href="/latent/recall" className="mt-3 inline-block text-[13px] text-ink underline underline-offset-2">Open the Recall Microscope</Link>
      </Panel>
    </section>
  );
}

export function OpenVsClosed() {
  return (
    <section className="mt-16">
      <SectionHead kicker="Which models can be probed" title="Internal probe models and black-box generators" />
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Internal probe model">
          <p className="text-[13.5px] leading-relaxed text-ink-2">Weights and hidden states are available, so we can read the residual stream, RMSNorm inputs and outputs, attention and MLP updates. Example: Qwen3-8B-Base (open weights). Only models of this kind appear in LatentLens&apos;s internal measurements.</p>
        </Panel>
        <Panel title="Black-box generator">
          <p className="text-[13.5px] leading-relaxed text-ink-2">Only text comes back through an API. Examples include proprietary frontier systems. Their generated text can be studied as data (for example as the AI side of a human-vs-AI dataset), but their residual streams, normalization states, attention and MLP activations are not accessible and are never shown here.</p>
        </Panel>
      </div>
      <p className="mt-3 text-[12.5px] text-ink-3">Every tensor shape on this site refers to Qwen3-8B-Base only.</p>
    </section>
  );
}
