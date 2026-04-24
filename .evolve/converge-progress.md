# Converge Progress

## Target
- **Branch**: main
- **Status**: CONVERGED (2026-04-24T03:55Z)

## Final State
- **Last commit**: 567a01e
- **build + test**: SUCCESS
- **router matrix eval**: SUCCESS

## Round History
| Round | Commit | Fix | Outcome |
|-------|--------|-----|---------|
| 1 | f2340b4 | composite action clone+build agent-eval as sibling | superseded by R3 |
| 2 | 86b6f50 | `tests/fixtures/buildouts.jsonl` + `scripts/ensure-test-fixtures.mjs` + pretest hook | green contribution — unblocked 11 trace-dependent tests |
| 3 | 224d141 → dcad3d3 (PR #49) | `package.json` `link:../agent-eval` → `^0.7.0`; strip sibling-clone composite action from all 6 workflows | green contribution — removes tech debt, enables blueprint-agent consumers |
| 4 | 03574ff | `tests/refresh-scorecard.test.ts` — explicit utimesSync on internal.json to defeat CI mtime race | unblocked build+test |
| 5 | 98b0b2b → da5d227 → 57e26ce → 567a01e (PRs #50, #51, v0.7.0 tag) | scaffold_gap_installs 56→9 + React 18 `.tsx` + router signals.ts — incidentally fixed all 5 matrix-eval regressions | fully green |

## Lessons
- `link:../file` specifiers break in every consumer that doesn't replicate the developer's checkout layout. Publishing to npm early removes a whole class of setup friction.
- Test fixtures for machine-local integration tests (here: Claude Code session-history-mined files) need explicit fixtures + auto-seed, not "everyone has the data."
- Node's `utimesSync(path, secondsFloat)` can preserve sub-second precision but write-time default mtimes from `writeFileSync` can tie or trail. Tests comparing mtimes should explicitly set both sides.

## Pre-existing on Base Branch
- None remaining.
