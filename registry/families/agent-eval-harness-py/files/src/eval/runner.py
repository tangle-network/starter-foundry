"""Scenario runner.

A scenario is a Python module under ``scenarios/`` that exposes a top-level
``SCENARIO`` dict (or a callable returning one). Shape::

    SCENARIO = {
        "name": "<unique-flow-name>",
        "input": "<prompt sent to the agent>",
        "expected_output": "<reference output, optional>",
        "target": 0.85,                          # threshold for the judge mean
        "direction": "higher-better",            # or "lower-better"
        "productValueClaim": "<one sentence>",
        "judges": [<callable: JudgeInput -> JudgeResult>],  # 1+
        # OR for local-driver scenarios:
        "agent_fn": <callable: str -> str>,      # only when driver=local
    }

The runner discovers scenarios with ``importlib`` (no eval, no exec), runs
each one against the chosen driver, asks every judge to score, then writes
a :class:`Scorecard`. A scenario with ``judges=[]`` records a ``gap`` flow.
"""

from __future__ import annotations

import importlib.util
import logging
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Iterable, Literal

from .judges.rubric import JudgeInput, JudgeResult
from .scorecard import (
    FlowDirection,
    Scorecard,
    ScorecardFlow,
    ScorecardInput,
    derive_status,
)

log = logging.getLogger("eval.runner")

Driver = Literal["local", "http", "sandbox"]


@dataclass
class RunConfig:
    """Knobs controlling a single ``run_scenarios`` invocation."""

    scenarios_dir: Path
    out_path: Path
    driver: Driver = "local"
    agent_url: str | None = None  # required when driver="http"
    bundle_dir: Path | None = None  # required when driver="sandbox"
    sandbox_image: str = "node:20"  # sandbox driver image
    sandbox_name_prefix: str = "eval-harness"
    product: str = "agent-eval-harness-py"
    declared_count: int | None = None
    judge_required: bool = True


@dataclass
class _LoadedScenario:
    name: str
    module_path: Path
    spec: dict[str, Any]


def _iter_scenario_files(scenarios_dir: Path) -> Iterable[Path]:
    if not scenarios_dir.exists():
        raise FileNotFoundError(f"scenarios directory not found: {scenarios_dir}")
    for entry in sorted(scenarios_dir.iterdir()):
        if entry.suffix != ".py":
            continue
        if entry.name.startswith("_") or entry.name == "__init__.py":
            continue
        yield entry


def _load_scenario(path: Path) -> _LoadedScenario:
    """Import a scenario module by file path; return its SCENARIO dict.

    Modules are loaded with a unique ``__name__`` per file so two scenarios
    with the same module name (different dirs) don't clobber sys.modules.
    """
    mod_name = f"_eval_scenario_{path.stem}_{abs(hash(str(path)))}"
    spec = importlib.util.spec_from_file_location(mod_name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot build import spec for {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[mod_name] = module
    spec.loader.exec_module(module)

    raw = getattr(module, "SCENARIO", None)
    if callable(raw):
        raw = raw()
    if not isinstance(raw, dict):
        raise ValueError(
            f"scenario {path} must define a top-level SCENARIO dict (or callable returning one)"
        )

    required = ("name", "input", "target", "direction", "productValueClaim")
    missing = [k for k in required if k not in raw]
    if missing:
        raise ValueError(f"scenario {path} missing required keys: {missing}")

    return _LoadedScenario(name=str(raw["name"]), module_path=path, spec=raw)


# ----------------------------------------------------------------------
# Drivers — each one returns the agent's output for a given input string.
# ----------------------------------------------------------------------


def _run_local(spec: dict[str, Any]) -> str:
    fn = spec.get("agent_fn")
    if not callable(fn):
        raise ValueError(
            f"scenario {spec['name']!r} declares no agent_fn; "
            "use --driver http or --driver sandbox, or add agent_fn"
        )
    out = fn(spec["input"])
    if not isinstance(out, str):
        raise TypeError(
            f"scenario {spec['name']!r} agent_fn returned non-str: {type(out).__name__}"
        )
    return out


def _run_http(spec: dict[str, Any], agent_url: str) -> str:
    """OpenAI-shaped chat-completions call."""
    import httpx

    body = {
        "model": spec.get("model", "agent-under-test"),
        "messages": [{"role": "user", "content": spec["input"]}],
    }
    with httpx.Client(timeout=120.0) as client:
        resp = client.post(agent_url, json=body)
    if resp.status_code >= 400:
        raise RuntimeError(f"agent HTTP {resp.status_code}: {resp.text[:500]}")
    data = resp.json()
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as err:
        raise RuntimeError(
            f"agent response missing choices[0].message.content: {data!r}"
        ) from err


@dataclass
class _ScenarioOutcome:
    name: str
    actual_output: str | None
    judge_results: list[JudgeResult] = field(default_factory=list)
    error: str | None = None
    duration_ms: float = 0.0


def _run_one_with_driver(
    scen: _LoadedScenario, cfg: RunConfig, sandbox_runner_cb: Callable | None
) -> _ScenarioOutcome:
    spec = scen.spec
    started = time.monotonic()
    try:
        if cfg.driver == "local":
            actual = _run_local(spec)
        elif cfg.driver == "http":
            if not cfg.agent_url:
                raise ValueError("driver=http requires agent_url")
            actual = _run_http(spec, cfg.agent_url)
        elif cfg.driver == "sandbox":
            if sandbox_runner_cb is None:
                raise ValueError(
                    "driver=sandbox requires a SandboxDriver instance "
                    "(passed via run_scenarios)"
                )
            actual = sandbox_runner_cb(spec)
        else:
            raise ValueError(f"unknown driver {cfg.driver!r}")
    except Exception as err:  # noqa: BLE001 — capture for the scorecard
        return _ScenarioOutcome(
            name=scen.name,
            actual_output=None,
            error=f"driver error: {err}",
            duration_ms=(time.monotonic() - started) * 1000,
        )

    # Run every declared judge.
    judges = spec.get("judges") or []
    results: list[JudgeResult] = []
    for j in judges:
        ji = JudgeInput(
            scenario=scen.name,
            input=spec["input"],
            expected_output=spec.get("expected_output"),
            actual_output=actual,
        )
        try:
            r = j(ji)
        except Exception as err:  # noqa: BLE001
            r = JudgeResult(
                score=0.0,
                ok=False,
                error=f"judge raised: {err}",
            )
        if not isinstance(r, JudgeResult):
            r = JudgeResult(
                score=0.0,
                ok=False,
                error=f"judge returned non-JudgeResult: {type(r).__name__}",
            )
        results.append(r)

    return _ScenarioOutcome(
        name=scen.name,
        actual_output=actual,
        judge_results=results,
        duration_ms=(time.monotonic() - started) * 1000,
    )


def _aggregate_judge_score(results: list[JudgeResult]) -> tuple[float | None, str | None]:
    """Mean of OK judge scores. Returns (None, reason) if all judges failed."""
    ok = [r for r in results if r.ok]
    if not ok:
        if not results:
            return None, "no judges declared"
        first_err = results[0].error or "all judges failed"
        return None, first_err
    return sum(r.score for r in ok) / len(ok), None


def run_scenarios(
    cfg: RunConfig,
    *,
    sandbox_runner: Any | None = None,
) -> Scorecard:
    """Run every scenario in ``cfg.scenarios_dir`` and return the scorecard.

    ``sandbox_runner`` is a :class:`SandboxDriver` instance (or any callable
    object exposing ``run(spec) -> str``); pass it in only when ``driver=sandbox``.
    """
    scenarios = [_load_scenario(p) for p in _iter_scenario_files(cfg.scenarios_dir)]
    if not scenarios:
        raise ValueError(f"no scenarios found in {cfg.scenarios_dir}")

    # Adapter: convert a SandboxDriver into a (spec) -> str callable.
    sb_cb: Callable[[dict[str, Any]], str] | None = None
    if sandbox_runner is not None:
        if not hasattr(sandbox_runner, "run"):
            raise TypeError(
                "sandbox_runner must expose a .run(spec) -> str method "
                "(got %r)" % type(sandbox_runner).__name__
            )
        sb_cb = sandbox_runner.run

    flows: list[ScorecardFlow] = []
    inputs: list[ScorecardInput] = []
    for scen in scenarios:
        outcome = _run_one_with_driver(scen, cfg, sb_cb)
        spec = scen.spec
        target = float(spec["target"])
        direction: FlowDirection = spec["direction"]
        notes_parts: list[str] = []
        if outcome.error:
            notes_parts.append(outcome.error)
        if not (spec.get("judges") or []):
            # No judges => gap (the run can't measure this).
            flows.append(
                ScorecardFlow(
                    name=scen.name,
                    value=None,
                    target=target,
                    status="gap",
                    productValueClaim=spec["productValueClaim"],
                    direction=direction,
                    notes="no judges declared",
                )
            )
            continue

        score, reason = _aggregate_judge_score(outcome.judge_results)
        if score is None:
            status = "unmeasured"
            if reason:
                notes_parts.append(reason)
            value: float | None = None
        else:
            value = score
            status = derive_status(value, target, direction)

        flows.append(
            ScorecardFlow(
                name=scen.name,
                value=value,
                target=target,
                status=status,
                productValueClaim=spec["productValueClaim"],
                direction=direction,
                notes="; ".join(notes_parts) if notes_parts else None,
            )
        )
        inputs.append(
            ScorecardInput(
                path=str(scen.module_path),
                mtime=time.strftime(
                    "%Y-%m-%dT%H:%M:%SZ",
                    time.gmtime(scen.module_path.stat().st_mtime),
                ),
            )
        )

    return Scorecard.build(
        product=cfg.product,
        flows=flows,
        inputs=inputs,
        declared_count=cfg.declared_count if cfg.declared_count is not None else len(scenarios),
    )
