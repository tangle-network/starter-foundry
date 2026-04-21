"""Python SDK for starter-foundry.

Thin HTTP client over a starter-foundry node bridge. The canonical TS SDK
lives in src/lib/; this package is for Python-first consumers (ML/AI
bench runners, data pipelines, training-orchestrators).

Current surface:
    emit_buildout_event(event, path=None)  — append a trace event to the pipeline
    validate_plan_via_cli(spec)            — dry-run a plan by shelling to node + CLI

Next phases add:
    list_registry()                        — query families/capabilities/partners
    compose_from_prompt(prompt, out_dir)   — full compose via HTTP service
"""

from .buildout import emit_buildout_event
from .validate_plan import validate_plan_via_cli

__version__ = "0.1.0"
__all__ = ["emit_buildout_event", "validate_plan_via_cli"]
