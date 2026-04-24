# Converge Progress

## Target
- **Branch**: main
- **PR**: n/a (fix-on-main; PR #47 already merged with the break)
- **Status**: IN_PROGRESS (round 2 pushed; awaiting CI)

## Current State
- **Last commit**: (round 2 push, see below)
- **Last updated**: 2026-04-24T01:15:00Z
- **Round**: 2

## Workflow Status
| Workflow | Job | Status | Since Round |
|----------|-----|--------|-------------|
| CI | build + test | typecheck+build GREEN at round 1; tests FAILED on 11 trace-dependent tests | awaiting round 2 |
| CI | matrix-eval | skipped (gated on build + test) | — |

## Round History
| Round | Commit | Fixed | Remaining | Timestamp |
|-------|--------|-------|-----------|-----------|
| 1 | f2340b4 | `link:../agent-eval` typecheck break via composite action | 11 tests fail reading missing `.evolve/traces/buildouts.jsonl` | 2026-04-24T01:05Z |
| 2 | (round 2) | Seed `.evolve/traces/buildouts.jsonl` from `tests/fixtures/buildouts.jsonl` via `pretest` hook on fresh clones | awaiting CI | 2026-04-24T01:15Z |

## Completed Fixes
- [x] **Round 1**: composite action `.github/actions/setup-agent-eval` clones+builds the sibling agent-eval at pinned SHA `c696bfd`. Wired into ci.yml + nightly-measurement.yml + proposal-cron.yml + scorecard-refresh.yml + cve-sweep.yml + template-quality.yml. Local verification: typecheck + build pass. CI round 1 (117fdcc): `typecheck + build` step GREEN, tests failed on trace-dependent integration tests.
- [x] **Round 2**: added `tests/fixtures/buildouts.jsonl` (5 synthetic entries, valid schema v3) + `scripts/ensure-test-fixtures.mjs` (copies fixture to `.evolve/traces/buildouts.jsonl` if absent). Wired into `pretest` so CI + fresh dev clones seed the fixture automatically. Miner output always wins over the fixture (existsSync check before copy). Local verification: 688/688 pass.

## Remaining Failures
(awaiting round-2 CI result)

## Blocked / Needs Human
- none

## Pre-existing on Base Branch
- `publish.yml` uses `npm install` + `prepublishOnly: tsc` — same `link:../agent-eval` issue would bite on a tag push, but that workflow doesn't currently run on main CI. Deferred. Bigger fix: switch `package.json` to `github:tangle-network/agent-eval#<sha>` or publish agent-eval to npm so the `link:` specifier isn't needed at all.
