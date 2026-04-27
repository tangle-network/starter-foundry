// agent-base:scheduler — zero-dep cron expression parser + nextFire
// search. Supports the standard 5-field syntax (minute hour dom mon dow)
// with `*`, `*/N`, `A-B`, `A,B,C`, and the named day/month aliases.
//
// Why zero-dep: third-party cron libraries churn on minor releases and
// pull in unrelated date utilities. The whole feature surface is ~150
// lines of arithmetic — owning it is cheaper than tracking upstream.

import type { CronFields } from './types.js'

const DAY_NAMES = [
  'SUN',
  'MON',
  'TUE',
  'WED',
  'THU',
  'FRI',
  'SAT',
] as const

const MONTH_NAMES = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const

const RANGES = {
  minute: [0, 59] as const,
  hour: [0, 23] as const,
  dayOfMonth: [1, 31] as const,
  month: [1, 12] as const,
  dayOfWeek: [0, 6] as const,
}

function resolveAlias(token: string, kind: 'dayOfWeek' | 'month'): string {
  const upper = token.toUpperCase()
  if (kind === 'dayOfWeek') {
    const idx = DAY_NAMES.indexOf(upper as (typeof DAY_NAMES)[number])
    if (idx >= 0) return String(idx)
  } else {
    const idx = MONTH_NAMES.indexOf(upper as (typeof MONTH_NAMES)[number])
    if (idx >= 0) return String(idx + 1)
  }
  return token
}

function parseField(
  raw: string,
  kind: keyof CronFields,
): number[] {
  if (kind === 'dayOfMonthStar' || kind === 'dayOfWeekStar') {
    throw new Error(`internal: parseField called with non-numeric kind ${kind}`)
  }
  const [min, max] = RANGES[kind]
  // Split comma-separated lists; each element may be `*`, `*/N`, `A`, `A-B`,
  // `A-B/N`, or `*/N`.
  const parts = raw.split(',')
  const out = new Set<number>()
  for (const part of parts) {
    if (part === '') {
      throw new Error(`empty list element in field "${raw}"`)
    }
    let body = part
    let step = 1
    const slashIdx = body.indexOf('/')
    if (slashIdx !== -1) {
      const stepStr = body.slice(slashIdx + 1)
      body = body.slice(0, slashIdx)
      const stepNum = Number(stepStr)
      if (!Number.isInteger(stepNum) || stepNum <= 0) {
        throw new Error(`invalid step "${stepStr}" in field "${raw}"`)
      }
      step = stepNum
    }
    let lo: number
    let hi: number
    if (body === '*') {
      lo = min
      hi = max
    } else if (body.includes('-')) {
      const [a, b] = body.split('-')
      if (a === undefined || b === undefined || a === '' || b === '') {
        throw new Error(`malformed range "${body}" in field "${raw}"`)
      }
      const aResolved = kind === 'dayOfWeek' || kind === 'month' ? resolveAlias(a, kind) : a
      const bResolved = kind === 'dayOfWeek' || kind === 'month' ? resolveAlias(b, kind) : b
      lo = Number(aResolved)
      hi = Number(bResolved)
      if (!Number.isInteger(lo) || !Number.isInteger(hi)) {
        throw new Error(`malformed range "${body}" in field "${raw}"`)
      }
    } else {
      const resolved = kind === 'dayOfWeek' || kind === 'month' ? resolveAlias(body, kind) : body
      const n = Number(resolved)
      if (!Number.isInteger(n)) {
        throw new Error(`non-numeric token "${body}" in field "${raw}"`)
      }
      // For step expressions like `5/10`, the upper bound is the field's max.
      lo = n
      hi = step > 1 ? max : n
    }
    // Cron's `7` for Sunday is the same as `0`.
    if (kind === 'dayOfWeek') {
      if (lo === 7) lo = 0
      if (hi === 7) hi = 0
    }
    if (lo < min || hi > max || lo > hi) {
      throw new Error(`field "${raw}" out of range [${min}, ${max}] (got ${lo}-${hi})`)
    }
    for (let v = lo; v <= hi; v += step) out.add(v)
  }
  return [...out].sort((a, b) => a - b)
}

/**
 * Parse a 5-field cron expression. Throws on any malformed input — never
 * returns a partial CronFields. Public stability: input shape is the
 * documented surface; behavioral changes must be additive.
 */
export function parseCron(expr: string): CronFields {
  const trimmed = expr.trim()
  if (trimmed === '') throw new Error('empty cron expression')
  const fields = trimmed.split(/\s+/)
  if (fields.length !== 6 - 1) {
    throw new Error(`expected 5 fields (minute hour dom mon dow), got ${fields.length}`)
  }
  const [minute, hour, dom, month, dow] = fields as [string, string, string, string, string]
  return {
    minute: parseField(minute, 'minute'),
    hour: parseField(hour, 'hour'),
    dayOfMonth: parseField(dom, 'dayOfMonth'),
    month: parseField(month, 'month'),
    dayOfWeek: parseField(dow, 'dayOfWeek'),
    dayOfMonthStar: dom === '*',
    dayOfWeekStar: dow === '*',
  }
}

/**
 * Compute the next time, strictly after `after`, that matches `fields`.
 *
 * Algorithm: minute-by-minute search bounded at 366 days to terminate
 * even for impossible expressions (e.g. `0 0 31 2 *`). DST is handled by
 * stepping in UTC-equivalent calendar minutes — we increment the local
 * Date by 60_000 ms and re-derive the local fields, so during a DST
 * "spring forward" the skipped local hour is naturally skipped, and
 * during "fall back" the duplicated hour fires only the *first* time
 * (because we strictly advance past the trigger before resuming search).
 *
 * Per POSIX cron semantics: when both DOM and DOW are restricted (no
 * `*`), a day matches if EITHER matches. When one is `*`, only the
 * other applies. This matches Vixie cron / cronie.
 *
 * Throws if no match is found within 366 days — the expression is
 * structurally unreachable (e.g. February 31).
 */
export function nextFire(fields: CronFields, after: Date): Date {
  // Start at the next minute boundary strictly after `after`.
  const t = new Date(after.getTime())
  t.setSeconds(0, 0)
  t.setTime(t.getTime() + 60_000)

  // 366 * 24 * 60 = 527040 minutes — bounded enough to catch leap-year edge.
  const MAX_ITERATIONS = 527_040
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const minute = t.getMinutes()
    const hour = t.getHours()
    const dom = t.getDate()
    const month = t.getMonth() + 1
    const dow = t.getDay()

    if (!fields.month.includes(month)) {
      // Jump to the first day of the next month at 00:00.
      t.setDate(1)
      t.setHours(0, 0, 0, 0)
      t.setMonth(t.getMonth() + 1)
      continue
    }

    const domMatch = fields.dayOfMonth.includes(dom)
    const dowMatch = fields.dayOfWeek.includes(dow)
    let dayOk: boolean
    if (fields.dayOfMonthStar && fields.dayOfWeekStar) dayOk = true
    else if (fields.dayOfMonthStar) dayOk = dowMatch
    else if (fields.dayOfWeekStar) dayOk = domMatch
    else dayOk = domMatch || dowMatch

    if (!dayOk) {
      // Advance to next day at 00:00.
      t.setHours(0, 0, 0, 0)
      t.setDate(t.getDate() + 1)
      continue
    }

    if (!fields.hour.includes(hour)) {
      // Advance to next hour at :00.
      t.setMinutes(0, 0, 0)
      t.setHours(t.getHours() + 1)
      continue
    }

    if (!fields.minute.includes(minute)) {
      // Advance one minute.
      t.setSeconds(0, 0)
      t.setTime(t.getTime() + 60_000)
      continue
    }

    return new Date(t.getTime())
  }
  throw new Error('cron expression does not match within 366 days (structurally unreachable)')
}
