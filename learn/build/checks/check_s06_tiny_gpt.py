"""Step 6 checks: the assembled model has the right shapes, is causal, and actually learns."""
import math

import torch

from impl import load

m = load("s06_tiny_gpt")


def small(**kw):
    c = dict(vocab_size=40, d_model=48, n_layers=2, n_heads=4, n_kv_heads=2, d_ff=144, max_len=64)
    c.update(kw)
    return m.Config(**c)


def test_shapes_and_parameter_count():
    torch.manual_seed(0)
    c = small()
    model = m.TinyGPT(c)
    logits, loss = model(torch.randint(0, 40, (3, 10)))
    assert logits.shape == (3, 10, 40) and loss is None
    assert sum(p.numel() for p in model.parameters()) == m.count_params(c)


def test_untrained_loss_is_about_log_vocab():
    torch.manual_seed(0)
    model = m.TinyGPT(small())
    _, loss = model(torch.randint(0, 40, (8, 32)), torch.randint(0, 40, (8, 32)))
    assert abs(loss.item() - math.log(40)) < 0.3, "small random weights should give a near-uniform guess"


def test_causal_logits_ignore_the_future():
    torch.manual_seed(0)
    model = m.TinyGPT(small()).eval()
    x = torch.randint(0, 40, (1, 12))
    y = x.clone()
    y[0, 8:] = (y[0, 8:] + 7) % 40
    with torch.no_grad():
        a, _ = model(x)
        b, _ = model(y)
    assert torch.allclose(a[0, :8], b[0, :8], atol=1e-5)
    assert not torch.allclose(a[0, 8:], b[0, 8:], atol=1e-3)


def test_gqa_has_fewer_kv_weights():
    attn = m.TinyGPT(small()).layers[0].self_attn
    assert attn.k_proj.weight.shape == (2 * 12, 48) and attn.q_proj.weight.shape == (4 * 12, 48)


def test_it_learns():
    from data import tiny_stories
    text = tiny_stories(20_000)
    tok = m.CharTokenizer(text)
    data = torch.tensor(tok.encode(text))
    torch.manual_seed(0)
    model = m.TinyGPT(small(vocab_size=len(tok.itos)))
    losses = m.train(model, data, steps=250, batch=16, block=48, lr=3e-3)
    first, last = sum(losses[:10]) / 10, sum(losses[-20:]) / 20
    assert last < 2.0 < first, f"loss {first:.2f} -> {last:.2f}: expected to fall below 2.0 nats"
