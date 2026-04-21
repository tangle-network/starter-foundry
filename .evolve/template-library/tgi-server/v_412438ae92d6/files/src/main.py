"""TGI server entrypoint.

Runs a /generate call (or token-streaming /generate_stream) against a
running TGI server.  Start the server first:

    cp .env.example .env   # set MODEL_ID + HUGGING_FACE_HUB_TOKEN
    docker compose up -d

Then run:

    python -m src.main                          # blocking generate
    python -m src.main --stream "Your prompt"   # streaming
"""

from __future__ import annotations

import os
import sys

from .client import generate, generate_stream

TGI_URL = os.environ.get("TGI_URL", "http://localhost:8080")
DEFAULT_PROMPT = "Explain Flash Attention in one paragraph."


def main() -> int:
    args = sys.argv[1:]
    stream = "--stream" in args
    prompt_parts = [a for a in args if a != "--stream"]
    prompt = " ".join(prompt_parts) if prompt_parts else DEFAULT_PROMPT

    print(f"TGI_URL: {TGI_URL}")
    print(f"> {prompt}\n")

    try:
        if stream:
            for token in generate_stream(prompt):
                print(token, end="", flush=True)
            print()
        else:
            print(generate(prompt))
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        print("Is TGI running?  docker compose up -d", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
