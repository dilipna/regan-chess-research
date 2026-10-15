"""Run a real Qwen3 checkpoint one decoder layer at a time.

Qwen3-8B-Base is about 16 GB in bf16; one decoder layer is about 0.39 GB. This runner builds each
`transformers.models.qwen3.modeling_qwen3.Qwen3DecoderLayer` from the checkpoint's own config, loads only that layer's
tensors from the safetensors shards, pushes every minibatch through it, and frees it before the next layer. The math is
the library's modules, unchanged; only the scheduling differs from an ordinary forward pass (all documents advance one
layer at a time instead of one document advancing through all layers).

Padding: documents are right-padded and the causal mask alone is used. A real token at position t only attends to
positions <= t, which are all real tokens, so right padding never changes a real token's computation. Pad positions are
excluded from pooling and scoring.

tests/latentlens/test_streaming.py checks hidden states and logits against the ordinary full model.
"""

from __future__ import annotations

import gc
import json
from pathlib import Path

import torch

from .capture import Batch, Collector, HookSet


def snapshot_path(model_id: str, revision: str | None, local_files_only: bool = False) -> Path:
    from huggingface_hub import snapshot_download
    return Path(snapshot_download(model_id, revision=revision, local_files_only=local_files_only,
                                  allow_patterns=["*.json", "*.safetensors", "*.txt", "*.model"]))


class StreamedQwen3:
    def __init__(self, model_id: str, revision: str | None, device: torch.device, dtype: torch.dtype,
                 attn_implementation: str = "sdpa", local_files_only: bool = False):
        from transformers import AutoConfig
        from transformers.models.qwen3.modeling_qwen3 import Qwen3RMSNorm, Qwen3RotaryEmbedding
        self.root = snapshot_path(model_id, revision, local_files_only)
        self.config = AutoConfig.from_pretrained(self.root)
        self.config._attn_implementation = attn_implementation
        self.device, self.dtype = device, dtype
        idx = self.root / "model.safetensors.index.json"
        if idx.exists():
            self.weight_map = {k: self.root / v for k, v in json.loads(idx.read_text())["weight_map"].items()}
        else:
            from safetensors import safe_open
            f = self.root / "model.safetensors"
            with safe_open(str(f), framework="pt") as fh:
                self.weight_map = {k: f for k in fh.keys()}
        self.tied = "lm_head.weight" not in self.weight_map
        self.embed_weight = self._tensor("model.embed_tokens.weight", torch.device("cpu"))
        self.rotary = Qwen3RotaryEmbedding(self.config).to(device)
        self._norm_cls = Qwen3RMSNorm
        self._head = None

    # ---------------------------------------------------------------- weights
    def _tensor(self, name: str, device: torch.device) -> torch.Tensor:
        from safetensors import safe_open
        with safe_open(str(self.weight_map[name]), framework="pt", device="cpu") as fh:
            return fh.get_tensor(name).to(device=device, dtype=self.dtype)

    def _tensors(self, prefix: str, device: torch.device) -> dict[str, torch.Tensor]:
        from safetensors import safe_open
        by_file: dict[Path, list[str]] = {}
        for k, f in self.weight_map.items():
            if k.startswith(prefix):
                by_file.setdefault(f, []).append(k)
        out = {}
        for f, keys in by_file.items():
            with safe_open(str(f), framework="pt", device="cpu") as fh:
                for k in keys:
                    out[k[len(prefix):]] = fh.get_tensor(k).to(device=device, dtype=self.dtype)
        return out

    def load_layer(self, i: int) -> torch.nn.Module:
        from transformers.models.qwen3.modeling_qwen3 import Qwen3DecoderLayer
        with torch.device("meta"):
            layer = Qwen3DecoderLayer(self.config, i)
        sd = self._tensors(f"model.layers.{i}.", self.device)
        missing, unexpected = layer.load_state_dict(sd, strict=True, assign=True)
        assert not missing and not unexpected
        return layer.to(self.device).eval()

    def head(self):
        """(final RMSNorm, LM head weight) on the device, loaded once."""
        if self._head is None:
            norm = self._norm_cls(self.config.hidden_size, eps=self.config.rms_norm_eps)
            norm.weight = torch.nn.Parameter(self._tensor("model.norm.weight", self.device), requires_grad=False)
            w = self.embed_weight.to(self.device) if self.tied else self._tensor("lm_head.weight", self.device)
            self._head = (norm.to(self.device).eval(), w)
        return self._head

    @torch.inference_mode()
    def project(self, h: torch.Tensor) -> torch.Tensor:
        norm, w = self.head()
        return torch.nn.functional.linear(norm(h.to(self.device, self.dtype)), w).float()

    # ---------------------------------------------------------------- execution
    def embed(self, ids: torch.Tensor) -> torch.Tensor:
        return torch.nn.functional.embedding(ids, self.embed_weight)

    @torch.inference_mode()
    def run(self, batches: list[Batch], sites: dict[int, set[str]], collector: Collector,
            embed_collector: Collector | None = None, keep_on_device: bool | None = None,
            layer_callback=None) -> None:
        """layer_callback(i, layer_module, batch_ref) may register extra hooks and must return their handles."""
        n_layers = self.config.num_hidden_layers
        hidden = [self.embed(b.ids) for b in batches]                       # CPU, model dtype
        if keep_on_device is None:
            total = sum(h.numel() * h.element_size() for h in hidden)
            keep_on_device = self.device.type != "cuda" or total < 0.8 * 2**30
        if keep_on_device:
            hidden = [h.to(self.device) for h in hidden]
        if embed_collector is not None:
            for b, h in zip(batches, hidden):
                embed_collector("embed", -1, h.to(self.device), b)
        eager = self.config._attn_implementation == "eager"
        pe_cache: dict[int, tuple] = {}
        current: dict[str, Batch] = {}
        for i in range(n_layers):
            layer = self.load_layer(i)
            extra = layer_callback(i, layer, lambda: current["b"]) if layer_callback else []
            with HookSet(layer, i, sites.get(i, set()), collector, lambda: current["b"]):
                for k, b in enumerate(batches):
                    current["b"] = b
                    T = b.ids.shape[1]
                    if T not in pe_cache:
                        pos = torch.arange(T, device=self.device)[None]
                        pe_cache[T] = (pos, self.rotary(torch.empty(1, device=self.device, dtype=self.dtype), pos))
                    pos, pe = pe_cache[T]
                    mask = None
                    if eager:
                        mask = torch.full((T, T), torch.finfo(self.dtype).min, device=self.device, dtype=self.dtype).triu(1)[None, None]
                    out = layer(hidden[k].to(self.device), attention_mask=mask, position_ids=pos,
                                position_embeddings=pe, use_cache=False)
                    out = out[0] if isinstance(out, tuple) else out
                    hidden[k] = out if keep_on_device else out.cpu()
            for h in extra:
                h.remove()
            del layer
            if self.device.type == "cuda":
                torch.cuda.empty_cache()
        self.final_hidden = hidden                                            # pre-final-norm residual, per batch
        gc.collect()

    def close(self) -> None:
        self._head = None
        self.final_hidden = None
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
