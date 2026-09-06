# Starter Foundry

Write commits and PRs without co-authorship or tool-attribution trailers.

# Public API boundary

Everything in `package.json` `exports` is public — consumer code can `import` from those paths and we treat the API as semver-stable. **Everything else in `dist/` is internal.** Adding a new public entrypoint is a deliberate act:

1. Add the entry to `package.json` `exports`
2. Update the boundary contract in `tests/public-api-boundary.test.ts`
3. Document the API stability commitment in the function/type's JSDoc

Removing or renaming a public export is a breaking change; bump major version. The boundary test catches accidental surface drift in CI.

`src/lib/index.ts` is the main public barrel — every export there must trace back to either an `exports` entry or a convenience re-export from one.

# Code organization

- **Strict TS hygiene**: `pnpm typecheck` clean, `pnpm lint` clean (errors only — warnings are stylistic-strict cleanup that doesn't block)
- **Branded IDs**: `FamilyId / LayerId / PartnerId / SurfaceId / LanguageId / CapabilityId / RuntimeId` from `src/types/ids.ts`. Use the validating constructor (`familyId(s)`) at trust boundaries; `unsafeFamilyId(s)` only after a schema validator has already vetted the input.
- **Types live in `src/types/`**: registry / compose / planner / eval / ids. Import new code from the specific module.
- **Scripts are TypeScript**: invoked via `tsx scripts/foo.ts`. No `.mjs` in `scripts/` — type-checking on operational code is non-negotiable.
- **Resilient routing**: `selectStarter` returns `routingRisk: 'safe' | 'fallback-product' | 'fallback-static' | 'unrouteable'`. Callers MUST handle `unrouteable` rather than blindly trusting `spec.family`. See `tests/select-resilient-fallback.test.ts` for the gold-standard regression.

# Shipped instructions

Registry families, layers, examples, and test fixtures contain instructions delivered to generated projects or agent profiles.
Treat those files as product content: preserve their role, output format, consent, privacy, and escalation contracts.
For composition changes, inspect `src/lib/compose.ts` and `src/lib/agent-bundle.ts`.
When editing a methodology pointer, verify its file exists in the delivered bundle and run the affected bundle tests.
