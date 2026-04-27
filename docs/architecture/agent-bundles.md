# Agent bundles — the runtime is the sandbox

|              |                                                                                                                                                                                                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**   | canonical (v0.11.0); supersedes the agent-platform/orchestrator runtime stories from v0.10.x                                                                                                                                                                                     |
| **Audience** | bundle authors, integrators, anyone trying to actually run a starter-foundry agent                                                                                                                                                                                               |
| **Related**  | [`docs/cookbooks/deploy-agent-runtime-research.md`](../cookbooks/deploy-agent-runtime-research.md) · [`docs/cookbooks/deploy-multi-agent-startup-team.md`](../cookbooks/deploy-multi-agent-startup-team.md) · [`docs/specs/agent-base-secure.md`](../specs/agent-base-secure.md) |

## What is an agent bundle?

An **agent bundle** is a folder of files this repo composes from a family + layers:

- `system-prompt.md` (or `roles/<id>/system-prompt.md` for multi-agent)
- `methodology/*.md` — capability playbooks the agent reads at runtime
- `agent.json` — a thin [`AgentProfile`][agent-profile] declaration
- supporting content: `TOOLS.md`, `README.md`, `coordination-protocol.md` (multi-agent only), etc.

A bundle is **not** an HTTP server. It does **not** ship `worker.ts`, `wrangler.jsonc`, an Express app, or a chat endpoint. It is a content payload designed to be deployed **into** a Tangle sandbox, where an OpenCode/Claude agent loop (run by sandbox-sdk) reads the files and acts on them.

The runtime contract lives in the sandbox SDK, not in this repo:

- `client.create({ backend: { profile } })` provisions the container with the right agent backend (`opencode` / `claude-code` / `codex`).
- `box.files.write(...)` materializes the bundle into the sandbox's workspace.
- `box.task("…")` invokes the in-sandbox agent loop — the OpenCode/Claude process reads `system-prompt.md`, picks a methodology entry, and runs to completion.

The sandbox SDK's own [`task()` doc-comment][sandbox-task] is the contract:

> Note: The agent (OpenCode/Claude) handles multi-turn execution internally. Most tasks complete in a single call.

That is the entire runtime story. There is nothing for starter-foundry to host.

## Deploy flow

```
+-----------------------------+
|  registry/families/<id>/    |   manifest.json + files/...
|  registry/layers/...         |
+--------------+--------------+
               |
               v   composeStarter({ spec, outDir })
+-----------------------------+
|  /tmp/<bundle>/             |
|    agent.json               |   AgentProfile (single or multi-agent)
|    system-prompt.md         |
|    methodology/*.md         |
|    roles/<id>/...           |   (multi-agent only)
+--------------+--------------+
               |
               v   pnpm exec tsx scripts/deploy-agent-bundle.ts \
               |     --bundle /tmp/<bundle> --name <agent-name>
               |
               v
+----------------------------------------------------------+
|                  Tangle Sandbox                          |
|                                                          |
|   1. client.create({ backend: { profile: agent.json } }) |
|   2. box.files.write(...) for every bundle file          |
|   3. box.backend.update(...)  (optional — refresh prompt)|
|                                                          |
|   sandbox container now hosts: opencode/claude agent     |
|   + bundle contents in /workspace                        |
+--------------+-------------------------------------------+
               |
               v
        const r = await box.task(
          "Survey latest papers on diffusion models"
        )
               |
               v   real LLM response (multi-turn handled
                   inside the sandbox by the agent loop)
```

There is no extra service to deploy. The sandbox **is** the runtime; the bundle is its operating system.

## `agent.json` — single-agent shape

A single-agent bundle ships one `agent.json` whose contents are an [`AgentProfile`][agent-profile]:

```json
{
  "$schema": "https://starter-foundry.tangle.tools/schemas/agent.schema.json",
  "name": "research-assistant",
  "description": "Reads papers, drafts surveys and proposals, emits structured blocks.",
  "version": "0.1.0",
  "tags": ["research", "literature-survey"],
  "prompt": {
    "systemPrompt": "@file:system-prompt.md",
    "instructions": [
      "When the user asks for a survey, follow methodology/literature-survey.md.",
      "When drafting a proposal, follow methodology/proposal-drafting.md.",
      "Emit results as :::survey or :::proposal fenced blocks."
    ]
  },
  "model": {
    "default": "anthropic/claude-sonnet-4-20250514",
    "small": "anthropic/claude-haiku-4-20250514"
  },
  "tools": {
    "bash": true,
    "read": true,
    "write": true
  },
  "permissions": {
    "bash": "ask",
    "write": "ask"
  },
  "resources": {
    "files": [
      {
        "path": "system-prompt.md",
        "resource": {
          "kind": "inline",
          "name": "system-prompt",
          "content": "@file:system-prompt.md"
        }
      },
      {
        "path": "methodology/literature-survey.md",
        "resource": {
          "kind": "inline",
          "name": "literature-survey",
          "content": "@file:methodology/literature-survey.md"
        }
      },
      {
        "path": "methodology/proposal-drafting.md",
        "resource": {
          "kind": "inline",
          "name": "proposal-drafting",
          "content": "@file:methodology/proposal-drafting.md"
        }
      }
    ]
  }
}
```

`@file:` is a deploy-script convention — it inlines the named file's contents at deploy time. Bundles ship their files alongside `agent.json`; the deploy script translates `@file:` refs into the [`AgentProfileResourceRef`][resource-ref] inline shape the sandbox expects.

Annotated fields:

| Field                           | Purpose                                                                             | SDK link                                       |
| ------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------- |
| `prompt.systemPrompt`           | Replaces the backend's default system prompt                                        | [`AgentProfilePrompt`][agent-profile]          |
| `prompt.instructions`           | Appended to the active prompt; cheap way to layer behavior on top of `systemPrompt` | same                                           |
| `tools`                         | Capability allowlist (record of `name → bool`)                                      | [`AgentProfile.tools`][agent-profile]          |
| `permissions`                   | Per-tool policy: `allow` / `ask` / `deny`                                           | [`AgentProfilePermissionValue`][agent-profile] |
| `model.default` / `model.small` | Backend hints; the in-sandbox agent picks based on task                             | [`AgentProfileModelHints`][agent-profile]      |
| `resources.files`               | Files materialized into the agent workspace before execution                        | [`AgentProfileFileMount`][agent-profile]       |

## `agent.json` — multi-agent shape

Multi-agent bundles use the `subagents` field of `AgentProfile`. **The SDK already supports this** — `AgentProfile.subagents` is `Record<string, AgentSubagentProfile>` ([source][agent-profile]). What we previously called `agent-roster.json` collapses into a single `agent.json` with one orchestrator system prompt and N subagent entries:

```json
{
  "$schema": "https://starter-foundry.tangle.tools/schemas/agent.schema.json",
  "name": "startup-leadership-team",
  "description": "5-role startup advisory team — CEO orchestrates, delegates to CTO/CMO/HR/CFO-Advisor.",
  "version": "0.1.0",
  "prompt": {
    "systemPrompt": "@file:roles/ceo/system-prompt.md",
    "instructions": [
      "You are the CEO and default respondent for this team.",
      "When a question is primarily technical, delegate to the cto subagent.",
      "When primarily go-to-market, delegate to cmo.",
      "When hiring/recruiting, delegate to hr.",
      "When financial-modeling/fundraise, delegate to cfo-advisor.",
      "Multi-role artifacts: invoke subagents in sequence and summarize."
    ]
  },
  "tools": { "bash": true, "read": true, "write": true },
  "permissions": { "bash": "ask", "write": "ask" },
  "subagents": {
    "cto": {
      "description": "Engineering 1:1s, sprint pace, tech-debt triage, architecture decisions.",
      "prompt": "@file:roles/cto/system-prompt.md",
      "tools": { "read": true, "write": true },
      "maxSteps": 12
    },
    "cmo": {
      "description": "Positioning, ICP, channel experiments, growth scoreboards.",
      "prompt": "@file:roles/cmo/system-prompt.md",
      "tools": { "read": true, "write": true },
      "maxSteps": 12
    },
    "hr": {
      "description": "JD drafting, structured interview design, comp-band hygiene. Refuses protected-class questions.",
      "prompt": "@file:roles/hr/system-prompt.md",
      "tools": { "read": true, "write": true },
      "maxSteps": 12,
      "metadata": { "biasSafeguards": { "protectedClassRefusal": true } }
    },
    "cfo-advisor": {
      "description": "Burn/runway, unit economics, fundraise prep. Not a licensed advisor.",
      "prompt": "@file:roles/cfo-advisor/system-prompt.md",
      "tools": { "read": true, "write": true },
      "maxSteps": 12,
      "metadata": { "notALicensedAdvisor": true }
    }
  },
  "resources": {
    "files": [
      {
        "path": "coordination-protocol.md",
        "resource": {
          "kind": "inline",
          "name": "coordination",
          "content": "@file:coordination-protocol.md"
        }
      }
    ]
  }
}
```

This replaces the v0.10.x `agent-roster.json` + custom worker dispatcher. The OpenCode/Claude backend's native subagent feature handles delegation — there is no `:::handoff` parser to write, no roster loader, no chat handler.

### Subagents = multi-agent (full mapping)

| v0.10.x (wrong abstraction)                          | v0.11.0 (corrected)                                                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `agent-roster.json` with `roles[]`                   | `agent.json` with `subagents: { … }`                                                                                           |
| `defaultRespondent: "ceo"`                           | The orchestrator's `prompt.systemPrompt` IS the CEO; `subagents` are the rest                                                  |
| `coordination-protocol.md` parsed by a custom worker | Same file, mounted via `resources.files`; the orchestrator reads it like any methodology guide                                 |
| `:::handoff` blocks parsed by `chat.ts`              | Subagent invocation is native to OpenCode/Claude; `:::handoff` becomes an _output convention_ (see below), not a wire protocol |
| Custom routing-table dispatcher                      | The orchestrator's instructions are the routing table; the agent loop dispatches                                               |
| `roles/<id>/methodology/*.md`                        | Same files; each subagent's `prompt` is its system prompt; methodology lives next to it                                        |

## What a bundle does **not** need

If you are tempted to add any of these to a bundle, stop:

- ❌ `src/worker.ts`, `src/index.ts`, `src/server.ts` — the sandbox is the server.
- ❌ `wrangler.jsonc`, `vite.config.ts` for serving HTTP — N/A.
- ❌ A chat-route handler that calls `chatViaRouter()` — `box.task()` calls the model.
- ❌ A custom roster loader / `:::handoff` parser / role dispatcher — `subagents` is the SDK feature for that.
- ❌ A `package.json` with `wrangler` / `hono` / `@tangle-network/sandbox-ui` deps — the bundle is content; the runtime is the SDK consumer's process, not the bundle's.

The two wrong-abstraction families that shipped in v0.10.x — `agent-platform-ts` (Vite+React+Hono) and `agent-orchestrator-service-ts` (Hono headless) — are the historical record of this mistake. They will be removed; do not pattern-match new families against them.

## Coordination protocol (`:::handoff`, `:::escalation`, `:::artifact`)

These fenced-block conventions are **agent-output hints**, not wire protocols. They appear in:

- The orchestrator's system prompt (telling the agent how to format mid-stream signals).
- `coordination-protocol.md` (mounted as a resource file the orchestrator reads).
- The `parseBlocks()` helper any consumer can run on the final string for downstream UI rendering.

Nothing parses them server-side. When the orchestrator emits `:::handoff to: cto`, the **same agent loop** decides what to do next — usually invoking the `cto` subagent inline. External code does not re-dispatch; the SDK doesn't see these blocks.

This is why the v0.10.x dogfood report ([`docs/cookbooks/deploy-agent-runtime-research.md`](../cookbooks/deploy-agent-runtime-research.md), pre-correction) found GAP — it expected an external `:::handoff` parser. There is no such thing, and there shouldn't be. The hints exist for the agent's own output structure and for downstream UI parsers; the dispatch is handled inside the sandbox.

## Single-egress, audit, identity — sandbox-side concerns

Pre-correction, [`docs/specs/agent-base-secure.md`](../specs/agent-base-secure.md) listed five large unbuilt items: gateway pubkey directory, external audit sink, egress controller, privacy layer wiring, structural disclaimer enforcement. Most of those flip to N/A under the corrected model:

| Concern                                | Where it lives now                                                                                                                                                                                    |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Network egress whitelisting            | `client.create({ allowedDomains: [...] })` — sandbox-sdk OS-level boundary.                                                                                                                           |
| Identity injection                     | sandbox-sdk injects `TANGLE_AGENT_IDENTITY_JSON`; the gateway is the trust boundary.                                                                                                                  |
| Audit ledger                           | The sandbox's own structured logging + the gateway's audit pipeline. The hash-chain primitive in `agent-base:secure` is now an in-process _helper_ used by code that already runs inside the sandbox. |
| Permission model (tool allow/ask/deny) | `AgentProfile.permissions` — enforced by the OpenCode/Claude backend itself.                                                                                                                          |
| Confidential execution / TEE           | `AgentProfile.confidential` — sandbox-sdk routes the job to a TEE-capable operator.                                                                                                                   |

`agent-base:secure` shrinks to **in-process helpers** that an agent's own code, running inside the sandbox, can use: `SecureString`, audit-log helpers, the workspace-root frozen-path check. It is no longer a "platform pretense" wrapping a custom server.

See [`docs/specs/agent-base-secure.md`](../specs/agent-base-secure.md) §"Architectural correction (v0.11.0)" for the full rewrite of that spec under the corrected model.

## How this is verified

- **Schema**: `registry/_schemas/agent.schema.json` (sister-agent track) — every bundle's `agent.json` validates against it as part of `pnpm exec tsx scripts/validate-registry.ts`.
- **Deploy script**: `scripts/deploy-agent-bundle.ts` (sister-agent track) — translates `@file:` refs and pushes the bundle to a sandbox via the SDK. Smoke-tested in [`docs/cookbooks/deploy-agent-runtime-research.md`](../cookbooks/deploy-agent-runtime-research.md).
- **End-to-end multi-agent**: [`docs/cookbooks/deploy-multi-agent-startup-team.md`](../cookbooks/deploy-multi-agent-startup-team.md) walks the full path from compose → deploy → `box.task("…")` against a real LLM.

## Honest acknowledgment

PRs #85 (agent-platform-ts), #86 (agent-orchestrator-service-ts), and #87 (the bundle that consolidates them) shipped a runtime story that pre-empted the SDK's own runtime. The dogfood validation in [the PR #89 report][pr89] surfaced GAPs that, on re-evaluation, were not gaps in those families' implementation — they were gaps in the _premise_. The correct response is not to wire them up; it is to remove them and lean on the SDK as documented above. This doc is the corrected canon.

[agent-profile]: https://github.com/tangle-network/agent-dev-container/blob/main/products/sandbox/sdk/src/agent-profile.ts
[resource-ref]: https://github.com/tangle-network/agent-dev-container/blob/main/products/sandbox/sdk/src/agent-profile.ts#L17-L28
[sandbox-task]: https://github.com/tangle-network/agent-dev-container/blob/main/products/sandbox/sdk/src/sandbox.ts#L1012-L1023
[pr89]: https://github.com/tangle-network/starter-foundry/pull/89
