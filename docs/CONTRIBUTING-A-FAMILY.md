# Contributing a family, capability, or partner

The generators scaffold all the boilerplate — you fill the semantic slots,
not the file shapes.

## Add a family

```bash
pnpm new:family -- --name <id> --runtime <bun|deno|node|rust|go|python|wasm> --surface <api|frontend|worker|contracts|agent-service|inference> --description "one-sentence archetype"
```

The generator writes:
- `registry/families/<id>/manifest.json` (schema-valid skeleton)
- `registry/families/<id>/files/` (empty — add package.json, validator, tsconfig)
- `registry/layers/framework/<id>/manifest.json`
- `registry/layers/framework/<id>/files/` (empty — add your server/entry files)

Then fill the TODOs in the manifest, wire the planner (`src/lib/planner/projects.ts`),
add a coverage-test prompt, and extend slot layers' `appliesTo` if the family uses
database/auth/payments/queue slots.

## Add a capability

```bash
pnpm new:capability -- --name <id> --applies "family1,family2" --description "..."
```

Capabilities declare their own runtime deps via `packageDeps` — compose merges them
into the composed scaffold's `package.json`. Don't ask the agent to install things
the capability itself should ship.

## Add a partner

```bash
pnpm new:partner -- --name <id> --applies "fam1,fam2" --description "..."
```

Plus: wire `inferPartner` (detectors.ts) + `resolvePartnerForFamily` (helpers.ts)
so prompts route + families accept the partner.

## What the generators don't do yet

- LLM-drafted `buildHints` from a one-paragraph description. On the roadmap.
- Auto-wire the planner. You still edit `src/lib/planner/projects.ts` manually.
- Auto-run measurement. You still attach a buildout-pipeline delta to your PR.

## The PR gate

Every registry PR runs:
- `pnpm validate:registry` (schemas + tier1 keyword overlap warnings + dangling appliesTo)
- `pnpm build && pnpm test` (unit + coverage + matrix eval)

A PR that adds a family without a coverage test, a capability without a buildHints
filled out, or a manifest that fails schema will fail CI.
