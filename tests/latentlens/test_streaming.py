"""The layer-streaming runner must reproduce the ordinary full forward pass, and hooks must read the right tensors.

Runs on Qwen3-0.6B-Base (28 layers, tied embeddings) in float32 on CPU. This is a pipeline check, not a Qwen3-8B result.
"""

import pytest

torch = pytest.importorskip("torch")
pytest.importorskip("transformers")

from latentlens.adapter import Qwen3Adapter, make_batches  # noqa: E402
from latentlens.capture import SITES, PooledStore, count_hooks  # noqa: E402

TEXTS = ["The researcher opened the notebook", "Four score and seven years ago our fathers brought forth",
         "A short one."]


@pytest.fixture(scope="module")
def adapters(small_model_id):
    full = Qwen3Adapter(small_model_id, device="cpu", dtype="float32", loader="full", local_files_only=True)
    full.load_model()
    stream = Qwen3Adapter(small_model_id, device="cpu", dtype="float32", loader="stream", local_files_only=True)
    stream.load_model()
    yield full, stream
    full.cleanup()
    stream.cleanup()


def _token_lists(a):
    return [[a.doc_prefix_id] + a.tokenize(t) for t in TEXTS]


class PerToken:
    """Keeps full per-token tensors (tests only)."""
    def __init__(self):
        self.store = {}

    def __call__(self, site, layer, h, batch):
        for r, gi in enumerate(batch.index):
            n = int(batch.mask[r].sum())
            self.store[(site, layer, gi)] = h[r, :n].float().cpu().clone()


def test_layer_count_and_shapes(adapters):
    full, _ = adapters
    assert full.get_layer_count() == full.model.config.num_hidden_layers == len(full.model.model.layers)
    assert full.get_hidden_size() == full.model.config.hidden_size


def test_streamed_hidden_states_match_full_model(adapters):
    full, stream = adapters
    L = full.get_layer_count()
    toks = _token_lists(full)
    batches = make_batches(toks, batch_size=2, pad_id=full.doc_prefix_id, skip_prefix=1)
    sites = {i: set(SITES) for i in range(L)}
    a, b = PerToken(), PerToken()
    full.forward_hidden_states(batches, sites, a)
    stream.forward_hidden_states(batches, sites, b)
    assert set(a.store) == set(b.store)
    worst = max((a.store[k] - b.store[k]).abs().max().item() / (a.store[k].abs().max().item() + 1e-6) for k in a.store)
    assert worst < 1e-4, worst
    # residual additions hold exactly at the module boundaries
    for gi in range(len(TEXTS)):
        for i in (0, L // 2, L - 1):
            pre, att, mid = a.store[("resid_pre", i, gi)], a.store[("attn_out", i, gi)], a.store[("resid_mid", i, gi)]
            mlp, post = a.store[("mlp_out", i, gi)], a.store[("resid_post", i, gi)]
            torch.testing.assert_close(pre + att, mid, rtol=1e-5, atol=1e-5)
            torch.testing.assert_close(mid + mlp, post, rtol=1e-5, atol=1e-5)
            if i + 1 < L:
                torch.testing.assert_close(post, a.store[("resid_pre", i + 1, gi)])


def test_final_projection_equals_model_logits(adapters):
    """project_to_logits(last residual) must equal the real model output: the diagnostic projection at the last layer
    is the model's actual prediction, and nowhere else."""
    full, stream = adapters
    L = full.get_layer_count()
    toks = _token_lists(full)
    batches = make_batches(toks, batch_size=4, pad_id=full.doc_prefix_id, sort_by_length=False)
    cap = PerToken()
    full.forward_hidden_states(batches, {L - 1: {"resid_post"}}, cap)
    for gi, t in enumerate(toks):
        logits = full.model(input_ids=torch.tensor([t])).logits[0].float()
        h = cap.store[("resid_post", L - 1, gi)]
        torch.testing.assert_close(full.project_to_logits(h), logits, rtol=1e-4, atol=1e-3)
        torch.testing.assert_close(stream.project_to_logits(h), logits, rtol=1e-4, atol=1e-3)


def test_hf_hidden_states_last_entry_is_post_norm(adapters):
    """Documents the transformers 5.x behaviour that motivates explicit hooks: output_hidden_states[-1] is the
    final-RMSNorm output, while every earlier entry is a pre-norm residual."""
    full, _ = adapters
    t = torch.tensor([_token_lists(full)[0]])
    out = full.model.model(input_ids=t, output_hidden_states=True)
    hs = out.hidden_states
    assert len(hs) == full.get_layer_count() + 1
    torch.testing.assert_close(hs[-1], out.last_hidden_state)
    cap = PerToken()
    full.forward_hidden_states(make_batches([t[0].tolist()], 1, 0), {full.get_layer_count() - 1: {"resid_post"}}, cap)
    pre_norm = cap.store[("resid_post", full.get_layer_count() - 1, 0)]
    assert not torch.allclose(pre_norm, hs[-1][0].float(), atol=1e-3)
    torch.testing.assert_close(full.model.model.norm(pre_norm), hs[-1][0].float(), rtol=1e-4, atol=1e-4)


def test_hooks_are_removed_even_after_errors(adapters):
    full, _ = adapters
    before = count_hooks(full.model)

    def boom(*_):
        raise RuntimeError("collector failure")

    batches = make_batches(_token_lists(full)[:1], 1, full.doc_prefix_id)
    with pytest.raises(RuntimeError):
        full.forward_hidden_states(batches, {0: {"resid_post"}}, boom)
    assert count_hooks(full.model) == before
    full.forward_hidden_states(batches, {i: set(SITES) for i in range(3)}, lambda *a: None)
    assert count_hooks(full.model) == before


def test_pooled_store_mean_and_last(adapters):
    full, _ = adapters
    toks = _token_lists(full)
    batches = make_batches(toks, 2, full.doc_prefix_id, skip_prefix=1)
    store = PooledStore(len(toks), full.get_hidden_size(), {"resid_post": [0, 5]})
    raw = PerToken()

    def both(*a):
        store(*a)
        raw(*a)
    full.forward_hidden_states(batches, {0: {"resid_post"}, 5: {"resid_post"}}, both)
    for gi in range(len(toks)):
        h = raw.store[("resid_post", 5, gi)]
        torch.testing.assert_close(torch.from_numpy(store.arrays[("resid_post", "mean")][gi, 1]), h[1:].mean(0), rtol=1e-5, atol=1e-5)
        torch.testing.assert_close(torch.from_numpy(store.arrays[("resid_post", "last")][gi, 1]), h[-1], rtol=1e-6, atol=1e-6)
        rms = h[1:].pow(2).mean(-1).sqrt().mean()
        assert abs(store.rms["resid_post"][gi, 1] - rms.item()) < 1e-3
