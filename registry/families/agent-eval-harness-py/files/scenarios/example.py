"""Example scenario — agent must respond with the literal word `pong` to a `ping`.

This scenario uses a deterministic local agent (no LLM) so CI can run it
offline. Replace ``agent_fn`` with an HTTP call or sandbox driver in real use.

To enable the rubric judge, set ``TANGLE_API_KEY`` and pass
``--driver local`` (the local driver still consults the judge — only the
agent-under-test is local).
"""

from __future__ import annotations

from eval.judges.rubric import JudgeInput, JudgeResult


def _agent_fn(prompt: str) -> str:
    """A trivial agent: replies 'pong' iff the prompt contains 'ping'."""
    return "pong" if "ping" in prompt.lower() else "unknown"


def _exact_match_judge(ji: JudgeInput) -> JudgeResult:
    """Offline judge — case-insensitive exact match against expected_output.

    Demonstrates the judge contract without needing the router. Real
    deployments swap this for a ``RubricJudge``.
    """
    expected = (ji.expected_output or "").strip().lower()
    actual = ji.actual_output.strip().lower()
    score = 1.0 if expected and actual == expected else 0.0
    return JudgeResult(
        score=score,
        ok=True,
        rationale=f"expected={expected!r} actual={actual!r}",
    )


SCENARIO = {
    "name": "example_ping_pong",
    "input": "ping",
    "expected_output": "pong",
    "target": 0.85,
    "direction": "higher-better",
    "productValueClaim": (
        "Smoke test — proves the harness can load a scenario, dispatch to a "
        "local agent, score with a judge, and emit a flow. If this fails, "
        "the harness is broken before any real eval can run."
    ),
    "agent_fn": _agent_fn,
    "judges": [_exact_match_judge],
}
