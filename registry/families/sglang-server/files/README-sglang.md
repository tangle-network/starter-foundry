# SGLang — operator guide

SGLang is an inference engine optimized for two workloads:

1. **Shared prefix traffic** — RadixAttention caches KV across requests that
   share system prompts / few-shot examples / retrieved context.
2. **Structured generation** — constrained decoders guarantee JSON-schema
   and regex validity at the logit level (no retry loops).

## First-run (Docker)

```bash
cp .env.example .env
docker compose up -d
docker compose logs -f sglang   # wait for "Uvicorn running on ..."
curl http://localhost:{{port}}/health
python -m src.client
```

## First-run (bare metal)

```bash
pip install "sglang[all]>=0.3.0"
bash launch.sh
```

`launch.sh` hard-codes the `python -m sglang.launch_server` incantation with
sensible defaults and passes `EXTRA_FLAGS` through for quick overrides.

## Structured generation

SGLang accepts OpenAI-compatible payloads plus a `response_format`:

```python
response = client.chat.completions.create(
    model=MODEL_ID,
    messages=[{"role": "user", "content": "..."}],
    extra_body={"response_format": {"type": "json_schema", "json_schema": {...}}},
)
```

The returned content is **guaranteed** to match the schema — SGLang masks
logits against the grammar so the sampler can only pick valid continuations.
For regex-shaped outputs, use `"type": "regex", "regex": "..."`.

## Swapping / scaling

- **Tensor parallel**: set `TP_SIZE` to GPU count for 70B models.
- **Context length**: tune `CONTEXT_LENGTH` — larger = more KV cache = less
  room for concurrent requests.
- **Torch compile**: add `--enable-torch-compile` to `launch.sh`'s
  `EXTRA_FLAGS` for ~20% lower prefill latency at the cost of ~1min startup.
- **Quantization**: `--quantization awq` / `fp8` supported on matching weights.

## Picking between SGLang, vLLM, TGI, Ollama

- **SGLang**: winner on structured outputs + repeated system prompts.
- **vLLM**: winner on raw free-text throughput at high concurrency.
- **TGI**: Hub ecosystem, docker-first, strongest HF quant support.
- **Ollama**: local GGUF, lowest operator overhead.
