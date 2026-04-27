# my-agent — agent-with-ui-ts

A React + Vite + TypeScript scaffold for a **single-agent UI**: an operator-facing
chat surface plus artifact pane that talks to one `agent-runtime-*` bundle running
in a Tangle sandbox.

This bundle is the "single agent with UI" archetype. It composes:

- `@tangle-network/sandbox-ui` — `SandboxWorkbench` layout, `ChatContainer`,
  `useSdkSession` event reducer.
- `@tangle-network/sandbox-sdk` — your transport to the sandbox running the
  agent-runtime bundle.
- `ui-adapter:blocks-renderer` (auto-composed) — parses `:::artifact`,
  `:::escalation`, `:::screener-result`, `:::audio-cue`, `:::suggestion`,
  `:::proposal`, `:::filing`, `:::survey` fenced blocks out of agent text and
  maps them onto `SandboxWorkbenchArtifact[]` for the artifact pane.

## Compose with an agent-runtime bundle

This UI is bundle-agnostic. Pair it with any of the existing agent-runtime
families to ship a complete product:

| Pair | Result |
| --- | --- |
| `agent-with-ui-ts` + `agent-runtime-cmo-advisor-ts` | CMO advisor with chat UI |
| `agent-with-ui-ts` + `agent-runtime-tax-ts` | Tax assistant with filing artifacts |
| `agent-with-ui-ts` + `agent-runtime-therapist-ts` | Therapy companion with screener-result pane |
| `agent-with-ui-ts` + `agent-runtime-research` | Research agent with artifact pane |

Eight agent-runtime bundles ship today — `business-partner`, `cmo-advisor`,
`fitness-coach`, `language-tutor`, `legal-counsel`, `music-producer`,
`novelist-coach`, `real-estate`, `recruiter`, `research`, `tax`, `therapist`,
`wealth-manager`. Pick one, deploy its worker, then point this UI at it via
the invoker seam below.

## How the `:::output-block` parser works

Whenever the agent emits text containing fenced blocks like:

```
:::artifact title="Q3 Positioning Canvas"
# Positioning
...
:::
```

the scaffold parses it (via `src/lib/parse-blocks.ts`) and maps it onto a
`SandboxWorkbenchArtifact` (via `src/lib/blocks-to-artifacts.tsx`), which the
workbench renders in its artifact pane automatically. No per-bundle UI glue.

The adapter is rebuilt on every assistant part update, so the artifact pane
streams in tandem with the chat surface.

## Required env vars

```bash
VITE_AGENT_NAME='my-agent'              # display name in the title bar
VITE_SANDBOX_API_URL='https://api.tangle.tools'     # tangle sandbox API root
VITE_SANDBOX_API_TOKEN='sk-tan-...'          # operator key, scoped to this agent's product
```

## Wiring the agent invoker (the one piece you write)

`App.tsx` accepts an `invoker: AgentInvoker` prop. The scaffold itself ships
no transport — you wire it once based on which agent-runtime bundle you're
driving. Minimum implementation against `@tangle-network/sandbox-sdk`:

```tsx
// src/main.tsx
import { connectSandbox } from '@tangle-network/sandbox-sdk'

const sandbox = await connectSandbox({
  baseUrl: import.meta.env.VITE_SANDBOX_API_URL!,
  token: import.meta.env.VITE_SANDBOX_API_TOKEN!,
})

const invoker = {
  async invoke({ userText, onEvent, signal }) {
    // TODO: replace with the exact sandbox-sdk method exposed by your
    // agent-runtime bundle's worker. For the canonical agent-runtime
    // shape (POST /api/chat returning an SSE stream of SdkSessionEvent),
    // call `sandbox.session.stream({ message: userText, signal })` and
    // forward each event into `onEvent`.
    for await (const event of sandbox.session.stream({ message: userText, signal })) {
      onEvent(event)
    }
  },
}

createRoot(container).render(<App invoker={invoker} />)
```

## Extension points

- `src/App.tsx` — layout, header, status surface, invoker prop.
- `src/lib/blocks-to-artifacts.tsx` — `registerBlockMapper(kind, mapper)` to
  add bundle-specific block kinds (e.g. `:::positioning-canvas`) without
  forking the layer.

## What's NOT in scope

- **Multi-agent dashboard** (running several agents side-by-side, routing
  between them, shared artifact streams) → use `orchestrator-with-ui-ts`.
- **Non-agent workspace** (file editor, terminal-only, no chat surface) →
  use `sandbox-app-ts`.
- **The agent-runtime worker itself** — that's a separate bundle. This scaffold
  only ships the operator-facing UI.
