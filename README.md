# starter-foundry

A deterministic project-scaffold engine for AI coding agents. It routes a natural-language prompt to the right project structure, composes the files, and hands the agent a concrete build plan — in **under 10 ms, with no LLM call on the hot path**.

```
"Build a Next.js SaaS with Stripe billing and team management"
  → nextjs-ts + saas-teams + tailwind + layout-dashboard
  → 14 files written, plus a build plan:
    create /settings/team and /dashboard, wire /api/team/invite,
    build TeamMemberList, InviteForm, Sidebar
```

The point: give the agent a real starting point instead of a blank directory. The routing is a keyword scorer plus a capability detector — fully reproducible, no network, no model.

## Install

```sh
npm i @tangle-network/starter-foundry        # library
npx @tangle-network/starter-foundry --help   # CLI
```

Requires Node ≥ 20.

## Quickstart

Scaffold a project from a prompt into the current directory:

```sh
npx @tangle-network/starter-foundry compose-prompt --prompt "realtime chat app with auth" --out .
```

Or drive the pipeline from code:

```ts
import { planPrompt } from '@tangle-network/starter-foundry/planner'
import { composeStarter } from '@tangle-network/starter-foundry/compose'

const plan = planPrompt('realtime chat app with auth') // family + capability layers
const result = await composeStarter({ spec: plan.spec, outDir: './app' })
console.log(result.files, result.buildPlan)
```

## How it works

```
prompt ──► planPrompt() ──► composeStarter() ──► files + build plan ──► agent builds
            ~1 ms            ~5 ms
```

1. **plan** — score the prompt against the family registry, attach capability/slot layers.
2. **compose** — write the family template plus every layer's files, resolving variants deterministically from the project name.
3. **build plan** — emit the concrete next steps (routes to create, components to build, APIs to wire) for the agent.

Each stage is a CLI subcommand (`plan`, `compose`, `context`) and a library export, so you can stop at a spec, a file tree, or a full plan.

## Registry

The value is the registry — versioned scaffold families and composable layers:

|                   | Count | What it is                                                                                  |
| ----------------- | ----- | ------------------------------------------------------------------------------------------- |
| Families          | 94    | Base project types (`nextjs-ts`, `forge-contracts`, `solana-native-rust`, `python-http`, …) |
| Capability layers | 104   | UI/feature overlays (`layout-dashboard`, `saas-teams`, `crypto-swap-ui`, `agent-rag`, …)    |
| Slot layers       | 28    | Swappable infra: database, auth, payments, sdk, queue, industry                             |
| Partner layers    | 19    | Chain/protocol presets (Coinbase, EigenLayer, Solana, Tangle, …)                            |
| Archetypes        | 115+  | Prompt shorthands ("Twitter clone" → `fullstack-ts + realtime-ws + saas-teams`)             |

List the live registry instead of trusting a table that can go stale:

```sh
npx @tangle-network/starter-foundry list                    # families + layers
npx @tangle-network/starter-foundry select --prompt "..."   # what a prompt routes to
```

## CLI

| Command                                      | Purpose                                      |
| -------------------------------------------- | -------------------------------------------- |
| `compose-prompt --prompt <text> --out <dir>` | One shot: prompt → scaffold + build plan     |
| `plan --prompt <text>`                       | Route a prompt to a spec (family + layers)   |
| `select --prompt <text>`                     | Show the routing decision without composing  |
| `compose --spec <path> --out <dir>`          | Compose a saved spec to disk                 |
| `context --spec <path>`                      | Emit the agent build-plan context for a spec |
| `validate --spec <path>`                     | Check a spec against the registry            |
| `list`                                       | Print the live registry                      |

`--help` lists the full set (mining, evaluation, workspace composition, release).

## Library exports

`@tangle-network/starter-foundry` ships typed subpath exports: `/planner`, `/compose`, `/compose-prompt`, `/agent-context`, `/registry`, `/context`, `/build-plan`, `/industries`, `/workspace`, `/primary-project`, `/keywords`, `/types`.

## Documentation

- `docs/INTEGRATION.md` — embedding the engine in a product
- `docs/cookbooks/` — end-to-end recipes
- `docs/reference/` — family and capability reference

## License

Licensed under either of **MIT** ([LICENSE-MIT](./LICENSE-MIT)) or **Apache-2.0** ([LICENSE-APACHE](./LICENSE-APACHE)) at your option.
