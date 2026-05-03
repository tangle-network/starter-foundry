# agent-eval Integration State

Last reviewed: 2026-05-03

## Current State

- Package pins are `@tangle-network/agent-eval` `^0.19.1` in the root, example workspace, and scaffold families.
- The scaffold registry already exposes:
  - eval harness templates
  - auto-research layer
  - trace multi-turn layer
  - run records and gates
- Stale historical docs/comments still reference `0.7.x`, `0.13`, and `0.17`.

## What Is Good

- This repo is the distribution point, so upgrading it creates leverage across future apps.
- The auto-research family already wraps `runPromptEvolution` and steering optimizers without hiding upstream semantics.
- The scaffold layers are well positioned to teach the right 0.19 pattern.

## What Is Not 10/10 Yet

- Historical changelog entries and generated example docs still mention older package lines. That is acceptable in archive/changelog contexts, but active templates should teach the 0.19.1 path.
- Historical migration docs are useful for archaeology but dangerous as onboarding material.
- Some generated comments still encode old bug/version details that should not be copied into new projects.

## Target 10/10 Shape

1. Make the primary TypeScript scaffold expose a `MultiShotRunner`, `MultiShotScorer`, and `MultiShotMutateAdapter`.
2. Use `runPromptEvolution` only as an advanced lower-level primitive.
3. Scaffold ASI examples by default.
4. Scaffold holdout gating by default, including `toRunRecord()`.
5. Include a single "agent-eval 0.19 product adapter" doc and demote older migration docs to archive status.

## Blockers

- Keep generated research docs multi-shot-first.
- Remove old version guidance from active docs and comments when it is not changelog/archive material.
- Ensure scaffold tests cover generated 0.19.1 code.

## Release Readiness

Dependency upgrade: complete.

Integration maturity: B. The scaffolds know about the right primitives, but the default generated path should be multi-shot-first.
