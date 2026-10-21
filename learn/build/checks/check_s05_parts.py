"""Step 5 checks: RMSNorm, RoPE and SwiGLU against their definitions."""
import torch
from torch.nn import functional as F

from impl import load

m = load("s05_parts")
torch.manual_seed(0)


def test_rmsnorm_matches_pytorch():
    x = torch.randn(2, 5, 16) * 7
    n = m.RMSNorm(16)
    with torch.no_grad():
        n.weight.copy_(torch.rand(16) + 0.5)
    ref = torch.nn.RMSNorm(16, eps=1e-6)
    with torch.no_grad():
        ref.weight.copy_(n.weight)
    assert torch.allclose(n(x), ref(x), atol=1e-5)
    unit = m.RMSNorm(16)(x)
    assert torch.allclose(unit.pow(2).mean(-1), torch.ones(2, 5), atol=1e-4), "with gain 1, every vector has RMS 1"


def test_rope_tables():
    cos, sin = m.rope_cos_sin(10, 8, theta=10_000)
    assert cos.shape == sin.shape == (10, 8)
    assert torch.allclose(cos[0], torch.ones(8)) and torch.allclose(sin[0], torch.zeros(8)), "position 0 is no rotation"
    assert torch.allclose(cos[3, 0], torch.cos(torch.tensor(3.0))), "pair 0 turns 1 radian per position"
    assert torch.allclose(cos[:, :4], cos[:, 4:]), "dimension i and i + d/2 share an angle"


def test_rotate_half():
    assert m.rotate_half(torch.tensor([1.0, 2.0, 3.0, 4.0])).tolist() == [-3.0, -4.0, 1.0, 2.0]


def test_rope_keeps_length_and_scores_depend_only_on_distance():
    cos, sin = m.rope_cos_sin(64, 16, theta=10_000)
    q, k = torch.randn(16), torch.randn(16)
    rq = m.apply_rope(q, cos[20], sin[20])
    assert torch.allclose(rq.norm(), q.norm(), atol=1e-5), "a rotation never changes length"
    s1 = m.apply_rope(q, cos[20], sin[20]) @ m.apply_rope(k, cos[13], sin[13])
    s2 = m.apply_rope(q, cos[50], sin[50]) @ m.apply_rope(k, cos[43], sin[43])
    assert torch.allclose(s1, s2, atol=1e-4), "same distance (7) must give the same score"


def test_swiglu():
    mlp = m.SwiGLU(8, 24)
    x = torch.randn(3, 8)
    want = mlp.down_proj.weight @ (F.silu(mlp.gate_proj.weight @ x.T) * (mlp.up_proj.weight @ x.T))
    assert torch.allclose(mlp(x), want.T, atol=1e-5)
