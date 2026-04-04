// Types

export interface AgentConfig {
  id: string
  name: string
  capabilities: string[]
  maxConcurrent: number
}

export interface AgentResult {
  agentId: string
  taskId: string
  status: 'success' | 'failure' | 'partial'
  output: unknown
  durationMs: number
  error?: string
}

export interface SupervisorState {
  agents: AgentConfig[]
  pendingTasks: string[]
  activeTasks: Map<string, string>
  completedResults: AgentResult[]
}

interface RouteDecision {
  agentId: string
  agentName: string
  confidence: number
  reason: string
}

interface AggregatedResult {
  status: 'success' | 'partial' | 'failure'
  outputs: unknown[]
  conflicts: string[]
  summary: string
  successRate: number
}

// Implementation

export function createSupervisor(agents: AgentConfig[]): SupervisorState {
  return {
    agents: [...agents],
    pendingTasks: [],
    activeTasks: new Map(),
    completedResults: [],
  }
}

export function routeTask(task: string, agents: AgentConfig[]): RouteDecision {
  if (agents.length === 0) {
    throw new Error('No agents available for routing')
  }

  const taskWords = task.toLowerCase().split(/\s+/)

  const scored = agents.map((agent) => {
    const capWords = agent.capabilities.flatMap((c) => c.toLowerCase().split(/[\s-_]+/))
    const nameWords = agent.name.toLowerCase().split(/[\s-_]+/)
    const allAgentWords = new Set([...capWords, ...nameWords])

    // Score by word overlap between task description and agent capabilities
    let score = 0
    for (const word of taskWords) {
      if (word.length <= 2) continue
      if (allAgentWords.has(word)) score += 2

      // Partial match: check if any capability word contains the task word
      for (const aw of allAgentWords) {
        if (aw.includes(word) || word.includes(aw)) {
          score += 1
          break
        }
      }
    }

    return { agent, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]
  const maxPossible = taskWords.filter((w) => w.length > 2).length * 2

  return {
    agentId: best.agent.id,
    agentName: best.agent.name,
    confidence: maxPossible > 0 ? Math.min(best.score / maxPossible, 1) : 0,
    reason: best.score > 0
      ? `Matched capabilities: ${best.agent.capabilities.join(', ')}`
      : `Default fallback to ${best.agent.name} (no keyword match)`,
  }
}

export function aggregateResults(results: AgentResult[]): AggregatedResult {
  if (results.length === 0) {
    return {
      status: 'failure',
      outputs: [],
      conflicts: [],
      summary: 'No results to aggregate',
      successRate: 0,
    }
  }

  const successes = results.filter((r) => r.status === 'success')
  const failures = results.filter((r) => r.status === 'failure')
  const partials = results.filter((r) => r.status === 'partial')

  const successRate = successes.length / results.length

  // Detect conflicts: multiple agents producing different outputs for overlapping work
  const conflicts: string[] = []
  const outputsByTask = new Map<string, AgentResult[]>()
  for (const result of results) {
    const existing = outputsByTask.get(result.taskId) ?? []
    existing.push(result)
    outputsByTask.set(result.taskId, existing)
  }

  for (const [taskId, taskResults] of outputsByTask) {
    if (taskResults.length > 1) {
      const outputs = taskResults.map((r) => JSON.stringify(r.output))
      const unique = new Set(outputs)
      if (unique.size > 1) {
        conflicts.push(`Task ${taskId}: ${taskResults.length} agents produced ${unique.size} different outputs`)
      }
    }
  }

  let status: AggregatedResult['status'] = 'success'
  if (failures.length === results.length) status = 'failure'
  else if (failures.length > 0 || partials.length > 0 || conflicts.length > 0) status = 'partial'

  const parts: string[] = [
    `${results.length} task(s) completed`,
    `${successes.length} succeeded`,
  ]
  if (failures.length > 0) parts.push(`${failures.length} failed`)
  if (partials.length > 0) parts.push(`${partials.length} partial`)
  if (conflicts.length > 0) parts.push(`${conflicts.length} conflict(s) detected`)

  const avgDuration = results.reduce((s, r) => s + r.durationMs, 0) / results.length
  parts.push(`avg duration: ${Math.round(avgDuration)}ms`)

  return {
    status,
    outputs: successes.map((r) => r.output),
    conflicts,
    summary: parts.join(', '),
    successRate,
  }
}
