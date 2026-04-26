// Planner / routing types — what selectStarter and planPrompt return,
// how callers interpret confidence and risk.

import type { ComposeSpec, WorkspaceSpec } from './compose.js'

export type Complexity = 'simple' | 'medium' | 'complex' | 'mostly-complex'
export type Confidence = 'high' | 'medium' | 'low' | 'unknown'

/**
 * RoutingRisk surfaces *why* a selection is risky so callers (BA, auto-loop)
 * can choose to retry / disambiguate / refuse. `safe` means the prompt
 * matched a family by score >0. `fallback-product` means score=0 but the
 * prompt looked like a natural-language product description, so the planner
 * defaulted to `fullstack-ts`. `fallback-static` means score=0 and we picked
 * `frontend-static` (the historical default — most likely wrong for technical
 * identifiers). `unrouteable` means score=0, prompt looks like a technical
 * identifier (kebab-case noun cluster), and SF refuses to silently degrade —
 * the caller MUST disambiguate.
 */
export type RoutingRisk = 'safe' | 'fallback-product' | 'fallback-static' | 'unrouteable'

export interface CorpusExpected {
  kind: 'starter' | 'workspace'
  family?: string
  slots?: Record<string, string>
  primaryProjectId?: string
  projectIds?: string[]
  projectFamilies?: Record<string, string>
}

export interface CorpusScenario {
  id: string
  complexity: Complexity
  partner: string | null
  prompt: string
  expected?: CorpusExpected
}

export interface SelectionResult {
  confidence: Confidence
  spec: ComposeSpec
  fallbackUsed: boolean
  reasons: string[]
  /**
   * Categorical signal for fallback paths. `safe` = score>0 match.
   * `fallback-*` = score=0 with reason. `unrouteable` = score=0 AND prompt
   * is a technical identifier (kebab-case clusters of nouns) — caller MUST
   * disambiguate; SF refuses to silently degrade to `frontend-static`.
   */
  routingRisk: RoutingRisk
}

export interface StarterPromptPlan {
  kind: 'starter'
  confidence: Confidence
  reasons: string[]
  spec: ComposeSpec
  /** Opaque product brief object attached when planPrompt was called with brief: true. */
  brief?: unknown
}

export interface WorkspacePromptPlan {
  kind: 'workspace'
  confidence: Confidence
  reasons: string[]
  spec: WorkspaceSpec
  /** Opaque product brief object attached when planPrompt was called with brief: true. */
  brief?: unknown
}

export type PromptPlan = StarterPromptPlan | WorkspacePromptPlan
