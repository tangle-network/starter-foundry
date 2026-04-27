"""Sandbox-driven scenario runner.

Spins a Tangle Sandbox (``tangle_sandbox.Sandbox``), deploys an agent
bundle, runs scenarios via ``box.task()``, then deletes the sandbox.
Designed to be passed to :func:`eval.runner.run_scenarios` as the
``sandbox_runner`` arg.

Lifecycle:

1. ``__enter__`` / ``__init__`` — read API key + base URL from env, lazy-import
   ``tangle_sandbox`` (so dry-runs work without the SDK installed), build
   ``CreateSandboxOptions``, call ``client.create()``, wait for ``running``.
2. ``run(spec)`` — call ``box.task(spec["input"])``; return the response
   string. Raises ``RuntimeError`` on task failure (the runner converts to
   a flow-level error, not a process exit).
3. ``__exit__`` / ``close`` — best-effort ``box.delete()``. Always swallow
   errors at teardown so a flaky teardown doesn't blow away the scorecard.

The bundle layout follows the existing ``scripts/python/starter_foundry``
loader (``load_agent_bundle`` → ``to_agent_profile`` → ``box.files.write``).
We intentionally do not duplicate that loader here; instead we either reuse
``starter_foundry.agent_bundle`` if available, or accept a pre-built profile
dict. This keeps the eval harness aligned with the deploy script.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

DEFAULT_BASE_URL_ENVS = ("TANGLE_SANDBOX_BASE_URL", "SANDBOX_BASE_URL")


def _resolve_sandbox_base_url(explicit: str | None) -> str:
    if explicit:
        return explicit
    for env in DEFAULT_BASE_URL_ENVS:
        v = os.environ.get(env)
        if v:
            return v
    raise RuntimeError(
        "GAP: sandbox base URL not set (pass explicitly or set "
        f"{' / '.join(DEFAULT_BASE_URL_ENVS)})"
    )


@dataclass
class SandboxDriver:
    """Manages the lifetime of one sandbox across an eval run.

    Use as a context manager::

        with SandboxDriver(bundle_dir=Path("./bundle")) as drv:
            scorecard = run_scenarios(cfg, sandbox_runner=drv)
    """

    bundle_dir: Path | None = None
    profile: dict[str, Any] | None = None
    image: str = "node:20"
    name: str = "eval-harness"
    api_key_env: str = "TANGLE_SANDBOX_API_KEY"
    base_url: str | None = None
    workspace_root: str = "/home/agent"
    workspace_files: list[Any] = field(default_factory=list)

    _client: Any | None = field(default=None, init=False, repr=False)
    _box: Any | None = field(default=None, init=False, repr=False)

    # ------------------------------------------------------------------
    # Bundle resolution
    # ------------------------------------------------------------------

    def _resolve_profile(self) -> tuple[dict[str, Any], list[Any], str]:
        """Return ``(profile, workspace_files, workspace_root)`` for create+write."""
        if self.profile is not None:
            return self.profile, list(self.workspace_files), self.workspace_root
        if self.bundle_dir is None:
            raise ValueError(
                "SandboxDriver: provide either bundle_dir or profile"
            )
        # Lazy-import the existing Python bundle loader to keep this module
        # importable in environments where starter_foundry isn't installed.
        try:
            from starter_foundry.agent_bundle import (  # type: ignore[import-not-found]
                load_agent_bundle,
                resolve_workspace_root,
                to_agent_profile,
                to_workspace_files,
            )
        except ImportError as err:
            raise RuntimeError(
                "GAP: starter_foundry.agent_bundle not importable; "
                "either install it or pass an explicit profile= dict."
            ) from err

        bundle = load_agent_bundle(self.bundle_dir)
        return (
            to_agent_profile(bundle, self.bundle_dir),
            to_workspace_files(bundle, self.bundle_dir),
            resolve_workspace_root(bundle),
        )

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def open(self) -> None:
        """Create the sandbox and write the bundle's workspace files."""
        try:
            from tangle_sandbox import (  # type: ignore[import-not-found]
                BackendConfig,
                CreateSandboxOptions,
                Sandbox,
            )
        except ImportError as err:
            raise RuntimeError(
                "GAP: tangle_sandbox is not installed; "
                "`pip install tangle-sandbox` or use --driver local/http."
            ) from err

        api_key = os.environ.get(self.api_key_env)
        if not api_key:
            raise RuntimeError(
                f"GAP: env var {self.api_key_env} is unset; cannot reach Tangle sandbox API"
            )
        base_url = _resolve_sandbox_base_url(self.base_url)

        profile, workspace_files, workspace_root = self._resolve_profile()
        self.workspace_root = workspace_root

        self._client = Sandbox(api_key=api_key, base_url=base_url)
        self._box = self._client.create(
            CreateSandboxOptions(
                name=self.name,
                image=self.image,
                backend=BackendConfig(profile=profile),
            )
        )

        wait_for = getattr(self._box, "wait_for", None)
        if callable(wait_for):
            wait_for("running")

        for f in workspace_files:
            # Workspace-file objects from agent_bundle have ``targetPath`` + ``content``;
            # be liberal in what we accept (a dict with the same keys, too).
            target = getattr(f, "targetPath", None) or (
                f.get("targetPath") if isinstance(f, dict) else None
            )
            content = getattr(f, "content", None) or (
                f.get("content") if isinstance(f, dict) else None
            )
            if not target or content is None:
                continue
            self._box.files.write(target, content)

    def close(self) -> None:
        """Best-effort sandbox delete; swallow errors so teardown never crashes."""
        if self._box is None:
            return
        try:
            self._box.delete()
        except Exception:  # noqa: BLE001 — teardown
            pass
        self._box = None
        self._client = None

    def __enter__(self) -> "SandboxDriver":
        self.open()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()

    # ------------------------------------------------------------------
    # Runner adapter
    # ------------------------------------------------------------------

    def run(self, spec: dict[str, Any]) -> str:
        """Execute one scenario inside the sandbox; return the agent's response."""
        if self._box is None:
            raise RuntimeError("SandboxDriver.run called before open()")
        result = self._box.task(spec["input"])
        if not getattr(result, "success", False):
            err = getattr(result, "error", None) or "unknown error"
            raise RuntimeError(f"sandbox task failed: {err}")
        response = getattr(result, "response", None)
        if not isinstance(response, str):
            raise RuntimeError(
                f"sandbox task returned non-str response: {type(response).__name__}"
            )
        return response
