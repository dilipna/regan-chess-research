// RoPE on one 2-D pair of a head vector: rotate q by position m and k by position n, then compare dot products.
// The numbers are computed here; equal offsets give equal scores, which is the relative-position property.

const THETA = 0.4;                       // radians per position for this pair (toy frequency)
const Q: [number, number] = [1, 0.5];
const K: [number, number] = [0.8, -0.2];
const rot = ([x, y]: [number, number], a: number): [number, number] => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const dot = (a: [number, number], b: [number, number]) => a[0] * b[0] + a[1] * b[1];
export const ropeScore = (m: number, n: number) => dot(rot(Q, m * THETA), rot(K, n * THETA));

const CASES: [number, number][] = [[2, 5], [10, 13], [40, 43], [2, 6]];

export function RopeConceptDiagram() {
  return (
    <figure className="grid gap-3">
      <div className="scroll-x">
        <table className="w-full min-w-[460px] text-left text-[13px]">
          <thead><tr className="text-ink-3"><th className="py-1 pr-3 font-medium">query position m</th><th className="py-1 pr-3 font-medium">key position n</th><th className="py-1 pr-3 font-medium">offset n − m</th><th className="py-1 font-medium">score (R_m q) · (R_n k)</th></tr></thead>
          <tbody>
            {CASES.map(([m, n]) => (
              <tr key={`${m}-${n}`} className="border-t border-rule">
                <td className="num py-1 pr-3">{m}</td><td className="num py-1 pr-3">{n}</td><td className="num py-1 pr-3">{n - m}</td><td className="num py-1 font-mono">{ropeScore(m, n).toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="text-[13px] text-ink-3">One pair of dimensions, q = (1, 0.5), k = (0.8, −0.2), rotated by position × 0.4 rad. The first three rows share offset 3 and give the same score; offset 4 differs. Qwen3 does this for 64 pairs per head with frequencies from base 1,000,000 (rotate-half pairing). Rotation keeps lengths; nothing is added to the embedding.</figcaption>
    </figure>
  );
}
