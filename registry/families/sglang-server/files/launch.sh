#!/usr/bin/env bash
# Bare-metal SGLang launch. Use this when running SGLang in a venv/conda on
# the host instead of via docker-compose. Requires a matching CUDA toolkit.
#
#     pip install "sglang[all]>=0.3.0"
#     bash launch.sh
#
set -euo pipefail

MODEL_ID="${MODEL_ID:-{{modelId}}}"
PORT="${PORT:-{{port}}}"
CONTEXT_LENGTH="${CONTEXT_LENGTH:-{{contextLength}}}"
MEM_FRACTION_STATIC="${MEM_FRACTION_STATIC:-0.85}"
TP_SIZE="${TP_SIZE:-1}"

# shellcheck disable=SC2086 # deliberately word-split extra flags
EXTRA_FLAGS="${EXTRA_FLAGS:-}"

exec python -m sglang.launch_server \
  --model-path "$MODEL_ID" \
  --host 0.0.0.0 \
  --port "$PORT" \
  --context-length "$CONTEXT_LENGTH" \
  --mem-fraction-static "$MEM_FRACTION_STATIC" \
  --tp-size "$TP_SIZE" \
  $EXTRA_FLAGS
