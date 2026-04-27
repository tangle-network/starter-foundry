// Tests for agent-base:scheduler.
//
// Run with: node --test (after tsc) or `tsx --test
// registry/layers/agent-base/scheduler/files/lib/scheduler/index.test.ts`.
//
// Strategy:
// - Real fs for state.json (mkdtemp under tmpdir).
// - Real cron parsing + nextFire — never stubbed.
// - The agent-base:secure schedule registry is exercised live: each test
//   stubs the agent identity envelope so audit-log writes succeed, and
//   registers a no-op handler against the test capability so _fire
//   resolves.

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { nextFire, parseCron } from './cron-parse.js'

function setupSecureEnv(): string {
  // Isolated workspace + audit dir + identity for each test run, so the
  // secure schedule registry's audit writes don't collide.
  const root = mkdtempSync(join(tmpdir(), 'sched-test-'))
  const agentDir = join(root, 'agent-S')
  mkdirSync(join(agentDir, '.audit'), { recursive: true })
  process.env.AGENT_WORKSPACE_ROOT = root
  const now = Date.now()
  process.env.TANGLE_AGENT_IDENTITY_JSON = JSON.stringify({
    agentId: 'agent-S',
    sessionId: `s-${now}`,
    deployerId: 'deployer-S',
    signedAt: now,
    expiresAt: now + 3600_000,
    capabilities: [],
    publicKey: 'k',
    signature: 's',
  })
  process.env.SCHEDULER_STATE_PATH = join(root, 'state.json')
  return root
}

function teardown(root: string): void {
  try {
    rmSync(root, { recursive: true, force: true })
  } catch {
    // best-effort
  }
  delete process.env.SCHEDULER_STATE_PATH
}

// ── parseCron ─────────────────────────────────────────────────────────────

test('parseCron: accepts star, step, list, range, named days', () => {
  const f1 = parseCron('* * * * *')
  assert.equal(f1.minute.length, 60)
  assert.equal(f1.hour.length, 24)

  const f2 = parseCron('*/15 * * * *')
  assert.deepEqual(f2.minute, [0, 15, 30, 45])

  const f3 = parseCron('0,30 9-17 * * *')
  assert.deepEqual(f3.minute, [0, 30])
  assert.deepEqual(f3.hour, [9, 10, 11, 12, 13, 14, 15, 16, 17])

  const f4 = parseCron('0 9 * * MON-FRI')
  assert.deepEqual(f4.dayOfWeek, [1, 2, 3, 4, 5])

  const f5 = parseCron('0 0 1 JAN,JUL *')
  assert.deepEqual(f5.month, [1, 7])

  // Cron's `7` is normalized to `0` (Sunday).
  const f6 = parseCron('0 0 * * 7')
  assert.deepEqual(f6.dayOfWeek, [0])
})

test('parseCron: throws on malformed', () => {
  assert.throws(() => parseCron(''), /empty cron expression/)
  assert.throws(() => parseCron('* * * *'), /expected 5 fields/)
  assert.throws(() => parseCron('60 * * * *'), /out of range/)
  assert.throws(() => parseCron('* 24 * * *'), /out of range/)
  assert.throws(() => parseCron('* * 0 * *'), /out of range/)
  assert.throws(() => parseCron('* * * 13 *'), /out of range/)
  assert.throws(() => parseCron('foo * * * *'), /non-numeric token/)
  assert.throws(() => parseCron('*/0 * * * *'), /invalid step/)
  assert.throws(() => parseCron('5- * * * *'), /malformed range/)
  assert.throws(() => parseCron('5,,10 * * * *'), /empty list element/)
})

// ── nextFire ──────────────────────────────────────────────────────────────

test('nextFire: 0 9 * * 1 — next Monday 09:00', () => {
  const fields = parseCron('0 9 * * 1')
  // Sunday 2026-01-04 12:00 local — next Monday 09:00 is 2026-01-05 09:00.
  const after = new Date(2026, 0, 4, 12, 0, 0, 0)
  const next = nextFire(fields, after)
  assert.equal(next.getDay(), 1, 'should land on Monday')
  assert.equal(next.getHours(), 9)
  assert.equal(next.getMinutes(), 0)
  assert.equal(next.getDate(), 5)
})

test('nextFire: 0 0 * * * — next midnight, strictly after now', () => {
  const fields = parseCron('0 0 * * *')
  // 23:59 local — next match is the upcoming midnight.
  const after = new Date(2026, 5, 15, 23, 59, 0, 0)
  const next = nextFire(fields, after)
  assert.equal(next.getHours(), 0)
  assert.equal(next.getMinutes(), 0)
  assert.equal(next.getDate(), 16)

  // Exactly at midnight — must advance to NEXT day, never re-fire same minute.
  const atMidnight = new Date(2026, 5, 16, 0, 0, 0, 0)
  const after2 = nextFire(fields, atMidnight)
  assert.equal(after2.getDate(), 17)
})

test('nextFire: */15 * * * * — quarter-hour cadence', () => {
  const fields = parseCron('*/15 * * * *')
  const after = new Date(2026, 0, 1, 10, 7, 0, 0)
  const a = nextFire(fields, after)
  assert.equal(a.getMinutes(), 15)
  const b = nextFire(fields, a)
  assert.equal(b.getMinutes(), 30)
})

test('nextFire: 0 0 31 2 * — unreachable expression throws', () => {
  // Feb 31 doesn't exist; with month=2 + dom=31 and dow=*, nothing matches.
  const fields = parseCron('0 0 31 2 *')
  const after = new Date(2026, 0, 1, 0, 0, 0, 0)
  assert.throws(() => nextFire(fields, after), /structurally unreachable/)
})

test('nextFire: DOM and DOW union when both restricted', () => {
  // POSIX cron: when neither DOM nor DOW is `*`, match if EITHER matches.
  // 0 0 1 * 1 → fires on day-1 of every month OR every Monday.
  const fields = parseCron('0 0 1 * 1')
  // Wednesday 2026-04-15 — next match is Mon 2026-04-20 (DOW), not 2026-05-01.
  const after = new Date(2026, 3, 15, 0, 0, 0, 0)
  const next = nextFire(fields, after)
  // Whichever is sooner: Monday Apr 20 vs May 1 → Apr 20.
  assert.equal(next.getMonth(), 3)
  assert.equal(next.getDate(), 20)
  assert.equal(next.getDay(), 1)
})

// ── register / listDue / fireDue ─────────────────────────────────────────

test('register: persists task with computed nextFireAt', async () => {
  const root = setupSecureEnv()
  try {
    const { register, listAll } = await import('./index.js')
    const now = new Date(2026, 0, 4, 12, 0, 0, 0) // Sunday noon
    const stored = await register(
      { id: 'weekly-news', cronExpr: '0 9 * * 1', capability: 'news.compile' },
      now,
    )
    assert.equal(stored.id, 'weekly-news')
    assert.ok(stored.nextFireAt)
    const parsed = new Date(stored.nextFireAt)
    assert.equal(parsed.getDay(), 1) // Monday

    const all = await listAll()
    assert.equal(all.length, 1)
    assert.equal(all[0]?.capability, 'news.compile')
  } finally {
    teardown(root)
  }
})

test('listDue: returns only tasks where nextFireAt <= now', async () => {
  const root = setupSecureEnv()
  try {
    const { register, listDue } = await import('./index.js')
    const past = new Date(2026, 0, 1, 0, 0, 0, 0)
    const future = new Date(2030, 0, 1, 0, 0, 0, 0)
    // Task A: registered against `past` so its nextFireAt is shortly after past.
    await register({ id: 'a', cronExpr: '0 0 * * *', capability: 'cap.a' }, past)
    // Task B: registered against `future` so its nextFireAt is far future.
    await register({ id: 'b', cronExpr: '0 0 * * *', capability: 'cap.b' }, future)

    const due = await listDue(new Date(2026, 0, 5, 12, 0, 0, 0))
    assert.equal(due.length, 1)
    assert.equal(due[0]?.id, 'a')
  } finally {
    teardown(root)
  }
})

test('fireDue: dispatches to schedule._fire and advances nextFireAt', async () => {
  const root = setupSecureEnv()
  try {
    const { schedule } = await import('../secure/schedule.js')
    const calls: string[] = []
    schedule.on('news.compile', async (trigger) => {
      calls.push(trigger.id)
    })

    const { register, fireDue, listAll } = await import('./index.js')
    const past = new Date(2026, 0, 1, 0, 0, 0, 0)
    await register({ id: 'weekly-news', cronExpr: '0 9 * * 1', capability: 'news.compile' }, past)

    const now = new Date(2026, 0, 5, 9, 0, 0, 0) // Mon 09:00 — at-or-after nextFireAt
    const results = await fireDue(now)
    assert.equal(results.length, 1)
    assert.equal(results[0]?.ok, true)
    assert.deepEqual(calls, ['weekly-news'])

    const all = await listAll()
    const stored = all.find((t) => t.id === 'weekly-news')
    assert.ok(stored)
    assert.equal(stored.lastFiredAt, now.toISOString())
    // nextFireAt must be strictly after `now`.
    assert.ok(new Date(stored.nextFireAt).getTime() > now.getTime())
    // And it must be the *next* Monday 09:00.
    const nextDate = new Date(stored.nextFireAt)
    assert.equal(nextDate.getDay(), 1)
    assert.equal(nextDate.getDate(), 12)
  } finally {
    teardown(root)
  }
})

test('fireDue: failure in one task does not block others', async () => {
  const root = setupSecureEnv()
  try {
    const { schedule } = await import('../secure/schedule.js')
    const calls: string[] = []
    schedule.on('cap.bad', async () => {
      throw new Error('synthetic dispatcher failure')
    })
    schedule.on('cap.good', async (trigger) => {
      calls.push(trigger.id)
    })

    const { register, fireDue, listAll } = await import('./index.js')
    const past = new Date(2026, 0, 1, 0, 0, 0, 0)
    await register({ id: 'task-bad', cronExpr: '* * * * *', capability: 'cap.bad' }, past)
    await register({ id: 'task-good', cronExpr: '* * * * *', capability: 'cap.good' }, past)

    const now = new Date(2026, 0, 5, 12, 0, 0, 0)
    const results = await fireDue(now)
    assert.equal(results.length, 2)
    const bad = results.find((r) => r.id === 'task-bad')
    const good = results.find((r) => r.id === 'task-good')
    assert.equal(bad?.ok, false)
    assert.match(bad?.error ?? '', /synthetic dispatcher failure/)
    assert.equal(good?.ok, true)
    assert.deepEqual(calls, ['task-good'])

    // Both tasks advance nextFireAt past `now` even though one failed —
    // operators triage via audit log; we don't tight-loop on broken caps.
    const all = await listAll()
    for (const t of all) {
      assert.ok(new Date(t.nextFireAt).getTime() > now.getTime(), `${t.id} should advance`)
    }
    // Only the successful task records lastFiredAt.
    assert.equal(all.find((t) => t.id === 'task-good')?.lastFiredAt, now.toISOString())
    assert.equal(all.find((t) => t.id === 'task-bad')?.lastFiredAt, undefined)
  } finally {
    teardown(root)
  }
})

test('register: re-registering same id overwrites cron, preserves lastFiredAt', async () => {
  const root = setupSecureEnv()
  try {
    const { register, listAll } = await import('./index.js')
    const now = new Date(2026, 0, 1, 0, 0, 0, 0)
    await register({ id: 't1', cronExpr: '0 9 * * 1', capability: 'cap.x', lastFiredAt: '2025-12-25T00:00:00.000Z' }, now)
    // Re-register without lastFiredAt — must inherit from prior row.
    await register({ id: 't1', cronExpr: '0 17 * * 5', capability: 'cap.x' }, now)

    const all = await listAll()
    assert.equal(all.length, 1)
    assert.equal(all[0]?.cronExpr, '0 17 * * 5')
    assert.equal(all[0]?.lastFiredAt, '2025-12-25T00:00:00.000Z')
  } finally {
    teardown(root)
  }
})

test('unregister: removes task; idempotent', async () => {
  const root = setupSecureEnv()
  try {
    const { register, unregister, listAll } = await import('./index.js')
    await register({ id: 't1', cronExpr: '* * * * *', capability: 'cap.x' })
    assert.equal((await listAll()).length, 1)
    assert.equal(await unregister('t1'), true)
    assert.equal((await listAll()).length, 0)
    assert.equal(await unregister('t1'), false)
  } finally {
    teardown(root)
  }
})
