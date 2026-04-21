# Triton — operator guide

NVIDIA Triton Inference Server, serving the models laid out in
`model_repository/`. This scaffold ships an `identity` echo model so you
can smoke-test the server before you add real weights.

## Layout

```
model_repository/
  <model_name>/
    config.pbtxt        # inputs, outputs, backend, batching
    1/                  # version dir (MUST be an integer)
      model.onnx        # or model.plan (TRT), model.py (Python), ...
```

## First-run

```bash
docker compose up -d
curl http://localhost:{{port}}/v2/health/ready    # wait for HTTP 200
pip install -r requirements.txt
python -m src.client                              # echoes via identity model
```

## Adding a real model

```bash
# ONNX example
mkdir -p model_repository/resnet50/1
cp /path/to/resnet50.onnx model_repository/resnet50/1/model.onnx
cat > model_repository/resnet50/config.pbtxt <<'EOF'
name: "resnet50"
backend: "onnxruntime"
max_batch_size: 32
input  [{ name: "input"  data_type: TYPE_FP32  dims: [3, 224, 224] }]
output [{ name: "output" data_type: TYPE_FP32  dims: [1000]        }]
dynamic_batching { preferred_batch_size: [8, 16, 32] }
EOF
# With --model-control-mode=poll, Triton auto-loads within 30s.
curl http://localhost:{{port}}/v2/models/resnet50/ready
```

## Production notes

- **Pin the image tag** — `nvcr.io/nvidia/tritonserver:24.10-py3` or whatever
  matches the CUDA version your TRT engines were built against.
- **TRT engines are GPU-specific**. `.plan` files compiled for A100 will not
  run on H100 (and vice versa). Rebuild per deploy target.
- **Metrics** live at `http://localhost:{{metricsPort}}/metrics` — Prometheus
  format, per-model latency histograms, queue depth, GPU utilization.
- **Model control**: in prod, use `--model-control-mode=explicit` and
  POST to `/v2/repository/models/<name>/load`. `poll` is handy in dev
  but racy under rapid deploys.
- **Ensembles**: model_repository supports `platform: "ensemble"` with
  `ensemble_scheduling` steps for preprocess → model → postprocess pipelines
  that run entirely inside Triton.

## Picking between Triton and the LLM servers

- **Triton**: classical ML (CV/ASR/embeddings/rec), ONNX/TRT, mixed pipelines.
- **vLLM / SGLang / TGI**: pure LLM serving, faster for that specific shape.

Use Triton when the model isn't an LLM or when you're combining LLM + vision
encoders + classical postprocess in a single-server pipeline.
