# TOOLS — agent-runtime-fitness-coach-ts

The bundle inherits all primitives from `agent-base:secure`: `secrets`, `workspace`, `webhook-in`, `webhook-out`, `schedule`, `identity`, `audit`. Plus generic agent tools: `Read`, `Write`, `Edit`, `Glob`, `Grep`, `Bash`, `WebFetch`.

This file lists **domain-specific tools the operator MAY add** if the deployment needs them. Each entry is intent — not implementation. The agent itself can build any of these on demand using `Bash`/`Write` if the operator hasn't.

## Voice mode (inherited from `agent-tools:phony-voice`)

| Capability | Intent |
|---|---|
| `voice.stt(audioPath)` | Speech-to-text via `@ph0ny/sdk` |
| `voice.tts(text)` | Text-to-speech via `@ph0ny/sdk` |

## Domain tools the operator may want

Stub list — replace with role-specific entries. Keep ≤10 domain tools per deployment; more is fragmentation. Each tool should be:
- Single-purpose
- JSON output
- ≤100 LOC
- Listed here when added

| Tool | Intent | Notes |
|---|---|---|
| `weekly-program` | Concrete tool implementing the `weekly-program` capability | Operator implements when needed |
| `form-check-protocol` | Concrete tool implementing the `form-check-protocol` capability | Operator implements when needed |
| `deload-prompt` | Concrete tool implementing the `deload-prompt` capability | Operator implements when needed |

## Build a new tool when you need it

The agent's job includes building tools when the measurement doesn't exist. New tools should be small, JSON-output, single-purpose. Add an entry here via PR after shipping.
