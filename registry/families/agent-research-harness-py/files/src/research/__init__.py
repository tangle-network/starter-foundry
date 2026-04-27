"""Python research harness — propose / screen / validate / sweep.

Public surface:
    Hypothesis              - Pydantic v2 model for a single hypothesis
    HypothesisResult        - per-rep run result
    ScreeningRanking        - screener output
    ValidationVerdict       - validator output (mean delta, CI, Cohen's d)
    cohens_d                - pooled-variance Cohen's d
    bootstrap_mean_diff_ci  - 95% bootstrap CI on mean(treatment) - mean(baseline)
    run_screen              - rank hypotheses by 1-rep mean delta
    run_validate            - 5-rep validation with bootstrap CI + Cohen's d
"""

from .screener import ScreeningRanking, run_screen
from .types import (
    Hypothesis,
    HypothesisResult,
    ProposerConfig,
    Scenario,
    ValidationVerdict,
)
from .validator import bootstrap_mean_diff_ci, cohens_d, run_validate

__all__ = [
    "Hypothesis",
    "HypothesisResult",
    "ProposerConfig",
    "Scenario",
    "ScreeningRanking",
    "ValidationVerdict",
    "bootstrap_mean_diff_ci",
    "cohens_d",
    "run_screen",
    "run_validate",
]

__version__ = "0.1.0"
