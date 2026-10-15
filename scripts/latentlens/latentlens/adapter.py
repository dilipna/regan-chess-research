"""ModelProbeAdapter: one interface for every open-weight model LatentLens can look inside.

Only models whose weights and hidden states are actually available can implement this interface. Black-box API models
(text in, text out) are never adapters; their generated text can only be studied as data.

Qwen3Adapter supports two loaders with identical outputs:
  loader="full"    the whole model on one device (a CSE GPU with >= 20 GB for 8B in bf16)
  loader="stream"  one decoder layer on the GPU at a time (see streaming.py); works on a 4 GB laptop GPU
"""

from __future__ import annotations

import gc
from abc import ABC, abstractmethod
from collections.abc import Iterable, Sequence
from typing import Any

import torch

from .capture import ATTN_WEIGHTS, SITES, Batch, Collector, HookSet
from .common import PINNED_REVISIONS


class ModelProbeAdapter(ABC):
    model_id: str
    revision: str | None

    @abstractmethod
    def load_model(self) -> None: ...

    @abstractmethod
    def tokenize(self, text: str) -> list[int]: ...

    @abstractmethod
    def inspect_architecture(self) -> dict[str, Any]: ...

    @abstractmethod
    def get_layer_count(self) -> int: ...

    @abstractmethod
    def get_hidden_size(self) -> int: ...

    @abstractmethod
    def get_norm_modules(self) -> dict[str, str]: ...

    @abstractmethod
    def get_attention_modules(self) -> dict[str, str]: ...

    @abstractmethod
    def get_mlp_modules(self) -> dict[str, str]: ...

    @abstractmethod
    def forward_hidden_states(self, batches: Sequence[Batch], sites: dict[int, set[str]], collector: Collector,
                              embed_collector: Collector | None = None) -> None:
        """Run every batch through the model, calling `collector(site, layer, tensor, batch)` for the requested
        sites. `embed_collector` receives ("embed", -1, embeddings, batch)."""

    @abstractmethod
    def project_to_logits(self, h: torch.Tensor) -> torch.Tensor:
        """Final RMSNorm + LM head applied to residual-stream vectors [..., D] -> [..., V] (float32)."""

    @abstractmethod
    def cleanup(self) -> None: ...

    def register_hooks(self, layer_module: torch.nn.Module, layer_idx: int, sites: Iterable[str], collector: Collector,
                       batch_ref) -> HookSet:
        return HookSet(layer_module, layer_idx, sites, collector, batch_ref)


def _dtype(name: str) -> torch.dtype:
    return {"bfloat16": torch.bfloat16, "float16": torch.float16, "float32": torch.float32}[name]


def causal_mask(T: int, device, dtype) -> torch.Tensor:
    """Additive mask [1, 1, T, T]: 0 where key position <= query position, a large negative number above."""
    m = torch.full((T, T), torch.finfo(dtype).min, device=device, dtype=dtype).triu(1)
    return m[None, None]


class Qwen3Adapter(ModelProbeAdapter):
    """Qwen3 decoder-only models (Qwen3ForCausalLM). Hooks follow transformers' Qwen3DecoderLayer module names."""

    NORMS = {"block_attn": "model.layers.{i}.input_layernorm", "block_mlp": "model.layers.{i}.post_attention_layernorm",
             "q_norm": "model.layers.{i}.self_attn.q_norm", "k_norm": "model.layers.{i}.self_attn.k_norm",
             "final": "model.norm"}
    ATTN = {"q_proj": "model.layers.{i}.self_attn.q_proj", "k_proj": "model.layers.{i}.self_attn.k_proj",
            "v_proj": "model.layers.{i}.self_attn.v_proj", "o_proj": "model.layers.{i}.self_attn.o_proj"}
    MLP = {"gate_proj": "model.layers.{i}.mlp.gate_proj", "up_proj": "model.layers.{i}.mlp.up_proj",
           "down_proj": "model.layers.{i}.mlp.down_proj"}

    def __init__(self, model_id: str, revision: str | None = None, device: str = "cuda", dtype: str = "bfloat16",
                 loader: str = "full", attn_implementation: str = "sdpa", local_files_only: bool = False):
        if loader not in ("full", "stream"):
            raise ValueError("loader must be 'full' or 'stream'")
        self.model_id, self.loader = model_id, loader
        self.revision = revision or PINNED_REVISIONS.get(model_id)
        self.device = torch.device(device if (device != "cuda" or torch.cuda.is_available()) else "cpu")
        self.dtype_name, self.dtype = dtype, _dtype(dtype)
        self.attn_implementation = attn_implementation
        self.local_files_only = local_files_only
        self.model = None          # full loader
        self.stream = None         # streaming loader
        self.tokenizer = None
        self.config = None

    # ------------------------------------------------------------------ loading
    def load_model(self) -> None:
        from transformers import AutoTokenizer
        kw = {"revision": self.revision, "local_files_only": self.local_files_only}
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_id, **kw)
        if self.loader == "full":
            from transformers import AutoModelForCausalLM
            self.model = AutoModelForCausalLM.from_pretrained(self.model_id, dtype=self.dtype,
                                                              attn_implementation=self.attn_implementation, **kw)
            self.model.to(self.device).eval()
            self.config = self.model.config
        else:
            from .streaming import StreamedQwen3
            self.stream = StreamedQwen3(self.model_id, self.revision, self.device, self.dtype,
                                        attn_implementation=self.attn_implementation, local_files_only=self.local_files_only)
            self.config = self.stream.config
        if getattr(self.config, "model_type", None) != "qwen3":
            raise ValueError(f"Qwen3Adapter needs model_type 'qwen3', got {getattr(self.config, 'model_type', None)!r}")

    def tokenize(self, text: str) -> list[int]:
        return self.tokenizer(text, add_special_tokens=False)["input_ids"]

    @property
    def doc_prefix_id(self) -> int:
        """<|endoftext|>, the document separator Qwen base models see between pretraining documents."""
        return int(self.tokenizer.convert_tokens_to_ids("<|endoftext|>"))

    def get_layer_count(self) -> int:
        return int(self.config.num_hidden_layers)

    def get_hidden_size(self) -> int:
        return int(self.config.hidden_size)

    def get_norm_modules(self) -> dict[str, str]:
        return dict(self.NORMS)

    def get_attention_modules(self) -> dict[str, str]:
        return dict(self.ATTN)

    def get_mlp_modules(self) -> dict[str, str]:
        return dict(self.MLP)

    def inspect_architecture(self) -> dict[str, Any]:
        c = self.config
        return {"model_type": c.model_type, "num_hidden_layers": c.num_hidden_layers, "hidden_size": c.hidden_size,
                "intermediate_size": c.intermediate_size, "num_attention_heads": c.num_attention_heads,
                "num_key_value_heads": c.num_key_value_heads, "head_dim": getattr(c, "head_dim", None),
                "vocab_size": c.vocab_size, "rms_norm_eps": c.rms_norm_eps,
                "tie_word_embeddings": getattr(c, "tie_word_embeddings", None)}

    # ------------------------------------------------------------------ execution
    @torch.inference_mode()
    def forward_hidden_states(self, batches, sites, collector, embed_collector=None, layer_callback=None) -> None:
        for s in sites.values():
            bad = set(s) - set(SITES) - {ATTN_WEIGHTS}
            if bad:
                raise ValueError(f"unknown sites {bad}")
        if self.loader == "stream":
            self.stream.run(batches, sites, collector, embed_collector, layer_callback=layer_callback)
            return
        layers = self.model.model.layers
        current: dict[str, Batch] = {}
        hooksets = [HookSet(layers[i], i, s, collector, lambda: current["b"]) for i, s in sites.items() if s]
        emb_handle = None
        extra: list = []
        if embed_collector is not None:
            emb_handle = self.model.model.embed_tokens.register_forward_hook(
                lambda _m, _i, out: embed_collector("embed", -1, out.detach(), current["b"]))
        try:
            if layer_callback is not None:
                for i, layer in enumerate(layers):
                    extra += layer_callback(i, layer, lambda: current["b"])
            for hs in hooksets:
                hs.__enter__()
            for b in batches:
                current["b"] = b
                self.model.model(input_ids=b.ids.to(self.device), attention_mask=b.mask.long().to(self.device),
                                 use_cache=False)
        finally:
            for hs in hooksets:
                hs.__exit__(None, None, None)
            for h in extra:
                h.remove()
            if emb_handle is not None:
                emb_handle.remove()

    @torch.inference_mode()
    def project_to_logits(self, h: torch.Tensor) -> torch.Tensor:
        if self.loader == "stream":
            return self.stream.project(h)
        h = h.to(self.device, self.dtype)
        return self.model.lm_head(self.model.model.norm(h)).float()

    def cleanup(self) -> None:
        if self.stream is not None:
            self.stream.close()
        self.model = self.stream = None
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()


def make_batches(token_lists: Sequence[Sequence[int]], batch_size: int, pad_id: int, skip_prefix: int = 0,
                 sort_by_length: bool = True) -> list[Batch]:
    """Right-pad documents into minibatches. `skip_prefix` leading tokens per document are excluded from pooling
    (the <|endoftext|> document-start token). Sorting by length reduces padding; the global index is kept."""
    order = sorted(range(len(token_lists)), key=lambda i: len(token_lists[i])) if sort_by_length else list(range(len(token_lists)))
    out = []
    for s in range(0, len(order), batch_size):
        idx = order[s:s + batch_size]
        T = max(len(token_lists[i]) for i in idx)
        ids = torch.full((len(idx), T), pad_id, dtype=torch.long)
        mask = torch.zeros((len(idx), T), dtype=torch.bool)
        for r, i in enumerate(idx):
            n = len(token_lists[i])
            ids[r, :n] = torch.tensor(list(token_lists[i]), dtype=torch.long)
            mask[r, :n] = True
        pool_mask = mask.clone()
        pool_mask[:, :skip_prefix] = False
        out.append(Batch(ids=ids, mask=mask, pool_mask=pool_mask, index=list(idx)))
    return out


def load_adapter(model_id: str, **kw) -> ModelProbeAdapter:
    """Factory. Only Qwen3 is implemented; other open-weight families get their own adapter class."""
    from transformers import AutoConfig
    cfg = AutoConfig.from_pretrained(model_id, revision=kw.get("revision") or PINNED_REVISIONS.get(model_id),
                                     local_files_only=kw.get("local_files_only", False))
    if cfg.model_type == "qwen3":
        a = Qwen3Adapter(model_id, **kw)
        a.load_model()
        return a
    raise NotImplementedError(f"no LatentLens adapter for model_type={cfg.model_type!r} yet")
