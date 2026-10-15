import type { Metadata } from "next";
import { AttentionLab } from "@/components/latent/attention-lab";
import { BlockMicroscope } from "@/components/latent/block";
import { FollowOneToken } from "@/components/latent/follow-token";
import { MlpLab } from "@/components/latent/mlp-lab";
import { OutputLab } from "@/components/latent/output-lab";
import { RmsnormLab } from "@/components/latent/rmsnorm-lab";
import { Rule } from "@/components/latent/shell";
import { KvCacheLab, TeachBack, TrainingSection } from "@/components/latent/training";
import { loadLatent } from "@/lib/latent/data";

export const metadata: Metadata = { title: "Learn: how Qwen works" };

const TOC = [["#follow", "Follow one token"], ["#block", "Block microscope"], ["#rmsnorm", "RMSNorm lab"], ["#attention", "Attention, GQA, RoPE"],
  ["#mlp", "MLP and residual"], ["#output", "Logits and decoding"], ["#kv", "KV cache"], ["#training", "How Qwen learns"], ["#teachback", "Test my understanding"]];

export default async function LearnPage() {
  const d = await loadLatent();
  if (!d.arch || !d.tok || !d.trace) return <p role="alert" className="text-[13px] text-flag">Learn Mode artifacts could not be loaded.</p>;
  return (
    <>
      <header className="mb-10 border-b border-rule pb-8">
        <div className="eyebrow mb-2">Learn Mode</div>
        <h1 className="font-serif text-[34px] leading-tight font-semibold tracking-tight text-ink sm:text-[42px]">How does Qwen actually work?</h1>
        <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-ink-2">
          From text to the next token, then how the weights were learned. Real values come from Qwen3-8B-Base and are marked as measured; small worked examples are marked as toys.
        </p>
        <nav aria-label="On this page" className="mt-5 flex flex-wrap gap-1.5">
          {TOC.map(([h, l]) => <a key={h} href={h} className="rounded border border-rule-strong px-2 py-0.5 text-[12.5px] text-ink-3 hover:text-ink">{l}</a>)}
        </nav>
      </header>
      <FollowOneToken arch={d.arch} tok={d.tok} trace={d.trace} />
      <Rule />
      <BlockMicroscope arch={d.arch} />
      <Rule />
      <RmsnormLab arch={d.arch} trace={d.trace} />
      <Rule />
      <AttentionLab arch={d.arch} trace={d.trace} />
      <Rule />
      <MlpLab arch={d.arch} trace={d.trace} />
      <Rule />
      <OutputLab arch={d.arch} trace={d.trace} />
      <div id="kv" className="mt-6 scroll-mt-28"><KvCacheLab arch={d.arch} /></div>
      <Rule />
      <TrainingSection arch={d.arch} trace={d.trace} />
      <Rule />
      <TeachBack />
    </>
  );
}
