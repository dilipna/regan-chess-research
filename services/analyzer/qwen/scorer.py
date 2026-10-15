"""Legal-move probability distribution from a base LLM's token likelihoods.

For a position with prompt x and legal moves m_1..m_K, each candidate continuation c_i = " <uci>\\n"
is tokenized together with the prompt and scored as

    L_i = sum_t log P(token_t | x, earlier tokens of c_i)        (every token of c_i, no length normalization)
    P(m_i) = exp(L_i) / sum_j exp(L_j)                            (log-sum-exp over the legal moves only)

Efficiency: the prompt is run once; its key/value cache is replicated across a batch of candidates, so
the cost per position is one prompt pass plus K short continuations. `score_naive` scores each full
prompt+candidate sequence independently and exists to test that the cached path is equivalent.

Nothing is sampled and no text is generated; temperature does not apply.
"""

from __future__ import annotations

import copy
import math
import os
from dataclasses import dataclass

import numpy as np

QWEN_MODEL_ID = os.environ.get("QWEN_MODEL_ID", "Qwen/Qwen3-8B-Base")
# Pinned Hugging Face commit of Qwen/Qwen3-8B-Base (model + tokenizer live in the same repo).
QWEN_REVISION = os.environ.get("QWEN_REVISION", "49e3418fbbbca6ecbdf9608b4d22e5a407081db4")
PINNED_REVISIONS = {
    "Qwen/Qwen3-8B-Base": "49e3418fbbbca6ecbdf9608b4d22e5a407081db4",
    # used ONLY by the automated tests / local pipeline checks; never reported as a result
    "Qwen/Qwen3-0.6B-Base": "da87bfb608c14b7cf20ba1ce41287e8de496c0cd",
}


def logsumexp(x: np.ndarray) -> float:
    m = float(np.max(x))
    return m + math.log(float(np.exp(x - m).sum()))


def normalize(logprobs: dict[str, float]) -> dict[str, float]:
    """Softmax of summed candidate log-likelihoods over the legal candidates."""
    keys = list(logprobs)
    v = np.array([logprobs[k] for k in keys], dtype=np.float64)
    lse = logsumexp(v)
    return {k: float(math.exp(v[i] - lse)) for i, k in enumerate(keys)}


def entropy(p: dict[str, float]) -> float:
    a = np.array([x for x in p.values() if x > 0], dtype=np.float64)
    return float(-(a * np.log(a)).sum())


@dataclass
class CandidateTokens:
    move: str
    ids: list[int]


class QwenScorer:
    """Loads the model once; score_position() may be called many times."""

    def __init__(self, model_id: str = QWEN_MODEL_ID, revision: str | None = None, device: str | None = None,
                 dtype: str = "bfloat16", candidate_batch: int = 64, attn_implementation: str = "sdpa"):
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        self.torch = torch
        self.model_id = model_id
        self.revision = revision or PINNED_REVISIONS.get(model_id)
        if self.revision is None:
            raise ValueError(f"no pinned revision for {model_id}")
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.dtype_name = dtype
        self.candidate_batch = candidate_batch
        torch_dtype = {"bfloat16": torch.bfloat16, "float16": torch.float16, "float32": torch.float32}[dtype]
        self.tokenizer = AutoTokenizer.from_pretrained(model_id, revision=self.revision)
        self.model = AutoModelForCausalLM.from_pretrained(
            model_id, revision=self.revision, dtype=torch_dtype, attn_implementation=attn_implementation,
        ).to(self.device)
        self.model.eval()

    # ------------------------------------------------------------------ tokenization
    def encode_prompt(self, prompt: str) -> list[int]:
        return self.tokenizer(prompt, add_special_tokens=False)["input_ids"]

    def candidate_tokens(self, prompt: str, prompt_ids: list[int], continuation: str) -> list[int]:
        """Tokens of the continuation as they occur when prompt + continuation is tokenized together.
        Raises if the joint tokenization does not keep the prompt tokens as an exact prefix (then the
        candidate tokens would not be well defined)."""
        full = self.tokenizer(prompt + continuation, add_special_tokens=False)["input_ids"]
        n = len(prompt_ids)
        if full[:n] != prompt_ids:
            raise ValueError("prompt tokens are not a prefix of prompt+candidate tokens")
        ids = full[n:]
        if not ids or self.tokenizer.decode(ids) != continuation:
            raise ValueError(f"candidate tokens do not decode to {continuation!r}")
        return ids

    # ------------------------------------------------------------------ scoring
    def score_position(self, prompt: str, continuations: dict[str, str]) -> dict[str, dict]:
        """continuations: {move: continuation text}. Returns {move: {logprob, n_tokens, token_logprobs}}."""
        torch = self.torch
        prompt_ids = self.encode_prompt(prompt)
        cands = [CandidateTokens(m, self.candidate_tokens(prompt, prompt_ids, c)) for m, c in continuations.items()]
        out: dict[str, dict] = {}
        with torch.inference_mode():
            p = torch.tensor([prompt_ids], device=self.device)
            res = self.model(input_ids=p, use_cache=True)
            first_lp = torch.log_softmax(res.logits[0, -1].float(), dim=-1)   # distribution of candidate token 0
            cache = res.past_key_values
            n_prompt = len(prompt_ids)
            for s in range(0, len(cands), self.candidate_batch):
                chunk = cands[s:s + self.candidate_batch]
                B = len(chunk)
                L = max(len(c.ids) for c in chunk)
                pad = self.tokenizer.pad_token_id if self.tokenizer.pad_token_id is not None else 0
                # right padding: under causal attention, padded positions never influence real tokens
                inp = torch.full((B, L), pad, dtype=torch.long, device=self.device)
                for i, c in enumerate(chunk):
                    inp[i, :len(c.ids)] = torch.tensor(c.ids, device=self.device)
                kv = copy.deepcopy(cache)
                kv.batch_repeat_interleave(B)
                attn = torch.ones((B, n_prompt + L), dtype=torch.long, device=self.device)
                pos = torch.arange(n_prompt, n_prompt + L, device=self.device).unsqueeze(0).expand(B, L)
                r = self.model(input_ids=inp, attention_mask=attn, position_ids=pos, past_key_values=kv, use_cache=True)
                lp = torch.log_softmax(r.logits.float(), dim=-1)          # lp[i, t] predicts token t+1
                for i, c in enumerate(chunk):
                    toks = [float(first_lp[c.ids[0]])]
                    for t in range(1, len(c.ids)):
                        toks.append(float(lp[i, t - 1, c.ids[t]]))
                    out[c.move] = {"logprob": float(sum(toks)), "n_tokens": len(c.ids), "token_logprobs": toks}
                del kv, r, lp
        return out

    def score_naive(self, prompt: str, continuations: dict[str, str]) -> dict[str, dict]:
        """Reference implementation: one independent forward pass per full prompt+candidate sequence."""
        torch = self.torch
        prompt_ids = self.encode_prompt(prompt)
        out = {}
        with torch.inference_mode():
            for m, c in continuations.items():
                ids = self.candidate_tokens(prompt, prompt_ids, c)
                full = torch.tensor([prompt_ids + ids], device=self.device)
                lp = torch.log_softmax(self.model(input_ids=full).logits[0].float(), dim=-1)
                n = len(prompt_ids)
                toks = [float(lp[n - 1 + t, ids[t]]) for t in range(len(ids))]
                out[m] = {"logprob": float(sum(toks)), "n_tokens": len(ids), "token_logprobs": toks}
        return out

    def runtime_info(self) -> dict:
        import torch
        import transformers
        gpu = torch.cuda.get_device_name(0) if self.device.startswith("cuda") else None
        return {"model_id": self.model_id, "revision": self.revision, "tokenizer_revision": self.revision,
                "dtype": self.dtype_name, "quantization": None, "device": self.device, "gpu": gpu,
                "torch": torch.__version__, "transformers": transformers.__version__,
                "attn_implementation": self.model.config._attn_implementation,
                "candidate_batch": self.candidate_batch,
                "scoring": "sum of log-probabilities of every candidate token; softmax over legal moves",
                "sampling": None}


def played_rank(probs: dict[str, float], played: str) -> int:
    """1 + number of legal moves with strictly higher probability (same rule for every model)."""
    p = probs[played]
    return 1 + sum(1 for v in probs.values() if v > p)


def distribution_summary(probs: dict[str, float], logprobs: dict[str, float], played: str | None = None,
                         top_k: int = 5) -> dict:
    """Played-move statistics (if a played move is given) and top-k list for one position."""
    order = sorted(probs, key=lambda m: (-probs[m], m))
    out = {"top1_move": order[0], "top1_probability": probs[order[0]],
           "topk": [[m, probs[m]] for m in order[:top_k]], "entropy": entropy(probs),
           "candidate_count": len(probs)}
    if played is not None:
        out.update({"played_move": played, "logprob_played": math.log(max(probs[played], 1e-300)),
                    "prob_played": probs[played], "rank_played": played_rank(probs, played),
                    "raw_logprob_played": logprobs[played]})
    return out
