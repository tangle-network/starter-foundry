# TOOLS — agent-runtime-sales-engineer-ts

The bundle inherits all primitives from `agent-base:secure`: `secrets`, `workspace`, `webhook-in`, `webhook-out`, `schedule`, `identity`, `audit`. Plus generic agent tools: `Read`, `Write`, `Edit`, `Glob`, `Grep`, `Bash`, `WebFetch`.

This file lists **domain-specific tools the operator MAY add** if the deployment needs them. Each entry is intent — not implementation. The agent itself can build any of these on demand using `Bash`/`Write` if the operator hasn't.

## Domain tools the operator may want

Stub list — replace with role-specific entries. Keep ≤10 domain tools per deployment; more is fragmentation. Each tool should be:
- Single-purpose
- JSON output
- ≤100 LOC
- Listed here when added

| Tool | Intent | Notes |
|---|---|---|
| `demo-scripting` | Concrete tool implementing the `demo-scripting` capability | Operator implements when needed |
| `poc-design` | Concrete tool implementing the `poc-design` capability | Operator implements when needed |
| `competitive-technical-positioning` | Concrete tool implementing the `competitive-technical-positioning` capability | Operator implements when needed |

## Build a new tool when you need it

The agent's job includes building tools when the measurement doesn't exist. New tools should be small, JSON-output, single-purpose. Add an entry here via PR after shipping.
