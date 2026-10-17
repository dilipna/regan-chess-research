// The residual stream in one Qwen3 block: sub-layers read a normalized copy and write an update that is added.
// Semantic HTML so it reads correctly at any width and with a screen reader.

const Box = ({ children, tone }: { children: React.ReactNode; tone: "norm" | "attn" | "mlp" | "resid" }) => (
  <span className={`inline-flex items-center rounded-md border px-2 py-1 font-mono text-[12.5px] text-ink ${{ norm: "border-[var(--role-norm)] bg-[var(--role-norm-soft)]", attn: "border-[var(--role-attn)] bg-[var(--role-attn-soft)]", mlp: "border-[var(--role-mlp)] bg-[var(--role-mlp-soft)]", resid: "border-[var(--role-resid)] bg-[var(--role-resid-soft)]" }[tone]}`}>{children}</span>
);

function Sub({ name, tone, delta }: { name: string; tone: "attn" | "mlp"; delta: string }) {
  return (
    <div className="ml-6 flex flex-wrap items-center gap-1.5 border-l-2 border-dashed border-rule-strong py-2 pl-4">
      <span className="text-[12px] text-ink-3">reads a copy:</span>
      <Box tone="norm">RMSNorm</Box><span aria-hidden className="text-ink-4">→</span><Box tone={tone}>{name}</Box><span aria-hidden className="text-ink-4">→</span><Box tone={tone}>{delta}</Box>
      <span className="text-[12px] text-ink-3">[T, 4096] update</span>
    </div>
  );
}

const Stream = ({ label, note }: { label: string; note: string }) => (
  <div className="flex flex-wrap items-center gap-2"><Box tone="resid">{label}</Box><span className="text-[12.5px] text-ink-3">{note}</span></div>
);
const Add = ({ eq }: { eq: string }) => (
  <div className="flex items-center gap-2 pl-1"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--role-resid)] font-mono text-[14px] text-ink">+</span><span className="font-mono text-[12.5px] text-ink-2">{eq}</span></div>
);

export function ResidualStreamDiagram() {
  return (
    <figure aria-label="Residual stream through one block" className="grid gap-1">
      <Stream label="x" note="residual stream entering the block, [T, 4096]" />
      <Sub name="Attention" tone="attn" delta="Δattn" />
      <Add eq="x′ = x + Δattn" />
      <Sub name="SwiGLU MLP" tone="mlp" delta="Δmlp" />
      <Add eq="x″ = x′ + Δmlp" />
      <Stream label="x″" note="leaves the block, same shape; becomes x for the next block" />
      <figcaption className="mt-2 text-[13px] text-ink-3">Attention and the MLP only create updates. The stream itself is never replaced or normalized inside a block: it carries the accumulated representation from the embedding through all 36 blocks to the final norm.</figcaption>
    </figure>
  );
}
