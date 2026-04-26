// schedule — declarative scheduled triggers driven by the manifest's
// defaults.schedule[] array. Each trigger executes with the agent's
// signed identity. Replaces wrangler.toml [triggers] cron config.
//
// Bundles do not write cron handlers directly; they declare schedules
// in the manifest and implement the matching capability. The runtime
// dispatches to the capability at trigger time.

import { audit } from './audit.js'
import { identity } from './identity.js'

export interface ScheduledTrigger {
  /** Stable id, matched against capability dispatcher. */
  id: string
  /** Standard 5-field cron expression (minute hour day month dayOfWeek). */
  cron: string
  /** Capability name from manifest.defaults.declaredCapabilities. */
  capability: string
  /** When true, runtime guarantees at-least-once delivery on operator
   * restart; otherwise best-effort. */
  atLeastOnce?: boolean
}

const handlers = new Map<string, (trigger: ScheduledTrigger) => Promise<void>>()

export const schedule = {
  /** Register a capability handler. The runtime calls this on trigger
   * fire. The handler's identity is the agent's current identity. */
  on(capability: string, handler: (trigger: ScheduledTrigger) => Promise<void>): void {
    if (handlers.has(capability)) {
      throw new Error(`schedule handler already registered for capability: ${capability}`)
    }
    handlers.set(capability, handler)
    audit.log({ event: 'schedule.handler-register', target: capability })
  },

  /** Runtime entry point — invoked by the trigger dispatcher when a
   * cron fires. Bundles do NOT call this directly. */
  async _fire(trigger: ScheduledTrigger): Promise<void> {
    const handler = handlers.get(trigger.capability)
    if (!handler) {
      audit.log({ event: 'schedule.miss', target: trigger.id, payload: { capability: trigger.capability, reason: 'no-handler-registered' } })
      throw new Error(`no schedule handler for capability ${trigger.capability}`)
    }
    const id = identity.current()
    audit.log({ event: 'schedule.fire', target: trigger.id, payload: { capability: trigger.capability, agentId: id.agentId } })
    try {
      await handler(trigger)
      audit.log({ event: 'schedule.complete', target: trigger.id, payload: { capability: trigger.capability } })
    } catch (err) {
      audit.log({ event: 'schedule.error', target: trigger.id, payload: { capability: trigger.capability, error: (err as Error).message.slice(0, 200) } })
      throw err
    }
  },

  /** Validate a cron expression at registration time (before runtime
   * accepts the manifest). Returns null on success, error string on
   * failure. The runtime's own cron parser may be stricter. */
  validateCron(cron: string): null | string {
    const fields = cron.trim().split(/\s+/)
    if (fields.length !== 5) return `expected 5 fields (m h dom mon dow), got ${fields.length}`
    const ranges = [
      [0, 59], // minute
      [0, 23], // hour
      [1, 31], // day-of-month
      [1, 12], // month
      [0, 7],  // day-of-week (7 == 0 == Sunday)
    ]
    for (let i = 0; i < 5; i++) {
      const f = fields[i]!
      if (f === '*') continue
      // Allow simple comma-separated lists, ranges, steps.
      if (!/^(\*|\*\/\d+|\d+(-\d+)?(,\d+(-\d+)?)*(\/\d+)?)$/.test(f)) {
        return `field ${i} (${f}) does not match cron syntax`
      }
      const numbers = f.match(/\d+/g)?.map(Number) ?? []
      for (const n of numbers) {
        if (n < ranges[i]![0] || n > ranges[i]![1]) return `field ${i} value ${n} out of range [${ranges[i]![0]}, ${ranges[i]![1]}]`
      }
    }
    return null
  },
}
