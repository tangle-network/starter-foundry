# `agent-base:mcp-registry`

Ships an MCP server registry at `<workspace.root>/.mcp.json`. The deploy
script writes this file once at sandbox creation; the resident agent can
mutate it at runtime via `register.ts` helpers.

## Harness compatibility

| Harness     | Native filename | Behaviour |
|-------------|-----------------|-----------|
| OpenCode    | `.mcp.json`     | Native — `AgentProfile.mcp` in the sandbox SDK forwards into the same shape. |
| Claude Code | `.mcp.json`     | Native per [Claude Code MCP docs](https://docs.claude.com/en/docs/claude-code/mcp). |
| Hermes      | partial         | Hermes uses a different convention; deploy emits `.mcp.json` PLUS a stub. See `docs/issues/sandbox-sdk-deploy-hooks.md` for the upstream gap. |

The **deploy script's `--harness <name>` flag** drives the file path/format
translation. The bundle ships the registry once; harness translation happens
at deploy time, not at compose time.

## Composing with `agent-base:secure`

Servers that need credentials should reference them via `${env:VAR}`
placeholders in `.mcp.json`, then load the actual secret at agent boot via
`loadSecret('VAR')` from `src/lib/secure/secrets.ts` and inject it into the
process env before spawning the MCP server. This keeps the registry file
free of plaintext secrets and audit-loggable per the secure layer's
contract.

## Runtime mutation

```ts
import { addServer, keepServers, removeServer } from './register.js'

// Boot-time pruning — keep only the servers the agent actually needs:
await keepServers(['filesystem', 'fetch'])

// Dynamic add after credential mint:
await addServer('linear', {
  command: 'npx',
  args: ['-y', '@linear/mcp-server'],
  env: { LINEAR_API_KEY: '${env:LINEAR_API_KEY}' },
})

await removeServer('scheduler')  // pure cleanup
```

All mutations are atomic (tempfile + rename). The harness re-reads the
registry on the next MCP client reconnect.
