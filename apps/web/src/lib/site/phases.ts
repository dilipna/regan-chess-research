// The site in two phases. Phase 1 (chess) studied what models predict; Phase 2 (LLM internals) studies how Qwen
// forms those predictions. Every page belongs to one numbered subsection; the header and the home index read this.

export interface SubLink { n: string; href: string; label: string; blurb: string; key?: true; parts?: { href: string; label: string }[] }
/** compact groups (study material) are listed as a short row of links rather than one line each */
export interface SubGroup { title: string; compact?: true; links: SubLink[] }
export interface Phase { id: "chess" | "llm"; n: 1 | 2; label: string; name: string; plain: string; question: string; status: string; home: string; groups: SubGroup[] }

const number = (n: number, groups: (Omit<SubGroup, "links"> & { links: Omit<SubLink, "n">[] })[]): SubGroup[] => {
  let k = 0;
  return groups.map((g) => ({ ...g, links: g.links.map((l) => ({ ...l, n: `${n}.${++k}` })) }));
};

export const PHASES: Phase[] = [
  {
    id: "chess", n: 1, label: "Chess", name: "MoveLens", home: "/chess", plain: "Outside the model",
    question: "Given one chess position, what move does a statistical model expect, what does a language model prefer, and what would a human play?",
    status: "Done",
    groups: number(1, [
      { title: "Sections", links: [
        { href: "/chess", label: "The study", blurb: "One chess position, read three ways, side by side.", key: true, parts: [
          { href: "/chess#statistical", label: "Statistical model" },
          { href: "/chess#qwen", label: "Qwen" },
          { href: "/chess#maia", label: "Maia" },
          { href: "/chess#compare", label: "Compare" },
          { href: "/chess#game", label: "A full game" },
          { href: "/chess#checks", label: "Checks" },
        ] },
        { href: "/results", label: "Results", blurb: "Held-out results and ablations.", key: true },
        { href: "/methodology", label: "Methods", blurb: "Data, models, metrics and reproducibility.", key: true },
        { href: "/examples", label: "Disagreements", blurb: "Positions where the models disagree most." },
        { href: "/analyze", label: "Analyze a game", blurb: "Run the report on a PGN." },
      ] },
    ]),
  },
  {
    id: "llm", n: 2, label: "LLMs", name: "LatentLens", home: "/latent/professor", plain: "Inside the model",
    question: "When a language model recalls a text it has memorized, where inside the model does the right next word appear?",
    status: "In progress",
    groups: number(2, [
      { title: "Research", links: [
        { href: "/latent/professor", label: "Professor demo", blurb: "The 5 to 7 minute walkthrough: inside Qwen, one real trace, the 14B vs ~27B question.", key: true },
        { href: "/latent/recall", label: "Recall Microscope", blurb: "The correct next word's rank at every layer, recorded on Qwen3-8B-Base.", key: true },
        { href: "/latent/glassbox", label: "Glass Box", blurb: "One real block re-computed from recorded numbers." },
        { href: "/latent/research", label: "Research workspace", blurb: "Layerwise probes, controls, and what is still pending." },
        { href: "/latent/methods", label: "Methods", blurb: "Provenance, precision checks and wording rules." },
      ] },
      { title: "Understand the model", links: [
        { href: "/latent", label: "Transformer Atlas", blurb: "The whole model as one clickable map.", key: true },
        { href: "/latent/demo", label: "Five-step demo", blurb: "From text to next token, step by step." },
        { href: "/latent/learn", label: "Reference notes", blurb: "Architecture facts, checked against the real config." },
        { href: "/latent/project", label: "Project overview", blurb: "How the pieces fit together." },
      ] },
      { title: "Study material", compact: true, links: [
        { href: "/latent/foundations", label: "Foundations", blurb: "Probability, vectors and training from zero." },
        { href: "/latent/build", label: "Build it", blurb: "Code a tiny transformer step by step." },
        { href: "/latent/labs", label: "Labs", blurb: "Hands-on experiments with each mechanism." },
        { href: "/latent/mastery", label: "Mastery path", blurb: "Every mechanism in depth, with practice." },
        { href: "/latent/journey", label: "Guided journey", blurb: "One token's trip through the model." },
        { href: "/latent/story", label: "Storybook", blurb: "The ideas told simply." },
        { href: "/latent/progress", label: "Your route", blurb: "A progress map from foundations to practice." },
        { href: "/latent/review", label: "Daily review", blurb: "Short spaced-repetition questions." },
        { href: "/latent/play", label: "You vs Qwen", blurb: "Guess the next token before the model does." },
        { href: "/latent/security", label: "AI security", blurb: "Threat models and attacks on LLM systems." },
        { href: "/latent/security/labs", label: "Security labs", blurb: "Ten labs on a deterministic simulator." },
      ] },
      { title: "Next step", links: [
        { href: "/latent/proposal", label: "Proposed experiment", blurb: "Explaining the 14B → ~27B recall plateau: from final recall to layerwise recall trajectories.", key: true },
      ] },
    ]),
  },
];

/** The few subsections shown in the header (marked key), in index order; everything else is in the home page's
 *  full index. Phase 2's proposal is the last subsection, so it is also last here. */
export const headerLinks = (p: Phase) => p.groups.flatMap((g) => g.links).filter((l) => l.key);

export function phaseOf(path: string): Phase | null {
  if (path === "/") return null;
  return path.startsWith("/latent") ? PHASES[1] : PHASES[0];
}

export const allLinks = () => PHASES.flatMap((p) => p.groups.flatMap((g) => g.links));
