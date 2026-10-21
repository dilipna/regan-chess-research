// Attention in Qwen3-8B as a flow: projections, per-head Q/K RMSNorm, RoPE on Q and K only, then the masked
// softmax over scores, the weighted sum of V, head concatenation and o_proj.

const Chip = ({ children, tone = "ink" }: { children: React.ReactNode; tone?: "ink" | "norm" | "attn" | "resid" }) => (
  <span className={`inline-flex items-center rounded-md border px-2 py-1 font-mono text-[12.5px] text-ink ${{ ink: "border-rule-strong bg-paper", norm: "border-[var(--role-norm)] bg-[var(--role-norm-soft)]", attn: "border-[var(--role-attn)] bg-[var(--role-attn-soft)]", resid: "border-[var(--role-resid)] bg-[var(--role-resid-soft)]" }[tone]}`}>{children}</span>
);
const Arrow = () => <span aria-hidden className="text-ink-4">→</span>;
const Row = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <li className="flex flex-wrap items-center gap-1.5"><span className="w-6 text-[12px] font-semibold text-ink-3">{label}</span>{children}</li>
);

export function QkvFlowDiagram() {
  return (
    <figure aria-label="Attention data flow in one Qwen3 block" className="grid gap-3">
      <div className="flex flex-wrap items-center gap-1.5"><Chip tone="resid">x [T, 4096]</Chip><Arrow /><Chip tone="norm">input RMSNorm</Chip><span className="text-[12.5px] text-ink-3">then three projections:</span></div>
      <ol className="grid gap-1.5 pl-2">
        <Row label="Q"><Chip>× W_Q</Chip><Arrow /><Chip>[T, 32, 128]</Chip><Arrow /><Chip tone="norm">q_norm (per head)</Chip><Arrow /><Chip tone="attn">RoPE rotate</Chip></Row>
        <Row label="K"><Chip>× W_K</Chip><Arrow /><Chip>[T, 8, 128]</Chip><Arrow /><Chip tone="norm">k_norm (per head)</Chip><Arrow /><Chip tone="attn">RoPE rotate</Chip><span className="text-[12px] text-ink-3">cached</span></Row>
        <Row label="V"><Chip>× W_V</Chip><Arrow /><Chip>[T, 8, 128]</Chip><span className="text-[12px] text-ink-3">no norm, no rotation; cached</span></Row>
      </ol>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip>Q·Kᵀ / √128</Chip><span className="text-[12px] text-ink-3">each K head serves 4 Q heads</span><Arrow /><Chip>causal mask (j ≤ i)</Chip><Arrow /><Chip>softmax over keys</Chip><Arrow /><Chip>× V</Chip><Arrow /><Chip>concat 32 heads [T, 4096]</Chip><Arrow /><Chip>× W_O</Chip><Arrow /><Chip tone="attn">Δattn [T, 4096]</Chip>
      </div>
      <figcaption className="text-[13px] text-ink-3">RoPE does not add a position vector: it rotates pairs of dimensions in Q and K by angles proportional to position, so each score depends on the offset between the two positions. Only V carries content into the output; Q and K decide the weights.</figcaption>
    </figure>
  );
}
