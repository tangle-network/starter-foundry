# starter-foundry

Deterministic project scaffold engine for AI coding platforms. Routes a user prompt to the right project structure, composes files, and gives the AI agent a concrete build plan — all in under 10ms.

```
"Build a Next.js SaaS with Stripe billing and team management"
  → nextjs-ts + capability:saas-teams + capability:tailwind + capability:dashboard-layout
  → 14 files composed
  → Build plan: create /settings/team, /dashboard, wire /api/team/invite, build TeamMemberList, InviteForm, Sidebar
```

## How it works

```
User prompt → planPrompt() → composeStarter() → tarball + build plan → AI agent starts building
              ~1ms            ~3ms               ~5ms
```

The hot path is fully deterministic — no LLM calls, no network, no randomness. A keyword scorer routes prompts to families, a capability detector attaches specialization layers, and the compose engine writes template files to disk.

## Registry

| | Count | Examples |
|---|---|---|
| **Families** | 38 | nextjs-ts, react-vite-ts, agent-service-ts, forge-contracts, solana-program, python-api, go-api, sveltekit-ts, vue-ts, remix-ts, angular-ts |
| **Capability layers** | 60 | agent-rag, agent-slack, agent-trading, defi-lending, defi-dex, saas-billing, saas-teams, shadcn, tailwind, deploy-docker, exchange-binance |
| **Slot layers** | 18 | database (sqlite/postgres/mongodb/convex), auth (clerk/better-auth/supabase), payments (stripe/coinbase-commerce), sdk, queue |
| **Partners** | 6 | Coinbase, Tangle, EigenLayer, Arbitrum, X Layer, Solana |
| **Product archetypes** | 115+ | "Twitter clone" → fullstack-ts + realtime-ws + saas-teams |

## Programmatic API

```typescript
import { planPrompt, composeStarter, createContextPack } from 'starter-foundry'

const plan = await planPrompt({
  prompt: 'Build a RAG chatbot with vector search',
  partner: null,
})
// → { kind: 'starter', spec: { family: 'agent-service-ts', layers: ['framework:agent-service-ts', 'capability:agent-rag'] } }

const result = await composeStarter({ spec: plan.spec, outDir: '/tmp/project' })
// → { filesWritten: ['agent.mjs', 'agent.config.json', 'rag-config.json', 'retrieval-pipeline.mjs', ...] }

const context = await createContextPack({ spec: plan.spec, outDir: '/tmp/project' })
// → { buildPlan: { pages: [], apiRoutes: ['/api/ingest', '/api/query'], components: ['DocumentUploader', 'SearchResults'], ... } }
```

## CLI

```bash
npm run build && node dist/cli.js <command>
```

| Command | Description |
|---------|-------------|
| `plan --prompt <text> [--partner <id>]` | Route a prompt to a family + capabilities |
| `compose --spec <path> --out <dir>` | Compose a starter project |
| `workspace-compose --spec <path> --out <dir>` | Compose a multi-project workspace |
| `validate --spec <path>` | Run validation checks (file-exists, node-syntax, http-start) |
| `context --spec <path>` | Generate a context pack with build plan |
| `bench --spec <path> [--runs <n>]` | Benchmark compose + validate timing |
| `prove --corpus <path> --out <dir>` | Run proof suite over a prompt corpus |
| `catalog` | List all families and layers |

## Architecture

```
registry/
  families/          38 project types (manifest.json + template files)
  layers/
    framework/       38 framework layers (entry points, config)
    capability/      60 specialization layers (RAG, DeFi, SaaS, design system)
    auth/            4 auth providers
    database/        4 database providers
    payments/        3 payment providers
    queue/           3 queue providers
    sdk/             4 SDK providers
  partners/          6 partner packs (branded defaults)

src/
  lib/
    keywords.ts      Lane routes, capability detection, fuzzy matching
    selection.ts     Family scoring (reads keywords from manifests)
    prompt-planner.ts  Workspace routing, slot detection, archetype matching
    compose.ts       File composition with path traversal guard
    build-plan.ts    Generates structured build plans from capabilities
    context-pack.ts  Context pack with build plan for AI agents
    registry.ts      Manifest loading, validation, caching
```

## Routing

Three layers, evaluated in order:

1. **Product archetypes** — "Twitter clone" → fullstack-ts. 115+ known products/app patterns.
2. **Keyword scoring** — Each family manifest declares keywords. The scorer picks the highest match.
3. **Fuzzy fallback** — When exact matching finds nothing, Levenshtein distance ≤ 1 catches typos ("Ract" → "react").

After family selection, **capability detection** scans the prompt against capability manifest keywords and attaches matching layers (RAG, Slack, DeFi lending, shadcn, etc.).

## Quality

| Metric | Value |
|--------|-------|
| Route accuracy (60 training scenarios) | 100% |
| Route accuracy (43 held-out scenarios) | 100% |
| Proof suite (compose + validate) | 60/60 |
| Unit + keyword tests | 131/131 |
| Adversarial accuracy (fixable prompts) | 83% |
| Compose latency (warm) | ~5ms |

## Install

```bash
npm install
npm run build
npm test
```

Requires Node.js >= 20. One runtime dependency (`@huggingface/transformers` for optional semantic routing).

## Adding Families or Capabilities

When you add a new family or update a family's `package.json`:

1. **Add the family** — create `registry/families/{id}/manifest.json` with `tieredKeywords`
2. **Add the framework layer** — create `registry/layers/framework/{id}/manifest.json` + template files
3. **Update slot compatibility** — add the family ID to `appliesTo` in relevant slot layers (`registry/layers/auth/*/manifest.json`, etc.)
4. **Sync the cache warm list** — ensures the container has all npm deps pre-cached:

```bash
npm run sync:warm-list        # check what's missing
npm run sync:warm-list:write  # auto-update agent-dev-container warm list
```

This script scans all family `package.json` files, collects every dependency, and writes any missing ones to `agent-dev-container/apps/host-agent/cache-warm-list.json`. The host agent periodically downloads these into a shared pnpm/npm store so `pnpm install` in containers hits the cache instead of the network.

5. **Run tests** — verify the new family routes and composes:

```bash
npm run build && npm test
```

## Integration

starter-foundry powers the free-text scaffold path in [blueprint-agent](https://github.com/tangle-network/blueprint-agent). When a user types a prompt instead of clicking a curated template, starter-foundry routes, composes, and provides the build plan.

```typescript
// In blueprint-agent's scaffold pipeline
import { planPrompt, composeStarter } from 'starter-foundry'

const plan = await planPrompt({ prompt: userMessage, partner })
if (plan.kind === 'starter') {
  const result = await composeStarter({ spec: plan.spec, outDir })
  // tarball extracted in container, agent gets build plan
}
```

## Evolve

The `.evolve/` directory tracks improvement cycles:

- `current.json` — current state (generation, round, status)
- `progress.md` — human-readable progress
- `experiments.jsonl` — structured experiment log
- `scorecard.json` — product quality scorecard
- `pursuits/` — generational design specs

8 generations shipped: TypeScript migration → registry-driven routing → product archetypes + fuzzy matching → build plans → unified tiered scoring → real-world corpus validation → semantic embedding fallback → full capability/family coverage testing.
