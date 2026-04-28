"""Proposer — LLM-driven hypothesis variant generator.

Given the current queue + recent results, asks an OpenAI-compatible
model (router.tangle.tools) to propose N new hypothesis variants.

The proposer is intentionally minimal: it builds a strict prompt,
expects a JSON-array response, validates each entry against the
`Hypothesis` schema, and appends valid entries to the queue. Invalid
entries are discarded with a structured error — never silently
dropped without surfacing why.
"""

from __future__ import annotations

import json
import os
from typing import Any

import httpx
from pydantic import ValidationError

from .types import Hypothesis, ProposerConfig

PROPOSER_SYSTEM_PROMPT = """You are the proposer in a research harness.
Given the current hypothesis queue and recent validation verdicts,
propose new hypothesis variants that explore the design space the
existing queue has not yet covered.

Output rules:
- Reply with a single JSON array of hypothesis objects. Nothing else.
- Each hypothesis object must include: id, description (>= 20 chars),
  treatment {description, files, env}, baseline {description, files,
  env}, scenarios (>=1, each with id/description/command), metrics
  (>=1, unique).
- ids must be kebab-case and unique across the queue.
- Do not repeat any id already in the queue.
"""


def _client(api_key: str, base_url: str) -> httpx.Client:
    return httpx.Client(
        base_url=base_url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        timeout=httpx.Timeout(60.0, connect=10.0),
    )


def _build_user_prompt(
    queue: list[Hypothesis],
    recent_verdicts: list[dict[str, Any]],
    n_proposals: int,
) -> str:
    return json.dumps(
        {
            "n_proposals": n_proposals,
            "queue": [h.model_dump(by_alias=True) for h in queue],
            "recent_verdicts": recent_verdicts,
            "instruction": (
                f"Propose {n_proposals} new hypotheses. Avoid duplicates "
                "of any id in the queue."
            ),
        },
        indent=2,
    )


def propose(
    queue: list[Hypothesis],
    recent_verdicts: list[dict[str, Any]] | None = None,
    config: ProposerConfig | None = None,
    *,
    api_key: str | None = None,
) -> tuple[list[Hypothesis], list[str]]:
    """Generate `config.n_proposals` new hypothesis variants.

    Returns a tuple `(valid, errors)`:

    - `valid`  — `Hypothesis` instances that parsed cleanly and don't
      collide with existing queue ids.
    - `errors` — string descriptions of every entry that was rejected
      (so the operator sees what was discarded and why).

    The function does NOT mutate the queue. The caller decides whether
    to persist the new entries.
    """
    cfg = config or ProposerConfig()
    key = api_key or os.environ.get("TANGLE_API_KEY", "")
    if not key:
        raise RuntimeError("TANGLE_API_KEY is required for propose()")

    body = {
        "model": cfg.model,
        "temperature": cfg.temperature,
        "max_tokens": cfg.max_tokens,
        "messages": [
            {"role": "system", "content": PROPOSER_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": _build_user_prompt(
                    queue, recent_verdicts or [], cfg.n_proposals
                ),
            },
        ],
    }

    with _client(key, cfg.base_url) as client:
        resp = client.post("/chat/completions", json=body)
        resp.raise_for_status()
        payload = resp.json()

    text = payload["choices"][0]["message"]["content"].strip()
    if text.startswith("```"):
        # Strip a fenced code block if the model wrapped its reply.
        lines = text.splitlines()
        text = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])

    try:
        raw = json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(f"proposer returned non-JSON content: {e}") from e
    if not isinstance(raw, list):
        raise ValueError(f"proposer returned non-array root: {type(raw).__name__}")

    existing_ids = {h.id for h in queue}
    valid: list[Hypothesis] = []
    errors: list[str] = []
    for i, entry in enumerate(raw):
        try:
            h = Hypothesis.model_validate(entry)
        except ValidationError as e:
            errors.append(f"entry[{i}]: {e}")
            continue
        if h.id in existing_ids or h.id in {v.id for v in valid}:
            errors.append(f"entry[{i}]: duplicate id '{h.id}'")
            continue
        valid.append(h)
    return valid, errors
