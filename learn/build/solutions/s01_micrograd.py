"""Step 1 · Autograd from scratch.

Every neural network, including a 36-block LLM, learns the same way: compute a loss, then ask "if I nudge each
weight a little, how does the loss change?" That number is the gradient, and backpropagation computes all of
them at once by applying the chain rule backwards through the computation.

Here you build the whole idea on single numbers. A Value remembers which Values it was made from and how, so
it can pass gradients back to them. PyTorch's autograd is the same machine, applied to tensors.

Atlas link: this is what happens to every box in the diagram during training (Foundations: Backprop).
Run the checks:  python -m pytest -k s01      (from learn/build)
"""
from __future__ import annotations

import math
import random


class Value:
    """A scalar that records how it was computed, so gradients can flow back through it."""

    def __init__(self, data: float, _children: tuple[Value, ...] = (), _op: str = ""):
        self.data = float(data)
        self.grad = 0.0                      # d(final output) / d(this value), filled in by backward()
        self._backward = lambda: None        # pushes this node's grad to its children
        self._prev = set(_children)
        self._op = _op

    def __repr__(self) -> str:
        return f"Value(data={self.data:.4f}, grad={self.grad:.4f})"

    # ---- operations: each creates a new node and says how to send gradient back ----

    def __add__(self, other: Value | float) -> Value:
        other = other if isinstance(other, Value) else Value(other)
        # TODO(1.1): out = self + other. Local derivatives: d(out)/d(self) = 1 and d(out)/d(other) = 1.
        # Use += (not =) when adding to .grad: a value used twice receives gradient from both uses.
        out = Value(self.data + other.data, (self, other), "+")

        def _backward():
            self.grad += out.grad
            other.grad += out.grad

        out._backward = _backward
        return out
        # END TODO

    def __mul__(self, other: Value | float) -> Value:
        other = other if isinstance(other, Value) else Value(other)
        # TODO(1.2): out = self * other. d(out)/d(self) = other.data and d(out)/d(other) = self.data.
        out = Value(self.data * other.data, (self, other), "*")

        def _backward():
            self.grad += other.data * out.grad
            other.grad += self.data * out.grad

        out._backward = _backward
        return out
        # END TODO

    def __pow__(self, k: float) -> Value:
        assert isinstance(k, (int, float)), "only constant powers"
        # TODO(1.3): out = self ** k. d(out)/d(self) = k * self.data ** (k - 1).
        out = Value(self.data ** k, (self,), f"**{k}")

        def _backward():
            self.grad += k * self.data ** (k - 1) * out.grad

        out._backward = _backward
        return out
        # END TODO

    def exp(self) -> Value:
        # TODO(1.4): out = e ** self. Its derivative is itself: d(out)/d(self) = out.data.
        out = Value(math.exp(self.data), (self,), "exp")

        def _backward():
            self.grad += out.data * out.grad

        out._backward = _backward
        return out
        # END TODO

    def tanh(self) -> Value:
        t = math.tanh(self.data)
        out = Value(t, (self,), "tanh")

        def _backward():
            self.grad += (1 - t * t) * out.grad

        out._backward = _backward
        return out

    def silu(self) -> Value:
        """SiLU(x) = x * sigmoid(x), the activation inside Qwen's MLP gate."""
        # TODO(1.5): forward value and backward rule. With s = sigmoid(x): d/dx = s * (1 + x * (1 - s)).
        s = 1 / (1 + math.exp(-self.data))
        out = Value(self.data * s, (self,), "silu")

        def _backward():
            self.grad += s * (1 + self.data * (1 - s)) * out.grad

        out._backward = _backward
        return out
        # END TODO

    # ---- conveniences built from the operations above (no new calculus needed) ----
    def __neg__(self): return self * -1
    def __sub__(self, other): return self + (-other)
    def __rsub__(self, other): return other + (-self)
    def __radd__(self, other): return self + other
    def __rmul__(self, other): return self * other
    def __truediv__(self, other): return self * (other ** -1 if isinstance(other, Value) else 1.0 / other)
    def __rtruediv__(self, other): return other * self ** -1

    # ---- the backward pass ----

    def backward(self) -> None:
        """Fill in .grad for every Value this one depends on."""
        # TODO(1.6): order the graph so every node comes after all the nodes it was computed from
        # (a topological sort, via depth-first search over _prev). Then set this node's grad to 1.0
        # and call _backward() on each node in REVERSE order.
        topo: list[Value] = []
        seen: set[int] = set()

        def build(v: Value) -> None:
            if id(v) not in seen:
                seen.add(id(v))
                for child in v._prev:
                    build(child)
                topo.append(v)

        build(self)
        self.grad = 1.0
        for v in reversed(topo):
            v._backward()
        # END TODO


# ---- a tiny neural network built only from Values (given; it works once the TODOs above do) ----

class Neuron:
    def __init__(self, n_in: int, act: str = "tanh", rng: random.Random | None = None):
        rng = rng or random.Random(0)
        self.w = [Value(rng.uniform(-1, 1)) for _ in range(n_in)]
        self.b = Value(0.0)
        self.act = act

    def __call__(self, x):
        z = sum((wi * xi for wi, xi in zip(self.w, x)), self.b)
        return {"tanh": z.tanh, "silu": z.silu, "linear": lambda: z}[self.act]()

    def parameters(self):
        return self.w + [self.b]


class MLP:
    """Layers of neurons. sizes=[2, 8, 1] means 2 inputs, one hidden layer of 8, 1 output."""

    def __init__(self, sizes: list[int], seed: int = 0):
        rng = random.Random(seed)
        self.layers = [[Neuron(sizes[i], "linear" if i == len(sizes) - 2 else "tanh", rng) for _ in range(sizes[i + 1])]
                       for i in range(len(sizes) - 1)]

    def __call__(self, x):
        for layer in self.layers:
            x = [n(x) for n in layer]
        return x[0] if len(x) == 1 else x

    def parameters(self):
        return [p for layer in self.layers for n in layer for p in n.parameters()]


def train_xor(steps: int = 200, lr: float = 0.1, seed: int = 0) -> list[float]:
    """Fit XOR, the classic problem no single straight line can solve. Returns the loss at every step."""
    xs = [[0.0, 0.0], [0.0, 1.0], [1.0, 0.0], [1.0, 1.0]]
    ys = [0.0, 1.0, 1.0, 0.0]
    model = MLP([2, 8, 1], seed=seed)
    losses = []
    for _ in range(steps):
        loss = sum(((model(x) - y) ** 2 for x, y in zip(xs, ys)), Value(0.0)) / len(xs)
        for p in model.parameters():
            p.grad = 0.0
        loss.backward()
        for p in model.parameters():
            p.data -= lr * p.grad
        losses.append(loss.data)
    return losses


if __name__ == "__main__":
    a, b = Value(2.0), Value(-3.0)
    out = (a * b + 10).tanh()
    out.backward()
    print("out", out, "| a", a, "| b", b)
    losses = train_xor()
    print(f"XOR loss: {losses[0]:.3f} -> {losses[-1]:.4f}")
