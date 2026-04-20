"""vLLM inference server with OpenAI-compatible endpoints.

FastAPI app that fronts vLLM's AsyncLLMEngine. The OpenAI-compatible
routes (/v1/chat/completions, /v1/completions, /v1/models) are delegated
to vLLM's OpenAIServingChat / OpenAIServingCompletion so existing OpenAI
SDK clients work unchanged.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

import uvicorn
import yaml
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse


def load_config(path: str = "config.yaml") -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


CONFIG = load_config()
API_KEY_ENV = CONFIG["server"].get("api_key_env", "VLLM_API_KEY")
EXPECTED_API_KEY = os.environ.get(API_KEY_ENV)


def require_api_key(request: Request) -> None:
    if not EXPECTED_API_KEY:
        # No key configured — endpoints are open. Accept anything.
        return
    header = request.headers.get("authorization", "")
    token = header.removeprefix("Bearer ").strip()
    if token != EXPECTED_API_KEY:
        raise HTTPException(status_code=401, detail="invalid api key")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Lazy-import vLLM so `python -m src.server --help`-style invocations
    # don't require CUDA/Triton to be available.
    from vllm.engine.arg_utils import AsyncEngineArgs
    from vllm.engine.async_llm_engine import AsyncLLMEngine
    from vllm.entrypoints.openai.serving_chat import OpenAIServingChat
    from vllm.entrypoints.openai.serving_completion import OpenAIServingCompletion

    model_cfg = CONFIG["model"]
    engine_args = AsyncEngineArgs(
        model=model_cfg["id"],
        max_model_len=model_cfg.get("max_model_len", 4096),
        quantization=model_cfg.get("quantization"),
        tensor_parallel_size=model_cfg.get("tensor_parallel_size", 1),
        gpu_memory_utilization=model_cfg.get("gpu_memory_utilization", 0.9),
    )
    engine = AsyncLLMEngine.from_engine_args(engine_args)
    app.state.engine = engine
    app.state.chat = OpenAIServingChat(
        engine_client=engine,
        model_config=await engine.get_model_config(),
        served_model_names=[model_cfg["id"]],
        response_role="assistant",
        lora_modules=None,
        prompt_adapters=None,
        request_logger=None,
        chat_template=None,
    )
    app.state.completion = OpenAIServingCompletion(
        engine_client=engine,
        model_config=await engine.get_model_config(),
        served_model_names=[model_cfg["id"]],
        lora_modules=None,
        prompt_adapters=None,
        request_logger=None,
    )
    yield


app = FastAPI(title="{{serviceName}}", lifespan=lifespan)


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "service": "{{serviceName}}",
        "model": CONFIG["model"]["id"],
        "runtime": "vllm",
    }


@app.get("/v1/models")
async def list_models(_: None = Depends(require_api_key)) -> dict:
    return {
        "object": "list",
        "data": [
            {
                "id": CONFIG["model"]["id"],
                "object": "model",
                "created": 0,
                "owned_by": "{{serviceName}}",
            }
        ],
    }


@app.post("/v1/chat/completions")
async def chat_completions(request: Request, _: None = Depends(require_api_key)):
    payload = await request.json()
    return await request.app.state.chat.create_chat_completion(payload, request)


@app.post("/v1/completions")
async def completions(request: Request, _: None = Depends(require_api_key)):
    payload = await request.json()
    return await request.app.state.completion.create_completion(payload, request)


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"message": exc.detail, "type": "api_error"}},
    )


if __name__ == "__main__":
    uvicorn.run(
        "src.server:app",
        host=CONFIG["server"].get("host", "0.0.0.0"),
        port=int(CONFIG["server"].get("port", {{port}})),
        log_level="info",
    )
