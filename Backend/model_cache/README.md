---
license: apache-2.0
language:
- en
pipeline_tag: text-generation
tags:
- medical
- slm
- biology
- healthcare
- pytorch
datasets:
- pubmed_qa
- medmcqa
- BI55/MedText
metrics:
- perplexity
- loss
library_name: transformers
---
# 🏥 VitalLM-50M: Specialized Medical SLM

> **A 50.55 million parameter Small Language Model (SLM) architected for high-fidelity clinical reasoning and medical text generation.**

VitalLM-50M is a custom-built, decoder-only Transformer designed to bridge the gap between general-purpose small models and specialized medical assistants. By leveraging a custom biomedical corpus and advanced architectural features like SwiGLU, this model achieves a high level of medical coherence within a compact 50M parameter footprint.

---

## 🚀 Key Innovations & Architectural Choices

### 1. SwiGLU Activation Function
Unlike standard GPT models that use ReLU or GeLU, VitalLM-50M utilizes **SwiGLU**. This choice was made to increase the model's "reasoning density," allowing it to better capture the complex, non-linear relationships found in medical symptoms and drug interactions.

### 2. Specialized Tokenization
We developed a custom **ByteLevelBPE Tokenizer** with a 16,384 vocabulary size. 
* **Rationale**: Standard tokenizers (like GPT-2) are often inefficient for medical terminology (e.g., splitting "bronchitis" into too many fragments). Our custom tokenizer ensures that medical terms are preserved as meaningful units, significantly improving inference speed and accuracy.

### 3. Weight Tying (Linear Bottleneck)
The embedding layer and the final output linear layer share weights. This reduces the total parameter count by ~8M without sacrificing intelligence, allowing for a deeper architecture (10 layers) within a 50M parameter budget.

---

## 📊 Technical Specifications

| Parameter | Value | Rationale |
| :--- | :--- | :--- |
| **Total Parameters** | 50.55 Million | Optimal for edge deployment/mobile devices. |
| **Layers (n_layer)** | 10 | Provides sufficient depth for hierarchical clinical logic. |
| **Heads (n_head)** | 8 | Balances multi-head attention with memory overhead. |
| **Embed Dim (n_embd)**| 512 | High-resolution vector space for medical concepts. |
| **Context Window** | 256 tokens | Focused on short-to-medium clinical dialogues. |

---

## 📈 Training Methodology & Metrics

### Data Strategy
* **Corpus**: 764M+ tokens of filtered biomedical research, clinical guidelines, and synthetic medical dialogues.
* **Pre-processing**: Extensive de-duplication and cleaning to ensure the model learned clinical "signal" rather than dataset noise.

### Training Hardware & Schedule
* **Compute**: NVIDIA P100 GPU (Kaggle).
* **Strategy**: Multi-session training with custom state-recovery logic to handle session timeouts.
* **Optimization**: AdamW with Weight Decay (0.1) and a Cosine Learning Rate Scheduler.

### Final Results
* **Final Training Loss**: 3.3233
* **Final Validation Loss**: 3.6676
* **Generalization Gap**: 0.3443 



## 🛠 Usage & Implementation


```python
import torch
import torch.nn.functional as F
from model import SLM, SLMConfig 
from transformers import PreTrainedTokenizerFast

# 1. Hardware Setup
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {device}")

# 2. Initialize Architecture from your config.json
config = SLMConfig(
    vocab_size=16384,
    n_layer=10,
    n_head=8,
    n_embd=512,
    block_size=256,
    dropout=0.0  # Set to 0.0 for stable inference
)
model = SLM(config)

# 3. Load the Weights
weights_path = "vital_lm_50m_weights.pt"
print(f"Loading weights from {weights_path}...")
state_dict = torch.load(weights_path, map_location=device)
model.load_state_dict(state_dict)
model.to(device)
model.eval()

# 4. Initialize Tokenizer
tokenizer = PreTrainedTokenizerFast(
    tokenizer_object=None,
    vocab_file="vocab_50m.json",
    merges_file="merges_50m.txt",
    bos_token="<|endoftext|>",
    eos_token="<|endoftext|>",
    unk_token="<|endoftext|>",
    pad_token="<|endoftext|>"
)

# 5. Optimized Generation Function
def generate_medical_response(prompt, max_new_tokens=150, temperature=0.4, top_k=40):
    # Encode prompt
    input_ids = torch.tensor(tokenizer.encode(prompt)).unsqueeze(0).to(device)
    
    with torch.no_grad():
        for _ in range(max_new_tokens):
            # Ensure we don't exceed the 256 context window
            input_ids_cond = input_ids[:, -256:]
            
            # Forward pass
            logits, _ = model(input_ids_cond)
            
            # Scale by temperature (lower = more factual/conservative)
            logits = logits[:, -1, :] / temperature
            
            # Top-K filtering to remove "low probability noise"
            if top_k is not None:
                v, _ = torch.topk(logits, min(top_k, logits.size(-1)))
                logits[logits < v[:, [-1]]] = -float('Inf')
            
            # Sample next token
            probs = F.softmax(logits, dim=-1)
            next_token = torch.multinomial(probs, num_samples=1)
            
            # Append to sequence
            input_ids = torch.cat((input_ids, next_token), dim=1)
            
            # Stop if the model generates the End-of-Text token
            if next_token.item() == tokenizer.eos_token_id:
                break
                
    return tokenizer.decode(input_ids[0].tolist(), skip_special_tokens=True)

# 6. Live Test
if __name__ == "__main__":
    test_prompt = "Patient: I have been feeling very thirsty and urinating frequently. Doctor:"
    print("\n--- Generating Response ---")
    response = generate_medical_response(test_prompt)
    print(response)