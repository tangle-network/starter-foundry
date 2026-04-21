# SGLang Inference Server

OpenAI-compatible inference server powered by [SGLang](https://github.com/sgl-project/sglang) — RadixAttention prefix caching and constrained JSON generation.

## Quick start

```sh
cp .env.example .env          # set MODEL_ID + optional HUGGING_FACE_HUB_TOKEN
docker compose up -d          # GPU host — pulls lmsysorg/sglang
# OR
bash launch.sh                # bare-metal with `pip install "sglang[all]>=0.3.0"`
```

Wait for ready:

```sh
curl http://localhost:30000/health
```

Run the example client:

```sh
pip install -r requirements.txt
python -m src.client
```

## Development

```sh
pip install -e '.[dev]'       # pyright + ruff
make typecheck                # pyright src/
make lint                     # ruff check src/
make client                   # python -m src.client (server must be up)
```

## Layout

| Path | Purpose |
|------|---------|
| `docker-compose.yml` | GPU inference container |
| `launch.sh` | Bare-metal server startup |
| `src/client.py` | OpenAI-compatible client with JSON-schema demo |
| `src/__init__.py` | Python package marker |
| `pyproject.toml` | Deps + pyright/ruff config |
| `.env.example` | Environment variable template |
| `docs/sglang.md` | Architecture notes and gotchas |

## Key environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MODEL_ID` | `meta-llama/Meta-Llama-3.1-8B-Instruct` | HuggingFace model path |
| `SGLANG_URL` | `http://localhost:30000/v1` | Client target URL |
| `HUGGING_FACE_HUB_TOKEN` | — | Required for gated models |
| `MEM_FRACTION_STATIC` | `0.85` | GPU KV-cache memory fraction |
| `CONTEXT_LENGTH` | `8192` | Max sequence length |
