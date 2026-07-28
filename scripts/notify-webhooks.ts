#!/usr/bin/env node
// Notify registered webhook subscribers when the registry changes in
// meaningful ways (new family lands, new capability lands, package
// bumped for CVE). Runs from nightly-measurement or proposal-cron.
//
// Webhooks are stored in .evolve/webhooks.json. Each entry:
//   { "id": "...", "url": "https://...", "events": ["family:added", ...], "secret": "..." }
//
// Signing: HMAC-SHA256(secret, body) sent as X-Starter-Foundry-Signature.
// Receivers should verify before processing.
//
// Usage:
//   node scripts/notify-webhooks.ts --event family:added --ref <family-id>
//   node scripts/notify-webhooks.ts --event capability:added --ref <cap-id>
//   node scripts/notify-webhooks.ts --event cve:bumped --ref <pkg>:<version>

import { createHmac } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WEBHOOKS_PATH = join(REPO, '.evolve/webhooks.json')

const args = process.argv.slice(2)
function arg(k, fb) {
  const i = args.indexOf(k)
  return i >= 0 ? args[i + 1] : fb
}
const event = arg('--event')
const ref = arg('--ref')
const dryRun = args.includes('--dry-run')

if (!event) {
  console.error('usage: notify-webhooks.mjs --event <kind> --ref <id> [--dry-run]')
  process.exit(2)
}

if (!existsSync(WEBHOOKS_PATH)) {
  console.log('no webhooks configured — exiting')
  process.exit(0)
}

const hooks = JSON.parse(readFileSync(WEBHOOKS_PATH, 'utf8')).webhooks ?? []
const subscribed = hooks.filter(
  (h) => (h.events ?? []).includes(event) || (h.events ?? []).includes('*'),
)

console.log(`event=${event} ref=${ref ?? '(none)'} subscribers=${subscribed.length}`)

if (subscribed.length === 0) process.exit(0)

const body = JSON.stringify({
  event,
  ref: ref ?? null,
  timestamp: new Date().toISOString(),
  registryCommit: process.env['GITHUB_SHA'] ?? null,
  message: `Registry event: ${event}${ref ? ` (${ref})` : ''}`,
})

const results = []
for (const h of subscribed) {
  const sig = h.secret ? createHmac('sha256', h.secret).update(body).digest('hex') : null
  if (dryRun) {
    results.push({ id: h.id, url: h.url, status: 'dry-run', sig: sig?.slice(0, 12) })
    continue
  }
  try {
    const res = await fetch(h.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sig ? { 'X-Starter-Foundry-Signature': `sha256=${sig}` } : {}),
        'X-Starter-Foundry-Event': event,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    })
    results.push({ id: h.id, url: h.url, status: res.status })
  } catch (err) {
    results.push({ id: h.id, url: h.url, status: `error: ${err.message}` })
  }
}

for (const r of results) {
  console.log(`  ${r.id}  ${r.url}  →  ${r.status}`)
}
const failCount = results.filter(
  (r) => typeof r.status === 'string' && r.status.startsWith('error'),
).length
process.exit(failCount > 0 ? 1 : 0)
