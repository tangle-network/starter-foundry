"""LLM-as-judge over a multi-dimension rubric, via router.tangle.tools.

Wire shape: OpenAI-compatible ``/v1/chat/completions``. The harness sends a
single user message containing the input, expected_output, actual_output,
and the rubric (as JSON), and asks the model to respond with a single JSON
object scoring each dimension 0..1 plus rationale. We parse strict JSON and
surface a structured error when parsing fails — never coerce.

Failure modes are explicit:

- HTTP non-2xx → ``RubricResult(ok=False, ...)`` with the body in ``error``.
- JSON parse error → same.
- Missing dimension in the response → same (the run records ``unmeasured``,
  not a fabricated score).
- ``TANGLE_ROUTER_KEY`` unset → raise ``RuntimeError``; the runner converts
  to a top-level ``[blocked]``.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any

import httpx
from pydantic import BaseModel, ConfigDict, Field

DEFAULT_BASE_URL = "https://router.tangle.tools/v1"
DEFAULT_MODEL = "anthropic/claude-sonnet-4.5"
DEFAULT_TIMEOUT_SEC = 60.0


class JudgeInput(BaseModel):
    """What the judge sees."""

    model_config = ConfigDict(extra="forbid")

    scenario: str
    input: str
    expected_output: str | None = None
    actual_output: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class RubricDimension(BaseModel):
    """One scoring axis."""

    model_config = ConfigDict(extra="forbid")

    name: str
    description: str
    weight: float = 1.0


class JudgeResult(BaseModel):
    """Generic judge result interface — RubricResult is the default impl."""

    model_config = ConfigDict(extra="forbid")

    score: float  # 0..1, weighted mean across dimensions
    ok: bool
    rationale: str | None = None
    error: str | None = None


class RubricResult(JudgeResult):
    """Multi-dim judge result — per-dimension scores plus weighted mean."""

    dimensions: dict[str, float] = Field(default_factory=dict)
    raw_response: str | None = None


@dataclass
class RubricJudge:
    """LLM-as-judge over a fixed rubric.

    Instantiate once per scenario suite (rubrics rarely vary per-scenario).
    Calling the judge returns a :class:`RubricResult`.
    """

    name: str
    dimensions: list[RubricDimension]
    model: str = DEFAULT_MODEL
    base_url: str = DEFAULT_BASE_URL
    api_key_env: str = "TANGLE_ROUTER_KEY"
    timeout_sec: float = DEFAULT_TIMEOUT_SEC
    system_prompt: str = (
        "You are a strict eval judge. Given an input, the expected output, "
        "and the actual output, score each rubric dimension on a 0..1 scale "
        "(0=fails dimension, 0.5=partial, 1=fully meets). Respond with a "
        "single JSON object on one line: "
        '{"dimensions":{"<name>":<score>,...},"rationale":"<one sentence>"}. '
        "Do not include any text outside the JSON. Do not score dimensions "
        "you weren't given."
    )

    def __post_init__(self) -> None:
        if not self.dimensions:
            raise ValueError("RubricJudge requires at least one dimension")
        weights = [d.weight for d in self.dimensions]
        if any(w <= 0 for w in weights):
            raise ValueError("RubricJudge dimension weights must be positive")

    # ------------------------------------------------------------------
    # API key resolution
    # ------------------------------------------------------------------

    def _resolve_api_key(self) -> str:
        key = os.environ.get(self.api_key_env)
        if not key:
            raise RuntimeError(
                f"GAP: env var {self.api_key_env} is unset; RubricJudge cannot reach "
                f"{self.base_url}. Set it or run with --no-judge."
            )
        return key

    # ------------------------------------------------------------------
    # Prompt construction
    # ------------------------------------------------------------------

    def _build_user_message(self, ji: JudgeInput) -> str:
        rubric = [
            {"name": d.name, "description": d.description, "weight": d.weight}
            for d in self.dimensions
        ]
        payload = {
            "scenario": ji.scenario,
            "input": ji.input,
            "expected_output": ji.expected_output,
            "actual_output": ji.actual_output,
            "rubric": rubric,
        }
        return json.dumps(payload, ensure_ascii=False)

    # ------------------------------------------------------------------
    # Response parsing
    # ------------------------------------------------------------------

    def _parse_response(self, raw: str) -> RubricResult:
        # The model is instructed to emit a single JSON object on one line.
        # Be tolerant of markdown code fences (some models add them despite
        # instructions); strip them and retry.
        candidate = raw.strip()
        if candidate.startswith("```"):
            # Remove leading fence (```json\n or ```\n) and trailing ```
            candidate = candidate.strip("`")
            # After stripping backticks both sides, optional language tag
            # remains as the first token until newline.
            if "\n" in candidate:
                first, rest = candidate.split("\n", 1)
                if first.strip().lower() in {"json", ""}:
                    candidate = rest
        try:
            obj = json.loads(candidate)
        except json.JSONDecodeError as err:
            return RubricResult(
                score=0.0,
                ok=False,
                error=f"judge response not JSON: {err}",
                raw_response=raw,
            )

        dims = obj.get("dimensions")
        if not isinstance(dims, dict):
            return RubricResult(
                score=0.0,
                ok=False,
                error="judge response missing 'dimensions' object",
                raw_response=raw,
            )

        # Every declared dimension must be present and a float in [0, 1].
        scored: dict[str, float] = {}
        for d in self.dimensions:
            if d.name not in dims:
                return RubricResult(
                    score=0.0,
                    ok=False,
                    error=f"judge response missing dimension {d.name!r}",
                    raw_response=raw,
                )
            try:
                v = float(dims[d.name])
            except (TypeError, ValueError):
                return RubricResult(
                    score=0.0,
                    ok=False,
                    error=f"dimension {d.name!r} not numeric: {dims[d.name]!r}",
                    raw_response=raw,
                )
            if not 0.0 <= v <= 1.0:
                return RubricResult(
                    score=0.0,
                    ok=False,
                    error=f"dimension {d.name!r} out of [0,1]: {v}",
                    raw_response=raw,
                )
            scored[d.name] = v

        total_w = sum(d.weight for d in self.dimensions)
        weighted = sum(scored[d.name] * d.weight for d in self.dimensions) / total_w

        return RubricResult(
            score=round(weighted, 4),
            ok=True,
            rationale=obj.get("rationale"),
            dimensions=scored,
            raw_response=raw,
        )

    # ------------------------------------------------------------------
    # Public call surfaces
    # ------------------------------------------------------------------

    def __call__(self, ji: JudgeInput) -> RubricResult:
        return self.score(ji)

    def score(self, ji: JudgeInput) -> RubricResult:
        api_key = self._resolve_api_key()
        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": self._build_user_message(ji)},
            ],
            "temperature": 0.0,
            "max_tokens": 512,
        }
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        url = f"{self.base_url.rstrip('/')}/chat/completions"
        try:
            with httpx.Client(timeout=self.timeout_sec) as client:
                resp = client.post(url, json=body, headers=headers)
        except httpx.HTTPError as err:
            return RubricResult(
                score=0.0, ok=False, error=f"judge transport error: {err}"
            )
        if resp.status_code >= 400:
            return RubricResult(
                score=0.0,
                ok=False,
                error=f"judge HTTP {resp.status_code}: {resp.text[:500]}",
            )
        try:
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, ValueError) as err:
            return RubricResult(
                score=0.0,
                ok=False,
                error=f"judge response missing choices[0].message.content: {err}",
                raw_response=resp.text,
            )
        return self._parse_response(content)

    async def score_async(self, ji: JudgeInput) -> RubricResult:
        api_key = self._resolve_api_key()
        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": self._build_user_message(ji)},
            ],
            "temperature": 0.0,
            "max_tokens": 512,
        }
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        url = f"{self.base_url.rstrip('/')}/chat/completions"
        try:
            async with httpx.AsyncClient(timeout=self.timeout_sec) as client:
                resp = await client.post(url, json=body, headers=headers)
        except httpx.HTTPError as err:
            return RubricResult(
                score=0.0, ok=False, error=f"judge transport error: {err}"
            )
        if resp.status_code >= 400:
            return RubricResult(
                score=0.0,
                ok=False,
                error=f"judge HTTP {resp.status_code}: {resp.text[:500]}",
            )
        try:
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, ValueError) as err:
            return RubricResult(
                score=0.0,
                ok=False,
                error=f"judge response missing choices[0].message.content: {err}",
                raw_response=resp.text,
            )
        return self._parse_response(content)
