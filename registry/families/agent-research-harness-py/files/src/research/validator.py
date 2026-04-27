"""Validator — multi-rep verdicts with bootstrap CI + Cohen's d.

This module is the **single source of truth** for the harness's
statistical math. The TS sibling family mirrors these definitions
byte-for-byte; do not introduce a second implementation in screener
or runner. Both other modules import from here.

Math contract:
    bootstrap_mean_diff_ci  ->  95%, 1000 resamples, fixed seed
    cohens_d                ->  pooled-variance form (Hedges-style
                                denominator with n1+n2-2)

The verdict ladder:
    winner          -> ci_lower > 0  AND  cohens_d >= 0.2
    loser           -> ci_upper < 0  AND  cohens_d <= -0.2
    neutral         -> CI straddles zero or |d| < 0.2
    insufficient-data -> n_reps < 2 after errors are filtered out
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Literal

import numpy as np
from scipy import stats

from .types import HypothesisResult, ValidationVerdict

BOOTSTRAP_RESAMPLES = 1000
BOOTSTRAP_CI = 0.95
BOOTSTRAP_SEED = 0xC0FFEE
COHENS_D_THRESHOLD = 0.2


def cohens_d(treatment: Iterable[float], baseline: Iterable[float]) -> float:
    """Pooled-variance Cohen's d.

    d = (mean(treatment) - mean(baseline)) / s_pooled
    s_pooled = sqrt(((n1-1)*s1^2 + (n2-1)*s2^2) / (n1 + n2 - 2))

    Uses sample variance (ddof=1). Returns 0.0 if both samples are
    constant (s_pooled == 0) — the conservative answer for a
    no-variation comparison.
    """
    t = np.asarray(list(treatment), dtype=float)
    b = np.asarray(list(baseline), dtype=float)
    n1, n2 = t.size, b.size
    if n1 < 2 or n2 < 2:
        raise ValueError("cohens_d requires n>=2 in each arm")
    s1 = float(np.var(t, ddof=1))
    s2 = float(np.var(b, ddof=1))
    s_pooled_sq = ((n1 - 1) * s1 + (n2 - 1) * s2) / (n1 + n2 - 2)
    if s_pooled_sq <= 0:
        return 0.0
    return (float(np.mean(t)) - float(np.mean(b))) / float(np.sqrt(s_pooled_sq))


def bootstrap_mean_diff_ci(
    treatment: Iterable[float],
    baseline: Iterable[float],
    *,
    n_resamples: int = BOOTSTRAP_RESAMPLES,
    confidence_level: float = BOOTSTRAP_CI,
    seed: int = BOOTSTRAP_SEED,
) -> tuple[float, float]:
    """Bootstrap CI on mean(treatment) - mean(baseline).

    Wraps `scipy.stats.bootstrap` with a fixed seed so re-runs over
    the same inputs return identical CIs. Returns ``(low, high)``.

    `method='percentile'` is intentional — it matches the TS sibling
    family's implementation. BCa would be marginally tighter but
    requires deeper integration to get matching results across
    languages.
    """
    t = np.asarray(list(treatment), dtype=float)
    b = np.asarray(list(baseline), dtype=float)
    if t.size < 2 or b.size < 2:
        raise ValueError("bootstrap_mean_diff_ci requires n>=2 in each arm")
    rng = np.random.default_rng(seed)

    def stat(x: np.ndarray, y: np.ndarray) -> float:
        return float(np.mean(x) - np.mean(y))

    res = stats.bootstrap(
        (t, b),
        statistic=stat,
        n_resamples=n_resamples,
        confidence_level=confidence_level,
        method="percentile",
        random_state=rng,
        paired=False,
        vectorized=False,
    )
    lo = float(res.confidence_interval.low)
    hi = float(res.confidence_interval.high)
    return lo, hi


def _verdict(
    ci_lower: float, ci_upper: float, d: float, n_reps: int
) -> Literal["winner", "neutral", "loser", "insufficient-data"]:
    if n_reps < 2:
        return "insufficient-data"
    if ci_lower > 0 and d >= COHENS_D_THRESHOLD:
        return "winner"
    if ci_upper < 0 and d <= -COHENS_D_THRESHOLD:
        return "loser"
    return "neutral"


def summarize(
    hypothesis_id: str, results: list[HypothesisResult]
) -> ValidationVerdict:
    """Build a `ValidationVerdict` from a list of per-rep results."""
    treatment_vals: list[float] = []
    baseline_vals: list[float] = []
    n_errors = 0
    for r in results:
        if r.error is not None:
            n_errors += 1
            continue
        if r.treatment_value is None or r.baseline_value is None:
            n_errors += 1
            continue
        treatment_vals.append(r.treatment_value)
        baseline_vals.append(r.baseline_value)

    n_reps = min(len(treatment_vals), len(baseline_vals))
    if n_reps < 2:
        return ValidationVerdict(
            hypothesis_id=hypothesis_id,
            n_reps=n_reps,
            mean_treatment=float("nan"),
            mean_baseline=float("nan"),
            mean_diff=float("nan"),
            ci_lower=float("nan"),
            ci_upper=float("nan"),
            cohens_d=float("nan"),
            n_errors=n_errors,
            verdict="insufficient-data",
        )

    mean_t = float(np.mean(treatment_vals))
    mean_b = float(np.mean(baseline_vals))
    mean_diff = mean_t - mean_b
    lo, hi = bootstrap_mean_diff_ci(treatment_vals, baseline_vals)
    d = cohens_d(treatment_vals, baseline_vals)
    verdict = _verdict(lo, hi, d, n_reps)
    return ValidationVerdict(
        hypothesis_id=hypothesis_id,
        n_reps=n_reps,
        mean_treatment=mean_t,
        mean_baseline=mean_b,
        mean_diff=mean_diff,
        ci_lower=lo,
        ci_upper=hi,
        cohens_d=d,
        n_errors=n_errors,
        verdict=verdict,
    )


def run_validate(
    results_by_hypothesis: dict[str, list[HypothesisResult]],
) -> list[ValidationVerdict]:
    """Compute verdicts for every hypothesis with collected reps."""
    return [summarize(hid, results) for hid, results in results_by_hypothesis.items()]
