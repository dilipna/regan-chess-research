import type { Metadata } from "next";
import Link from "next/link";
import { EndToEndRequest } from "@/components/latent/mastery/end-to-end-request";

export const metadata: Metadata = { title: "Follow one request end to end · LLM Mastery", description: "\"Summarize my latest project document and email the summary\", traced through the UI, the model and every trust boundary." };

export default function RequestPage() {
  return (
    <div className="grid gap-6">
      <header className="grid gap-2 border-b border-rule pb-6">
        <Link href="/latent/mastery" className="text-[13px] text-ink-3 underline underline-offset-2">← Mastery</Link>
        <h1 className="font-serif text-[36px] leading-tight font-semibold text-ink">Follow one request end to end</h1>
        <p className="max-w-3xl font-serif text-[22px] text-ink">&quot;Summarize my latest project document and email the summary.&quot;</p>
        <p className="max-w-3xl text-[15px] text-ink-2">One request connects almost the whole curriculum: tokens and attention, retrieval, tool calls, and the places where trust changes. Switch views to see the same path three ways.</p>
      </header>
      <EndToEndRequest />
    </div>
  );
}
