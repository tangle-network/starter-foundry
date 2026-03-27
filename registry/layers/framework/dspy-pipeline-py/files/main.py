import json
import os


def run_pipeline() -> dict[str, object]:
    return {
        "pipeline": "{{pipelineName}}",
        "steps": ["retrieve", "reason", "respond"],
        "optimizer": "manual-baseline",
    }


if os.getenv("RUN_ONCE") == "1":
    print("dspy pipeline ok")
    print(json.dumps(run_pipeline()))
else:
    print(json.dumps(run_pipeline()))
