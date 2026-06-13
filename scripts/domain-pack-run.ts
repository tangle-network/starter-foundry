#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type CandidateStatus =
  | 'candidate'
  | 'blocked'
  | 'needs-metadata'
  | 'needs-scaffold'
  | 'deterministic-passed'
  | 'scored-passed'
  | 'promoted'

type GateName = 'deterministic' | 'scored'
type GateStatus = 'passed' | 'failed' | 'skipped'

interface DomainPackWorkCandidate {
  id: string
  status: CandidateStatus
  domain: Record<string, string | undefined>
  ambiguityGroup?: string
  verticalIds: string[]
  leafIds: { train: string[]; holdout: string[] }
  partnerIds: string[]
  failureEvidence: Array<{ source: string; bucket: string; count: number }>
  intendedStarter: { family: string; layers: string[]; capabilities: string[] }
  routingPrompts: string[]
  validationCommands: string[]
  authenticitySignals: string[]
  registryFiles: string[]
  filesToModify: string[]
  gatesToRun: string[]
  sourceFiles: string[]
}

interface CandidateReport {
  generatedAt?: string
  scenarioRoot?: string
  candidates: DomainPackWorkCandidate[]
}

interface CandidateClaim {
  runId: string
  owner: string
  claimedAt: string
  expiresAt: string
  lockPath: string
}

interface CandidateState {
  status: CandidateStatus
  updatedAt: string
  reason?: string
  lastRunId?: string
  evidencePaths?: string[]
  activeClaim?: CandidateClaim
  history: Array<{
    at: string
    event: string
    status?: CandidateStatus
    runId?: string
    owner?: string
    reason?: string
    evidencePath?: string
  }>
}

interface PromotionState {
  schemaVersion: 1
  updatedAt: string
  candidates: Record<string, CandidateState>
}

interface GateResult {
  gate: GateName
  candidateId: string
  status: GateStatus
  command?: string
  exitCode?: number | null
  durationMs: number
  evidencePath?: string
  reason?: string
  stdoutTail?: string
  stderrTail?: string
}

interface WorkUnit {
  schemaVersion: 1
  runId: string
  candidateId: string
  status: CandidateStatus
  domain: Record<string, string | undefined>
  ambiguityGroup?: string
  verticalIds: string[]
  sourceLeaves: { train: string[]; holdout: string[] }
  partnerIds: string[]
  failureEvidence: DomainPackWorkCandidate['failureEvidence']
  registryFiles: string[]
  filesToModify: string[]
  sourceFiles: string[]
  gatesToRun: string[]
  selectedGates: GateName[]
  expectedStarter: { family: string; layers: string[]; capabilities: string[] }
  routingPrompts: string[]
  validationCommands: string[]
  authenticitySignals: string[]
  github: {
    repository: string
    parentIssue: number
    trackingIssue: number
    issueUrl: string
  }
  claim?: CandidateClaim
  evidence: {
    workUnitPath: string
    smokeReportPath?: string
    scoredReportPath?: string
  }
}

interface RunReport {
  schemaVersion: 1
  runId: string
  generatedAt: string
  candidateFile: string
  stateFile: string
  runsDir: string
  filters: Record<string, string | string[] | boolean | number | null>
  selected: string[]
  skippedLocked: string[]
  distribution: BacklogDistribution
  workUnits: WorkUnit[]
  gateResults: GateResult[]
}

interface BacklogDistribution {
  total: number
  byStatus: Record<string, number>
  byDomain: Record<string, number>
  bySurface: Record<string, number>
  byProvider: Record<string, number>
  byAmbiguityGroup: Record<string, number>
}

interface CandidateWithState {
  candidate: DomainPackWorkCandidate
  status: CandidateStatus
  activeClaim?: CandidateClaim
  rank: number
}

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_CANDIDATES = join(REPO, '.evolve/domain-pack-candidates.json')
const DEFAULT_RUNS_DIR = join(REPO, '.evolve/domain-pack-runs')
const DEFAULT_REPO_FULL_NAME = 'tangle-network/starter-foundry'
const ISSUE_BY_DOMAIN: Record<string, number> = {
  bridge: 153,
  fhe: 152,
}

const argv = process.argv.slice(2)
const json = hasFlag('--json')
const writePlan = hasFlag('--write-plan')
const noClaim = hasFlag('--no-claim')
const force = hasFlag('--force')
const runId = arg('--run-id', timestampSlug(new Date()))
const candidateFile = resolve(arg('--candidates', DEFAULT_CANDIDATES))
const runsDir = resolve(arg('--runs-dir', DEFAULT_RUNS_DIR))
const stateFile = resolve(arg('--state', join(runsDir, 'state.json')))
const owner = arg('--claim-owner', process.env.USER || 'agent')
const limit = Math.max(1, Number(arg('--limit', '4')) || 4)
const explicitCandidates = listArg('--candidate', '')
const statuses = listArg(
  '--status',
  explicitCandidates.length > 0 && !hasFlag('--status') ? '' : 'candidate',
) as CandidateStatus[]
const selectedGates = listArg('--gates', '') as GateName[]
const setStatus = optionalArg('--set-status') as CandidateStatus | null
const markReason = optionalArg('--reason')
const lockTtlMinutes = Math.max(1, Number(arg('--lock-ttl-minutes', '240')) || 240)
const trainCount = Math.max(1, Number(arg('--train', '2')) || 2)
const holdoutCount = Math.max(1, Number(arg('--holdout', '2')) || 2)
const shots = Math.max(1, Number(arg('--shots', '1')) || 1)
const reps = Math.max(1, Number(arg('--reps', '1')) || 1)
const parallel = Math.max(1, Number(arg('--parallel', '1')) || 1)
const timeoutMs = Math.max(1_000, Number(arg('--timeout-ms', '120000')) || 120_000)
const blueprintAgent = arg('--blueprint-agent', 'dry-run')
const blueprintAgentDir = optionalArg('--blueprint-agent-dir')
const blueprintRuntime = optionalArg('--runtime')
const scoredResultsDir = optionalArg('--scored-results-dir')
const minScore = optionalArg('--min-score')
const baselineScore = optionalArg('--baseline-score')
const maxHoldoutRegression = optionalArg('--max-holdout-regression')
const smokeSkipBuild = hasFlag('--smoke-skip-build')
const release = hasFlag('--release')

if (existsSync(runsDir) && !statSync(runsDir).isDirectory()) {
  die(`runs dir is not a directory: ${runsDir}`)
}

validateStatusValues(statuses)
validateGateValues(selectedGates)

const report = loadCandidateReport(candidateFile)
const state = loadState(stateFile)

if (setStatus || release) {
  const id = explicitCandidates[0]
  if (!id) die('--candidate is required when setting status or releasing a claim')
  const candidate = report.candidates.find((item) => item.id === id)
  if (!candidate) die(`candidate not found: ${id}`)
  if (setStatus) updateCandidateStatus(state, id, setStatus, markReason ?? undefined)
  if (release) releaseClaim(state, id, markReason ?? undefined)
  saveState(stateFile, state)
  const out = { candidateId: id, state: state.candidates[id] }
  console.log(JSON.stringify(out, null, 2))
  process.exit(0)
}

const candidates = effectiveCandidates(report.candidates, state)
const filtered = candidates.filter(matchesFilters)
const locked = filtered.filter((item) => item.activeClaim && !claimOwnedBy(item.activeClaim, owner))
const selectable = filtered.filter(
  (item) => !item.activeClaim || claimOwnedBy(item.activeClaim, owner) || force,
)

if (explicitCandidates.length > 0 && locked.length > 0 && !force) {
  die(
    `candidate already claimed: ${locked
      .map((item) => `${item.candidate.id} by ${item.activeClaim?.owner}`)
      .join(', ')}`,
    3,
  )
}

const selected = diversify(selectable, limit)
const shouldWrite = writePlan || selectedGates.length > 0
const workUnits: WorkUnit[] = []
const gateResults: GateResult[] = []

if (shouldWrite) mkdirSync(join(runsDir, runId), { recursive: true })

for (const item of selected) {
  const candidate = item.candidate
  const candidateDir = join(runsDir, runId, slug(candidate.id))
  let claim: CandidateClaim | undefined
  if (shouldWrite && !noClaim) claim = claimCandidate(candidate.id)
  if (shouldWrite) mkdirSync(candidateDir, { recursive: true })
  const smokeReportPath = selectedGates.includes('deterministic')
    ? join(candidateDir, 'smoke.json')
    : undefined
  const scoredReportPath = selectedGates.includes('scored')
    ? join(candidateDir, 'scored.json')
    : undefined
  const workUnit = buildWorkUnit({
    candidate,
    status: item.status,
    claim,
    candidateDir,
    smokeReportPath,
    scoredReportPath,
  })
  workUnits.push(workUnit)
  if (shouldWrite) {
    writeFileSync(join(candidateDir, 'work-unit.json'), `${JSON.stringify(workUnit, null, 2)}\n`)
    recordRun(
      state,
      candidate.id,
      runId,
      claim,
      relative(REPO, join(candidateDir, 'work-unit.json')),
    )
  }
}

if (shouldWrite) {
  writeFileSync(join(runsDir, runId, 'summary.md'), summaryMarkdown(workUnits))
}

for (const workUnit of workUnits) {
  if (selectedGates.includes('deterministic')) {
    const result = runDeterministicGate(workUnit)
    gateResults.push(result)
    const nextStatus: CandidateStatus =
      result.status === 'passed' ? 'deterministic-passed' : 'blocked'
    updateCandidateStatus(state, workUnit.candidateId, nextStatus, result.reason, {
      runId,
      evidencePath: result.evidencePath,
    })
  }
  if (selectedGates.includes('scored')) {
    const result = runScoredGate(workUnit)
    gateResults.push(result)
    const nextStatus: CandidateStatus = result.status === 'passed' ? 'scored-passed' : 'blocked'
    updateCandidateStatus(state, workUnit.candidateId, nextStatus, result.reason, {
      runId,
      evidencePath: result.evidencePath,
    })
  }
}

const runReport: RunReport = {
  schemaVersion: 1,
  runId,
  generatedAt: new Date().toISOString(),
  candidateFile: relative(REPO, candidateFile),
  stateFile: relative(REPO, stateFile),
  runsDir: relative(REPO, runsDir),
  filters: filterSummary(),
  selected: workUnits.map((unit) => unit.candidateId),
  skippedLocked: locked.map((item) => item.candidate.id),
  distribution: distributionFor(candidates),
  workUnits,
  gateResults,
}

if (shouldWrite) {
  writeFileSync(join(runsDir, runId, 'run.json'), `${JSON.stringify(runReport, null, 2)}\n`)
  saveState(stateFile, state)
}

if (json) {
  console.log(JSON.stringify(runReport, null, 2))
} else {
  console.log(`domain-pack run ${runId}: selected ${runReport.selected.length}`)
  for (const id of runReport.selected) console.log(`  ${id}`)
  if (runReport.skippedLocked.length > 0) {
    console.log(`skipped locked: ${runReport.skippedLocked.join(', ')}`)
  }
  if (shouldWrite) console.log(`wrote ${relative(REPO, join(runsDir, runId))}`)
}

process.exitCode = gateResults.some((result) => result.status === 'failed') ? 1 : 0

function hasFlag(flag: string): boolean {
  return argv.includes(flag)
}

function arg(flag: string, fallback: string): string {
  const i = argv.indexOf(flag)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
}

function optionalArg(flag: string): string | null {
  const i = argv.indexOf(flag)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null
}

function listArg(flag: string, fallback: string): string[] {
  const raw = arg(flag, fallback)
  if (!raw) return []
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function loadCandidateReport(path: string): CandidateReport {
  return JSON.parse(readFileSync(path, 'utf8')) as CandidateReport
}

function loadState(path: string): PromotionState {
  if (!existsSync(path))
    return { schemaVersion: 1, updatedAt: new Date().toISOString(), candidates: {} }
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as PromotionState
  for (const [id, candidate] of Object.entries(parsed.candidates)) {
    if (candidate.activeClaim && claimExpired(candidate.activeClaim)) {
      removeLock(candidate.activeClaim.lockPath)
      candidate.history.push({
        at: new Date().toISOString(),
        event: 'claim-expired',
        owner: candidate.activeClaim.owner,
        runId: candidate.activeClaim.runId,
      })
      delete candidate.activeClaim
      parsed.candidates[id] = candidate
    }
  }
  return parsed
}

function saveState(path: string, state: PromotionState): void {
  state.updatedAt = new Date().toISOString()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`)
}

function effectiveCandidates(
  candidates: DomainPackWorkCandidate[],
  state: PromotionState,
): CandidateWithState[] {
  return candidates.map((candidate) => {
    const record = state.candidates[candidate.id]
    const status = record?.status ?? candidate.status
    return {
      candidate,
      status,
      activeClaim: record?.activeClaim,
      rank: candidateRank(candidate),
    }
  })
}

function matchesFilters(item: CandidateWithState): boolean {
  const candidate = item.candidate
  if (statuses.length > 0 && !statuses.includes(item.status)) return false
  if (explicitCandidates.length > 0 && !explicitCandidates.includes(candidate.id)) return false
  if (fieldFilter('--domain', candidate.domain.family) === false) return false
  if (fieldFilter('--surface', candidate.domain.surface) === false) return false
  if (fieldFilter('--provider', candidate.domain.provider) === false) return false
  if (fieldFilter('--ambiguity-group', candidate.ambiguityGroup) === false) return false
  return true
}

function fieldFilter(flag: string, value: string | undefined): boolean {
  const expected = listArg(flag, '')
  if (expected.length === 0) return true
  return value ? expected.includes(value) : false
}

function candidateRank(candidate: DomainPackWorkCandidate): number {
  const leafCount = candidate.leafIds.train.length + candidate.leafIds.holdout.length
  return (
    leafCount * 10 +
    candidate.routingPrompts.length * 5 +
    candidate.validationCommands.length * 3 +
    candidate.authenticitySignals.length +
    candidate.registryFiles.length
  )
}

function diversify(candidates: CandidateWithState[], max: number): CandidateWithState[] {
  const sorted = [...candidates].sort(
    (left, right) => right.rank - left.rank || left.candidate.id.localeCompare(right.candidate.id),
  )
  const buckets = new Map<string, CandidateWithState[]>()
  for (const candidate of sorted) {
    const key = [
      candidate.candidate.domain.family ?? 'unknown',
      candidate.candidate.domain.surface ?? 'unknown',
      candidate.candidate.ambiguityGroup ?? 'ungrouped',
    ].join('/')
    const bucket = buckets.get(key) ?? []
    bucket.push(candidate)
    buckets.set(key, bucket)
  }

  const selected: CandidateWithState[] = []
  while (selected.length < max && buckets.size > 0) {
    for (const [key, bucket] of [...buckets.entries()].sort((left, right) =>
      left[0].localeCompare(right[0]),
    )) {
      const next = bucket.shift()
      if (next) selected.push(next)
      if (bucket.length === 0) buckets.delete(key)
      if (selected.length >= max) break
    }
  }
  return selected
}

function claimCandidate(candidateId: string): CandidateClaim {
  const now = new Date()
  const lockPath = join(runsDir, 'locks', `${slug(candidateId)}.lock`)
  if (existsSync(lockPath)) {
    const claim = readClaim(lockPath)
    if (claim && !claimExpired(claim) && !force && !claimOwnedBy(claim, owner)) {
      die(`candidate already claimed: ${candidateId} by ${claim.owner}`, 3)
    }
    removeLock(lockPath)
  }
  mkdirSync(dirname(lockPath), { recursive: true })
  mkdirSync(lockPath, { recursive: false })
  const claim = {
    runId,
    owner,
    claimedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + lockTtlMinutes * 60_000).toISOString(),
    lockPath: relative(REPO, lockPath),
  }
  writeFileSync(join(lockPath, 'claim.json'), `${JSON.stringify(claim, null, 2)}\n`)
  return claim
}

function readClaim(lockPath: string): CandidateClaim | null {
  const claimPath = join(lockPath, 'claim.json')
  if (!existsSync(claimPath)) return null
  try {
    return JSON.parse(readFileSync(claimPath, 'utf8')) as CandidateClaim
  } catch {
    return null
  }
}

function claimExpired(claim: CandidateClaim): boolean {
  return Date.parse(claim.expiresAt) <= Date.now()
}

function claimOwnedBy(claim: CandidateClaim, claimOwner: string): boolean {
  return claim.owner === claimOwner
}

function removeLock(lockPath: string): void {
  const absolute = resolve(REPO, lockPath)
  rmSync(absolute, { recursive: true, force: true })
}

function buildWorkUnit({
  candidate,
  status,
  claim,
  candidateDir,
  smokeReportPath,
  scoredReportPath,
}: {
  candidate: DomainPackWorkCandidate
  status: CandidateStatus
  claim?: CandidateClaim
  candidateDir: string
  smokeReportPath?: string
  scoredReportPath?: string
}): WorkUnit {
  const trackingIssue = ISSUE_BY_DOMAIN[candidate.domain.family ?? ''] ?? 148
  return {
    schemaVersion: 1,
    runId,
    candidateId: candidate.id,
    status,
    domain: candidate.domain,
    ambiguityGroup: candidate.ambiguityGroup,
    verticalIds: candidate.verticalIds,
    sourceLeaves: candidate.leafIds,
    partnerIds: candidate.partnerIds,
    failureEvidence: candidate.failureEvidence,
    registryFiles: candidate.registryFiles,
    filesToModify: candidate.filesToModify,
    sourceFiles: candidate.sourceFiles,
    gatesToRun: candidate.gatesToRun,
    selectedGates,
    expectedStarter: candidate.intendedStarter,
    routingPrompts: candidate.routingPrompts,
    validationCommands: candidate.validationCommands,
    authenticitySignals: candidate.authenticitySignals,
    github: {
      repository: DEFAULT_REPO_FULL_NAME,
      parentIssue: 148,
      trackingIssue,
      issueUrl: `https://github.com/${DEFAULT_REPO_FULL_NAME}/issues/${trackingIssue}`,
    },
    claim,
    evidence: {
      workUnitPath: relative(REPO, join(candidateDir, 'work-unit.json')),
      smokeReportPath: smokeReportPath ? relative(REPO, smokeReportPath) : undefined,
      scoredReportPath: scoredReportPath ? relative(REPO, scoredReportPath) : undefined,
    },
  }
}

function recordRun(
  state: PromotionState,
  candidateId: string,
  currentRunId: string,
  claim: CandidateClaim | undefined,
  evidencePath: string,
): void {
  const record = ensureCandidateState(state, candidateId)
  record.lastRunId = currentRunId
  record.evidencePaths = unique([...(record.evidencePaths ?? []), evidencePath])
  if (claim) record.activeClaim = claim
  record.history.push({
    at: new Date().toISOString(),
    event: claim ? 'planned-and-claimed' : 'planned',
    runId: currentRunId,
    owner: claim?.owner,
    evidencePath,
  })
}

function updateCandidateStatus(
  state: PromotionState,
  candidateId: string,
  status: CandidateStatus,
  reason: string | undefined,
  extra: { runId?: string; evidencePath?: string } = {},
): void {
  const record = ensureCandidateState(state, candidateId)
  record.status = status
  record.reason = reason
  record.updatedAt = new Date().toISOString()
  if (extra.runId) record.lastRunId = extra.runId
  if (extra.evidencePath)
    record.evidencePaths = unique([...(record.evidencePaths ?? []), extra.evidencePath])
  record.history.push({
    at: record.updatedAt,
    event: 'status-updated',
    status,
    reason,
    runId: extra.runId,
    evidencePath: extra.evidencePath,
  })
}

function releaseClaim(
  state: PromotionState,
  candidateId: string,
  reason: string | undefined,
): void {
  const record = ensureCandidateState(state, candidateId)
  if (record.activeClaim) removeLock(record.activeClaim.lockPath)
  record.history.push({
    at: new Date().toISOString(),
    event: 'claim-released',
    owner: record.activeClaim?.owner,
    runId: record.activeClaim?.runId,
    reason,
  })
  delete record.activeClaim
  record.updatedAt = new Date().toISOString()
}

function ensureCandidateState(state: PromotionState, candidateId: string): CandidateState {
  const existing = state.candidates[candidateId]
  if (existing) return existing
  const created: CandidateState = {
    status: 'candidate',
    updatedAt: new Date().toISOString(),
    history: [],
  }
  state.candidates[candidateId] = created
  return created
}

function runDeterministicGate(workUnit: WorkUnit): GateResult {
  const smokeReportPath = workUnit.evidence.smokeReportPath
  if (!smokeReportPath) {
    return {
      gate: 'deterministic',
      candidateId: workUnit.candidateId,
      status: 'failed',
      durationMs: 0,
      reason: 'missing smoke report path',
    }
  }
  const command = [
    'pnpm exec tsx scripts/domain-pack-smoke.ts',
    `--candidate ${shellQuote(workUnit.candidateId)}`,
    `--candidates ${shellQuote(candidateFile)}`,
    `--output ${shellQuote(resolve(REPO, smokeReportPath))}`,
    '--write',
    '--json',
    `--train ${trainCount}`,
    `--holdout ${holdoutCount}`,
    `--timeout-ms ${timeoutMs}`,
    `--blueprint-agent ${shellQuote(blueprintAgent)}`,
    smokeSkipBuild ? '--skip-build' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const start = Date.now()
  const result = spawnSync(command, {
    cwd: REPO,
    shell: true,
    encoding: 'utf8',
    timeout: timeoutMs,
  })
  return {
    gate: 'deterministic',
    candidateId: workUnit.candidateId,
    status: result.status === 0 ? 'passed' : 'failed',
    command,
    exitCode: result.status,
    durationMs: Date.now() - start,
    evidencePath: smokeReportPath,
    reason: result.error?.message,
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr),
  }
}

function runScoredGate(workUnit: WorkUnit): GateResult {
  const scoredReportPath = workUnit.evidence.scoredReportPath
  if (!scoredReportPath) {
    return {
      gate: 'scored',
      candidateId: workUnit.candidateId,
      status: 'failed',
      durationMs: 0,
      reason: 'missing scored report path',
    }
  }
  const command = [
    'pnpm exec tsx scripts/domain-pack-smoke.ts',
    `--candidate ${shellQuote(workUnit.candidateId)}`,
    `--candidates ${shellQuote(candidateFile)}`,
    `--output ${shellQuote(resolve(REPO, scoredReportPath))}`,
    '--write',
    '--json',
    `--train ${trainCount}`,
    `--holdout ${holdoutCount}`,
    `--timeout-ms ${timeoutMs}`,
    `--blueprint-agent scored`,
    `--shots ${shots}`,
    `--reps ${reps}`,
    `--parallel ${parallel}`,
    smokeSkipBuild ? '--skip-build' : '',
    blueprintAgentDir ? `--blueprint-agent-dir ${shellQuote(blueprintAgentDir)}` : '',
    blueprintRuntime ? `--runtime ${shellQuote(blueprintRuntime)}` : '',
    scoredResultsDir ? `--scored-results-dir ${shellQuote(scoredResultsDir)}` : '',
    minScore ? `--min-score ${shellQuote(minScore)}` : '',
    baselineScore ? `--baseline-score ${shellQuote(baselineScore)}` : '',
    maxHoldoutRegression ? `--max-holdout-regression ${shellQuote(maxHoldoutRegression)}` : '',
  ]
    .filter(Boolean)
    .join(' ')
  const start = Date.now()
  const scoredTimeoutMs = timeoutMs * Math.max(1, trainCount + holdoutCount)
  const result = spawnSync(command, {
    cwd: REPO,
    shell: true,
    encoding: 'utf8',
    timeout: scoredTimeoutMs,
  })
  return {
    gate: 'scored',
    candidateId: workUnit.candidateId,
    status: result.status === 0 ? 'passed' : 'failed',
    command,
    exitCode: result.status,
    durationMs: Date.now() - start,
    evidencePath: scoredReportPath,
    reason: result.error?.message,
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr),
  }
}

function distributionFor(candidates: CandidateWithState[]): BacklogDistribution {
  const distribution: BacklogDistribution = {
    total: candidates.length,
    byStatus: {},
    byDomain: {},
    bySurface: {},
    byProvider: {},
    byAmbiguityGroup: {},
  }
  for (const { candidate, status } of candidates) {
    inc(distribution.byStatus, status)
    inc(distribution.byDomain, candidate.domain.family ?? '(none)')
    inc(distribution.bySurface, candidate.domain.surface ?? '(none)')
    inc(distribution.byProvider, candidate.domain.provider ?? '(none)')
    inc(distribution.byAmbiguityGroup, candidate.ambiguityGroup ?? '(none)')
  }
  return distribution
}

function inc(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1
}

function filterSummary(): RunReport['filters'] {
  return {
    limit,
    statuses,
    candidates: explicitCandidates,
    domain: listArg('--domain', ''),
    surface: listArg('--surface', ''),
    provider: listArg('--provider', ''),
    ambiguityGroup: listArg('--ambiguity-group', ''),
    gates: selectedGates,
    shots,
    reps,
    parallel,
    minScore,
    baselineScore,
    maxHoldoutRegression,
    runtime: blueprintRuntime,
    writePlan,
    claim: !noClaim,
  }
}

function summaryMarkdown(workUnits: WorkUnit[]): string {
  const lines = [
    `# Domain Pack Run ${runId}`,
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '| Candidate | Status | Domain | Starter | Tracking |',
    '|---|---|---|---|---|',
  ]
  for (const unit of workUnits) {
    lines.push(
      `| ${unit.candidateId} | ${unit.status} | ${unit.domain.family ?? ''}/${unit.domain.surface ?? ''} | ${unit.expectedStarter.family} | #${unit.github.trackingIssue} |`,
    )
  }
  lines.push('', '## Next Gates', '')
  for (const unit of workUnits) {
    lines.push(`- ${unit.candidateId}: ${unit.gatesToRun.join('; ') || '(none)'}`)
  }
  return `${lines.join('\n')}\n`
}

function timestampSlug(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-')
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function tail(value: string | null | undefined): string {
  return (value ?? '').slice(-4_000)
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function die(message: string, code = 2): never {
  console.error(message)
  process.exit(code)
}

function validateStatusValues(values: CandidateStatus[]): void {
  const allowed = new Set<CandidateStatus>([
    'candidate',
    'blocked',
    'needs-metadata',
    'needs-scaffold',
    'deterministic-passed',
    'scored-passed',
    'promoted',
  ])
  const invalid = values.filter((value) => !allowed.has(value))
  if (invalid.length > 0) die(`invalid status: ${invalid.join(', ')}`)
}

function validateGateValues(values: GateName[]): void {
  const allowed = new Set<GateName>(['deterministic', 'scored'])
  const invalid = values.filter((value) => !allowed.has(value))
  if (invalid.length > 0) die(`invalid gate: ${invalid.join(', ')}`)
}
