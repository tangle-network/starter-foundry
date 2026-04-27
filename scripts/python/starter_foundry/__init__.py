"""
starter-foundry — Python sibling of the TS agent-bundle tooling.

Public surface:
    load_agent_bundle      — read + schema-validate agent.json
    resolve_system_prompt  — read the orchestrator prompt file
    resolve_workspace_root — workspace.root with /home/agent default
    to_agent_profile       — bundle -> SDK AgentProfile (backend.profile)
    to_workspace_files     — bundle -> [{targetPath, content}, ...] for box.files.write
    DEFAULT_WORKSPACE_ROOT — "/home/agent"
"""

from .agent_bundle import (
    DEFAULT_WORKSPACE_ROOT,
    AgentBundleProfile,
    BundleResource,
    SubagentBundle,
    WorkspaceFile,
    load_agent_bundle,
    resolve_system_prompt,
    resolve_workspace_root,
    to_agent_profile,
    to_workspace_files,
)

__all__ = [
    "DEFAULT_WORKSPACE_ROOT",
    "AgentBundleProfile",
    "BundleResource",
    "SubagentBundle",
    "WorkspaceFile",
    "load_agent_bundle",
    "resolve_system_prompt",
    "resolve_workspace_root",
    "to_agent_profile",
    "to_workspace_files",
]

__version__ = "0.1.0"
