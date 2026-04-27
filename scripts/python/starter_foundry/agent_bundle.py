"""
Agent bundle loader + Tangle Sandbox AgentProfile translator (Python port).

1:1 functional port of `src/lib/agent-bundle.ts`. A "bundle" is a directory
holding an `agent.json` plus referenced markdown system-prompt and methodology
files. The deploy script reads the bundle, validates against
`registry/_schemas/agent.schema.json`, then:

1. Translates the bundle-side shape into the SDK's portable `AgentProfile`
   (consumed as `backend.profile` by the sandbox runtime — used for the
   full-replacement system prompt, subagent profiles, model defaults, etc).
2. Emits harness-native workspace files at `<workspace.root>` (default
   `/home/agent`): `AGENTS.md` (auto-loaded by every supported harness —
   OpenCode, Claude Code, Hermes, Codex, Amp, Kimi-Code), and — for
   multi-agent bundles only — `agents.json` (OpenCode subagent definitions).
   Plus every entry from `resources.files[]`.

`AGENTS.md` and `agents.json` are auto-discovered by the in-sandbox harness
(see `apps/sidecar/src/agents/base-agent.ts:170` and
`apps/sidecar/src/agents/subagents/load-agents-config.ts`).

Sandbox target paths are POSIX even when the host is Windows, so we use
`posixpath` (not `os.path`) for every path that lives inside the sandbox.
"""

from __future__ import annotations

import json
import os
import posixpath
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

import jsonschema

# Permission policy for a runtime capability.
# Mirrors `AgentProfilePermissionValue` in `@tangle-network/sandbox`.
AgentPermission = Literal["allow", "ask", "deny"]

# Default sandbox workspace root. Matches the harness convention
# (`AGENT_WORKSPACE_ROOT=/home/agent` per `apps/sidecar/src/constants.ts`).
DEFAULT_WORKSPACE_ROOT = "/home/agent"


@dataclass(frozen=True)
class BundleResource:
    """A single resource file (or directory) to materialise inside the sandbox."""

    source: str
    target: str | None = None


@dataclass(frozen=True)
class SubagentBundle:
    """Bundle-side subagent declaration."""

    systemPromptFile: str
    description: str | None = None
    model: str | None = None
    tools: dict[str, bool] | None = None
    permissions: dict[str, AgentPermission] | None = None
    temperature: float | None = None
    maxSteps: int | None = None


@dataclass(frozen=True)
class AgentBundleProfile:
    """The complete bundle-side agent spec stored in `agent.json`."""

    name: str
    version: str
    prompt: dict[str, Any]
    description: str | None = None
    tags: list[str] | None = None
    workspace: dict[str, Any] | None = None
    model: dict[str, Any] | None = None
    tools: dict[str, bool] | None = None
    permissions: dict[str, AgentPermission] | None = None
    mcp: dict[str, Any] | None = None
    subagents: dict[str, SubagentBundle] | None = None
    resources: dict[str, Any] | None = None


@dataclass(frozen=True)
class WorkspaceFile:
    """One file the deploy script must `box.files.write` into the sandbox."""

    targetPath: str
    content: str


# ---------------------------------------------------------------------------
# Schema validation
# ---------------------------------------------------------------------------

_SCHEMA_CACHE: dict[str, Any] = {}


def _schema_path() -> Path:
    """Resolve the canonical `registry/_schemas/agent.schema.json`.

    The Python package lives at `scripts/python/starter_foundry/` so the repo
    root is three parents up. Honour `STARTER_FOUNDRY_REPO` for callers who
    install the package from a non-canonical location.
    """
    override = os.environ.get("STARTER_FOUNDRY_REPO")
    if override:
        candidate = Path(override) / "registry" / "_schemas" / "agent.schema.json"
        if candidate.is_file():
            return candidate
    here = Path(__file__).resolve().parent
    candidate = here.parent.parent.parent / "registry" / "_schemas" / "agent.schema.json"
    return candidate


def _load_schema() -> dict[str, Any]:
    if "schema" in _SCHEMA_CACHE:
        return _SCHEMA_CACHE["schema"]
    path = _schema_path()
    with path.open("r", encoding="utf-8") as fh:
        schema = json.load(fh)
    _SCHEMA_CACHE["schema"] = schema
    return schema


def _format_validation_error(err: jsonschema.ValidationError) -> str:
    """Mirror the TS validator's error shape:

    `agent.foo: required field missing`
    `agent.bar: 1 < minimum 2`
    `agent.tags[0]: expected string, got number`
    """
    path_parts = ["agent", *list(err.absolute_path)]
    if err.validator == "required":
        # message: "'foo' is a required property" → infer the missing field
        missing = err.message.split("'")[1] if "'" in err.message else err.message
        path = ".".join(str(p) for p in path_parts) + "." + missing
        return f"{path}: required field missing"
    path = path_parts[0]
    for part in path_parts[1:]:
        if isinstance(part, int):
            path = f"{path}[{part}]"
        else:
            path = f"{path}.{part}"
    return f"{path}: {err.message}"


# ---------------------------------------------------------------------------
# Loader
# ---------------------------------------------------------------------------


def _coerce_subagents(raw: Any) -> dict[str, SubagentBundle] | None:
    if not isinstance(raw, dict):
        return None
    out: dict[str, SubagentBundle] = {}
    for sid, sval in raw.items():
        out[sid] = SubagentBundle(
            systemPromptFile=sval["systemPromptFile"],
            description=sval.get("description"),
            model=sval.get("model"),
            tools=sval.get("tools"),
            permissions=sval.get("permissions"),
            temperature=sval.get("temperature"),
            maxSteps=sval.get("maxSteps"),
        )
    return out


def load_agent_bundle(bundle_dir: str | os.PathLike[str]) -> AgentBundleProfile:
    """Read `agent.json` from a bundle directory and validate it.

    Raises:
        FileNotFoundError-flavoured RuntimeError when agent.json is missing.
        ValueError when the JSON is unparseable.
        ValueError when schema validation fails (multi-line, like the TS port).
    """
    bundle_path = Path(bundle_dir)
    manifest_path = bundle_path / "agent.json"
    try:
        raw = manifest_path.read_text(encoding="utf-8")
    except OSError as err:
        raise ValueError(
            f"agent.json not readable at {manifest_path}: {err}"
        ) from err
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as err:
        raise ValueError(
            f"agent.json at {manifest_path} is not valid JSON: {err}"
        ) from err

    schema = _load_schema()
    validator = jsonschema.Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(parsed), key=lambda e: list(e.absolute_path))
    if errors:
        formatted = "\n  ".join(_format_validation_error(e) for e in errors)
        raise ValueError(
            f"agent.json at {manifest_path} failed schema validation:\n  {formatted}"
        )

    return AgentBundleProfile(
        name=parsed["name"],
        version=parsed["version"],
        prompt=parsed["prompt"],
        description=parsed.get("description"),
        tags=parsed.get("tags"),
        workspace=parsed.get("workspace"),
        model=parsed.get("model"),
        tools=parsed.get("tools"),
        permissions=parsed.get("permissions"),
        mcp=parsed.get("mcp"),
        subagents=_coerce_subagents(parsed.get("subagents")),
        resources=parsed.get("resources"),
    )


def resolve_system_prompt(bundle: AgentBundleProfile, bundle_dir: str | os.PathLike[str]) -> str:
    """Read the system prompt content referenced by the bundle.

    Returns the empty string when the bundle declares no `systemPromptFile`.
    """
    file = bundle.prompt.get("systemPromptFile")
    if not file:
        return ""
    p = Path(file)
    if not p.is_absolute():
        p = Path(bundle_dir) / file
    return p.read_text(encoding="utf-8")


def resolve_workspace_root(bundle: AgentBundleProfile) -> str:
    """Resolve the workspace root, falling back to /home/agent."""
    if bundle.workspace and bundle.workspace.get("root"):
        return bundle.workspace["root"]
    return DEFAULT_WORKSPACE_ROOT


# ---------------------------------------------------------------------------
# Resource resolution
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class _ResolvedFileMount:
    path: str
    source: str
    content: str


def _resolve_resource(
    resource: BundleResource | dict[str, Any],
    bundle_dir: str | os.PathLike[str],
    workspace_root: str,
) -> list[_ResolvedFileMount]:
    """Walk a `BundleResource` (file or directory) and produce inline mounts."""
    if isinstance(resource, dict):
        source = resource["source"]
        target = resource.get("target")
    else:
        source = resource.source
        target = resource.target

    bundle_path = Path(bundle_dir)
    source_path = Path(source) if Path(source).is_absolute() else bundle_path / source

    if target is None:
        target_root = posixpath.join(workspace_root, source)
    elif posixpath.isabs(target) or target.startswith("/"):
        target_root = target
    else:
        target_root = posixpath.join(workspace_root, target)

    if source_path.is_file():
        content = source_path.read_text(encoding="utf-8")
        return [
            _ResolvedFileMount(
                path=target_root,
                source=str(source_path),
                content=content,
            )
        ]
    if source_path.is_dir():
        out: list[_ResolvedFileMount] = []
        for entry in sorted(source_path.rglob("*")):
            if not entry.is_file():
                continue
            rel = entry.relative_to(source_path).as_posix()
            content = entry.read_text(encoding="utf-8")
            out.append(
                _ResolvedFileMount(
                    path=posixpath.join(target_root, rel),
                    source=str(entry),
                    content=content,
                )
            )
        return out
    raise ValueError(f"resource source {source_path} is neither file nor directory")


# ---------------------------------------------------------------------------
# Translator: bundle -> AgentProfile (the SDK's `backend.profile`)
# ---------------------------------------------------------------------------


def to_agent_profile(
    bundle: AgentBundleProfile,
    bundle_dir: str | os.PathLike[str],
) -> dict[str, Any]:
    """Translate an `AgentBundleProfile` into the SDK's portable AgentProfile.

    Inlines:
    - `prompt.systemPromptFile` content into `prompt.systemPrompt`
    - subagent `systemPromptFile` content into each `subagents[id].prompt`
    - every `resources.files[]` entry as an inline file mount under the
      resolved sandbox target path
    """
    workspace_root = resolve_workspace_root(bundle)
    system_prompt = resolve_system_prompt(bundle, bundle_dir)

    resolved_subagents: dict[str, dict[str, Any]] = {}
    if bundle.subagents:
        for sid, sub in bundle.subagents.items():
            prompt_path = Path(sub.systemPromptFile)
            if not prompt_path.is_absolute():
                prompt_path = Path(bundle_dir) / sub.systemPromptFile
            sub_prompt = prompt_path.read_text(encoding="utf-8")
            entry: dict[str, Any] = {}
            if sub.description is not None:
                entry["description"] = sub.description
            entry["prompt"] = sub_prompt
            if sub.model is not None:
                entry["model"] = sub.model
            if sub.tools:
                entry["tools"] = sub.tools
            if sub.permissions:
                entry["permissions"] = sub.permissions
            if sub.maxSteps is not None:
                entry["maxSteps"] = sub.maxSteps
            resolved_subagents[sid] = entry

    file_mounts: list[dict[str, Any]] = []
    bundle_path = Path(bundle_dir)
    for raw in (bundle.resources or {}).get("files", []) or []:
        resolved = _resolve_resource(raw, bundle_dir, workspace_root)
        for mount in resolved:
            try:
                rel = os.path.relpath(mount.source, bundle_path)
            except ValueError:
                rel = ""
            name = rel if rel else mount.path
            # Match the TS Node `path.relative` behaviour: forward slashes.
            name = name.replace(os.sep, "/")
            file_mounts.append(
                {
                    "path": mount.path,
                    "resource": {
                        "kind": "inline",
                        "name": name,
                        "content": mount.content,
                    },
                }
            )

    profile: dict[str, Any] = {"name": bundle.name}
    if bundle.description is not None:
        profile["description"] = bundle.description
    profile["version"] = bundle.version
    if bundle.tags:
        profile["tags"] = bundle.tags
    instructions = bundle.prompt.get("instructions")
    if system_prompt or instructions:
        prompt_obj: dict[str, Any] = {}
        if system_prompt:
            prompt_obj["systemPrompt"] = system_prompt
        if instructions:
            prompt_obj["instructions"] = instructions
        profile["prompt"] = prompt_obj
    if bundle.model and (bundle.model.get("preferred") or bundle.model.get("fallback")):
        model_obj: dict[str, Any] = {}
        if bundle.model.get("preferred"):
            model_obj["default"] = bundle.model["preferred"]
        if bundle.model.get("fallback"):
            model_obj["metadata"] = {"fallback": bundle.model["fallback"]}
        profile["model"] = model_obj
    if bundle.tools:
        profile["tools"] = bundle.tools
    if bundle.permissions:
        profile["permissions"] = bundle.permissions
    if bundle.mcp:
        profile["mcp"] = bundle.mcp
    if resolved_subagents:
        profile["subagents"] = resolved_subagents
    if file_mounts:
        profile["resources"] = {"files": file_mounts}

    return profile


# ---------------------------------------------------------------------------
# Workspace-file emit (harness-native AGENTS.md + agents.json + resources)
# ---------------------------------------------------------------------------


def _build_opencode_agents_json(
    bundle: AgentBundleProfile,
    bundle_dir: str | os.PathLike[str],
) -> str:
    """Build the OpenCode-shape `agents.json` content for a multi-agent bundle.

    Per `apps/sidecar/agents.json` + `load-agents-config.ts`:
        { <id>: { mode, description?, prompt, temperature?, tools?, permission? } }

    `permission` is SINGULAR (harness contract); the bundle-side spec uses
    plural `permissions` and we translate at the boundary.
    """
    out: dict[str, dict[str, Any]] = {}
    for sid, sub in (bundle.subagents or {}).items():
        prompt_path = Path(sub.systemPromptFile)
        if not prompt_path.is_absolute():
            prompt_path = Path(bundle_dir) / sub.systemPromptFile
        prompt_content = prompt_path.read_text(encoding="utf-8")
        entry: dict[str, Any] = {"mode": "subagent"}
        if sub.description is not None:
            entry["description"] = sub.description
        entry["prompt"] = prompt_content
        if sub.temperature is not None:
            entry["temperature"] = sub.temperature
        if sub.tools:
            entry["tools"] = sub.tools
        if sub.permissions:
            entry["permission"] = sub.permissions
        out[sid] = entry
    # ensure_ascii=False so non-ASCII content (em dashes, unicode arrows) lands
    # in agents.json verbatim — matches the TS port's JSON.stringify output.
    return json.dumps(out, indent=2, ensure_ascii=False) + "\n"


def to_workspace_files(
    bundle: AgentBundleProfile,
    bundle_dir: str | os.PathLike[str],
) -> list[WorkspaceFile]:
    """Compute the list of files the deploy script must `box.files.write`.

    - `<workspace.root>/AGENTS.md`   — orchestrator system prompt (always, when the
                                       bundle declares a `prompt.systemPromptFile`)
    - `<workspace.root>/agents.json` — multi-agent bundles only; OpenCode subagents
    - One file per `resources.files[]` entry, target defaulting to
      `<workspace.root>/<source>` when not specified.
    """
    workspace_root = resolve_workspace_root(bundle)
    out: list[WorkspaceFile] = []

    # 1. AGENTS.md — orchestrator system prompt at the workspace root
    system_prompt_content = resolve_system_prompt(bundle, bundle_dir)
    if system_prompt_content:
        out.append(
            WorkspaceFile(
                targetPath=posixpath.join(workspace_root, "AGENTS.md"),
                content=system_prompt_content,
            )
        )

    # 2. agents.json — multi-agent bundles only
    if bundle.subagents and len(bundle.subagents) > 0:
        agents_json = _build_opencode_agents_json(bundle, bundle_dir)
        out.append(
            WorkspaceFile(
                targetPath=posixpath.join(workspace_root, "agents.json"),
                content=agents_json,
            )
        )

    # 3. resources.files[]
    for raw in (bundle.resources or {}).get("files", []) or []:
        resolved = _resolve_resource(raw, bundle_dir, workspace_root)
        for mount in resolved:
            out.append(WorkspaceFile(targetPath=mount.path, content=mount.content))

    return out


# Silence unused-warning on the `field` import: kept available for future
# dataclass extensions without re-importing.
_ = field
