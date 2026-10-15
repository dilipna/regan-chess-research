"use client";

// Client-side data layer. All research numbers are loaded at runtime from /data/*.json
// (exported by experiments/06_export_web.py). Nothing is hardcoded.
import { createContext, createElement, useContext, useEffect, useState } from "react";
import type { DemoIndex, Metrics, Provenance, Report, RocCurves, SimulatorData } from "./types";

const cache = new Map<string, Promise<unknown>>();

export function loadJson<T>(path: string): Promise<T> {
  let p = cache.get(path);
  if (!p) {
    p = fetch(path, { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      return r.json();
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p as Promise<T>;
}

interface State<T> {
  key: string | null;
  data?: T;
  error?: string;
}

/**
 * Data rendered into the HTML at build time (server components read public/data/*.json and pass it
 * here), so every number is present in the static page even without JavaScript.
 */
const Preloaded = createContext<Record<string, unknown>>({});

export function DataProvider({ value, children }: { value: Record<string, unknown>; children: React.ReactNode }) {
  const parent = useContext(Preloaded);
  return createElement(Preloaded.Provider, { value: { ...parent, ...value } }, children);
}

export function useJson<T>(path: string | null) {
  const pre = useContext(Preloaded);
  const seeded = path ? (pre[path] as T | undefined) : undefined;
  const [state, setState] = useState<State<T>>({ key: null });
  useEffect(() => {
    if (!path || seeded !== undefined) return;
    let alive = true;
    loadJson<T>(path).then(
      (data) => alive && setState({ key: path, data }),
      (e: unknown) => alive && setState({ key: path, error: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      alive = false;
    };
  }, [path, seeded]);
  if (seeded !== undefined) return { data: seeded, error: undefined, loading: false };
  const cur: State<T> = state.key === path ? state : { key: path };
  return { data: cur.data, error: cur.error, loading: !!path && cur.data === undefined && !cur.error };
}

export const DATA = {
  demos: "/data/demos.json",
  demo: (id: string) => `/data/demo-${id}.json`,
  demoAif: (id: string) => `/data/demo-${id}.aif`,
  simulator: "/data/simulator.json",
  metrics: "/data/metrics.json",
  roc: "/data/roc_curves.json",
  provenance: "/data/provenance.json",
};

export const useDemos = () => useJson<DemoIndex>(DATA.demos);
export const useDemo = (id: string | null) => useJson<Report>(id ? DATA.demo(id) : null);
export const useMetrics = () => useJson<Metrics>(DATA.metrics);
export const useRoc = () => useJson<RocCurves>(DATA.roc);
export const useSimulator = () => useJson<SimulatorData>(DATA.simulator);
export const useProvenance = () => useJson<Provenance>(DATA.provenance);

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
