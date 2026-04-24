# Converge Progress

## Target
- **Branch**: main
- **PR**: n/a (fix-on-main; PR #47 already merged with the break)
- **Status**: IN_PROGRESS (round 3 pushed; awaiting CI)

## Current State
- **Last commit**: (round 3 push — npm dep + teardown of the sibling-clone hack)
- **Last updated**: 2026-04-24T01:30:00Z
- **Round**: 3

## Workflow Status
| Workflow | Job | Status | Since Round |
|----------|-----|--------|-------------|
| CI | build + test | GREEN at round 2 (86b6f50) | 2 |
| CI | matrix-eval | running at round 2 | 2 |

## Round History
| Round | Commit | Fixed | Remaining | Timestamp |
|-------|--------|-------|-----------|-----------|
| 1 | f2340b4 | `link:../agent-eval` typecheck break via composite action + sibling clone | 11 trace-dependent tests | 2026-04-24T01:05Z |
| 2 | 86b6f50 | Seed `.evolve/traces/buildouts.jsonl` from `tests/fixtures/` via pretest hook | — (build+test green; matrix-eval running) | 2026-04-24T01:15Z |
| 3 | (round 3) | Agent-eval 0.7.0 published to npm — swap `link:../agent-eval` → `^0.7.0`, tear down the sibling-clone composite action + remove its `uses:` references from all 6 workflows | awaiting CI | 2026-04-24T01:30Z |

## Completed Fixes
- [x] **Round 1**: composite action `.github/actions/setup-agent-eval` clones+builds the sibling agent-eval at pinned SHA `c696bfd`. Wired into all 6 workflows.
- [x] **Round 2**: added `tests/fixtures/buildouts.jsonl` (5 synthetic entries, valid schema v3) + `scripts/ensure-test-fixtures.mjs` (copies fixture to `.evolve/traces/buildouts.jsonl` if absent). Wired into `pretest`. Local 688/688, CI build+test GREEN.
- [x] **Round 3**: superseded round 1. `@tangle-network/agent-eval@0.7.0` now on npm registry with all required exports (runProposeReview, inMemoryReviewStore, jsonlReviewStore, createLlmReviewer, ProposeFn, VerifyFn, ReviewFn, Verification, ReviewMemoryEntry verified via `npm pack`). Switched `package.json` to `"^0.7.0"`, regenerated `pnpm-lock.yaml`, deleted `.github/actions/setup-agent-eval/` + stripped its `uses:` line from 6 workflows. No more sibling-checkout dance; fresh clones + CI both work via `pnpm install`. Round 2's fixture is kept (still needed on any machine without mined session history). Local 688/688.

## Remaining Failures
(awaiting round-3 CI result)

## Blocked / Needs Human
- none

## Pre-existing on Base Branch
- `publish.yml` uses `npm install` + `prepublishOnly: tsc` — previously had the same `link:` issue. After round 3 it's also fixed (the link specifier is gone).
