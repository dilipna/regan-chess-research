"use client";

// The Transformer Atlas: one diagram of the whole model with semantic zoom (model → block → attention / MLP).
// Click a part to read it; "Follow a token" walks the path; "Quiz me" hides the names for retrieval practice.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { AtlasExample } from "@/lib/latent/atlas-example";
import { SeeIt, type AtlasDims } from "./visuals";
import { ROLE_COLOR, ROLE_INK, ROLE_NAME, type AtlasEdge, type AtlasLevel, type AtlasNode, type LevelId, type Role } from "@/lib/latent/atlas";

const TOUR_MS = 3800;

const bottom = (n: AtlasNode) => n.y + n.h / 2 + (n.kind === "stack" ? 12 : 0);
const top = (n: AtlasNode) => n.y - n.h / 2;

function edgePath(e: AtlasEdge, a: AtlasNode, b: AtlasNode) {
  if (e.d) return e.d;
  const y1 = bottom(a), y2 = top(b);
  if (a.x === b.x) return `M ${a.x} ${y1} V ${y2}`;
  const my = (y1 + y2) / 2;
  return `M ${a.x} ${y1} V ${my} H ${b.x} V ${y2}`;
}

export function Atlas({ levels, dims, example }: { levels: AtlasLevel[]; dims: AtlasDims; example?: AtlasExample }) {
  const byId = useMemo(() => Object.fromEntries(levels.map((l) => [l.id, l])) as Record<LevelId, AtlasLevel>, [levels]);
  const [levelId, setLevelId] = useState<LevelId>("model");
  const [sel, setSel] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [quiz, setQuiz] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());

  const level = byId[levelId];
  const node = sel ? level.nodes.find((n) => n.id === sel) ?? null : null;
  const idx = node ? level.order.indexOf(node.id) : -1;

  const go = useCallback((id: LevelId) => { setLevelId(id); setSel(null); setPlaying(false); }, []);
  const step = useCallback((dir: 1 | -1) => {
    const i = sel ? level.order.indexOf(sel) : -1;
    const j = i + dir;
    if (j < 0) { setSel(null); return; }
    if (j >= level.order.length) { setPlaying(false); return; }
    setSel(level.order[j]);
  }, [level, sel]);

  // guided tour: advance along the token's path, stop at the end
  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => {
      const i = sel ? level.order.indexOf(sel) : -1;
      if (i + 1 >= level.order.length) setPlaying(false);
      else setSel(level.order[i + 1]);
    }, sel ? TOUR_MS : 400);
    return () => window.clearTimeout(t);
  }, [playing, sel, level]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); setPlaying(false); step(1); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); setPlaying(false); step(-1); }
    else if (e.key === "Escape") { setSel(null); setPlaying(false); }
  };

  const key = (id: string) => `${levelId}:${id}`;
  const hidden = (id: string) => quiz && !revealed.has(key(id));
  const reveal = (id: string) => setRevealed((r) => new Set(r).add(key(id)));
  const revealedHere = level.order.filter((id) => revealed.has(key(id))).length;

  const crumbs: AtlasLevel[] = [];
  for (let l: AtlasLevel | undefined = level; l; l = l.parent ? byId[l.parent] : undefined) crumbs.unshift(l);

  return (
    <section id="atlas" aria-label="Transformer Atlas" onKeyDown={onKey} className="scroll-mt-20">
      {/* level switch */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Zoom level" className="no-scrollbar flex max-w-full gap-0.5 overflow-x-auto rounded-full border border-rule bg-paper p-1 sm:gap-1">
          {levels.map((l, i) => (
            <button key={l.id} type="button" role="tab" aria-selected={l.id === levelId} onClick={() => go(l.id)}
              className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12.5px] whitespace-nowrap text-ink-3 transition-colors hover:text-ink sm:px-3 sm:text-[13px]",
                l.id === levelId && "bg-paper-3 text-ink shadow-[inset_0_0_0_1px_var(--rule-strong)]")}>
              <span className="num font-mono text-[10.5px] text-ink-4">{["1", "2", "3a", "3b"][i]}</span>{l.tab}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => { setPlaying((p) => !p); if (!playing && idx === level.order.length - 1) setSel(null); }}
            aria-pressed={playing}
            className={cn("flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
              playing ? "border-[var(--role-resid)] bg-[var(--role-resid-soft)] text-ink" : "border-rule-strong text-ink-2 hover:border-ink-4 hover:text-ink")}>
            {playing ? <PauseIcon /> : <PlayIcon />}{playing ? "Pause" : "Follow a token"}
          </button>
          <button type="button" onClick={() => { setQuiz((q) => !q); setPlaying(false); }} aria-pressed={quiz}
            className={cn("rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
              quiz ? "border-[var(--role-attn)] bg-[var(--role-attn-soft)] text-ink" : "border-rule-strong text-ink-2 hover:border-ink-4 hover:text-ink")}>
            {quiz ? `Quiz on · ${revealedHere}/${level.order.length}` : "Quiz me"}
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* canvas */}
        <div className="atlas-field relative min-w-0 overflow-hidden rounded-3xl border border-rule">
          <div className="flex items-center gap-1.5 px-5 pt-4 text-[12px] text-ink-4">
            {crumbs.map((c, i) => (
              <span key={c.id} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden>›</span>}
                {c.id === levelId ? <span className="text-ink-2">{c.title}</span>
                  : <button type="button" onClick={() => go(c.id)} className="underline decoration-rule-strong underline-offset-4 hover:text-ink">{c.title}</button>}
              </span>
            ))}
          </div>
          <div key={levelId} className="atlas-fade px-2 pt-2 pb-5 sm:px-6">
            <Canvas level={level} sel={sel} hidden={hidden}
              onPick={(id) => { setPlaying(false); setSel(id === sel ? null : id); }}
              onDive={(id) => go(id)} />
          </div>
          <Legend />
        </div>

        {/* explanation */}
        <Panel level={level} node={node} idx={idx} hidden={node ? hidden(node.id) : false} dims={dims} example={example}
          onReveal={() => node && reveal(node.id)}
          onStep={(d) => { setPlaying(false); step(d); }}
          onDive={(id) => go(id)}
          onUp={level.parent ? () => go(level.parent!) : undefined}
          onStart={() => { setSel(null); setPlaying(true); }}
          onClose={() => { setSel(null); setPlaying(false); }}
          playing={playing} />
      </div>
    </section>
  );
}

function Canvas({ level, sel, hidden, onPick, onDive }: {
  level: AtlasLevel; sel: string | null; hidden: (id: string) => boolean; onPick: (id: string) => void; onDive: (id: LevelId) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const nodes = Object.fromEntries(level.nodes.map((n) => [n.id, n]));
  const selNode = sel ? nodes[sel] : undefined;
  const live = (e: AtlasEdge) => e.to === sel;
  const order = level.order;
  const still = useReducedMotion();
  // crop the viewBox to the drawing so narrow levels render larger on phones; keep one scale across levels on desktop
  const xs = level.nodes.flatMap((n) => [n.x - n.w / 2, n.x + n.w / 2 + (n.kind === "stack" ? 18 : 0)]);
  const minX = Math.max(0, Math.min(...xs) - 22), maxX = Math.min(level.width, Math.max(...xs) + 22);

  return (
    <svg viewBox={`${minX} 0 ${maxX - minX} ${level.height}`} role="group" aria-label={`${level.title}: diagram`}
      className="mx-auto block h-auto w-full select-none" style={{ overflow: "visible", maxWidth: Math.round((maxX - minX) * 1.17) }}>
      <defs>
        <marker id={`${uid}-a`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 1 L10 5 L0 9 z" fill="var(--ink-4)" />
        </marker>
        <marker id={`${uid}-h`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 1 L10 5 L0 9 z" fill="var(--ink)" />
        </marker>
        <marker id={`${uid}-r`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 1 L10 5 L0 9 z" fill="var(--role-resid)" />
        </marker>
        <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <filter id={`${uid}-soft`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* edges: residual stream first so everything sits on top of it */}
      {level.edges.filter((e) => e.resid).map((e, i) => {
        const d = edgePath(e, nodes[e.from], nodes[e.to]);
        return (
          <g key={`r${i}`} aria-hidden>
            <path d={d} fill="none" stroke="var(--role-resid)" strokeWidth={10} opacity={0.16} filter={`url(#${uid}-soft)`} />
            <path d={d} fill="none" stroke="var(--role-resid)" strokeWidth={3} opacity={0.85} markerEnd={`url(#${uid}-r)`} />
            <path d={d} fill="none" stroke="#e6f3ff" strokeWidth={3} strokeLinecap="round" className="atlas-flow" opacity={0.9} />
          </g>
        );
      })}
      {level.edges.filter((e) => !e.resid).map((e, i) => {
        const d = edgePath(e, nodes[e.from], nodes[e.to]);
        const hot = live(e);
        return (
          <g key={`e${i}`} aria-hidden>
            <path d={d} fill="none" stroke={hot ? "var(--ink)" : "var(--rule-strong)"} strokeWidth={hot ? 1.6 : 1.4}
              markerEnd={`url(#${uid}-${hot ? "h" : "a"})`} className={hot ? "atlas-edge-live" : undefined} />
            {hot && !still && (
              <circle r={4} fill={ROLE_COLOR[nodes[e.to].role]} filter={`url(#${uid}-soft)`}>
                <animateMotion dur="1.3s" repeatCount="indefinite" path={d} />
              </circle>
            )}
          </g>
        );
      })}
      {level.edges.filter((e) => e.label).map((e, i) => (
        <text key={`l${i}`} x={e.lx} y={e.ly} textAnchor={e.anchor ?? "start"} fill={e.resid ? "var(--role-resid-ink)" : "var(--ink-4)"} fontSize={10.5}
          fontFamily="var(--font-figures), ui-monospace, monospace" aria-hidden>{e.label}</text>
      ))}

      {/* glow behind the selected node */}
      {selNode && (
        <g aria-hidden className="atlas-pulse">
          {selNode.kind === "op"
            ? <circle cx={selNode.x} cy={selNode.y} r={selNode.w / 2 + 6} fill={ROLE_COLOR[selNode.role]} opacity={0.45} filter={`url(#${uid}-glow)`} />
            : <rect x={selNode.x - selNode.w / 2} y={selNode.y - selNode.h / 2} width={selNode.w} height={selNode.h} rx={12}
                fill={ROLE_COLOR[selNode.role]} opacity={0.4} filter={`url(#${uid}-glow)`} />}
        </g>
      )}

      {level.nodes.map((n) => (
        <Node key={n.id} n={n} on={n.id === sel} dim={!!sel && n.id !== sel} hide={hidden(n.id)} num={order.indexOf(n.id) + 1}
          onPick={() => onPick(n.id)} onDive={n.dive ? () => onDive(n.dive!) : undefined} />
      ))}
    </svg>
  );
}

/** True when the viewer asked for less motion (OS setting or the LatentLens "Motion: off" switch). */
function useReducedMotion() {
  const [still, setStill] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setStill(mq.matches || document.querySelector("[data-latent-theme][data-motion=off]") !== null);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);
  return still;
}

function Node({ n, on, dim, hide, num, onPick, onDive }: {
  n: AtlasNode; on: boolean; dim: boolean; hide: boolean; num: number; onPick: () => void; onDive?: () => void;
}) {
  const c = ROLE_COLOR[n.role];
  const x0 = n.x - n.w / 2, y0 = n.y - n.h / 2;
  const label = hide ? "?" : n.label;
  const common = {
    role: "button" as const, tabIndex: 0, className: "atlas-node",
    "aria-label": hide ? `Part ${num}, name hidden` : `${n.label}${n.sub ? `, ${n.sub}` : ""}`,
    "aria-pressed": on,
    style: { ["--c" as string]: c, opacity: dim ? 0.62 : 1, transition: "opacity 220ms ease" } as React.CSSProperties,
    onClick: onPick,
    onDoubleClick: onDive,
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(); } },
  };

  if (n.kind === "op") {
    return (
      <g {...common}>
        <circle cx={n.x} cy={n.y} r={n.w / 2} fill="#0b0f17" stroke={c} strokeWidth={on ? 2.4 : 1.8} />
        <text x={n.x} y={n.y + 1} textAnchor="middle" dominantBaseline="central" fill={on ? "var(--ink)" : ROLE_INK[n.role]}
          fontSize={hide ? 14 : 19} fontWeight={600}>{label}</text>
      </g>
    );
  }

  if (n.kind === "stack") {
    const pw = (n.w - 56) / 2;
    return (
      <g {...common}>
        {[2, 1].map((k) => (
          <rect key={k} x={x0 + k * 6} y={y0 + k * 6} width={n.w} height={n.h} rx={14} fill="#0b0f17" stroke="var(--rule-strong)" strokeWidth={1} opacity={1 - k * 0.25} />
        ))}
        <rect className="atlas-box" x={x0} y={y0} width={n.w} height={n.h} rx={14} fill="#0d1320" stroke={on ? "var(--ink)" : "var(--role-resid)"} strokeWidth={on ? 2 : 1.4} />
        <rect className="atlas-ring" x={x0 - 4} y={y0 - 4} width={n.w + 8} height={n.h + 8} rx={17} fill="none" stroke="none" />
        <text x={x0 + 16} y={y0 + 24} fill="var(--ink)" fontSize={14} fontWeight={600}>{label}</text>
        {!hide && <>
          <rect x={x0 + 16} y={y0 + 40} width={pw} height={28} rx={8} fill="var(--role-attn-soft)" stroke="var(--role-attn)" strokeWidth={1} />
          <text x={x0 + 16 + pw / 2} y={y0 + 54} textAnchor="middle" dominantBaseline="central" fill="var(--role-attn-ink)" fontSize={11.5}>Attention</text>
          <rect x={x0 + 40 + pw} y={y0 + 40} width={pw} height={28} rx={8} fill="var(--role-mlp-soft)" stroke="var(--role-mlp)" strokeWidth={1} />
          <text x={x0 + 40 + pw * 1.5} y={y0 + 54} textAnchor="middle" dominantBaseline="central" fill="var(--role-mlp-ink)" fontSize={11.5}>MLP</text>
          <text x={x0 + 28 + pw} y={y0 + 54} textAnchor="middle" dominantBaseline="central" fill="var(--ink-4)" fontSize={13}>→</text>
          <text x={x0 + 16} y={y0 + n.h - 14} fill="var(--ink-4)" fontSize={10.5} fontFamily="var(--font-figures), ui-monospace, monospace">each adds an update · tap to open</text>
        </>}
        <g aria-hidden>
          <rect x={x0 + n.w - 54} y={y0 - 12} width={60} height={24} rx={12} fill="var(--role-resid)" />
          <text x={x0 + n.w - 24} y={y0 + 1} textAnchor="middle" dominantBaseline="central" fill="var(--on-role)" fontSize={12} fontWeight={700}
            fontFamily="var(--font-figures), ui-monospace, monospace">{n.badge}</text>
        </g>
      </g>
    );
  }

  return (
    <g {...common}>
      <rect className="atlas-box" x={x0} y={y0} width={n.w} height={n.h} rx={11}
        fill={on ? `color-mix(in oklab, ${c} 20%, #0b0f17)` : "#0d1320"} stroke={c} strokeOpacity={on ? 1 : 0.6} strokeWidth={on ? 2 : 1.2} />
      <rect className="atlas-ring" x={x0 - 4} y={y0 - 4} width={n.w + 8} height={n.h + 8} rx={14} fill="none" stroke="none" />
      <rect x={x0} y={y0 + 8} width={3} height={n.h - 16} rx={1.5} fill={c} opacity={0.9} />
      {hide && <text x={x0 + 14} y={n.y + 1} dominantBaseline="central" fill="var(--ink-4)" fontSize={10.5} fontFamily="var(--font-figures), ui-monospace, monospace">{num}</text>}
      {n.sub && !hide ? (
        <>
          <text x={n.x} y={n.y - 7} textAnchor="middle" dominantBaseline="central" fill="var(--ink)" fontSize={13.5} fontWeight={500}>{label}</text>
          <text x={n.x} y={n.y + 10} textAnchor="middle" dominantBaseline="central" fill="var(--ink-3)" fontSize={10.5}
            fontFamily="var(--font-figures), ui-monospace, monospace">{n.sub}</text>
        </>
      ) : (
        <text x={n.x} y={n.y + 1} textAnchor="middle" dominantBaseline="central" fill={hide ? "var(--ink-3)" : "var(--ink)"} fontSize={hide ? 16 : 14} fontWeight={500}>{label}</text>
      )}
      {n.dive && !hide && (
        <g aria-hidden>
          <circle cx={x0 + n.w - 14} cy={y0 + 14} r={8} fill="none" stroke={c} strokeOpacity={0.8} />
          <path d={`M ${x0 + n.w - 17} ${y0 + 14} h 6 M ${x0 + n.w - 14} ${y0 + 11} v 6`} stroke={c} strokeWidth={1.4} />
        </g>
      )}
    </g>
  );
}

function Legend() {
  const items: Role[] = ["resid", "norm", "attn", "mlp", "io"];
  return (
    <ul aria-label="Colour key" className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-rule px-5 py-3 text-[11.5px] text-ink-3">
      {items.map((r) => (
        <li key={r} className="flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: ROLE_COLOR[r], boxShadow: `0 0 8px ${ROLE_COLOR[r]}` }} />
          {ROLE_NAME[r]}
        </li>
      ))}
    </ul>
  );
}

function Panel({ level, node, idx, hidden, playing, dims, example, onReveal, onStep, onDive, onUp, onStart, onClose }: {
  level: AtlasLevel; node: AtlasNode | null; idx: number; hidden: boolean; playing: boolean; dims: AtlasDims; example?: AtlasExample;
  onReveal: () => void; onStep: (d: 1 | -1) => void; onDive: (id: LevelId) => void; onUp?: () => void; onStart: () => void; onClose: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [node?.id]);

  return (
    <aside aria-live="polite" aria-label="Explanation"
      className={cn("min-w-0 lg:sticky lg:top-20 lg:self-start",
        node && "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-50 max-lg:px-2 max-lg:pb-2")}>
      <div ref={scroller}
        className={cn("rounded-3xl border border-rule bg-paper p-5 sm:p-6 lg:max-h-[calc(100vh-6.5rem)] lg:overflow-y-auto",
          node && "max-lg:max-h-[62vh] max-lg:overflow-y-auto max-lg:border-rule-strong max-lg:bg-paper-2 max-lg:shadow-[0_-24px_60px_-10px_rgba(0,0,0,0.95)]")}>
        {!node ? <Summary level={level} onStart={onStart} onUp={onUp} playing={playing} />
          : <div key={node.id} className="atlas-fade">
              <Detail node={node} hidden={hidden} onReveal={onReveal} onDive={onDive} onClose={onClose}
                seeIt={<SeeIt id={node.id} ex={example} d={dims} />} />
              <div className="mt-6 flex items-center justify-between gap-2 border-t border-rule pt-4">
                <button type="button" onClick={() => onStep(-1)} className="rounded-full border border-rule-strong px-3 py-1.5 text-[12.5px] text-ink-2 hover:text-ink">← Back</button>
                <span className="num font-mono text-[11.5px] text-ink-4">{idx + 1} / {level.order.length}</span>
                <button type="button" onClick={() => onStep(1)} disabled={idx === level.order.length - 1}
                  className="rounded-full border border-rule-strong px-3 py-1.5 text-[12.5px] text-ink-2 hover:text-ink disabled:opacity-35">Next →</button>
              </div>
            </div>}
      </div>
    </aside>
  );
}

function Summary({ level, onStart, onUp, playing }: { level: AtlasLevel; onStart: () => void; onUp?: () => void; playing: boolean }) {
  return (
    <div key={level.id} className="atlas-fade">
      <div className="text-[11px] font-medium tracking-[0.14em] text-ink-4 uppercase">Overview</div>
      <h3 className="mt-2 font-serif text-[26px] leading-tight font-semibold text-ink">{level.title}</h3>
      <p className="mt-4 rounded-2xl border border-rule-strong bg-paper-2 px-4 py-3 font-mono text-[12.5px] leading-relaxed text-[var(--role-resid-ink)]">{level.mnemonic}</p>
      <p className="mt-4 text-[14.5px] leading-[1.75] text-ink-2">{level.summary}</p>
      <div className="mt-6 flex flex-wrap gap-2">
        {!playing && (
          <button type="button" onClick={onStart}
            className="flex items-center gap-2 rounded-full bg-[var(--role-resid)] px-4 py-2 text-[13.5px] font-semibold text-[var(--on-role)] shadow-[0_0_24px_-4px_var(--role-resid)] hover:brightness-110">
            <PlayIcon />Walk me through it
          </button>
        )}
        {onUp && <button type="button" onClick={onUp} className="rounded-full border border-rule-strong px-4 py-2 text-[13.5px] text-ink-2 hover:text-ink">↑ Zoom out</button>}
      </div>
      <p className="mt-5 text-[12.5px] text-ink-4">Or click any part of the diagram. Arrow keys step through it. Parts marked ⊕ open a deeper level.</p>
    </div>
  );
}

function Detail({ node, hidden, seeIt, onReveal, onDive, onClose }: {
  node: AtlasNode; hidden: boolean; seeIt: React.ReactNode; onReveal: () => void; onDive: (id: LevelId) => void; onClose: () => void;
}) {
  const p = node.part;
  const c = ROLE_COLOR[node.role];
  const head = (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-[11px] font-medium tracking-[0.14em] uppercase" style={{ color: ROLE_INK[node.role] }}>
        <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: c, boxShadow: `0 0 10px ${c}` }} />
        {ROLE_NAME[node.role]}
      </span>
      <button type="button" onClick={onClose} aria-label="Close explanation" className="-mr-1 rounded-full px-2 py-0.5 text-[16px] text-ink-4 hover:text-ink">×</button>
    </div>
  );

  if (hidden) {
    return (
      <div>
        {head}
        <h3 className="mt-3 font-serif text-[24px] font-semibold text-ink">Which part is this?</h3>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">Clue: {p.intuition}</p>
        <p className="mt-3 font-mono text-[12px] text-ink-3">Shape: {p.shapes}</p>
        <p className="mt-4 text-[13px] text-ink-4">Say the name out loud, then check yourself.</p>
        <button type="button" onClick={onReveal}
          className="mt-4 rounded-full bg-[var(--role-attn)] px-4 py-2 text-[13.5px] font-semibold text-[var(--on-role)] hover:brightness-110">Reveal</button>
      </div>
    );
  }

  return (
    <div>
      {head}
      <h3 className="mt-3 font-serif text-[26px] leading-tight font-semibold text-ink">{p.title}</h3>
      {p.module && <div className="mt-1 font-mono text-[11.5px] text-ink-4">{p.module}</div>}
      <p className="mt-4 text-[16px] leading-relaxed text-ink">{p.intuition}</p>

      {seeIt}

      {p.hook && (
        <div className="mt-5 rounded-2xl border px-4 py-3" style={{ borderColor: `color-mix(in oklab, ${c} 45%, transparent)`, background: `color-mix(in oklab, ${c} 9%, #0b0f17)` }}>
          <div className="text-[10.5px] font-medium tracking-[0.14em] uppercase" style={{ color: ROLE_INK[node.role] }}>Remember it as</div>
          <p className="mt-1 text-[15px] leading-snug text-ink">{p.hook}</p>
        </div>
      )}

      <div className="mt-5">
        <div className="text-[10.5px] font-medium tracking-[0.14em] text-ink-4 uppercase">Shape</div>
        <code className="mt-1.5 block rounded-xl border border-rule bg-[#080b12] px-3 py-2 font-mono text-[12px] leading-relaxed break-words text-ink-2">{p.shapes}</code>
      </div>

      <Section title="How it works">
        <p>{p.mechanism}</p>
        {p.equation && <code className="mt-2.5 block rounded-xl border border-rule bg-[#080b12] px-3 py-2 font-mono text-[12.5px] leading-relaxed break-words text-ink">{p.equation}</code>}
      </Section>
      <Section title="Why it exists"><p>{p.why}</p></Section>
      <Section title="Don’t confuse" tone="warn"><p>{p.confusion}</p></Section>

      {node.dive && (
        <button type="button" onClick={() => onDive(node.dive!)}
          className="mt-6 flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-[14px] text-ink hover:brightness-125"
          style={{ borderColor: c, background: `color-mix(in oklab, ${c} 12%, #0b0f17)` }}>
          <span>Step inside: {node.label}</span><span aria-hidden>→</span>
        </button>
      )}
    </div>
  );
}

function Section({ title, tone, children }: { title: string; tone?: "warn"; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className={cn("text-[10.5px] font-medium tracking-[0.14em] uppercase", tone === "warn" ? "text-[var(--bad-ink)]" : "text-ink-4")}>{title}</div>
      <div className="mt-1.5 text-[14px] leading-[1.7] text-ink-2">{children}</div>
    </div>
  );
}

function PlayIcon() {
  return <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden><path d="M3 1.5v9l7.5-4.5z" fill="currentColor" /></svg>;
}
function PauseIcon() {
  return <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden><path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" fill="currentColor" /></svg>;
}
