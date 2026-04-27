"""Python eval harness for agent-under-test scoring.

Public surface:

- ``Scorecard``, ``ScorecardFlow`` — Pydantic v2 models matching the TS sibling
  byte-for-byte (cross-language ``compare`` works).
- ``run_scenarios`` — load scenarios, dispatch against the chosen driver,
  collect flow results, build a ``Scorecard``.
- ``bootstrap_ci``, ``cohens_d``, ``welch_t_test``, ``regression_gate`` —
  statistical gate primitives.
- ``RubricJudge`` — LLM-as-judge over router.tangle.tools, multi-dim rubrics.
- ``SandboxDriver`` — tangle-sandbox-backed scenario runner.
"""

from __future__ import annotations

from .judges.rubric import RubricJudge, RubricResult
from .regression import (
    RegressionVerdict,
    bootstrap_ci,
    cohens_d,
    regression_gate,
    welch_t_test,
)
from .runner import RunConfig, run_scenarios
from .sandbox_runner import SandboxDriver
from .scorecard import (
    FlowDirection,
    FlowStatus,
    Scorecard,
    ScorecardFlow,
    ScorecardInput,
    aggregate_score,
    write_scorecard,
)

__all__ = [
    "Scorecard",
    "ScorecardFlow",
    "ScorecardInput",
    "FlowStatus",
    "FlowDirection",
    "aggregate_score",
    "write_scorecard",
    "RunConfig",
    "run_scenarios",
    "SandboxDriver",
    "RubricJudge",
    "RubricResult",
    "bootstrap_ci",
    "cohens_d",
    "welch_t_test",
    "regression_gate",
    "RegressionVerdict",
]

__version__ = "0.1.0"
