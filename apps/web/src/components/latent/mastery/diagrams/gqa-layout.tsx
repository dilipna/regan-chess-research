// Grouped-query attention in Qwen3-8B: 32 query heads in 8 groups, each group sharing one K/V head.
// The cache table is computed from the formula, not typed in.

const LAYERS = 36, HEAD_DIM = 128, BYTES = 2;
const kvBytes = (kvHeads: number) => 2 * LAYERS * kvHeads * HEAD_DIM * BYTES;

export function GqaLayoutDiagram() {
  return (
    <figure className="grid gap-3">
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Eight groups of four query heads, each sharing one key/value head">
        {Array.from({ length: 8 }, (_, g) => (
          <li key={g} className="grid gap-1 rounded-md border border-rule bg-paper p-2">
            <span className="flex flex-wrap gap-1">{[0, 1, 2, 3].map((k) => <span key={k} className="rounded bg-[var(--role-resid-soft)] px-1 font-mono text-[11px] text-[var(--role-resid-ink)]">Q{g * 4 + k}</span>)}</span>
            <span className="rounded bg-[var(--role-attn-soft)] px-1 text-center font-mono text-[11px] text-[var(--role-attn-ink)]">K{g} V{g}</span>
          </li>
        ))}
      </ol>
      <div className="scroll-x">
        <table className="w-full min-w-[420px] text-left text-[13px]">
          <thead><tr className="text-ink-3"><th className="py-1 pr-3 font-medium">Layout</th><th className="py-1 pr-3 font-medium">K/V heads</th><th className="py-1 pr-3 font-medium">KV cache per token (bf16)</th><th className="py-1 font-medium">at 32,768 tokens</th></tr></thead>
          <tbody>
            {([["MHA", 32], ["GQA (Qwen3-8B)", 8], ["MQA", 1]] as const).map(([name, h]) => (
              <tr key={name} className={`border-t border-rule ${h === 8 ? "bg-[var(--role-norm-soft)]" : ""}`}>
                <td className="py-1 pr-3 text-ink">{name}</td><td className="num py-1 pr-3">{h}</td>
                <td className="num py-1 pr-3">{kvBytes(h).toLocaleString("en-US")} bytes</td><td className="num py-1">{(kvBytes(h) * 32768 / 1e9).toFixed(2)} GB</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="text-[13px] text-ink-3">There are still 32 query heads and 32 attention patterns; only keys and values are shared. Bytes per token = 2 (K and V) × 36 layers × K/V heads × 128 × 2 bytes.</figcaption>
    </figure>
  );
}
