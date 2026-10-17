// The causal mask as a table: row = query position i, column = key position j. Allowed when j ≤ i.

const TOKENS = ["The", "␣researcher", "␣opened", "␣the", "␣notebook"];

export function AttentionMaskDiagram() {
  return (
    <figure className="grid gap-2">
      <div className="scroll-x">
        <table className="border-separate border-spacing-1 text-center font-mono text-[11.5px]" aria-label="Causal attention mask for a five-token sentence">
          <thead>
            <tr><th className="pr-2 text-right font-sans text-[11px] font-normal text-ink-3">query ↓ / key →</th>{TOKENS.map((t) => <th key={t} scope="col" className="px-1 font-normal text-ink-2">{t}</th>)}</tr>
          </thead>
          <tbody>
            {TOKENS.map((q, i) => (
              <tr key={q}>
                <th scope="row" className="pr-2 text-right font-normal text-ink-2">{q}</th>
                {TOKENS.map((k, j) => (
                  <td key={k} className={`h-7 w-14 rounded ${j <= i ? "bg-[var(--role-attn-soft)] text-ink" : "bg-paper-2 text-ink-4"}`}>{j <= i ? "allowed" : "−∞"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="text-[13px] text-ink-3">Scores above the diagonal are set to −∞ before softmax, so they get zero weight. In training this lets all positions be scored in one pass without any position seeing its own target; at generation time the newest token simply has no future keys.</figcaption>
    </figure>
  );
}
