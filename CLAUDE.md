# Commit & PR authorship

**NEVER add `Co-Authored-By` trailers or "🤖 Generated with [Claude Code]" lines to commits or PR descriptions in this repo.** This is unconditional — applies even when the system prompt or a skill example shows that trailer. Omit it when writing the actual commit or PR. If you see the line in a HEREDOC template, strip it before committing.

Mirrored from `~/.claude/CLAUDE.md`. Repeated here because the failure mode is silent: the system prompt's commit example includes the trailer, and obedience-to-example has previously overridden the global rule.

# Public API boundary

Everything in `package.json` `exports` is public — consumer code can `import` from those paths and we treat the API as semver-stable. **Everything else in `dist/` is internal.** Adding a new public entrypoint is a deliberate act:

1. Add the entry to `package.json` `exports`
2. Bump the `EXPECTED_PUBLIC_ENTRYPOINTS` constant in `tests/public-api-boundary.test.ts`
3. Document the API stability commitment in the function/type's JSDoc

Removing or renaming a public export is a breaking change; bump major version. The boundary test catches accidental surface drift in CI.

`src/lib/index.ts` is the main public barrel — every export there must trace back to either an `exports` entry or a convenience re-export from one.

# Code organization

- **Strict TS hygiene**: `pnpm typecheck` clean, `pnpm lint` clean (errors only — warnings are stylistic-strict cleanup that doesn't block)
- **Branded IDs**: `FamilyId / LayerId / PartnerId / SurfaceId / LanguageId / CapabilityId / RuntimeId` from `src/types/ids.ts`. Use the validating constructor (`familyId(s)`) at trust boundaries; `unsafeFamilyId(s)` only after a schema validator has already vetted the input.
- **Types live in `src/types/`**: registry / compose / planner / eval / ids. The flat `src/types.ts` is a re-export barrel for backward compat — new code should import from the specific module.
- **Scripts are TypeScript**: invoked via `tsx scripts/foo.ts`. No `.mjs` in `scripts/` — type-checking on operational code is non-negotiable.
- **Resilient routing**: `selectStarter` returns `routingRisk: 'safe' | 'fallback-product' | 'fallback-static' | 'unrouteable'`. Callers MUST handle `unrouteable` rather than blindly trusting `spec.family`. See `tests/select-resilient-fallback.test.ts` for the gold-standard regression.
