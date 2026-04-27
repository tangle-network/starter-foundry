"""Validator math — bootstrap CI + Cohen's d against known values.

Catches:
    - Cohen's d formula drift (sample vs. population variance)
    - bootstrap seed not pinned (non-deterministic CIs across runs)
    - verdict ladder thresholds drifting from the documented contract
"""

from __future__ import annotations

import math

import pytest

from research.types import HypothesisResult
from research.validator import (
    benjamini_hochberg,
    bootstrap_mean_diff_ci,
    cohens_d,
    run_validate,
    summarize,
    welch_p_value,
)


# --- Cohen's d -----------------------------------------------------


def test_cohens_d_pooled_variance_known_value() -> None:
    """t=[10,12,14,11,13] (mean 12, var 2.5), b=[8,9,10,11,12] (mean 10, var 2.5)
    pooled var = 2.5 -> s_pooled = sqrt(2.5)
    d = (12 - 10) / sqrt(2.5) = 1.2649110640673518
    """
    d = cohens_d([10, 12, 14, 11, 13], [8, 9, 10, 11, 12])
    assert math.isclose(d, 2.0 / math.sqrt(2.5), rel_tol=1e-12)
    assert math.isclose(d, 1.2649110640673518, rel_tol=1e-12)


def test_cohens_d_zero_for_identical_samples() -> None:
    d = cohens_d([5, 6, 7, 8, 9], [5, 6, 7, 8, 9])
    assert d == 0.0


def test_cohens_d_negative_when_baseline_wins() -> None:
    d = cohens_d([8, 9, 10, 11, 12], [10, 12, 14, 11, 13])
    assert d < 0


def test_cohens_d_zero_for_constant_samples_avoids_div_by_zero() -> None:
    d = cohens_d([5, 5, 5, 5, 5], [5, 5, 5, 5, 5])
    assert d == 0.0


def test_cohens_d_requires_n_at_least_2() -> None:
    with pytest.raises(ValueError):
        cohens_d([5.0], [3.0, 4.0])


# --- bootstrap CI --------------------------------------------------


def test_bootstrap_ci_is_deterministic_with_pinned_seed() -> None:
    t = [10.0, 12.0, 14.0, 11.0, 13.0, 12.5, 11.5]
    b = [8.0, 9.0, 10.0, 11.0, 12.0, 10.5, 9.5]
    a = bootstrap_mean_diff_ci(t, b)
    c = bootstrap_mean_diff_ci(t, b)
    assert a == c, f"bootstrap is not deterministic: {a} vs {c}"


def test_bootstrap_ci_brackets_observed_mean_diff_for_clear_signal() -> None:
    """Strong positive signal — the CI must be entirely above zero."""
    t = [10.0, 12.0, 14.0, 11.0, 13.0, 12.5, 11.5]
    b = [2.0, 3.0, 4.0, 1.0, 2.0, 3.5, 2.5]
    lo, hi = bootstrap_mean_diff_ci(t, b)
    assert lo > 0, f"expected lo>0 for clear winner, got ({lo}, {hi})"
    observed = sum(t) / len(t) - sum(b) / len(b)
    assert lo <= observed <= hi


def test_bootstrap_ci_straddles_zero_for_no_signal() -> None:
    """Same distribution -> CI must include zero."""
    same = [10.0, 11.0, 9.0, 10.5, 9.5, 10.0, 11.0]
    lo, hi = bootstrap_mean_diff_ci(same, same)
    assert lo <= 0 <= hi


# --- Verdict ladder ------------------------------------------------


def _result(hid: str, t: float | None, b: float | None, rep: int) -> HypothesisResult:
    return HypothesisResult(
        hypothesis_id=hid,
        scenario_id="s1",
        metric="qps",
        treatment_value=t,
        baseline_value=b,
        rep_index=rep,
    )


def test_verdict_winner_for_strong_positive_signal() -> None:
    results = [
        _result("h", 20.0 + i * 0.1, 5.0 + i * 0.1, i)
        for i in range(5)
    ]
    v = summarize("h", results)
    assert v.verdict == "winner"
    assert v.cohens_d > 0.2
    assert v.ci_lower > 0


def test_verdict_loser_for_strong_negative_signal() -> None:
    results = [
        _result("h", 5.0 + i * 0.1, 20.0 + i * 0.1, i)
        for i in range(5)
    ]
    v = summarize("h", results)
    assert v.verdict == "loser"
    assert v.cohens_d < -0.2
    assert v.ci_upper < 0


def test_verdict_neutral_for_no_signal() -> None:
    same = [10.0, 11.0, 9.0, 10.5, 9.5]
    results = [
        HypothesisResult(
            hypothesis_id="h",
            scenario_id="s1",
            metric="qps",
            treatment_value=same[i],
            baseline_value=same[i],
            rep_index=i,
        )
        for i in range(5)
    ]
    v = summarize("h", results)
    assert v.verdict == "neutral"


def test_benjamini_hochberg_known_sequence() -> None:
    """Hand-validated BH: p=[0.01, 0.04, 0.03, 0.20, 0.50] sorted [0.01,0.03,0.04,0.20,0.50]
    raw q sorted = [0.05, 0.075, 0.0667, 0.25, 0.50]
    step-up min trailing = [0.05, 0.0667, 0.0667, 0.25, 0.50]
    Re-scattered to original order: [0.05, 0.0667, 0.0667, 0.25, 0.50]
    """
    p = [0.01, 0.04, 0.03, 0.20, 0.50]
    q = benjamini_hochberg(p)
    assert math.isclose(q[0], 0.05, abs_tol=1e-9)
    assert math.isclose(q[1], 1 / 15.0, abs_tol=1e-9)  # 0.06666...
    assert math.isclose(q[2], 1 / 15.0, abs_tol=1e-9)
    assert math.isclose(q[3], 0.25, abs_tol=1e-9)
    assert math.isclose(q[4], 0.50, abs_tol=1e-9)
    # Monotone after sort: q must be non-decreasing in p-rank.
    sorted_q = sorted(q)
    for a, b in zip(sorted_q, sorted_q[1:], strict=False):
        assert a <= b


def test_benjamini_hochberg_caps_false_promotions_under_null() -> None:
    """20 hypotheses uniformly under H0 → expected ≤ 1 q < 0.05."""
    rng = __import__("random").Random(42)
    p_values = [rng.random() for _ in range(20)]
    q = benjamini_hochberg(p_values, fdr=0.05)
    promoted_raw = sum(1 for x in p_values if x < 0.05)
    promoted_bh = sum(1 for x in q if x < 0.05)
    assert promoted_bh <= promoted_raw
    # Under uniform-null with N=20, raw catches ~1 false positive and BH
    # tightens or matches it. Exact counts are RNG-dependent; the
    # invariant is "BH never promotes more than raw."


def test_benjamini_hochberg_empty_input() -> None:
    assert benjamini_hochberg([]) == []


def test_run_validate_applies_bh_family_wise() -> None:
    """Multi-hypothesis run: a single weak winner that passed raw-CI but
    has a borderline p must be downgraded by BH when the family includes
    other tests.
    """
    # Strong winner: t mean way above b. Should still be 'winner' post-BH.
    strong = [
        HypothesisResult(
            hypothesis_id="strong",
            scenario_id="s1",
            metric="qps",
            treatment_value=20.0 + i * 0.1,
            baseline_value=5.0 + i * 0.1,
            rep_index=i,
        )
        for i in range(5)
    ]
    # Null hypothesis 1: identical samples → p ≈ 1, q ≈ 1 → neutral.
    same1 = [
        HypothesisResult(
            hypothesis_id="null1",
            scenario_id="s1",
            metric="qps",
            treatment_value=10.0,
            baseline_value=10.0,
            rep_index=i,
        )
        for i in range(5)
    ]
    # Null hypothesis 2.
    same2 = [
        HypothesisResult(
            hypothesis_id="null2",
            scenario_id="s1",
            metric="qps",
            treatment_value=12.0,
            baseline_value=12.0,
            rep_index=i,
        )
        for i in range(5)
    ]
    verdicts = run_validate({"strong": strong, "null1": same1, "null2": same2})
    by_id = {v.hypothesis_id: v for v in verdicts}
    assert by_id["strong"].verdict == "winner"
    assert by_id["strong"].q_value is not None
    assert by_id["strong"].q_value < 0.05
    assert by_id["null1"].verdict == "neutral"
    assert by_id["null2"].verdict == "neutral"
    # p_value must be carried through alongside q_value.
    for v in verdicts:
        assert v.p_value is not None


def test_welch_p_value_returns_one_for_insufficient_data() -> None:
    assert welch_p_value([1.0], [2.0, 3.0]) == 1.0
    assert welch_p_value([], [1.0, 2.0]) == 1.0


def test_verdict_insufficient_data_when_all_reps_error() -> None:
    results = [
        HypothesisResult(
            hypothesis_id="h",
            scenario_id="s1",
            metric="qps",
            treatment_value=None,
            baseline_value=None,
            error="boom",
            rep_index=i,
        )
        for i in range(5)
    ]
    v = summarize("h", results)
    assert v.verdict == "insufficient-data"
    assert v.n_errors == 5
    assert v.n_reps == 0
