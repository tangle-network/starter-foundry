# starter-foundry

`starter-foundry` is a fast project and workspace composer for AI coding products.

It takes a user prompt like:

`"Build a React dashboard with a Golang risk engine API and Coinbase CDP support"`

and turns it into:

- a starter or multi-project workspace plan
- prebuilt files on disk
- validation and benchmark output
- a context pack the agent can start from

## ELI5

Think of it as a very fast `project setup brain`.

Instead of making an agent invent a repo from nothing, it:

1. reads the prompt
2. picks the best prepared base
3. composes the right files and dependency choices
4. gives the agent a head start

So the agent spends more time building the product and less time writing boilerplate.

## What It Does

- Routes prompts into a `starter` or a multi-project `workspace`
- Composes families, layers, slots, and partner policy
- Supports partner-steered dependency choices like `database` and `sdk`
- Generates `PROJECT.md`, `AGENTS.md`, and structured context packs
- Validates the output
- Benchmarks time to first artifact and full validation
- Runs prompt-level proof suites over a corpus of real scenarios

## Is It Agent Based?

Partly.

The hot path is **not** agent-based. The main flow is deterministic:

`prompt -> plan -> compose -> validate -> context pack`

That is intentional. It keeps startup fast, predictable, and benchmarkable.

Agents are used around the edges:

- `audit` prepares an agent-ready familiarization bundle
- `evaluate` runs `opencode`, `codex`, or `claude` against a starter
- future harden/evolve loops can repair or improve starters offline

So the answer is:

- core launcher: deterministic
- optimization and review: agent-assisted

## Current Shape

- Starter families: frontend, API, worker, fullstack, edge, Rust, Go, Python, Solidity/Forge, Solana, Move
- Workspace composition: web + API + worker + multi-contract lanes
- Partner policy: currently `database` and `sdk` slots
- Proof corpus: real prompt suite across simple to mostly-complex scenarios

## Install

```bash
npm install
```

No build step is required.

## CLI

```bash
starter-foundry <command> [options]
```

Main commands:

- `plan --prompt <text>`
- `compose --spec <path> --out <dir>`
- `workspace-compose --spec <path> --out <dir>`
- `validate --spec <path>`
- `context --spec <path>`
- `bench --spec <path>`
- `prompt-e2e --corpus <path> --out <dir>`
- `prove --corpus <path> --out <dir>`
- `audit --spec <path>`
- `evaluate --spec <path> --agents opencode,codex,claude`

## Examples

Plan from a raw prompt:

```bash
node src/cli.mjs plan --prompt "Build a React dashboard with a separate Golang risk engine API using Postgres and Coinbase CDP."
```

Compose a single starter:

```bash
node src/cli.mjs compose --spec specs/react-vite-coinbase.json --out /tmp/react-demo
```

Compose a multi-project workspace:

```bash
node src/cli.mjs workspace-compose --spec specs/multichain-workspace.json --out /tmp/multichain-demo
```

Generate a context pack:

```bash
node src/cli.mjs workspace-context --spec specs/multichain-workspace.json --out /tmp/multichain-demo
```

Run the proof suite:

```bash
node src/cli.mjs prove --corpus corpus/vibecode-e2e.json --out /tmp/starter-foundry-proof
```

## Output Model

For a single starter, the output is usually:

- project files
- `.starter-foundry/compose-report.json`
- `.starter-foundry/context-pack.json`

For a workspace, the output also includes:

- `PROJECT.md`
- `AGENTS.md`
- `.starter-foundry/launch-plan.json`
- `.starter-foundry/workspace-report.json`
- `.starter-foundry/workspace-context.json`

## How To Think About It

This tool does **not** try to generate every repo from scratch.

It tries to find the best prepared starting state quickly, then let the agent build on top of that.

That is why it is useful for AI coding products:

- faster startup
- better consistency
- easier partner customization
- benchmarkable quality gates

## Current Proof Status

The current proof corpus covers:

- `23` prompt scenarios
- `13` starter families
- both starters and multi-project workspaces
- simple, medium, complex, and mostly-complex prompts

Recent proof command:

```bash
node src/cli.mjs prove --corpus corpus/vibecode-e2e.json --out /tmp/starter-foundry-proof
```

Recent result summary:

- `passRate: 1`
- `routeAccuracy: 1`
- `validationPassRate: 1`
- `primaryArtifactHitRate: 1`

Some lanes are still environment-dependent:

- Go and Move are currently structurally validated on machines without those toolchains
- Forge and Solana use real toolchain checks here

## Repo Layout

- `src/` CLI and engine
- `registry/` families, layers, and partner packs
- `specs/` sample starter and workspace specs
- `corpus/` proof scenarios
- `tests/` engine and proof tests

## Short Version

`starter-foundry` is a deterministic scaffold/workspace engine for AI coding systems, with agent hooks around it for audit and optimization.
