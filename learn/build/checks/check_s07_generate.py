"""Step 7 checks: decoding rules behave, and the KV cache gives exactly the same answers."""
import torch

from impl import load

m = load("s07_generate")
g6 = load("s06_tiny_gpt")


def model():
    torch.manual_seed(0)
    return g6.TinyGPT(g6.Config(vocab_size=30, d_model=32, n_layers=2, n_heads=4, n_kv_heads=2, d_ff=96, max_len=48)).eval()


def test_greedy_and_top_k_1_are_argmax():
    logits = torch.tensor([[0.1, 3.0, -1.0, 2.9], [5.0, 0.0, 0.0, 0.0]])
    assert m.sample_next(logits, temperature=0).tolist() == [1, 0]
    g = torch.Generator().manual_seed(0)
    assert m.sample_next(logits, temperature=1.0, top_k=1, generator=g).tolist() == [1, 0]


def test_top_k_and_top_p_only_pick_allowed_tokens():
    logits = torch.log(torch.tensor([[0.5, 0.3, 0.15, 0.05]])).repeat(400, 1)
    g = torch.Generator().manual_seed(0)
    assert set(m.sample_next(logits, top_k=2, generator=g).tolist()) == {0, 1}
    assert set(m.sample_next(logits, top_p=0.7, generator=g).tolist()) == {0, 1}, "0.5 + 0.3 reaches 0.7"
    assert set(m.sample_next(logits, top_p=0.4, generator=g).tolist()) == {0}, "the first token alone reaches 0.4"


def test_temperature_sharpens_and_flattens():
    logits = torch.log(torch.tensor([[0.6, 0.4]])).repeat(4000, 1)
    g = torch.Generator().manual_seed(0)
    cold = (m.sample_next(logits, temperature=0.3, generator=g) == 0).float().mean()
    hot = (m.sample_next(logits, temperature=3.0, generator=g) == 0).float().mean()
    assert cold > 0.75 and 0.45 < hot < 0.6


def test_cached_logits_equal_full_forward():
    net = model()
    idx = torch.randint(0, 30, (2, 20))
    with torch.no_grad():
        full, _ = net(idx)
        cache = m.KVCache(len(net.layers))
        parts = [m.forward_cached(net, idx[:, :12], cache)]               # prefill 12 tokens
        for t in range(12, 20):
            parts.append(m.forward_cached(net, idx[:, t:t + 1], cache))   # then one at a time
    assert len(cache) == 20
    assert torch.allclose(torch.cat(parts, dim=1), full, atol=1e-5)


def test_greedy_generation_same_with_and_without_cache():
    net = model()
    prompt = torch.randint(0, 30, (1, 5))
    a = m.generate(net, prompt, 15, temperature=0, use_cache=True)
    b = m.generate(net, prompt, 15, temperature=0, use_cache=False)
    assert a.shape == (1, 20) and torch.equal(a, b)
