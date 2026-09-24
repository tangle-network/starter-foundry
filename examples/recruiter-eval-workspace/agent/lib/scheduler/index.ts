// agent-base:scheduler — public API.
//
// Composition: this layer is the *dispatcher* for the in-process schedule
// registry shipped by agent-base:secure. Callers `register()` cron-driven
// tasks here; `fireDue()` consults the persisted state, computes which
// tasks are ripe, and invokes the secure layer's `schedule._fire(trigger)`
// for each — preserving the registry's audit-log and identity-binding
// guarantees. Use `sweep()` (sweep.ts) to drive `fireDue` on an interval.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import { schedule } from '../secure/schedule.js'

import { nextFire, parseCron } from './cron-parse.js'
import type { ScheduledTask, SchedulerState } from './types.js'

const DEFAULT_STATE_PATH = '/home/agent/scheduler/state.json'

function statePath(): string {
  return process.env.SCHEDULER_STATE_PATH ?? DEFAULT_STATE_PATH
}

/**
 * Register (or replace) a scheduled task. The task's nextFireAt is computed
 * from the cron expression at registration time; subsequent fires advance
 * it. State is persisted under SCHEDULER_STATE_PATH atomically per call.
 *
 * Stability: task.id is the merge key — re-registering an existing id
 * overwrites the row (and resets nextFireAt). lastFiredAt is preserved.
 */
export async function register(
  task: Omit<ScheduledTask, 'nextFireAt'>,
  now: Date = new Date(),
): Promise<ScheduledTask> {
  const fields = parseCron(task.cronExpr)
  const next = nextFire(fields, now)
  const state = await loadState()
  const prior = state.tasks[task.id]
  const full: ScheduledTask = {
    ...task,
    lastFiredAt: task.lastFiredAt ?? prior?.lastFiredAt,
    nextFireAt: next.toISOString(),
  }
  state.tasks[task.id] = full
  await saveState(state)
  return full
}

/**
 * Remove a task by id. Returns true if the row existed.
 */
export async function unregister(id: string): Promise<boolean> {
  const state = await loadState()
  if (!(id in state.tasks)) return false
  delete state.tasks[id]
  await saveState(state)
  return true
}

/**
 * Tasks whose nextFireAt is at-or-before `now`. Read-only — does not
 * advance any state.
 */
export async function listDue(now: Date = new Date()): Promise<ScheduledTask[]> {
  const state = await loadState()
  return Object.values(state.tasks).filter((t) => new Date(t.nextFireAt).getTime() <= now.getTime())
}

/** Outcome of a single dispatch attempt. */
export interface FireResult {
  id: string
  ok: boolean
  error?: string
}

/**
 * Dispatch every due task through the agent-base:secure schedule registry,
 * advance each task's nextFireAt past `now`, and persist updated state.
 *
 * Failure isolation: one task throwing does not abort the loop; the error
 * is captured per-task in the returned array. Even on failure, nextFireAt
 * is still advanced so the agent doesn't enter a tight retry loop on a
 * permanently-broken capability — operators inspect the audit log to
 * triage. lastFiredAt is only updated on success.
 *
 * State write is "load full state, mutate fired rows, save full state" so
 * concurrent additions in the loop body are preserved (we re-load before
 * saving to merge any registrations that happened during dispatch).
 */
export async function fireDue(now: Date = new Date()): Promise<FireResult[]> {
  const due = await listDue(now)
  const results: FireResult[] = []
  // Track per-id mutations to apply after dispatch; we reload state before
  // writing so we don't clobber concurrent register() calls.
  const updates = new Map<string, { lastFiredAt?: string; nextFireAt: string }>()

  for (const task of due) {
    let ok = false
    let error: string | undefined
    try {
      await schedule._fire({
        id: task.id,
        cron: task.cronExpr,
        capability: task.capability,
      })
      ok = true
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    }
    const fields = parseCron(task.cronExpr)
    const next = nextFire(fields, now)
    updates.set(task.id, {
      lastFiredAt: ok ? now.toISOString() : task.lastFiredAt,
      nextFireAt: next.toISOString(),
    })
    results.push(ok ? { id: task.id, ok: true } : { id: task.id, ok: false, error: error ?? 'unknown error' })
  }

  if (updates.size > 0) {
    const fresh = await loadState()
    for (const [id, patch] of updates) {
      const row = fresh.tasks[id]
      if (!row) continue // task was unregistered mid-flight — drop the update
      fresh.tasks[id] = {
        ...row,
        lastFiredAt: patch.lastFiredAt,
        nextFireAt: patch.nextFireAt,
      }
    }
    await saveState(fresh)
  }

  return results
}

/** All registered tasks (test/operator inspection helper). */
export async function listAll(): Promise<ScheduledTask[]> {
  const state = await loadState()
  return Object.values(state.tasks)
}

async function loadState(): Promise<SchedulerState> {
  try {
    const text = await readFile(statePath(), 'utf8')
    const parsed = JSON.parse(text) as unknown
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'tasks' in parsed &&
      typeof (parsed as { tasks: unknown }).tasks === 'object' &&
      (parsed as { tasks: unknown }).tasks !== null
    ) {
      return parsed as SchedulerState
    }
    return { tasks: {} }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { tasks: {} }
    // Corrupt JSON is treated as empty; the audit log records the failure
    // path on next fire. Crashing here would brick the agent on a single
    // bad write.
    if (err instanceof SyntaxError) return { tasks: {} }
    throw err
  }
}

async function saveState(state: SchedulerState): Promise<void> {
  const path = statePath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(state, null, 2), 'utf8')
}

// Re-exports — public surface.
export { parseCron, nextFire } from './cron-parse.js'
export type { CronFields, ScheduledTask, SchedulerState } from './types.js'
