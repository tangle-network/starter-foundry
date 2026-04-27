"""Runner tests.

Regressions these protect against:

- Scenario loader silently dropping a scenario file (regression: would emit
  a scorecard with N-1 flows but no error).
- Aggregate computation including ``unmeasured`` / ``gap`` in the denominator
  (regression: drops aggregate any time a judge times out).
- ``derive_status`` flipping for ``lower-better`` flows (regression: marked
  a passing fast benchmark as fail because direction inversion was missed).
- ``write_scorecard`` emitting non-deterministic key order (regression:
  cross-language byte-equal compare would break).
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from eval.judges.rubric import JudgeInput, JudgeResult
from eval.runner import RunConfig, run_scenarios
from eval.scorecard import (
    Scorecard,
    ScorecardFlow,
    aggregate_score,
    derive_status,
    load_scorecard,
    write_scorecard,
)

# ---------------------------------------------------------------------------
# Scenario discovery + flow emission
# ---------------------------------------------------------------------------


def _write_scenario(scenarios_dir: Path, name: str, body: str) -> None:
    path = scenarios_dir / f"{name}.py"
    path.write_text(body, encoding="utf-8")


_PASS_SCENARIO = """
from eval.judges.rubric import JudgeInput, JudgeResult


def _agent(prompt):
    return "yes"


def _judge(ji: JudgeInput) -> JudgeResult:
    return JudgeResult(score=1.0, ok=True, rationale="exact")


SCENARIO = {
    "name": "always_pass",
    "input": "anything",
    "expected_output": "yes",
    "target": 0.5,
    "direction": "higher-better",
    "productValueClaim": "smoke",
    "agent_fn": _agent,
    "judges": [_judge],
}
"""

_FAIL_SCENARIO = """
from eval.judges.rubric import JudgeInput, JudgeResult


def _agent(prompt):
    return "no"


def _judge(ji: JudgeInput) -> JudgeResult:
    return JudgeResult(score=0.1, ok=True, rationale="below target")


SCENARIO = {
    "name": "always_fail",
    "input": "anything",
    "expected_output": "yes",
    "target": 0.85,
    "direction": "higher-better",
    "productValueClaim": "smoke",
    "agent_fn": _agent,
    "judges": [_judge],
}
"""

_NO_JUDGE_SCENARIO = """
def _agent(prompt):
    return "x"


SCENARIO = {
    "name": "no_judge",
    "input": "anything",
    "target": 0.85,
    "direction": "higher-better",
    "productValueClaim": "gap-test",
    "agent_fn": _agent,
    "judges": [],
}
"""

_LOWER_BETTER_SCENARIO = """
from eval.judges.rubric import JudgeInput, JudgeResult


def _agent(prompt):
    return "x"


def _judge(ji: JudgeInput) -> JudgeResult:
    # Latency-style metric — lower is better. Score is the measured value (e.g. 0.2s).
    return JudgeResult(score=0.2, ok=True)


SCENARIO = {
    "name": "fast_path",
    "input": "anything",
    "target": 0.5,
    "direction": "lower-better",
    "productValueClaim": "fast=good",
    "agent_fn": _agent,
    "judges": [_judge],
}
"""

_BROKEN_JUDGE_SCENARIO = """
from eval.judges.rubric import JudgeInput, JudgeResult


def _agent(prompt):
    return "x"


def _judge(ji: JudgeInput) -> JudgeResult:
    raise RuntimeError("judge boom")


SCENARIO = {
    "name": "judge_explodes",
    "input": "anything",
    "target": 0.85,
    "direction": "higher-better",
    "productValueClaim": "judge-error-test",
    "agent_fn": _agent,
    "judges": [_judge],
}
"""


def test_runner_emits_one_flow_per_scenario(tmp_path: Path) -> None:
    """Every scenario file produces exactly one flow — no silent drops."""
    scen = tmp_path / "scenarios"
    scen.mkdir()
    _write_scenario(scen, "a", _PASS_SCENARIO)
    _write_scenario(scen, "b", _FAIL_SCENARIO)
    _write_scenario(scen, "c", _NO_JUDGE_SCENARIO)

    cfg = RunConfig(scenarios_dir=scen, out_path=tmp_path / "out.json")
    card = run_scenarios(cfg)

    names = sorted(f.name for f in card.flows)
    assert names == ["always_fail", "always_pass", "no_judge"], names
    assert card.product == "agent-eval-harness-py"


def test_status_pass_fail_gap_unmeasured(tmp_path: Path) -> None:
    """Status assignment matches the contract for each scenario type."""
    scen = tmp_path / "scenarios"
    scen.mkdir()
    _write_scenario(scen, "p", _PASS_SCENARIO)
    _write_scenario(scen, "f", _FAIL_SCENARIO)
    _write_scenario(scen, "n", _NO_JUDGE_SCENARIO)
    _write_scenario(scen, "b", _BROKEN_JUDGE_SCENARIO)

    cfg = RunConfig(scenarios_dir=scen, out_path=tmp_path / "out.json")
    card = run_scenarios(cfg)

    by_name = {f.name: f for f in card.flows}
    assert by_name["always_pass"].status == "pass", by_name["always_pass"]
    assert by_name["always_fail"].status == "fail", by_name["always_fail"]
    assert by_name["no_judge"].status == "gap", by_name["no_judge"]
    # Broken judge → all judges failed → unmeasured (NOT fail).
    assert by_name["judge_explodes"].status == "unmeasured", by_name["judge_explodes"]
    assert by_name["judge_explodes"].value is None
    assert "judge raised" in (by_name["judge_explodes"].notes or "")


def test_aggregate_excludes_unmeasured_and_gap(tmp_path: Path) -> None:
    """Aggregate denominator is measurable flows only — gap/unmeasured don't move it."""
    scen = tmp_path / "scenarios"
    scen.mkdir()
    _write_scenario(scen, "p", _PASS_SCENARIO)
    _write_scenario(scen, "f", _FAIL_SCENARIO)
    _write_scenario(scen, "n", _NO_JUDGE_SCENARIO)

    cfg = RunConfig(scenarios_dir=scen, out_path=tmp_path / "out.json")
    card = run_scenarios(cfg)
    # 1 pass + 1 fail measurable; gap excluded → aggregate = 1/2 = 0.5
    assert card.aggregate == 0.5, card.aggregate
    assert "1/3 flows measured" in card.coverage or "2/3 flows measured" in card.coverage


def test_lower_better_direction_inversion() -> None:
    """``derive_status`` inverts comparison for lower-better flows."""
    assert derive_status(0.2, 0.5, "lower-better") == "pass"
    assert derive_status(0.7, 0.5, "lower-better") == "fail"
    assert derive_status(0.7, 0.5, "higher-better") == "pass"
    assert derive_status(0.2, 0.5, "higher-better") == "fail"
    assert derive_status(None, 0.5, "higher-better") == "unmeasured"


def test_write_scorecard_round_trip_and_byte_stable(tmp_path: Path) -> None:
    """``write_scorecard`` produces a deterministic JSON we can re-load."""
    flows = [
        ScorecardFlow(
            name="x",
            value=0.91234567,
            target=0.85,
            status="pass",
            productValueClaim="claim",
            direction="higher-better",
        ),
        ScorecardFlow(
            name="y",
            value=None,
            target=0.85,
            status="gap",
            productValueClaim="claim2",
            direction="higher-better",
        ),
    ]
    card = Scorecard.build(product="t", flows=flows)
    out = write_scorecard(card, tmp_path / "sc.json")
    raw = out.read_text(encoding="utf-8")
    parsed = json.loads(raw)
    # Rounding: 0.91234567 -> 0.9123 (4 decimals)
    assert parsed["flows"][0]["value"] == 0.9123, parsed["flows"][0]
    # ``value`` is required — gap flow keeps the key with null so round-trip works.
    assert "value" in parsed["flows"][1] and parsed["flows"][1]["value"] is None
    # ``notes`` is optional + None → omitted entirely (matches TS undefined-drop).
    assert "notes" not in parsed["flows"][0]
    # Round-trip
    reloaded = load_scorecard(out)
    assert reloaded.aggregate == card.aggregate
    assert [f.name for f in reloaded.flows] == ["x", "y"]


def test_aggregate_score_zero_when_no_measurable() -> None:
    flows = [
        ScorecardFlow(
            name="g",
            value=None,
            target=0.85,
            status="gap",
            productValueClaim="x",
            direction="higher-better",
        ),
        ScorecardFlow(
            name="u",
            value=None,
            target=0.85,
            status="unmeasured",
            productValueClaim="x",
            direction="higher-better",
        ),
    ]
    assert aggregate_score(flows) == 0.0


def test_runner_raises_when_no_scenarios(tmp_path: Path) -> None:
    scen = tmp_path / "scenarios"
    scen.mkdir()
    cfg = RunConfig(scenarios_dir=scen, out_path=tmp_path / "out.json")
    with pytest.raises(ValueError, match="no scenarios"):
        run_scenarios(cfg)


def test_runner_raises_on_missing_required_keys(tmp_path: Path) -> None:
    scen = tmp_path / "scenarios"
    scen.mkdir()
    (scen / "bad.py").write_text(
        "SCENARIO = {'name': 'x'}\n", encoding="utf-8"
    )
    cfg = RunConfig(scenarios_dir=scen, out_path=tmp_path / "out.json")
    with pytest.raises(ValueError, match="missing required keys"):
        run_scenarios(cfg)
