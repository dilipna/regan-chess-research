"""End-to-end structural test of the research pipeline on Qwen3-0.6B-Base with a tiny synthetic fixture.

The fixture texts are written here for testing only (labels are arbitrary but learnable). Nothing produced by this test
is a research result; everything is written to a temporary directory.
"""

import json
import subprocess
import sys
from pathlib import Path

import pytest

np = pytest.importorskip("numpy")
pytest.importorskip("sklearn")
pytest.importorskip("transformers")

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts" / "latentlens"

HUMAN = ["i went to the market yesterday and the apples were bad again, so i came home with pears instead",
         "honestly no idea why the bus was late. waited forty minutes in the rain. classic tuesday",
         "my grandmother kept bees for thirty years and never once wore gloves",
         "the printer jammed twice before lunch and then worked fine all afternoon",
         "we lost the match 3-1 but the second half was the best we've played all season",
         "can't find my keys. checked the fridge. don't ask",
         "the river froze early this year and the kids skated on it until the thaw",
         "dinner was late because the oven decided today was the day to stop working"]
AI = ["In conclusion, effective time management is essential for achieving both personal and professional goals.",
      "Furthermore, it is important to note that sustainable practices can significantly enhance long-term outcomes.",
      "Overall, this comprehensive approach ensures that stakeholders remain engaged throughout the process.",
      "Additionally, leveraging innovative solutions can foster collaboration and drive meaningful change.",
      "In summary, understanding these key factors empowers individuals to make informed decisions.",
      "Moreover, a holistic perspective allows organizations to navigate complex challenges with confidence.",
      "Ultimately, prioritizing well-being contributes to a more balanced and fulfilling lifestyle.",
      "It is worth noting that clear communication plays a pivotal role in successful teamwork."]


def _fixture(path: Path, overlap: bool = False):
    rows = []
    for split, k in (("train", 0), ("val", 1), ("test", 2)):
        for i in range(8):
            j = (i + 3 * k) % 8
            rows.append({"id": f"{split}-h{i}", "text": HUMAN[j] + f" ({split} {i})", "label": "human", "split": split, "domain": "fixture"})
            rows.append({"id": f"{split}-a{i}", "text": AI[j] + f" ({split} {i})", "label": "ai", "split": split,
                         "generator": "fixture-gen-" + "ab"[i % 2], "domain": "fixture"})
    if overlap:
        rows.append({**rows[0], "split": "test"})
    path.write_text("".join(json.dumps(r) + "\n" for r in rows), encoding="utf-8")


def _run(*args):
    r = subprocess.run([sys.executable, *map(str, args)], capture_output=True, text=True, encoding="utf-8", errors="replace", cwd=ROOT,
                       env={**__import__("os").environ, "PYTHONIOENCODING": "utf-8", "HF_HUB_DISABLE_SYMLINKS_WARNING": "1"})
    assert r.returncode == 0, r.stdout[-2000:] + r.stderr[-4000:]
    return r.stdout


@pytest.fixture(scope="module")
def reps(tmp_path_factory, small_model_id):
    d = tmp_path_factory.mktemp("ll")
    ds = d / "fixture.jsonl"
    _fixture(ds)
    out = d / "reps"
    for split in ("train", "val", "test"):
        _run(SCRIPTS / "extract_hidden_states.py", "--model", small_model_id, "--dataset", ds, "--dataset-format", "jsonl",
             "--split", split, "--loader", "full", "--device", "cpu", "--dtype", "float32", "--store-dtype", "float32",
             "--batch-size", "4", "--chunk-size", "6", "--max-tokens", "32", "--depths", "0,7,14,21,28",
             "--component-layers", "6,27", "--out", out, "--local-files-only")
    return d, out


def test_extraction_shapes_and_metadata(reps):
    _, out = reps
    run = json.loads((out / "run.json").read_text())
    cfg = run["config"]
    assert cfg["depths"] == [0, 7, 14, 21, 28] and cfg["component_layers"] == [6, 27]
    for split in ("train", "val", "test"):
        s = out / split
        meta = [json.loads(l) for l in (s / "meta.jsonl").read_text().splitlines()]
        assert len(meta) == 16 and len({m["id"] for m in meta}) == 16
        for k in ("id", "label", "generator", "domain", "source", "split", "n_chars", "n_tokens", "text_sha1"):
            assert k in meta[0]
        for pooling in ("mean", "last"):
            a = np.load(s / f"resid_{pooling}.npy")
            assert a.shape == (16, 5, cfg["hidden_size"]) and np.isfinite(a).all()
        assert np.load(s / "resid_rms.npy").shape == (16, 5)
        assert np.load(s / "comp_attn_norm.npy").shape == (16, 2, cfg["hidden_size"])
        assert np.isfinite(np.load(s / "nll.npy")).all()
        assert np.load(s / "stylometry.npy").shape[0] == 16


def test_no_duplicate_ids_or_texts_across_splits(reps):
    sys.path.insert(0, str(SCRIPTS))
    from latentlens.data import check_splits
    _, out = reps
    metas = {s: [json.loads(l) for l in (out / s / "meta.jsonl").read_text().splitlines()] for s in ("train", "val", "test")}
    assert check_splits(metas)["leakage_free"]


def test_resume_skips_finished_chunks_and_is_reproducible(reps, small_model_id):
    d, out = reps
    before = np.load(out / "val" / "resid_mean.npy")
    stamp = {p.name: p.stat().st_mtime for p in (out / "val" / "chunks").glob("*.npz")}
    _run(SCRIPTS / "extract_hidden_states.py", "--model", small_model_id, "--dataset", d / "fixture.jsonl", "--dataset-format",
         "jsonl", "--split", "val", "--loader", "full", "--device", "cpu", "--dtype", "float32", "--store-dtype", "float32",
         "--batch-size", "4", "--chunk-size", "6", "--max-tokens", "32", "--depths", "0,7,14,21,28",
         "--component-layers", "6,27", "--out", out, "--local-files-only")
    assert {p.name: p.stat().st_mtime for p in (out / "val" / "chunks").glob("*.npz")} == stamp
    np.testing.assert_array_equal(before, np.load(out / "val" / "resid_mean.npy"))


def test_streamed_extraction_matches_full(reps, small_model_id, tmp_path):
    d, out = reps
    alt = tmp_path / "stream"
    _run(SCRIPTS / "extract_hidden_states.py", "--model", small_model_id, "--dataset", d / "fixture.jsonl", "--dataset-format",
         "jsonl", "--split", "val", "--loader", "stream", "--device", "cpu", "--dtype", "float32", "--store-dtype", "float32",
         "--batch-size", "3", "--chunk-size", "16", "--max-tokens", "32", "--depths", "0,7,14,21,28",
         "--component-layers", "6,27", "--out", alt, "--local-files-only")
    a, b = np.load(out / "val" / "resid_mean.npy"), np.load(alt / "val" / "resid_mean.npy")
    assert np.abs(a - b).max() / np.abs(a).max() < 1e-4
    np.testing.assert_allclose(np.load(out / "val" / "nll.npy"), np.load(alt / "val" / "nll.npy"), rtol=1e-4)


def test_probes_select_on_validation_and_controls(reps):
    d, out = reps
    lp = d / "layer_probe.json"
    _run(SCRIPTS / "train_layer_probes.py", "--representations", out, "--out", lp, "--cs", "0.1,1", "--random-label-seeds", "2")
    a = json.loads(lp.read_text())
    sys.path.insert(0, str(SCRIPTS))
    from latentlens.schema import validate
    assert validate("layer_probe.json", a) == []
    best = max(a["layers"], key=lambda r: (r["val"]["roc_auc"], -r["depth"]))
    assert a["selected_depth"] == best["depth"]
    assert all("test" not in r for r in a["layers"])
    assert set(a["test"]) == {"selected_depth", "final_depth"}
    assert len(a["controls"]["random_labels"]) == 2
    assert {"length", "token_count", "perplexity", "stylometry"} <= set(a["controls"]["baselines"])
    # same seed -> identical numbers
    lp2 = d / "layer_probe_2.json"
    _run(SCRIPTS / "train_layer_probes.py", "--representations", out, "--out", lp2, "--cs", "0.1,1", "--random-label-seeds", "2")
    b = json.loads(lp2.read_text())
    assert [r["val"]["roc_auc"] for r in a["layers"]] == [r["val"]["roc_auc"] for r in b["layers"]]
    assert a["controls"]["random_labels"] == b["controls"]["random_labels"]


def test_leakage_is_refused(tmp_path, small_model_id):
    ds = tmp_path / "leaky.jsonl"
    _fixture(ds, overlap=True)
    out = tmp_path / "reps"
    for split in ("train", "val", "test"):
        _run(SCRIPTS / "extract_hidden_states.py", "--model", small_model_id, "--dataset", ds, "--dataset-format", "jsonl",
             "--split", split, "--loader", "full", "--device", "cpu", "--dtype", "float32", "--batch-size", "8",
             "--chunk-size", "32", "--max-tokens", "16", "--depths", "0,28", "--component-layers", "none", "--no-nll",
             "--out", out, "--local-files-only")
    r = subprocess.run([sys.executable, SCRIPTS / "train_layer_probes.py", "--representations", out, "--out", tmp_path / "x.json"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace", cwd=ROOT)
    assert r.returncode != 0 and "leakage" in (r.stdout + r.stderr)


def test_rmsnorm_components_and_pca(reps):
    d, out = reps
    sys.path.insert(0, str(SCRIPTS))
    from latentlens.schema import validate
    _run(SCRIPTS / "probe_rmsnorm.py", "--representations", out, "--out", d / "rms.json", "--cs", "1")
    _run(SCRIPTS / "probe_components.py", "--representations", out, "--out", d / "comp.json", "--cs", "1")
    _run(SCRIPTS / "build_pca_artifacts.py", "--representations", out, "--out-dir", d / "pca", "--layer-probe", d / "none.json",
         "--max-points", "5")
    rms = json.loads((d / "rms.json").read_text())
    comp = json.loads((d / "comp.json").read_text())
    assert validate("rmsnorm_probe.json", rms) == [] and validate("component_probe.json", comp) == []
    assert [r["layer"] for r in rms["block_rmsnorm"]] == [6, 27]
    assert {"attention_step", "mlp_step"} <= set(comp["layers"][0])
    idx = json.loads((d / "pca" / "index.json").read_text())
    for e in idx["depths"]:
        p = json.loads((d / "pca" / e["file"]).read_text())
        assert validate(e["file"], p) == [] and p["shown_split"] == "val" and p["fit_split"] == "train"
        assert len(p["points"]) == 10
