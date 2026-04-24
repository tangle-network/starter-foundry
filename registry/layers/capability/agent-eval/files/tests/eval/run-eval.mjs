#!/usr/bin/env node
// Eval runner: spawns the agent, POSTs each scenario, scores responses,
// writes a scorecard to .evolve/eval/latest.json. Exit code is non-zero
// when aggregate score falls below the threshold — usable as a CI gate.
//
// Reads: tests/eval/scenarios.json, tests/eval/judge.mjs
// Writes: .evolve/eval/latest.json, .evolve/eval/<ts>.json
//
// Usage:
//   node tests/eval/run-eval.mjs                 # run, fail on regression
//   node tests/eval/run-eval.mjs --no-spawn      # agent already running at --base
//   node tests/eval/run-eval.mjs --base http://localhost:3000
//   node tests/eval/run-eval.mjs --threshold 0.8
//
// Env:
//   EVAL_PORT         — port to spawn the agent on (default 3100)
//   EVAL_START_CMD    — command to start the agent (default `pnpm start`)
//   TOGETHER_API_KEY  — if set, LLM judge augments deterministic scoring
//   ANTHROPIC_API_KEY — same, fallback provider

import { spawn } from 'node:child_process'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const argv = process.argv.slice(2)
const arg = (flag, fallback) => {
  const i = argv.indexOf(flag)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
}
const NO_SPAWN = argv.includes('--no-spawn')
const PORT = Number(process.env.EVAL_PORT ?? '3100')
const BASE = arg('--base', `http://127.0.0.1:${PORT}`)
const THRESHOLD = Number(arg('--threshold', process.env.EVAL_THRESHOLD ?? '0.7'))
const START_CMD = process.env.EVAL_START_CMD ?? 'pnpm start'

async function loadScenarios() {
  const raw = await readFile(resolve(ROOT, 'tests/eval/scenarios.json'), 'utf8')
  return JSON.parse(raw)
}

async function loadJudge() {
  const mod = await import(resolve(ROOT, 'tests/eval/judge.mjs'))
  return mod.default ?? mod
}

async function waitForReady(baseUrl, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(1500) })
      if (res.ok) return true
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

async function runAgentSubprocess() {
  const [cmd, ...args] = START_CMD.split(' ')
  const env = { ...process.env, PORT: String(PORT) }
  const child = spawn(cmd, args, { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] })
  let stdout = '', stderr = ''
  child.stdout.on('data', (d) => { stdout += String(d) })
  child.stderr.on('data', (d) => { stderr += String(d) })
  return { child, getStdout: () => stdout, getStderr: () => stderr }
}

function typeMatches(value, allowed) {
  if (!Array.isArray(allowed)) return typeof value === allowed
  return allowed.some((t) => {
    if (t === 'null') return value === null
    if (t === 'array') return Array.isArray(value)
    if (t === 'undefined') return value === undefined
    return typeof value === t
  })
}

function checkJsonShape(body, shape) {
  if (!shape) return { ok: true }
  for (const [key, types] of Object.entries(shape)) {
    if (!typeMatches(body?.[key], types)) {
      return { ok: false, reason: `field '${key}' did not match ${JSON.stringify(types)}` }
    }
  }
  return { ok: true }
}

async function runHttpScenario(scenario, baseUrl) {
  const path = scenario.path ?? '/'
  const method = scenario.kind === 'http-post' ? 'POST' : 'GET'
  const init = { method, signal: AbortSignal.timeout(scenario.timeoutMs ?? 15_000) }
  if (method === 'POST') {
    init.headers = { 'content-type': 'application/json' }
    init.body = JSON.stringify(scenario.body ?? {})
  }
  let res
  try {
    res = await fetch(`${baseUrl}${path}`, init)
  } catch (err) {
    if (scenario.fallbackPath) {
      try { res = await fetch(`${baseUrl}${scenario.fallbackPath}`, init) } catch {}
    }
    if (!res) return { failed: true, error: String(err.message ?? err) }
  }
  let body = null
  const text = await res.text()
  try { body = JSON.parse(text) } catch { body = text }
  return { status: res.status, body, text }
}

function scoreScenario(scenario, result) {
  if (result.failed) return { passed: false, score: 0, reason: result.error }
  const assertToCheck = (result.status >= 200 && result.status < 300) || !scenario.fallbackAssert
    ? scenario.assert
    : scenario.fallbackAssert
  const issues = []
  if (assertToCheck?.status !== undefined && result.status !== assertToCheck.status) {
    issues.push(`status ${result.status} != ${assertToCheck.status}`)
  }
  if (assertToCheck?.statusIn && !assertToCheck.statusIn.includes(result.status)) {
    issues.push(`status ${result.status} not in ${JSON.stringify(assertToCheck.statusIn)}`)
  }
  if (assertToCheck?.requireJson && (typeof result.body !== 'object' || result.body === null)) {
    issues.push('response was not JSON')
  }
  const shapeCheck = checkJsonShape(result.body, assertToCheck?.jsonShape)
  if (!shapeCheck.ok) issues.push(shapeCheck.reason)
  if (assertToCheck?.minResponseChars !== undefined) {
    const bodyChars = typeof result.body === 'string'
      ? result.body.length
      : JSON.stringify(result.body ?? '').length
    if (bodyChars < assertToCheck.minResponseChars) {
      issues.push(`response too short: ${bodyChars} < ${assertToCheck.minResponseChars}`)
    }
  }
  return { passed: issues.length === 0, score: issues.length === 0 ? 1 : 0, reason: issues.join('; ') || 'ok' }
}

async function main() {
  const { scenarios } = await loadScenarios()
  const judge = await loadJudge()
  let agentProc = null
  try {
    if (!NO_SPAWN) {
      agentProc = await runAgentSubprocess()
      const ready = await waitForReady(BASE)
      if (!ready) {
        console.error(`[run-eval] agent did not respond within timeout on ${BASE}`)
        console.error(agentProc.getStderr().slice(-1000))
        process.exit(2)
      }
    }
    const results = []
    for (const s of scenarios) {
      const httpResult = await runHttpScenario(s, BASE)
      const deterministic = scoreScenario(s, httpResult)
      let llmScore = null
      if (typeof judge.scoreLlm === 'function') {
        try {
          llmScore = await judge.scoreLlm(s, httpResult)
        } catch (err) {
          llmScore = { score: null, reason: `judge-error: ${err.message ?? err}` }
        }
      }
      const weight = s.weight ?? 1
      results.push({
        id: s.id,
        description: s.description,
        passed: deterministic.passed,
        score: deterministic.score,
        reason: deterministic.reason,
        llm: llmScore,
        weight,
        httpStatus: httpResult.status ?? null,
      })
      const mark = deterministic.passed ? '✓' : '✗'
      console.log(`  ${mark} ${s.id} — ${deterministic.reason}`)
    }
    const totalWeight = results.reduce((a, r) => a + r.weight, 0) || 1
    const weighted = results.reduce((a, r) => a + r.score * r.weight, 0)
    const aggregate = weighted / totalWeight
    const scorecard = {
      timestamp: new Date().toISOString(),
      baseUrl: BASE,
      aggregate,
      passCount: results.filter((r) => r.passed).length,
      totalCount: results.length,
      threshold: THRESHOLD,
      results,
    }
    const outDir = resolve(ROOT, '.evolve/eval')
    if (!existsSync(outDir)) await mkdir(outDir, { recursive: true })
    await writeFile(resolve(outDir, 'latest.json'), JSON.stringify(scorecard, null, 2))
    await writeFile(resolve(outDir, `${scorecard.timestamp.replace(/[:.]/g, '-')}.json`), JSON.stringify(scorecard, null, 2))
    console.log(`\naggregate=${aggregate.toFixed(3)} pass=${scorecard.passCount}/${scorecard.totalCount} threshold=${THRESHOLD}`)
    process.exitCode = aggregate < THRESHOLD ? 1 : 0
  } finally {
    if (agentProc?.child && !agentProc.child.killed) {
      try { agentProc.child.kill('SIGTERM') } catch {}
    }
  }
}

main().catch((err) => {
  console.error('[run-eval] fatal:', err)
  process.exit(2)
})
