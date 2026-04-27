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
DEFAULT_FDR = 0.05


def benjamini_hochberg(p_values: list[float], fdr: float = DEFAULT_FDR) -> list[float]:
    """Benjamini–Hochberg FDR-adjusted q-values.

    Sort p-values ascending; for each rank i (1-based) of n total tests:
        q[i] = min(p[i] * n / i, q[i+1] ... q[n], 1.0)
    The trailing-min ("step-up") preserves monotonicity of q-values and
    matches scipy's ``false_discovery_control`` and the TS sibling's
    ``benjaminiHochberg`` byte-for-byte under the same input ordering.

    Returns q-values in the ORIGINAL order (not sorted).
    """
    if not p_values:
        return []
    if not all(0.0 <= p <= 1.0 for p in p_values):
        raise ValueError("benjamini_hochberg: p-values must be in [0, 1]")
    n = len(p_values)
    # Sort indices by ascending p-value.
    order = sorted(range(n), key=lambda i: p_values[i])
    sorted_p = [p_values[i] for i in order]
    # Compute raw adjusted: p_(k) * n / (k+1)  (k 0-indexed → rank k+1).
    raw = [min(sorted_p[k] * n / (k + 1), 1.0) for k in range(n)]
    # Step-up: enforce monotonicity by taking trailing minimum.
    q_sorted = list(raw)
    for k in range(n - 2, -1, -1):
        q_sorted[k] = min(q_sorted[k], q_sorted[k + 1])
    # Re-scatter to original positions.
    q = [0.0] * n
    for rank, original_idx in enumerate(order):
        q[original_idx] = q_sorted[rank]
    return q


def welch_p_value(treatment: Iterable[float], baseline: Iterable[float]) -> float:
    """Two-sided Welch t-test p-value. Returns 1.0 when n<2 in either arm
    (no test possible) so BH treats the entry as non-significant.
    """
    t = np.asarray(list(treatment), dtype=float)
    b = np.asarray(list(baseline), dtype=float)
    if t.size < 2 or b.size < 2:
        return 1.0
    res = stats.ttest_ind(t, b, equal_var=False)
    p = float(res.pvalue)
    if not np.isfinite(p):
        return 1.0
    return p


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
    ci_lower: float,
    ci_upper: float,
    d: float,
    n_reps: int,
    q_value: float | None,
    fdr: float,
) -> Literal["winner", "neutral", "loser", "insufficient-data"]:
    if n_reps < 2:
        return "insufficient-data"
    # Promotion (winner / loser) requires BOTH a CI strictly off zero AND
    # the BH-adjusted q below the configured FDR. Without the q gate the
    # family-wise false-promote rate scales linearly with the number of
    # hypotheses tested in a single run.
    if q_value is None:
        # Single-hypothesis run: BH degenerates to identity; fall back to
        # raw-CI gate. Caller should still aggregate across runs.
        if ci_lower > 0 and d >= COHENS_D_THRESHOLD:
            return "winner"
        if ci_upper < 0 and d <= -COHENS_D_THRESHOLD:
            return "loser"
        return "neutral"
    if ci_lower > 0 and d >= COHENS_D_THRESHOLD and q_value < fdr:
        return "winner"
    if ci_upper < 0 and d <= -COHENS_D_THRESHOLD and q_value < fdr:
        return "loser"
    return "neutral"


def _summarize_one(
    hypothesis_id: str, results: list[HypothesisResult]
) -> tuple[ValidationVerdict, float | None]:
    """Compute per-hypothesis stats; returns (partial verdict, p-value).

    Verdict is filled in by the family-level pass after BH q-values are
    available. p-value is None when the hypothesis has insufficient data.
    """
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
        return (
            ValidationVerdict(
                hypothesis_id=hypothesis_id,
                n_reps=n_reps,
                mean_treatment=float("nan"),
                mean_baseline=float("nan"),
                mean_diff=float("nan"),
                ci_lower=float("nan"),
                ci_upper=float("nan"),
                cohens_d=float("nan"),
                p_value=None,
                q_value=None,
                n_errors=n_errors,
                verdict="insufficient-data",
            ),
            None,
        )

    mean_t = float(np.mean(treatment_vals))
    mean_b = float(np.mean(baseline_vals))
    mean_diff = mean_t - mean_b
    lo, hi = bootstrap_mean_diff_ci(treatment_vals, baseline_vals)
    d = cohens_d(treatment_vals, baseline_vals)
    p = welch_p_value(treatment_vals, baseline_vals)

    # Verdict left as 'neutral' — family-level pass overwrites with BH q.
    return (
        ValidationVerdict(
            hypothesis_id=hypothesis_id,
            n_reps=n_reps,
            mean_treatment=mean_t,
            mean_baseline=mean_b,
            mean_diff=mean_diff,
            ci_lower=lo,
            ci_upper=hi,
            cohens_d=d,
            p_value=p,
            q_value=None,
            n_errors=n_errors,
            verdict="neutral",
        ),
        p,
    )


def summarize(
    hypothesis_id: str, results: list[HypothesisResult]
) -> ValidationVerdict:
    """Single-hypothesis convenience. For multi-hypothesis runs use
    ``run_validate`` so BH/FDR correction is applied family-wise.
    """
    partial, p = _summarize_one(hypothesis_id, results)
    if p is None:
        return partial
    verdict = _verdict(
        partial.ci_lower, partial.ci_upper, partial.cohens_d, partial.n_reps, None, DEFAULT_FDR
    )
    return partial.model_copy(update={"verdict": verdict})


def run_validate(
    results_by_hypothesis: dict[str, list[HypothesisResult]],
    *,
    fdr: float = DEFAULT_FDR,
) -> list[ValidationVerdict]:
    """Compute verdicts with family-wise BH-FDR correction.

    Two passes:
      1. Per-hypothesis stats + raw p-values.
      2. BH-adjust p-values across the family; finalize verdicts using q.
    """
    partials: list[ValidationVerdict] = []
    p_values: list[float] = []
    p_indices: list[int] = []  # which partials had a real p-value
    for hid, rs in results_by_hypothesis.items():
        v, p = _summarize_one(hid, rs)
        partials.append(v)
        if p is not None:
            p_values.append(p)
            p_indices.append(len(partials) - 1)

    if p_values:
        q_values = benjamini_hochberg(p_values, fdr)
    else:
        q_values = []

    out: list[ValidationVerdict] = []
    q_iter = iter(zip(p_indices, q_values, strict=True))
    next_pair = next(q_iter, None)
    for i, partial in enumerate(partials):
        if next_pair is not None and next_pair[0] == i:
            _, q = next_pair
            verdict = _verdict(
                partial.ci_lower,
                partial.ci_upper,
                partial.cohens_d,
                partial.n_reps,
                q,
                fdr,
            )
            out.append(partial.model_copy(update={"q_value": q, "verdict": verdict}))
            next_pair = next(q_iter, None)
        else:
            out.append(partial)
    return out
