# {{projectName}}

Live debugger for one agent running in a Tangle sandbox.
The React app receives newline-delimited events from `/api/prompt`.
Only the Node server imports the Sandbox SDK or reads the operator key.

## Quickstart

```sh
cp .env.example .env
pnpm install
pnpm dev
```

Open `http://localhost:4180`.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `TANGLE_SANDBOX_API_KEY` | yes | Operator key read only by `server/index.ts` |
| `TANGLE_SANDBOX_ID` | yes | Existing sandbox to inspect |
| `TANGLE_SANDBOX_BASE_URL` | no | Sandbox API root; defaults to `https://api.tangle.tools` |
| `HOST` | no | API bind host; defaults to `127.0.0.1` |
| `API_PORT` | no | Local API port; defaults to `8787` |

The server binds to loopback by default.
Add application authentication before setting `HOST=0.0.0.0`.
Do not put operator keys in `VITE_*` variables because Vite embeds them in browser assets.

## Architecture

- `src/App.tsx` owns run, stop, replay, and selection state.
- `src/lib/sandbox-stream.ts` parses the same-origin event stream and normalizes frames.
- `server/index.ts` reads secrets and calls `Sandbox.streamPrompt()`.
- `src/components/` renders chat, tools, raw events, and replay state.

`pnpm build` checks browser, build-tool, and server code and emits `dist/` plus `server-dist/`.
`pnpm start` serves the built UI and API.

## Extension Points

- Add event shapes in `src/lib/event-types.ts`.
- Add visualizations under `src/components/`.
- Add server-side Sandbox operations in `server/index.ts`.
