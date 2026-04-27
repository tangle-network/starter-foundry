"""Scorecard models — cross-language contract with the TS sibling.

The shape mirrors `.evolve/scorecard.json` exactly, with these invariants
enforced at the model layer:

- ``value``, ``target``, ``aggregate`` rounded to 4 decimals.
- ``status`` is one of {``pass``, ``fail``, ``unmeasured``, ``gap``}.
- ``direction`` is one of {``higher-better``, ``lower-better``}.
- ``aggregate`` = unweighted mean of pass-fraction across measurable flows
  (``status in {pass, fail}``); ``unmeasured`` and ``gap`` flows are excluded
  from the denominator (matches ``buildScorecard`` in the TS sibling).

A flow's ``status`` is computed from ``value`` vs ``target`` + ``direction``:

- ``higher-better``: pass iff value >= target.
- ``lower-better``:  pass iff value <= target.
- ``value is None``: status forced to ``unmeasured``.

Use :func:`aggregate_score` to (re)compute the aggregate after editing flows.
Use :func:`write_scorecard` to persist; it normalises rounding before write
so byte-equal cross-language diffs are possible.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

FlowStatus = Literal["pass", "fail", "unmeasured", "gap"]
FlowDirection = Literal["higher-better", "lower-better"]

_ROUND_DECIMALS = 4


def _round(v: float | int | None) -> float | None:
    """Match the TS sibling's ``Number(x.toFixed(4))`` semantics."""
    if v is None:
        return None
    return round(float(v), _ROUND_DECIMALS)


class ScorecardInput(BaseModel):
    """Provenance entry — a file the scorecard is derived from."""

    model_config = ConfigDict(extra="forbid")

    path: str
    mtime: str  # ISO-8601


class ScorecardFlow(BaseModel):
    """One measured flow — the unit of cross-language comparison.

    Field order matches the TS sibling's emit order; pydantic v2 preserves
    declaration order in ``model_dump()``.
    """

    model_config = ConfigDict(extra="forbid")

    name: str
    value: float | None
    target: float
    status: FlowStatus
    productValueClaim: str = Field(
        ..., description="One sentence: what does this flow's pass mean for the user?"
    )
    direction: FlowDirection
    notes: str | None = None

    @field_validator("value", "target", mode="after")
    @classmethod
    def _round_numeric(cls, v: float | None) -> float | None:
        return _round(v)

    @model_validator(mode="after")
    def _coerce_status(self) -> ScorecardFlow:
        """Force status=unmeasured when value is None.

        We do not auto-derive pass/fail from value+target+direction here —
        callers may have richer context (timeouts, judge errors, etc) and
        should set ``status`` explicitly. We only enforce the floor.
        """
        if self.value is None and self.status not in {"unmeasured", "gap"}:
            object.__setattr__(self, "status", "unmeasured")
        return self


def derive_status(
    value: float | None, target: float, direction: FlowDirection
) -> FlowStatus:
    """Compute pass/fail/unmeasured from raw inputs. Mirrors TS ``deriveStatus``."""
    if value is None:
        return "unmeasured"
    if direction == "higher-better":
        return "pass" if value >= target else "fail"
    return "pass" if value <= target else "fail"


def aggregate_score(flows: list[ScorecardFlow]) -> float:
    """Unweighted mean of pass fraction across measurable flows.

    ``unmeasured`` and ``gap`` are excluded — they don't move the aggregate
    in either direction. Returns 0.0 when no flows are measurable (matches
    the TS sibling's behaviour rather than NaN, which serialises poorly).
    """
    measurable = [f for f in flows if f.status in {"pass", "fail"}]
    if not measurable:
        return 0.0
    passes = sum(1 for f in measurable if f.status == "pass")
    return _round(passes / len(measurable)) or 0.0


class Scorecard(BaseModel):
    """Top-level scorecard — the cross-language artifact."""

    model_config = ConfigDict(extra="forbid")

    product: str
    timestamp: str
    coverage: str
    aggregate: float
    inputs: list[ScorecardInput] = Field(default_factory=list)
    flows: list[ScorecardFlow] = Field(default_factory=list)

    @field_validator("aggregate", mode="after")
    @classmethod
    def _round_aggregate(cls, v: float) -> float:
        return _round(v) or 0.0

    @classmethod
    def build(
        cls,
        *,
        product: str,
        flows: list[ScorecardFlow],
        inputs: list[ScorecardInput] | None = None,
        declared_count: int | None = None,
        timestamp: str | None = None,
    ) -> Scorecard:
        """Construct a scorecard with derived ``coverage`` + ``aggregate``."""
        ts = timestamp or datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace(
            "+00:00", "Z"
        )
        measured = sum(1 for f in flows if f.status in {"pass", "fail"})
        declared = declared_count if declared_count is not None else len(flows)
        coverage = f"{measured}/{declared} flows measured"
        return cls(
            product=product,
            timestamp=ts,
            coverage=coverage,
            aggregate=aggregate_score(flows),
            inputs=inputs or [],
            flows=flows,
        )


def write_scorecard(scorecard: Scorecard, path: str | Path) -> Path:
    """Persist with deterministic field order + 2-space indent.

    Matches the TS sibling's ``JSON.stringify(card, null, 2)`` byte-for-byte
    for the field-name set we share. ``ensure_ascii=False`` preserves
    non-ASCII codepoints (em dashes, unicode arrows in productValueClaim).

    Required fields (``value``) are always emitted even when ``None`` so the
    JSON survives a round-trip through :func:`load_scorecard`. Optional
    fields (``notes``) are dropped when ``None`` to match the TS sibling
    (``undefined`` keys are absent in JSON.stringify output).
    """
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    payload: dict[str, Any] = scorecard.model_dump(mode="json")
    # Strip only the optional-and-None fields. ``value`` is required (None is
    # legal for unmeasured/gap flows), so it stays.
    for flow in payload.get("flows", []):
        if flow.get("notes") is None:
            flow.pop("notes", None)
    with p.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    return p


def load_scorecard(path: str | Path) -> Scorecard:
    """Parse a scorecard JSON file. Validates against the model."""
    p = Path(path)
    with p.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    return Scorecard.model_validate(data)
