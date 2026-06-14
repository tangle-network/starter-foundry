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
  scoredPromotion: ScoredPromotionReport | null
  failures: string[]
}

interface ScoredLeafResult {
  split: 'train' | 'holdout'
  leafId: string
  status: 'passed' | 'failed'
  outDir: string
  command: CommandResult | null
  score: number | null
  passed: boolean | null
  scorePassed: boolean | null
  completionPassRate: number | null
  completionPassed: boolean | null
  scaffoldPassed: boolean | null
  scaffold: ScoredScaffoldEvidence
  profileId: string | null
  rankBasis: string | null
  costUsd: number | null
  durationMs: number | null
  reason?: string
}

interface ScoredScaffoldEvidence {
  expectedFamily: string
  expectedLayers: string[]
  observedFamily: string | null
  observedLayers: string[]
  observedDomainPackSources: string[]
  passed: boolean
  reason: string | null
}

interface ScoreDistribution {
  n: number
  min: number | null
  median: number | null
  p90: number | null
  max: number | null
  passCount: number
  failCount: number
  scorePassCount: number
  scoreFailCount: number
  completionPassCount: number
  completionFailCount: number
  scaffoldPassCount: number
  scaffoldFailCount: number
}

interface ScoredPromotionReport {
  mode: 'scored'
  status: 'passed' | 'failed'
  shots: number
  reps: number
  minScore: number
  baselineScore: number | null
  maxHoldoutRegression: number
  train: ScoreDistribution
  holdout: ScoreDistribution
  leaves: ScoredLeafResult[]
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
const shots = Math.max(1, Number(arg('--shots', '1')) || 1)
const reps = Math.max(1, Number(arg('--reps', '1')) || 1)
const parallel = Math.max(1, Number(arg('--parallel', '1')) || 1)
const minScore = clamp01(Number(arg('--min-score', '0.5')), 0.5)
const baselineScore = optionalNumberArg('--baseline-score')
const maxHoldoutRegression = Math.max(0, Number(arg('--max-holdout-regression', '0')) || 0)
const write = argv.includes('--write')
const json = argv.includes('--json')
const skipBuild = argv.includes('--skip-build')
const keepWorkdirs = argv.includes('--keep-workdirs')
const blueprintMode = arg('--blueprint-agent', 'dry-run')
const blueprintAgentDir = resolve(arg('--blueprint-agent-dir', DEFAULT_BLUEPRINT_AGENT))
const blueprintRuntime = arg('--runtime', 'claude-local')
const blueprintRoster = arg('--blueprint-roster', 'smoke')
const blueprintExclude = optionalArg('--blueprint-exclude')
const blueprintDriverPersona = optionalArg('--blueprint-driver-persona')
const scoredResultsDir = optionalArg('--scored-results-dir')

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

function optionalArg(flag: string): string | null {
  const i = argv.indexOf(flag)
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : null
}

function optionalNumberArg(flag: string): number | null {
  const value = optionalArg(flag)
  if (value === null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function clamp01(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(0, Math.min(1, value))
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
  if (!existsSync(starterCli)) {
    failures.push(`starter CLI not found: ${starterCli}`)
  }

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

  const blueprintAgent =
    blueprintMode === 'dry-run' ? runBlueprintAgentDryRun([...train, ...holdout]) : []
  for (const result of blueprintAgent) {
    if (result.status === 'failed')
      failures.push(`blueprint-agent dry-run failed: ${result.command}`)
  }

  const scoredPromotion = runScoredPromotion(candidate, train, holdout, {
    livePreflightFailures: scoredLivePreflightFailures(failures),
  })
  if (scoredPromotion?.status === 'failed') {
    for (const failure of scoredPromotion.failures)
      failures.push(`scored promotion failed: ${failure}`)
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
    scoredPromotion,
    failures,
  }
}

function scoredLivePreflightFailures(failures: string[]): string[] {
  if (scoredResultsDir) return []
  if (blueprintMode !== 'scored') return []
  return failures.filter(
    (failure) =>
      failure.startsWith('starter CLI not found:') ||
      failure.startsWith('insufficient train leaves:') ||
      failure.startsWith('insufficient holdout leaves:') ||
      failure === 'routing prompt check failed' ||
      failure.startsWith('compose failed for ') ||
      failure === 'authenticity signals were not found in composed scaffolds' ||
      failure.startsWith('validation command failed:') ||
      failure.startsWith('blueprint-agent dry-run failed:'),
  )
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
  const vbRun = join(blueprintAgentDir, 'scripts/experiments/vb-run.ts')
  if (!existsSync(vbRun)) {
    return [
      {
        command: 'blueprint-agent dry-run',
        cwd: blueprintAgentDir,
        status: 'skipped',
        exitCode: null,
        durationMs: 0,
        reason: `blueprint-agent not found at ${blueprintAgentDir}`,
      },
    ]
  }
  return leafIds.map((leafId) =>
    runCommand(
      [
        'pnpm tsx scripts/experiments/vb-run.ts',
        `--leaf ${shellQuote(leafId)}`,
        '--shots 1',
        `--roster ${shellQuote(blueprintRoster)}`,
        ...(blueprintExclude ? [`--exclude ${shellQuote(blueprintExclude)}`] : []),
        ...(blueprintDriverPersona
          ? [`--driver-persona ${shellQuote(blueprintDriverPersona)}`]
          : []),
        '--dry-run',
      ].join(' '),
      blueprintAgentDir,
      timeoutMs,
      { STARTER_FOUNDRY_CLI: starterCli },
    ),
  )
}

function runScoredPromotion(
  candidate: DomainPackWorkCandidate,
  train: string[],
  holdout: string[],
  opts: { livePreflightFailures?: string[] } = {},
): ScoredPromotionReport | null {
  if (blueprintMode === 'off' || blueprintMode === 'dry-run') return null
  const livePreflightFailures = opts.livePreflightFailures ?? []
  if (!scoredResultsDir && livePreflightFailures.length > 0) {
    return {
      mode: 'scored',
      status: 'failed',
      shots,
      reps,
      minScore,
      baselineScore,
      maxHoldoutRegression,
      train: distribution([]),
      holdout: distribution([]),
      leaves: [],
      failures: [
        'live scored promotion blocked by deterministic preflight',
        ...livePreflightFailures,
      ],
    }
  }
  if (blueprintMode !== 'scored') {
    return {
      mode: 'scored',
      status: 'failed',
      shots,
      reps,
      minScore,
      baselineScore,
      maxHoldoutRegression,
      train: distribution([]),
      holdout: distribution([]),
      leaves: [],
      failures: [`unsupported blueprint-agent mode: ${blueprintMode}`],
    }
  }

  const leaves = [
    ...train.map((leafId) => ({ split: 'train' as const, leafId })),
    ...holdout.map((leafId) => ({ split: 'holdout' as const, leafId })),
  ].map(({ split, leafId }) => runScoredLeaf(candidate, split, leafId))

  const trainDistribution = distribution(leaves.filter((leaf) => leaf.split === 'train'))
  const holdoutDistribution = distribution(leaves.filter((leaf) => leaf.split === 'holdout'))
  const failures: string[] = []
  for (const leaf of leaves) {
    if (leaf.status === 'failed')
      failures.push(`${leaf.split}:${leaf.leafId}: ${leaf.reason ?? 'failed'}`)
  }
  if (train.length > 0 && trainDistribution.n === 0) failures.push('no parseable train scores')
  if (holdout.length > 0 && holdoutDistribution.n === 0)
    failures.push('no parseable holdout scores')
  if (trainDistribution.scoreFailCount > 0) {
    failures.push(
      `${trainDistribution.scoreFailCount} train scored run(s) below min score ${minScore.toFixed(3)}`,
    )
  }
  if (holdoutDistribution.scoreFailCount > 0) {
    failures.push(
      `${holdoutDistribution.scoreFailCount} holdout scored run(s) below min score ${minScore.toFixed(3)}`,
    )
  }
  if (trainDistribution.completionFailCount > 0) {
    failures.push(
      `${trainDistribution.completionFailCount} train scored run(s) without a completion pass`,
    )
  }
  if (holdoutDistribution.completionFailCount > 0) {
    failures.push(
      `${holdoutDistribution.completionFailCount} holdout scored run(s) without a completion pass`,
    )
  }
  if (trainDistribution.scaffoldFailCount > 0) {
    failures.push(
      `${trainDistribution.scaffoldFailCount} train scored run(s) without expected starter scaffold evidence`,
    )
  }
  if (holdoutDistribution.scaffoldFailCount > 0) {
    failures.push(
      `${holdoutDistribution.scaffoldFailCount} holdout scored run(s) without expected starter scaffold evidence`,
    )
  }
  for (const leaf of leaves) {
    if (leaf.scaffold.reason) {
      failures.push(`${leaf.split}:${leaf.leafId}: ${leaf.scaffold.reason}`)
    }
  }
  if (
    baselineScore !== null &&
    holdoutDistribution.median !== null &&
    holdoutDistribution.median < baselineScore - maxHoldoutRegression
  ) {
    failures.push(
      `holdout median ${holdoutDistribution.median.toFixed(3)} regressed below baseline ${baselineScore.toFixed(3)} by more than ${maxHoldoutRegression.toFixed(3)}`,
    )
  }

  return {
    mode: 'scored',
    status: failures.length === 0 ? 'passed' : 'failed',
    shots,
    reps,
    minScore,
    baselineScore,
    maxHoldoutRegression,
    train: trainDistribution,
    holdout: holdoutDistribution,
    leaves,
    failures,
  }
}

function runScoredLeaf(
  candidate: DomainPackWorkCandidate,
  split: 'train' | 'holdout',
  leafId: string,
): ScoredLeafResult {
  const outDir = scoredLeafDir(split, leafId)
  const command = scoredResultsDir
    ? null
    : runCommand(
        [
          'pnpm tsx scripts/experiments/vb-run.ts',
          `--leaf ${shellQuote(leafId)}`,
          `--shots ${shots}`,
          `--reps ${reps}`,
          `--parallel ${parallel}`,
          `--runtime ${shellQuote(blueprintRuntime)}`,
          `--roster ${shellQuote(blueprintRoster)}`,
          ...(blueprintExclude ? [`--exclude ${shellQuote(blueprintExclude)}`] : []),
          ...(blueprintDriverPersona
            ? [`--driver-persona ${shellQuote(blueprintDriverPersona)}`]
            : []),
          `--out ${shellQuote(outDir)}`,
        ].join(' '),
        blueprintAgentDir,
        timeoutMs,
        { STARTER_FOUNDRY_CLI: starterCli },
      )
  if (command && command.status !== 'passed') {
    return failedScoredLeaf(
      candidate,
      split,
      leafId,
      outDir,
      command,
      command.reason ?? 'vb-run failed',
    )
  }
  return parseScoredLeaf(candidate, split, leafId, outDir, command)
}

function scoredLeafDir(split: 'train' | 'holdout', leafId: string): string {
  if (scoredResultsDir) {
    const root = resolve(scoredResultsDir)
    const bySplit = join(root, `${split}-${slug(leafId)}`)
    if (existsSync(bySplit)) return bySplit
    return join(root, slug(leafId))
  }
  return join(dirname(outPath), `${slug(candidateId)}-blueprint-agent`, `${split}-${slug(leafId)}`)
}

function parseScoredLeaf(
  candidate: DomainPackWorkCandidate,
  split: 'train' | 'holdout',
  leafId: string,
  outDir: string,
  command: CommandResult | null,
): ScoredLeafResult {
  const competitionPath = join(outDir, 'matrix', 'competition.json')
  if (!existsSync(competitionPath)) {
    return failedScoredLeaf(candidate, split, leafId, outDir, command, `missing ${competitionPath}`)
  }
  try {
    const competition = JSON.parse(readFileSync(competitionPath, 'utf8')) as {
      rankBasis?: string
      ranked?: Array<{
        profileId?: string
        meanComposite?: number | null
        meanBlended?: number | null
        hitRate?: number | null
        passRate?: number | null
        costPerSolved?: number | null
      }>
    }
    const top = competition.ranked?.[0]
    if (!top)
      return failedScoredLeaf(
        candidate,
        split,
        leafId,
        outDir,
        command,
        'competition has no ranked profiles',
      )
    const score = firstNumber(top.meanComposite, top.meanBlended, top.hitRate, top.passRate)
    if (score === null)
      return failedScoredLeaf(
        candidate,
        split,
        leafId,
        outDir,
        command,
        'ranked profile has no score',
      )
    const completionPassRate = firstNumber(top.passRate)
    const scorePassed = score >= minScore
    const completionPassed = completionPassRate === null ? false : completionPassRate > 0
    const profileId = top.profileId ?? null
    const scaffold = readScaffoldEvidence(candidate, outDir, profileId)
    const scaffoldPassed = scaffold.passed
    const manifest = readRunManifest(outDir)
    return {
      split,
      leafId,
      status: 'passed',
      outDir: relative(REPO, outDir),
      command,
      score,
      passed: scorePassed && completionPassed && scaffoldPassed,
      scorePassed,
      completionPassRate,
      completionPassed,
      scaffoldPassed,
      scaffold,
      profileId,
      rankBasis: competition.rankBasis ?? null,
      costUsd: firstNumber(top.costPerSolved),
      durationMs: manifest.durationMs,
    }
  } catch (err) {
    return failedScoredLeaf(
      candidate,
      split,
      leafId,
      outDir,
      command,
      err instanceof Error ? err.message : String(err),
    )
  }
}

function failedScoredLeaf(
  candidate: DomainPackWorkCandidate,
  split: 'train' | 'holdout',
  leafId: string,
  outDir: string,
  command: CommandResult | null,
  reason: string,
): ScoredLeafResult {
  return {
    split,
    leafId,
    status: 'failed',
    outDir: relative(REPO, outDir),
    command,
    score: null,
    passed: null,
    scorePassed: null,
    completionPassRate: null,
    completionPassed: null,
    scaffoldPassed: false,
    scaffold: missingScaffoldEvidence(
      candidate,
      'scored run failed before scaffold evidence could be parsed',
    ),
    profileId: null,
    rankBasis: null,
    costUsd: null,
    durationMs: null,
    reason,
  }
}

function readScaffoldEvidence(
  candidate: DomainPackWorkCandidate,
  outDir: string,
  profileId: string | null,
): ScoredScaffoldEvidence {
  const expectedFamily = candidate.intendedStarter.family
  const expectedLayers = expectedStarterLayers(candidate)
  const artifactRoot = join(outDir, 'matrix', 'artifacts')
  if (!existsSync(artifactRoot)) {
    return missingScaffoldEvidence(candidate, `missing scaffold artifact directory ${artifactRoot}`)
  }

  const candidateFiles = readdirSync(artifactRoot)
    .map((entry) => join(artifactRoot, entry, 'scaffold-compose.json'))
    .filter((path) => existsSync(path))
  const preferredFiles = profileId
    ? candidateFiles.filter((path) => dirname(path).split('/').pop()?.startsWith(profileId))
    : []
  const files = [
    ...preferredFiles,
    ...candidateFiles.filter((path) => !preferredFiles.includes(path)),
  ]
  if (files.length === 0) {
    return missingScaffoldEvidence(candidate, `missing scaffold-compose.json under ${artifactRoot}`)
  }

  for (const file of files) {
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as {
        family?: unknown
        layers?: unknown
        domainPackGuidance?: unknown
      }
      const observedFamily = typeof parsed.family === 'string' ? parsed.family : null
      const observedLayers = Array.isArray(parsed.layers)
        ? parsed.layers.filter((layer): layer is string => typeof layer === 'string')
        : []
      const observedDomainPackSources = domainPackSources(parsed.domainPackGuidance)
      const tokens = scaffoldTokens(observedFamily, observedLayers, observedDomainPackSources)
      const familyMatched = expectedFamily ? tokens.has(expectedFamily) : true
      const missingLayers = expectedLayers.filter(
        (layer) => !expectedLayerMatched(layer, tokens, familyMatched),
      )
      const passed = familyMatched && missingLayers.length === 0
      return {
        expectedFamily,
        expectedLayers,
        observedFamily,
        observedLayers,
        observedDomainPackSources,
        passed,
        reason: passed
          ? null
          : `scaffold evidence mismatch: expected family ${expectedFamily} and layers ${expectedLayers.join(', ') || '(none)'}, observed family ${observedFamily ?? '(none)'}, layers ${observedLayers.join(', ') || '(none)'}, domain packs ${observedDomainPackSources.join(', ') || '(none)'}`,
      }
    } catch {
      continue
    }
  }

  return missingScaffoldEvidence(candidate, 'scaffold-compose.json could not be parsed')
}

function missingScaffoldEvidence(
  candidate: DomainPackWorkCandidate,
  reason: string,
): ScoredScaffoldEvidence {
  return {
    expectedFamily: candidate.intendedStarter.family,
    expectedLayers: expectedStarterLayers(candidate),
    observedFamily: null,
    observedLayers: [],
    observedDomainPackSources: [],
    passed: false,
    reason,
  }
}

function expectedStarterLayers(candidate: DomainPackWorkCandidate): string[] {
  return [
    ...new Set([...candidate.intendedStarter.layers, ...candidate.intendedStarter.capabilities]),
  ]
}

function domainPackSources(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const source = (item as { source?: unknown }).source
      return typeof source === 'string' ? source : null
    })
    .filter((source): source is string => source !== null)
}

function scaffoldTokens(
  family: string | null,
  layers: string[],
  domainPackSources: string[],
): Set<string> {
  const tokens = new Set<string>()
  const add = (value: string): void => {
    if (!value) return
    tokens.add(value)
    for (const part of value.split('+')) {
      if (part) tokens.add(part)
    }
    const colon = value.indexOf(':')
    if (colon >= 0) tokens.add(value.slice(colon + 1))
  }
  if (family) add(family)
  for (const layer of layers) add(layer)
  for (const source of domainPackSources) add(source)
  return tokens
}

function expectedLayerMatched(layer: string, tokens: Set<string>, familyMatched: boolean): boolean {
  if (tokens.has(layer)) return true
  const [group, id] = layer.split(':', 2)
  if (id && tokens.has(id)) return true
  return group === 'framework' && familyMatched
}

function readRunManifest(outDir: string): { durationMs: number | null } {
  const path = join(outDir, 'matrix', 'run-manifest.json')
  if (!existsSync(path)) return { durationMs: null }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { durationMs?: unknown }
    return { durationMs: typeof parsed.durationMs === 'number' ? parsed.durationMs : null }
  } catch {
    return { durationMs: null }
  }
}

function firstNumber(...values: Array<number | null | undefined>): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return null
}

function distribution(leaves: ScoredLeafResult[]): ScoreDistribution {
  const scores = leaves
    .map((leaf) => leaf.score)
    .filter((score): score is number => typeof score === 'number' && Number.isFinite(score))
    .sort((a, b) => a - b)
  return {
    n: scores.length,
    min: scores[0] ?? null,
    median: median(scores),
    p90: percentile(scores, 0.9),
    max: scores[scores.length - 1] ?? null,
    passCount: leaves.filter((leaf) => leaf.passed === true).length,
    failCount: leaves.filter((leaf) => leaf.passed === false || leaf.status === 'failed').length,
    scorePassCount: leaves.filter((leaf) => leaf.scorePassed === true).length,
    scoreFailCount: leaves.filter((leaf) => leaf.scorePassed === false || leaf.status === 'failed')
      .length,
    completionPassCount: leaves.filter((leaf) => leaf.completionPassed === true).length,
    completionFailCount: leaves.filter(
      (leaf) => leaf.completionPassed === false || leaf.status === 'failed',
    ).length,
    scaffoldPassCount: leaves.filter((leaf) => leaf.scaffoldPassed === true).length,
    scaffoldFailCount: leaves.filter(
      (leaf) => leaf.scaffoldPassed === false || leaf.status === 'failed',
    ).length,
  }
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle]!
  return (sorted[middle - 1]! + sorted[middle]!) / 2
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const index = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)
  return sorted[index]!
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
