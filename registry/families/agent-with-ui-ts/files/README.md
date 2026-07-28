# {{agentName}}

Single-agent chat and artifact UI backed by one Tangle sandbox.
The browser streams events from `/api/prompt`.
Only the Node server imports the Sandbox SDK or reads the operator key.

## Quickstart

```sh
cp .env.example .env
pnpm install
pnpm dev
```

Open `http://localhost:{{port}}`.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `TANGLE_SANDBOX_API_KEY` | yes | Operator key read only by `server/index.ts` |
| `TANGLE_SANDBOX_ID` | yes | Existing sandbox that runs the agent |
| `TANGLE_SANDBOX_BASE_URL` | no | Sandbox API root; defaults to `{{sandboxApiUrl}}` |
| `HOST` | no | API bind host; defaults to `127.0.0.1` |
| `API_PORT` | no | Local API port; defaults to `8787` |
| `VITE_AGENT_NAME` | no | Browser-safe display name |

The server binds to loopback by default.
Add application authentication before setting `HOST=0.0.0.0`.
Never put the operator key in a `VITE_*` variable because Vite embeds it in browser assets.

## Architecture

- `src/App.tsx` owns chat, artifact, and cancellation state.
- `src/lib/agent-client.ts` parses the same-origin event stream.
- `src/lib/parse-blocks.ts` and `src/lib/blocks-to-artifacts.tsx` map structured output into workbench artifacts.
- `server/index.ts` reads secrets and calls `Sandbox.streamPrompt()`.

The default invoker uses `/api/prompt`.
Pass an `AgentInvoker` prop only when embedding the UI behind another authenticated transport.
Stop aborts the active request and closes the assistant message immediately.

`pnpm build` checks browser, build-tool, and server code and emits `dist/` plus `server-dist/`.
`pnpm start` serves the built UI and API.

## Extension Points

- Change agent presentation in `src/App.tsx`.
- Extend structured output handling in `src/lib/blocks-to-artifacts.tsx`.
- Add narrow server-side Sandbox operations in `server/index.ts`.
