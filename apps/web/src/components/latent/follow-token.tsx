"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { pipelineParts } from "@/lib/latent/parts";
import { fmtInt, fmtProb, showTok } from "@/lib/latent/toy";
import type { Architecture, TokenizerExamples, TokenTrace } from "@/lib/latent/types";
import { LineChart, SERIES } from "./charts";
import { FiveIdeas, Measured, Panel, SectionHead, Shape } from "./shell";

export function TokenChips({ tokens, showIds = true }: { tokens: { id: number; piece: string; text: string; special?: boolean; prefix?: boolean }[]; showIds?: boolean }) {
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Tokens">
      {tokens.map((t, i) => (
        <li key={i} className={cn("rounded border px-2 py-1", t.special || t.prefix ? "border-dashed border-ink-4 bg-paper-2" : "border-rule-strong bg-paper")}>
          <div className="font-mono text-[13px] whitespace-pre text-ink">{showTok(t.text)}</div>
          <div className="font-mono text-[10.5px] text-ink-3">{t.piece !== t.text ? t.piece : " "}</div>
          {showIds && <div className="num text-[11px] text-llm">{t.id}</div>}
        </li>
      ))}
    </ol>
  );
}

export function TokenizerExplorer({ tok }: { tok: TokenizerExamples }) {
  const [k, setK] = useState(0);
  const [draft, setDraft] = useState("");
  const ex = tok.examples[k];
  const match = draft ? tok.examples.findIndex((e) => e.text === draft) : -1;
  return (
    <Panel title="Tokenizer explorer" badge={<Measured>Real Qwen tokenizer, precomputed</Measured>}>
      <label className="text-[12px] text-ink-3" htmlFor="tok-ex">Example</label>
      <select id="tok-ex" value={k} onChange={(e) => setK(Number(e.target.value))}
        className="mt-1 mb-3 block w-full rounded border border-rule-strong bg-paper px-2 py-1.5 font-mono text-[13px] text-ink">
        {tok.examples.map((e, i) => <option key={i} value={i}>{e.text}</option>)}
      </select>
      <p className="mb-2 text-[12.5px] text-ink-3">{ex.note}</p>
      <TokenChips tokens={ex.tokens} />
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[12.5px] text-ink-2">
        <span><span className="num text-ink">{ex.n_chars}</span> characters</span>
        <span><span className="num text-ink">{ex.n_words}</span> whitespace words</span>
        <span><span className="num text-ink">{ex.n_tokens}</span> tokens</span>
        <span>decodes back to the original: {ex.roundtrip_ok ? "yes" : "no"}</span>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-ink-3">
        Top line: decoded text of each token (<span className="font-mono">{"␣"}</span> marks a space). Middle: the raw byte-level BPE piece
        (<span className="font-mono">Ġ</span> encodes a leading space). Bottom: the token id. Special tokens (dashed) such as <span className="font-mono">&lt;|endoftext|&gt;</span> = {tok.special_tokens["<|endoftext|>"]}.
        Calling the tokenizer with special tokens enabled prepends {tok.add_special_tokens_prepends.length === 0 ? "nothing" : tok.add_special_tokens_prepends.join(", ")}.
      </p>
      <div className="mt-4 border-t border-rule pt-3">
        <label className="text-[12px] text-ink-3" htmlFor="tok-own">Try your own sentence</label>
        <input id="tok-own" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a short sentence"
          className="mt-1 block w-full rounded border border-rule-strong bg-paper px-2 py-1.5 text-[13px] text-ink" />
        {draft && (match >= 0 ? (
          <p className="mt-2 text-[12.5px] text-ink-2">This sentence is one of the precomputed examples; it is now selected above. <button type="button" className="underline" onClick={() => setK(match)}>Show it</button></p>
        ) : (
          <div className="mt-2 text-[12.5px] leading-relaxed text-ink-2">
            The real Qwen tokenizer (a 7 MB vocabulary) does not run in this page, and LatentLens does not fake a tokenization. Run it locally:
            <pre className="scroll-x mt-1.5 rounded border border-rule bg-paper-2 p-2 font-mono text-[11.5px] whitespace-pre">{`python scripts/latentlens/build_tokenizer_examples.py --text ${JSON.stringify(draft)}`}</pre>
            <span className="text-ink-3">Your text has {draft.length} characters and {draft.trim().split(/\s+/).filter(Boolean).length} whitespace words; its token count is only known after tokenization.</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function EmbeddingPanel({ tok, arch }: { tok: TokenizerExamples; arch: Architecture }) {
  const e = tok.embedding;
  return (
    <Panel title={`Embedding rows for "${e.text}"`} badge={<Measured>Read from model.embed_tokens.weight</Measured>}>
      <p className="mb-3 text-[13px] leading-relaxed text-ink-2">
        The table <Shape>[{fmtInt(e.shape[0])}, {fmtInt(e.shape[1])}]</Shape> is indexed by token id. Each row is a learned vector of {fmtInt(arch.verified.hidden_size)} numbers;
        below are its summary statistics and its first 8 coordinates (all {fmtInt(arch.verified.hidden_size)} cannot be meaningfully plotted).
      </p>
      <div className="scroll-x">
        <table className="table-lab">
          <thead><tr><th>Token</th><th className="r">id</th><th className="r">dim</th><th className="r">RMS</th><th className="r">L2 norm</th><th className="r">mean</th><th className="r">std</th><th>first coordinates</th></tr></thead>
          <tbody>{e.tokens.map((t) => (
            <tr key={t.id}><td className="font-mono whitespace-pre">{showTok(t.text)}</td><td className="num r">{t.id}</td><td className="num r">{t.dim}</td>
              <td className="num r">{t.rms.toFixed(4)}</td><td className="num r">{t.l2.toFixed(3)}</td><td className="num r">{t.mean.toFixed(5)}</td><td className="num r">{t.std.toFixed(4)}</td>
              <td className="font-mono text-[11px] whitespace-nowrap text-ink-3">{t.first_coords.map((c) => c.toFixed(3)).join("  ")} …</td></tr>
          ))}</tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-ink-3">
        The rows are small (RMS about {e.tokens[0].rms.toFixed(3)}). Block 1&apos;s RMSNorm rescales them before attention reads them, which is one reason normalization matters from the very first layer.
        Cosine similarity between these rows ranges from {Math.min(...e.cosine.flat()).toFixed(2)} to {Math.max(...e.cosine.flatMap((r, i) => r.filter((_, j) => j !== i))).toFixed(2)} (off-diagonal).
      </p>
    </Panel>
  );
}

function ResidualGrowth({ trace }: { trace: TokenTrace }) {
  const T = trace.tokens.length;
  const series = [0, T - 1, Math.max(1, T - 3)].filter((v, i, a) => a.indexOf(v) === i).map((p, k) => ({
    key: `p${p}`, label: p === 0 ? "pos 0 <|endoftext|>" : `pos ${p} ${showTok(trace.tokens[p].text)}`,
    color: k === 0 ? SERIES.ink : k === 1 ? SERIES.a : SERIES.b, dash: k === 0 ? "4 3" : k === 2 ? "1 3" : undefined,
    points: [{ x: 0, y: trace.embedding_rms[p] }, ...trace.layers.map((l) => ({ x: l.layer + 1, y: l.resid_post_rms[p] }))],
  }));
  return (
    <LineChart title="Residual-stream RMS after each block (one forward pass)" series={series} logY xLabel="depth (0 = embeddings, k = after block k)" yLabel="RMS (log scale)"
      caption={<>Measured on Qwen3-8B-Base, {trace.dtype}, sentence &quot;{trace.text}&quot;. Position 0, the document-start token, develops a very large residual vector
        (largest coordinate {trace.layers[trace.layers.length - 1].pos0_max_abs_coord.toFixed(0)} in dimension {trace.layers[trace.layers.length - 1].pos0_argmax_abs_coord} after the last block), a pattern often called a massive activation.</>} />
  );
}

function LayerNavigator({ trace, arch }: { trace: TokenTrace; arch: Architecture }) {
  const [i, setI] = useState(0);
  const l = trace.layers[i];
  const g = arch.norm_gains;
  const last = trace.tokens.length - 1;
  return (
    <div>
      <div role="radiogroup" aria-label="Choose a transformer block" className="flex flex-wrap gap-1">
        {trace.layers.map((x) => (
          <button key={x.layer} role="radio" aria-checked={i === x.layer} onClick={() => setI(x.layer)}
            className={cn("num h-7 w-9 rounded border text-[12px]", i === x.layer ? "border-ink bg-ink text-paper" : "border-rule-strong text-ink-3 hover:text-ink")}>{x.layer + 1}</button>
        ))}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Panel title={`Block ${i + 1} on the last token "${showTok(trace.tokens[last].text)}"`} badge={<Measured />}>
          <table className="table-lab"><tbody>
            <tr><th scope="row">‖residual entering‖</th><td className="num r">{l.last.resid_pre_l2.toFixed(2)}</td></tr>
            <tr><th scope="row">‖attention update‖</th><td className="num r">{l.last.attn_out_l2.toFixed(2)}</td></tr>
            <tr><th scope="row">‖MLP update‖</th><td className="num r">{l.last.mlp_out_l2.toFixed(2)}</td></tr>
            <tr><th scope="row">‖residual leaving‖</th><td className="num r">{l.last.resid_post_l2.toFixed(2)}</td></tr>
            <tr><th scope="row">cosine(entering, leaving)</th><td className="num r">{l.last.cos_pre_post.toFixed(3)}</td></tr>
          </tbody></table>
        </Panel>
        <Panel title={`Block ${i + 1}: learned RMSNorm gains`} badge={<Measured>Stored weights</Measured>}>
          <table className="table-lab">
            <thead><tr><th>gain vector</th><th className="r">dim</th><th className="r">mean</th><th className="r">min</th><th className="r">max</th></tr></thead>
            <tbody>
              {([["input_layernorm", g.input_layernorm[i]], ["post_attention_layernorm", g.post_attention_layernorm[i]], ["q_norm", g.q_norm[i]], ["k_norm", g.k_norm[i]]] as const).map(([n, s]) => (
                <tr key={n}><td className="font-mono text-[12px]">{n}</td><td className="num r">{s.dim}</td><td className="num r">{s.mean.toFixed(3)}</td><td className="num r">{s.min.toFixed(3)}</td><td className="num r">{s.max.toFixed(2)}</td></tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">
        The architecture repeats {trace.n_layers} times; the weights do not. These numbers describe this one block only. LatentLens does not label blocks as &quot;syntax&quot; or
        &quot;reasoning&quot; layers: no experiment here supports such labels.
      </p>
    </div>
  );
}

function OutputPanel({ trace, arch }: { trace: TokenTrace; arch: Architecture }) {
  const top = trace.final.top.slice(0, 10);
  return (
    <Panel title={`Next-token distribution after "${trace.text}"`} badge={<Measured />}>
      <div className="scroll-x">
        <table className="table-lab">
          <thead><tr><th>rank</th><th>token</th><th className="r">logit</th><th className="r">probability</th><th className="w-1/3" aria-hidden /></tr></thead>
          <tbody>{top.map((t, i) => (
            <tr key={t.id}><td className="num">{i + 1}</td><td className="font-mono whitespace-pre">{showTok(t.text)}</td><td className="num r">{t.logit.toFixed(2)}</td><td className="num r">{fmtProb(t.p)}</td>
              <td aria-hidden><div className="h-2 rounded-r-[3px] bg-[var(--viz-1)]" style={{ width: `${(t.p / top[0].p) * 100}%` }} /></td></tr>
          ))}</tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-ink-3">
        Softmax runs over all {fmtInt(trace.final.vocab_rows)} rows of the LM head, including the rows beyond the {fmtInt(arch.verified.tokenizer_size)} tokenizer entries.
        The top 50 tokens hold {(trace.final.top_mass * 100).toFixed(1)}% of the probability; entropy {trace.final.entropy.toFixed(2)} nats. Greedy decoding would choose
        &quot;{showTok(top[0].text)}&quot;.
      </p>
    </Panel>
  );
}

export function FollowOneToken({ arch, tok, trace }: { arch: Architecture; tok: TokenizerExamples; trace: TokenTrace }) {
  const parts = pipelineParts(arch);
  const [sel, setSel] = useState("text");
  const part = parts.find((p) => p.id === sel)!;
  const main = tok.examples[0];
  return (
    <section>
      <SectionHead n={2} kicker="Learn" title="Follow one token through Qwen" id="follow">
        Choose a stage. Each one is explained the same way: intuition, exact mechanism, tensor shapes, why it exists, and a common confusion.
        Panels marked <Measured>Measured on Qwen3-8B-Base</Measured> come from one real forward pass of the sentence &quot;{trace.text}&quot;.
      </SectionHead>
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <ol className="grid content-start gap-1" aria-label="Stages of the forward pass">
          {parts.map((p, i) => (
            <li key={p.id}>
              <button type="button" onClick={() => setSel(p.id)} aria-current={sel === p.id ? "step" : undefined}
                className={cn("flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[13.5px]", sel === p.id ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2")}>
                <span className={cn("num w-5 text-[11px]", sel === p.id ? "text-paper/70" : "text-ink-4")}>{i + 1}</span>{p.title}
              </button>
              {i < parts.length - 1 && <div aria-hidden className="ml-[19px] h-1.5 border-l border-rule-strong" />}
            </li>
          ))}
        </ol>
        <div className="grid min-w-0 gap-5">
          <Panel><FiveIdeas part={part} /></Panel>
          {sel === "text" && <Panel title="The running example"><p className="font-serif text-[22px] text-ink">&quot;{trace.text}&quot;</p></Panel>}
          {(sel === "tokenizer" || sel === "ids") && <TokenizerExplorer tok={tok} />}
          {sel === "ids" && (
            <Panel title="What the model actually receives" badge={<Measured />}>
              <TokenChips tokens={trace.tokens} />
              <p className="mt-2 text-[12px] text-ink-3">Position 0 is the document-start token LatentLens adds; the tokenizer produced {main.n_tokens} tokens for the sentence itself.</p>
            </Panel>
          )}
          {sel === "embedding" && <EmbeddingPanel tok={tok} arch={arch} />}
          {sel === "residual" && <Panel><ResidualGrowth trace={trace} /></Panel>}
          {sel === "blocks" && <Panel title="Layer navigator"><LayerNavigator trace={trace} arch={arch} /></Panel>}
          {sel === "final_norm" && (
            <Panel title="Final RMSNorm gain" badge={<Measured>Stored weights</Measured>}>
              <p className="text-[13.5px] leading-relaxed text-ink-2">
                The learned gain of <span className="font-mono">model.norm</span> has mean {arch.norm_gains.final_norm.mean.toFixed(2)}, range {arch.norm_gains.final_norm.min.toFixed(3)} to {arch.norm_gains.final_norm.max.toFixed(2)}.
                The residual entering it at the last position has RMS {trace.layers[trace.layers.length - 1].resid_post_rms[trace.tokens.length - 1].toFixed(1)}; after normalization every
                position has RMS 1 before the gain is applied.
              </p>
            </Panel>
          )}
          {(sel === "lm_head" || sel === "logits" || sel === "softmax" || sel === "next") && <OutputPanel trace={trace} arch={arch} />}
        </div>
      </div>
    </section>
  );
}
