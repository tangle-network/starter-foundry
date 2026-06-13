#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

interface DomainPackWorkCandidate {
  id: string
  domain: Record<string, string | undefined>
  ambiguityGroup?: string
  leafIds: { train: string[]; holdout: string[] }
  intendedStarter: { family: string; layers: string[]; capabilities: string[] }
  routingPrompts: string[]
  validationCommands: string[]
  authenticitySignals: string[]
  registryFiles: string[]
  sourceFiles: string[]
}

interface CandidateReport {
  candidates: DomainPackWorkCandidate[]
}

interface CommandResult {
  command: string
  cwd: string
  status: 'passed' | 'failed' | 'skipped'
  exitCode: number | null
  durationMs: number
  reason?: string
  stdoutTail?: string
  stderrTail?: string
}

interface SampleResult {
  split: 'train' | 'holdout'
  leafId: string
  compose: CommandResult
  workdir: string | null
  fileCount: number
  authenticityHits: Record<string, number>
  authenticityTotal: number
}

interface SmokeReport {
  schemaVersion: 1
  generatedAt: string
  candidateId: string
  candidateFile: string
  status: 'passed' | 'failed'
  samples: { train: string[]; holdout: string[] }
  routing: {
    status: 'passed' | 'failed' | 'skipped'
    prompts: Array<{
      prompt: string
      expectedFamily: string
      expectedLayers: string[]
      actualFamily: string | null
      actualLayers: string[]
      ok: boolean
    }>
  }
  compose: {
    passed: number
    failed: number
    minFileCount: number
  }
  authenticity: {
    signals: string[]
    totalHits: number
    perSample: Array<{ leafId: string; hits: Record<string, number>; total: number }>
  }
  validationCommands: CommandResult[]
  blueprintAgent: CommandResult[]
  failures: string[]
}

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_CANDIDATES = join(REPO, '.evolve/domain-pack-candidates.json')
const DEFAULT_OUT_DIR = join(REPO, '.evolve/domain-pack-smoke')
const DEFAULT_CLI = join(REPO, 'dist/cli.js')
const DEFAULT_BLUEPRINT_AGENT = resolve(REPO, '../blueprint-agent')

const argv = process.argv.slice(2)
const candidateId = requiredArg('--candidate')
const candidateFile = resolve(arg('--candidates', DEFAULT_CANDIDATES))
const starterCli = resolve(arg('--starter-cli', process.env.STARTER_FOUNDRY_CLI ?? DEFAULT_CLI))
const outPath = resolve(arg('--output', join(DEFAULT_OUT_DIR, `${slug(candidateId)}.json`)))
const trainCount = Math.max(1, Number(arg('--train', '2')) || 2)
const holdoutCount = Math.max(1, Number(arg('--holdout', '2')) || 2)
const timeoutMs = Math.max(1_000, Number(arg('--timeout-ms', '120000')) || 120_000)
const write = argv.includes('--write')
const json = argv.includes('--json')
const skipBuild = argv.includes('--skip-build')
const keepWorkdirs = argv.includes('--keep-workdirs')
const blueprintMode = arg('--blueprint-agent', 'dry-run')

const candidate = loadCandidate(candidateFile, candidateId)
const report = runSmoke(candidate)

if (write) {
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`)
}

if (json) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log(
    `domain-pack smoke ${report.status}: ${candidateId} ` +
      `train=${report.samples.train.length} holdout=${report.samples.holdout.length} ` +
      `compose=${report.compose.passed}/${report.compose.passed + report.compose.failed} ` +
      `authHits=${report.authenticity.totalHits}`,
  )
  if (write) console.log(`wrote ${relative(REPO, outPath)}`)
  for (const failure of report.failures) console.log(`  - ${failure}`)
}

process.exitCode = report.status === 'passed' ? 0 : 1

function arg(flag: string, fallback: string): string {
  const i = argv.indexOf(flag)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
}

function requiredArg(flag: string): string {
  const value = arg(flag, '')
  if (value) return value
  console.error(`missing required ${flag}`)
  process.exit(2)
}

function loadCandidate(path: string, id: string): DomainPackWorkCandidate {
  const report = JSON.parse(readFileSync(path, 'utf8')) as CandidateReport
  const candidate = report.candidates.find((item) => item.id === id)
  if (!candidate) {
    throw new Error(`candidate not found: ${id} in ${path}`)
  }
  return candidate
}

function runSmoke(candidate: DomainPackWorkCandidate): SmokeReport {
  const failures: string[] = []
  const train = candidate.leafIds.train.slice(0, trainCount)
  const holdout = candidate.leafIds.holdout.slice(0, holdoutCount)
  if (train.length < trainCount)
    failures.push(`insufficient train leaves: ${train.length}/${trainCount}`)
  if (holdout.length < holdoutCount)
    failures.push(`insufficient holdout leaves: ${holdout.length}/${holdoutCount}`)

  const routing = checkRouting(candidate)
  if (routing.status === 'failed') failures.push('routing prompt check failed')

  const sampleResults = [
    ...train.map((leafId) => ['train', leafId] as const),
    ...holdout.map((leafId) => ['holdout', leafId] as const),
  ].map(([split, leafId]) => smokeSample(candidate, split, leafId))

  const composeFailed = sampleResults.filter((sample) => sample.compose.status !== 'passed')
  for (const sample of composeFailed)
    failures.push(`compose failed for ${sample.split}:${sample.leafId}`)

  const authenticityTotal = sampleResults.reduce(
    (total, sample) => total + sample.authenticityTotal,
    0,
  )
  if (candidate.authenticitySignals.length > 0 && authenticityTotal === 0) {
    failures.push('authenticity signals were not found in composed scaffolds')
  }

  const validationCommands = runValidationCommands(candidate, sampleResults)
  for (const result of validationCommands) {
    if (result.status === 'failed') failures.push(`validation command failed: ${result.command}`)
  }

  const blueprintAgent = runBlueprintAgentDryRun([...train, ...holdout])
  for (const result of blueprintAgent) {
    if (result.status === 'failed')
      failures.push(`blueprint-agent dry-run failed: ${result.command}`)
  }
  cleanupWorkdirs(sampleResults)

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    candidateId: candidate.id,
    candidateFile,
    status: failures.length === 0 ? 'passed' : 'failed',
    samples: { train, holdout },
    routing,
    compose: {
      passed: sampleResults.filter((sample) => sample.compose.status === 'passed').length,
      failed: composeFailed.length,
      minFileCount: sampleResults.length
        ? Math.min(...sampleResults.map((sample) => sample.fileCount))
        : 0,
    },
    authenticity: {
      signals: candidate.authenticitySignals,
      totalHits: authenticityTotal,
      perSample: sampleResults.map((sample) => ({
        leafId: sample.leafId,
        hits: sample.authenticityHits,
        total: sample.authenticityTotal,
      })),
    },
    validationCommands,
    blueprintAgent,
    failures,
  }
}

function checkRouting(candidate: DomainPackWorkCandidate): SmokeReport['routing'] {
  if (candidate.routingPrompts.length === 0) return { status: 'skipped', prompts: [] }
  const prompts = candidate.routingPrompts.map((prompt) => {
    const result = runCommand(
      `node ${shellQuote(starterCli)} select --prompt ${shellQuote(prompt)} --json`,
      REPO,
      timeoutMs,
    )
    let actualFamily: string | null = null
    let actualLayers: string[] = []
    if (result.status === 'passed' && result.stdoutTail) {
      const jsonStart = result.stdoutTail.indexOf('{')
      if (jsonStart >= 0) {
        try {
          const parsed = JSON.parse(result.stdoutTail.slice(jsonStart))
          actualFamily = parsed.spec?.family ?? null
          actualLayers = Array.isArray(parsed.spec?.layers) ? parsed.spec.layers : []
        } catch {
          actualFamily = null
          actualLayers = []
        }
      }
    }
    const expectedLayers = candidate.intendedStarter.layers
    const layersOk = expectedLayers.every((layer) => actualLayers.includes(layer))
    return {
      prompt,
      expectedFamily: candidate.intendedStarter.family,
      expectedLayers,
      actualFamily,
      actualLayers,
      ok: actualFamily === candidate.intendedStarter.family && layersOk,
    }
  })
  return {
    status: prompts.every((prompt) => prompt.ok) ? 'passed' : 'failed',
    prompts,
  }
}

function smokeSample(
  candidate: DomainPackWorkCandidate,
  split: 'train' | 'holdout',
  leafId: string,
): SampleResult {
  const workdir = mkdtempSync(
    join(tmpdir(), `domain-pack-smoke-${slug(candidate.id)}-${slug(leafId)}-`),
  )
  const specPath = join(workdir, 'spec.json')
  const outDir = join(workdir, 'out')
  const spec = {
    projectName: `smoke-${slug(candidate.id)}-${slug(leafId)}`,
    family: candidate.intendedStarter.family,
    layers: candidate.intendedStarter.capabilities,
    userPrompt: `Domain pack smoke for ${candidate.id}/${leafId}.`,
  }
  writeFileSync(specPath, JSON.stringify(spec, null, 2))
  const compose = runCommand(
    `node ${shellQuote(starterCli)} compose --spec ${shellQuote(specPath)} --out ${shellQuote(outDir)} --json`,
    REPO,
    timeoutMs,
  )
  const fileCount = existsSync(outDir) ? countFiles(outDir) : 0
  const authenticityHits = existsSync(outDir)
    ? countAuthenticityHits(outDir, candidate.authenticitySignals)
    : {}
  const authenticityTotal = Object.values(authenticityHits).reduce(
    (total, count) => total + count,
    0,
  )
  return {
    split,
    leafId,
    compose,
    workdir: outDir,
    fileCount,
    authenticityHits,
    authenticityTotal,
  }
}

function cleanupWorkdirs(samples: SampleResult[]): void {
  if (keepWorkdirs) return
  for (const sample of samples) {
    if (!sample.workdir) continue
    rmSync(dirname(sample.workdir), { recursive: true, force: true, maxRetries: 3, retryDelay: 50 })
    sample.workdir = null
  }
}

function runValidationCommands(
  candidate: DomainPackWorkCandidate,
  samples: SampleResult[],
): CommandResult[] {
  if (skipBuild || candidate.validationCommands.length === 0) return []
  const firstWorkdir = samples.find((sample) => sample.workdir)?.workdir
  if (!firstWorkdir) {
    return candidate.validationCommands.map((command) => ({
      command,
      cwd: REPO,
      status: 'skipped',
      exitCode: null,
      durationMs: 0,
      reason: 'no retained compose workdir; pass --keep-workdirs to run validation commands',
    }))
  }
  return candidate.validationCommands.map((command) => {
    const binary = command.trim().split(/\s+/)[0]
    if (!binary || !commandExists(binary)) {
      return {
        command,
        cwd: firstWorkdir,
        status: 'skipped',
        exitCode: null,
        durationMs: 0,
        reason: `tool not found: ${binary || '(empty)'}`,
      }
    }
    return runCommand(command, firstWorkdir, timeoutMs)
  })
}

function runBlueprintAgentDryRun(leafIds: string[]): CommandResult[] {
  if (blueprintMode === 'off') return []
  const vbRun = join(DEFAULT_BLUEPRINT_AGENT, 'scripts/experiments/vb-run.ts')
  if (!existsSync(vbRun)) {
    return [
      {
        command: 'blueprint-agent dry-run',
        cwd: DEFAULT_BLUEPRINT_AGENT,
        status: 'skipped',
        exitCode: null,
        durationMs: 0,
        reason: `blueprint-agent not found at ${DEFAULT_BLUEPRINT_AGENT}`,
      },
    ]
  }
  if (blueprintMode !== 'dry-run') {
    return [
      {
        command: `blueprint-agent mode ${blueprintMode}`,
        cwd: DEFAULT_BLUEPRINT_AGENT,
        status: 'failed',
        exitCode: null,
        durationMs: 0,
        reason: 'only dry-run mode is implemented in this gate',
      },
    ]
  }
  return leafIds.map((leafId) =>
    runCommand(
      `pnpm tsx scripts/experiments/vb-run.ts --leaf ${shellQuote(leafId)} --shots 1 --dry-run`,
      DEFAULT_BLUEPRINT_AGENT,
      timeoutMs,
      { STARTER_FOUNDRY_CLI: starterCli },
    ),
  )
}

function runCommand(
  command: string,
  cwd: string,
  timeout: number,
  envOverrides: Record<string, string | undefined> = {},
): CommandResult {
  const start = Date.now()
  const result = spawnSync(command, {
    cwd,
    shell: true,
    encoding: 'utf8',
    timeout,
    env: { ...process.env, ...envOverrides },
  })
  const durationMs = Date.now() - start
  return {
    command,
    cwd,
    status: result.status === 0 ? 'passed' : 'failed',
    exitCode: result.status,
    durationMs,
    reason: result.error?.message,
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr),
  }
}

function commandExists(binary: string): boolean {
  return (
    spawnSync(`command -v ${shellQuote(binary)}`, {
      shell: true,
      encoding: 'utf8',
    }).status === 0
  )
}

function countFiles(root: string): number {
  let total = 0
  for (const entry of readdirSync(root)) {
    if (entry === 'node_modules' || entry === '.git') continue
    const path = join(root, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) total += countFiles(path)
    else total += 1
  }
  return total
}

function countAuthenticityHits(root: string, signals: string[]): Record<string, number> {
  const hits = Object.fromEntries(signals.map((signal) => [signal, 0]))
  for (const file of listFiles(root)) {
    if (statSync(file).size > 1_000_000) continue
    let text = ''
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    for (const signal of signals) {
      hits[signal] += occurrences(text.toLowerCase(), signal.toLowerCase())
    }
  }
  return hits
}

function listFiles(root: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(root)) {
    if (entry === 'node_modules' || entry === '.git') continue
    const path = join(root, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) files.push(...listFiles(path))
    else files.push(path)
  }
  return files
}

function occurrences(text: string, needle: string): number {
  if (!needle) return 0
  let count = 0
  let index = text.indexOf(needle)
  while (index >= 0) {
    count += 1
    index = text.indexOf(needle, index + needle.length)
  }
  return count
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function tail(value: string | null | undefined): string {
  return (value ?? '').slice(-4_000)
}
