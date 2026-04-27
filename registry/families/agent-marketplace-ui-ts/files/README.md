# {{appName}} — Agent Bundle Marketplace

Public Next.js catalog UI for browsing and deploying agent bundles from a
starter-foundry registry. Lists every bundle under `registry/families/`,
shows AGENTS.md preview with the same `:::` block parser the runtime UI uses,
and walks users through `pnpm exec tsx scripts/deploy-agent-bundle.ts`.

## Routes

- `/` — catalog grid + search/filter (server-rendered list, client-side
  filter + fuzzy search via `fuse.js`)
- `/bundles/[id]` — bundle detail: manifest summary table, AGENTS.md preview,
  multi-agent role list, "Deploy" CTA
- `/deploy/[id]` — guided deploy flow: form-driven, generates the exact
  `deploy-agent-bundle.ts` command for the user to copy + run

## Required env

| Var                     | Purpose                                                    |
| ----------------------- | ---------------------------------------------------------- |
| `CATALOG_REGISTRY_PATH` | Absolute or relative path to `starter-foundry/registry/families` |

Optional:

| Var               | Purpose                                                          |
| ----------------- | ---------------------------------------------------------------- |
| `CATALOG_API_URL` | Pre-built JSON snapshot URL (use when the registry isn't on disk) |
| `DEPLOY_API_URL`  | Backend deploy endpoint (replaces the copy-paste step in DeployFlow) |

## Commands

```bash
pnpm install
CATALOG_REGISTRY_PATH=../starter-foundry/registry/families pnpm dev
pnpm build
pnpm start
pnpm typecheck
```

## Composition

This family composes `ui-adapter:blocks-renderer` so the AGENTS.md preview can
parse `:::artifact / :::escalation / :::screener-result / :::audio-cue /
:::suggestion` blocks emitted by agent-runtime bundles. The same parser the
runtime UIs use — what you see here is what those blocks render as.

## Extension points

- `src/lib/catalog.ts` — swap filesystem walk for an API fetch
- `src/components/DeployFlow.tsx` — replace copy-paste step with a
  `fetch(DEPLOY_API_URL, {...})` call when running with a backend
- `src/components/AgentsMdPreview.tsx` — render parsed block bodies inline
  instead of as a summary list (use `blocksToArtifacts` + a markdown renderer)
- `src/lib/search.ts` — tune Fuse keys/weights or swap for a server-side index
