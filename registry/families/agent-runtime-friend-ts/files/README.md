# agent-runtime-friend-ts

Companion bundle. Voice-first daily check-in agent with durable
memory. Explicitly NOT a therapist — escalates clinical-grade
distress to the therapist bundle.

## Composition

```
agent-base:tangle          # sandbox + tcloud + router
agent-base:secure          # secrets/workspace/audit/identity
agent-tools:phony-voice    # STT/TTS via @ph0ny/sdk
agent-output:blocks        # :::escalation grammar
```

## What it ships

- `system-prompt.md` — non-clinical role, escalation triggers,
  tone rules
- `methodology/` — check-in-protocol, rapport-warm, topic-pivot
- escalation block grammar baked in

## What it does NOT do

- Therapy, coaching, diagnosis, advice
- Solve clinical problems with warmth — that's the documented
  failure mode this bundle refuses

## Wiring

When a memory layer ships, add it to `includes[]`. Until then,
memory is whatever your runtime persists between sessions.
