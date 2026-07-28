import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  InMemoryRawProviderSink,
  InMemoryTraceStore,
  TraceEmitter,
  assertRunCaptured,
  type ChatClient,
  type JudgeScore,
  type TraceStore,
} from '@tangle-network/agent-eval'
import type { RawProviderSink } from '@tangle-network/agent-eval/traces'
import { tsImport } from 'tsx/esm/api'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')
const EVAL_ROOT = join(REPO, 'examples/recruiter-eval-workspace/eval')

interface WeightedJudgeScore extends JudgeScore {
  status?: 'measured' | 'unmeasured'
  weight?: number
}

interface JudgePolicyModule {
  judgeAppliesTo(
    declaredDimensions: readonly string[],
    scenarioDimensions: readonly string[],
  ): boolean
  aggregateJudgeScores(scores: readonly WeightedJudgeScore[]): {
    mean: number | null
    measuredCount: number
    unmeasuredCount: number
    measuredJudgeCount: number
    unmeasuredJudgeCount: number
  }
}

interface JudgeClientModule {
  createJudgeClient(options: {
    apiKey?: string
    baseUrl?: string
    provider?: string
    maximumAttempts?: number
    fetch?: typeof fetch
    rawSink?: RawProviderSink
    traceStore: TraceStore
    runId: string
  }): ChatClient
}

async function runnerModule(): Promise<{
  runHarness: (options: Record<string, unknown>) => Promise<any>
  exitCodeForReport: (report: any) => 0 | 1
}> {
  return (await tsImport(
    pathToFileURL(join(EVAL_ROOT, 'src/eval/runner.ts')).href,
    import.meta.url,
  )) as any
}

test('judge policy requires applicability metadata, honors weights, and preserves unmeasured', async () => {
  const policy = (await import(
    pathToFileURL(join(EVAL_ROOT, 'src/eval/judge-policy.ts')).href
  )) as JudgePolicyModule

  assert.equal(policy.judgeAppliesTo(['quality'], ['quality']), true)
  assert.equal(policy.judgeAppliesTo(['quality'], ['safety']), false)
  assert.throws(() => policy.judgeAppliesTo([], ['quality']), /at least one declared dimension/)

  const measured = policy.aggregateJudgeScores([
    {
      judgeName: 'rubric',
      dimension: 'coverage',
      score: 0,
      reasoning: 'low',
      weight: 1,
    },
    {
      judgeName: 'rubric',
      dimension: 'safety',
      score: 1,
      reasoning: 'high',
      weight: 3,
    },
    {
      judgeName: 'shape',
      dimension: 'shape',
      score: 0.5,
      reasoning: 'partial',
    },
  ])
  assert.equal(measured.mean, 0.625)
  assert.equal(measured.measuredJudgeCount, 2)

  const incomplete = policy.aggregateJudgeScores([
    ...[
      {
        judgeName: 'shape',
        dimension: 'shape',
        score: 1,
        reasoning: 'measured',
      },
    ],
    {
      judgeName: 'rubric',
      dimension: 'quality',
      score: Number.NaN,
      reasoning: 'provider unavailable',
      status: 'unmeasured',
    },
  ])
  assert.equal(incomplete.mean, null)
  assert.equal(incomplete.unmeasuredCount, 1)
  assert.equal(incomplete.unmeasuredJudgeCount, 1)
  assert.throws(
    () =>
      policy.aggregateJudgeScores([
        {
          judgeName: 'bad',
          dimension: 'quality',
          score: 1.1,
          reasoning: 'invalid',
        },
      ]),
    /invalid score/,
  )
})

test('runner executes every turn with one stable session and complete history', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'sf-eval-multi-turn-'))
  const requests: Array<{
    conversationId: string
    sessionId: string
    turnIndex: number
    message: string
    messages: Array<{ role: string; content: string }>
  }> = []
  const server = createServer((request, response) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk: string) => {
      body += chunk
    })
    request.on('end', () => {
      const parsed = JSON.parse(body) as (typeof requests)[number]
      requests.push(parsed)
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ content: `assistant-${parsed.turnIndex}` }))
    })
  })
  await new Promise<void>((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolvePromise)
  })

  try {
    mkdirSync(join(tmp, 'scenarios'), { recursive: true })
    mkdirSync(join(tmp, 'judges'), { recursive: true })
    writeFileSync(join(tmp, 'package.json'), '{"type":"module"}\n')
    writeFileSync(
      join(tmp, 'scenarios/multi.scenario.js'),
      `export default {
  id: 'runner/multi-turn',
  persona: 'test',
  label: 'Three ordered turns',
  thesis: 'All declared turns execute with preceding context.',
  dimensions: ['multi-turn'],
  turns: [
    { user: 'first', expectedBehaviors: ['reply'] },
    { user: 'second', expectedBehaviors: ['reply'] },
    { user: 'third', expectedBehaviors: ['reply'] }
  ],
  artifactChecks: []
}\n`,
    )
    writeFileSync(
      join(tmp, 'judges/multi.judge.js'),
      `export const dimensions = ['multi-turn']
export const usesModel = false
export default async function judge(_chat, input) {
  const transcript = input.turns.map((turn) => turn.agentResponse).join(',')
  return [{
    judgeName: 'multi-turn',
    dimension: 'multi-turn',
    score: transcript === 'assistant-0,assistant-1,assistant-2' ? 1 : 0,
    reasoning: transcript
  }]
}\n`,
    )
    const { exitCodeForReport, runHarness } = await runnerModule()
    const address = server.address() as AddressInfo
    const report = await runHarness({
      projectRoot: EVAL_ROOT,
      scenariosDir: join(tmp, 'scenarios'),
      judgesDir: join(tmp, 'judges'),
      targetUrl: `http://127.0.0.1:${address.port}`,
      threshold: 0.7,
      integrityMode: 'strict',
      tracesDir: join(tmp, 'traces'),
      experimentsDir: join(tmp, 'experiments'),
      rawEventsDir: join(tmp, 'raw-events'),
      scorecardPath: join(tmp, 'scorecard.json'),
    })

    assert.equal(report.aggregate, 1)
    assert.equal(report.outcomes[0]?.pass, true)
    assert.equal(exitCodeForReport(report), 0)
    assert.deepEqual(
      requests.map(({ turnIndex, message, messages }) => ({
        turnIndex,
        message,
        messageCount: messages.length,
      })),
      [
        { turnIndex: 0, message: 'first', messageCount: 1 },
        { turnIndex: 1, message: 'second', messageCount: 3 },
        { turnIndex: 2, message: 'third', messageCount: 5 },
      ],
    )
    assert.equal(new Set(requests.map((request) => request.conversationId)).size, 1)
    assert.ok(requests.every((request) => request.sessionId === request.conversationId))
    assert.deepEqual(requests[2]?.messages, [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'assistant-0' },
      { role: 'user', content: 'second' },
      { role: 'assistant', content: 'assistant-1' },
      { role: 'user', content: 'third' },
    ])
  } finally {
    await new Promise<void>((resolvePromise, reject) => {
      server.close((error) => (error ? reject(error) : resolvePromise()))
    })
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('runner preserves judge failures as unmeasured and exits nonzero', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'sf-eval-judge-error-'))
  try {
    mkdirSync(join(tmp, 'scenarios'), { recursive: true })
    mkdirSync(join(tmp, 'judges'), { recursive: true })
    writeFileSync(join(tmp, 'package.json'), '{"type":"module"}\n')
    writeFileSync(
      join(tmp, 'scenarios/error.scenario.js'),
      `export default {
  id: 'runner/judge-error',
  persona: 'test',
  label: 'Judge error',
  thesis: 'An applicable judge error must fail the scenario.',
  dimensions: ['quality'],
  turns: [{ user: 'question', expectedBehaviors: ['answer'] }],
  artifactChecks: [],
  testCommand: "printf 'answer'"
}\n`,
    )
    writeFileSync(
      join(tmp, 'judges/error.judge.js'),
      `export const dimensions = ['quality']
export const usesModel = false
export default async function judge() { throw new Error('judge unavailable') }\n`,
    )
    const { exitCodeForReport, runHarness } = await runnerModule()
    const report = await runHarness({
      projectRoot: EVAL_ROOT,
      scenariosDir: join(tmp, 'scenarios'),
      judgesDir: join(tmp, 'judges'),
      threshold: 0.7,
      integrityMode: 'strict',
      tracesDir: join(tmp, 'traces'),
      experimentsDir: join(tmp, 'experiments'),
      rawEventsDir: join(tmp, 'raw-events'),
      scorecardPath: join(tmp, 'scorecard.json'),
    })

    assert.equal(report.aggregate, null)
    assert.equal(report.unmeasuredScenarioCount, 1)
    assert.equal(report.outcomes[0]?.score, null)
    assert.equal(report.outcomes[0]?.failureClass, 'judge_error')
    assert.equal(exitCodeForReport(report), 1)
    for (const failureClass of [
      'harness_error',
      'turn_capture_error',
      'judge_error',
      'judge_unmeasured',
      'integrity',
    ]) {
      assert.equal(
        exitCodeForReport({
          ...report,
          aggregate: 1,
          measuredScenarioCount: 1,
          unmeasuredScenarioCount: 0,
          outcomes: [{ ...report.outcomes[0], score: 1, failureClass }],
        }),
        1,
      )
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('judge client links raw events to its LLM span and redacts the API key', async () => {
  const { createJudgeClient } = (await import(
    pathToFileURL(join(EVAL_ROOT, 'src/eval/judge-client.ts')).href
  )) as JudgeClientModule
  const runId = 'judge-capture'
  const apiKey = 'secret-key-that-must-not-persist'
  const traceStore = new InMemoryTraceStore()
  const rawSink = new InMemoryRawProviderSink()
  const emitter = new TraceEmitter(traceStore, { runId })
  await emitter.startRun({ scenarioId: runId, layer: 'meta' })
  const client = createJudgeClient({
    apiKey,
    baseUrl: 'https://judge.example/v1',
    provider: 'test-provider',
    maximumAttempts: 1,
    rawSink,
    traceStore,
    runId,
    fetch: async () =>
      new Response(
        JSON.stringify({
          id: 'response-1',
          model: 'judge-test',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'canonical content' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
  })
  const response = await client.chat({
    model: 'judge-test',
    messages: [{ role: 'user', content: 'grade this' }],
  })
  await emitter.endRun({ pass: true, score: 1 })

  assert.equal(response.content, 'canonical content')
  const complete = await assertRunCaptured(traceStore, runId, {
    rawSink,
    llmSpansMin: 1,
    requireRawCoverageOfLlmSpans: true,
    requireOutcome: true,
  })
  assert.equal(complete.ok, true)
  assert.equal(complete.llmSpanCount, 1)
  assert.equal(complete.rawProviderEventCount, 2)
  assert.deepEqual(complete.rawSpanCoverage, { covered: 1, total: 1 })

  const events = await rawSink.list({ runId })
  assert.equal(JSON.stringify(events).includes(apiKey), false)
  assert.equal(events[0]?.requestHeaders?.Authorization, undefined)
  assert.ok(events[0]?.redactedFields.includes('requestHeaders.Authorization'))
})
