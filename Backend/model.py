import os
import re
import torch
import torch.nn as nn
import torch.nn.functional as F
import math
from dataclasses import dataclass
from transformers import PreTrainedTokenizerFast
from tokenizers import Tokenizer
from tokenizers.models import BPE
from tokenizers.pre_tokenizers import ByteLevel
from huggingface_hub import hf_hub_download

device = "cuda" if torch.cuda.is_available() else "cpu"
REPO_ID = "aman0419/Vitallm-50M"

# ── Model definition ──────────────────────────────────────────────────────────

@dataclass
class SLMConfig:
    block_size: int = 256
    vocab_size: int = 16384
    n_layer: int = 10
    n_head: int = 8
    n_embd: int = 512
    dropout: float = 0.0
    bias: bool = True

class LayerNorm(nn.Module):
    def __init__(self, ndim, bias=True, eps=1e-5):
        super().__init__()
        self.weight = nn.Parameter(torch.ones(ndim))
        self.bias = nn.Parameter(torch.zeros(ndim)) if bias else None
        self.eps = eps

    def forward(self, x):
        return F.layer_norm(x, x.shape[-1:], self.weight, self.bias, self.eps)

class CausalSelfAttention(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.c_attn = nn.Linear(config.n_embd, 3 * config.n_embd, bias=config.bias)
        self.c_proj = nn.Linear(config.n_embd, config.n_embd, bias=config.bias)
        self.attn_dropout = nn.Dropout(config.dropout)
        self.resid_dropout = nn.Dropout(config.dropout)
        self.n_head = config.n_head
        self.n_embd = config.n_embd
        self.flash = hasattr(F, 'scaled_dot_product_attention')
        if not self.flash:
            self.register_buffer("bias", torch.tril(torch.ones(config.block_size, config.block_size))
                                        .view(1, 1, config.block_size, config.block_size))

    def forward(self, x):
        B, T, C = x.size()
        q, k, v = self.c_attn(x).split(self.n_embd, dim=2)
        k = k.view(B, T, self.n_head, C // self.n_head).transpose(1, 2)
        q = q.view(B, T, self.n_head, C // self.n_head).transpose(1, 2)
        v = v.view(B, T, self.n_head, C // self.n_head).transpose(1, 2)
        if self.flash:
            y = F.scaled_dot_product_attention(q, k, v, attn_mask=None,
                dropout_p=self.attn_dropout.p if self.training else 0.0, is_causal=True)
        else:
            att = (q @ k.transpose(-2, -1)) * (1.0 / math.sqrt(k.size(-1)))
            att = att.masked_fill(self.bias[:, :, :T, :T] == 0, float('-inf'))
            att = F.softmax(att, dim=-1)
            att = self.attn_dropout(att)
            y = att @ v
        y = y.transpose(1, 2).contiguous().view(B, T, C)
        y = self.resid_dropout(self.c_proj(y))
        return y

class MLP(nn.Module):
    def __init__(self, config):
        super().__init__()
        hidden_dim = 4 * config.n_embd
        self.w1 = nn.Linear(config.n_embd, hidden_dim, bias=config.bias)
        self.w2 = nn.Linear(config.n_embd, hidden_dim, bias=config.bias)
        self.c_proj = nn.Linear(hidden_dim, config.n_embd, bias=config.bias)
        self.dropout = nn.Dropout(config.dropout)

    def forward(self, x):
        x = F.silu(self.w1(x)) * self.w2(x)
        return self.dropout(self.c_proj(x))

class Block(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.ln1 = LayerNorm(config.n_embd, config.bias)
        self.attn = CausalSelfAttention(config)
        self.ln2 = LayerNorm(config.n_embd, config.bias)
        self.mlp = MLP(config)

    def forward(self, x):
        x = x + self.attn(self.ln1(x))
        x = x + self.mlp(self.ln2(x))
        return x

class SLM(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.config = config
        self.transformer = nn.ModuleDict(dict(
            wte=nn.Embedding(config.vocab_size, config.n_embd),
            wpe=nn.Embedding(config.block_size, config.n_embd),
            drop=nn.Dropout(config.dropout),
            h=nn.ModuleList([Block(config) for _ in range(config.n_layer)]),
            ln_f=LayerNorm(config.n_embd, config.bias),
        ))
        self.lm_head = nn.Linear(config.n_embd, config.vocab_size, bias=False)
        self.transformer.wte.weight = self.lm_head.weight
        self.apply(self._init_weights)
        for pn, p in self.named_parameters():
            if pn.endswith('c_proj.weight'):
                nn.init.normal_(p, mean=0.0, std=0.02 / math.sqrt(2 * config.n_layer))

    def _init_weights(self, module):
        if isinstance(module, nn.Linear):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)
            if module.bias is not None:
                nn.init.zeros_(module.bias)
        elif isinstance(module, nn.Embedding):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)

    def forward(self, idx, targets=None):
        b, t = idx.size()
        pos = torch.arange(0, t, dtype=torch.long, device=idx.device)
        x = self.transformer.drop(self.transformer.wte(idx) + self.transformer.wpe(pos))
        for block in self.transformer.h:
            x = block(x)
        x = self.transformer.ln_f(x)
        logits = self.lm_head(x[:, [-1], :])
        return logits, None

    @torch.no_grad()
    def generate(self, idx, max_new_tokens, temperature=1.0, top_k=None, repetition_penalty=1.3):
        for _ in range(max_new_tokens):
            idx_cond = idx if idx.size(1) <= self.config.block_size else idx[:, -self.config.block_size:]
            logits, _ = self(idx_cond)
            logits = logits[:, -1, :]

            # Repetition penalty
            if repetition_penalty != 1.0:
                for token_id in set(idx[0].tolist()):
                    logits[0, token_id] /= repetition_penalty

            logits = logits / temperature
            if top_k is not None:
                v, _ = torch.topk(logits, min(top_k, logits.size(-1)))
                logits[logits < v[:, [-1]]] = -float('Inf')
            probs = F.softmax(logits, dim=-1)
            idx_next = torch.multinomial(probs, num_samples=1)
            idx = torch.cat((idx, idx_next), dim=1)
        return idx

# ── Loading functions ─────────────────────────────────────────────────────────

def load_tokenizer(vocab_path=None, merges_path=None):
    if vocab_path is None:
        vocab_path = hf_hub_download(REPO_ID, "vocab_50m.json", local_dir="./model_cache")
    if merges_path is None:
        merges_path = hf_hub_download(REPO_ID, "merges_50m.txt", local_dir="./model_cache")

    bpe_tokenizer = Tokenizer(BPE(vocab=vocab_path, merges=merges_path, unk_token="<unk>"))
    bpe_tokenizer.pre_tokenizer = ByteLevel()

    return PreTrainedTokenizerFast(
        tokenizer_object=bpe_tokenizer,
        unk_token="<unk>",
        pad_token="<pad>",
        eos_token="<eos>",
        bos_token="<bos>",
    )

def load_model(weights_path=None, tokenizer=None):
    if weights_path is None:
        weights_path = hf_hub_download(REPO_ID, "vital_lm_50m_weights.pt", local_dir="./model_cache")

    config = SLMConfig()
    model = SLM(config)
    state_dict = torch.load(weights_path, map_location=device, weights_only=True)
    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()
    return model

def clean_text(text: str) -> str:
    text = text.replace("Ġ", " ").replace("Ċ", "\n")
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'\s([.,!?;:\'\)])', r'\1', text)
    text = re.sub(r'([\(])\s', r'\1', text)
    text = re.sub(r'\s*<\|endoftext\|>.*', '', text, flags=re.DOTALL)
    # Cut off at second "Doctor:" to avoid model rambling into new conversations
    parts = re.split(r'(?i)doctor\s*:', text)
    if len(parts) >= 3:
        text = parts[0] + "Doctor:" + parts[1]
    return text.strip()

def generate_medical_response(model, tokenizer, prompt,
                               max_new_tokens=120,
                               temperature=0.35,
                               top_k=35,
                               repetition_penalty=1.4):
    input_ids = tokenizer.encode(prompt, return_tensors="pt").to(device)

    # Safety: truncate if prompt is too long
    if input_ids.shape[1] > 200:
        input_ids = input_ids[:, -200:]

    output = model.generate(
        input_ids,
        max_new_tokens=max_new_tokens,
        temperature=temperature,
        top_k=top_k,
        repetition_penalty=repetition_penalty
    )

    token_ids = output[0].tolist()
    raw = tokenizer._tokenizer.decode(token_ids)
    return clean_text(raw)