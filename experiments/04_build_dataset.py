"""Build the leakage-safe controlled-assistance dataset.

Order of operations (matters for leakage):
  1. split ORIGINAL games (player-disjoint components)       -> splits.json
  2. join Stockfish + Maia into decisions
  3. fit the projection / difficulty model on TRAIN clean decisions only
  4. calibrate z-score variance inflation on VAL clean player-games only
  5. generate synthetic variants for every player-game (variants inherit their source split)
  6. compute features for every variant                       -> variants.parquet
"""

from __future__ import annotations

import json
import pickle
import sys
import time
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services"))
from analyzer import config  # noqa: E402
from analyzer.features.aggregate import decision_series, maia_raw  # noqa: E402
from analyzer.features.decisions import build_game_decisions  # noqa: E402
from analyzer.models.projection import ProjectionModel  # noqa: E402
from analyzer.pipeline import (MIN_DECISIONS, attach_expectations, decisions_frame,  # noqa: E402
                               player_game_features, player_games)
from analyzer.synthetic.assist import make_variants  # noqa: E402
from analyzer.synthetic.splits import assign_splits, check_no_leakage  # noqa: E402


def main():
    t0 = time.time()
    config.PROCESSED.mkdir(parents=True, exist_ok=True)
    config.ARTIFACTS.mkdir(parents=True, exist_ok=True)
    games = [json.loads(l) for l in (config.INTERIM / "games.jsonl").read_text(encoding="utf-8").splitlines()]
    # keep only games with both analyses available
    games = [g for g in games if (config.INTERIM / "sf" / f"{g['game_id']}.json").exists()
             and (config.INTERIM / "maia" / f"{g['game_id']}.json").exists()]
    print("games with SF+Maia:", len(games))

    # 1. split before anything else
    split = assign_splits(games)
    problems = check_no_leakage(games, split)
    assert not problems, problems[:5]
    (config.PROCESSED / "splits.json").write_text(json.dumps(split, indent=0))
    print("split sizes:", pd.Series(split).value_counts().to_dict())

    # 2. decisions
    all_decs: dict[str, list[dict]] = {}
    for g in games:
        sf = json.loads((config.INTERIM / "sf" / f"{g['game_id']}.json").read_text())["analysis"]
        mp = json.loads((config.INTERIM / "maia" / f"{g['game_id']}.json").read_text())["policies"]
        maia = {int(k): v for k, v in mp.items()}
        all_decs[g["game_id"]] = build_game_decisions(g, sf, maia)
    print(f"decisions built ({time.time() - t0:.0f}s)")

    # 3. projection fit on TRAIN clean eligible decisions
    train_decs = [d for gid, ds in all_decs.items() if split[gid] == "train" for d in ds if d["eligible"]]
    proj = ProjectionModel().fit(decisions_frame(train_decs))
    print("projection fitted on", len(train_decs), "train decisions")
    for ds in all_decs.values():
        attach_expectations([d for d in ds if d["eligible"]], proj)

    pgs = player_games([d for ds in all_decs.values() for d in ds])
    pgs = {k: v for k, v in pgs.items() if len(v) >= MIN_DECISIONS}

    # 4. kappa from VAL clean player-games
    raw, mraw = [], []
    for (gid, color), decs in pgs.items():
        if split[gid] != "val":
            continue
        ch = [d["played_idx"] for d in decs]
        s = decision_series(decs, ch)
        raw.append(proj.raw_stats(s["top1"], s["top3"], s["loss"], s["p_t1"], s["p_t3"], s["mu_loss"],
                                  s["var_loss"], s["difficulty"], ev=s["ev"], p_ev=s["p_ev"]))
        mraw.append(maia_raw(s))
    proj.calibrate_kappa(raw, mraw)
    print("kappa (variance inflation, val clean):", {k: round(v, 3) for k, v in proj.kappa.items()})
    proj.save(config.ARTIFACTS / "projection.json")

    # 5+6. variants + features
    gmeta = {g["game_id"]: g for g in games}
    rows, choices = [], {}
    for (gid, color), decs in pgs.items():
        g = gmeta[gid]
        key = f"{gid}:{color}"
        for v in make_variants(decs, key):
            vid = f"{key}:{v['strategy']}:{int(round(v['level'] * 100))}"
            f = player_game_features(decs, v["choice"], proj)
            rows.append({
                "variant_id": vid, "game_id": gid, "color": color,
                "player": g["white"] if color == "white" else g["black"],
                "split": split[gid], "band": config.elo_band(decs[0]["elo"]),
                "strategy": v["strategy"], "level": v["level"], "realized_alpha": v["realized_alpha"],
                "n_altered": int(sum(v["altered"])), "label": int(v["level"] > 0), **f,
            })
            choices[vid] = {"plies": [d["ply"] for d in decs], "choice": v["choice"], "altered": v["altered"]}
    df = pd.DataFrame(rows)
    leak = check_no_leakage(games, split, list(zip(df["game_id"], df["split"])))
    assert not leak, leak[:5]
    df.to_parquet(config.PROCESSED / "variants.parquet", index=False)
    with open(config.PROCESSED / "variant_choices.pkl", "wb") as fh:
        pickle.dump(choices, fh)
    with open(config.PROCESSED / "decisions.pkl", "wb") as fh:
        pickle.dump(all_decs, fh)
    print("variants:", len(df), "player-games:", len(pgs))
    print(df.groupby(["split", "strategy"]).size().unstack(fill_value=0))
    print(f"done in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
