"use client";

import { useJson } from "@/lib/data";
import { DATA3, type ThreeDemo } from "@/lib/three";
import { CompareThree } from "./compare-three";

export function CompareThreeLoader() {
  const { data, error, loading } = useJson<ThreeDemo>(DATA3.demo);
  if (loading) return <p className="text-[13px] text-ink-3">Loading the prepared study…</p>;
  if (error || !data) return <p className="text-[13px] text-flag">The prepared three-model study could not be loaded ({error ?? "no data"}).</p>;
  return <CompareThree demo={data} />;
}
