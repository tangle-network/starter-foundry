"""Screener regressions.

Catches:
    - mis-ranking when one hypothesis has consistent positive deltas
    - hypotheses with all-error scenarios sneaking into top()
    - non-deterministic ordering (must be stable for repeat runs)
"""

from __future__ import annotations

from research.screener import run_screen
from research.types import HypothesisResult


def _result(hid: str, sid: str, t: float | None, b: float | None, err: str | None = None) -> HypothesisResult:
    return HypothesisResult(
        hypothesis_id=hid,
        scenario_id=sid,
        metric="qps",
        treatment_value=t,
        baseline_value=b,
        error=err,
    )


def test_screener_ranks_by_mean_delta_descending() -> None:
    results: dict[str, list[HypothesisResult]] = {
        "h-low": [_result("h-low", "s1", 11.0, 10.0), _result("h-low", "s2", 11.0, 10.0)],
        "h-high": [_result("h-high", "s1", 20.0, 10.0), _result("h-high", "s2", 18.0, 10.0)],
        "h-mid": [_result("h-mid", "s1", 15.0, 10.0), _result("h-mid", "s2", 15.0, 10.0)],
        "h-neg": [_result("h-neg", "s1", 5.0, 10.0), _result("h-neg", "s2", 7.0, 10.0)],
        "h-zero": [_result("h-zero", "s1", 10.0, 10.0), _result("h-zero", "s2", 10.0, 10.0)],
    }
    ranking = run_screen(results)
    ids = [row.hypothesis_id for row in ranking.rows]
    # Expected order by mean delta:  h-high(9) > h-mid(5) > h-low(1) > h-zero(0) > h-neg(-3.5)
    assert ids == ["h-high", "h-mid", "h-low", "h-zero", "h-neg"], ids


def test_screener_top_excludes_all_error_hypotheses() -> None:
    results: dict[str, list[HypothesisResult]] = {
        "h-good": [_result("h-good", "s1", 11.0, 10.0)],
        "h-broken": [_result("h-broken", "s1", None, None, err="exec-failed")],
    }
    ranking = run_screen(results)
    assert "h-broken" not in ranking.top(2)
    assert ranking.top(2) == ["h-good"]


def test_screener_top_k_respects_k() -> None:
    results: dict[str, list[HypothesisResult]] = {
        f"h-{i}": [_result(f"h-{i}", "s1", float(10 + i), 10.0)] for i in range(5)
    }
    ranking = run_screen(results)
    top3 = ranking.top(3)
    assert top3 == ["h-4", "h-3", "h-2"]


def test_screener_handles_partial_errors() -> None:
    """A hypothesis with one good scenario and one errored scenario
    should rank by the good scenario's delta — and the row's
    n_errors must reflect the failure."""
    results: dict[str, list[HypothesisResult]] = {
        "h-partial": [
            _result("h-partial", "s1", 12.0, 10.0),
            _result("h-partial", "s2", None, None, err="timeout"),
        ],
    }
    ranking = run_screen(results)
    row = ranking.rows[0]
    assert row.hypothesis_id == "h-partial"
    assert row.mean_delta == 2.0
    assert row.n_errors == 1
    assert row.n_scenarios == 2
