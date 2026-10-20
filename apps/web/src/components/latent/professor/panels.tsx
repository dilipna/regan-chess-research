"use client";

// Evidence panels for Professor mode. Recorded numbers are read from the artifacts passed in; professor-reported,
// hypothetical and pending material is labelled as such and never mixed with recorded values.

import { cn } from "@/lib/utils";
import { CASE_MEASURES, CHECKLIST, COMPARE_ROWS, FUTURE_EXTENSION, HYPOTHESES, LENS_CAVEAT, QUESTIONS, REGAN_REPORT } from "@/lib/latent/professor";
import { fmtInt, fmtProb, showTok } from "@/lib/latent/toy";
import type { Architecture, Metadata, TokenTrace } from "@/lib/latent/types";

export type TagKind = "recorded" | "regan" | "hypothesis" | "pending";
const TAG_CLS: Record<TagKind, string> = {
  recorded: "border-[var(--role-resid)] text-[var(--role-resid-ink)] bg-[var(--role-resid-soft)]",
  regan: "border-[var(--prov-regan)] text-[var(--prov-regan)] bg-[var(--tint-regan)]",
  hypothesis: "border-dashed border-ink-3 text-ink-2 bg-paper",
  pending: "border-ink-2 bg-ink text-paper",
};
export function Tag({ kind, children }: { kind: TagKind; children: React.ReactNode }) {
  return <span className={cn("inline-flex w-fit max-w-full rounded border px-2 py-0.5 text-[11.5px] font-semibold tracking-wide uppercase", TAG_CLS[kind])}>{children}</span>;
}

function Box({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("grid min-w-0 gap-3 rounded-xl border border-rule bg-paper p-4 sm:p-5", className)}>{children}</section>;
}
const H = ({ children }: { children: React.ReactNode }) => <h3 className="text-[15px] font-semibold text-ink">{children}</h3>;
const Tok = ({ s }: { s: string }) => <code className="rounded bg-paper-2 px-1 font-mono text-[13px] whitespace-pre text-ink">{showTok(s)}</code>;

export const BLOCK_TREE = `residual state x                         [T, 4096]
 │
 ├─► RMSNorm  (input_layernorm, over 4096)
 │     └─► Q, K, V projections           Q 32×128 · K 8×128 · V 8×128
 │           ├─► Q/K RMSNorm  (q_norm, k_norm, over each 128-dim head)
 │           ├─► RoPE on Q and K
 │           ├─► causal grouped-query attention  (4 query heads per KV head)
 │           └─► attention output projection  o_proj → 4096
 ├─► + residual addition
 │     │
 │     ├─► RMSNorm  (post_attention_layernorm, over 4096)
 │     │     └─► SwiGLU MLP   4096 → 12288 → 4096
 │     └─► + second residual addition
 │
 └─► next block`;

export function BlockTree() {
  return <pre aria-label="One Qwen3 block" className="scroll-x rounded-lg border border-rule bg-paper-2 p-3 font-mono text-[12px] leading-[1.55] whitespace-pre text-ink sm:text-[13px]">{BLOCK_TREE}</pre>;
}

/** Selected depths for a compact table; always includes 0 and the output depth. */
const pick = (n: number) => [0, 1, 2, 6, 12, 18, 24, 27, 30, 33, 34, 35, n].filter((d, i, a) => d <= n && a.indexOf(d) === i);

export function LatentPanel({ trace }: { trace?: TokenTrace }) {
  if (!trace) return <p className="text-ink-3">Trace artifact not available.</p>;
  const n = trace.n_layers, last = trace.tokens.length - 1;
  const rms = (d: number) => (d === 0 ? trace.embedding_rms[last] : trace.layers[d - 1].resid_post_rms[last]);
  const ratio = rms(n) / rms(0);
  return (
    <Box>
      <Tag kind="recorded">Recorded Qwen3-8B-Base measurement</Tag>
      <p className="text-[15px] text-ink-2">
        For the recorded input (B = 1, T = {trace.tokens.length} including the document-start token), each capture point is a tensor of shape{" "}
        <code className="font-mono text-ink">[1, {trace.tokens.length}, {fmtInt(trace.hidden_size)}]</code>. Below: the RMS of the last token&apos;s residual vector at selected depths.
      </p>
      <div className="scroll-x">
        <table className="table-lab">
          <thead><tr><th>layer</th>{pick(n).map((d) => <th key={d} className="r">{d}</th>)}</tr></thead>
          <tbody><tr><td>residual RMS</td>{pick(n).map((d) => <td key={d} className="num r">{rms(d) < 1 ? rms(d).toFixed(3) : rms(d).toFixed(2)}</td>)}</tr></tbody>
        </table>
      </div>
      <p className="text-[14px] text-ink-2">
        The measured residual-vector RMS of the last token increased by about {fmtInt(Math.round(ratio))}× between layer 0 and layer {n} for this recorded example. Layer 0 is the embedding
        output; layer k is the residual state after block k. Attention and the MLP read an RMS-normalized copy, so this growth is not what they see.
      </p>
    </Box>
  );
}

export function NormCompare({ arch, trace }: { arch?: Architecture; trace?: TokenTrace }) {
  const v = arch?.verified;
  const q = trace?.qk_norm?.["17"]?.q_norm.shape_per_token, k = trace?.qk_norm?.["17"]?.k_norm.shape_per_token;
  if (!v) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Box className="content-start border-[var(--role-resid)]">
        <Tag kind="recorded">Verified from config and module source</Tag>
        <H>Block RMSNorm</H>
        <p className="text-[14.5px] text-ink-2">Normalizes the whole {fmtInt(v.hidden_size)}-dimensional residual vector of one token.</p>
        <ul className="list-disc pl-5 text-[14px] text-ink-2">
          <li><code className="font-mono">input_layernorm</code>: before attention</li>
          <li><code className="font-mono">post_attention_layernorm</code>: before the MLP</li>
          <li><code className="font-mono">model.norm</code>: once, after block {v.num_hidden_layers}, before the LM head</li>
        </ul>
      </Box>
      <Box className="content-start border-[var(--role-attn)]">
        <Tag kind="recorded">Verified from config and module source</Tag>
        <H>Q/K RMSNorm</H>
        <p className="text-[14.5px] text-ink-2">Normalizes each {v.head_dim}-dimensional query or key head separately, after the projection and before RoPE. V is not normalized.</p>
        <ul className="list-disc pl-5 text-[14px] text-ink-2">
          <li><code className="font-mono">q_norm</code>: {v.num_attention_heads} heads × {v.head_dim}{q && ` (recorded shape per token ${q.join(" × ")})`}</li>
          <li><code className="font-mono">k_norm</code>: {v.num_key_value_heads} heads × {v.head_dim}{k && ` (recorded shape per token ${k.join(" × ")})`}</li>
          <li>same ε = {v.rms_norm_eps.toExponential(0)}, separate learned gains</li>
        </ul>
      </Box>
    </div>
  );
}

const TRACE_FILE = "apps/web/public/data/latent/qwen3-8b/token_trace.json";

export function TracePanel({ trace, meta }: { trace?: TokenTrace; meta?: Metadata & { tokenizer_id?: string; tokenizer_revision?: string } }) {
  if (!trace) return <Box><Tag kind="pending">Trace artifact not found</Tag></Box>;
  const n = trace.n_layers;
  const top = trace.final.top[0];
  const lens = trace.diagnostic_lens_last_position;
  const pv = trace.provenance;
  const tokenizer = meta?.tokenizer_id ? `${meta.tokenizer_id} @ ${meta.tokenizer_revision?.slice(0, 8) ?? "revision not recorded"} (from metadata.json)` : "not recorded";
  const hw = pv.hardware.gpu ? `${pv.hardware.gpu}${pv.hardware.gpu_memory_gib ? `, ${pv.hardware.gpu_memory_gib} GiB` : ""}` : "not recorded";
  const prov: [string, React.ReactNode][] = [
    ["model ID", trace.model_id],
    ["model revision", <code key="r" className="font-mono text-[12.5px] break-all">{trace.revision}</code>],
    ["input", `"${trace.text}" (document-start token ${trace.tokens[0].piece} prepended)`],
    ["tokenizer", tokenizer],
    ["dtype", `${trace.dtype}, ${trace.loader === "stream" ? "one block streamed to the GPU at a time" : trace.loader} loader`],
    ["hardware", hw],
    ["recorded", pv.timestamp ?? "not recorded"],
    ["code commit", pv.git_commit ? <span key="c"><code className="font-mono text-[12.5px] break-all">{pv.git_commit}</code>{pv.git_commit.endsWith("-dirty") && " (uncommitted changes were present when recorded)"}</span> : "not recorded"],
    ["script", pv.script ?? "not recorded"],
    ["artifact", <code key="a" className="font-mono text-[12.5px] break-all">{TRACE_FILE}</code>],
  ];
  return (
    <div className="grid gap-4">
      <Box>
        <div className="flex flex-wrap gap-2"><Tag kind="recorded">Real Qwen trace</Tag><span className="text-[13px] text-ink-3">One recorded example, not a population-level result.</span></div>
        <div className="flex flex-wrap gap-1.5" aria-label="Tokens">
          {trace.tokens.map((t) => <span key={t.pos} className="rounded border border-rule-strong px-2 py-0.5 font-mono text-[12.5px] text-ink">{showTok(t.text)}<span className="ml-1.5 text-ink-4">{t.id}</span></span>)}
        </div>
        <H>Model output at each position (layer {n}, the actual prediction)</H>
        <div className="scroll-x">
          <table className="table-lab">
            <thead><tr><th className="hidden sm:table-cell">context</th><th>true next token</th><th className="r">true-token rank</th><th className="r">p(true)</th><th>model top-1</th></tr></thead>
            <tbody>{trace.positions.map((p) => (
              <tr key={p.context}><td className="hidden font-mono text-[12.5px] sm:table-cell">{p.context ? showTok(p.context) : "(start)"}</td><td><Tok s={p.true_next} /></td>
                <td className="num r">{fmtInt(p.rank)}</td><td className="num r">{fmtProb(p.p_true)}</td><td><Tok s={p.top[0].text} /> <span className="num text-ink-3">{fmtProb(p.top[0].p)}</span></td></tr>
            ))}</tbody>
          </table>
        </div>
      </Box>
      <Box>
        <H>Last position (after <Tok s={trace.tokens[trace.tokens.length - 1].text} />) through depth</H>
        <p className="text-[14px] text-ink-2">
          The input ends here, so there is no reference next token. This table follows <Tok s={top.text} />, the token the model&apos;s actual output ranks first (p = {fmtProb(top.p)}),
          and shows where earlier depths rank it.
        </p>
        <div className="scroll-x">
          <table className="table-lab">
            <thead><tr><th>layer</th><th className="r">diagnostic rank of <span className="font-mono">{showTok(top.text)}</span></th><th>top projected token (p)</th></tr></thead>
            <tbody>{pick(n).map((d) => { const r = lens[d]; return (
              <tr key={d} className={cn(d === n && "bg-llm-soft/60")}><td className="num">{d}{d === 0 ? " · embedding" : d === n ? " · model output" : ""}</td>
                <td className="num r">{fmtInt(r.final_top_rank)}</td><td><Tok s={r.top[0].text} /> <span className="num text-ink-3">{fmtProb(r.top[0].p)}</span></td></tr>
            ); })}</tbody>
          </table>
        </div>
        <p role="note" className="rounded-lg border border-[var(--bad)] bg-[var(--bad-soft)] px-3 py-2 text-[14px] text-ink">{LENS_CAVEAT}</p>
        <p className="text-[13px] text-ink-3">Projection used: final RMSNorm (model.norm) and LM head applied to the residual state after each block. Vocabulary of {fmtInt(trace.final.vocab_rows)} rows.</p>
      </Box>
      <Box>
        <H>Provenance</H>
        <dl className="grid gap-x-4 gap-y-1.5 text-[13.5px] sm:grid-cols-[9rem_minmax(0,1fr)]">
          {prov.map(([k, v]) => <div key={k} className="contents"><dt className="text-ink-3">{k}</dt><dd className="min-w-0 text-ink-2">{v}</dd></div>)}
        </dl>
      </Box>
    </div>
  );
}

export function ReganPanel() {
  const r = REGAN_REPORT;
  return (
    <div className="grid gap-4">
      <Box className="border-[var(--prov-regan)] bg-[var(--tint-regan)]">
        <div className="flex flex-wrap items-center gap-2"><Tag kind="regan">Professor-reported observation</Tag><span className="text-[13px] text-ink-3">From Professor Regan&apos;s email. Not a LatentLens experiment result.</span></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[r.older, r.larger].map((m) => (
            <div key={m.label} className="rounded-lg border border-rule bg-paper p-3">
              <div className="text-[13px] text-ink-3">{m.label} · {r.text}</div>
              <div className="num text-[30px] font-semibold text-ink">{m.recall}</div>
              <div className="text-[12.5px] text-ink-3">recall · exact checkpoint to be confirmed</div>
            </div>
          ))}
        </div>
        <H>Reported differences</H>
        <ul className="list-disc pl-5 text-[14.5px] text-ink-2">{r.differences.map((d) => <li key={d}>{d}</li>)}</ul>
        <H>A continuation where the two runs diverge</H>
        <div className="grid gap-1 font-mono text-[13.5px] text-ink">
          <div><span className="text-ink-3">{r.divergence.context}</span></div>
          <div><span className="inline-block w-20 text-ink-3">older:</span>{r.divergence.older}</div>
          <div><span className="inline-block w-20 text-ink-3">larger:</span>{r.divergence.larger}</div>
        </div>
        <p className="text-[13.5px] text-ink-3">{r.hypothesis}</p>
      </Box>
      <Box>
        <p className="font-serif text-[22px] leading-snug font-semibold text-ink">Final recall is almost identical.<br />But are the internal trajectories identical?</p>
        <div className="scroll-x">
          <table className="table-lab">
            <thead><tr><th>measured per target token</th><th>Model A (older ~14B)</th><th>Model B (larger ~27B)</th></tr></thead>
            <tbody>{COMPARE_ROWS.map((row) => <tr key={row}><td>{row}</td><td className="text-ink-3">not yet measured</td><td className="text-ink-3">not yet measured</td></tr>)}</tbody>
          </table>
        </div>
        <p className="text-[13.5px] text-ink-3">The models have different numbers of blocks, so depth is compared as relative depth (block ÷ number of blocks).</p>
      </Box>
    </div>
  );
}

export function HypothesesPanel() {
  return (
    <div className="grid gap-4">
      <Tag kind="hypothesis">Hypotheses, not results</Tag>
      <div className="grid gap-3 md:grid-cols-3">
        {HYPOTHESES.map((h) => (
          <Box key={h.id} className={cn("content-start", "latentlens" in h && "border-[var(--role-norm)] bg-[var(--role-norm-soft)]")}>
            <div className="text-[13px] font-semibold text-ink-3">{h.id}</div>
            <H>{h.title}</H>
            <p className="text-[14.5px] text-ink-2">{h.text}</p>
            {"latentlens" in h && <p className="text-[13px] font-semibold text-[var(--role-norm-ink)]">LatentLens can investigate this one directly.</p>}
          </Box>
        ))}
      </div>
      <Box>
        <H>Tokenization is a first-class question</H>
        <p className="text-[14.5px] text-ink-2">The two runs reportedly produced different token counts, so raw token-level recall is not automatically an aligned comparison. I need to learn:</p>
        <ul className="list-disc pl-5 text-[14.5px] text-ink-2">
          <li>the exact tokenizer used for each model</li>
          <li>whether recall is computed against each model&apos;s own tokens</li>
          <li>how differing token boundaries are handled</li>
        </ul>
        <p className="text-[14px] text-ink-3">Possible comparison levels: token, word or span, character. No alignment method has been implemented; the choice should follow your definition of recall.</p>
      </Box>
    </div>
  );
}

export function ExperimentPanel({ recall }: { recall: React.ReactNode }) {
  return (
    <div className="grid gap-4">
      <Box>
        <H>For each target token, in each model</H>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><div className="text-[13px] text-ink-3">at the output</div><p className="text-[14.5px] text-ink-2">final correctness, true-token rank, true-token probability, top-token probability, margin, entropy</p></div>
          <div><div className="text-[13px] text-ink-3">at every layer (diagnostic projection)</div><p className="text-[14.5px] text-ink-2">true-token rank, top projected token, margin, activation RMS</p></div>
        </div>
        <p className="text-[14px] text-ink-2">Then compare the two models by relative depth, including the cases where only one of them is correct.</p>
      </Box>
      <Box>
        <Tag kind="recorded">The measurement already runs on Qwen3-8B-Base</Tag>
        {recall}
      </Box>
      <Box>
        <div className="flex flex-wrap items-center gap-2"><Tag kind="pending">Pending professor checkpoint + model access</Tag><span className="text-[13px] text-ink-3">Planned analysis. Not run.</span></div>
        <H>Case study: &ldquo;we will&rdquo; vs &ldquo;we shall&rdquo;</H>
        <p className="text-[14.5px] text-ink-2">Expected continuation candidate <Tok s=" will" />, competing continuation <Tok s=" shall" /> (to be confirmed against your input file and each model&apos;s tokenization).</p>
        <div className="scroll-x">
          <table className="table-lab">
            <thead><tr>{CASE_MEASURES.map((m) => <th key={m}>{m}</th>)}</tr></thead>
            <tbody><tr>{CASE_MEASURES.map((m) => <td key={m} className="text-ink-3">{m === "layer" ? "0 … L" : "pending"}</td>)}</tr></tbody>
          </table>
        </div>
        <p className="text-[15px] font-semibold text-ink">At what depth do the two candidate continuations begin to separate?</p>
        <p className="text-[13px] text-ink-3">The current recall artifact records the true token&apos;s rank at every depth; this case also needs a second, named token&apos;s rank and score at every depth.</p>
      </Box>
    </div>
  );
}

export function ChecklistPanel() {
  return (
    <div className="grid gap-4">
      <details open className="rounded-xl border border-rule bg-paper p-4 sm:p-5">
        <summary className="cursor-pointer text-[15px] font-semibold text-ink">Research checklist for this meeting</summary>
        <ol className="mt-3 grid list-decimal gap-1 pl-6 text-[14.5px] text-ink-2 sm:grid-cols-2 sm:gap-x-8">{CHECKLIST.map((c) => <li key={c}>{c}</li>)}</ol>
      </details>
      <details className="rounded-xl border border-dashed border-rule-strong bg-paper p-4 sm:p-5">
        <summary className="cursor-pointer text-[15px] font-semibold text-ink">Questions for Professor Regan (presenter notes)</summary>
        <ol className="mt-3 grid list-decimal gap-2 pl-6 text-[14.5px] text-ink-2">{QUESTIONS.map((q) => <li key={q}>{q}</li>)}</ol>
      </details>
      <section className="grid gap-1 rounded-xl border border-rule bg-paper-2 p-4 text-[14px] text-ink-3">
        <div className="text-[12px] font-semibold tracking-wide uppercase">Future extension</div>
        <p>{FUTURE_EXTENSION} That study is pending: the planned dataset requires approved access, and no human-vs-AI result exists yet.</p>
      </section>
    </div>
  );
}
