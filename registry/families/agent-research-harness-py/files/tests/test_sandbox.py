"""Sandbox lifecycle — mocked because there's no live router/sandbox
in the family scaffold's pytest run.

Documented limit: this test stops at the boundary between the harness
and `tangle_sandbox.Sandbox`. It verifies our orchestration (create →
wait_for → write → exec → delete, in that order, with treatment +
baseline both applied) is correct. It does NOT verify the real SDK.

For end-to-end sandbox integration, set `TANGLE_SANDBOX_KEY` and run
the harness via `python -m research screen` against the example
hypothesis. That path is exercised by the nightly CI in
`.github/workflows/research.yml`.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pytest

from research.sandbox_runner import (
    SandboxRunConfig,
    _extract_metric,
    run_hypothesis_rep,
)
from research.types import Baseline, Hypothesis, Scenario, Treatment


@dataclass
class _ExecResult:
    exit_code: int
    stdout: str
    stderr: str = ""


@dataclass
class _MockBox:
    image: str
    events: list[tuple[str, Any]] = field(default_factory=list)
    deleted: bool = False
    _file_state: dict[str, str] = field(default_factory=dict)

    def wait_for(self, status: str) -> None:
        self.events.append(("wait_for", status))

    def write(self, path: str, content: str) -> None:
        self.events.append(("write", (path, content)))
        self._file_state[path] = content

    def exec(self, command: str, env: dict[str, str] | None = None) -> _ExecResult:
        self.events.append(("exec", (command, dict(self._file_state), env or {})))
        # Synthesize a metric reading that depends on the file state
        # so tests can assert treatment vs baseline produced different
        # values.
        marker = self._file_state.get("config/runtime.env", "")
        qps = 100.0 if "BATCH_SIZE=64" in marker else 50.0
        return _ExecResult(exit_code=0, stdout=f'{{"qps": {qps}}}\n')

    def delete(self) -> None:
        self.deleted = True
        self.events.append(("delete", None))


@dataclass
class _MockClient:
    last_box: _MockBox | None = None

    def create(self, image: str = "ubuntu") -> _MockBox:
        box = _MockBox(image=image)
        self.last_box = box
        return box


def _client_factory(_cfg: SandboxRunConfig) -> _MockClient:
    return _MockClient()


def _hypothesis() -> Hypothesis:
    return Hypothesis(
        id="h-batch",
        description="Doubling batch size should improve qps without breaking the run.",
        sandboxImage="ubuntu",
        treatment=Treatment(
            description="batch=64",
            files={"config/runtime.env": "BATCH_SIZE=64\n"},
            env={},
        ),
        baseline=Baseline(
            description="batch=32",
            files={"config/runtime.env": "BATCH_SIZE=32\n"},
            env={},
        ),
        scenarios=[
            Scenario(
                id="bench",
                description="run benchmark",
                command=["bash", "-c", "scripts/run-bench.sh"],
            )
        ],
        metrics=["qps"],
    )


def test_extract_metric_picks_last_json_line() -> None:
    stdout = "noise\n{'not': 'json'}\n{\"qps\": 42.5}\n"
    assert _extract_metric(stdout, "qps") == 42.5


def test_extract_metric_returns_none_when_metric_missing() -> None:
    stdout = '{"throughput": 99}\n'
    assert _extract_metric(stdout, "qps") is None


def test_extract_metric_returns_none_when_no_json() -> None:
    assert _extract_metric("just text\n", "qps") is None


def test_run_hypothesis_rep_creates_treatment_baseline_and_deletes_sandbox() -> None:
    h = _hypothesis()
    cfg = SandboxRunConfig(api_key="test-key", base_url="http://localhost")
    captured: dict[str, _MockClient] = {}

    def factory(c: SandboxRunConfig) -> _MockClient:
        client = _client_factory(c)
        captured["c"] = client
        return client

    results = run_hypothesis_rep(h, rep_index=0, config=cfg, client_factory=factory)
    assert len(results) == 1
    r = results[0]
    assert r.hypothesis_id == "h-batch"
    assert r.scenario_id == "bench"
    assert r.metric == "qps"
    assert r.treatment_value == 100.0
    assert r.baseline_value == 50.0
    assert r.error is None
    assert r.rep_index == 0

    box = captured["c"].last_box
    assert box is not None and box.deleted, "sandbox must be deleted after the rep"
    kinds = [ev[0] for ev in box.events]
    # Order contract: wait_for → (write+exec for treatment) → (write+exec for baseline) → delete
    assert kinds[0] == "wait_for"
    assert kinds[-1] == "delete"
    assert kinds.count("write") == 2
    assert kinds.count("exec") == 2


def test_run_hypothesis_rep_requires_sandbox_key_when_no_factory() -> None:
    h = _hypothesis()
    cfg = SandboxRunConfig(api_key="", base_url="http://localhost")
    with pytest.raises(RuntimeError, match="TANGLE_SANDBOX_KEY"):
        run_hypothesis_rep(h, rep_index=0, config=cfg)


def test_run_hypothesis_rep_marks_error_when_both_arms_missing_metric() -> None:
    """If the scenario's command emits no metric line, both arms come
    back as None and the result must carry an `error` so downstream
    code doesn't average None into the verdict."""

    class _BlankBox(_MockBox):
        def exec(self, command: str, env: dict[str, str] | None = None) -> _ExecResult:
            return _ExecResult(exit_code=0, stdout="no json here\n")

    class _BlankClient(_MockClient):
        def create(self, image: str = "ubuntu") -> _BlankBox:
            box = _BlankBox(image=image)
            self.last_box = box
            return box

    h = _hypothesis()
    results = run_hypothesis_rep(
        h,
        rep_index=0,
        config=SandboxRunConfig(api_key="x"),
        client_factory=lambda _c: _BlankClient(),
    )
    assert results[0].treatment_value is None
    assert results[0].baseline_value is None
    assert results[0].error == "both-arms-missing-metric"
