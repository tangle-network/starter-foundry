# starter-foundry

Deterministic project scaffold engine for AI coding platforms. Routes a user prompt to the right project structure, composes files, and gives the AI agent a concrete build plan — all in under 10ms.

```
"Build a Next.js SaaS with Stripe billing and team management"
  → nextjs-ts + capability:saas-teams + capability:tailwind + capability:layout-dashboard
  → 14 files composed
  → Build plan: create /settings/team, /dashboard, wire /api/team/invite, build TeamMemberList, InviteForm, Sidebar
```

## How it works

```
User prompt → planPrompt() → composeStarter() → scaffold + build plan → AI agent starts building
              ~1ms            ~3ms               ~5ms
```

The hot path is fully deterministic — no LLM calls, no network. A keyword scorer routes prompts to families, a capability detector attaches specialization layers, and the compose engine writes template files to disk.

## Registry

| | Count | Examples |
|---|---|---|
| **Families** | 40 | nextjs-ts, react-vite-ts, agent-service-ts, forge-contracts, solana-program, python-api, go-api, sveltekit-ts |
| **Capability layers** | 91 | See categories below |
| **Slot layers** | 18 | database (sqlite/postgres/mongodb/convex), auth (clerk/better-auth/supabase), payments, sdk, queue |
| **Partners** | 6 | Coinbase, Tangle, EigenLayer, Arbitrum, X Layer, Solana |
| **Product archetypes** | 115+ | "Twitter clone" → fullstack-ts + realtime-ws + saas-teams |

### Capability layers by category

**Layout (rich UI — production-ready React components):**
layout-dashboard (sidebar + KPIs + activity feed), layout-landing (hero + features + pricing), layout-chat (message list + streaming input + sidebar), layout-admin (TanStack data table + entity form), layout-auth (sign-in/sign-up pages), layout-settings (profile/billing/team tabs)

**Crypto frontend UI:**
crypto-swap-ui (DEX swap card + token selector + pool card), crypto-staking-ui (staking dashboard + validator card), crypto-bridge-ui (bridge card + tx history), crypto-portfolio-ui (portfolio overview + token rows), crypto-governance-ui (proposal cards + voting), crypto-launchpad-ui (sale card + vesting schedule)

**AI/Agent UI:**
ai-chat-sessions (ChatGPT-style session list + folders + header), ai-agent-orchestrator (multi-agent timeline + tool call traces), ai-rag-chat (source citations + knowledge base manager), ai-voice-chat (voice orb + transcript + call controls)

**Agent frameworks:** agent-rag, agent-langgraph, agent-mastra, agent-multi-agent, agent-trading, agent-voice, agent-slack, agent-github, agent-browser, agent-code-review, agent-customer-support, agent-data-pipeline, agent-intel, agent-openclaw, agent-hermes, agent-ai-sdk

**DeFi/Crypto config:** defi-lending, defi-dex, defi-perpetuals, defi-yield, defi-restaking, defi-bridge, solana-amm, solana-perps, solana-staking, solana-nft, solana-prediction, solana-launchpad, solana-keeper, move-amm, move-staking, move-nft, move-oracle, move-launchpad, fhe-private-token, fhe-private-voting, fhe-sealed-auction

**EVM infra:** evm-account-abstraction, evm-chain-monitor, evm-deploy-foundry, evm-layerzero-oft, evm-protocol-api, evm-wallet-dashboard

**Other:** marketplace, webrtc, shadcn, tailwind, chart-widget, json-render, saas-billing, saas-teams, realtime-ws, deploy-docker, deploy-github-actions, infra-k8s, infra-terraform, infra-pulumi, exchange-binance, exchange-coinbase, exchange-okx, gpu-modal, gpu-replicate, gpu-together, effect-ts, logging, webhook-processor, market-sim, icons, typography, tangle-custody, tangle-oracle, ai-chat-ui, ai-agent-dashboard, ai-fine-tuning, admin-crud

### Variants

Layout layers support **visual variants** — different design treatments of the same component structure. The compose engine picks a variant deterministically from the project name, so every scaffold looks distinct but the result is reproducible.

| Layer | Variants |
|---|---|
| layout-landing | gradient-hero, minimal-clean, dark-product |
| layout-dashboard | sidebar, topnav |

## Programmatic API

```typescript
import { planPrompt, composeStarter, createContextPack } from 'starter-foundry'

const plan = await planPrompt({
  prompt: 'Build a RAG chatbot with vector search',
  partner: null,
})

const result = await composeStarter({ spec: plan.spec, outDir: '/tmp/project' })
const context = await createContextPack({ spec: plan.spec, outDir: '/tmp/project' })
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
| `validate --spec <path>` | Run validation checks |
| `context --spec <path>` | Generate a context pack with build plan |
| `bench --spec <path> [--runs <n>]` | Benchmark compose + validate timing |
| `prove --corpus <path> --out <dir>` | Run proof suite over a prompt corpus |
| `catalog` | List all families and layers |

## Routing

Three layers, evaluated in order:

1. **Product archetypes** — "Twitter clone" → fullstack-ts. 115+ known product patterns.
2. **Keyword scoring** — Each family manifest declares tiered keywords. Highest match wins.
3. **Fuzzy fallback** — Levenshtein distance ≤ 1 catches typos ("Ract" → "react").

After family selection, **capability detection** scans the prompt against capability keywords and attaches matching layers.

## Quality

| Metric | Value |
|--------|-------|
| Route accuracy (training corpus, 60 scenarios) | 100% |
| Route accuracy (held-out corpus, 43 scenarios) | 100% |
| Route accuracy (IdeasAI corpus, 60 scenarios) | 100% |
| Unit + integration tests | 343/343 |
| Compose latency (warm) | ~5ms |

## Install

```bash
npm install
npm run build
npm test
```

Requires Node.js >= 20.

## Adding families or capabilities

1. Create `registry/families/{id}/manifest.json` or `registry/layers/capability/{id}/manifest.json`
2. Add template files in `files/` subdirectory
3. For rich UI layers: provide real `.tsx` components (not config stubs)
4. For variants: add `variants/` subdirectory with alternative file sets + `"variants": [...]` in manifest
5. Run `npm run sync:warm-list` to update the container warm cache
6. Run `npm test` — the meta test enforces every capability has a coverage test

## Integration

starter-foundry powers the free-text scaffold path in blueprint-agent. When a user types a prompt, starter-foundry routes, composes, and provides the build plan.

```typescript
import { planPrompt, composeStarter } from 'starter-foundry'

const plan = await planPrompt({ prompt: userMessage, partner })
if (plan.kind === 'starter') {
  const result = await composeStarter({ spec: plan.spec, outDir })
}
```

## Buildout pipeline (agent-behavior → registry signal)

The `scripts/*-buildout*.mjs` pipeline mines Claude Code session transcripts of real agent buildouts on top of starter-foundry scaffolds and produces two ranked reports: **missing capabilities** (packages agents install because our router didn't attach the right layer) and **bad templates** (files agents rewrite within the first few turns).

### Run it

```bash
pnpm build
node scripts/run-buildout-pipeline.mjs   # mine → join → analyze
```

Outputs:
- `.evolve/buildout-analysis.json` — per-scenario pass rate, top-added packages, top-rewritten files (committed evidence)
- `.evolve/capability-gaps.json` — ranked (scenario, capability) router misses
- `.evolve/traces/buildouts.jsonl` — append-only corpus (gitignored, regenerable)

### Stages

| Script | Input | Output |
|---|---|---|
| `mine-buildout-sessions.mjs` | `~/.claude/projects/**/factory-local-phase2-*/*.jsonl` | `.evolve/traces/buildouts.jsonl` |
| `join-buildout-outcomes.mjs` | VB execution traces + buildouts | buildouts.jsonl annotated with outcomes |
| `analyze-buildouts.mjs` | joined buildouts | `.evolve/buildout-analysis.json` |
| `infer-capability-gaps.mjs` | joined buildouts + `registry/package-to-capability.json` | `.evolve/capability-gaps.json` |

### Fault tolerance

- **Resumable**: per-session mtime stored in `.evolve/traces/.buildouts-miner-state.json`. Unchanged sessions skip; next run is ~0ms.
- **Concurrent-safe**: O_EXCL lock file prevents simultaneous miner entry. Stale locks (PID not alive) auto-steal.
- **Corruption-tolerant**: a malformed state file is logged and reseeded instead of crashing.
- **Schema-versioned**: bumping `BUILDOUT_SCHEMA_VERSION` auto-rebuilds from source.
- **Append-only output**: JSONL with per-row schema version; malformed lines are skipped by every consumer.

### Adding a new source (GLM, GPT, etc.)

Write a new miner script (e.g., `mine-glm-sessions.mjs`) that emits rows conforming to `BuildoutEvent` in `src/lib/buildout-traces.ts` — same append-only JSONL, same schema version, different `sourceModel` value. The join + analyze stages consume it unchanged.

### Extending `registry/package-to-capability.json`

When an agent installs package X, we want our router to pre-attach the capability X maps to. Add an entry:

```json
"package-name": { "capability": "capability:foo", "confidence": 0.9 }
```

`tests/package-to-capability.test.ts` validates every capability ID against the live registry at build time.
