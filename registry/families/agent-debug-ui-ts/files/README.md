# {{projectName}}: agent-debug-ui-ts

A Vite + React + TypeScript scaffold for **live debugging of agent runs** in
a Tangle sandbox. Connects through the browser-safe runtime and session clients in
[`@tangle-network/sandbox`](https://www.npmjs.com/package/@tangle-network/sandbox),
replays missed WebSocket events after a reconnect, and renders four
synchronized views over the event log.

This is a **debugger**, not an agent. The agent runs inside the sandbox; this
UI watches it work.

## Views

| Pane | Shows |
| --- | --- |
| **Chat pair** | Your prompt + the streamed assistant response. Reasoning is collapsed by default. Locks when the `result` event fires. |
| **Event stream** | Tail of the last 50 raw SSE events — `message.part.updated`, `status`, `model-processing`, `result`, `trace.id`, `error`. Color-coded by type. Click a row to inspect. |
| **Tool-call timeline** | Every tool part folded into a horizontal duration bar. Click a tool to jump to its first event in the inspector. |
| **Event inspector** | Full JSON payload of any selected event or tool call. Long strings are truncated at 4 KB. |

A **replay scrubber** at the bottom lets you pause the live stream and drag
through the event log frame-by-frame for forensic review.

## Setup

```bash
cp .env.example .env
# Set VITE_SANDBOX_SESSION_URL to your backend route.
pnpm install
pnpm dev   # http://localhost:4180
```

The backend route must authenticate the user and return fresh credentials in this shape:

```json
{
  "sandboxId": "sbx_...",
  "gatewayUrl": "wss://api.example.com/session",
  "gatewayToken": "eyJ...",
  "browserSessionId": "browser-session-id",
  "runtimeUrl": "https://runtime-proxy.example.com",
  "runtimeToken": "eyJ...",
  "runtimeSessionId": "runtime-session-id",
  "expiresAt": 1785264000
}
```

Mint `gatewayToken` with `box.mintScopedToken({ scope: 'session', sessionId: browserSessionId, runtimeSessionId })`.
Mint `runtimeToken` with `box.mintScopedToken({ scope: 'session-runtime', sessionId: runtimeSessionId })`.
The full Sandbox API key must remain on the backend.

You need an existing sandbox with an agent runtime resident.
To create one:

```bash
pnpm dlx @tangle-network/sandbox create --product <product-id>
```

Once the sandbox is running, open the debugger, type a prompt, and select **Run**.
Events stream in real time and replay after transient disconnects.

## Event contract

The debugger consumes the documented sandbox agent event types:

- `message.part.updated` — streaming chunks (text / reasoning / tool parts)
- `status` — lifecycle (`generating_response`, `processing`, `completed`, `failed`)
- `model-processing` — phase + elapsed (`thinking`, `generating`, `tool-result`)
- `result` — final text + token usage
- `trace.id` — debug trace identifier
- `error` — execution failure

Streaming `delta` chunks are accumulated into part text by
`src/lib/sandbox-stream.ts` before reaching components — the rest of the app
only ever sees cumulative snapshots.

The SDK `SessionGatewayClient` owns reconnect, deduplication, and replay.

## Extending

- `src/lib/sandbox-stream.ts`: session bootstrap, command dispatch, reconnect, and normalization
- `src/components/ToolCallTimeline.tsx`: already aggregates by
  `toolCallId`; replace `aggregateToolCalls` to add cost/latency overlays.
- `src/lib/event-types.ts`: extend `SandboxEvent` if your runtime emits
  custom event types (the inspector already falls through to raw JSON).

## What this is NOT

- **Completed-run analysis**: see the sister `agent-eval-ui-ts` family for
  scoring + judge integration over completed runs.
- **A marketplace or discovery surface**: see `agent-marketplace-ui-ts`.
- **An agent runtime**: this only debugs agents that already run in a
  sandbox. Pair with any `agent-runtime-*-ts` family.
