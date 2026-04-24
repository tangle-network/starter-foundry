# Pattern: Muffled Gate

**Named in:** Gen 9 (2026-04-24)
**Enforced by:** `tests/muffled-gate-invariant.test.ts`
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

The invariant scanner reads:

- `src/eval/**` — eval-path source
- `src/lib/template-quality.ts` — quality scorer
- `src/lib/prompt-e2e.ts` — corpus runner
- `scripts/promote-family-proposal.mjs`
- `scripts/promote-capability-proposal.mjs`
- `scripts/audit-scaffold-quality.mjs`
- `scripts/meta-harness-eval.mjs`

New eval-like files must be added to the scanner's root list (see
`tests/muffled-gate-invariant.test.ts`). A proposer that adds a new
gate-adjacent file is expected to add it to the scan list in the same
change.

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
