# Deploying agent-runtime-research

End-to-end dogfood report: take the markdown-only `agent-runtime-research`
family, run it through `composeStarter`, and try to get a running agent
that answers a research prompt over HTTP.

**TL;DR — there is no executable runtime today.** Compose succeeds in
~0.6 s and emits 22 files, but the output is not a deployable Worker:
no `package.json`, no `wrangler.jsonc`, no `src/worker.ts`. The bundle
ships system prompt + methodology templates + `chatViaRouter()` and
`searchPapers()` _contracts_ — both of the latter throw on first call.
Every `agent-runtime-*` family in the registry has the same gap.

This file documents the verified composition path, the gaps that
prevent a deploy, and the smallest set of changes that would make
"clone-to-running-agent in under 5 minutes" true.

## Prereqs

What you actually need on your machine:

- Node ≥ 22 + `pnpm` (the repo's own toolchain)
- `pnpm install` from the repo root (~30 s on first run)
- _(For deploy, NOT for compose)_ `wrangler` CLI + a Cloudflare account
- _(For deploy, NOT for compose)_ `TANGLE_ROUTER_KEY` env var — used
  by `src/lib/tangle.ts:chatViaRouter` against `https://router.tangle.tools/v1/chat/completions`

The compose step itself has zero network and zero env-var dependency.

## Steps (verified)

### 1. Compose the bundle

```ts
// compose.ts
import { composeStarter } from './src/lib/compose.js'

await composeStarter({
  spec: {
    family: 'agent-runtime-research',
    layers: ['agent-base:tangle', 'agent-tools:research-corpus', 'agent-output:blocks'],
    projectName: 'research-assistant-dogfood',
  },
  outDir: '/tmp/research',
})
```

```bash
pnpm exec tsx compose.ts
```

Time: **~0.6 s** wall, ~22 files written. `agent-base:secure` is
auto-attached via the family manifest's `includes[]`; do NOT pass it
as an explicit `layers[]` entry — it is not registered as a slot
option for `slot: agent-base` (only `agent-base:tangle` is) and the
compose call will throw `"Layer agent-base:secure is not a valid
option for slot agent-base"`.

### 2. Inspect the composed scaffold

```
/tmp/research/
├── AGENTS.md                    # generic SF runtime instructions (mentions sidecar /process/ensure-dev-server)
├── CLAUDE.md                    # same content as AGENTS.md
├── llms.txt
├── README.md                    # bundle README
├── system-prompt.md             # the agent's role + output blocks
├── TOOLS.md
├── methodology/
│   ├── index.json               # { entries: [{ id, capability, path }] }
│   ├── literature-survey.md
│   └── proposal-drafting.md
├── src/lib/
│   ├── tangle.ts                # chatViaRouter() — works; spawnAgentSandbox() — throws
│   ├── blocks.ts                # parseBlocks() — works (no I/O, pure)
│   ├── tools/research.ts        # searchPapers() / getCitationGraph() — both throw
│   └── secure/                  # 8 files: identity, secrets, audit, webhook-in/out, schedule, workspace
└── .starter-foundry/
    └── compose-report.json
```

### 3. Run the registry-side validators

```bash
pnpm exec tsx scripts/validate-registry.ts
```

Result: `✓ registry validation passed (156 families)`.

### 4. Run the per-bundle validators (from `compose-report.json`)

```ts
import { readFileSync } from 'node:fs'
import { validateComposedDir } from './src/lib/validate.js'

const report = JSON.parse(
  readFileSync('/tmp/research/.starter-foundry/compose-report.json', 'utf8'),
)
const r = await validateComposedDir({
  composedDir: '/tmp/research',
  checks: report.validationChecks,
})
```

Result: **16/17 PASS, 1 FAIL** —

```
FAIL schedule-valid manifest.json
     cannot read /tmp/research/manifest.json: ENOENT
```

The `schedule-valid` validator reads `manifest.json` from the composed
dir, but `composeStarter` does not copy the family's `manifest.json`
out of `registry/families/agent-runtime-research/`. Either the
validator should read from the registry source, or compose should
emit a runtime manifest. This is a pre-existing bug in the validator
contract; it affects every agent-runtime family, not just this one.

### 5. Run the legacy bundle-check

```bash
pnpm exec tsx scripts/agent-runtime-bundle-check.ts /tmp/research
# exit 1
# ✗ required file missing: templates/index.json
```

The script (and the family's own `README.md`) refer to `templates/`,
but the manifest emits `methodology/`. Either the script's
`REQUIRED_FILES` constant needs updating, or the bundle's docs and
manifest paths need renaming. This is a stale-rename issue — the
codebase already has a `runMethodologyIndexCheck` validator that
replaced `runTemplateIndexCheck`, but `agent-runtime-bundle-check.ts`
was never updated.

## What works

- **Compose itself.** `composeStarter` runs in well under 1 s, writes
  22 files, generates a valid `compose-report.json`, an `AGENTS.md`
  - `CLAUDE.md` + `llms.txt`, and merges the layer-provided source
    files (`src/lib/tangle.ts`, `src/lib/blocks.ts`,
    `src/lib/tools/research.ts`, `src/lib/secure/*`) into the project
    tree.
- **Determinism.** Re-running compose produces identical output;
  `agent-base:secure` auto-attaches via `includes[]`; the registry's
  shape validators (file-exists × 13, agents-md-valid,
  methodology-index-valid) all pass against the emitted scaffold.
- **The system-prompt + methodology contract.** `system-prompt.md`
  has valid YAML frontmatter (`name`, `role`, `domain`,
  `allowedDomains`, `version`); `methodology/index.json` declares
  two capabilities (`literature-survey`, `proposal-drafting`) and
  both methodology files exist and pass content checks. An LLM with
  filesystem access could load this and operate.
- **`parseBlocks()`** in `src/lib/blocks.ts` is a real, pure parser
  for the `:::proposal` / `:::survey` / `:::artifact` fence grammar
  the system prompt emits — it would correctly route a streaming
  agent response into typed chunks if anything called it.

## What doesn't (the gaps)

The bundle is **content-only**. There is no executable runtime in the
composed output. Specifically:

1. **No HTTP server.** Compose emits no `src/worker.ts`,
   `src/index.ts`, `src/server.ts`, or equivalent. The
   `defaults.routes` in `manifest.json` declares
   `/api/chat (auth: bearer)` and `/api/health (auth: none)`, but
   nothing implements them. There is no scaffolded route handler in
   any family or layer in this repo. `wrangler dev` cannot start —
   no `wrangler.jsonc`, no entrypoint.
2. **No `package.json` in the composed output.** The
   `cloudflare-worker-ts` family ships a `package.json` template,
   but `agent-runtime-research` is a _sibling_ family, not layered
   on top of `cloudflare-worker-ts`. So the composed scaffold has no
   manifest declaring `wrangler` as a devDep, no `dev`/`deploy`
   scripts, no Node toolchain hook. The runtime sidecar route in
   AGENTS.md (`POST /process/ensure-dev-server`) would 404 with
   `NO_RUNNABLE_PROJECT` immediately.
3. **`spawnAgentSandbox()` throws.** `src/lib/tangle.ts:51` is a
   contract stub: `throw new Error('spawnAgentSandbox: import @tangle-network/sandbox-sdk and wire its createSandbox() here')`.
   The whole "sandbox spawns it" story in the bundle's README is
   aspirational — no caller exists, and the SDK isn't wired in.
4. **`searchPapers()` throws.** Same pattern in
   `src/lib/tools/research.ts:31` —
   `throw new Error('searchPapers: wire arxiv/s2/openalex/crossref clients here, dedupe by DOI')`.
   The four citation sources advertised in the manifest's
   `corpusProviders` are placeholder strings, not clients. Same for
   `getCitationGraph()` at line 39.
5. **`schedule-valid` validator fails on the composed output.**
   See Step 4 above. Validators expect `manifest.json` in the
   composed dir; compose doesn't copy it. The cron-trigger contract
   (`scheduled-1`, `scheduled-2`) cannot be wired without a host
   that reads the manifest at runtime, and no such host is generated.
6. **`agent-runtime-bundle-check.ts` is stale.** Looks for
   `templates/index.json`; bundle ships `methodology/index.json`.
   Bundle's own README also references `templates/` despite the
   manifest copying files into `methodology/`. Naming was renamed
   but not migrated.
7. **README / system prompt referenced extension points don't
   exist.** The bundle's `contextHints.extensionPoints` declares
   `templates/` and `skills/`. Neither directory is created by
   compose; only `methodology/` is. `extensionPoints` flows into
   `llms.txt` and is what an AI agent would pattern-match against.
8. **The LLM call path is never invoked.** `chatViaRouter()` works
   (it's a thin `fetch` against `router.tangle.tools/v1/chat/completions`),
   but nothing in the composed scaffold imports or calls it. The
   `LLM_ROUTER_URL` + `TANGLE_ROUTER_KEY` plumbing is set up for a
   caller that doesn't exist.
9. **`agent-base:secure` opt-out path is fragile.** `secure` is in
   the family's `includes[]` (so it auto-attaches) but it's NOT a
   slot option, so an explicit `layers: ['agent-base:secure']` arg
   to `composeStarter` throws. This is non-obvious — there is no
   documented way to _opt out_ of the security layer without editing
   the family manifest.

The catalog claim "scaffold an agent in <5 min" is **half-true**: you
can scaffold _the content of_ an agent (system prompt, methodology,
output-block contract) in under 1 second. You cannot scaffold a
_running_ agent in any amount of time — the runtime substrate that
loads the system prompt, exposes `/api/chat`, calls
`chatViaRouter()`, and dispatches to `searchPapers()` does not exist
in this repository.

## Time to first response

**N/A.** Cannot start a server because no server is generated. The
end-to-end clone-to-running-agent path is blocked at "no entrypoint."

If the reader interprets the question as time-to-composed-scaffold:
**~0.6 s** for compose, **~30 s** for `pnpm install` of the engine
itself on a cold machine, **~3 s** for `tsx`. Call it ~35 s end to
end for "scaffold the markdown" — but again, the scaffold doesn't
_run_.

## Recommendations

Three changes, in priority order, would make the catalog claim true:

1. **Ship a generic agent-runtime Worker template.** Add a new
   layer `runtime:cloudflare-worker-agent` (or fold into
   `agent-base:tangle`) that emits:
   - `src/worker.ts` — Hono or bare-fetch handler that routes
     `/api/chat` → load `system-prompt.md` from `__bundle__`
     (Worker static assets), pick a methodology entry by capability,
     POST to `chatViaRouter()`, stream the response through
     `parseBlocks()`, return SSE.
   - `wrangler.jsonc` — assets binding for the `methodology/` and
     `system-prompt.md` files, `[triggers].crons` from
     `manifest.defaults.schedule`, `compatibility_date`.
   - `package.json` — `wrangler` devDep, `dev`/`deploy` scripts.
     This would close gaps 1, 2, and 5–8 in one move. Estimated effort:
     ~1 day for a working reference, plus tests in
     `tests/agent-runtime-bundle-check.test.ts`.

2. **Wire `searchPapers()` against at least one real provider.**
   Pick OpenAlex (no auth, generous rate limits) for the v1
   reference. The throwing stub means the bundle cannot answer a
   real research prompt even if the runtime existed. ~2 hours.

3. **Fix the `methodology/` vs `templates/` rename.**
   `agent-runtime-bundle-check.ts:66` should accept either path.
   The bundle's own `README.md` should match the manifest. The
   `schedule-valid` validator should either read from the registry
   source or compose should copy a runtime `manifest.json` into the
   output. ~1 hour for any one of these fixes; do all three.

A fourth, smaller item: document the `includes[]` vs slot-option
distinction so consumers don't pass `agent-base:secure` explicitly
and hit the opt-in error message that doesn't exist as a path.

Once (1) lands, the time-to-first-response claim becomes testable
end-to-end: compose → `wrangler dev` → `curl /api/chat` should be
under 60 s on a warm cache, well inside the catalog's 5-minute
promise.
