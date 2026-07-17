// agent-base:scheduler — type definitions for the in-sandbox cron
// dispatcher. The dispatcher fires capabilities registered with the
// agent-base:secure schedule registry; the registry owns identity +
// audit, this layer owns *when* to fire.

/** Persisted scheduled task. State lives at SCHEDULER_STATE_PATH. */
export interface ScheduledTask {
  /** Stable identifier; matches a row in the persisted state map. */
  id: string
  /** 5-field cron expression: minute hour dayOfMonth month dayOfWeek. */
  cronExpr: string
  /** Capability name registered with agent-base:secure schedule registry. */
  capability: string
  /** ISO timestamp of the most recent successful fire, or undefined. */
  lastFiredAt?: string
  /** ISO timestamp of the next scheduled fire (computed from cronExpr). */
  nextFireAt: string
  /** Optional payload merged into the dispatched ScheduledTrigger. */
  payload?: Record<string, unknown>
}

/** Parsed cron expression — every field expanded to its concrete value list. */
export interface CronFields {
  /** 0-59 */
  minute: number[]
  /** 0-23 */
  hour: number[]
  /** 1-31 */
  dayOfMonth: number[]
  /** 1-12 */
  month: number[]
  /** 0-6, where 0 = Sunday. (Cron's `7` is normalized to `0`.) */
  dayOfWeek: number[]
  /** True if the expression had `*` for dayOfMonth (affects DOW/DOM matching). */
  dayOfMonthStar: boolean
  /** True if the expression had `*` for dayOfWeek. */
  dayOfWeekStar: boolean
}

/** Persisted scheduler state on disk. */
export interface SchedulerState {
  tasks: Record<string, ScheduledTask>
}
