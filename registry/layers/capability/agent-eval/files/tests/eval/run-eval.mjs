#!/usr/bin/env node
// Eval runner built on @tangle-network/agent-eval primitives.
//
// Lifecycle:
//   1. Spawn the agent via `pnpm start` (or --no-spawn to use one already up).
//   2. Wait for /health.
//   3. For each scenarios.json entry, build a TestGradedScenario whose
//      HarnessConfig.testCommand is a curl-based shell assertion that exits 0
//      on a pass and non-zero on a fail.
//   4. Delegate each scenario to `runTestGradedScenario` from
//      @tangle-network/agent-eval — it spawns the testCommand via
//      SubprocessSandboxDriver, emits a Run through TraceEmitter, and stores
//      it in the InMemoryTraceStore for later aggregation.
//   5. After all scenarios, read runs out of the store, write a scorecard
//      to .evolve/eval/latest.json + a timestamped copy, and exit with a
//      non-zero code when the weighted aggregate falls below --threshold.
//
// Every primitive used here comes from the published package; if you want
// richer grading (LLM judge, BenchmarkRunner, ConvergenceTracker, etc.)
// import more of its surface — this file is intentionally a thin shell
// around the library.
//
// Usage:
//   node tests/eval/run-eval.mjs
//   node tests/eval/run-eval.mjs --no-spawn --base http://localhost:3000
//   node tests/eval/run-eval.mjs --threshold 0.8

import { spawn } from 'node:child_process'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  InMemoryTraceStore,
  SubprocessSandboxDriver,
  runTestGradedScenario,
} from '@tangle-network/agent-eval'

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

function shQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`
}

// Translate a scenarios.json entry into a shell command that exits 0 on
// assertion-pass and non-zero on fail. Keeping the assertion shape small and
// inspectable so users can edit scenarios.json without touching this file.
function buildTestCommand(scenario, baseUrl) {
  const path = scenario.path ?? '/'
  const url = `${baseUrl}${path}`
  const checks = []
  const expect = scenario.assert ?? {}
  const curlBase = scenario.kind === 'http-post'
    ? `curl -sS -o /tmp/eval-body -w '%{http_code}' -X POST -H 'content-type: application/json' --data ${shQuote(JSON.stringify(scenario.body ?? {}))} ${shQuote(url)}`
    : `curl -sS -o /tmp/eval-body -w '%{http_code}' ${shQuote(url)}`
  checks.push(`status=$(${curlBase})`)
  if (expect.status !== undefined) {
    checks.push(`test "$status" = "${expect.status}" || { echo "status $status != ${expect.status}"; exit 1; }`)
  }
  if (Array.isArray(expect.statusIn)) {
    const pattern = expect.statusIn.map((s) => `"$status" = "${s}"`).join(' -o ')
    checks.push(`test ${pattern} || { echo "status $status not in ${expect.statusIn.join(',')}"; exit 1; }`)
  }
  if (expect.requireJson) {
    checks.push(`jq -e . /tmp/eval-body > /dev/null || { echo "response not JSON"; exit 1; }`)
  }
  if (expect.jsonShape) {
    for (const [key, types] of Object.entries(expect.jsonShape)) {
      const typesArr = Array.isArray(types) ? types : [types]
      const typeChecks = typesArr.map((t) => {
        if (t === 'null') return `(. == null)`
        if (t === 'undefined') return `(has(${shQuote(key)}) | not)`
        if (t === 'array') return `(type == "array")`
        return `(type == ${shQuote(t)})`
      }).join(' or ')
      checks.push(
        `jq -e ${shQuote(`.${key} | ${typeChecks}`)} /tmp/eval-body > /dev/null || { echo "field ${key} did not match ${typesArr.join('|')}"; exit 1; }`,
      )
    }
  }
  if (expect.minResponseChars !== undefined) {
    checks.push(`test $(wc -c < /tmp/eval-body) -ge ${expect.minResponseChars} || { echo "response too short"; exit 1; }`)
  }
  return checks.join(' && ') + ' && echo "ok"'
}

async function runAgentSubprocess() {
  const [cmd, ...args] = START_CMD.split(' ')
  const env = { ...process.env, PORT: String(PORT) }
  const child = spawn(cmd, args, { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] })
  let stderr = ''
  child.stderr.on('data', (d) => { stderr += String(d) })
  return { child, getStderr: () => stderr }
}

async function main() {
  const { scenarios } = await loadScenarios()
  let agentProc = null
  try {
    if (!NO_SPAWN) {
      agentProc = await runAgentSubprocess()
      const ready = await waitForReady(BASE)
      if (!ready) {
        console.error(`[run-eval] agent did not respond on ${BASE} within 30s`)
        console.error(agentProc.getStderr().slice(-1200))
        process.exit(2)
      }
    }

    const store = new InMemoryTraceStore()
    const driver = new SubprocessSandboxDriver({ cwd: ROOT })
    const results = []
    for (const s of scenarios) {
      const testCommand = buildTestCommand(s, BASE)
      const scenario = {
        id: s.id,
        description: s.description,
        harness: {
          testCommand,
          cwd: ROOT,
          timeoutMs: s.timeoutMs ?? 15_000,
        },
        tags: { weight: String(s.weight ?? 1) },
      }
      const res = await runTestGradedScenario(scenario, store, { driver })
      results.push({
        id: s.id,
        description: s.description ?? null,
        passed: res.pass,
        score: res.score,
        failureClass: res.failureClass,
        weight: s.weight ?? 1,
        exitCode: res.harness.test?.exitCode ?? null,
        stderr: (res.harness.test?.stderr ?? '').slice(-400),
        runId: res.runId,
      })
      const mark = res.pass ? '✓' : '✗'
      const reason = res.pass
        ? 'ok'
        : (res.harness.test?.stdout?.trim() || res.harness.test?.stderr?.trim() || res.failureClass || 'fail')
      console.log(`  ${mark} ${s.id} — ${reason}`)
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
      tracedRuns: (await store.listRuns?.()) ?? results.map((r) => r.runId),
    }

    const outDir = resolve(ROOT, '.evolve/eval')
    if (!existsSync(outDir)) await mkdir(outDir, { recursive: true })
    await writeFile(resolve(outDir, 'latest.json'), JSON.stringify(scorecard, null, 2))
    await writeFile(
      resolve(outDir, `${scorecard.timestamp.replace(/[:.]/g, '-')}.json`),
      JSON.stringify(scorecard, null, 2),
    )
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
