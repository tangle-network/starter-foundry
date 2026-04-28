# Migrating from agent-eval 0.13.0 to 0.17.x

Context. Gen-17 (PR #133) shipped a hand-typed RunRecord + HeldOutGate
substrate inside `src/lib/`, with the explicit comment "swap is rename-only:
`import { ... } from '@tangle-network/agent-eval'`". That swap is NOT yet
rename-only as of 2026-04-28: the published `@tangle-network/agent-eval@0.17.0`
package has subtly diverged from the local shim. This document enumerates
every divergence so the next agent can do the bump in one focused PR.

## Schema deltas (must be bridged before the import swap)

The Gen-17 shim mirrored a guess at the v0.16 API. The shipped 0.17 API differs
in four places that touch live data:

1. `RunSplitTag` (upstream) vs `RunRecordSplitTag` (shim).
   - Upstream: `'search' | 'dev' | 'holdout'`
   - Shim: `'search' | 'holdout' | 'historical'`
   - Live impact: every record migrated by `scripts/migrate-experiments-to-run-records.ts`
     uses `splitTag: 'historical'`. Either upstream needs to add `'historical'`
     to the enum, or the migration script needs to relabel as `'dev'` and the
     bare-alias allowlist for the historical sentinel needs a different gate.

2. `outcome.raw` value type.
   - Upstream: `Record<string, number>` (numeric only).
   - Shim: `Record<string, number | boolean>` (booleans for stage flags).
   - Live impact: every audit RunRecord written by `src/cli.ts:audit` has
     boolean values like `{ install: true, typecheck: true, build: true }`.
     The migration: change `emit-run-record.ts` and the audit emit in
     `src/cli.ts:368-381` to coerce stage flags to `0|1` numbers, AND update
     `src/lib/run-canaries.ts:detectSilentStageFailure` to test against `0`
     not `false`.

3. `RunRecord.source` field (Gen-17 only).
   - Upstream: no such field. Verticalbench coupling lives elsewhere.
   - Shim: required `'foundry' | 'vb'`.
   - Migration: drop the field on swap. The vb side can carry source via
     `experimentId` prefix or a separate sidecar manifest.

4. `RunRecord.outcome.searchScore` requiredness.
   - Upstream: optional (a holdout-only run has only `holdoutScore`).
   - Shim: required.
   - Migration: relax the validator at the shim's call sites (or the call
     sites already always set it — verify before swapping).

## API parity checks (mostly fine, but verify)

The following exports DO exist in 0.17 with matching shapes. Spot-check:

- `validateRunRecord`, `isPinnedModel`, `RunRecordValidationError`, `sha256`
- `HeldOutGate`, `HeldOutGateConfig`, `GateDecision`, `GateEvidence`
- `runCanaries`, `CanaryReport`, `CanaryAlert`, `CanaryKind`, `CanaryOptions`

The shim's `HeldOutGate.evaluate(candidateRuns, baselineRuns)` signature
matches upstream's. The verdict codes match (`negative_delta`, `overfit_gap`).
Spot-check the rejection-code enum since the Gen-17 author wrote them by
hand: upstream `HeldOutGateRejectionCode` is the source of truth.

## The bump itself

```bash
# in the starter-foundry root
pnpm up @tangle-network/agent-eval@^0.17.0
pnpm typecheck   # will surface every shim mismatch as a type error
pnpm test
```

Then, for each divergence above:

1. Bridge the schema (coerce boolean stage flags → 0|1 in
   `emit-run-record.ts` and the audit emit; drop `source` field from the
   record builder; relax `searchScore` required).
2. Migrate the historical sentinel: rerun
   `pnpm migrate:experiments` with a `--split-tag=dev` override OR
   propose adding `'historical'` to upstream `RunSplitTag` and ship that
   first.
3. Replace the shim imports across `src/`, `scripts/`, and `tests/`:
   ```bash
   rg -l "from '\.\.?/.*run-record\.js'" src scripts tests | xargs \
     sed -i '' "s|from '\([^']*\)/run-record\.js'|from '@tangle-network/agent-eval'|g"
   # repeat for held-out-gate, run-canaries, run-record-store, emit-run-record
   ```
4. `rm` the shim files: `src/lib/run-record.ts`, `src/lib/held-out-gate.ts`,
   `src/lib/run-canaries.ts`, `src/lib/emit-run-record.ts`, plus
   `src/lib/run-record-store.ts` if upstream now ships an equivalent.
5. Re-export from `src/lib/index.ts` via `from '@tangle-network/agent-eval'`.

## Why not bump in the Gen-17 followup PR

Boil-the-ocean instinct: do it now. Don't:

- Gen-17 just shipped a 4049-LOC change. Stacking the bump immediately means
  any bug in the shim swap is hard to attribute (was it Gen-17 or the bump?).
- The schema deltas above are real. Migrating live `.evolve/runs.jsonl`
  records (boolean → numeric) needs a verified migration script with a
  fixture round-trip test. That's a separate ~half-day of work.
- Upstream is at 0.17.0 today (2026-04-28). It's worth one cycle of soak
  plus a careful read of the agent-eval CHANGELOG before locking in the
  contract.

The followup PR adds the missing canary primitives and pins the legacy
`profiles/sf-proposer.json` model field, which both unblock the brief's
"hard prerequisites" without conflating with the shim swap.

## Verification checklist for the bump PR

- [ ] `pnpm install --frozen-lockfile` after `pnpm up` — lockfile clean.
- [ ] `pnpm typecheck` green; every type error is a deliberate schema shift,
      not an accidental loss of validation.
- [ ] `pnpm test` green — including the muffled-gate scanner and bare-alias
      checker.
- [ ] `node scripts/check-bare-alias.ts .evolve/runs.jsonl` clean.
- [ ] `pnpm canary --all` runs without crashing on the migrated records.
- [ ] `pnpm gate` smoke against `corpus/held-out-validation.json` baseline.
- [ ] Old shim files deleted, not just emptied.
