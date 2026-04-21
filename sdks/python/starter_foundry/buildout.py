"""emit_buildout_event — append a trace event to a starter-foundry
buildouts.jsonl sink. Mirrors the TS emitBuildoutEvent contract.

Usage:
    from starter_foundry import emit_buildout_event

    emit_buildout_event({
        "sessionId": run.id,
        "sourceModel": "blueprint-agent-vb",
        "scenarioId": run.scenario_id,
        "initialPrompt": run.prompt,
        "addedPackages": [{"pm": "pnpm", "name": n} for n in run.installed],
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
"""

import json
import os
from pathlib import Path
from typing import Any, Optional

BUILDOUT_SCHEMA_VERSION = 3
_DEFAULT_PATH = ".evolve/traces/buildouts.jsonl"


def emit_buildout_event(event: dict[str, Any], path: Optional[str] = None) -> dict[str, Any]:
    """Append a BuildoutEvent to the pipeline sink.

    Atomic (O_APPEND) — safe from concurrent writers.

    Raises ValueError if sessionId or sourceModel is missing/empty.
    """
    session_id = event.get("sessionId") or ""
    source_model = event.get("sourceModel") or ""
    if not session_id:
        raise ValueError("emit_buildout_event: sessionId is required")
    if not source_model:
        raise ValueError("emit_buildout_event: sourceModel is required")

    target = Path(path or _DEFAULT_PATH)
    target.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "schemaVersion": BUILDOUT_SCHEMA_VERSION,
        "sessionId": session_id,
        "sourcePath": event.get("sourcePath", ""),
        "sourceModel": source_model,
        "scenarioId": event.get("scenarioId"),
        "partnerGuess": event.get("partnerGuess"),
        "replayRound": event.get("replayRound"),
        "firstTs": event.get("firstTs"),
        "lastTs": event.get("lastTs"),
        "initialPrompt": event.get("initialPrompt"),
        "addedPackages": event.get("addedPackages", []),
        "addedDirs": event.get("addedDirs", []),
        "rewrittenFiles": event.get("rewrittenFiles", []),
        "outcome": event.get("outcome"),
    }

    # O_APPEND ensures interleaved writes from multiple processes all land
    # as complete lines — same contract as the TS SDK.
    fd = os.open(str(target), os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
    try:
        os.write(fd, (json.dumps(payload) + "\n").encode("utf-8"))
    finally:
        os.close(fd)
    return payload
