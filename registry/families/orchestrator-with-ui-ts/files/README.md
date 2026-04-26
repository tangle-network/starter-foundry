# {{appName}} — Agent Fleet

Multi-agent dashboard scaffold. The app surface is a Next.js App Router app
that renders a fleet of agents in a rail sidebar, opens per-agent chat tabs,
and embeds `SandboxWorkbench` from `@tangle-network/sandbox-ui` for the live
chat + artifact view. Each agent runs in its own Tangle sandbox; this UI
talks to N sandboxes in parallel.

## What this scaffold gives you

- Fleet landing page (`app/page.tsx`) — rail of agent cards, plus
  `BillingDashboard` + `UsageChart` panes from `@tangle-network/sandbox-ui/dashboard`
- Per-agent chat surface (`app/agents/[id]/page.tsx`) — `SandboxWorkbench`
  driven by one `useSdkSession()` instance per agent
- Output-block adapter (`lib/parse-blocks.ts` + `lib/blocks-to-artifacts.tsx`,
  composed in by the `ui-adapter:blocks-renderer` layer) — converts
  `:::artifact`, `:::escalation`, `:::screener-result`, `:::audio-cue`,
  `:::suggestion` blocks emitted by your agent-runtime bundles into
  `SandboxWorkbenchArtifact[]` for the artifact pane

## The roster is the source of truth

Every agent the dashboard knows about is declared in `lib/agent-roster.ts`
as an `AgentEntry`:

```ts
export interface AgentEntry {
  id: string             // unique within the app, used as the route param
  family: string         // the agent-runtime starter-foundry family
  displayName: string
  description: string
  sandboxId?: string     // populated at runtime once the sandbox is provisioned
  icon?: string
}
```

To add an agent: append a new entry. To remove one: delete the entry. The
sidebar, agent cards, and `/agents/[id]` route all derive from this list.

`sandboxId` is intentionally optional. Three ways to populate it (see
`lib/agent-roster.ts` for the full breakdown):

1. **Static config** — hard-code after provisioning sandboxes via the Tangle
   dashboard or `sandbox` CLI.
2. **Server-side bootstrap** — replace the static export with a server
   component that lists your sandboxes and matches by tag.
3. **Per-agent on-demand** — leave undefined and lazily provision inside
   `app/agents/[id]/page.tsx`, caching by `AgentEntry.id`.

## Session lifecycle

**Each visit to `/agents/[id]` starts a fresh session.** `useSdkSession()` is
mounted inside the route component, and the App Router unmounts the component
when the user navigates away. This is deliberate:

- zero coupling — no global registry to debug
- cheap memory — idle agents in the sidebar consume nothing
- obvious semantics — leaving a tab clears its conversation

If you want sessions to persist across navigation (so a half-finished chat
with the CMO Advisor is still there when you click back from the Recruiter),
**lift the sessions into a context provider in `app/layout.tsx`**: keep one
`useSdkSession()` per `AgentEntry` keyed by `id`, expose them via context,
and have the per-agent page read from the context instead of calling
`useSdkSession()` directly. The `SandboxWorkbench` props don't change.

For server-side persistence (resume across page reloads / devices), call the
sandbox-sdk's session-history endpoint on mount and feed it through
`session.replaceHistory(seeds)`.

## The orchestrator pattern

Each agent in the roster is a separately-deployed agent-runtime bundle running
in its own Tangle sandbox. The dashboard:

1. Lists all agents from `agent-roster.ts`
2. On selection, opens a route that mounts a `SandboxWorkbench` for that
   agent's sandbox
3. The workbench drives a `useSdkSession()` instance — chat input flows out
   to the sandbox, SDK events stream back in
4. The `:::output-block` parser converts agent-runtime output blocks into
   `SandboxWorkbenchArtifact[]` rendered in the artifact pane

The dashboard is transport-agnostic: this scaffold ships a stub `onSend` that
echoes back. You wire the real transport — Tangle sandbox-sdk client, custom
HTTP, websockets — wherever fits your deployment.

## Required env

| Var                  | Purpose                                            |
| -------------------- | -------------------------------------------------- |
| `SANDBOX_API_URL`    | Tangle sandbox API base (default `https://api.tangle.tools`) |
| `SANDBOX_API_TOKEN`  | Bearer token for sandbox provisioning + session calls       |

Per-agent overrides (e.g. distinct tokens or backends per agent) belong on
the `AgentEntry` itself — extend the type in `lib/agent-roster.ts` and read
the overrides in `app/agents/[id]/page.tsx`.

## When to use this

| If you have…                                | Use…                          |
| ------------------------------------------- | ----------------------------- |
| One agent, one chat surface                 | `agent-with-ui-ts` (simpler)  |
| N agents, fleet dashboard, per-agent chat   | **this** (`orchestrator-with-ui-ts`) |
| A sandbox app with no agent on top          | `sandbox-app-ts`              |

## Composition example

```
orchestrator-with-ui-ts
  + agent-runtime-cmo-advisor-ts
  + agent-runtime-recruiter-ts
  + agent-runtime-business-partner-ts
= a fleet management UI for marketing / recruiting / exec coaching
```

Each agent-runtime bundle compiles to its own deployable; this scaffold is the
operator-facing dashboard that talks to all three.

## Commands

```bash
pnpm install
pnpm dev      # next dev on port {{port}}
pnpm build    # next build
pnpm start    # next start (production server)
pnpm typecheck
```

## Extension points

- `lib/agent-roster.ts` — add / remove agents
- `app/agents/[id]/page.tsx` — wire real `onSend` transport, customize the
  workbench layout
- `lib/blocks-to-artifacts.tsx` — register custom block kinds via
  `registerBlockMapper(...)` if your bundles emit domain-specific blocks
- `app/layout.tsx` — lift sessions into a provider for cross-route persistence
