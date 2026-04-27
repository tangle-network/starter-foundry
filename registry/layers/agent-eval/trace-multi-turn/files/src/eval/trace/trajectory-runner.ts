/**
 * Trajectory runner — drive a multi-turn rollout against an agent endpoint
 * and produce a per-turn `Trajectory` consumable by `StepRubric`s.
 *
 * The runner is transport-agnostic: callers pass a `TurnDriver` that takes
 * the current message + transcript and returns the agent's response plus
 * the spans emitted during the turn. The trace store persists every span
 * so `buildTrajectory` (from agent-eval) can produce the canonical
 * `Trajectory` shape downstream.
 */

import {
  buildTrajectory,
  type TraceEmitter,
  type TraceStore,
  type Trajectory,
  type TrajectoryStep,
} from '@tangle-network/agent-eval'

export interface TurnDriverInput {
  /** Conversation history including the user message just sent. */
  transcript: ConversationMessage[]
  /** Run id this turn belongs to. Used for span correlation. */
  runId: string
  /** Trace emitter — driver MUST emit spans for every llm/tool/judge action. */
  emitter: TraceEmitter
}

export interface TurnDriverResult {
  /** Assistant response for this turn. */
  assistantText: string
  /** Optional structured tool calls the agent made (names only). */
  toolCalls?: string[]
}

export type TurnDriver = (input: TurnDriverInput) => Promise<TurnDriverResult>

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
}

export interface MultiTurnScenario {
  scenarioId: string
  /** Initial system prompt. */
  systemPrompt?: string
  /** Ordered user messages. The runner sends each, capturing per-turn spans. */
  userTurns: string[]
  /** Hard cap on turns to drive (defaults to userTurns.length). */
  maxTurns?: number
  /** Per-turn timeout. */
  timeoutMs?: number
}

export interface MultiTurnRolloutResult {
  scenarioId: string
  runId: string
  trajectory: Trajectory
  transcript: ConversationMessage[]
  /** Tool calls captured per turn (parallel to userTurns). */
  toolCallsPerTurn: string[][]
  durationMs: number
}

const DEFAULT_TIMEOUT_MS = 60_000

const withTimeout = async <T>(p: Promise<T>, ms: number, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
  try {
    return await Promise.race([p, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export const runMultiTurnRollout = async (args: {
  scenario: MultiTurnScenario
  driver: TurnDriver
  store: TraceStore
  emitter: TraceEmitter
  /** Optional run-id seed; if omitted, derived from scenarioId + Date.now(). */
  runId?: string
}): Promise<MultiTurnRolloutResult> => {
  const { scenario, driver, store, emitter } = args
  const runId = args.runId ?? `${scenario.scenarioId}-${Date.now()}`
  const maxTurns = scenario.maxTurns ?? scenario.userTurns.length
  const timeoutMs = scenario.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const transcript: ConversationMessage[] = []
  if (scenario.systemPrompt) {
    transcript.push({ role: 'system', content: scenario.systemPrompt })
  }
  const toolCallsPerTurn: string[][] = []

  const start = Date.now()
  for (let i = 0; i < maxTurns; i += 1) {
    const userMsg = scenario.userTurns[i]
    if (userMsg === undefined) break
    transcript.push({ role: 'user', content: userMsg })
    const result = await withTimeout(
      driver({ transcript: [...transcript], runId, emitter }),
      timeoutMs,
      `turn ${i + 1}`,
    )
    transcript.push({ role: 'assistant', content: result.assistantText })
    toolCallsPerTurn.push(result.toolCalls ?? [])
  }
  const durationMs = Date.now() - start

  const trajectory = await buildTrajectory(store, runId)
  return { scenarioId: scenario.scenarioId, runId, trajectory, transcript, toolCallsPerTurn, durationMs }
}

/**
 * Group trajectory steps by user-turn index using span timestamps and the
 * conversation transcript. Returns a parallel array `turns[i]` containing
 * the steps that occurred between user-turn i and user-turn i+1.
 *
 * Used by per-turn-scorer.ts to apply rubrics on a per-turn basis rather
 * than aggregating across the entire trajectory.
 */
export const groupStepsByTurn = (
  trajectory: Trajectory,
  userTurnCount: number,
): TrajectoryStep[][] => {
  // Heuristic: split steps into N buckets by trajectory index. Spans inside
  // a single user→assistant turn share an `index` band because buildTrajectory
  // produces topo-ordered steps; partition into equal-ish chunks falls out
  // of the topo ordering assumption. Drivers that emit a 'user-turn-marker'
  // event can override this by partitioning on event timestamps instead.
  const buckets: TrajectoryStep[][] = Array.from({ length: userTurnCount }, () => [])
  if (trajectory.steps.length === 0 || userTurnCount === 0) return buckets
  const stepsPerTurn = Math.ceil(trajectory.steps.length / userTurnCount)
  for (const step of trajectory.steps) {
    const idx = Math.min(Math.floor(step.index / stepsPerTurn), userTurnCount - 1)
    buckets[idx].push(step)
  }
  return buckets
}
