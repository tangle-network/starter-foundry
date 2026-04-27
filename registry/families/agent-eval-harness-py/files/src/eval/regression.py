"""Regression gate: bootstrap CI + Cohen's d + Welch's t-test.

This module mirrors the TypeScript sibling's ``regression.ts`` math 1:1 so
verdicts are stable across languages.

Defaults (matching TS):

- bootstrap CI: 95% (alpha=0.05), 1000 resamples.
- Cohen's d threshold: |d| > 0.2 in the worse direction is a regression.
- Welch's t-test threshold: p < alpha (default 0.05) is a regression.

A flow regresses iff **both** the Cohen's d magnitude exceeds 0.2 in the
worse direction AND Welch's p falls below alpha. Either alone is too
trigger-happy; both together has held up across a year of runs.

Bootstrap CI uses ``numpy.random.default_rng(seed)`` so runs are
reproducible — the seed is part of the verdict so a CI failure can be
re-derived locally bit-for-bit.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Sequence

import numpy as np
from scipy import stats

DEFAULT_RESAMPLES = 1000
DEFAULT_ALPHA = 0.05
DEFAULT_D_THRESHOLD = 0.2
DEFAULT_SEED = 0xA53C0DE


@dataclass(frozen=True)
class BootstrapCI:
    """Result of a percentile bootstrap CI estimate."""

    mean: float
    low: float
    high: float
    alpha: float
    resamples: int
    seed: int


@dataclass(frozen=True)
class RegressionVerdict:
    """Per-flow regression verdict from comparing baseline vs head samples.

    The CI fields describe the ``head - baseline`` mean difference, NOT the
    head mean alone. Pre-fix this module called ``bootstrap_ci(head, ...)``
    which returned the head-mean CI; downstream code that read
    ``ci_lower > 0`` as "treatment significantly above baseline" was wrong
    every time. ``bootstrap_diff_ci`` is the only correct primitive here
    and matches the TS sibling family's contract.
    """

    flow: str
    regressed: bool
    direction: str  # "higher-better" | "lower-better"
    baseline_mean: float
    head_mean: float
    delta: float  # head - baseline
    cohen_d: float  # signed; positive = head higher than baseline
    welch_p: float
    welch_t: float
    # CI on the DIFFERENCE of means (head - baseline). Named explicitly so
    # any reader inferring "ci_lower > 0 ⇒ improvement" is correct.
    diff_ci_low: float
    diff_ci_high: float
    resamples: int
    alpha: float
    d_threshold: float
    seed: int
    reason: str  # human-readable summary

    def to_dict(self) -> dict:
        return asdict(self)


def _validate_samples(samples: Sequence[float], label: str) -> np.ndarray:
    arr = np.asarray(list(samples), dtype=float)
    if arr.size < 8:
        raise ValueError(
            f"{label}: need ≥8 samples for a meaningful CI (got {arr.size}); "
            f"surface as `unmeasured` in the scorecard rather than gating."
        )
    if not np.all(np.isfinite(arr)):
        raise ValueError(f"{label}: contains non-finite values (NaN/Inf)")
    return arr


def bootstrap_ci(
    samples: Sequence[float],
    *,
    alpha: float = DEFAULT_ALPHA,
    resamples: int = DEFAULT_RESAMPLES,
    seed: int = DEFAULT_SEED,
) -> BootstrapCI:
    """Percentile bootstrap CI on the sample mean.

    Use this ONLY for single-sample mean estimation. For comparing two
    arms (the regression-gate use case), call ``bootstrap_diff_ci`` —
    confusing the two was the bug fixed in Gen-15.1.

    Hand-rolled (rather than scipy's ``stats.bootstrap``) so the resampling
    is byte-equal to the TS sibling — same seed, same algorithm, same
    percentile rule.
    """
    arr = _validate_samples(samples, "bootstrap_ci")
    rng = np.random.default_rng(seed)
    n = arr.size
    # vectorised resample: (resamples, n) of indices
    idx = rng.integers(0, n, size=(resamples, n))
    means = arr[idx].mean(axis=1)
    lo_q = alpha / 2.0
    hi_q = 1.0 - alpha / 2.0
    low = float(np.quantile(means, lo_q))
    high = float(np.quantile(means, hi_q))
    return BootstrapCI(
        mean=float(arr.mean()),
        low=low,
        high=high,
        alpha=alpha,
        resamples=resamples,
        seed=seed,
    )


def bootstrap_diff_ci(
    baseline: Sequence[float],
    head: Sequence[float],
    *,
    alpha: float = DEFAULT_ALPHA,
    resamples: int = DEFAULT_RESAMPLES,
    seed: int = DEFAULT_SEED,
) -> tuple[float, float]:
    """Percentile bootstrap CI on the difference of means: head − baseline.

    Resamples each arm independently with replacement, takes the mean
    difference per resample, returns the alpha/2 and 1-alpha/2 quantiles.
    Matches the TS sibling family's ``bootstrapCi(baseline, candidate)``
    contract: same seed, same resample count, same percentile method.

    Cross-language parity: with ``baseline = [0.5, 0.5, 0.5]`` and
    ``head = [0.7, 0.7, 0.7]``, both implementations return
    ``(low, high) ≈ (0.2, 0.2)`` (zero-variance arms ⇒ degenerate CI at
    the point estimate; this is correct).
    """
    a = np.asarray(list(baseline), dtype=float)
    b = np.asarray(list(head), dtype=float)
    if a.size < 2 or b.size < 2:
        raise ValueError("bootstrap_diff_ci requires n>=2 in each arm")
    if not (np.all(np.isfinite(a)) and np.all(np.isfinite(b))):
        raise ValueError("bootstrap_diff_ci: contains non-finite values")
    rng = np.random.default_rng(seed)
    idx_a = rng.integers(0, a.size, size=(resamples, a.size))
    idx_b = rng.integers(0, b.size, size=(resamples, b.size))
    diffs = b[idx_b].mean(axis=1) - a[idx_a].mean(axis=1)
    lo_q = alpha / 2.0
    hi_q = 1.0 - alpha / 2.0
    return float(np.quantile(diffs, lo_q)), float(np.quantile(diffs, hi_q))


def cohens_d(baseline: Sequence[float], head: Sequence[float]) -> float:
    """Cohen's d using pooled std (Welch flavour).

    Sign convention: positive d means ``head`` mean is higher than
    ``baseline`` mean. Whether that's a regression depends on the flow's
    direction (``higher-better`` vs ``lower-better``) — see ``regression_gate``.

    Pooled standard deviation here is the unbiased pooled estimator:

        sp = sqrt(((n1-1)·s1² + (n2-1)·s2²) / (n1+n2-2))

    Matches the TS port (which uses the same formula). Returns 0.0 when
    pooled std is 0 (constant samples) — there's no detectable effect.
    """
    a = np.asarray(list(baseline), dtype=float)
    b = np.asarray(list(head), dtype=float)
    if a.size < 2 or b.size < 2:
        raise ValueError("cohens_d: each group needs ≥2 samples")
    n1, n2 = a.size, b.size
    s1 = a.var(ddof=1)
    s2 = b.var(ddof=1)
    pooled = np.sqrt(((n1 - 1) * s1 + (n2 - 1) * s2) / (n1 + n2 - 2))
    if pooled == 0:
        return 0.0
    return float((b.mean() - a.mean()) / pooled)


def welch_t_test(baseline: Sequence[float], head: Sequence[float]) -> tuple[float, float]:
    """Welch's t-test — unequal variance two-sample t-test.

    Returns ``(t_statistic, two_sided_p)``. Wraps ``scipy.stats.ttest_ind``
    with ``equal_var=False``.
    """
    a = np.asarray(list(baseline), dtype=float)
    b = np.asarray(list(head), dtype=float)
    res = stats.ttest_ind(b, a, equal_var=False)
    return float(res.statistic), float(res.pvalue)


def regression_gate(
    *,
    flow: str,
    baseline: Sequence[float],
    head: Sequence[float],
    direction: str,
    alpha: float = DEFAULT_ALPHA,
    d_threshold: float = DEFAULT_D_THRESHOLD,
    resamples: int = DEFAULT_RESAMPLES,
    seed: int = DEFAULT_SEED,
) -> RegressionVerdict:
    """Decide whether ``head`` regresses against ``baseline`` for one flow.

    A regression is recorded iff **both**:

    1. ``|cohen_d| > d_threshold`` in the *worse* direction, AND
    2. ``welch_p < alpha``.

    Worse direction:
    - ``higher-better`` flows: regressed when ``head_mean < baseline_mean``
      (cohen_d < -d_threshold).
    - ``lower-better`` flows: regressed when ``head_mean > baseline_mean``
      (cohen_d > d_threshold).
    """
    if direction not in {"higher-better", "lower-better"}:
        raise ValueError(f"regression_gate: invalid direction {direction!r}")

    d = cohens_d(baseline, head)
    t, p = welch_t_test(baseline, head)
    diff_low, diff_high = bootstrap_diff_ci(
        baseline, head, alpha=alpha, resamples=resamples, seed=seed
    )

    a = np.asarray(list(baseline), dtype=float)
    b = np.asarray(list(head), dtype=float)
    delta = float(b.mean() - a.mean())

    if direction == "higher-better":
        worse_d = d < -d_threshold
        worse_word = "dropped"
    else:
        worse_d = d > d_threshold
        worse_word = "rose"

    regressed = bool(worse_d and p < alpha)
    if regressed:
        reason = (
            f"{flow} {worse_word}: d={d:+.3f} (|d|>{d_threshold}), "
            f"welch_p={p:.4f} (<{alpha}), Δmean={delta:+.4f}"
        )
    else:
        reason = (
            f"{flow} stable: d={d:+.3f}, welch_p={p:.4f}, Δmean={delta:+.4f}"
        )

    return RegressionVerdict(
        flow=flow,
        regressed=regressed,
        direction=direction,
        baseline_mean=float(a.mean()),
        head_mean=float(b.mean()),
        delta=delta,
        cohen_d=d,
        welch_p=p,
        welch_t=t,
        diff_ci_low=diff_low,
        diff_ci_high=diff_high,
        resamples=resamples,
        alpha=alpha,
        d_threshold=d_threshold,
        seed=seed,
        reason=reason,
    )


@dataclass
class GateReport:
    """Aggregate verdict across N flows."""

    verdicts: list[RegressionVerdict] = field(default_factory=list)

    @property
    def any_regressed(self) -> bool:
        return any(v.regressed for v in self.verdicts)

    @property
    def regressed_flows(self) -> list[str]:
        return [v.flow for v in self.verdicts if v.regressed]

    def to_dict(self) -> dict:
        return {
            "any_regressed": self.any_regressed,
            "regressed_flows": self.regressed_flows,
            "verdicts": [v.to_dict() for v in self.verdicts],
        }
