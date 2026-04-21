"""SGLang client — hits the OpenAI-compatible /v1/chat/completions surface
and demonstrates JSON-schema-constrained generation (SGLang's marquee feature).

Run `docker compose up -d` or `bash launch.sh` first, then:
    python -m src.client
"""

from __future__ import annotations

import json
import os
import sys

from openai import OpenAI


SGLANG_URL = os.environ.get("SGLANG_URL", "http://localhost:{{port}}/v1")
MODEL_ID = os.environ.get("MODEL_ID", "{{modelId}}")


def _client() -> OpenAI:
    # SGLang ignores the api_key unless configured to require one; a sentinel
    # avoids the OpenAI SDK's "missing key" refusal.
    return OpenAI(base_url=SGLANG_URL, api_key=os.environ.get("SGLANG_API_KEY", "EMPTY"))


def chat(prompt: str) -> str:
    """Plain OpenAI-compatible chat call."""
    response = _client().chat.completions.create(
        model=MODEL_ID,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=256,
        temperature=0.7,
    )
    return response.choices[0].message.content or ""


def chat_structured(prompt: str, schema: dict) -> dict:
    """JSON-schema-constrained generation — SGLang guarantees schema validity."""
    response = _client().chat.completions.create(
        model=MODEL_ID,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=512,
        temperature=0.0,
        extra_body={
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": "structured", "schema": schema, "strict": True},
            },
        },
    )
    content = response.choices[0].message.content or "{}"
    return json.loads(content)


def main() -> int:
    print(f"-> plain chat via {SGLANG_URL}\n")
    try:
        print(chat("Give one sentence on RadixAttention."))
    except Exception as exc:
        print(f"SGLang chat failed: {exc}", file=sys.stderr)
        print(f"Is the server running at {SGLANG_URL}?", file=sys.stderr)
        return 1

    print("\n-> JSON-schema-constrained generation")
    schema = {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "year": {"type": "integer"},
            "keywords": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["name", "year", "keywords"],
        "additionalProperties": False,
    }
    prompt = "Return a JSON object describing the SGLang paper with year and 3 keywords."
    try:
        parsed = chat_structured(prompt, schema)
    except Exception as exc:
        print(f"structured call failed: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(parsed, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
