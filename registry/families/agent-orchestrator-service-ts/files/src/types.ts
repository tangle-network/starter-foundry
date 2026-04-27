// Public types for the orchestrator surface. The agent-loader returns a
// discriminated union — every downstream caller MUST switch on `kind` so the
// single-vs-team distinction stays explicit instead of leaking into "is this
// the only role?" guesswork.

export interface AgentRole {
  /** Role id, unique within the team. Used in routing decisions. */
  id: string
  /** Path (absolute) to the role's system-prompt.md. Loaded lazily. */
  systemPromptPath: string
  /** Optional one-line role description, surfaced in /agents and used as
   *  context when the LLM router picks a role. */
  description?: string
  /** Model override for this role. Falls back to the orchestrator default. */
  model?: string
}

export interface SingleAgentPack {
  kind: 'single'
  /** Pack id (== directory name under AGENT_PACK_DIR). */
  id: string
  /** The single role; same shape as a team role for downstream uniformity. */
  role: AgentRole
}

export interface TeamAgentPack {
  kind: 'team'
  id: string
  /** All roles available in this team. */
  roles: AgentRole[]
  /** If set, /chat to this team always invokes this role and skips the
   *  routing LLM call. Use when routing is deterministic (e.g. a Slack
   *  bot that always wants the "default-respondent" persona). */
  defaultRespondent?: string
  /** Optional team-level description shown in /agents. */
  description?: string
}

export type AgentPack = SingleAgentPack | TeamAgentPack

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface RouterDecision {
  pack: AgentPack
  /** The role id chosen for this turn. For SingleAgentPack this is always
   *  the only role. For TeamAgentPack this is either `defaultRespondent`
   *  or the LLM-routing pick. */
  roleId: string
  /** How the routing decision was made — for audit + debugging. */
  reason: 'single-agent' | 'team-default-respondent' | 'team-llm-routed'
}

export interface ChatBridgeOptions {
  systemPrompt: string
  messages: ChatMessage[]
  model: string
  stream?: boolean
  temperature?: number
}
