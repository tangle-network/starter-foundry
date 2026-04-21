# Family: `vllm-server`

vLLM-based LLM inference server with OpenAI-compatible endpoints. Production-shape model serving — PagedAttention memory, continuous batching, quantization-aware. For AI products that serve their own model instead of calling a provider API.

**Taxonomy**: language=python · runtime=python · surface=api

**Tags**: ml, llm, inference, python, serving, vllm

## When to use

Self-hosted LLM inference with OpenAI-compatible endpoints (/v1/chat/completions, /v1/completions, /v1/models). PagedAttention memory, continuous batching. For products that serve their own model instead of calling a provider API.

## First moves

- Install Python deps: `pip install -r requirements.txt`. Requires CUDA 12.1+ + an NVIDIA GPU; vLLM does NOT run on CPU.
- Set the API key: `export VLLM_API_KEY=$(openssl rand -hex 16)` — the server rejects unauth'd /v1/* without it. To run without auth, set it to empty.
- Edit config.yaml to pick a model. Default is Llama-3.1-8B-Instruct (needs ~16GB VRAM). For 8GB cards add `quantization: awq` and switch to an AWQ-quantized variant.
- Start: `python -m src.server`. First request pulls the model from HuggingFace (multi-minute), then serves.
- Test: `curl http://localhost:{{port}}/v1/chat/completions -H "Authorization: Bearer $VLLM_API_KEY" -H "Content-Type: application/json" -d '{"model":"{{modelId}}","messages":[{"role":"user","content":"hi"}]}'`
- Prometheus metrics at `/metrics`. Scrape + alert on tokens/sec + active-request count for capacity planning.

## Gotchas

- vLLM is CUDA-only. No Metal / ROCm / CPU. Attempting to import on a Mac fails at package resolution — use Modal / RunPod / Lambda / bare-metal for dev.
- First model load takes 1-5 minutes. Keep the container warm; don't rely on autoscale-from-zero unless you budget for cold-start latency.
- The OpenAI SDK expects a real model id string — `{{modelId}}` gets the HF path after compose. Pass it to the client verbatim.
- Quantization (awq/gptq/fp8) affects output quality. Benchmark against your eval set before deploying quantized to prod.
- For multi-GPU, set `tensor_parallel_size` to the GPU count — must divide model heads evenly (usually 2, 4, 8).

## Placeholders (agent MUST replace)

- `config.yaml` — Default points at meta-llama/Meta-Llama-3.1-8B-Instruct. Change `model.id` to the product's actual model (HF path). Adjust quantization + tensor_parallel_size for your hardware.
- `src/server.py` — FastAPI + vLLM wiring. Add product-specific middleware (per-user rate limits, request logging, custom routes) — the default is a bare OpenAI-compat proxy.

## Slots

- `auth` — options: auth:none, auth:better-auth, auth:clerk (default: `auth:none`)

## Routing keywords

- **tier1**: vllm, llm inference server, self-hosted llm, model serving
- **tier2**: openai-compatible api, serve llama, gpu inference, paged attention, continuous batching
- **archetypes**: private llm host, on-prem llm, fine-tuned model deployment, llm inference platform, self-hosted chatgpt alternative
