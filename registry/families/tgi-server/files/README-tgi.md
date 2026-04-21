# TGI — operator guide

HuggingFace Text Generation Inference in a docker-compose wrapper. The
container pulls weights from the Hub on first boot into the `./data` volume,
runs HF's production Rust+Python server, and exposes `/generate`,
`/generate_stream`, `/health`, and the OpenAI-compatible `/v1/chat/completions`.

## First-run

```bash
cp .env.example .env
# Edit .env: set HUGGING_FACE_HUB_TOKEN for gated models.
docker compose up -d
docker compose logs -f tgi  # watch weight download + warmup
```

First request after the container is healthy:

```bash
curl http://localhost:{{port}}/generate \
  -H 'Content-Type: application/json' \
  -d '{"inputs": "explain flash attention", "parameters": {"max_new_tokens": 128}}'
```

Or the Python client:

```bash
pip install -r requirements.txt
python -m src.client
```

## Swapping models

Edit `MODEL_ID` in `.env`. Any HF text-generation repo works — TGI loads it
on next `docker compose up`. For large models:

- Set `NUM_SHARD` to your GPU count (tensor parallelism).
- Set `QUANTIZE=awq` (needs AWQ weights) or `QUANTIZE=bitsandbytes-nf4`
  (works on raw weights, slower).
- Raise `shm_size` in `docker-compose.yml` past 1gb if NCCL complains.

## Production notes

- **Pin the image tag** — `ghcr.io/huggingface/text-generation-inference:2.3.1`
  instead of `:latest`. TGI bumps transformers across minors and custom
  architectures silently break.
- **Gated models** need the token AND license acceptance on huggingface.co.
- **Tokens budget**: `MAX_INPUT_LENGTH < MAX_TOTAL_TOKENS` is a hard rule;
  the delta is the generation budget.
- **GPU**: requires nvidia-container-toolkit. Without a GPU the server
  silently runs on CPU and OOMs on any non-tiny model.
- **Metrics**: Prometheus scrape at `/metrics` — tokens/sec, queue depth,
  per-request latency, batch-fill ratio.

## Picking between TGI, vLLM, Ollama

- **TGI**: Hub-native, docker-first, HF ecosystem, strongest quant support.
- **vLLM**: PagedAttention, best throughput at high concurrency, Python-first.
- **Ollama**: local GGUF, lowest operator overhead, Mac/CPU-friendly.
