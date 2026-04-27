"""Screener — 1 rep per hypothesis, rank by mean delta.

Cheap-pass filter that decides which hypotheses are worth full
multi-rep validation. Output is a deterministic ranking sorted by
mean-delta descending. Errors don't drop a hypothesis from the
ranking — they're surfaced via `n_errors` so the operator can see
which entries were partially observed.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from .types import HypothesisResult, ScreeningRow


class ScreeningRanking(BaseModel):
    rows: list[ScreeningRow] = Field(default_factory=list)

    def top(self, k: int) -> list[str]:
        """IDs of the top-k hypotheses by mean delta (descending)."""
        return [r.hypothesis_id for r in self.rows[:k] if r.n_errors < r.n_scenarios]


def _row_for(hid: str, results: list[HypothesisResult]) -> ScreeningRow:
    deltas: list[float] = []
    n_errors = 0
    for r in results:
        if r.error is not None or r.treatment_value is None or r.baseline_value is None:
            n_errors += 1
            continue
        deltas.append(r.treatment_value - r.baseline_value)
    n_scenarios = len(results)
    mean_delta = sum(deltas) / len(deltas) if deltas else float("-inf")
    return ScreeningRow(
        hypothesis_id=hid,
        mean_delta=mean_delta,
        n_scenarios=n_scenarios,
        n_errors=n_errors,
    )


def run_screen(
    results_by_hypothesis: dict[str, list[HypothesisResult]],
) -> ScreeningRanking:
    """Rank hypotheses by mean delta across their scenarios.

    Hypotheses where every scenario errored are sorted to the bottom
    (mean_delta = -inf) so they don't accidentally win a tie-break.
    """
    rows = [_row_for(hid, results) for hid, results in results_by_hypothesis.items()]
    rows.sort(key=lambda r: (r.mean_delta, r.hypothesis_id), reverse=True)
    # Stable secondary sort by id so the ranking is deterministic.
    rows.sort(key=lambda r: r.mean_delta, reverse=True)
    return ScreeningRanking(rows=rows)
