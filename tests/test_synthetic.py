import numpy as np

from analyzer import config
from analyzer.synthetic.assist import make_variants, n_altered


def _decs(n=30, seed=0):
    rng = np.random.default_rng(seed)
    out = []
    for j in range(n):
        cands = [{"move": f"m{k}", "sf_rank": k + 1, "cpl": float(k * 12)} for k in range(5)]
        played = int(rng.integers(0, 6))
        if played == 5:
            cands.append({"move": "hx", "sf_rank": 6, "cpl": 150.0})
        out.append({"cands": cands, "played_idx": played, "difficulty": float(rng.random())})
    return out


def test_levels_and_counts():
    decs = _decs()
    vs = make_variants(decs, "k")
    assert len(vs) == 1 + len(config.STRATEGIES) * (len(config.ASSIST_LEVELS) - 1)
    clean = vs[0]
    assert clean["level"] == 0 and not any(clean["altered"])
    assert clean["choice"] == [d["played_idx"] for d in decs]
    for v in vs[1:]:
        m = sum(v["altered"])
        assert m <= n_altered(v["level"], len(decs))
        assert abs(v["realized_alpha"] - m / len(decs)) < 1e-12
        # an altered decision really changes the move; unaltered ones keep the human move
        for d, c, a in zip(decs, v["choice"], v["altered"]):
            assert (c != d["played_idx"]) == a


def test_strategy_rules():
    decs = _decs()
    for v in make_variants(decs, "k")[1:]:
        for d, c, a in zip(decs, v["choice"], v["altered"]):
            if not a:
                continue
            if v["strategy"] in ("random", "selective"):
                assert c == 0                                  # Stockfish #1
            else:
                cand = d["cands"][c]
                assert cand["sf_rank"] <= 3 and cand["cpl"] <= config.SUBTLE_MAX_LOSS_CP


def test_nested_levels():
    decs = _decs(40, 3)
    vs = make_variants(decs, "k")
    for strat in config.STRATEGIES:
        sets = [set(i for i, a in enumerate(v["altered"]) if a) for v in vs if v["strategy"] == strat]
        for a, b in zip(sets, sets[1:]):
            assert a <= b


def test_selective_targets_difficult_positions():
    decs = _decs(60, 5)
    vs = {(v["strategy"], v["level"]): v for v in make_variants(decs, "k")}
    sel = vs[("selective", 0.2)]
    rnd = vs[("random", 0.2)]
    d_sel = np.mean([d["difficulty"] for d, a in zip(decs, sel["altered"]) if a])
    d_rnd = np.mean([d["difficulty"] for d, a in zip(decs, rnd["altered"]) if a])
    assert d_sel > d_rnd


def test_deterministic():
    a = make_variants(_decs(), "same")
    b = make_variants(_decs(), "same")
    assert [v["choice"] for v in a] == [v["choice"] for v in b]
