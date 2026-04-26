// agent-roster.ts — single source of truth for the fleet.
//
// This module declares the static list of agents the dashboard renders. Each
// entry describes ONE agent-runtime bundle that has been (or will be) deployed
// into its own Tangle sandbox. The dashboard at app/page.tsx renders this list
// as a grid of agent cards; app/agents/[id]/page.tsx looks up an entry by id
// and mounts a SandboxWorkbench against that agent's sandbox.
//
// === Wiring sandboxId (operator's job) =====================================
//
// `sandboxId` is intentionally optional. At scaffold time we don't know which
// sandbox each agent will run in — that's a per-deployment decision. Three
// common ways to populate it:
//
//   1. Static config: hard-code the sandboxId after the operator provisions
//      sandboxes by hand (e.g. via the Tangle dashboard or `sandbox` CLI).
//
//   2. Server-side bootstrap: replace `agentRoster` with a server component
//      that calls the Tangle sandbox API on every request, listing the
//      operator's sandboxes and matching them to roster entries by tag /
//      label. Wrap this file's export in a Promise<AgentEntry[]> and adapt
//      the consumers.
//
//   3. Per-agent on-demand: leave sandboxId undefined and lazily provision
//      inside app/agents/[id]/page.tsx the first time the agent is opened.
//      Cache the result in a server-side store (Redis, KV, D1) keyed by
//      AgentEntry.id so subsequent visits reuse the same sandbox.
//
// The dashboard does NOT call the sandbox-sdk's provisioning API directly
// from this module — that would couple build-time scaffolding to runtime
// secrets. Keep secrets server-side; expose only the resolved sandboxId to
// the client.

export interface AgentEntry {
  /** Unique within the app. Used as the route param for /agents/[id]. */
  id: string
  /**
   * The starter-foundry agent-runtime family this agent was scaffolded from.
   * Used for display + as a hint to the orchestrator about which prompt /
   * tool surface the agent expects. Not a runtime dependency.
   */
  family: string
  /** Human-readable name shown in the sidebar + agent card. */
  displayName: string
  /** One-sentence description shown on the agent card. */
  description: string
  /**
   * Resolved Tangle sandbox id once the agent has been provisioned. Undefined
   * means the agent hasn't been wired up yet — the UI should show a
   * 'provision' affordance instead of attempting to connect.
   */
  sandboxId?: string
  /** Emoji or icon identifier for the sidebar / card. */
  icon?: string
}

export const agentRoster: AgentEntry[] = [
  {
    id: 'cmo-advisor',
    family: 'agent-runtime-cmo-advisor-ts',
    displayName: 'CMO Advisor',
    description:
      'Marketing strategist. Drafts campaign briefs, audience segments, and growth experiments grounded in your product context.',
    icon: '📣',
  },
  {
    id: 'recruiter',
    family: 'agent-runtime-recruiter-ts',
    displayName: 'Recruiter',
    description:
      'Sourcing + screening assistant. Builds role specs, screens candidate pipelines, and drafts outreach.',
    icon: '🧭',
  },
  {
    id: 'business-partner',
    family: 'agent-runtime-business-partner-ts',
    displayName: 'Business Partner',
    description:
      'Exec coach + thought partner. Pressure-tests strategy, walks through OKRs, and surfaces blind spots.',
    icon: '🤝',
  },
]

export function findAgent(id: string): AgentEntry | undefined {
  return agentRoster.find((entry) => entry.id === id)
}
