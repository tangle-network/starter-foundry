# {{projectName}}

React workspace UI for browsing, editing, and running commands in one Tangle sandbox.
The browser talks only to this app's `/api` routes.
The Node server owns the Sandbox SDK and operator key.

## Quickstart

```sh
cp .env.example .env
pnpm install
pnpm dev
```

Vite runs on `http://localhost:{{port}}` and proxies `/api` to the local Node server on port `8787`.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `TANGLE_SANDBOX_API_KEY` | yes | Operator key read only by `server/index.ts` |
| `TANGLE_SANDBOX_ID` | yes | Existing sandbox to open |
| `TANGLE_SANDBOX_BASE_URL` | no | Sandbox API root; defaults to `{{sandboxApiUrl}}` |
| `HOST` | no | API bind host; defaults to `127.0.0.1` |
| `API_PORT` | no | Local API port; defaults to `8787` |
| `VITE_APP_KIND` | no | Browser-safe view mode: `editor`, `audit-tool`, `repl`, or `file-browser` |

The server binds to loopback by default.
Add application authentication before setting `HOST=0.0.0.0`.
Never rename the operator key to a `VITE_*` variable because Vite embeds those values in browser assets.

## Architecture

- `src/App.tsx` renders the workspace.
- `src/lib/sandbox-client.ts` calls same-origin file and command routes.
- `server/index.ts` reads secrets, uses `@tangle-network/sandbox`, and serves the built app.
- `pnpm build` typechecks browser, build-tool, and server code, then emits `dist/` and `server-dist/`.

`pnpm start` serves the production build.

## Extension Points

- Add workspace modes in `src/App.tsx`.
- Add narrow Sandbox operations in `server/index.ts`, then expose typed client methods in `src/lib/sandbox-client.ts`.
- Keep credentials and unrestricted SDK objects on the server.
