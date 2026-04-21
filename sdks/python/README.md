# starter-foundry — Python SDK

Thin Python client for starter-foundry. Mirrors the TS SDK's contracts for the
two flows a Python consumer (bench runner, ML training orchestrator) needs most:

```python
from starter_foundry import emit_buildout_event, validate_plan_via_cli

# Emit a buildout outcome into the pipeline (canonical path — the TS detector + scorecard read it)
emit_buildout_event({
    "sessionId": run.id,
    "sourceModel": "bench-runner-py",
    "scenarioId": run.scenario_id,
    "initialPrompt": run.prompt,
    "addedPackages": [{"pm": "pnpm", "name": p} for p in run.installed],
    "outcome": {
        "source": "vb-execution",
        "allPass": run.ok,
        "blendedScore": run.score,
        "failingLayers": run.failing,
        "shotsRun": run.shots,
        "shotsToConvergence": run.converged_at,
        "wallMs": run.wall_ms,
        "toolCallsTotal": run.tool_calls,
    },
})

# Dry-run a plan against the live registry (requires node on PATH)
verdict = validate_plan_via_cli({
    "projectName": "demo",
    "family": "react-vite-ts",
    "layers": ["framework:react-vite-ts", "capability:shadcn"],
    "partner": None,
    "slots": {},
    "variables": {},
})
assert verdict["ok"], verdict["issues"]
```

## Install (local development)

```bash
cd sdks/python
pip install -e .
```

Published version incoming once the shape is validated against a real consumer.

## What this is not

- Not a full compose client. Compose writes files — it needs node + the registry locally. Compose stays TS-first.
- Not a drop-in for the TS SDK. Python-specific contracts (emit events, validate plans); not the full surface.
