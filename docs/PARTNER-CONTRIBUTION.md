# Partner contribution program

Ship your ecosystem into starter-foundry. Agents that receive a prompt
mentioning your chain/SDK/API get your partner pack with addresses, SDK
references, and first-move hints baked in.

## What a partner contribution is

A single PR adding `registry/partners/<your-id>/`:
- `manifest.json` with `appliesTo: [<families>]`, `buildHints.whenToUse`, `buildHints.firstSteps`, `buildHints.gotchas`
- `files/<your-id>-config.json` with production addresses, SDK references,
  rate limits, canonical docs URLs

Plus one line in `src/lib/planner/detectors.ts` adding your keywords to
`inferPartner` and one block in `src/lib/planner/helpers.ts` listing the
families your partner applies to.

Scaffold the boilerplate with:

```bash
pnpm new:partner -- --name <your-id> --applies "react-vite-ts,nextjs-ts,forge-contracts" --description "..."
```

## Quality bar

PRs must:

1. **Validate**: `pnpm validate:registry` passes. No dangling `appliesTo`.
2. **Include a coverage test** in `tests/coverage.test.ts` so we can't
   accidentally drop your routing in a future refactor.
3. **Cite sources** in `buildHints.gotchas` — a gotcha without a doc link
   becomes stale silently; with a link we can refresh.
4. **Ship a config.json with real addresses**, not TODO placeholders. If you
   can't fill an address for every chain you support, drop that chain from
   `appliesTo` until you can.
5. **Populate `docs` URL** on the config.json — our nightly refresh script
   uses it to flag stale configs (>90 days without touch).

## What you don't need to do

- You don't need to edit `src/lib/` beyond the two-line planner wire.
- You don't need to author templates — capabilities own templates. Your
  partner pack is *configuration*, not code shipped.
- You don't need to commit test fixtures; the coverage test prompt is the
  full contract.

## Ongoing maintenance

Auto-refresh runs monthly. If your config goes stale (>90 days untouched),
it shows up on `.evolve/proposals/partner-refresh.json` — we ping you via
GitHub before dropping the partner. Keep your addresses current.

## What you get

1. Every prompt that mentions your ecosystem routes with partner bias set.
   The agent's AGENTS.md shows your first-moves + gotchas first.
2. Your SDK package gets mapped in `registry/package-to-capability.json`,
   so when agents install it the capability-gap detector classifies it
   correctly.
3. A stable referenced node in `docs/reference/partners/<id>.md` (auto-generated).

## Process

1. Fork + branch.
2. `pnpm new:partner -- --name <id> ...` → fill TODOs.
3. `pnpm validate:registry && pnpm build && pnpm test`.
4. Open PR. CI gates on the delta report.
5. Maintainer review for accuracy (addresses, SDK names, docs links).
6. Merge + auto-generate docs + auto-refresh monitoring begins.
