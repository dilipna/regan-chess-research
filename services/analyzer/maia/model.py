"""Maia-3 human-move model wrapper.

Uses the official CSSLab/maia3 inference package (model definition, tokenizer, checkpoint
registry) and reproduces the exact input construction of its UCI engine in
`--use-uci-history` mode: the model sees the current position plus up to 7 previous positions
(padded with the earliest), conditioned on the side-to-move Elo and the opponent Elo.
`clk_ponder` is 0, as in the official UCI wrapper.

Unlike the UCI interface (top-k only), we read the policy logits directly and return a full
probability distribution over all legal moves, so the played-move likelihood and surprisal are
exact model outputs.
"""

from __future__ import annotations

import argparse
import math
import threading
from collections import deque

import chess
import torch

from .. import config

_LOCK = threading.Lock()
_SINGLETON: "MaiaModel | None" = None


def get_maia(device: str | None = None) -> "MaiaModel":
    global _SINGLETON
    with _LOCK:
        if _SINGLETON is None:
            _SINGLETON = MaiaModel(config.MAIA_MODEL, device=device)
        return _SINGLETON


class MaiaModel:
    def __init__(self, model_name: str = "maia3-5m", device: str | None = None):
        from maia3.dataset import get_historical_tokens, get_legal_moves_mask, tokenize_board
        from maia3.model_registry import apply_model_config, resolve_checkpoint_path, resolve_model_spec
        from maia3.uci import load_model
        from maia3.utils import get_all_possible_moves, mirror_move

        self._tok = tokenize_board
        self._hist = get_historical_tokens
        self._mask = get_legal_moves_mask
        self._mirror = mirror_move

        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        spec = resolve_model_spec(model_name)
        cfg = argparse.Namespace(
            device=self.device, trust_checkpoint=False, use_amp=self.device.startswith("cuda"),
            # defaults that apply_model_config may override
            history=8, use_padding=False, include_time_info=False, dim_emb=128, dim_vit=192,
            num_blocks=8, num_heads=6, mlp_ratio=2.0, dropout=0.0, head_hid_dim=192, use_gab=True,
            gab_gen_size=64, gab_per_square_dim=0, gab_intermediate_dim=64, use_rms_norm=True,
            omit_qkv_biases=True, activation="gelu", use_relative_bias=False, use_absolute_pe=False,
        )
        apply_model_config(cfg, spec)
        cfg.checkpoint_path = resolve_checkpoint_path(spec)
        self.cfg = cfg
        self.model_name = spec.display_name
        self.model = load_model(cfg)
        self.all_moves = get_all_possible_moves()
        self.move_index = {m: i for i, m in enumerate(self.all_moves)}

    def _encode(self, history: deque) -> torch.Tensor:
        return self._hist(history, self.cfg, base=0.0, inc=0.0, clk_left_before=0.0, clk_ponder=0.0)

    @torch.no_grad()
    def _forward(self, tokens: torch.Tensor, self_elos: list[int], oppo_elos: list[int]):
        t = tokens.to(self.device)
        se = torch.tensor(self_elos, dtype=torch.long, device=self.device)
        oe = torch.tensor(oppo_elos, dtype=torch.long, device=self.device)
        with torch.autocast("cuda", enabled=self.cfg.use_amp):
            logits, _, _ = self.model(t, se, oe)
        return logits.float().cpu()

    def game_policies(self, start_fen: str, moves_uci: list[str], white_elo: int, black_elo: int,
                      plies: list[int] | None = None, batch_size: int = 256) -> dict[int, dict[str, float]]:
        """Return {ply: {legal_move_uci: probability}} for the requested plies
        (default: all plies of the game). Probabilities sum to 1 over legal moves."""
        board = chess.Board(start_fen)
        history: deque = deque(maxlen=self.cfg.history)
        history.append(self._tok(board))
        wanted = set(range(len(moves_uci))) if plies is None else set(plies)
        jobs = []  # (ply, tokens, legal_mask, legal list, turn, self_elo, oppo_elo)
        for ply, mv in enumerate(moves_uci):
            if ply in wanted and not board.is_game_over():
                legal = list(board.legal_moves)
                mask = self._mask(board, self.move_index)
                se, oe = (white_elo, black_elo) if board.turn == chess.WHITE else (black_elo, white_elo)
                jobs.append((ply, self._encode(history), mask, legal, board.turn, se, oe))
            board.push(chess.Move.from_uci(mv))
            history.append(self._tok(board))

        out: dict[int, dict[str, float]] = {}
        for s in range(0, len(jobs), batch_size):
            chunk = jobs[s:s + batch_size]
            tokens = torch.stack([j[1] for j in chunk])
            logits = self._forward(tokens, [j[5] for j in chunk], [j[6] for j in chunk])
            for (ply, _, mask, legal, turn, _, _), lg in zip(chunk, logits):
                lg = lg.masked_fill(~mask, float("-inf"))
                probs = torch.softmax(lg, dim=-1)
                dist = {}
                for m in legal:
                    u = m.uci()
                    key = u if turn == chess.WHITE else self._mirror(u)
                    idx = self.move_index.get(key)
                    dist[u] = float(probs[idx]) if idx is not None else 0.0
                out[ply] = dist
        return out


def surprisal(p: float, floor: float = 1e-6) -> float:
    """Human surprisal in nats: -ln P(move)."""
    return -math.log(max(p, floor))
