# Reflection — Self-Healing Shift

**Date:** 2026-04-20
**Rounds since last reflection (2026-04-17):** 12 iterations (R1 multi-pursue × 3 variants, R2 multi-pursue × 3 variants, corpus relabel, session-trace collector, VB consumer, 2 `/evolve` rounds)
**Trigger:** Operator question — "why are YOU the one doing this work? YOURE DOING THE WORK OF THE HARNESS WE WANT BEING BUILT"

## The pattern the loop was missing

Every `/evolve` round we ran over the last two governor invocations:

1. Measurement infra flags broken layers — **automated** ✓
2. Read the failure signatures — **me, by hand**
3. Infer root cause across layers — **me, by hand**
4. Propose package.json patches — **me, by hand**
5. Apply patches — **me, by hand**
6. Re-run audit, verify no regression — **automated** ✓

Steps 2–5 are the entire value-producing loop. None of them were exercised by the harness we've been building. The variant_b AxFlow nodes, the judge infra, the brief-loader contract, the `__setTestBrief` hook — all of it was built to do this kind of proposing+scoring work. I wasn't using it. I was using my edit tool.

The result: 7 bug fixes shipped, +18.9pp scaffold audit pass rate, real value for today's users. AND zero training data generated for the harness. AND the next 5 broken layers + any future broken layers still require me.

## What the harness should have been doing

Given the audit output as input, and the 7 seed fixes as labeled training data:

```
audit-collect  →  fix-propose  →  fix-judge  →  fix-apply
  (deterministic)   (LLM/rules)      (composer+      (git commit
                                      re-audit)       or PR)
```

Four-node AxFlow, same shape as variant_b's collect/train/generate/judge/rank/promote pipeline. Different domain — scaffold-quality fixes instead of routing archetypes — but identical contract.

## Why this kept happening

Two reasons:

1. **Governor's "exploit HIGH" decision kept routing to /evolve**, and `/evolve` is a measurement+tuning skill, not a building skill. When the gap is "build the thing that does this work," neither exploit nor explore-light fits. `/pursue` or `/multi-pursue` is the right tool for building. The decision tree works but I misread the gap.

2. **Fixing was fast in my context window.** Each round took ~10 minutes of human-shaped work. Building the auto-fixer would have been 2-3 hours of real architecture. The time-to-delta trade-off favored the shortcut every round. That's a systematic bias the governor should catch, not me.

## Pattern to lift for future governor decisions

> **If the same manual pattern (read error → propose patch → apply → re-measure) repeats across 2+ `/evolve` rounds, the skill pick was wrong. Escalate to `/pursue` or `/multi-pursue` to build the automator.**

This should become a governor signal. Call it `manualLoopDetected`. Trigger: last 2 `/evolve` rounds produced KEEP via direct file edits by the operator/assistant rather than via a dispatched program. Decision-tree placement: between "Unresolved HIGH" and "Reflection-due" — it's a specific kind of reflection signal that the tree should catch explicitly.

## Dispatch-at-end

Dispatch `/multi-pursue` — three structurally different auto-fixer architectures, competing on:
- Coverage: how many of the remaining 5 broken layers get patched automatically
- Safety: regression rate on previously-passing layers
- Training-value: does the fix history feed back as examples for AxGEPA training
- Code simplicity: LOC + dependency footprint

Proposers G, H, I (structurally different — see next governor log entry).
