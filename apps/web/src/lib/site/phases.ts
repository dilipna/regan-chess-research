// The site in two phases. Phase 1 (chess) studied what models predict; Phase 2 (LLM internals) studies how Qwen
// forms those predictions. Every page belongs to one numbered subsection; the header and the home index read this.

export interface SubLink { n: string; href: string; label: string; blurb: string }
export interface SubGroup { title: string; links: SubLink[] }
export interface Phase { id: "chess" | "llm"; n: 1 | 2; label: string; name: string; question: string; status: string; home: string; groups: SubGroup[] }

const number = (n: number, groups: { title: string; links: Omit<SubLink, "n">[] }[]): SubGroup[] => {
  let k = 0;
  return groups.map((g) => ({ title: g.title, links: g.links.map((l) => ({ ...l, n: `${n}.${++k}` })) }));
};

export const PHASES: Phase[] = [
  {
    id: "chess", n: 1, label: "Chess", name: "MoveLens", home: "/chess",
    question: "On the same chess positions, what do a statistical model, a general-purpose LLM and a human-move model each predict?",
    status: "Complete · frozen as Version 1",
    groups: number(1, [
      { title: "The study", links: [
        { href: "/chess", label: "Overview", blurb: "Three ways to read one chess move, side by side." },
        { href: "/chess#statistical", label: "Statistical model", blurb: "A Regan-inspired difficulty and rating model." },
        { href: "/chess#qwen", label: "Qwen on chess", blurb: "Qwen3-8B-Base scored through token likelihoods." },
        { href: "/chess#maia", label: "Maia", blurb: "Maia-3: what a human of a given rating would play." },
        { href: "/chess#compare", label: "Compare", blurb: "Where the three readings agree and disagree." },
        { href: "/chess#game", label: "A full game", blurb: "Every move of one game through all three lenses." },
        { href: "/chess#checks", label: "Checks", blurb: "Sanity checks against published reference behaviour." },
      ] },
      { title: "Evidence", links: [
        { href: "/results", label: "Results", blurb: "Full held-out results and ablations." },
        { href: "/methodology", label: "Methods", blurb: "Data, models, metrics and reproducibility." },
        { href: "/examples", label: "Disagreements", blurb: "Positions where the models disagree most." },
        { href: "/analyze", label: "Analyze a game", blurb: "Run the report on a PGN." },
      ] },
    ]),
  },
  {
    id: "llm", n: 2, label: "LLMs", name: "LatentLens", home: "/latent/professor",
    question: "Inside Qwen3-8B-Base, at what depth does the correct continuation become accessible, and how does that compare across model sizes?",
    status: "In progress · recall measured on 8B; 14B vs ~27B comparison planned",
    groups: number(2, [
      { title: "Research", links: [
        { href: "/latent/professor", label: "Professor demo", blurb: "The 5 to 7 minute walkthrough: internals, one real trace, the 14B vs ~27B question." },
        { href: "/latent/recall", label: "Recall Microscope", blurb: "True-token rank by layer on a memorized text, recorded on Qwen3-8B-Base." },
        { href: "/latent/glassbox", label: "Glass Box", blurb: "Every weight-free operation re-derived from recorded tensors." },
        { href: "/latent/research", label: "Research workspace", blurb: "Layerwise probes, controls and what is still pending." },
        { href: "/latent/methods", label: "Methods", blurb: "Provenance, precision checks and wording rules." },
      ] },
      { title: "Model map", links: [
        { href: "/latent", label: "Transformer Atlas", blurb: "The whole model drawn as one zoomable map." },
        { href: "/latent/learn", label: "Reference notes", blurb: "Architecture facts, verified against config and source." },
        { href: "/latent/demo", label: "Five-step demo", blurb: "From text to next token, interactively." },
        { href: "/latent/project", label: "Project overview", blurb: "How the pieces of LatentLens fit together." },
      ] },
      { title: "Learn", links: [
        { href: "/latent/foundations", label: "Foundations", blurb: "Probability, vectors and training from zero." },
        { href: "/latent/build", label: "Build it", blurb: "Code a tiny transformer step by step." },
        { href: "/latent/labs", label: "Labs", blurb: "Hands-on experiments with each mechanism." },
        { href: "/latent/mastery", label: "Mastery path", blurb: "Every mechanism in depth, with practice." },
        { href: "/latent/journey", label: "Guided journey", blurb: "One token's trip through the model." },
        { href: "/latent/story", label: "Storybook", blurb: "The ideas told simply." },
        { href: "/latent/progress", label: "Your route", blurb: "A progress map from foundations to practice." },
        { href: "/latent/review", label: "Daily review", blurb: "Short spaced-repetition questions." },
      ] },
      { title: "Practice", links: [
        { href: "/latent/play", label: "You vs Qwen", blurb: "Guess the next token before the model does." },
        { href: "/latent/security", label: "AI security", blurb: "Threat models and attacks on LLM systems." },
        { href: "/latent/security/labs", label: "Security labs", blurb: "Ten labs on a deterministic simulator." },
      ] },
    ]),
  },
];

/** Subsections shown in the header row; the rest are one click away in the phase index. */
export const headerLinks = (p: Phase) => p.groups.slice(0, 2).flatMap((g) => g.links);

export function phaseOf(path: string): Phase | null {
  if (path === "/") return null;
  return path.startsWith("/latent") ? PHASES[1] : PHASES[0];
}

export const allLinks = () => PHASES.flatMap((p) => p.groups.flatMap((g) => g.links));
