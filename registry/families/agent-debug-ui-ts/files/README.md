# {{projectName}} — agent-debug-ui-ts

A Vite + React + TypeScript scaffold for **live debugging of agent runs** in
a Tangle sandbox. Connects to a running sandbox via
[`@tangle-network/sandbox`](https://www.npmjs.com/package/@tangle-network/sandbox),
streams every SSE event from `streamPrompt()`, and renders four
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
# Fill in:
#   VITE_TANGLE_SANDBOX_API_KEY   sk-tan-... operator-scoped
#   VITE_TANGLE_SANDBOX_BASE_URL  https://api.tangle.tools
#   VITE_SANDBOX_ID               sbx_... (must already exist)
pnpm install
pnpm dev   # http://localhost:4180
```

You need an existing sandbox with an agent runtime resident. To spin one up:

```bash
pnpm dlx @tangle-network/sandbox create --product <product-id>
```

Once the sandbox is running, open the debugger, type a prompt, hit **Run**.
SSE events stream in real time.

## SSE event contract

The debugger consumes the documented sandbox SSE event types:

- `message.part.updated` — streaming chunks (text / reasoning / tool parts)
- `status` — lifecycle (`generating_response`, `processing`, `completed`, `failed`)
- `model-processing` — phase + elapsed (`thinking`, `generating`, `tool-result`)
- `result` — final text + token usage
- `trace.id` — debug trace identifier
- `error` — execution failure

Streaming `delta` chunks are accumulated into part text by
`src/lib/sandbox-stream.ts` before reaching components — the rest of the app
only ever sees cumulative snapshots.

Source contract: see the
[Sandbox SDK INTEGRATION notes](https://github.com/tangle-network/agent-dev-container/blob/main/products/sandbox/sdk/INTEGRATION.md#sse-event-contract).

## Extending

- `src/lib/sandbox-stream.ts` — add transports beyond `streamPrompt()`
  (e.g. websocket bridges, replay-from-disk for postmortems).
- `src/components/ToolCallTimeline.tsx` — already aggregates by
  `toolCallId`; replace `aggregateToolCalls` to add cost/latency overlays.
- `src/lib/event-types.ts` — extend `SandboxEvent` if your runtime emits
  custom event types (the inspector already falls through to raw JSON).

## What this is NOT

- **Forensic replay UI** — see the sister `agent-eval-ui-ts` family for
  scoring + judge integration over completed runs.
- **A marketplace / discovery surface** — see `agent-marketplace-ui-ts`.
- **An agent runtime** — this only debugs agents that already run in a
  sandbox. Pair with any `agent-runtime-*-ts` family.
