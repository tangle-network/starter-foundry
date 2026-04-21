# {{serviceName}} — Ollama self-hosted LLM

Local-first inference powered by Ollama (llama.cpp under the hood). OpenAI-style `/api/generate` and `/api/chat` endpoints on port 11434.

## Quickstart

```sh
docker compose up -d
docker compose exec ollama ollama pull llama3.2
pnpm install
pnpm dev
```

## Customize the model

Edit `Modelfile`, then:

```sh
docker compose exec ollama ollama create my-model -f /root/.ollama/Modelfile
```

Mount the Modelfile into the container if you want `ollama create` to pick it up automatically.

## Endpoints

- `GET /api/tags` — list loaded models
- `POST /api/generate` — non-streaming or newline-delimited JSON stream
- `POST /api/chat` — multi-turn chat with role messages

## GPU

Uncomment the `deploy.resources` block in `docker-compose.yml`, install `nvidia-container-toolkit` on the host, and restart.
