"use client";

import { FINAL_TEST } from "@/lib/latent/mastery/course";
import { TeachBackPrompt } from "../learn/primitives";
import { saveTeachBack, useLearn } from "../learn/progress-hook";

export function FinalTest() {
  const st = useLearn();
  return (
    <ol className="grid gap-5">
      {FINAL_TEST.map((p) => (
        <li key={p.part} className="rounded-xl border border-rule bg-paper p-4 sm:p-5">
          <h2 className="mb-2 font-serif text-[22px] font-semibold text-ink"><span className="num text-ink-4">{p.part}.</span> {p.title}</h2>
          <TeachBackPrompt prompt={p.prompt} points={p.rubric} saved={st.teach[`final:${p.part}`]?.text} onSave={(text, n) => saveTeachBack(`final:${p.part}`, text, n)} />
        </li>
      ))}
    </ol>
  );
}
