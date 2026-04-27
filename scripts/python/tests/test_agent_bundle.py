"""
Unit tests for the agent-bundle loader + AgentProfile translator +
harness-native workspace-file emitter (Python sibling).

1:1 port of `tests/agent-bundle.test.ts`. Same fixtures, same assertions —
the boundary contract is identical.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from starter_foundry.agent_bundle import (
    DEFAULT_WORKSPACE_ROOT,
    load_agent_bundle,
    resolve_system_prompt,
    resolve_workspace_root,
    to_agent_profile,
    to_workspace_files,
)


def test_load_agent_bundle_accepts_valid_single_agent(example_bundle: Path) -> None:
    bundle = load_agent_bundle(example_bundle)
    assert bundle.name == "research-assistant"
    assert bundle.version == "0.1.0"
    assert bundle.prompt["systemPromptFile"] == "AGENTS.md"
    assert bundle.tags == ["research", "single-agent"]


def test_load_agent_bundle_rejects_schema_invalid(invalid_bundle: Path) -> None:
    with pytest.raises(ValueError) as exc:
        load_agent_bundle(invalid_bundle)
    msg = str(exc.value)
    assert "failed schema validation" in msg
    assert "version" in msg and "required field missing" in msg
    assert "prompt" in msg


def test_load_agent_bundle_rejects_missing_manifest(fixtures_dir: Path) -> None:
    with pytest.raises(ValueError) as exc:
        load_agent_bundle(fixtures_dir / "no-such-bundle-dir")
    assert "agent.json not readable" in str(exc.value)


def test_resolve_system_prompt_returns_file_content(example_bundle: Path) -> None:
    bundle = load_agent_bundle(example_bundle)
    prompt = resolve_system_prompt(bundle, example_bundle)
    assert "# Research Assistant" in prompt
    assert "Refuse to invent data" in prompt


def test_resolve_workspace_root_defaults_to_home_agent(example_bundle: Path) -> None:
    bundle = load_agent_bundle(example_bundle)
    assert resolve_workspace_root(bundle) == DEFAULT_WORKSPACE_ROOT
    assert DEFAULT_WORKSPACE_ROOT == "/home/agent"


def test_to_agent_profile_inlines_system_prompt_and_resources(
    example_bundle: Path,
) -> None:
    bundle = load_agent_bundle(example_bundle)
    profile = to_agent_profile(bundle, example_bundle)

    assert profile["name"] == "research-assistant"
    assert profile["version"] == "0.1.0"
    assert profile["tags"] == ["research", "single-agent"]

    # System prompt inlined
    assert "systemPrompt" in profile["prompt"]
    assert "# Research Assistant" in profile["prompt"]["systemPrompt"]
    assert profile["prompt"]["instructions"] == [
        "Cite every source.",
        "Refuse to invent data.",
    ]

    # Model translated
    assert profile["model"]["default"] == "anthropic/claude-sonnet-4-7"
    assert profile["model"]["metadata"] == {"fallback": ["openai/gpt-4o-mini"]}

    # Tools + permissions copied
    assert profile["tools"] == {"bash": True, "edit": True, "webfetch": False}
    assert profile["permissions"] == {
        "bash": "ask",
        "edit": "allow",
        "webfetch": "deny",
    }

    # Resources expanded into 2 files at /home/agent/methodology/*
    files = profile["resources"]["files"]
    assert len(files) == 2
    paths = sorted(f["path"] for f in files)
    assert paths == [
        "/home/agent/methodology/literature-survey.md",
        "/home/agent/methodology/proposal-drafting.md",
    ]
    for mount in files:
        assert mount["resource"]["kind"] == "inline"
        assert len(mount["resource"]["content"]) > 0


def test_to_agent_profile_flattens_subagents(multi_bundle: Path) -> None:
    bundle = load_agent_bundle(multi_bundle)
    profile = to_agent_profile(bundle, multi_bundle)

    assert "subagents" in profile
    assert sorted(profile["subagents"].keys()) == ["lead", "researcher"]

    lead = profile["subagents"]["lead"]
    assert lead["description"] == "Routes work and reviews drafts"
    assert "# Lead" in lead["prompt"]
    assert lead["model"] == "anthropic/claude-sonnet-4-7"
    assert lead["tools"] == {"bash": True}
    assert lead["permissions"] == {"bash": "ask"}
    assert lead["maxSteps"] == 5

    researcher = profile["subagents"]["researcher"]
    assert "# Researcher" in researcher["prompt"]
    assert researcher["permissions"] == {"webfetch": "allow"}
    assert "maxSteps" not in researcher

    files = profile["resources"]["files"]
    assert len(files) == 2
    paths = sorted(f["path"] for f in files)
    assert paths == [
        "/home/agent/roles/lead/AGENTS.md",
        "/home/agent/roles/researcher/AGENTS.md",
    ]


def test_to_agent_profile_matches_sdk_backend_profile_shape(
    example_bundle: Path,
) -> None:
    """Boundary contract — what `client.create(backend=...)` would receive."""
    bundle = load_agent_bundle(example_bundle)
    profile = to_agent_profile(bundle, example_bundle)

    assert isinstance(profile["prompt"]["systemPrompt"], str)
    assert profile["prompt"]["systemPrompt"] != ""
    assert isinstance(profile["tools"], dict)
    assert isinstance(profile["permissions"], dict)
    assert isinstance(profile["resources"]["files"], list)

    for mount in profile["resources"]["files"]:
        assert isinstance(mount["path"], str)
        assert mount["path"].startswith("/")
        assert mount["resource"]["kind"] == "inline"


def test_to_workspace_files_single_agent_emits_one_agents_md(
    example_bundle: Path,
) -> None:
    bundle = load_agent_bundle(example_bundle)
    files = to_workspace_files(bundle, example_bundle)

    # AGENTS.md + 2 methodology files
    assert len(files) == 3

    agents_md = [f for f in files if f.targetPath == "/home/agent/AGENTS.md"]
    assert len(agents_md) == 1
    assert "# Research Assistant" in agents_md[0].content

    # Single-agent bundles do NOT emit agents.json
    assert all(f.targetPath != "/home/agent/agents.json" for f in files)

    paths = sorted(f.targetPath for f in files)
    assert paths == [
        "/home/agent/AGENTS.md",
        "/home/agent/methodology/literature-survey.md",
        "/home/agent/methodology/proposal-drafting.md",
    ]


def test_to_workspace_files_multi_emits_agents_md_and_agents_json(
    multi_bundle: Path,
) -> None:
    bundle = load_agent_bundle(multi_bundle)
    files = to_workspace_files(bundle, multi_bundle)

    # AGENTS.md + agents.json + 2 role files
    assert len(files) == 4

    paths = sorted(f.targetPath for f in files)
    assert paths == [
        "/home/agent/AGENTS.md",
        "/home/agent/agents.json",
        "/home/agent/roles/lead/AGENTS.md",
        "/home/agent/roles/researcher/AGENTS.md",
    ]

    orchestrator = next(f for f in files if f.targetPath == "/home/agent/AGENTS.md")
    assert "# Team root" in orchestrator.content


def test_emitted_agents_json_conforms_to_opencode_shape(multi_bundle: Path) -> None:
    """Verified against apps/sidecar/agents.json + load-agents-config.ts.

    Singular `permission` (not bundle-side plural `permissions`); inline
    prompt content (not a path).
    """
    bundle = load_agent_bundle(multi_bundle)
    files = to_workspace_files(bundle, multi_bundle)

    agents_json_file = next(
        (f for f in files if f.targetPath == "/home/agent/agents.json"), None
    )
    assert agents_json_file is not None

    parsed = json.loads(agents_json_file.content)
    assert sorted(parsed.keys()) == ["lead", "researcher"]

    lead = parsed["lead"]
    assert lead["mode"] == "subagent"
    assert lead["description"] == "Routes work and reviews drafts"
    assert isinstance(lead["prompt"], str)
    assert "# Lead" in lead["prompt"]
    assert lead["temperature"] == 0.2
    assert lead["tools"] == {"bash": True}
    # SINGULAR `permission`, not the bundle-side plural `permissions`.
    assert lead["permission"] == {"bash": "ask"}
    assert "permissions" not in lead

    researcher = parsed["researcher"]
    assert researcher["mode"] == "subagent"
    assert researcher["description"] == "Reads papers and writes summaries"
    assert "# Researcher" in researcher["prompt"]
    assert "temperature" not in researcher
    assert researcher["tools"] == {"webfetch": True}
    assert researcher["permission"] == {"webfetch": "allow"}


def test_to_workspace_files_resource_target_defaults_to_workspace_root_source(
    example_bundle: Path,
) -> None:
    """Single-agent fixture has `{ "source": "methodology" }` with no target."""
    bundle = load_agent_bundle(example_bundle)
    files = to_workspace_files(bundle, example_bundle)

    methodology = sorted(
        f.targetPath
        for f in files
        if f.targetPath.startswith("/home/agent/methodology/")
    )
    assert methodology == [
        "/home/agent/methodology/literature-survey.md",
        "/home/agent/methodology/proposal-drafting.md",
    ]


# ---------------------------------------------------------------------------
# Cross-language parity boundary
# ---------------------------------------------------------------------------


def test_python_agent_profile_matches_typescript_for_single_agent(
    example_bundle: Path,
) -> None:
    """Snapshot-style boundary: assert the AgentProfile shape this Python port
    builds is exactly the dict the TS port emits for the same fixture.

    If this fails, one of the two ports has drifted. The CI parity check
    (TS dry-run vs Python dry-run) is the broader version of this test.
    """
    bundle = load_agent_bundle(example_bundle)
    profile = to_agent_profile(bundle, example_bundle)
    expected_top_keys = {
        "name",
        "description",
        "version",
        "tags",
        "prompt",
        "model",
        "tools",
        "permissions",
        "resources",
    }
    assert set(profile.keys()) == expected_top_keys


def test_python_agent_profile_matches_typescript_for_multi_agent(
    multi_bundle: Path,
) -> None:
    bundle = load_agent_bundle(multi_bundle)
    profile = to_agent_profile(bundle, multi_bundle)
    # Multi-agent fixture has no model/tools/permissions/tags at the top level.
    expected_top_keys = {
        "name",
        "description",
        "version",
        "prompt",
        "subagents",
        "resources",
    }
    assert set(profile.keys()) == expected_top_keys
