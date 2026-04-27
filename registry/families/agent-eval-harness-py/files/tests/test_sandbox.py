"""SandboxDriver lifecycle tests.

The real ``tangle_sandbox`` SDK requires a live API key; we mock the SDK
to keep these tests offline. The mock asserts the lifecycle contract
(create → wait_for → files.write → task → delete) without making network
calls. A live integration test belongs in CI with a real key — those
should set ``EVAL_LIVE_SANDBOX=1`` and dispatch the runner directly.

What this protects against:

- Driver mutating its private state in a way that lets ``run()`` succeed
  before ``open()`` (regression: silent NoneType during the run).
- ``close()`` raising on a teardown error and corrupting the run summary
  (regression: a flaky delete blew away the scorecard).
- Bundle resolver requiring ``tangle_sandbox`` even in dry contexts (the
  package should be importable without the SDK installed).
"""

from __future__ import annotations

import sys
import types
from pathlib import Path
from typing import Any
from unittest import mock

import pytest


# ---------------------------------------------------------------------------
# Helpers — install fake `tangle_sandbox` + fake `starter_foundry.agent_bundle`
# into ``sys.modules`` for the duration of a test.
# ---------------------------------------------------------------------------


class _FakeTaskResult:
    def __init__(self, success: bool, response: str | None = None, error: str | None = None) -> None:
        self.success = success
        self.response = response
        self.error = error


class _FakeFiles:
    def __init__(self) -> None:
        self.writes: list[tuple[str, str]] = []

    def write(self, path: str, content: str) -> None:
        self.writes.append((path, content))


class _FakeBox:
    def __init__(self, task_response: str = "ok") -> None:
        self.id = "sbx_fake_001"
        self.files = _FakeFiles()
        self.task_response = task_response
        self.deleted = False
        self.wait_for_calls: list[str] = []

    def wait_for(self, status: str) -> None:
        self.wait_for_calls.append(status)

    def task(self, prompt: str) -> _FakeTaskResult:
        return _FakeTaskResult(True, response=self.task_response)

    def delete(self) -> None:
        self.deleted = True


class _FakeClient:
    def __init__(self, *, api_key: str, base_url: str) -> None:
        self.api_key = api_key
        self.base_url = base_url
        self.created_with: Any = None
        self.boxes: list[_FakeBox] = []

    def create(self, options: Any) -> _FakeBox:
        self.created_with = options
        box = _FakeBox()
        self.boxes.append(box)
        return box


def _install_fake_sdk(monkeypatch: pytest.MonkeyPatch) -> _FakeClient | None:
    """Inject fake ``tangle_sandbox`` module. Returns the holder for assertions."""
    holder: dict[str, _FakeClient] = {}

    def _make_client(*, api_key: str, base_url: str) -> _FakeClient:
        c = _FakeClient(api_key=api_key, base_url=base_url)
        holder["client"] = c
        return c

    fake_mod = types.ModuleType("tangle_sandbox")
    fake_mod.Sandbox = _make_client  # type: ignore[attr-defined]

    class _BackendConfig:
        def __init__(self, *, profile: dict[str, Any] | None = None) -> None:
            self.profile = profile

    class _CreateSandboxOptions:
        def __init__(
            self,
            *,
            name: str | None = None,
            image: str | None = None,
            backend: Any = None,
        ) -> None:
            self.name = name
            self.image = image
            self.backend = backend

    fake_mod.BackendConfig = _BackendConfig  # type: ignore[attr-defined]
    fake_mod.CreateSandboxOptions = _CreateSandboxOptions  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "tangle_sandbox", fake_mod)

    # Lazy accessor so callers can grab the client after open() runs.
    return holder  # type: ignore[return-value]


def _install_fake_bundle_loader(monkeypatch: pytest.MonkeyPatch) -> None:
    """Inject a fake ``starter_foundry.agent_bundle`` into sys.modules."""

    sf_mod = types.ModuleType("starter_foundry")
    bundle_mod = types.ModuleType("starter_foundry.agent_bundle")

    def _load(_path: Path | str) -> dict[str, Any]:
        return {"name": "fake", "version": "0.0.1"}

    def _to_profile(_bundle: Any, _bundle_dir: Path | str) -> dict[str, Any]:
        return {"name": "fake", "version": "0.0.1"}

    class _WSFile:
        def __init__(self, target: str, content: str) -> None:
            self.targetPath = target
            self.content = content

    def _to_workspace_files(_bundle: Any, _bundle_dir: Path | str) -> list[_WSFile]:
        return [_WSFile("/home/agent/AGENTS.md", "# fake bundle\n")]

    def _resolve_workspace_root(_bundle: Any) -> str:
        return "/home/agent"

    bundle_mod.load_agent_bundle = _load  # type: ignore[attr-defined]
    bundle_mod.to_agent_profile = _to_profile  # type: ignore[attr-defined]
    bundle_mod.to_workspace_files = _to_workspace_files  # type: ignore[attr-defined]
    bundle_mod.resolve_workspace_root = _resolve_workspace_root  # type: ignore[attr-defined]
    sf_mod.agent_bundle = bundle_mod  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "starter_foundry", sf_mod)
    monkeypatch.setitem(sys.modules, "starter_foundry.agent_bundle", bundle_mod)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_sandbox_module_imports_without_tangle_sandbox_installed() -> None:
    """The harness should be importable even when the SDK isn't on the path."""
    # We don't try to uninstall — instead, just confirm the import is lazy
    # (no top-level `import tangle_sandbox`).
    import importlib

    mod = importlib.import_module("eval.sandbox_runner")
    assert hasattr(mod, "SandboxDriver")
    # The module must not have eagerly bound a Sandbox symbol at import time.
    assert "Sandbox" not in dir(mod), "tangle_sandbox import must be lazy"


def test_sandbox_driver_full_lifecycle(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    holder = _install_fake_sdk(monkeypatch)
    _install_fake_bundle_loader(monkeypatch)
    monkeypatch.setenv("TANGLE_SANDBOX_API_KEY", "sk-test")
    monkeypatch.setenv("TANGLE_SANDBOX_BASE_URL", "https://test.example.com")

    from eval.sandbox_runner import SandboxDriver

    bundle_dir = tmp_path / "bundle"
    bundle_dir.mkdir()
    (bundle_dir / "agent.json").write_text("{}", encoding="utf-8")  # not actually parsed by fake

    with SandboxDriver(bundle_dir=bundle_dir, name="t-eval", image="node:20") as drv:
        out = drv.run({"input": "ping"})
        assert out == "ok"

    client = holder["client"]
    assert client.api_key == "sk-test"
    assert client.base_url == "https://test.example.com"
    assert client.created_with.name == "t-eval"
    assert client.created_with.image == "node:20"
    box = client.boxes[0]
    assert box.wait_for_calls == ["running"]
    assert box.files.writes == [("/home/agent/AGENTS.md", "# fake bundle\n")]
    assert box.deleted is True


def test_sandbox_driver_raises_when_api_key_missing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _install_fake_sdk(monkeypatch)
    _install_fake_bundle_loader(monkeypatch)
    monkeypatch.delenv("TANGLE_SANDBOX_API_KEY", raising=False)
    monkeypatch.setenv("TANGLE_SANDBOX_BASE_URL", "https://test.example.com")

    from eval.sandbox_runner import SandboxDriver

    bundle_dir = tmp_path / "b"
    bundle_dir.mkdir()
    (bundle_dir / "agent.json").write_text("{}", encoding="utf-8")
    with pytest.raises(RuntimeError, match="TANGLE_SANDBOX_API_KEY is unset"):
        SandboxDriver(bundle_dir=bundle_dir).open()


def test_sandbox_driver_run_before_open_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    from eval.sandbox_runner import SandboxDriver

    drv = SandboxDriver(profile={"name": "x", "version": "0"})
    with pytest.raises(RuntimeError, match="before open"):
        drv.run({"input": "x"})


def test_sandbox_driver_close_swallows_teardown_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Teardown failures must never propagate — they'd shadow the real run failure."""
    from eval.sandbox_runner import SandboxDriver

    drv = SandboxDriver(profile={"name": "x", "version": "0"})
    bad_box = mock.MagicMock()
    bad_box.delete.side_effect = RuntimeError("delete boom")
    drv._box = bad_box  # private; intentional test seam
    drv._client = mock.MagicMock()
    # Should not raise
    drv.close()
    assert drv._box is None
    assert drv._client is None


def test_sandbox_driver_task_failure_raises_runtime(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    holder = _install_fake_sdk(monkeypatch)
    _install_fake_bundle_loader(monkeypatch)
    monkeypatch.setenv("TANGLE_SANDBOX_API_KEY", "sk-test")
    monkeypatch.setenv("TANGLE_SANDBOX_BASE_URL", "https://test.example.com")

    from eval.sandbox_runner import SandboxDriver

    bundle_dir = tmp_path / "bundle"
    bundle_dir.mkdir()
    (bundle_dir / "agent.json").write_text("{}", encoding="utf-8")
    with SandboxDriver(bundle_dir=bundle_dir) as drv:
        # patch the box's task method to fail
        client = holder["client"]
        box = client.boxes[0]
        box.task = lambda prompt: _FakeTaskResult(False, error="task explosion")  # type: ignore[assignment]
        with pytest.raises(RuntimeError, match="sandbox task failed"):
            drv.run({"input": "x"})
