# Decision 001: Split muffled-gate scanner into explicit + auto-derived

**Date**: 2026-04-24
**Status**: adopted
**Origin**: Research round, H4 after empirical evaluation of H1-H3

## Question

Should the muffled-gate invariant scanner auto-derive its scan set from
files that import `@tangle-network/agent-eval`, or keep the explicit
SCAN_FILES list?

## Audit

Current SCAN_FILES has 8 files. `rg -l '@tangle-network/agent-eval'`
returns 9 candidate importers (excluding tests). Overlap analysis:

| set | count |
|---|---|
| on SCAN_FILES AND imports agent-eval | 4 |
| on SCAN_FILES, DOES NOT import agent-eval | 4 |
| imports agent-eval, NOT on SCAN_FILES | 4 |

The 4 importer gaps (`scripts/enrich-family.mjs`,
`src/training/capability_proposer/propose.ts`,
`src/training/family_proposer/propose.ts`, `src/training/template_v1/run.ts`)
are real: a planted `new SubprocessSandboxDriver({cwd: dir})` in
`enrich-family.mjs` passed the current scanner unchallenged — confirmed
empirically before the fix.

The 4 non-importer scans are also real coverage: template-quality's
`phaseOk` skip-counts-as-pass, prompt-e2e's no-expectation matcher,
audit-scaffold-quality's phase skipping, meta-harness-eval's
`?? 'starter'` default — all host muffle shapes orthogonal to the
agent-eval driver surface.

## Alternatives considered

**H1 — pure auto-derive.** Replace SCAN_FILES with `rg -l` output.
Rejected: drops the 4 orthogonal-pattern files.

**H2 — hybrid with skip-list.** Keep SCAN_FILES, require every importer
to be either in SCAN_FILES or explicitly skip-listed. Rejected: skip
list drifts same way the manual list does; doesn't solve the problem.

**H3 — broader glob.** Scan all `src/**/*.ts` + `scripts/**/*.mjs` for
the construct-vs-call pattern. Rejected: other patterns
(skip-counts-as-pass, no-expectation matcher) are too
context-specific to run globally — would produce too many
false-positive `muffle-ok` annotations.

**H4 — split adopted.** Keep SCAN_FILES for context-specific patterns.
Auto-derive a SECOND scan set (`@tangle-network/agent-eval`
importers) that only runs `findConstructorCwdDropped`.

## Rationale

The construct-vs-call pattern is mechanical and universal across
agent-eval consumers — anyone calling `new SubprocessSandboxDriver`
is at risk, regardless of what else the file does. The other five
pattern finders are context-specific (they grep for phase-specific
keywords like `testCommand:`, `if (p.skipped)`, `?? 'starter'`) and
produce too much noise on unrelated code.

Splitting matches the nature of the patterns:
- One pattern needs universal mechanical coverage → auto-derive the
  scan set from import-graph signal.
- Five patterns need semantic context → explicit SCAN_FILES list,
  maintained by humans who understand which files host gate logic.

## Implementation

`tests/muffled-gate-invariant.test.ts`:
- New `agentEvalImporters()` walks `src/` + `scripts/` at test time,
  collects files containing the literal string `'@tangle-network/agent-eval'`.
- Uses Node-native `readdirSync` + `statSync` — no `rg` PATH
  dependency (test runners often lack it even when shells have it).
- `scanAll()` runs all 6 finders across SCAN_FILES, then runs only
  `findConstructorCwdDropped` across `agentEvalImporters()` \ SCAN_FILES.
- Dedup via a `scannedForConstructorCwd: Set<string>` so files on
  both lists aren't double-scanned.

New invariant test: `auto-derived scan covers all agent-eval importers
outside SCAN_FILES` — asserts the walk finds files and that any
importer not on SCAN_FILES is still on disk (guards stale path literals).

Pattern doc updated at `.evolve/patterns/muffled-gate.md` §Scan scope
with the rationale.

## Outcome

- Empirical: planted `new SubprocessSandboxDriver({cwd: dir})` in
  `scripts/enrich-family.mjs` is now caught at exact file:line with
  the correct pattern name. Pre-H4 scanner passed.
- Tests: 704/704 (was 703, +1 new guard).
- No false positives introduced — the only new finder (construct-vs-call)
  has a narrow regex that only matches the exact bug shape.

## Origin analysis

Question framed by the `/research` skill; answer adopted from H4 after
pairwise comparison against H1/H2/H3 reasoning. Implementation guided
by empirical verification (plant → fail → fix → pass → clean restore).
No external reference needed — the decision is mechanical, not
subjective.
