"""Regression-gate math tests.

Anchors the bootstrap CI / Cohen's d / Welch t-test math against
hand-checked numeric values, so the gate verdict is byte-stable across
language ports (TS sibling validates against the same anchor numbers).

Specific regressions these protect against:

- ``cohens_d`` sign inversion (positive = head higher; we depend on this
  to decide ``higher-better`` vs ``lower-better`` regression).
- Bootstrap CI not honouring the ``alpha`` parameter (regression: a
  hardcoded 95% would block ``--alpha 0.01`` audits).
- Regression gate firing on either-or instead of and-and (regression:
  either-or made the gate flap on tiny samples).
- Sample-size floor (<8 → ValueError, not a fake CI).
"""

from __future__ import annotations

import math

import numpy as np
import pytest

from eval.regression import (
    DEFAULT_RESAMPLES,
    DEFAULT_SEED,
    bootstrap_ci,
    cohens_d,
    regression_gate,
    welch_t_test,
)


# ---------------------------------------------------------------------------
# bootstrap CI
# ---------------------------------------------------------------------------


def test_bootstrap_ci_mean_matches_sample_mean() -> None:
    """The reported ``mean`` field is the empirical mean (not the bootstrap mean)."""
    samples = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]
    ci = bootstrap_ci(samples, seed=42)
    assert math.isclose(ci.mean, np.mean(samples)), ci


def test_bootstrap_ci_seed_reproducibility() -> None:
    """Same seed → same CI bounds, byte-equal."""
    s = [0.1, 0.5, 0.9, 0.2, 0.4, 0.7, 0.6, 0.3, 0.8, 0.5]
    a = bootstrap_ci(s, seed=DEFAULT_SEED)
    b = bootstrap_ci(s, seed=DEFAULT_SEED)
    assert a.low == b.low and a.high == b.high


def test_bootstrap_ci_alpha_is_honoured() -> None:
    """Tighter alpha widens the CI."""
    s = [0.1, 0.5, 0.9, 0.2, 0.4, 0.7, 0.6, 0.3, 0.8, 0.5]
    ci_95 = bootstrap_ci(s, alpha=0.05)
    ci_99 = bootstrap_ci(s, alpha=0.01)
    assert (ci_99.high - ci_99.low) >= (ci_95.high - ci_95.low)


def test_bootstrap_ci_rejects_under_8_samples() -> None:
    with pytest.raises(ValueError, match=r"≥8 samples"):
        bootstrap_ci([0.1, 0.2, 0.3])


def test_bootstrap_ci_rejects_nan() -> None:
    with pytest.raises(ValueError, match="non-finite"):
        bootstrap_ci([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, float("nan")])


# ---------------------------------------------------------------------------
# Cohen's d
# ---------------------------------------------------------------------------


def test_cohens_d_known_value() -> None:
    """Anchor against a hand-checked value.

    baseline = [0,0,0,0,0,0,0,0,0,0]   (mean 0, var 0)
    head     = [1,1,1,1,1,1,1,1,1,1]   (mean 1, var 0)
    pooled std = 0 → returns 0.0 (constant samples have no detectable effect).
    """
    a = [0.0] * 10
    b = [1.0] * 10
    assert cohens_d(a, b) == 0.0


def test_cohens_d_sign_convention() -> None:
    """Positive d means head > baseline (regardless of better/worse)."""
    rng = np.random.default_rng(0)
    a = rng.normal(0.5, 0.1, 50).tolist()
    b = rng.normal(0.7, 0.1, 50).tolist()
    d = cohens_d(a, b)
    assert d > 0, f"expected positive d, got {d}"


def test_cohens_d_anchor_two_normals() -> None:
    """For two normals (mean diff 1, std 1, n large) Cohen's d ≈ 1.0."""
    rng = np.random.default_rng(123)
    a = rng.normal(0.0, 1.0, 500).tolist()
    b = rng.normal(1.0, 1.0, 500).tolist()
    d = cohens_d(a, b)
    assert 0.85 < d < 1.15, f"expected d~1.0, got {d}"


def test_cohens_d_rejects_under_2_samples() -> None:
    with pytest.raises(ValueError):
        cohens_d([0.5], [0.6, 0.7])


# ---------------------------------------------------------------------------
# Welch's t-test
# ---------------------------------------------------------------------------


def test_welch_t_test_significant_difference() -> None:
    rng = np.random.default_rng(7)
    a = rng.normal(0.5, 0.05, 50).tolist()
    b = rng.normal(0.7, 0.05, 50).tolist()
    _, p = welch_t_test(a, b)
    assert p < 0.001


def test_welch_t_test_no_difference() -> None:
    rng = np.random.default_rng(7)
    a = rng.normal(0.5, 0.1, 50).tolist()
    b = rng.normal(0.5, 0.1, 50).tolist()
    _, p = welch_t_test(a, b)
    assert p > 0.05


# ---------------------------------------------------------------------------
# regression_gate (and-and rule)
# ---------------------------------------------------------------------------


def test_gate_higher_better_clear_regression_flags() -> None:
    rng = np.random.default_rng(11)
    base = rng.normal(0.85, 0.02, 50).tolist()
    head = rng.normal(0.55, 0.02, 50).tolist()
    v = regression_gate(
        flow="quality",
        baseline=base,
        head=head,
        direction="higher-better",
    )
    assert v.regressed is True
    assert v.cohen_d < -1.0
    assert v.welch_p < 0.001


def test_gate_higher_better_improvement_does_not_flag() -> None:
    """Improvements (head higher) on higher-better flows are NOT regressions."""
    rng = np.random.default_rng(13)
    base = rng.normal(0.6, 0.02, 50).tolist()
    head = rng.normal(0.85, 0.02, 50).tolist()
    v = regression_gate(
        flow="quality",
        baseline=base,
        head=head,
        direction="higher-better",
    )
    assert v.regressed is False, v.reason
    assert v.cohen_d > 1.0  # positive d, but it's improvement, not regression


def test_gate_lower_better_flips_direction() -> None:
    """For lower-better flows, head GROWING is the regression."""
    rng = np.random.default_rng(17)
    # latency went from 0.2s to 0.5s — a regression
    base = rng.normal(0.2, 0.02, 50).tolist()
    head = rng.normal(0.5, 0.02, 50).tolist()
    v = regression_gate(
        flow="latency_p50",
        baseline=base,
        head=head,
        direction="lower-better",
    )
    assert v.regressed is True
    assert v.cohen_d > 1.0


def test_gate_requires_both_d_and_p() -> None:
    """Tiny d but tiny p (huge n) should NOT flag — d gate prevents flap."""
    rng = np.random.default_rng(19)
    # std=1 → effect is 0.05 sigma → tiny d, but n=2000 makes p < 0.05
    base = rng.normal(0.5, 1.0, 2000).tolist()
    head = rng.normal(0.45, 1.0, 2000).tolist()
    v = regression_gate(
        flow="quality",
        baseline=base,
        head=head,
        direction="higher-better",
    )
    # p might be small here, but |d| should be < 0.2 → no regression
    assert abs(v.cohen_d) < 0.2
    assert v.regressed is False, v.reason


def test_gate_includes_diff_ci_in_verdict() -> None:
    rng = np.random.default_rng(23)
    base = rng.normal(0.85, 0.02, 50).tolist()
    head = rng.normal(0.85, 0.02, 50).tolist()
    v = regression_gate(
        flow="quality",
        baseline=base,
        head=head,
        direction="higher-better",
    )
    # Both arms are noise around the same mean ⇒ diff CI must span 0.
    # Pre-fix this asserted the head-mean fell inside head's own CI, which
    # was tautological (the bug being measured was that the field said
    # "diff" while computing "head-mean"). Now we assert the actual
    # treatment-vs-baseline interval.
    assert v.diff_ci_low < 0 < v.diff_ci_high
    assert abs(v.delta) < 0.05  # tiny mean shift in noise
    assert v.resamples == DEFAULT_RESAMPLES
    assert v.seed == DEFAULT_SEED


def test_diff_ci_recovers_known_lift() -> None:
    """Cross-language parity check: large lift ⇒ diff CI brackets it."""
    from eval.regression import bootstrap_diff_ci

    base = [0.5] * 30
    head = [0.7] * 30
    low, high = bootstrap_diff_ci(base, head, seed=DEFAULT_SEED)
    # Zero-variance arms ⇒ degenerate CI exactly at the point estimate 0.2.
    assert abs(low - 0.2) < 1e-9
    assert abs(high - 0.2) < 1e-9


def test_diff_ci_does_not_collapse_to_head_mean_ci() -> None:
    """Regression: pre-fix `regression_gate` returned the head-MEAN CI,
    not the delta CI. With baseline ≪ head, the head-mean CI lives near
    head_mean (~0.85) while the delta CI lives near delta (~0.15). The
    fields must report the latter.
    """
    rng = np.random.default_rng(99)
    base = rng.normal(0.70, 0.02, 30).tolist()
    head = rng.normal(0.85, 0.02, 30).tolist()
    v = regression_gate(
        flow="quality",
        baseline=base,
        head=head,
        direction="higher-better",
    )
    # Diff CI must be near 0.15, NOT near 0.85.
    assert 0.10 < v.diff_ci_low < 0.20
    assert 0.10 < v.diff_ci_high < 0.20
    # Sanity: not regressed (head moved up significantly, but in
    # higher-better direction → "improvement", which the gate codes as
    # not-regressed).
    assert v.regressed is False


def test_gate_invalid_direction_raises() -> None:
    with pytest.raises(ValueError, match="invalid direction"):
        regression_gate(
            flow="x",
            baseline=[0.5] * 10,
            head=[0.5] * 10,
            direction="sideways",
        )
