"""Tiny TGI client. Hits /generate and /generate_stream on a running TGI server.

Run `docker compose up -d` first, then `python -m src.client`.
"""

from __future__ import annotations

import json
import os
import sys
from typing import Iterator

import httpx


TGI_URL = os.environ.get("TGI_URL", "http://localhost:{{port}}")
DEFAULT_PROMPT = "Explain Flash Attention in one paragraph."


def generate(prompt: str, max_new_tokens: int = 128, temperature: float = 0.7) -> str:
    """Call TGI's native /generate endpoint. Returns the generated text only."""
    payload = {
        "inputs": prompt,
        "parameters": {
            "max_new_tokens": max_new_tokens,
            "temperature": temperature,
            "do_sample": temperature > 0,
            "return_full_text": False,
        },
    }
    with httpx.Client(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
        response = client.post(f"{TGI_URL}/generate", json=payload)
        response.raise_for_status()
        body = response.json()
    # TGI returns {"generated_text": "..."} for non-stream, or a list when
    # best_of > 1. Normalize both shapes.
    if isinstance(body, list):
        return body[0]["generated_text"]
    return body["generated_text"]


def generate_stream(prompt: str, max_new_tokens: int = 128, temperature: float = 0.7) -> Iterator[str]:
    """Stream tokens from /generate_stream. Yields one token string per chunk."""
    payload = {
        "inputs": prompt,
        "parameters": {
            "max_new_tokens": max_new_tokens,
            "temperature": temperature,
            "do_sample": temperature > 0,
        },
    }
    with httpx.Client(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
        with client.stream("POST", f"{TGI_URL}/generate_stream", json=payload) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if not line or not line.startswith("data:"):
                    continue
                data = json.loads(line[len("data:") :].strip())
                token = data.get("token", {}).get("text")
                if token:
                    yield token


def main() -> int:
    prompt = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else DEFAULT_PROMPT
    print(f"> {prompt}\n")
    try:
        output = generate(prompt)
    except httpx.HTTPError as exc:
        print(f"TGI request failed: {exc}", file=sys.stderr)
        print(f"Is the server running at {TGI_URL}? `docker compose up -d`", file=sys.stderr)
        return 1
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
