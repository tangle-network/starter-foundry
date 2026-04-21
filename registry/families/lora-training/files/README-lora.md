# LoRA / QLoRA training — operator guide

4-bit QLoRA fine-tuning on top of a HuggingFace base model, driven by
TRL's `SFTTrainer` and PEFT.

```
data/sample.jsonl  ──►  tokenizer  ──►  4-bit base (frozen)
                                        + LoRA adapters (trained)
                                              │
                                              ▼
                                      outputs/lora-adapter/
```

## First-run

```bash
pip install -e .
cp .env.example .env        # set HUGGING_FACE_HUB_TOKEN for gated bases
# Optional on A100+/H100: install flash-attn and flip attn_implementation
# to 'flash_attention_2' in config/train.yaml.

# Drop your real dataset in:
cat > data/train.jsonl <<'EOF'
{"messages": [{"role":"user","content":"..."}, {"role":"assistant","content":"..."}]}
...
EOF
# Point config/train.yaml:data.path at it.

python train.py --config config/train.yaml
# Checkpoints + adapter land in outputs/lora-adapter/
python infer.py --adapter outputs/lora-adapter --prompt "hello"
```

## What you get

- **QLoRA by default** — base model loads in 4-bit NF4, adapters train in bf16.
  A 7-8B base fits on 16-24GB VRAM; a 70B base fits on one 80GB GPU.
- **target_modules preset** for Llama/Mistral architectures. Gemma/Phi need
  a different list — read the base model's `config.json` and match the
  linear projection names.
- **SFTTrainer** handles the ChatML / Llama chat template automatically when
  the dataset uses a `messages` column. Swap to `text` for raw-text SFT.
- **Paged AdamW 8-bit** optimizer — saves ~4GB of optimizer state vs fp32 Adam.
- **Gradient checkpointing** on — trades ~20% throughput for ~30% less activation memory.

## Serving the trained adapter

```python
# Single adapter: PEFT wrapper directly
from peft import PeftModel
from transformers import AutoModelForCausalLM
base = AutoModelForCausalLM.from_pretrained(BASE, torch_dtype=torch.bfloat16)
model = PeftModel.from_pretrained(base, "./outputs/lora-adapter")

# Multi-adapter serving: vLLM --enable-lora
# vllm serve BASE --enable-lora \
#     --lora-modules my-adapter=./outputs/lora-adapter
```

## Production notes

- **Don't commit merged models** (14GB+). Commit / publish the adapter folder;
  anyone with the base model can load it.
- **W&B / TensorBoard** — set `report_to: 'wandb'` in `config/train.yaml` to
  track loss/grad-norm/lr. Without a tracker you're training blind.
- **Eval before serving** — shipping a LoRA without an eval set is how you
  regress a working base model. Add a held-out set + a basic accuracy check.
- **Rank sweeps**: r in {8, 16, 32, 64} is the useful range. Higher r helps
  for broader task shifts, hurts on narrow ones (overfit risk).
- **Mixing architectures**: every base family needs its own `target_modules`.
  Llama ≠ Mistral ≠ Gemma ≠ Phi here.
