"""Pydantic v2 models for the research-harness.

These mirror the schema in the TS sibling family
(`agent-research-harness-ts`). Keep them in sync — the JSON files in
`hypotheses/` are consumed by both languages.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class Scenario(BaseModel):
    """A single scenario the hypothesis is evaluated against.

    The harness is metric-agnostic — `metric` names a numeric field in
    the scenario's emitted result JSON. Higher-is-better is assumed
    unless `direction` is explicitly `lower-is-better`.
    """

    id: str = Field(min_length=1)
    description: str = Field(min_length=1)
    command: list[str] = Field(min_length=1)
    direction: Literal["higher-is-better", "lower-is-better"] = "higher-is-better"


class Treatment(BaseModel):
    """The change under test."""

    description: str = Field(min_length=1)
    files: dict[str, str] = Field(default_factory=dict)
    env: dict[str, str] = Field(default_factory=dict)


class Baseline(BaseModel):
    """The control."""

    description: str = Field(min_length=1)
    files: dict[str, str] = Field(default_factory=dict)
    env: dict[str, str] = Field(default_factory=dict)


class Hypothesis(BaseModel):
    """A single hypothesis in the research queue.

    Cross-language portability contract: this model's JSON shape is
    identical to the Zod schema in `agent-research-harness-ts`.
    """

    id: str = Field(min_length=1, pattern=r"^[a-z][a-z0-9-]*$")
    description: str = Field(min_length=20)
    sandbox_image: str = Field(default="ubuntu", alias="sandboxImage")
    treatment: Treatment
    baseline: Baseline
    scenarios: list[Scenario] = Field(min_length=1)
    metrics: list[str] = Field(min_length=1)
    tags: list[str] = Field(default_factory=list)

    model_config = {"populate_by_name": True}

    @field_validator("metrics")
    @classmethod
    def _metrics_unique(cls, v: list[str]) -> list[str]:
        if len(set(v)) != len(v):
            raise ValueError("metrics must be unique")
        return v


class HypothesisResult(BaseModel):
    """Per-rep run result for a single (hypothesis, scenario) pair.

    `treatment_value` and `baseline_value` are the numeric metric
    readings extracted from the sandbox run. `error` is set if the rep
    failed; downstream code must check `error` before averaging.
    """

    hypothesis_id: str
    scenario_id: str
    metric: str
    treatment_value: float | None = None
    baseline_value: float | None = None
    error: str | None = None
    rep_index: int = 0


class ScreeningRow(BaseModel):
    """One row of the screener's ranking table."""

    hypothesis_id: str
    mean_delta: float
    n_scenarios: int
    n_errors: int


class ValidationVerdict(BaseModel):
    """Per-hypothesis validator output.

    `p_value` is the raw two-sided Welch p; `q_value` is the
    Benjamini–Hochberg-adjusted q across the hypothesis family in this
    run. Verdicts use `q_value` so the family-wise false-promote rate is
    bounded at the configured FDR. Both fields ship so consumers can
    audit raw vs corrected significance.
    """

    hypothesis_id: str
    n_reps: int
    mean_treatment: float
    mean_baseline: float
    mean_diff: float
    ci_lower: float
    ci_upper: float
    cohens_d: float
    p_value: float | None = None
    q_value: float | None = None
    n_errors: int
    verdict: Literal["winner", "neutral", "loser", "insufficient-data"]


class ProposerConfig(BaseModel):
    """Configuration for the LLM-driven proposer."""

    base_url: str = "https://router.tangle.tools/v1"
    model: str = "anthropic/claude-sonnet-4"
    n_proposals: int = 3
    temperature: float = 0.7
    max_tokens: int = 4096
