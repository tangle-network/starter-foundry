# AGENTS.md — SkyPilot LLM Serving

Multi-cloud LLM inference endpoint managed by SkyPilot. `sky serve up` provisions
GPU replicas across AWS/GCP/Azure/Kubernetes, auto-picks the cheapest region, handles
spot preemption, and load-balances across replicas. vLLM runs the model on each replica.

## File map

| File | Purpose |
|------|---------|
| `service.yaml` | **Primary config.** GPU type, model ID, replica count, spot flag, vLLM startup command. Edit this first. |
| `sky-serve.yaml` | Controller + load-balancer policy (round-robin, auto-scale rules). Most projects leave this unchanged. |
| `requirements.txt` | SkyPilot + httpx. Run `pip install -r requirements.txt` before any `sky` commands. |
| `.env.example` | Copy to `.env`. Set `HF_TOKEN` for gated models. |
| `validate-skypilot.mjs` | Structural validator — runs locally, no cloud credentials needed. |
| `README.md` | Operator guide with full deploy/teardown workflow. |

## Placeholders that must be filled before deploying

All `{{token}}` strings in the scaffold are intentional template tokens:

| Token | File(s) | Replace with |
|-------|---------|--------------|
| `{{modelId}}` | service.yaml, .env.example | HuggingFace model ID, e.g. `meta-llama/Meta-Llama-3.1-8B-Instruct` |
| `{{acceleratorSpec}}` | service.yaml, .env.example | SkyPilot GPU string: `A100:1`, `A100-80GB:1`, `H100:1`, `L4:1` |
| `{{endpointName}}` | README.md, .env.example | Your service name, e.g. `my-llm` |
| `{{port}}` | service.yaml | Port the inference server binds to — default `8000` |

## Validation (no cloud needed)

```bash
node validate-skypilot.mjs   # must print: skypilot starter ok
```

If it fails, the output names the missing token or file.

## Install and cloud check

```bash
pip install -r requirements.txt

# Authenticate with at least one cloud:
aws configure              # AWS
gcloud auth login          # GCP
kubectl config current-context  # Kubernetes

sky check                  # must show ≥1 enabled cloud before deploying
```

## Deploy / operate / tear down

```bash
# Deploy (pass --env HF_TOKEN=... for gated models)
sky serve up -n <endpointName> service.yaml

# Check replica status — wait for READY (3-10 min cold start)
sky serve status <endpointName>

# Tail replica logs
sky serve logs <endpointName> --target replica 1

# Hit the endpoint (SkyPilot prints the URL once READY)
ENDPOINT=$(sky serve status <endpointName> --endpoint)
curl "$ENDPOINT/v1/chat/completions" \
  -H 'Content-Type: application/json' \
  -d '{"model": "<modelId>", "messages": [{"role":"user","content":"hello"}]}'

# Tear down — ALWAYS run this when done. You are billed while replicas run.
sky serve down <endpointName>
```

## What to customize

- **Model**: Edit `MODEL_ID` in `service.yaml` under `envs:`, or override at launch with `--env MODEL_ID=...`.
- **GPU type**: Edit `accelerators:` in `service.yaml`. SkyPilot picks the cheapest region offering that GPU.
- **Spot savings**: Set `use_spot: true` for 50-80% cost reduction. Tune `readiness_probe.initial_delay_seconds` to your model's actual cold-start time.
- **Replicas**: Change `replicas:` in `service.yaml`. Increase for higher throughput; SkyPilot load-balances automatically.
- **Inference engine**: The `run:` block defaults to vLLM. Replace it with TGI, SGLang, Triton, or a custom FastAPI server — keep the port open and the readiness probe valid.

## Cost safety rules

1. `sky serve down <endpointName>` must be run after every test/demo — replicas bill by the hour.
2. The controller VM runs 24/7 (~$30/mo on AWS). Leave it running across services; tearing it down and up costs more than keeping it live.
3. Add `sky serve down` to any CI teardown step for review environments.
4. For large models (>7B), add `file_mounts` with S3/GCS weight caching before scaling to multiple replicas — each spawn re-downloads weights without it.
