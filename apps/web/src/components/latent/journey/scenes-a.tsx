"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { EXAMPLE, rms, toyForward } from "@/lib/latent/toy-model";
import { AnalogyLimit, Check, Prov, RoleTag, Segment, StepControls, TensorCard, VectorBars, showTok } from "../kit";
import { SceneFrame, SceneText, byLevel, exampleTokens, type SceneProps } from "./common";

// ===================================================================================== Scene 1: tokens
export function SceneTokens({ st, set, data }: SceneProps) {
  const [ex, setEx] = useState(0);
  const [local, setLocal] = useState(0);
  const examples = data.tok.examples.filter((e) => !e.text.includes("<|endoftext|>"));
  const e = examples[ex];
  const split = st.step >= 1;
  const isMain = ex === 0;
  const selected = isMain ? Math.max(0, st.tok - 1) : local;
  const t = e.tokens[Math.min(selected, e.tokens.length - 1)];
  const lvl = st.level;
  return (
    <SceneFrame
      visual={
        <div className="ll-panel rounded-2xl border border-rule bg-paper p-5 sm:p-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Prov kind="recorded" detail="real Qwen tokenizer" />
            <label className="flex items-center gap-2 text-[14px] text-ink-2">Example
              <select value={ex} onChange={(ev) => { setEx(Number(ev.target.value)); setLocal(0); }} className="max-w-[260px] rounded-lg border-2 border-rule-strong bg-paper px-2 py-1 text-[14px]">
                {examples.map((x, i) => <option key={i} value={i}>{x.text.length > 34 ? x.text.slice(0, 33) + "…" : x.text}</option>)}
              </select>
            </label>
          </div>
          <div className="min-h-[150px]">
            {!split ? (
              <p className="font-serif text-[30px] leading-snug text-ink sm:text-[38px]">{e.text}</p>
            ) : (
              <div className="ll-pop flex flex-wrap gap-2.5">
                {e.tokens.map((tk, i) => (
                  <button key={i} type="button" onClick={() => (isMain ? set({ tok: i + 1 }) : setLocal(i))} aria-pressed={i === selected}
                    aria-label={`token ${i}: ${tk.text}`}
                    className={cn("ll-anim rounded-xl border-2 px-3.5 py-2 font-mono text-[22px] whitespace-pre sm:text-[26px]",
                      i === selected ? "-translate-y-1 border-ink bg-ink text-paper" : "border-rule-strong bg-paper text-ink hover:border-ink-3")}>
                    {showTok(tk.text)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => set({ step: split ? 0 : 1 })} className="rounded-lg bg-ink px-4 py-2 text-[15px] font-medium text-paper">
              {split ? "Join back into text" : "Split into tokens"}
            </button>
            <span className="text-[14px] text-ink-3">{e.n_chars} characters · {e.n_words} words · <strong className="text-ink">{e.n_tokens} tokens</strong></span>
          </div>
          {split && (
            <div className="ll-pop mt-5 grid gap-3 rounded-xl bg-paper-2/60 p-4 sm:grid-cols-3">
              <div><div className="text-[12px] font-semibold tracking-wide text-ink-3 uppercase">Selected piece</div><div className="font-mono text-[22px] whitespace-pre text-ink">{showTok(t.text)}</div></div>
              <div><div className="text-[12px] font-semibold tracking-wide text-ink-3 uppercase">Token id</div><div className="num text-[22px] text-ink">{t.id}</div></div>
              <div><div className="text-[12px] font-semibold tracking-wide text-ink-3 uppercase">Position</div>
                <div className="num text-[22px] text-ink">{selected}{isMain && <span className="ml-2 text-[13px] text-ink-3">(model input: {selected + 1})</span>}</div></div>
              {lvl !== "story" && <div className="text-[13px] text-ink-3 sm:col-span-3">Raw byte-level piece: <span className="font-mono">{t.piece}</span> (Ġ marks a leading space). Characters {t.start} to {t.end} of the text.</div>}
            </div>
          )}
          <p className="mt-4 text-[12.5px] text-ink-3">These splits were produced by the real Qwen3 tokenizer and saved. Typing new text here is not supported because the tokenizer does not run in this page; run <span className="font-mono">build_tokenizer_examples.py --text &quot;…&quot;</span> to add an example.</p>
        </div>
      }
      side={<>
        <SceneText
          tryThis={split ? "Click a piece to see its id and position. Then pick the example “unbelievably”." : "Press “Split into tokens”."}
          consequence={split ? <>{`"${e.text.length > 40 ? e.text.slice(0, 40) + "…" : e.text}"`} became <strong>{e.n_tokens} pieces</strong>. The selected piece <span className="font-mono whitespace-pre">{showTok(t.text)}</span> has id {t.id}.</> : "Nothing yet: the model cannot use the text in this form."}
          explain={byLevel(lvl, {
            story: <>The model never reads letters. A fixed list of word pieces is used to cut text into <strong>tokens</strong>. Common words are one piece; rarer words are cut into several, and a space usually belongs to the next piece.</>,
            mechanics: <>Byte-level byte-pair encoding maps the string to a list of integer ids, shape <span className="font-mono">[T]</span> (or <span className="font-mono">[B, T]</span> for a batch). The id is only an index; it carries no meaning by itself.</>,
            research: <>Qwen3&apos;s tokenizer has {data.tok.tokenizer_size.toLocaleString("en-US")} entries; the embedding table has {data.arch.verified.vocab_size.toLocaleString("en-US")} rows (the rest are padding rows). The tokenizer adds no beginning-of-sequence token, so LatentLens puts <span className="font-mono">&lt;|endoftext|&gt;</span> (id {data.arch.verified.endoftext_id}) at position 0 of every document.</>,
          })}
        />
        {lvl === "story" && <AnalogyLimit analogy="Like cutting a sentence into pieces from a fixed box of puzzle pieces." limit="The pieces come from how often character sequences appeared in training text, not from grammar or meaning. A piece can be half a word, a space plus a word, or punctuation." />}
        <Check id="tokens-unbelievably" prompt="How many tokens does Qwen use for the word “unbelievably”?" options={[
          { label: "1 (it is one word)", feedback: "Words and tokens are different units. Rare or long words are split into several pieces. Pick the example “unbelievably” to see it." },
          { label: "3", correct: true, feedback: "The real tokenizer gives “un”, “belie”, “vably”. Common words are single pieces; rarer ones are split." },
          { label: "12 (one per letter)", feedback: "Letters are only used as a last resort for unusual strings. Frequent letter sequences are merged into larger pieces." },
        ]} />
      </>}
    />
  );
}

// ===================================================================================== Scene 2: vectors
function EmbeddingTable({ selectedId, rows, label }: { selectedId: number; rows: { id: number; name: string }[]; label: string }) {
  const H = 34, W = 430, sel = rows.findIndex((r) => r.id === selectedId);
  return (
    <svg viewBox={`0 0 ${W} ${rows.length * H + 40}`} className="w-full max-w-[460px]" role="img" aria-label={`${label}. Token id ${selectedId} selects row ${selectedId}.`}>
      <text x="0" y="14" fontSize="13" fill="var(--ink-3)">id</text>
      <text x="120" y="14" fontSize="13" fill="var(--ink-3)">row of learned numbers (fixed after training)</text>
      {rows.map((r, i) => {
        const y = 24 + i * H, on = i === sel;
        return (
          <g key={r.id} className="role-resid">
            <text x="0" y={y + 21} fontSize="13" className="font-mono" fill={on ? "var(--ink)" : "var(--ink-3)"} fontWeight={on ? 700 : 400}>{r.id}</text>
            <text x="64" y={y + 21} fontSize="12" className="font-mono" fill="var(--ink-4)">{r.name}</text>
            {Array.from({ length: 8 }, (_, j) => (
              <rect key={j} className="ll-anim" x={120 + j * 36} y={y + 5} width={30} height={H - 10} rx="3"
                fill={on ? "var(--role)" : "var(--paper-3)"} opacity={on ? 0.35 + ((j * 37 + r.id) % 6) / 10 : 1} />
            ))}
            {on && <rect className="ll-anim" x="114" y={y + 1} width={302} height={H - 2} rx="6" fill="none" stroke="var(--ink)" strokeWidth="2" />}
          </g>
        );
      })}
    </svg>
  );
}

export function SceneVectors({ st, data, toy }: SceneProps) {
  const [compare, setCompare] = useState(false);
  const t = exampleTokens[st.tok];
  const lvl = st.level;
  const realRow = data.tok.embedding.tokens.find((r) => r.id === t.id);
  const rows = exampleTokens.slice().sort((a, b) => a.id - b.id).map((x) => ({ id: x.id, name: x.prefix ? "⟨start⟩" : showTok(x.text) }));
  const v = toy.embed[st.tok];
  return (
    <SceneFrame
      visual={
        <div className="ll-panel grid gap-6 rounded-2xl border border-rule bg-paper p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2"><RoleTag role="resid">embedding lookup</RoleTag></div>
            <Prov kind="toy" detail="8 numbers per row; Qwen uses 4,096" />
          </div>
          <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="mb-2 text-[15px] text-ink-2">Token <span className="font-mono whitespace-pre text-ink">{t.prefix ? "⟨start⟩" : showTok(t.text)}</span> has id <strong className="num">{t.id}</strong>. The id points at one row.</p>
              <EmbeddingTable selectedId={t.id} rows={rows} label="Toy embedding table (only the rows used by this sentence are drawn)" />
              <p className="mt-1 text-[12.5px] text-ink-3">Only the 6 rows used by this sentence are drawn. Qwen&apos;s table has {data.arch.verified.vocab_size.toLocaleString("en-US")} rows.</p>
            </div>
            <div className="grid gap-3">
              <div className="text-[13px] font-medium text-ink-2">Values for this input: the selected row, copied out</div>
              <VectorBars values={v} label={`vector for ${t.prefix ? "⟨start⟩" : showTok(t.text)}`} compare={compare ? toy.embed[st.tok === 1 ? 4 : 1] : undefined}
                compareLabel={st.tok === 1 ? "the row for “␣the” (position 4)" : "the row for “The” (position 1)"} />
              <label className="flex items-center gap-2 text-[14px] text-ink-2"><input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="h-4 w-4" />Compare with {st.tok === 1 ? "“␣the”" : "“The”"}</label>
            </div>
          </div>
          {lvl === "research" && (
            realRow ? (
              <TensorCard title={`Real embedding row for ${showTok(realRow.text)}`} kind="recorded" captured="model.embed_tokens.weight, read from the stored checkpoint (learned weights, bfloat16)"
                shape="[151,936, 4,096] table; one row [4,096]" shown="first 8 of 4,096 numbers">
                <VectorBars values={realRow.first_coords} total={realRow.dim} label="first 8 numbers" />
                <p className="mt-2 text-[13px] text-ink-3">Row statistics over all {realRow.dim.toLocaleString("en-US")} numbers: RMS {realRow.rms.toFixed(4)}, L2 norm {realRow.l2.toFixed(3)}, mean {realRow.mean.toFixed(5)}.</p>
              </TensorCard>
            ) : <p className="text-[13.5px] text-ink-3">The real embedding row was recorded for the five sentence tokens; choose one of them (not ⟨start⟩).</p>
          )}
        </div>
      }
      side={<>
        <SceneText
          tryThis="Choose a different token in the strip above and watch the pointer move to its row. Tick “Compare” to see a second row."
          consequence={<>Row {t.id} was copied out. Its 8 toy numbers have average size (RMS) {rms(v).toFixed(2)}.{compare && " The dashed outline is a different token’s row: different numbers, because it is a different id."}</>}
          explain={byLevel(lvl, {
            story: <>Each token id looks up its own row in a big table of numbers. That row is the model&apos;s <strong>starting description</strong> of the token. The table was learned in training and does not change while the model is used.</>,
            mechanics: <>Embedding is row selection: <span className="font-mono">x_t = E[id_t]</span>, turning <span className="font-mono">[B, T]</span> ids into <span className="font-mono">[B, T, d]</span> vectors. The table E is a learned weight; the selected rows are values for this input.</>,
            research: <>Qwen3-8B-Base: E has shape [{data.arch.verified.vocab_size.toLocaleString("en-US")}, {data.arch.verified.hidden_size.toLocaleString("en-US")}] ({data.arch.parameters.embedding.toLocaleString("en-US")} parameters), separate from the output head (tie_word_embeddings = {String(data.arch.verified.tie_word_embeddings)}). Real rows are small (RMS around 0.027); block 1&apos;s RMSNorm rescales them.</>,
          })}
        />
        {lvl === "story" && <AnalogyLimit analogy="Like a library card catalogue: the id says which card to pull, and the card is full of numbers." limit="No single number on the card means “noun” or “animal”. Meaning is spread across many numbers and only makes sense together with the rest of the model." />}
        <Check id="vectors-the" prompt="Do “The” (position 1) and “␣the” (position 4) start from the same row?" options={[
          { label: "Yes, it is the same word", feedback: "They are different tokens: capital letter and a leading space give different ids (785 and 279), so different rows." },
          { label: "No, they are different tokens", correct: true, feedback: "Different ids select different rows. Two copies of exactly the same token would start from the same row; context changes them later." },
        ]} />
      </>}
    />
  );
}

// ===================================================================================== Scene 3: one block, in order
export const BLOCK_STEPS = ["Input: the residual stream", "RMSNorm makes a rescaled copy", "Attention computes an update", "Add update #1", "RMSNorm makes a second copy", "MLP computes an update", "Add update #2"];
const STEP_ROLE = ["resid", "norm", "attn", "resid", "norm", "mlp", "resid"] as const;

export function BlockDiagram({ step }: { step: number }) {
  const W = 760, y0 = 150;
  const box = (x: number, label: string, role: string, active: boolean, icon: string) => (
    <g className={`role-${role}`} aria-hidden>
      <rect className="ll-anim" x={x} y={40} width={118} height={56} rx="10" fill={active ? "var(--role)" : "var(--role-soft)"} stroke="var(--role)" strokeWidth={active ? 3 : 1.5} />
      <text x={x + 59} y={64} textAnchor="middle" fontSize="15" fontWeight={600} fill={active ? "#fff" : "var(--role-ink)"}>{icon} {label}</text>
      <text x={x + 59} y={84} textAnchor="middle" fontSize="11.5" fill={active ? "#fff" : "var(--role-ink)"}>{role === "norm" ? "normalization" : role === "attn" ? "mixes positions" : "per position"}</text>
    </g>
  );
  const plus = (x: number, active: boolean) => (
    <g aria-hidden><circle className="ll-anim" cx={x} cy={y0} r="17" fill={active ? "var(--ink)" : "var(--paper)"} stroke="var(--ink)" strokeWidth="2.5" />
      <text x={x} y={y0 + 6} textAnchor="middle" fontSize="20" fontWeight={700} fill={active ? "var(--paper)" : "var(--ink)"}>+</text></g>
  );
  return (
    <svg viewBox={`0 0 ${W} 200`} className="w-full" role="img"
      aria-label={`One transformer block. Current step ${step + 1}: ${BLOCK_STEPS[step]}. The residual stream runs left to right; two branches (normalization then attention, normalization then MLP) compute updates that are added back at two plus signs.`}>
      <g className="role-resid">
        <line x1="10" x2={W - 10} y1={y0} y2={y0} stroke="var(--role)" strokeWidth={step === 0 || step === 3 || step === 6 ? 7 : 4} className="ll-anim" />
        <text x="12" y={y0 + 34} fontSize="13" fill="var(--role-ink)" fontWeight={600}>═ residual stream (never overwritten, only added to)</text>
      </g>
      {/* branch 1 */}
      <path d={`M60 ${y0} V68 H80`} fill="none" stroke="var(--ink-4)" strokeWidth="2" />
      {box(80, "RMSNorm", "norm", step === 1, "⇕")}
      <line x1="198" x2="222" y1="68" y2="68" stroke="var(--ink-4)" strokeWidth="2" />
      {box(222, "Attention", "attn", step === 2, "⇄")}
      <path d={`M340 68 H370 V${y0 - 17}`} fill="none" stroke="var(--ink-4)" strokeWidth="2" markerEnd="url(#arr)" />
      {plus(370, step === 3)}
      {/* branch 2 */}
      <path d={`M410 ${y0} V68 H430`} fill="none" stroke="var(--ink-4)" strokeWidth="2" />
      {box(430, "RMSNorm", "norm", step === 4, "⇕")}
      <line x1="548" x2="572" y1="68" y2="68" stroke="var(--ink-4)" strokeWidth="2" />
      {box(572, "MLP", "mlp", step === 5, "◆")}
      <path d={`M690 68 H720 V${y0 - 17}`} fill="none" stroke="var(--ink-4)" strokeWidth="2" />
      {plus(720, step === 6)}
      <defs><marker id="arr" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8z" fill="var(--ink-4)" /></marker></defs>
    </svg>
  );
}

export function SceneBlock({ st, set, data, toy }: SceneProps) {
  const [knock, setKnock] = useState<"none" | "attention" | "mlp">("none");
  const f = knock === "none" ? toy : toyForward(EXAMPLE.tokens.map((t) => t.id), { attention: knock === "attention", mlp: knock === "mlp" });
  const t = st.tok, step = Math.min(st.step, 6), lvl = st.level;
  const name = exampleTokens[t].prefix ? "⟨start⟩" : showTok(exampleTokens[t].text);
  const triple: [string, number[], string, number[], string, number[]] | null =
    step === 3 ? ["before (x)", f.embed[t], "attention update", f.attnUpdate[t], "after (x′ = x + update)", f.mid[t]]
      : step === 6 ? ["before (x′)", f.mid[t], "MLP update", f.mlp[t].down, "after (x″ = x′ + update)", f.out[t]] : null;
  const single: [string, number[], number[] | undefined] =
    step === 0 ? ["residual stream x entering the block", f.embed[t], undefined]
      : step === 1 ? ["RMSNorm copy of x (x itself is unchanged)", f.norm1[t].out, f.embed[t]]
        : step === 2 ? ["attention update (computed from the copy)", f.attnUpdate[t], undefined]
          : step === 4 ? ["RMSNorm copy of x′", f.norm2[t].out, f.mid[t]]
            : ["MLP update (computed from the second copy)", f.mlp[t].down, undefined];
  const L = data.trace.layers[st.layer];
  const role = STEP_ROLE[step];
  const diff = Math.max(...f.mid[t].map((v, i) => Math.abs(v - f.embed[t][i])));
  return (
    <SceneFrame
      visual={
        <div className="ll-panel grid gap-5 rounded-2xl border border-rule bg-paper p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <RoleTag role={role === "resid" ? "resid" : role}>{BLOCK_STEPS[step]}</RoleTag>
            <Prov kind="toy" detail="one toy block, untrained weights" />
          </div>
          <BlockDiagram step={step} />
          <StepControls step={step} max={6} onStep={(s) => set({ step: s })} labels={BLOCK_STEPS} onReset={() => { set({ step: 0 }); setKnock("none"); }} />
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[14px] text-ink-2">Switch a branch off:</span>
            <Segment label="Switch a branch off" value={knock} onChange={setKnock}
              options={[{ value: "none", label: "none" }, { value: "attention", label: "attention off" }, { value: "mlp", label: "MLP off" }]} />
          </div>
          <div className="rounded-xl bg-paper-2/50 p-4">
            {triple ? (
              <div className="grid gap-4">
                <VectorBars values={triple[1]} label={triple[0]} role="resid" height={100} />
                <VectorBars values={triple[3]} label={triple[2]} role={step === 3 ? "attn" : "mlp"} height={100} />
                <VectorBars values={triple[5]} label={triple[4]} role="resid" height={100} />
              </div>
            ) : (
              <VectorBars values={single[1]} label={`${single[0]}, token ${name}`} role={role === "resid" ? "resid" : role} compare={single[2]} compareLabel="the residual stream x" />
            )}
          </div>
          {lvl === "research" && L && (
            <TensorCard title={`Qwen3-8B-Base, block ${st.layer + 1}, token ${name}`} kind="recorded"
              captured="forward hooks at module boundaries of one real forward pass of the sentence (bfloat16, layer-streamed)"
              shape="[1, 6, 4,096] per site" shown="root-mean-square (RMS) of the 4,096 numbers at each site, for the selected token">
              <table className="table-lab">
                <tbody>
                  <tr><th scope="row">residual entering (resid_pre)</th><td className="num r">{L.resid_pre_rms[t].toFixed(3)}</td></tr>
                  <tr><th scope="row">RMSNorm #1 output (attn_norm)</th><td className="num r">{L.attn_norm_rms[t].toFixed(3)}</td></tr>
                  <tr><th scope="row">attention update (attn_out)</th><td className="num r">{L.attn_out_rms[t].toFixed(3)}</td></tr>
                  <tr><th scope="row">after addition #1 (resid_mid)</th><td className="num r">{L.resid_mid_rms[t].toFixed(3)}</td></tr>
                  <tr><th scope="row">RMSNorm #2 output (mlp_norm)</th><td className="num r">{L.mlp_norm_rms[t].toFixed(3)}</td></tr>
                  <tr><th scope="row">MLP update (mlp_out)</th><td className="num r">{L.mlp_out_rms[t].toFixed(3)}</td></tr>
                  <tr><th scope="row">leaving the block (resid_post)</th><td className="num r">{L.resid_post_rms[t].toFixed(3)}</td></tr>
                </tbody>
              </table>
              <p className="mt-2 text-[12.5px] text-ink-3">Change the block in scene 6. Order verified in the installed transformers source: input_layernorm → self_attn (q_proj/k_proj/v_proj → q_norm/k_norm → RoPE → causal attention → o_proj) → add → post_attention_layernorm → mlp → add.</p>
            </TensorCard>
          )}
        </div>
      }
      side={<>
        <SceneText
          tryThis="Step through the block with “Next step”. Then switch the attention branch off and step to “Add update #1”."
          consequence={knock === "attention" ? <>Attention is off, so the update is all zeros and x′ equals x exactly (largest difference {diff.toFixed(2)}). The residual path alone still carries the token through.</>
            : knock === "mlp" ? <>The MLP is off, so the block output equals x′: only the attention update was added.</>
              : <>Step {step + 1}: {BLOCK_STEPS[step]}. {step === 1 || step === 4 ? "The copy has RMS 1 before the gain; the stream keeps its own size." : step === 3 || step === 6 ? "The after-vector is the before-vector plus the update, number by number." : ""}</>}
          explain={byLevel(lvl, {
            story: <>A block reads a <strong>rescaled copy</strong> of the token&apos;s description, computes a <strong>change</strong>, and <strong>adds</strong> it. It does this twice: once with attention, once with the MLP. Nothing is rewritten from scratch.</>,
            mechanics: <><span className="font-mono">x′ = x + Attn(RMSNorm(x))</span>, then <span className="font-mono">x″ = x′ + MLP(RMSNorm(x′))</span>. Shapes stay <span className="font-mono">[B, T, d]</span>. RMSNorm acts on the copy that feeds each branch, not on the stream.</>,
            research: <>This is the pre-norm order of Qwen3DecoderLayer, checked in the installed source. Qwen3-8B repeats it {data.arch.verified.num_hidden_layers} times with d = {data.arch.verified.hidden_size.toLocaleString("en-US")}. The table shows real sizes at each site for block {st.layer + 1}.</>,
          })}
        />
        {lvl === "story" && <AnalogyLimit analogy="Like adding notes in the margin of a shared document instead of rewriting it." limit="The “notes” are lists of numbers mixed into every position of the vector. They are not readable sentences, and later blocks can add notes that largely cancel earlier ones." />}
        <Link href="/latent/glassbox" className="rounded-xl border-2 border-[var(--role-norm)] bg-[var(--role-norm-soft)] p-4 text-[15px] text-ink hover:border-ink">
          <span className="block text-[12px] font-semibold tracking-wide text-[var(--role-norm-ink)] uppercase">Glass Box</span>
          See this same block with Qwen3-8B&apos;s real numbers, and watch your browser re-check every step →
        </Link>
        <Check id="block-zero" prompt="If the attention branch output were all zeros, what would leave the first + sign?" options={[
          { label: "All zeros", feedback: "The + adds the update to the stream. Adding zeros leaves the stream as it was." },
          { label: "The unchanged input x", correct: true, feedback: "Because the update is added to x, a zero update passes x through unchanged. Try “attention off”." },
          { label: "A normalized copy of x", feedback: "The normalized copy only feeds the branch. The stream that continues is the original x plus the update." },
        ]} />
      </>}
    />
  );
}
