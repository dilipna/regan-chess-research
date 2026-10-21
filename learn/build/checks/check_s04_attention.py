"""Step 4 checks: compared against PyTorch's own softmax and scaled_dot_product_attention."""
import torch
from torch.nn import functional as F

from impl import load

m = load("s04_attention")
torch.manual_seed(0)


def test_softmax_matches_and_is_stable():
    x = torch.randn(3, 7)
    assert torch.allclose(m.softmax(x), torch.softmax(x, -1), atol=1e-6)
    big = torch.tensor([[1000.0, 1001.0, 999.0]])
    assert torch.allclose(m.softmax(big), torch.softmax(big, -1), atol=1e-6)
    masked = torch.tensor([[0.0, float("-inf"), 1.0]])
    out = m.softmax(masked)
    assert out[0, 1] == 0 and torch.isfinite(out).all()


def test_causal_mask():
    mk = m.causal_mask(4)
    assert mk.dtype == torch.bool
    assert mk.tolist() == [[True, False, False, False], [True, True, False, False], [True, True, True, False], [True, True, True, True]]


def test_attention_matches_pytorch():
    q, k, v = (torch.randn(2, 3, 6, 8) for _ in range(3))
    out, w = m.attention(q, k, v, causal=True)
    assert torch.allclose(out, F.scaled_dot_product_attention(q, k, v, is_causal=True), atol=1e-5)
    assert torch.allclose(w.sum(-1), torch.ones(2, 3, 6), atol=1e-5)
    assert (w.triu(1) == 0).all(), "weights on future positions must be exactly 0"
    out2, _ = m.attention(q, k, v, causal=False)
    assert torch.allclose(out2, F.scaled_dot_product_attention(q, k, v), atol=1e-5)


def test_the_future_cannot_change_the_past():
    q, k, v = (torch.randn(1, 2, 5, 4) for _ in range(3))
    out, _ = m.attention(q, k, v)
    k2, v2 = k.clone(), v.clone()
    k2[..., 4, :] += 10
    v2[..., 4, :] -= 10
    out2, _ = m.attention(q, k2, v2)
    assert torch.allclose(out[..., :4, :], out2[..., :4, :], atol=1e-6)


def test_repeat_kv_for_gqa():
    x = torch.arange(2 * 3).float().view(2, 3, 1, 1)       # 3 KV heads
    r = m.repeat_kv(x, 4)                                 # 12 query heads
    assert r.shape == (2, 12, 1, 1)
    assert r[0, :, 0, 0].tolist() == [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2]
