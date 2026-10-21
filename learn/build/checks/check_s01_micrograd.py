"""Step 1 checks: every gradient must match PyTorch's autograd."""
import pytest
import torch

from impl import load

m = load("s01_micrograd")
V = m.Value


def torch_grads(fn, *xs):
    ts = [torch.tensor(x, dtype=torch.float64, requires_grad=True) for x in xs]
    fn(*ts).backward()
    return [t.grad.item() for t in ts]


def check(fn_value, fn_torch, *xs):
    vs = [V(x) for x in xs]
    out = fn_value(*vs)
    out.backward()
    for got, want in zip([v.grad for v in vs], torch_grads(fn_torch, *xs)):
        assert got == pytest.approx(want, rel=1e-6, abs=1e-9)


def test_add_and_mul():
    check(lambda a, b: a * b + a, lambda a, b: a * b + a, 2.0, -3.0)


def test_value_used_twice_accumulates():
    check(lambda a: a * a + a, lambda a: a * a + a, 3.0)


def test_pow_and_division():
    check(lambda a, b: (a ** 3) / b - b ** -2, lambda a, b: (a ** 3) / b - b ** -2, 1.5, 2.5)


def test_exp_tanh_silu():
    check(lambda a: a.exp() + a.tanh() + a.silu(), lambda a: a.exp() + a.tanh() + torch.nn.functional.silu(a), 0.7)
    check(lambda a: a.silu() * a.silu(), lambda a: torch.nn.functional.silu(a) ** 2, -1.3)


def test_deep_expression():
    def f(a, b, c, lib):
        e = a * b
        d = e + c
        g = d * d * 0.5 + (d * -1).tanh() if lib == "v" else d * d * 0.5 + torch.tanh(-d)
        return g / (a * a + 1.0)
    check(lambda a, b, c: f(a, b, c, "v"), lambda a, b, c: f(a, b, c, "t"), 2.0, -0.5, 1.25)


def test_softmax_built_from_values():
    """Softmax from exp, sum and division: the gradient of one probability matches PyTorch."""
    logits = [V(1.0), V(2.5), V(-0.5)]
    exps = [l.exp() for l in logits]
    total = sum(exps, V(0.0))
    p1 = exps[1] / total
    p1.backward()
    t = torch.tensor([1.0, 2.5, -0.5], dtype=torch.float64, requires_grad=True)
    torch.softmax(t, 0)[1].backward()
    for got, want in zip([l.grad for l in logits], t.grad.tolist()):
        assert got == pytest.approx(want, rel=1e-6)


def test_xor_learns():
    losses = m.train_xor(steps=300)
    assert losses[-1] < 0.05 < losses[0], f"loss went {losses[0]:.3f} -> {losses[-1]:.3f}; XOR should drop below 0.05"
