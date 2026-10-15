# MoveLens — 7-minute demo (+2 minutes of checks if asked)

Open https://chessassistlens.vercel.app. Everything shown is precomputed and served as static files; nothing depends on a live backend.

## Say this first (before clicking anything)

"I ran Qwen3-8B on the demo positions to show the method and to check whether it simply echoes the engine numbers. The full held-out
evaluation hasn't been run yet; it needs a cloud GPU."

## Click path and script

| Time | Click | Say |
|---|---|---|
| 0:00–0:30 | Home page | "MoveLens looks at one chess move three ways. I take the same position and study it with a statistical model, a general-purpose language model and a state-of-the-art human chess model." Point at the three cards. Click **Start the 7-minute demo**. |
| 0:30–2:15 | **1 / 4 Statistical Model**, Example 1 selected (24… h6, rated 1956). Click **Run statistical analysis**. | "I started with the statistical approach because it gives us a classical baseline. This is an independent reconstruction from your public descriptions, not your analyzer, and it is not nearest-neighbor: Stockfish 19 evaluates the position, a model fitted on training games estimates how hard it is, and a rating-by-difficulty table says what to expect. For a 1956 player here, the engine's first move is found only 17% of the time. He played h6, not an engine line, which the model expected 83% of the time, so statistically this move looks normal." |
| 2:15–3:45 | **Next → 2 / 4 Qwen3-8B**. Click **Ask Qwen**. | "Next I asked whether a general-purpose language model has its own move preference. Qwen is not a chess engine. It gets a fixed text description: the FEN, both ratings, Stockfish's top five evaluations and all legal moves. I score every legal move by Qwen's token likelihood and normalize; nothing is generated. Qwen's top three are Qe6, g6, h6, so the human move is its #3. Without the engine lines in the prompt, its top move becomes Qd6 and h6 drops to #11, so much of its preference follows the engine numbers." **Say:** "These Qwen numbers are a precomputed local run of Qwen3-8B-Base on seven demo positions. The held-out Qwen evaluation still needs a cloud GPU and has not been run." |
| 3:45–5:00 | **Next → 3 / 4 Maia-3 79M**. Click **Ask Maia**. | "But I needed a meaningful reference for human behavior, so I added Maia-3, which is designed to predict human moves and conditions on rating. It is a chess transformer, not a language model. Unlike Stockfish, it is not looking for the strongest move. For a 1956 player, Maia's top move is g6 at 45.9%; the played h6 is #2 at 38.6%." Optionally open **Why not Stockfish?** |
| 5:00–6:30 | **Next → 4 / 4 Compare**. Then click **Example 2**, then **Example 3** in the position bar. | "Now the same position through all three: here they broadly agree." **Example 2 (30. Rxg5, rated 2258):** "The player matched Stockfish's first move, which the statistical model expected only 22% of the time, so it reads as unusual. But Maia gives the move 94.9%, its top choice, and Stockfish's best three moves are all equal (−0.44), so the engine match is close to arbitrary. Qwen ranks it #5." **Example 3 (21. Rc7, rated 2288):** "Maia gives the human move 94.9%; Qwen puts it #33 of 34. The important part is when they disagree: these systems measure different properties of the move." |
| 6:30–7:30 | **Next → 5 / 5 Whole game.** Click **20%**, then **40%**; then **Subtle substitutes** at **20%**. | "One move proves nothing; your framework is projected versus actual over a game. In this original game: 13.4 engine matches expected, 14 played, z = +0.20. Replace 20% of the moves with engine first choices: 21 matches, z = +2.60; 40%: z = +5.00. With subtle near-best substitutes at 20%, z stays at +0.55. Random and selective give identical z, because a count cannot see which moves were replaced." Click **Finish: open the checks**. |
| 7:30–9:00 (if asked) | Section **6 Can these numbers be trusted?** | Calibration: on 12,863 held-out human decisions, projected 38.8% engine matches vs 39.3% actual; every bin within 1.7 points. False alarms: 20 of 605 clean games (3.3%) exceed z = 2 vs about 14 under a normal. Power: 20% engine substitution flags 39.7% of games at z > 2, subtle only 6.6%. **Qwen check:** with engine lines Qwen's top move equals Stockfish #1 in 3 of 7 positions, without them 0 of 7, and the human move's median rank goes from 4 to 13: "On these positions the engine numbers drive much of Qwen's ranking, which is exactly why the held-out test asks whether Qwen adds anything beyond them." |
| close | Scroll to **So what am I actually testing?** (in Compare) | "The question is whether the LLM contains useful information not already captured by classical statistical evidence or a specialized human chess model. Each model gives a different signal; the research question is whether combining them adds information. That needs the full held-out Qwen evaluation, which is the next step." Point at **Important limitations**. |

Presenter notes: the **Presenter notes** button in the demo bar shows a one-line prompt for each step (hidden by default).
If asked for depth: **Methods** (top right) → model identifiers, prompt, features, split, bootstrap, provenance, downloads; footer **Full results**.

## Numbers you may quote (all from `apps/web/public/data/movelens_demo.json`)
* Example 1, 24… h6 (1956): statistical P(engine #1) 17.0%, P(what happened) 83.0% → normal; Maia #2, 38.6% (top g6 45.9%); Qwen #3, 14.7% (top Qe6 27.2%).
* Example 2, 30. Rxg5 (2258): engine #1 (top three tied at −0.44); statistical P 22.2% → unusual; Maia #1, 94.9%; Qwen #5, 7.5% (top f3).
* Example 3, 21. Rc7 (2288): not in Stockfish's top 5; statistical 74.3% → normal; Maia #1, 94.9%; Qwen #33 of 34, <0.1% (top g3).
* Whole game (li_aVMHaGzT, Black, 1956, 36 moves): expected 13.4 / actual 14 / z +0.20; engine #1 substitutes 20% → 21 / z +2.60, 40% → 28 / z +5.00; subtle 20% → 15 / z +0.55.
* Checks: calibration 38.8% projected vs 39.3% actual (n = 12,863, max bin gap 1.7 pp); clean z mean +0.02, SD 1.04, 20/605 above 2; 20% engine substitution → 39.7% flagged at z > 2, subtle 6.6%; Maia-3 79M top-1 53.4% (1000–1399) → 58.8% (2200+).
* Qwen engine-echo check (7 demo positions, local): top = engine #1 in 3/7 with engine lines, 0/7 without; median rank of the human move 4 → 13.
* Held-out (Results page): Maia features added +0.047 ROC-AUC [0.040, 0.054] in the earlier hybrid experiment; that is a Maia result, not Qwen.

## Do NOT say
* "KNN statistical model" — the code has no nearest-neighbor search.
* "This is your detector" / "I reproduced your analyzer" — it is a public reconstruction.
* "Qwen detects cheating", "Qwen beats Regan", "Maia detects cheating".
* Anything implying Qwen was evaluated on held-out data, or giving a Qwen accuracy/AUC. Only 7 demo positions were scored, locally.
* That Example 2's player cheated or that its z-score means anything about that player. The source games are presumed human.
* That the Qwen ranking is "live": it is precomputed.
* That the 7-position engine-echo check proves anything general about Qwen; it is a qualitative check that motivates the held-out ablation.
* That "random and selective are indistinguishable" is a flaw of Regan's method; it is a property of a pure match count in this reconstruction.
