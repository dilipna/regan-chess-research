// SwiGLU in Qwen3-8B, applied to each position separately.

const Chip = ({ children, tone = "ink" }: { children: React.ReactNode; tone?: "ink" | "mlp" | "norm" }) => (
  <span className={`inline-flex items-center rounded-md border px-2 py-1 font-mono text-[12.5px] text-ink ${{ ink: "border-rule-strong bg-paper", mlp: "border-[var(--role-mlp)] bg-[var(--role-mlp-soft)]", norm: "border-[var(--role-norm)] bg-[var(--role-norm-soft)]" }[tone]}`}>{children}</span>
);
const Arrow = () => <span aria-hidden className="text-ink-4">→</span>;

export function MlpFlowDiagram() {
  return (
    <figure aria-label="SwiGLU MLP data flow for one position" className="grid gap-2">
      <div className="flex flex-wrap items-center gap-1.5"><Chip>x′ [4096]</Chip><Arrow /><Chip tone="norm">post-attention RMSNorm</Chip></div>
      <ol className="grid gap-1.5 pl-4">
        <li className="flex flex-wrap items-center gap-1.5"><span className="w-12 text-[12px] font-semibold text-ink-3">gate</span><Chip>× W_gate</Chip><Arrow /><Chip>[12288]</Chip><Arrow /><Chip tone="mlp">SiLU</Chip></li>
        <li className="flex flex-wrap items-center gap-1.5"><span className="w-12 text-[12px] font-semibold text-ink-3">up</span><Chip>× W_up</Chip><Arrow /><Chip>[12288]</Chip></li>
      </ol>
      <div className="flex flex-wrap items-center gap-1.5"><Chip tone="mlp">SiLU(gate) ⊙ up</Chip><Arrow /><Chip>× W_down</Chip><Arrow /><Chip tone="mlp">Δmlp [4096]</Chip><span className="text-[12.5px] text-ink-3">added to the residual stream</span></div>
      <figcaption className="text-[13px] text-ink-3">The gate decides how much of each of 12,288 features passes; the product goes back down to 4,096. The same weights run at every position and no position reads another: attention communicates between positions, the MLP transforms features within one.</figcaption>
    </figure>
  );
}
