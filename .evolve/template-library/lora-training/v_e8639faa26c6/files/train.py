"""QLoRA training entrypoint.

    python train.py --config config/train.yaml

Loads a 4-bit-quantized base model, attaches PEFT LoRA adapters on the
configured target_modules, and trains via TRL's SFTTrainer on a JSONL
dataset with a `messages` column. Checkpoints land in training.output_dir.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

import torch
import yaml
from datasets import load_dataset
from dotenv import load_dotenv
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
)
from trl import SFTTrainer

load_dotenv()


def _load_config(path: Path) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def _dtype(name: str) -> torch.dtype:
    return {
        "bfloat16": torch.bfloat16,
        "float16": torch.float16,
        "float32": torch.float32,
    }[name]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, required=True, help="Path to train.yaml")
    args = parser.parse_args()

    cfg = _load_config(args.config)
    model_cfg = cfg["model"]
    lora_cfg = cfg["lora"]
    data_cfg = cfg["data"]
    train_cfg = cfg["training"]

    # --- Tokenizer ------------------------------------------------------
    tokenizer = AutoTokenizer.from_pretrained(
        model_cfg["base_model_id"],
        trust_remote_code=True,
    )
    if tokenizer.pad_token is None:
        # Many causal LMs ship without a pad token; reusing eos is the
        # standard workaround for SFT.
        tokenizer.pad_token = tokenizer.eos_token

    # --- Base model (4-bit QLoRA) --------------------------------------
    bnb_config = None
    if model_cfg.get("load_in_4bit", True):
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type=model_cfg.get("bnb_4bit_quant_type", "nf4"),
            bnb_4bit_compute_dtype=_dtype(model_cfg.get("bnb_4bit_compute_dtype", "bfloat16")),
            bnb_4bit_use_double_quant=model_cfg.get("bnb_4bit_use_double_quant", True),
        )

    model = AutoModelForCausalLM.from_pretrained(
        model_cfg["base_model_id"],
        quantization_config=bnb_config,
        torch_dtype=_dtype(model_cfg.get("bnb_4bit_compute_dtype", "bfloat16")),
        attn_implementation=model_cfg.get("attn_implementation", "sdpa"),
        trust_remote_code=True,
    )
    model.config.use_cache = False  # incompatible with gradient checkpointing

    if bnb_config is not None:
        model = prepare_model_for_kbit_training(
            model,
            use_gradient_checkpointing=train_cfg.get("gradient_checkpointing", True),
        )

    # --- LoRA adapters --------------------------------------------------
    peft_config = LoraConfig(
        r=lora_cfg["r"],
        lora_alpha=lora_cfg["alpha"],
        lora_dropout=lora_cfg.get("dropout", 0.05),
        bias=lora_cfg.get("bias", "none"),
        task_type=lora_cfg.get("task_type", "CAUSAL_LM"),
        target_modules=lora_cfg["target_modules"],
    )
    model = get_peft_model(model, peft_config)
    trainable, total = 0, 0
    for p in model.parameters():
        total += p.numel()
        if p.requires_grad:
            trainable += p.numel()
    print(f"trainable params: {trainable:,} / {total:,} ({100 * trainable / total:.4f}%)")

    # --- Dataset --------------------------------------------------------
    dataset = load_dataset("json", data_files=data_cfg["path"], split="train")
    messages_col = data_cfg.get("messages_column", "messages")
    text_col = data_cfg.get("text_column")

    if text_col and text_col in dataset.column_names:
        formatting_func = None  # raw text — SFTTrainer reads text_col directly
        dataset_text_field = text_col
    elif messages_col in dataset.column_names:
        def _format(example: dict[str, Any]) -> str:
            return tokenizer.apply_chat_template(
                example[messages_col],
                tokenize=False,
                add_generation_prompt=False,
            )
        formatting_func = _format
        dataset_text_field = None
    else:
        raise ValueError(
            f"Dataset at {data_cfg['path']} has no '{messages_col}' or 'text' column"
        )

    # --- Training args --------------------------------------------------
    training_args = TrainingArguments(
        output_dir=train_cfg["output_dir"],
        num_train_epochs=train_cfg["num_train_epochs"],
        per_device_train_batch_size=train_cfg["per_device_train_batch_size"],
        gradient_accumulation_steps=train_cfg["gradient_accumulation_steps"],
        learning_rate=train_cfg["learning_rate"],
        lr_scheduler_type=train_cfg.get("lr_scheduler_type", "cosine"),
        warmup_ratio=train_cfg.get("warmup_ratio", 0.03),
        weight_decay=train_cfg.get("weight_decay", 0.0),
        optim=train_cfg.get("optim", "paged_adamw_8bit"),
        logging_steps=train_cfg.get("logging_steps", 5),
        save_steps=train_cfg.get("save_steps", 50),
        save_total_limit=train_cfg.get("save_total_limit", 3),
        bf16=train_cfg.get("bf16", True),
        gradient_checkpointing=train_cfg.get("gradient_checkpointing", True),
        report_to=train_cfg.get("report_to", "none"),
        seed=train_cfg.get("seed", 42),
    )

    trainer = SFTTrainer(
        model=model,
        args=training_args,
        train_dataset=dataset,
        tokenizer=tokenizer,
        formatting_func=formatting_func,
        dataset_text_field=dataset_text_field,
        max_seq_length=data_cfg.get("max_seq_length", 2048),
        packing=False,
    )

    trainer.train()
    trainer.save_model(train_cfg["output_dir"])
    tokenizer.save_pretrained(train_cfg["output_dir"])
    print(f"adapter saved to {train_cfg['output_dir']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
