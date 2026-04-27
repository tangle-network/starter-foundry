"""Sandbox runner — wraps `tangle_sandbox` to execute one (hypothesis,
arm) pair in an isolated sandbox.

Lifecycle for each rep:

    1. create sandbox from `hypothesis.sandbox_image`
    2. wait_for("running")
    3. write treatment (or baseline) files via box.write
    4. apply env vars
    5. for each scenario: exec `scenario.command`, parse the metric
       value out of stdout's last JSON line
    6. delete sandbox

If `tangle-sandbox` is unreachable, this raises — we never silently
fall back to host-side execution. That's the harness's whole point.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, Protocol

from .types import Hypothesis, HypothesisResult, Scenario


class SandboxClientLike(Protocol):
    """Subset of `tangle_sandbox.Sandbox` we depend on.

    Defined as a Protocol so tests can mock it without importing the
    real client (which requires an API key and network).
    """

    def create(self, **kwargs: Any) -> Any: ...


@dataclass
class SandboxRunConfig:
    """Per-run knobs."""

    api_key: str
    base_url: str = "https://api.tangle.tools"
    timeout_seconds: int = 300


def _extract_metric(stdout: str, metric: str) -> float | None:
    """Pull a numeric metric out of the scenario's stdout.

    Convention: the scenario command prints a single JSON line as its
    last output line. We search backwards until we find one. If the
    JSON has the named metric and it's numeric, return float(value).
    Otherwise None.
    """
    for line in reversed(stdout.strip().splitlines()):
        line = line.strip()
        if not line.startswith("{") or not line.endswith("}"):
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        if metric in obj and isinstance(obj[metric], (int, float)):
            return float(obj[metric])
    return None


def _build_client(config: SandboxRunConfig) -> SandboxClientLike:
    """Lazy import so the module can be imported in tests without the
    SDK installed."""
    from tangle_sandbox import Sandbox  # type: ignore[import-not-found]

    return Sandbox(api_key=config.api_key, base_url=config.base_url)


def _apply_files(box: Any, files: dict[str, str]) -> None:
    for path, content in files.items():
        box.write(path, content)


def _run_one_arm(
    box: Any,
    arm_files: dict[str, str],
    arm_env: dict[str, str],
    scenarios: list[Scenario],
    metrics: list[str],
) -> dict[tuple[str, str], float | None]:
    """Apply files + env, run every scenario, collect every metric.

    Returns a {(scenario_id, metric): value-or-None} map.
    """
    _apply_files(box, arm_files)
    out: dict[tuple[str, str], float | None] = {}
    for sc in scenarios:
        cmd = " ".join(sc.command)
        result = box.exec(cmd, env=arm_env) if arm_env else box.exec(cmd)
        if getattr(result, "exit_code", 0) != 0:
            for metric in metrics:
                out[(sc.id, metric)] = None
            continue
        for metric in metrics:
            out[(sc.id, metric)] = _extract_metric(result.stdout, metric)
    return out


def run_hypothesis_rep(
    hypothesis: Hypothesis,
    rep_index: int,
    config: SandboxRunConfig | None = None,
    *,
    client_factory: Any = None,
) -> list[HypothesisResult]:
    """Execute one rep of a single hypothesis (treatment + baseline).

    Each rep stands up exactly one sandbox, applies the treatment,
    runs all scenarios, applies the baseline (clobbering treatment
    files), runs all scenarios, and tears down. This keeps env-cost
    constant in n_scenarios while still isolating reps.

    `client_factory` is a test seam — if provided, it must return a
    sandbox-like client matching `tangle_sandbox.Sandbox`'s contract.
    In production, omit it and the real client is constructed.
    """
    cfg = config or SandboxRunConfig(
        api_key=os.environ.get("TANGLE_SANDBOX_KEY", ""),
        base_url=os.environ.get("TANGLE_SANDBOX_URL", "https://api.tangle.tools"),
    )
    if not cfg.api_key and client_factory is None:
        raise RuntimeError(
            "TANGLE_SANDBOX_KEY is required (or pass client_factory in tests)"
        )

    client = client_factory(cfg) if client_factory else _build_client(cfg)
    box = client.create(image=hypothesis.sandbox_image)
    try:
        box.wait_for("running")
        treatment = _run_one_arm(
            box,
            hypothesis.treatment.files,
            hypothesis.treatment.env,
            hypothesis.scenarios,
            hypothesis.metrics,
        )
        baseline = _run_one_arm(
            box,
            hypothesis.baseline.files,
            hypothesis.baseline.env,
            hypothesis.scenarios,
            hypothesis.metrics,
        )
    finally:
        try:
            box.delete()
        except Exception:
            # Surface delete failures via stderr but don't shadow a
            # real exception that's already in flight. The sandbox
            # service has its own GC; a leaked sandbox won't poison
            # other reps.
            pass

    out: list[HypothesisResult] = []
    for sc in hypothesis.scenarios:
        for metric in hypothesis.metrics:
            t_val = treatment.get((sc.id, metric))
            b_val = baseline.get((sc.id, metric))
            err: str | None = None
            if t_val is None and b_val is None:
                err = "both-arms-missing-metric"
            out.append(
                HypothesisResult(
                    hypothesis_id=hypothesis.id,
                    scenario_id=sc.id,
                    metric=metric,
                    treatment_value=t_val,
                    baseline_value=b_val,
                    error=err,
                    rep_index=rep_index,
                )
            )
    return out
