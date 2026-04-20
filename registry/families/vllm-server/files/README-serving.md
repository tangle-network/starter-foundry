# vLLM serving — operator guide

This scaffold is a production-shape LLM inference server. It exposes
OpenAI-compatible endpoints (`/v1/chat/completions`, `/v1/completions`,
`/v1/models`) so any OpenAI-SDK client can point at it and work unchanged.

## First-run

```bash
pip install -r requirements.txt
export VLLM_API_KEY=$(openssl rand -hex 16)
python -m src.server
```

Server boots, pulls the model from HuggingFace on first request, warms up
PagedAttention caches, then serves. Call it:

```bash
curl http://localhost:{{port}}/v1/chat/completions \
  -H "Authorization: Bearer $VLLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "{{modelId}}",
    "messages": [{"role": "user", "content": "explain pagedattention"}]
  }'
```

## Swapping models

Edit `config.yaml`'s `model.id` to any HuggingFace model id supported by
vLLM. First request after a change re-pulls + re-warms. For large models:
set `tensor_parallel_size` to your GPU count, enable `quantization: awq`
(or `fp8` on H100+).

## Production notes

- **Memory**: PagedAttention spills KV cache to host memory above GPU cap.
  Set `gpu_memory_utilization` in config.yaml if the default (0.9) conflicts
  with other tenants on the same box.
- **Batching**: continuous batching is on by default. Higher concurrency =
  better throughput; the server handles its own queue.
- **Auth**: set `VLLM_API_KEY`. Unauthenticated requests return 401. For
  multi-tenant, put an auth gateway (Clerk, better-auth) in front —
  `slot: auth` is available on this family.
- **Metrics**: Prometheus scrape at `/metrics`. Latency histograms,
  tokens/sec, active requests, cache hit rate.
- **GPU sizing**: Llama-3-8B in bf16 needs ~16GB. Quantize to AWQ for 8GB.
  70B needs tensor-parallel across 2xA100-80GB or 4xA100-40GB.

## Swapping inference engine

vLLM is one of several modern serving engines. Drop-in alternatives with
similar OpenAI-compatible surfaces:

- **sglang** — newer, better for structured generation (JSON mode, tool calls)
- **ollama** — local-first, handles quantized GGUF models out-of-the-box
- **TGI (text-generation-inference)** — HuggingFace's own server

All share the OpenAI-compatible endpoint shape, so migration is a
requirements.txt + server.py change, not a rewrite.
