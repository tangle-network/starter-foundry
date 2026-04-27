"""
Deploy an agent bundle to a Tangle sandbox (Python sibling).

1:1 port of `scripts/deploy-agent-bundle.ts`. Reads `agent.json` + referenced
markdown from a bundle directory, then:

1. Builds the SDK's portable `AgentProfile` (single-agent system prompt,
   subagent profiles, model defaults, tools, permissions). This is passed
   as `backend.profile` to `Sandbox.create()` — full-replacement system
   prompt at the SDK layer.
2. Computes harness-native workspace files for `<workspace.root>` (default
   `/home/agent`):
     - `AGENTS.md`   — auto-loaded by every supported harness
     - `agents.json` — multi-agent bundles only; OpenCode subagent shape
     - resource files (methodology/, README.md, role assets, …)
3. Creates the sandbox and `box.files.write`s every workspace file.

Usage:
    python -m starter_foundry.deploy \
        --bundle <path> \
        --name <sandbox-name> \
        --api-key-env TANGLE_SANDBOX_API_KEY \
        --base-url https://sandbox.tangle.tools \
        [--task "..."] \
        [--image node:20] \
        [--dry-run]

`tangle_sandbox` is imported lazily so `--dry-run` works without the SDK
installed; we surface a clean GAP if it isn't available when a real deploy
is requested.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

from .agent_bundle import (
    AgentBundleProfile,
    WorkspaceFile,
    load_agent_bundle,
    resolve_workspace_root,
    to_agent_profile,
    to_workspace_files,
)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="deploy-agent-bundle",
        description=(
            "Push an agent bundle to a Tangle sandbox.\n\n"
            "Validates agent.json against registry/_schemas/agent.schema.json, "
            "builds the SDK AgentProfile, computes harness-native workspace "
            "files, creates the sandbox, and box.files.write's each file at "
            "the resolved workspace root (default /home/agent)."
        ),
    )
    parser.add_argument(
        "--bundle",
        required=True,
        help="bundle directory containing agent.json",
    )
    parser.add_argument(
        "--name",
        required=True,
        help="sandbox name to create",
    )
    parser.add_argument(
        "--api-key-env",
        default="TANGLE_SANDBOX_API_KEY",
        help="env var that holds the API key (default TANGLE_SANDBOX_API_KEY)",
    )
    parser.add_argument(
        "--base-url",
        default=None,
        help="sandbox API base url (or set TANGLE_SANDBOX_BASE_URL / SANDBOX_BASE_URL)",
    )
    parser.add_argument(
        "--task",
        default=None,
        help="optional initial agent task to run after deploy",
    )
    parser.add_argument(
        "--image",
        default="node:20",
        help="base image (default node:20)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="build the AgentProfile + list workspace files; do not call the SDK",
    )
    return parser


def _resolve_base_url(args: argparse.Namespace) -> str:
    if args.base_url:
        return args.base_url
    from_env = os.environ.get("TANGLE_SANDBOX_BASE_URL") or os.environ.get(
        "SANDBOX_BASE_URL"
    )
    if not from_env:
        raise ValueError(
            "--base-url required (or set TANGLE_SANDBOX_BASE_URL)"
        )
    return from_env


def _load_sdk(api_key: str, base_url: str) -> Any:
    """Lazy-import `tangle_sandbox`; surface a clean GAP if missing."""
    try:
        from tangle_sandbox import Sandbox
    except ImportError as err:
        raise RuntimeError(
            "GAP: tangle_sandbox is not installed in this environment.\n"
            "Install it (`pip install tangle-sandbox`) or run with --dry-run.\n"
            f"Underlying error: {err}"
        ) from err
    return Sandbox(api_key=api_key, base_url=base_url)


def _print_dry_run(
    profile: dict[str, Any],
    workspace_files: list[WorkspaceFile],
) -> None:
    sys.stdout.write("[deploy-agent] --dry-run: AgentProfile follows\n")
    # ensure_ascii=False so the output matches the TS port's JSON.stringify
    # byte-for-byte (TS leaves non-ASCII codepoints unescaped by default).
    sys.stdout.write(json.dumps(profile, indent=2, ensure_ascii=False) + "\n")
    sys.stdout.write(
        "[deploy-agent] --dry-run: workspace files that would be written:\n"
    )
    for f in workspace_files:
        sys.stdout.write(f"  {f.targetPath}  ({len(f.content)} bytes)\n")


def _summarise(
    profile: dict[str, Any],
    workspace_root: str,
    workspace_files: list[WorkspaceFile],
) -> str:
    system_prompt = (profile.get("prompt") or {}).get("systemPrompt")
    sp_summary = f"{len(system_prompt)} chars" if system_prompt else "none"
    subagent_count = len(profile.get("subagents") or {})
    return (
        f"[deploy-agent] profile built: "
        f"name={profile.get('name')} "
        f"workspace={workspace_root} "
        f"systemPrompt={sp_summary} "
        f"subagents={subagent_count} "
        f"workspace-files={len(workspace_files)}\n"
    )


def _write_workspace_files(box: Any, files: list[WorkspaceFile]) -> None:
    for f in files:
        box.files.write(f.targetPath, f.content)
        sys.stdout.write(
            f"[deploy-agent] wrote {f.targetPath} ({len(f.content)} bytes)\n"
        )


def run(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    bundle_dir = Path(args.bundle).resolve()
    sys.stdout.write(f"[deploy-agent] loading bundle: {bundle_dir}\n")
    bundle: AgentBundleProfile = load_agent_bundle(bundle_dir)
    workspace_root = resolve_workspace_root(bundle)
    profile = to_agent_profile(bundle, bundle_dir)
    workspace_files = to_workspace_files(bundle, bundle_dir)
    sys.stdout.write(_summarise(profile, workspace_root, workspace_files))

    if args.dry_run:
        _print_dry_run(profile, workspace_files)
        return 0

    api_key = os.environ.get(args.api_key_env)
    if not api_key:
        raise RuntimeError(
            f"GAP: env var {args.api_key_env} is unset; cannot reach Tangle sandbox API"
        )
    base_url = _resolve_base_url(args)
    client = _load_sdk(api_key, base_url)

    sys.stdout.write(
        f"[deploy-agent] creating sandbox name={args.name} image={args.image}\n"
    )
    # Lazy import keeps --dry-run usable without the SDK.
    from tangle_sandbox import BackendConfig, CreateSandboxOptions

    box = client.create(
        CreateSandboxOptions(
            name=args.name,
            image=args.image,
            backend=BackendConfig(profile=profile),
        )
    )
    sys.stdout.write(f"[deploy-agent] sandbox created: id={box.id}\n")

    # The sync SDK's `wait_for` lives on the instance when present.
    wait_for = getattr(box, "wait_for", None)
    if callable(wait_for):
        wait_for("running")

    _write_workspace_files(box, workspace_files)

    if args.task:
        sys.stdout.write(f"[deploy-agent] running task: {args.task}\n")
        result = box.task(args.task)
        if not getattr(result, "success", False):
            err = getattr(result, "error", None) or "unknown error"
            raise RuntimeError(f"task failed: {err}")
        response = getattr(result, "response", None) or ""
        sys.stdout.write(f"[deploy-agent] task response:\n{response}\n")
        usage = getattr(result, "usage", None)
        if usage is not None:
            sys.stdout.write(
                f"[deploy-agent] usage: input={usage.input_tokens} "
                f"output={usage.output_tokens} "
                f"duration_ms={getattr(result, 'duration_ms', 0)}\n"
            )

    sys.stdout.write(
        "\n[deploy-agent] done. Re-enter this sandbox with:\n"
        f"  box = client.get('{box.id}')\n"
        "  box.task('your prompt here')\n"
    )
    return 0


def main() -> None:
    try:
        sys.exit(run())
    except Exception as exc:  # noqa: BLE001 — top-level CLI entrypoint
        sys.stderr.write(f"[deploy-agent] ERROR: {exc}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
