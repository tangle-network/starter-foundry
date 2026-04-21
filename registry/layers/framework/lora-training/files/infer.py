"""Load base + LoRA adapter and generate.

    python infer.py --adapter ./outputs/lora-adapter --prompt "hello"

Loads the base in 4-bit (matching training) and attaches the trained
adapter on top. For production serving, use vLLM's --enable-lora with
--lora-modules <name>=<path> for multi-adapter hot-swapping.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch
import yaml
from dotenv import load_dotenv
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

load_dotenv()


def _load_base_id(adapter_dir: Path) -> str:
    """Read the base model id PEFT records inside the adapter folder."""
    cfg_path = adapter_dir / "adapter_config.json"
    if cfg_path.exists():
        with open(cfg_path, "r", encoding="utf-8") as f:
            return json.load(f)["base_model_name_or_path"]
    # Fallback: read the original train.yaml if the caller points at it.
    train_yaml = Path("config/train.yaml")
    if train_yaml.exists():
        with open(train_yaml, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)["model"]["base_model_id"]
    raise RuntimeError(
        f"Could not determine base model id. Adapter at {adapter_dir} missing "
        "adapter_config.json, and config/train.yaml not found."
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--adapter", type=Path, required=True, help="Path to saved LoRA adapter dir")
    parser.add_argument("--prompt", type=str, required=True, help="Text prompt")
    parser.add_argument("--max-new-tokens", type=int, default=256)
    parser.add_argument("--temperature", type=float, default=0.7)
    parser.add_argument("--no-4bit", action="store_true", help="Load base in bf16 instead of 4-bit")
    args = parser.parse_args()

    base_id = _load_base_id(args.adapter)
    print(f"loading base {base_id} + adapter {args.adapter}")

    tokenizer = AutoTokenizer.from_pretrained(base_id, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    bnb = None
    if not args.no_4bit:
        bnb = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.bfloat16,
            bnb_4bit_use_double_quant=True,
        )

    base = AutoModelForCausalLM.from_pretrained(
        base_id,
        quantization_config=bnb,
        torch_dtype=torch.bfloat16,
        device_map="auto",
        trust_remote_code=True,
    )
    model = PeftModel.from_pretrained(base, str(args.adapter))
    model.eval()

    # Use the same chat template the training data was formatted with.
    messages = [{"role": "user", "content": args.prompt}]
    input_text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )
    inputs = tokenizer(input_text, return_tensors="pt").to(model.device)

    with torch.no_grad():
        output = model.generate(
            **inputs,
            max_new_tokens=args.max_new_tokens,
            temperature=args.temperature,
            do_sample=args.temperature > 0,
            top_p=0.95,
            pad_token_id=tokenizer.pad_token_id,
        )

    generated = tokenizer.decode(output[0][inputs["input_ids"].shape[1] :], skip_special_tokens=True)
    print(generated)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
