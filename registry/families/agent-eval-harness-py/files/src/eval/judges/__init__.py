"""LLM-as-judge primitives.

A *judge* is anything callable matching::

    Judge = Callable[[JudgeInput], JudgeResult | Awaitable[JudgeResult]]

where ``JudgeInput`` carries ``input``, ``expected_output``, ``actual_output``
and ``JudgeResult`` carries a per-dimension score (0..1) plus rationale.

The default :class:`RubricJudge` POSTs to router.tangle.tools (OpenAI-shaped
chat completions) with a structured rubric and parses the JSON response.

Custom judges live in this package — see ``example_judge.py`` for the
contract.
"""

from __future__ import annotations

from .rubric import JudgeInput, JudgeResult, RubricDimension, RubricJudge, RubricResult

__all__ = [
    "JudgeInput",
    "JudgeResult",
    "RubricJudge",
    "RubricResult",
    "RubricDimension",
]
