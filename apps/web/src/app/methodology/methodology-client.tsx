"use client";

import { AifTech } from "@/components/demo/aif-link";
import { Cite } from "@/components/site/cite";
import { Disclaimer } from "@/components/site/disclaimer";
import { Prov } from "@/components/site/provenance";
import { MoveLensMethods } from "@/components/movelens/methods-summary";
import { ThreeMethodology } from "@/components/three/methodology";
import { ArtifactList, LimitationsPanel } from "@/components/three/summary";
import { useMetrics, useProvenance } from "@/lib/data";
import { FEATURE_TEXT, MODEL_META, SCORE_ORDER, STRATEGY_TEXT } from "@/lib/features";
import { lowFprRows } from "@/lib/findings";
import { AIF_SOURCE, CONTRIBUTION_NOTE, INDEPENDENT_NOTE, REGAN_SOURCE, REGAN_VERIFIED, RELATIONSHIP, SOURCES } from "@/lib/regan";
import { DASH, fmtInt, fmtLevel, fmtNum, fmtPct, isNum } from "@/lib/format";

const TOC = [
  ["movelens", "MoveLens in one minute"],
  ["three", "Model comparison"],
  ["overview", "Overview (hybrid pipeline)"],
  ["pipeline", "Exact pipeline"],
  ["relationship", "Relationship to Regan's work"],
  ["baseline", "Regan-inspired baseline"],
  ["stockfish", "Stockfish"],
  ["maia", "Maia-3"],
  ["eligibility", "Eligible decisions"],
  ["assistance", "Controlled substitutions"],
  ["models", "Features and models"],
  ["hyper", "Hyper-parameters"],
  ["splits", "Train / validation / test isolation"],
  ["evaluation", "Evaluation and uncertainty"],
  ["aif", "AIF"],
  ["limitations", "Limitations"],
  ["repro", "Reproducibility and provenance"],
  ["artifacts", "Research artifacts (downloads)"],
  ["limitations-comparison", "Limitations of the model comparison"],
  ["sources", "Sources"],
  ["independent", "Independent research note"],
] as const;

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-14 mb-4 scroll-mt-24 font-serif text-[23px] font-semibold tracking-tight text-ink first:mt-0">
      {children}
    </h2>
  );
}

function V({ children }: { children: React.ReactNode }) {
  return <span className="tnum font-medium text-ink">{children}</span>;
}

function cp(x: number | undefined) {
  return isNum(x) ? fmtNum(x / 100, 2) : DASH;
}

export function MethodologyClient() {
  const { data: m } = useMetrics();
  const { data: pv } = useProvenance();
  const pb = m?.paired_auc_bootstrap;
  const cfg = m?.config ?? {};
  const an = m?.analysis ?? {};
  const proj = m?.projection ?? {};
  const ds = m?.dataset ?? {};
  const skipMoves = isNum(cfg.opening_skip_plies) ? cfg.opening_skip_plies / 2 : undefined;
  const split = cfg.split_fractions ?? {};
  const versions = m?.versions;
  const hp = m?.hyperparameters ?? {};
  const groups = m?.feature_groups ?? {};
  const groupOf = (f: string) => (["A_stat", "B_sf", "C_sf_maia", "D_sf_maia_seq"] as const).find((g) => groups[g]?.includes(f));
  const allFeatures = groups.D_sf_maia_seq ?? [];

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label="Contents" className="hidden lg:block">
        <div className="sticky top-24">
          <div className="eyebrow mb-3">Contents</div>
          <ol className="space-y-1.5 text-[13px]">
            {TOC.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="text-ink-3 transition-colors duration-150 hover:text-ink">
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </div>
      </nav>

      <article className="prose-lab min-w-0 max-w-[720px] text-[15px]">
        <Disclaimer className="mb-10" />

        <MoveLensMethods H={H} />

        <ThreeMethodology H={H} />

        <H id="overview">Overview of the hybrid pipeline</H>
        <p>
          MoveLens looks at every decision from three complementary views. <strong>Stockfish</strong> says what is
          objectively strong; <strong>Maia-3</strong> gives a model-estimated human plausibility — the predicted probability of
          the move for a player of this rating; a <strong>Regan-inspired statistical projection</strong> (our empirical
          approximation, not Regan&apos;s analyzer) says what we expect overall from this level in these positions. The views
          share inputs, so they are not independent. Logistic/ridge baselines, XGBoost and SHAP fuse them into a score and an
          explanation.
        </p>
        <p>
          Classifier outputs are reported as <em>similarity to controlled synthetic substitution</em>. Regression outputs are a
          <em> synthetic-equivalent assistance intensity</em>: the fraction of eligible decisions that would have to be
          substituted by engine moves to produce a comparable pattern. Neither is a probability that a player cheated.
        </p>
        <p>
          Terminology: <strong>original</strong> (in figures sometimes “clean”) means the game&apos;s own moves with no assistance
          injected by us. These Lichess games are presumed human; that they contain no real assistance is not established.
        </p>
        <p>{CONTRIBUTION_NOTE}</p>

        <H id="pipeline">Exact pipeline</H>
        <ol className="my-4 list-decimal space-y-1.5 pl-5 text-ink-2">
          <li>Select genuine human games: {versions?.data ?? "Lichess open database"}; rated rapid/classical, normal or time-forfeit terminations, both ratings 1000–2699, ≥ 50 plies, one game per player, stratified by Elo band.</li>
          <li>Split original games into train / validation / test by player-connected components (before any variant exists).</li>
          <li>Stockfish MultiPV analysis of every position from move 8 on; Maia-3 policy for every position.</li>
          <li>Build per-decision candidate tables (every MultiPV line plus the played move) and apply the eligibility rule.</li>
          <li>Fit the difficulty model and projection table on original training decisions; estimate κ on original validation games.</li>
          <li>Generate controlled decision-level substitution variants (3 strategies × 5 levels, plus the original) for every player-game.</li>
          <li>Compute nested feature groups A ⊂ B ⊂ C ⊂ D for every variant.</li>
          <li>Train classifiers and regressors on train, early-stop on validation, evaluate once on test; compute SHAP.</li>
          <li>Export the JSON shown on this site; every number on the site is read from that export.</li>
          <li>Post hoc, on the saved test predictions only: paired cluster bootstrap of AUC differences; write the provenance record.</li>
        </ol>

        <H id="relationship">Relationship to Regan&apos;s work</H>
        <p>
          The left column lists only concepts found in Regan&apos;s public materials, each with its source and page. Source:{" "}
          {REGAN_SOURCE} The middle column is what MoveLens actually implements in their place; the right column is new.
          Where the sources differ (the 2026 talk names s, c, h; the user guide names s, c and an equal-value parameter ev), both are
          stated.
        </p>
        <div className="scroll-x my-5">
          <table className="table-lab min-w-[680px] text-[12px]">
            <thead>
              <tr>
                <th className="w-[13%] !whitespace-normal">Topic</th>
                <th className="!whitespace-normal">
                  <Prov kind="regan" short />
                  <div className="mt-1">Documented method (with source)</div>
                </th>
                <th className="!whitespace-normal">
                  <Prov kind="approx" short />
                  <div className="mt-1">Our approximation</div>
                </th>
                <th className="!whitespace-normal">
                  <Prov kind="ours" short />
                  <div className="mt-1">Our addition</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {RELATIONSHIP.map((r) => (
                <tr key={r.topic}>
                  <td className="align-top font-medium text-ink">{r.topic}</td>
                  <td className="align-top text-ink-2">
                    {r.verified} <Cite cites={r.cites} />
                  </td>
                  <td className="align-top text-ink-2">{r.approx}</td>
                  <td className="align-top text-ink-2">{r.addition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details className="my-4 rounded-md border border-rule bg-paper-2 p-4 text-[13.5px]">
          <summary className="cursor-pointer font-medium text-ink">All documented concepts referred to on this site, with sources</summary>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-ink-2">
            {REGAN_VERIFIED.map((c) => (
              <li key={c.key}>
                {c.technical} <Cite cites={c.cites} />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-ink-3">
            Not claimed: that Regan uses Maia-3, XGBoost, SHAP, sequence features, assistance regression or this interface. Regan&apos;s
            equations and calibration are not reproduced anywhere on this site.
          </p>
        </details>

        <H id="baseline">Regan-inspired baseline</H>
        <p>
          This is <strong>not</strong> Kenneth W. Regan&apos;s model. His analyzer scales Multi-PV engine move utilities across
          depths and derives a probability for every legal move from Elo-trained parameters s, c and h{" "}
          <Cite cites={[{ src: "talk", loc: "pp. 10–12" }]} />; his reference calibration is not used here. We use a simpler,
          fully documented empirical projection with the same actual-versus-projected statistical shape:
        </p>
        <ol className="my-4 list-decimal space-y-2 pl-5 text-ink-2">
          <li>
            <strong>Difficulty model.</strong> A logistic regression of P(top-1 match) on Stockfish-only position features and
            the player&apos;s Elo, fitted on original (presumed-human) decisions of the training split only. Position difficulty is one minus
            the predicted top-1 probability.
          </li>
          <li>
            <strong>Projection table.</strong> Cells of Elo band × difficulty decile ({isNum(proj.n_cells) ? <V>{proj.n_cells}</V> : DASH}{" "}
            cells), each holding the mean and variance of top-1 match, EV-style equal-value match, top-3 match and capped move loss among
            training human decisions (cells with fewer than 30 decisions use the pooled difficulty decile).
          </li>
          <li>
            <strong>Projected vs observed.</strong> For a player-game with eligible decisions i = 1…n, projected top-1 = Σ p
            <sub>i</sub> with variance Σ p<sub>i</sub>(1 − p<sub>i</sub>) under independence, and z = (observed − projected) /
            √(κ · variance). The same construction is used for equal-value match (value equal to the best line at our depth — an
            analogue of Regan&apos;s EV-match), top-3 match, unscaled capped move loss (positive z = less loss than projected; this
            is <em>not</em> ASD, which scales differences) and Maia-3 surprisal (expectation = Maia entropy). Top-1 match restricted
            to the hardest third of positions is our difficulty-conditioned statistic; it is not EWN, which is an optional
            position-weighting scheme in Regan&apos;s analyzer (unit weighting is used in most analyses){" "}
            <Cite cites={[{ src: "guide", loc: "pp. 1, 11" }]} />. Accounting for position difficulty is part of Regan&apos;s model
            and is not our contribution <Cite cites={[{ src: "guide", loc: "p. 10" }]} />.
          </li>
        </ol>
        <p>
          κ is a variance-inflation factor estimated on validation original games so that original-game z has unit variance, because
          decisions within one game are not independent. Exported values:{" "}
          {Object.entries(proj.kappa ?? {}).map(([k, v], i) => (
            <span key={k}>
              {i > 0 && ", "}κ<sub>{k}</sub> = <V>{fmtNum(v, 3)}</V>
            </span>
          ))}
          {!proj.kappa && DASH}. Hard and ordinary positions are the top and bottom terciles of training difficulty (thresholds{" "}
          <V>{fmtNum(proj.hard_threshold, 3)}</V> and <V>{fmtNum(proj.easy_threshold, 3)}</V>).
        </p>

        <H id="stockfish">Stockfish</H>
        <p>
          Each analyzed position is searched by <V>{an.engine ?? DASH}</V> at fixed depth <V>{an.depth ?? DASH}</V> with MultiPV{" "}
          <V>{an.multipv ?? DASH}</V>, one thread and a fresh hash per game, so re-analysis is reproducible. Scores are in
          centipawns from the side to move, mate scores are mapped to a large constant, and evaluations are clipped to ±
          <V>{cp(cfg.eval_cap_cp)}</V> pawns before losses are computed. Plies beyond <V>{fmtInt(cfg.max_analyzed_ply)}</V> are not
          analyzed.
        </p>
        <p>
          If the played move is outside the MultiPV list, its evaluation is taken as minus the best evaluation of the resulting
          position (same depth), capped to be no better than the last listed line, and its rank is <em>censored</em> as{" "}
          {isNum(an.multipv) ? (
            <>
              <V>{an.multipv + 1}</V>+ (shown as “{an.multipv + 1}+”)
            </>
          ) : (
            "K+1"
          )}
          .
        </p>

        <H id="maia">Maia-3</H>
        <p>
          Maia-3 is a family of Chessformer-based transformer models for rating-conditioned human move prediction — an
          encoder-only transformer over board squares, not a language model{" "}
          <Cite cites={[{ src: "chessformer" }, { src: "maiaRepo" }]} />. The model used here is <V>{an.maia_model ?? DASH}</V>{" "}
          (checkpoint {versions?.maia3_checkpoint ?? DASH}
          {pv?.checkpoint?.revision ? <>, revision <V>{pv.checkpoint.revision.slice(0, 7)}</V></> : null}), whose model card
          states it was trained on Lichess human games from January 2023 to July 2025 <Cite cites={[{ src: "maiaCard" }]} />;
          our games are from August 2026.
        </p>
        <p>
          It is run through the official CSSLab inference package (commit {versions?.maia3_commit?.slice(0, 7) ?? DASH}),
          reproducing the input construction of the official UCI engine in history mode: the current position plus up to seven
          previous positions, conditioned on the side-to-move Elo and the opponent Elo. Instead of the top-k moves exposed by the
          UCI interface, the policy logits are read directly, giving a predicted probability for every legal move. The predicted
          probability, Maia rank and surprisal (−ln p, in nats) of the chosen move are exact model outputs. They are model
          estimates — “Maia assigns a predicted probability of 0.3%” — not observed frequencies of players.
        </p>

        <H id="eligibility">Eligible decisions</H>
        <p>A player decision (one ply by that player) is eligible if and only if all of the following hold:</p>
        <ol className="my-4 list-decimal space-y-1.5 pl-5 text-ink-2">
          <li>
            it is not in the opening: the first <V>{skipMoves ?? DASH}</V> moves per side (<V>{cfg.opening_skip_plies ?? DASH}</V>{" "}
            plies) are skipped as book-like;
          </li>
          <li>the side to move has at least two legal moves (the move is not forced);</li>
          <li>
            the game is not already decided: |Stockfish evaluation before the move| ≤ <V>{cp(cfg.decided_eval_cp)}</V> pawns;
          </li>
          <li>Stockfish returned at least two principal variations.</li>
        </ol>
        <p>
          A quick depth-<V>{cfg.prefilter_depth ?? DASH}</V> single-line search is run first; positions beyond ±
          <V>{cp(cfg.prefilter_decided_cp)}</V> pawns are treated as decided, only the quick line is stored and the decision is
          ineligible. A move is near-optimal if it is within <V>{cfg.near_optimal_cp ?? DASH}</V> cp of the best line.
        </p>

        <H id="assistance">Controlled decision-level substitutions</H>
        <p className="rounded-md border border-rule bg-paper-2 px-4 py-3 text-ink">
          Alternative moves are evaluated in the original positions. Later positions remain those of the original game; these are
          not replayed assisted games.
        </p>
        <p>
          The unit is a <em>player-game</em>: one player&apos;s n eligible decisions in one game. For a nominal level α in{" "}
          {(cfg.levels ?? ds.levels ?? []).map((l) => fmtLevel(l)).join(", ") || DASH}, m = max(1, round(α·n)) decisions are
          substituted (for α &gt; 0): at each, a different, engine-chosen move is analyzed in place of the original game move. A
          decision where the original move already is the engine&apos;s choice cannot be substituted. If fewer than m decisions
          are substitutable, all are substituted. The <strong>ground truth</strong> is the intervention label (substituted variant
          or original) and the <strong>realized substituted fraction</strong> α = (number substituted) / n, which is also the
          regression target.
        </p>
        <dl className="my-5 space-y-3 border-l-2 border-rule pl-4 text-[14px]">
          {(["random", "selective", "subtle"] as const).map((s) => (
            <div key={s}>
              <dt className="font-medium text-ink">{STRATEGY_TEXT[s].name}</dt>
              <dd className="text-ink-2">
                {s === "subtle" ? (
                  <>
                    Substitute a move drawn uniformly from Stockfish&apos;s top-3 lines within <V>{cfg.subtle_max_loss_cp ?? DASH}</V>{" "}
                    cp of the best line, excluding the human move; alterable decisions are those with such an option; choose m
                    uniformly at random.
                  </>
                ) : s === "selective" ? (
                  <>
                    Same alterable set and substitute as Random, but choose the m decisions with the highest position difficulty
                    (1 − projected top-1 probability for this Elo).
                  </>
                ) : (
                  <>
                    Alterable = decisions where the human move is not Stockfish&apos;s #1; choose m uniformly at random and
                    substitute Stockfish&apos;s #1.
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>
        <p>
          Selections are <strong>nested</strong> across levels: the 10% set contains the 5% set, and so on. Every move-level
          feature of a variant is an exact function of the original Stockfish and Maia-3 analyses. The synthetic-equivalent
          assistance intensity estimated from these variants is a resemblance measure on this benchmark; it is distinct from, and
          not convertible into, a probability of cheating.
        </p>

        <H id="models">Features and models</H>
        <p>Four nested feature groups; each model sees everything the previous one saw.</p>
        <div className="scroll-x my-4">
          <table className="table-lab min-w-[520px]">
            <thead>
              <tr>
                <th>Model</th>
                <th>Adds</th>
                <th className="r">Features</th>
                <th>Learner</th>
              </tr>
            </thead>
            <tbody>
              {SCORE_ORDER.map((k) => (
                <tr key={k}>
                  <td className="text-ink">
                    <span className="num mr-1.5 text-ink-3">{MODEL_META[k].code}</span>
                    {m?.experiments[k]?.label ?? MODEL_META[k].name}
                  </td>
                  <td className="text-ink-2">{MODEL_META[k].role}</td>
                  <td className="r num">{m?.experiments[k]?.n_features ?? DASH}</td>
                  <td className="text-ink-2">{m?.experiments[k]?.model ?? (k === "A0_zt1" ? "none (statistic)" : DASH)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Each learned model has a classifier (original vs substituted) and a regressor (realized α). Hyper-parameters are fixed
          in advance; early stopping uses the validation split only. Game-level SHAP values explain both. A separate
          decision-level XGBoost model scores individual decisions for resemblance to a substitution and is used only to rank and
          explain moves; its per-move SHAP values are not a decomposition of the game-level classifier.
        </p>

        <details className="my-4 rounded-md border border-rule bg-paper-2 p-4 text-[13.5px]">
          <summary className="cursor-pointer font-medium text-ink">Feature definitions ({allFeatures.length} features)</summary>
          <div className="scroll-x mt-3">
            <table className="table-lab min-w-[560px] text-[12.5px]">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Definition</th>
                  <th>First enters</th>
                </tr>
              </thead>
              <tbody>
                {allFeatures.map((f) => {
                  const g = groupOf(f);
                  return (
                    <tr key={f}>
                      <td className="num text-ink">{f}</td>
                      <td className="text-ink-2">{FEATURE_TEXT[f] ?? f}</td>
                      <td className="text-ink-3">{g ? `${MODEL_META[g].code} · ${MODEL_META[g].role}` : DASH}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>

        <H id="hyper">Hyper-parameters</H>
        <p>Fixed before evaluation; read from the training scripts at export time.</p>
        <div className="scroll-x my-4">
          <table className="table-lab min-w-[520px] text-[12.5px]">
            <tbody>
              {Object.entries(hp).map(([k, v]) => (
                <tr key={k}>
                  <td className="w-[30%] align-top text-ink">{k.replace(/_/g, " ")}</td>
                  <td className="num align-top break-words text-ink-2">
                    {typeof v === "object" && v !== null
                      ? Array.isArray(v)
                        ? v.join(", ")
                        : Object.entries(v as Record<string, unknown>).map(([a, b]) => `${a}=${String(b)}`).join(" · ")
                      : String(v)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <H id="splits">Train / validation / test isolation</H>
        <p>
          Original games are split <strong>before</strong> any synthetic variant exists. Games are grouped into connected
          components of the graph “two games are linked if they share a player name”, and whole components are assigned to a
          split (train <V>{fmtPct(split.train, 0)}</V>, validation <V>{fmtPct(split.val, 0)}</V>, test <V>{fmtPct(split.test, 0)}</V>
          , seed <V>{cfg.seed ?? DASH}</V>). No game and no player appears in more than one split, and variants inherit the split
          of their source game. Automated leakage tests check these invariants.
        </p>
        <p>
          Test units are nested and must not be read as independent samples:{" "}
          {pv?.splits?.games_assigned?.test !== undefined && (
            <>
              <V>{fmtInt(pv.splits.games_assigned.test)}</V> games were assigned to test, of which{" "}
            </>
          )}
          <V>{fmtInt(ds.n_source_games?.test)}</V> source games contribute <V>{fmtInt(ds.n_player_games?.test)}</V> original
          player-games (players with ≥ 10 eligible decisions), which yield{" "}
          <V>{isNum(ds.n_variants?.test) && isNum(ds.n_player_games?.test) ? fmtInt(ds.n_variants.test - ds.n_player_games.test) : DASH}</V>{" "}
          injected variants — <V>{fmtInt(ds.n_variants?.test)}</V> test rows including the originals. All intervals resample
          whole source games.
        </p>

        <H id="evaluation">Evaluation and uncertainty</H>
        <ul className="my-4 list-disc space-y-1.5 pl-5 text-ink-2">
          <li>Classes are balanced by sample weights in training and in ROC-AUC, PR-AUC and Brier on the test split.</li>
          <li>
            Operating thresholds for a target false-positive rate (1%, 5%) are chosen on <em>validation</em> original scores;
            recall (TPR) and the realized FPR are then measured on test, and the realized FPR differs by system:{" "}
            {m
              ? lowFprRows(m)
                  .map((r) => `${MODEL_META[r.key].code} ${fmtPct(r.recall, 1)} at ${fmtPct(r.testFpr, 1)}`)
                  .join(" · ")
              : DASH}{" "}
            (1% target). Recall at different realized FPRs does not rank systems.
          </li>
          <li>Each system&apos;s ROC-AUC interval is a 95% cluster bootstrap (200 resamples of test source games).</li>
          <li>
            Incremental differences between nested systems are tested with a <strong>paired</strong> cluster bootstrap
            {pb ? ` (${fmtInt(pb.n_boot)} resamples of ${fmtInt(pb.n_clusters)} source games, seed ${pb.seed})` : ""}: each
            resample of source games is applied to both systems&apos; saved held-out predictions, and the 2.5/97.5 percentiles of the
            AUC difference form the interval (experiments/09_paired_bootstrap.py). This is post hoc, without refitting or tuning,
            without multiplicity correction, and it does not capture variation from refitting the models.
            {!pb && " Not present in this export: paired differences were not tested."}
          </li>
          <li>
            Overlapping individual intervals do not show that there is no gain, and non-overlapping individual intervals are a
            visual comparison, not a paired difference test. The site uses the paired interval for statistical statements and
            reports numerical changes separately.
          </li>
          <li>
            Per-cell results compare all original test player-games with the substituted variants of one strategy and level.
          </li>
          <li>The Regan-inspired z(top-1) (A0) uses no labels at all.</li>
          <li>
            Baseline z-statistics are described on original held-out games by mean, SD and tail shares. Mean ≈ 0 and SD ≈ 1 are
            largely implied by how κ is estimated and do not validate normal tails: z(top-1, hard positions) exceeds 3 for{" "}
            {fmtPct(m?.baseline_calibration?.z_t1_hard?.frac_gt3, 2)} of original test player-games versus{" "}
            {fmtPct(m?.baseline_calibration?.z_t1_hard?.normal_frac_gt3, 2)} under N(0,1).
          </li>
          <li>
            Pseudo-events (expert detail only) pool k games by k <em>different</em> players of one Elo band. This exploratory
            analysis does not validate longitudinal detection for a single player.
          </li>
        </ul>

        <H id="aif">AIF (Analysis Interchange Format)</H>
        <p>
          <strong>In plain terms:</strong> AIF stores the chess game together with detailed engine analysis for each position.
        </p>
        <p>
          <strong>Technically:</strong> an AIF file is a PGN-compatible game with extra tags (engine ID and settings, threads,
          hash, MultiPV, depth range), followed by one block per move with the FEN, legal moves, engine evaluations by depth,
          MultiPV candidates and the principal variation. It is the input format of Regan&apos;s IR analyzer (
          <a className="underline" href={AIF_SOURCE.href} target="_blank" rel="noreferrer">
            {AIF_SOURCE.text}
          </a>
          ). MoveLens stores its analysis as JSON/Parquet and offers an{" "}
          <strong>experimental AIF-compatible export</strong>; compatibility with Regan&apos;s current analyzer has not been tested.
        </p>
        <AifTech />

        <H id="limitations">Limitations</H>
        <ul className="my-4 list-disc space-y-2 pl-5 text-ink-2">
          <li>
            Decision-level substitution does not re-simulate the game: an engine move is judged in the original position, and the
            opponent&apos;s later moves are those of the real game.
          </li>
          <li>
            The same engine and depth are used for analysis and for constructing assistance. This inflates top-1 matching for
            Random and Selective (the substitute is by definition the analysis engine&apos;s first choice); a real assistant may
            use a different engine, depth or time.
          </li>
          <li>Games are online rapid Lichess games, not over-the-board play; behaviour and time pressure differ.</li>
          <li>
            Per-game samples are small{isNum(ds.mean_decisions_per_player_game) && (
              <> (mean <V>{fmtNum(ds.mean_decisions_per_player_game, 1)}</V> eligible decisions per player-game)</>
            )}
            , so single-game scores are noisy. Every player contributes one game, so nothing here validates detection across a
            single player&apos;s games.
          </li>
          <li>
            Original games are presumed human, not verified clean; undetected real assistance would make them look more
            engine-like and reduce measured separation.
          </li>
          <li>
            Maia-3 was trained on Lichess games (January 2023 – July 2025, per its model card) — the same platform as our August
            2026 test games, but an earlier period; behaviour elsewhere, e.g. over the board, may differ.
          </li>
          <li>
            The baseline&apos;s upper tail is heavier than normal for the hard-position statistic, so fixed z thresholds would
            over-flag original games; tail estimates rest on a few games.
          </li>
          <li>Our statistical baseline is an empirical approximation. Nothing here compares against, or claims to outperform, Regan&apos;s actual analyzer.</li>
          <li>
            Scores measure similarity to these controlled synthetic patterns only. They are not evidence that a real player
            cheated and must not be used for adjudication.
          </li>
        </ul>

        <H id="repro">Reproducibility and provenance</H>
        <p>
          Everything below is read from <code>provenance.json</code> (experiments/10_provenance.py), which records only what can be
          checked on disk. Fields that could not be established are marked as such rather than filled in. Reproduction has not
          been re-run end to end for this record.
        </p>
        <div className="scroll-x my-4">
          <table className="table-lab min-w-[480px] text-[12.5px]">
            <tbody>
              {(
                [
                  ["Repository / commit", pv?.repository?.commit ? `${pv.repository.url ?? "local"} @ ${pv.repository.commit.slice(0, 12)}` : `not available — ${pv?.repository?.note ?? "no commit recorded"}`],
                  ["Run ID", pv?.run_id?.value ?? `not recorded — ${pv?.run_id?.note ?? ""}`],
                  [
                    "Data selection",
                    pv?.dataset_selection
                      ? `${pv.dataset_selection.source_url} · bytes ${pv.dataset_selection.byte_range} (${fmtInt(pv.dataset_selection.raw_file_bytes)} bytes on disk${pv.dataset_selection.raw_file_bytes_matches_range ? ", matches range" : ", DOES NOT match range"}) · ${fmtInt(pv.dataset_selection.n_games_selected)} games selected (${Object.entries(pv.dataset_selection.games_by_band ?? {}).map(([b, n]) => `${b}: ${n}`).join(", ")}) · rules: ${(pv.dataset_selection.rules ?? []).join("; ")}`
                      : versions?.data ?? DASH,
                  ],
                  [
                    "Split counts",
                    pv?.splits
                      ? (["train", "val", "test"] as const)
                          .map(
                            (s) =>
                              `${s}: ${fmtInt(pv.splits?.games_assigned?.[s])} games assigned → ${fmtInt(pv.splits?.source_games_with_player_games?.[s])} source games → ${fmtInt(pv.splits?.player_games?.[s])} player-games → ${fmtInt(pv.splits?.injected_variants?.[s])} injected variants (${fmtInt(pv.splits?.rows_including_originals?.[s])} rows)`,
                          )
                          .join(" · ")
                      : DASH,
                  ],
                  ["Engine", `${an.engine ?? DASH} · depth ${an.depth ?? DASH} · MultiPV ${an.multipv ?? DASH} · Threads 1 · Hash 64 MB · fresh hash per game${pv?.engine?.binary_sha256 ? ` · binary SHA-256 ${pv.engine.binary_sha256.slice(0, 16)}…` : ""}`],
                  [
                    "Human model",
                    `${an.maia_model ?? DASH} (${versions?.maia3_checkpoint ?? DASH}${pv?.checkpoint?.revision ? ` @ ${pv.checkpoint.revision.slice(0, 12)}` : ", revision not recorded"}) · CSSLab/maia3 @ ${versions?.maia3_commit?.slice(0, 7) ?? DASH}`,
                  ],
                  ...Object.entries(versions ?? {})
                    .filter(([k]) => !["maia3_commit", "maia3_checkpoint", "data"].includes(k))
                    .map(([k, v]) => [k.replace(/_/g, "-"), v]),
                  ["Environment lockfile", pv?.environment ? `${pv.environment.lockfile} (SHA-256 ${pv.environment.lockfile_sha256?.slice(0, 16) ?? DASH}…) — ${pv.environment.note ?? ""}` : DASH],
                  ["Random seed", String(cfg.seed ?? DASH)],
                  [
                    "Determinism",
                    "On 2026-10-04 the live-analysis code path, run in the research environment (Windows), reproduced every game-level score and intensity estimate of the prepared original study within 5 × 10⁻⁷ (the export is rounded to 6 decimals). The Linux container was not re-checked in that pass.",
                  ],
                  ["Export timestamps (UTC)", (pv?.files ?? []).filter((f) => /metrics\.json|test_predictions|paired_bootstrap/.test(f.path)).map((f) => `${f.path}: ${f.modified_utc}`).join(" · ") || DASH],
                  ["Record generated", pv?.generated_utc ?? DASH],
                  ["Code", "experiments/01–10 scripts; services/analyzer package; tests/ (leakage, generator, PGN, AIF, features)"],
                ] as [string, string][]
              ).map(([k, v]) => (
                <tr key={k}>
                  <td className="w-[24%] align-top text-ink">{k}</td>
                  <td className="num align-top break-words text-ink-2">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pv?.consistency_checks && (
          <>
            <p className="mt-4 font-medium text-ink">Consistency checks (recomputed when the record is written)</p>
            <ul className="my-2 list-disc space-y-1 pl-5 text-[13.5px] text-ink-2">
              {pv.consistency_checks.map((c) => (
                <li key={c.name}>
                  <span className={c.passed ? "text-ink" : "font-semibold text-flag"}>{c.passed ? "Passed" : "FAILED"}</span> — {c.name}: {c.detail}
                </li>
              ))}
            </ul>
          </>
        )}
        {pv?.commands && (
          <details className="my-4 rounded-md border border-rule bg-paper-2 p-4 text-[13px]">
            <summary className="cursor-pointer font-medium text-ink">Commands to regenerate the results</summary>
            <pre className="scroll-x mt-3 text-[12px] leading-relaxed text-ink-2">{pv.commands.join("\n")}</pre>
            <p className="mt-2 text-[12px] text-ink-3">Listed from the repository; not re-run end to end for this record.</p>
          </details>
        )}
        {pv?.caveats && (
          <ul className="my-2 list-disc space-y-1 pl-5 text-[13px] text-ink-3">
            {pv.caveats.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        )}

        <H id="artifacts">Research artifacts</H>
        <p>Every displayed result maps to one of these machine-readable files, written by the listed script; the JSON files carry their own generator, timestamp and plan hash.</p>
        <ArtifactList />

        <H id="limitations-comparison">Limitations of the model comparison</H>
        <LimitationsPanel id="limitations-three" />

        <H id="sources">Sources</H>
        <p>Every external statement on this site cites one of these. Each document was retrieved and read; page numbers refer to the PDF.</p>
        <ol className="my-4 list-decimal space-y-2 pl-5 text-[13.5px] text-ink-2">
          {Object.values(SOURCES).map((s) => (
            <li key={s.key}>
              {s.text}{" "}
              <a className="break-all underline underline-offset-2" href={s.href} target="_blank" rel="noreferrer">
                {s.href}
              </a>
            </li>
          ))}
        </ol>
        <p className="text-[12.5px] text-ink-3">
          Not sourced, and therefore not claimed: whether EWN or any particular setting is used in a given official analysis,
          and any performance comparison with Regan&apos;s analyzer.
        </p>

        <H id="independent">Independent research note</H>
        <p>{INDEPENDENT_NOTE}</p>
      </article>
    </div>
  );
}
