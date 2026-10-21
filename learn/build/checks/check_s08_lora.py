"""Step 8 checks: LoRA starts as a no-op, trains only its small matrices, and merges exactly."""
import torch
from torch import nn

from impl import load

m = load("s08_lora")
g6 = load("s06_tiny_gpt")


def test_starts_identical_and_only_a_b_train():
    torch.manual_seed(0)
    base = nn.Linear(32, 16)
    x = torch.randn(4, 32)
    want = base(x)
    lora = m.LoRALinear(base, r=4, alpha=8)
    assert torch.allclose(lora(x), want), "B starts at zero, so LoRA must not change the output at first"
    assert {n for n, p in lora.named_parameters() if p.requires_grad} == {"A", "B"}
    assert lora.A.shape == (4, 32) and lora.B.shape == (16, 4)


def test_merged_weight_is_exact():
    torch.manual_seed(0)
    lora = m.LoRALinear(nn.Linear(20, 12, bias=False), r=3, alpha=6)
    with torch.no_grad():
        lora.B.normal_()
    x = torch.randn(5, 20)
    assert torch.allclose(lora(x), x @ lora.merged_weight().T, atol=1e-5)


def test_add_lora_to_tiny_gpt():
    torch.manual_seed(0)
    c = g6.Config(vocab_size=30, d_model=32, n_layers=2, n_heads=4, n_kv_heads=2, d_ff=96, max_len=32)
    model = g6.TinyGPT(c)
    x = torch.randint(0, 30, (2, 10))
    before, _ = model(x)
    m.add_lora(model, targets=("q_proj", "v_proj"), r=4)
    after, _ = model(x)
    assert torch.allclose(before, after, atol=1e-6)
    expected = c.n_layers * (4 * (32 + 32) + 4 * (32 + 16))       # q_proj 32 -> 32, v_proj 32 -> 16 (2 KV heads x 8)
    assert m.trainable(model) == expected
    frozen = [p.clone() for p in model.parameters() if not p.requires_grad]
    opt = torch.optim.SGD([p for p in model.parameters() if p.requires_grad], lr=0.1)
    _, loss = model(x, torch.randint(0, 30, (2, 10)))
    loss.backward()
    opt.step()
    assert all(torch.equal(a, b) for a, b in zip(frozen, [p for p in model.parameters() if not p.requires_grad]))
