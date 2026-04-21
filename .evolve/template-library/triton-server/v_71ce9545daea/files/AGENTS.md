# {{serviceName}} — NVIDIA Triton Inference Server

## What this scaffold gives you

| File | Purpose |
|---|---|
| `docker-compose.yml` | Triton container with GPU device reservation, model_repository mount, ports {{port}}/{{grpcPort}}/{{metricsPort}} |
| `model_repository/identity/config.pbtxt` | Built-in echo model — passes smoke-test without any real weights |
| `model_repository/identity/1/.gitkeep` | Integer version-dir placeholder (Triton ignores non-integer dirs like `v1/`) |
| `src/client.py` | HTTP (KServe v2) client — infers against the identity model out of the box |
| `src/__init__.py` | Package init so `python -m src.client` resolves without a separate `__main__.py` |
| `requirements.txt` | Runtime pip deps: `tritonclient[http]`, `numpy` |
| `pyproject.toml` | Python project metadata, deps, pyright (basic), ruff |
| `Makefile` | Workflow shortcuts: `install`, `install-dev`, `typecheck`, `up`, `health`, `client` |
| `docs/triton.md` | Extended reference: ONNX/TRT config, dynamic batching, ensemble setup |

## Quick start

```sh
# 1. Install Python deps
make install        # pip install -r requirements.txt
make install-dev    # pip install -e '.[dev]'  (pyright + ruff)

# 2. Start Triton (pulls ~15 GB on first run)
make up             # docker compose up -d

# 3. Wait for ready (Triton takes ~60 s on cold start)
make health         # curl -f http://localhost:{{port}}/v2/health/ready

# 4. Run inference smoke-test against the identity model
make client         # python -m src.client  →  output: [1.0, 2.0, 3.0, 4.0]

# 5. Typecheck
make typecheck      # pyright src/  — zero errors out of the box
```

## Add a real model

1. Drop weights under `model_repository/<name>/<version>/` — version **must** be an integer:
   ```
   model_repository/
   └── my_model/
       ├── config.pbtxt
       └── 1/
           └── model.onnx
   ```
2. Write `config.pbtxt` — use `backend` **or** `platform` (never both):
   - ONNX: `backend: "onnxruntime"`
   - TensorRT: `platform: "tensorrt_plan"`
   - Python custom: `backend: "python"`
3. Triton polls `model_repository/` every 30 s. Force an immediate reload:
   ```sh
   curl -X POST http://localhost:{{port}}/v2/repository/models/my_model/load
   ```
4. Edit `src/client.py` — update `MODEL_NAME`, input/output tensor names, and shape to match your model.

## Key extension points

- **New model** — add `model_repository/<name>/config.pbtxt` + integer version dir with weights
- **Ensemble** — add `ensemble_scheduling` block in `config.pbtxt` to chain existing models
- **Client code** — edit `src/client.py`; run `make client` to iterate
- **Pin the image** — replace `nvcr.io/nvidia/tritonserver:latest` with a specific tag (e.g. `24.10-py3`) in `docker-compose.yml` to avoid surprise breaks on TRT engine rebuilds

## Critical gotchas

- **Integer version dirs only.** `1/`, `2/` work; `v1/`, `latest/` are silently skipped — no error, no warning.
- **`platform` and `backend` are mutually exclusive.** Mixing them causes an opaque model-load failure.
- **Dynamic dims** — use `-1` in `dims: [ -1 ]` for variable-size axes. Wrong dims → `inference failed` with no usable stack trace.
- **TRT engines are GPU-specific.** A `.plan` built on A100 will not load on H100 — rebuild per deploy target.
- **KServe v2 protocol** — endpoints are `/v2/models/<name>/infer`, not the legacy `/api/infer`.
- **Image is ~15 GB.** First `docker compose up` takes 10–20 min. Pin the tag so you don't re-pull unexpectedly.
