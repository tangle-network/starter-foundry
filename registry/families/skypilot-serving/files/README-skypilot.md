# SkyPilot Serving — operator guide

Multi-cloud vLLM deployment via SkyPilot. One YAML (`service.yaml`)
describes the replica; `sky serve up` provisions + load-balances + handles
spot preemption across AWS / GCP / Azure / on-prem Kubernetes.

## First-run

```bash
pip install -r requirements.txt

# Authenticate with at least one cloud:
aws configure              # or: gcloud auth login / kubectl config ...
sky check                  # should show ≥1 enabled cloud

# Deploy. Pass HF_TOKEN via --env for gated models.
sky serve up -n {{endpointName}} service.yaml --env HF_TOKEN=$HF_TOKEN

# Watch the replica come up (3-10 min cold start for big models).
sky serve status {{endpointName}}
sky serve logs {{endpointName}} --target replica 1

# Hit the endpoint (sky prints the URL once replica is READY).
ENDPOINT=$(sky serve status {{endpointName}} --endpoint)
curl "$ENDPOINT/v1/chat/completions" \
  -H 'Content-Type: application/json' \
  -d '{"model": "{{modelId}}", "messages": [{"role":"user","content":"hi"}]}'

# Tear down — IMPORTANT, you're billed while this runs.
sky serve down {{endpointName}}
```

## Cost knobs

- `use_spot: true` in `service.yaml.resources` → 50-80% cheaper, ~5min MTTR on preemption.
- `replicas: N` scales the backend fleet. SkyPilot picks the cheapest region per replica.
- Pin `cloud: aws` / `cloud: gcp` to stay in one cloud; leave unset for multi-cloud optimization.
- The controller VM runs 24/7 (~$30/mo on AWS). Leave it up — spinning up/down costs more than keeping it on.

## Swapping the inference engine

The `run:` block in `service.yaml` invokes vLLM. Swap in TGI, SGLang, Triton,
or a custom FastAPI app — SkyPilot just needs `ports:` opened and a
`readiness_probe`. Example TGI run block:

```yaml
run: |
  docker run --rm --gpus all \
    -p {{port}}:80 \
    -e HUGGING_FACE_HUB_TOKEN="$HF_TOKEN" \
    -v ~/data:/data \
    ghcr.io/huggingface/text-generation-inference:2.3.1 \
    --model-id "$MODEL_ID"
```

## Production notes

- **Spend control**: `sky serve down` is not optional. Add a CI teardown
  step for review environments.
- **Weights caching**: first spawn pulls weights; subsequent replicas on the
  same region/AZ re-pull. Use `file_mounts` with S3/GCS for persistent weight
  caches on large models.
- **Kubernetes backend**: works with any K8s that exposes NVIDIA GPUs
  (GKE/EKS + nvidia-device-plugin). Mix and match with cloud backends.
- **Credentials in CI**: plumb AWS/GCP/K8s configs explicitly; SkyPilot reads
  from the standard locations (~/.aws, ~/.config/gcloud, ~/.kube).

## When NOT to use SkyPilot

If the product runs on a single pinned host (on-prem, one cloud, one region),
skip SkyPilot and deploy the raw `vllm-server` / `tgi-server` scaffolds
directly. SkyPilot's value is multi-cloud / spot / autoscale. On a fixed box
it's overhead.
