"use client";

import { fmtNum, fmtPct } from "@/lib/format";
import { useJson } from "@/lib/data";
import { DATA3 } from "@/lib/three";

interface HybridEResults {
  status?: "ok" | "pending";
  label: string;
  roc_auc: number;
  pr_auc: number;
  tpr_at_fpr: { target_fpr: number; tpr: number; test_fpr: number }[];
  paired_vs_D: { delta: number; ci95: [number, number] };
  features_added: string[];
  caveat: string;
}

/** System E (D + Qwen features). Rendered only when experiments/17_hybrid_qwen.py has produced real results. */
export function HybridE() {
  const { data } = useJson<HybridEResults>(DATA3.hybridE);
  // Not shown at all until the LLM has been run and System E has real results.
  if (!data || data.status !== "ok") return null;
  const [lo, hi] = data.paired_vs_D.ci95;
  return (
    <div className="mb-10 rounded-md border border-llm/40 bg-paper p-4 text-[13px]">
      <div className="font-semibold text-ink">{data.label}</div>
      <div className="mt-1 num text-ink-2">
        ROC-AUC {fmtNum(data.roc_auc, 3)} · PR-AUC {fmtNum(data.pr_auc, 3)} · recall at 1% target {fmtPct(data.tpr_at_fpr[0]?.tpr, 1)} (realized FPR{" "}
        {fmtPct(data.tpr_at_fpr[0]?.test_fpr, 1)}) · D → E {data.paired_vs_D.delta >= 0 ? "+" : "−"}{Math.abs(data.paired_vs_D.delta).toFixed(4)} AUC [{lo.toFixed(4)}, {hi.toFixed(4)}]
      </div>
      <div className="mt-1 text-[12px] text-ink-3">{data.caveat}</div>
    </div>
  );
}
