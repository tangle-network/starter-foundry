# Pattern: Muffled Gate

**Named in:** Gen 9 (2026-04-24)
**Enforced by:** `tests/muffled-gate-invariant.test.ts` (gating layer) +
`tests/proposal-rate-measurement.test.ts` + `tests/agent-eval-cost-tracking.test.ts` (measurement layer)
**Escape hatch:** `// muffle-ok: <reason>` inline annotation

## Shape

A gate that should fail loud — reporting a precise, actionable error —
returns silent success instead. The caller proceeds as if the gate
passed. Broken proposals land in the registry. Users discover the
bug at runtime when the shipped scaffold doesn't compile.

Common sub-shapes:

1. **Fallback-to-pass.** `command || true` swallows exit codes. If the
   command fails, the shell still exits 0 and the caller can't tell.
2. **Default-missing-to-permissive.** `options.kind ?? 'starter'`. A
   missing field becomes a specific non-null value that satisfies the
   check without the user ever declaring it.
3. **Skip-counts-as-pass.** A phase that didn't run returns `ok: true`
   and gets weighted into an aggregate score, inflating the score
   for scaffolds that omit the phase entirely.
4. **No-expectation-auto-matches.** A scenario without an `expected`
   block is counted as a successful route match, inflating accuracy
   metrics for corpora with no ground truth.
5. **Duplicate drift.** The same dispatch table (harness config,
   language → command mapping) is redeclared in N files. A fix to
   N−1 copies silently re-introduces the muffle via the unfixed copy.
6. **Unknown-case silent default.** `switch (kind) { default: return noop }`
   for a value that should never be unknown.

## Live instances (closed at Gen 9)

| # | Shape | Location | Closed in |
|---|-------|----------|-----------|
| 1 | Fallback-to-pass | runtime `makeHarnessConfig` TS `\|\| true` | Gen 9 — strict `pnpm exec tsc --noEmit` |
| 2 | Unknown-case silent default | `makeHarnessConfig` default `testCommand: 'true'` | Gen 9 — throws on unknown language |
| 3 | Default-missing-to-permissive | `meta-harness-eval.mjs` held-out `?? 'starter'` | Gen 9 — `?? null`, matcher already null-safe |
| 4 | Skip-counts-as-pass | `phaseOk` returns `true` for skipped | Gen 9 — three-valued `'skipped'`, priced at 0.5 |
| 5 | No-expectation-auto-matches | `matchesExpectation(!expected)` → true | Gen 9 — `{matched, hasExpectation}`, summary excludes |
| 6 | Duplicate drift | three `harnessConfigForFamily` copies | Gen 9 — single source `HARNESS_CONFIGS` |
| 7 | Fallback-to-pass | promoter build gate `pnpm run validate \|\| pnpm run build \|\| true` | Gen 8 |
| 8 | Default-missing-to-permissive | CI matrix-eval `expectedKind=starter` literal | PR #51 |
| 9 | Construct-vs-call arg dropped | `SubprocessSandboxDriver({cwd})` ignored | Gen 8b |
| 10 | Fidelity-without-compile | text-scaffold fidelity judge without build gate | Gen 8 |

## Prior incidents (pre-Gen-9)

All four pre-Gen-9 instances (#7–#10) shipped to main. Three were caught
at audit time. One (#8) was caught only because the CI workflow failed
on a changed fixture. None were caught at the gate they were supposed
to enforce.

## Escape hatch

Some `|| true` / fallback uses are intentional:

- `forge install --no-git || true` — best-effort setup; the real gate
  is `forge build`.
- `[ -f requirements.txt ] && pip install -r requirements.txt || true` —
  same; the real gate is `python -m compileall`.
- `grep -oE '...' || true` in registry layer shell scripts — shell
  idiom for "tolerate empty match," not a gate.
- `cargo check --workspace || cargo check` — narrower-scope retry
  for non-workspace crates, not a pass-through.

When a fallback is intentional, annotate the line with:

```
testCommand: 'forge install --no-git || true',  // muffle-ok: setup is best-effort; forge build is the real gate
```

The invariant test accepts any line with `muffle-ok:` as explicit
opt-out. Lines without the annotation that match the forbidden
patterns fail the test.

## Scan scope

Split coverage (H4 from Research R2026-04-24):

**Explicit SCAN_FILES** — context-specific patterns (fallback-to-pass,
permissive defaults, skip-counts-as-pass, no-expectation auto-match,
duplicate-harness-dispatch):

- `src/eval/scaffold-bridge.ts`
- `src/lib/template-quality.ts` — quality scorer
- `src/lib/prompt-e2e.ts` — corpus runner
- `scripts/promote-family-proposal.mjs`
- `scripts/promote-capability-proposal.mjs`
- `scripts/audit-scaffold-quality.mjs`
- `scripts/meta-harness-eval.mjs`
- `scripts/agent-eval-scaffold.mjs`

New gate-adjacent files with the above pattern shapes must be added
to SCAN_FILES in the same change that introduces them.

**Auto-derived importer walk** — the construct-vs-call cwd pattern
(`new SubprocessSandboxDriver({cwd:...})`) is universal to any
`@tangle-network/agent-eval` consumer, so the scanner walks `src/` +
`scripts/` at test time looking for the string literal
`'@tangle-network/agent-eval'` and scans the result set with
`findConstructorCwdDropped` in addition to SCAN_FILES. This means a
new importer CANNOT silently escape the invariant — even if a
contributor forgets to add it to SCAN_FILES, the construct-vs-call
finder still runs against it.

Research H4 confirmed why the two sets are split: 4 of 8 SCAN_FILES
files (template-quality, prompt-e2e, audit, meta-harness-eval) don't
import agent-eval but host orthogonal muffle shapes; 4 agent-eval
importers (enrich-family, training/capability_proposer,
training/family_proposer, training/template_v1) don't host the
context-specific patterns. Pure auto-derivation drops the first
group; manual-list-only drops the second. The split covers both.

## For future proposers

Before shipping a change that introduces a gate (anything that reads
a proposal and returns pass/fail):

1. Does the gate distinguish "phase didn't run" from "phase passed"?
2. Does every optional field that routes the gate's decision have an
   explicit default — and is that default the STRICT choice, not the
   permissive one?
3. Is there exactly one source of truth for the dispatch table, or
   are copies likely to drift?
4. Does a `|| true` / fallback chain cover the gate's failure mode?
5. Is the "unknown / uncovered" case a throw, or a silent pass?

If any answer reveals a muffle, fix it before merging. The invariant
test catches #1, #3, #4, #5 mechanically; #2 needs human review.

## Measurement-layer variant

Same shape in a different layer. A gate that fails silently ships bad
code; a METRIC that fails silently points optimization at the wrong
thing. R2-C arc (2026-04-24) fixed 4 instances:

| Sub-shape | Location | Closed in |
|---|---|---|
| Denominator pollution | `proposal_promotion_rate` — test-fixture events counted as real failures (108/114) | PR #59: `STARTER_FOUNDRY_SYNTHETIC_RUN=1` env gate + fixture-id filter |
| Event-level double-counting | Same metric — reverted-then-re-promoted ids counted 2× | PR #59: `latestByIdPromote` — unique id outcomes |
| Silent-fail aggregator | `costTracker.getSummary?.() ?? {}` — method name typo, optional chain silent-returns undefined | PR #61: `.summary()` correct name |
| Never recorded | `costTracker` created but `.record()` never called | PR #61: record per-seed from `invokeMetaJudge.usage` |

Honest-null flows (deliberately unmeasured, documented in
`refresh-scorecard.mjs`): `cost_usd_per_buildout`,
`agent_eval_meta_pass_rate`. These are RED on the scorecard because
target > null, but the null is the signal, not a bug. Document-and-
leave is correct; fabricating a number is the actual failure mode.

Rules for measurement flows (complementing the gate checklist):
- Probe the raw data before trusting the aggregate.
- Ratios dedupe by entity, not event.
- Test runs must not write to production logs (env-gate at write time).
- Optional chains on required method calls are lying by default — call
  directly and let the error fire.
