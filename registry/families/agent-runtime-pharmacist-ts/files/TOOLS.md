# TOOLS — agent-runtime-pharmacist-ts

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
| `drug-information` | Concrete tool implementing the `drug-information` capability | Operator implements when needed |
| `drug-interaction-check` | Concrete tool implementing the `drug-interaction-check` capability | Operator implements when needed |
| `dosing-guidance` | Concrete tool implementing the `dosing-guidance` capability | Operator implements when needed |
| `adverse-effect-monitoring` | Concrete tool implementing the `adverse-effect-monitoring` capability | Operator implements when needed |

## Build a new tool when you need it

The agent's job includes building tools when the measurement doesn't exist. New tools should be small, JSON-output, single-purpose. Add an entry here via PR after shipping.
