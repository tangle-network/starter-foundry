#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { listDomainPackEntries, type DomainPackEntry } from '../src/lib/domain-packs.js'
import { loadRegistry } from '../src/lib/registry.js'
import type { DomainPackAuthenticityGroup, DomainPackMetadata, Registry } from '../src/types.js'

interface ScenarioLeaf {
  id: string
  tags: string[]
  text: string
  expectedFamily?: string
  loadBearingArtifact?: string
}

interface ScenarioSeed {
  id: string
  category?: string
  partner?: string
  scaffoldFamily?: string
  file: string
  text: string
  leaves: ScenarioLeaf[]
}

interface DomainPackWorkCandidate {
  id: string
  status: 'candidate'
  domain: DomainPackMetadata['domain']
  ambiguityGroup?: string
  verticalIds: string[]
  leafIds: { train: string[]; holdout: string[] }
  partnerIds: string[]
  failureEvidence: Array<{ source: string; bucket: string; count: number }>
  intendedStarter: { family: string; layers: string[]; capabilities: string[] }
  routingPrompts: string[]
  validationCommands: string[]
  authenticitySignals: string[]
  authenticityGroups?: DomainPackAuthenticityGroup[]
  registryFiles: string[]
  filesToModify: string[]
  gatesToRun: string[]
  sourceFiles: string[]
}

interface GroupEntry {
  entry: DomainPackEntry
  terms: WeightedTerm[]
}

interface WeightedTerm {
  value: string
  weight: number
  evidence: boolean
  capabilityIntent: boolean
  domainSpecific: boolean
}

interface DomainGroup {
  id: string
  domain: DomainPackMetadata['domain']
  ambiguityGroup?: string
  entries: GroupEntry[]
}

interface Evidence {
  seed: ScenarioSeed
  leaf: ScenarioLeaf
  score: number
}

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_SCENARIOS = resolve(REPO, '../blueprint-agent/scripts/experiments/scenarios')
const DEFAULT_OUTPUT = join(REPO, '.evolve/domain-pack-candidates.json')
const GENERIC_TERMS = new Set(['app', 'apps', 'contract', 'contracts', 'custom', 'generic', 'ui'])
const TOOLCHAIN_PROVIDES = new Set(['forge-build', 'hardhat-build', 'solidity-contracts'])
const KNOWN_SURFACES = new Set(['api', 'contracts', 'indexer', 'research', 'ui', 'worker'])
const SURFACE_TERMS: Record<string, Array<[RegExp, number]>> = {
  api: [[/\bapi\b|\bbackend\b|\bserver\b|\bendpoint\b|\bwebhook\b|\brest\b|\bgraphql\b/, 2]],
  contracts: [
    [/\bsmart\s+contracts?\b|\bcontracts?\b|\bsolidity\b|\bfoundry\b|\bforge\b|\bhardhat\b/, 4],
    [/\bdeploy(?:ment|ed|s)?\b|\bdeployer\b|\bdeploy\s+scripts?\b/, 2],
    [/\berc[-\s]?\d+\b|\btoken\s+contracts?\b|\bvault\s+contracts?\b/, 2],
    [/\bimplement\b|\boverride\b|\bhandler\b|\bprotocol\s+logic\b/, 2],
    [/\b[A-Za-z_][A-Za-z0-9_]*(?:\([^)]*\)|\[\])/, 2],
  ],
  indexer: [
    [/\bindexer\b|\bmonitor(?:ing)?\b|\bwatcher\b|\banalytics\b|\bscanner\b/, 3],
    [/\brelayer\b|\brelay\b|\bqueue\b|\bevent\s+listener\b|\balert(?:ing)?\b/, 2],
  ],
  research: [[/\bresearch\b|\bexplain\b|\bwhitepaper\b|\bcomparison\b|\banalysis\b/, 3]],
  ui: [
    [/\bui\b|\bux\b|\bfrontend\b|\bfront-end\b|\binterface\b|\bdashboard\b/, 4],
    [
      /\bviewer\b|\bwizard\b|\bpanel\b|\bpage\b|\bscreen\b|\bform\b|\bexplorer\b|\bcalculator\b|\bestimator\b/,
      3,
    ],
    [
      /\bdisplay\b|\bshow\b|\brender\b|\bchart\b|\btable\b|\bwallet-connected\b|\buser\s+selects?\b/,
      2,
    ],
  ],
  worker: [[/\bworker\b|\bjob\b|\bcron\b|\bscheduler\b|\bbackground\b/, 3]],
}
const ARTIFACT_SURFACES: Record<string, string[]> = {
  api: ['api'],
  backend: ['api', 'indexer'],
  contract: ['contracts'],
  contracts: ['contracts'],
  dashboard: ['ui'],
  frontend: ['ui'],
  indexer: ['indexer'],
  interface: ['ui'],
  research: ['research'],
  ui: ['ui'],
  worker: ['worker'],
}
const FAMILY_SURFACES: Array<[RegExp, string[]]> = [
  [/(^|-)contracts?$/, ['contracts']],
  [/foundry|forge|hardhat|solana-program/, ['contracts']],
  [/react|nextjs|vue|svelte|frontend|static|ui/, ['ui']],
  [/api|server|backend/, ['api']],
  [/infra|indexer|relayer|worker/, ['indexer']],
]

const argv = process.argv.slice(2)
const JSON_OUT = argv.includes('--json')
const WRITE = argv.includes('--write')
const TOP_N = Number(arg('--top', '25')) || 25
const MIN_LEAVES = Number(arg('--min-leaves', '1')) || 1
const MAX_LEAVES_PER_CANDIDATE = Number(arg('--max-leaves-per-candidate', '30')) || 30
const SCENARIOS = resolve(arg('--scenarios', DEFAULT_SCENARIOS))
const OUTPUT = resolve(arg('--output', DEFAULT_OUTPUT))

function arg(flag: string, fallback: string): string {
  const i = argv.indexOf(flag)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
}

if (!existsSync(SCENARIOS)) {
  console.error(`scenario root not found: ${SCENARIOS}`)
  process.exit(2)
}

const registry = await loadRegistry()
const seeds = readScenarioSeeds(SCENARIOS)
const groups = buildDomainGroups(registry)
const candidates = buildCandidates({ groups, registry, seeds })
  .filter(
    (candidate) => candidate.leafIds.train.length + candidate.leafIds.holdout.length >= MIN_LEAVES,
  )
  .slice(0, TOP_N)

const report = {
  generatedAt: new Date().toISOString(),
  scenarioRoot: SCENARIOS,
  scenariosScanned: seeds.length,
  domainGroupsScanned: groups.length,
  candidates,
}

if (WRITE) {
  mkdirSync(dirname(OUTPUT), { recursive: true })
  writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`)
}

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log(`domain-pack candidates: ${candidates.length}`)
  for (const candidate of candidates) {
    const leafCount = candidate.leafIds.train.length + candidate.leafIds.holdout.length
    console.log(
      `  ${candidate.id}: ${leafCount} leaves, starter=${candidate.intendedStarter.family}, ` +
        `partners=${candidate.partnerIds.join(', ') || '(none)'}`,
    )
  }
  if (WRITE) console.log(`wrote ${relative(REPO, OUTPUT)}`)
}

function readScenarioSeeds(root: string): ScenarioSeed[] {
  const seeds: ScenarioSeed[] = []
  for (const file of listScenarioFiles(root)) {
    const text = readFileSync(file, 'utf8')
    for (const block of seedObjectBlocks(text)) {
      const leavesStart = block.search(/\bleaves\s*:/)
      const head = leavesStart >= 0 ? block.slice(0, leavesStart) : block
      const seedId = extractStringProperty(head, 'id')
      if (!seedId) continue
      seeds.push({
        id: seedId,
        category: extractStringProperty(head, 'category') ?? undefined,
        partner: extractStringProperty(head, 'partner') ?? undefined,
        scaffoldFamily: extractStringProperty(head, 'scaffoldFamily') ?? undefined,
        file,
        text: extractStringLiterals(head).join(' '),
        leaves: extractLeaves(block),
      })
    }
  }
  return seeds
}

function listScenarioFiles(root: string): string[] {
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      const stat = statSync(path)
      if (stat.isDirectory()) {
        if (name === '__tests__' || name === '.dispatch' || name === '_partners') continue
        walk(path)
        continue
      }
      if (!name.endsWith('.ts')) continue
      if (name.endsWith('.test.ts')) continue
      files.push(path)
    }
  }
  walk(root)
  return files.sort()
}

function extractLeaves(text: string): ScenarioLeaf[] {
  const arrayStart = findPropertyArrayStart(text, 'leaves')
  if (arrayStart < 0) return []
  const arrayEnd = findMatching(text, arrayStart, '[', ']')
  if (arrayEnd < 0) return []
  const body = text.slice(arrayStart + 1, arrayEnd)
  return topLevelObjectBlocks(body)
    .map((block) => {
      const id = extractStringProperty(block, 'id')
      if (!id) return null
      return {
        id,
        tags: extractArrayStrings(block, 'tags'),
        text: extractStringLiterals(block).join(' '),
        expectedFamily: extractStringProperty(block, 'expectedFamily') ?? undefined,
        loadBearingArtifact: extractStringProperty(block, 'loadBearingArtifact') ?? undefined,
      }
    })
    .filter((leaf): leaf is ScenarioLeaf => leaf !== null)
}

function seedObjectBlocks(text: string): string[] {
  const blocks: string[] = []
  for (let i = 0; i < text.length; i += 1) {
    i = skipTrivia(text, i)
    if (text[i] !== '{') continue
    const end = findMatching(text, i, '{', '}')
    if (end < 0) break
    const block = text.slice(i, end + 1)
    const leavesStart = block.search(/\bleaves\s*:/)
    if (leavesStart >= 0 && extractStringProperty(block.slice(0, leavesStart), 'id')) {
      blocks.push(block)
    }
    i = end
  }
  return blocks
}

function findPropertyArrayStart(text: string, property: string): number {
  const match = new RegExp(`\\b${property}\\s*:`).exec(text)
  if (!match) return -1
  const bracket = text.indexOf('[', match.index + match[0].length)
  return bracket
}

function topLevelObjectBlocks(body: string): string[] {
  const blocks: string[] = []
  for (let i = 0; i < body.length; i += 1) {
    i = skipTrivia(body, i)
    if (body[i] !== '{') continue
    const end = findMatching(body, i, '{', '}')
    if (end < 0) break
    blocks.push(body.slice(i, end + 1))
    i = end
  }
  return blocks
}

function findMatching(text: string, start: number, open: string, close: string): number {
  let depth = 0
  for (let i = start; i < text.length; i += 1) {
    const char = text[i]
    if (char === '"' || char === "'" || char === '`') {
      i = skipString(text, i)
      continue
    }
    if (char === '/' && text[i + 1] === '/') {
      i = skipLineComment(text, i)
      continue
    }
    if (char === '/' && text[i + 1] === '*') {
      i = skipBlockComment(text, i)
      continue
    }
    if (char === open) depth += 1
    if (char === close) {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

function skipTrivia(text: string, start: number): number {
  let i = start
  while (i < text.length) {
    if (/\s/.test(text[i] ?? '')) {
      i += 1
      continue
    }
    if (text[i] === '/' && text[i + 1] === '/') {
      i = skipLineComment(text, i) + 1
      continue
    }
    if (text[i] === '/' && text[i + 1] === '*') {
      i = skipBlockComment(text, i) + 1
      continue
    }
    break
  }
  return i
}

function skipString(text: string, quoteIndex: number): number {
  const quote = text[quoteIndex]
  for (let i = quoteIndex + 1; i < text.length; i += 1) {
    if (text[i] === '\\') {
      i += 1
      continue
    }
    if (text[i] === quote) return i
  }
  return text.length - 1
}

function skipLineComment(text: string, start: number): number {
  const end = text.indexOf('\n', start + 2)
  return end < 0 ? text.length - 1 : end
}

function skipBlockComment(text: string, start: number): number {
  const end = text.indexOf('*/', start + 2)
  return end < 0 ? text.length - 1 : end + 1
}

function extractStringProperty(text: string, property: string): string | null {
  const match = new RegExp(`\\b${property}\\s*:\\s*(['"\`])`).exec(text)
  if (!match) return null
  return readStringLiteral(text, match.index + match[0].length - 1)
}

function extractArrayStrings(text: string, property: string): string[] {
  const start = findPropertyArrayStart(text, property)
  if (start < 0) return []
  const end = findMatching(text, start, '[', ']')
  if (end < 0) return []
  return extractStringLiterals(text.slice(start + 1, end))
}

function extractStringLiterals(text: string): string[] {
  const values: string[] = []
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '"' || text[i] === "'" || text[i] === '`') {
      const value = readStringLiteral(text, i)
      if (value !== null) values.push(value)
      i = skipString(text, i)
      continue
    }
    if (text[i] === '/' && text[i + 1] === '/') {
      i = skipLineComment(text, i)
      continue
    }
    if (text[i] === '/' && text[i + 1] === '*') {
      i = skipBlockComment(text, i)
    }
  }
  return values
}

function readStringLiteral(text: string, quoteIndex: number): string | null {
  const quote = text[quoteIndex]
  let value = ''
  for (let i = quoteIndex + 1; i < text.length; i += 1) {
    const char = text[i]
    if (char === '\\') {
      value += text[i + 1] ?? ''
      i += 1
      continue
    }
    if (char === quote) return value
    value += char
  }
  return null
}

function buildDomainGroups(registry: Registry): DomainGroup[] {
  const groups = new Map<string, DomainGroup>()
  for (const entry of listDomainPackEntries(registry)) {
    const groupId =
      entry.pack.ambiguityGroup ??
      [entry.pack.domain.family, entry.pack.domain.surface].filter(Boolean).join('-')
    const group = groups.get(groupId) ?? {
      id: groupId,
      domain: entry.pack.domain,
      ambiguityGroup: entry.pack.ambiguityGroup,
      entries: [],
    }
    group.entries.push({ entry, terms: entryTerms(entry, registry) })
    groups.set(groupId, group)
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      domain: commonDomain(
        group.id,
        group.entries.map(({ entry }) => entry.pack.domain),
      ),
    }))
    .sort((left, right) => left.id.localeCompare(right.id))
}

function commonDomain(
  fallbackFamily: string,
  domains: Array<DomainPackMetadata['domain']>,
): DomainPackMetadata['domain'] {
  const common: DomainPackMetadata['domain'] = {
    family: commonField(domains, 'family') ?? fallbackFamily,
  }
  for (const key of ['provider', 'protocol', 'runtime', 'surface'] as const) {
    const value = commonField(domains, key)
    if (value) common[key] = value
  }
  return common
}

function commonField<K extends keyof DomainPackMetadata['domain']>(
  domains: Array<DomainPackMetadata['domain']>,
  key: K,
): DomainPackMetadata['domain'][K] | undefined {
  const first = domains[0]?.[key]
  if (!first) return undefined
  return domains.every((domain) => domain[key] === first) ? first : undefined
}

function entryTerms(entry: DomainPackEntry, registry: Registry): WeightedTerm[] {
  const terms = packTerms(entry.pack)
  if (entry.layerId) {
    const layer = registry.layers.get(entry.layerId)
    for (const keyword of layer?.keywords ?? []) {
      addTerm(terms, keyword, 4, true, true, false)
    }
  }
  return terms
}

function packTerms(pack: DomainPackMetadata): WeightedTerm[] {
  const terms: WeightedTerm[] = []
  addTerm(terms, pack.domain.family, 3, true, false, false)
  addTerm(terms, pack.domain.provider, 5, true, false, true)
  addTerm(terms, pack.domain.protocol, 5, true, false, true)
  addTerm(terms, pack.domain.runtime, 1, false, false, false)
  addTerm(terms, pack.domain.surface, 1, false, false, false)
  for (const value of pack.provides)
    addTerm(terms, value, 3, !TOOLCHAIN_PROVIDES.has(value), !TOOLCHAIN_PROVIDES.has(value), false)
  for (const value of pack.requires ?? []) addTerm(terms, value, 1, false, false, false)
  for (const value of pack.authenticitySignals ?? [])
    addTerm(terms, value, 2, true, semanticIntentSignal(value), false)
  return terms
}

function addTerm(
  terms: WeightedTerm[],
  value: string | undefined,
  weight: number,
  evidence: boolean,
  capabilityIntent: boolean,
  domainSpecific: boolean,
): void {
  if (!value) return
  const normalized = value.toLowerCase()
  if (GENERIC_TERMS.has(normalized)) return
  terms.push({ value, weight, evidence, capabilityIntent, domainSpecific })
  const spaced = value.replace(/[-_]+/g, ' ')
  if (spaced !== value)
    terms.push({ value: spaced, weight, evidence, capabilityIntent, domainSpecific })
}

function semanticIntentSignal(value: string): boolean {
  return !/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(value)
}

function buildCandidates({
  groups,
  registry,
  seeds,
}: {
  groups: DomainGroup[]
  registry: Registry
  seeds: ScenarioSeed[]
}): DomainPackWorkCandidate[] {
  const candidates: DomainPackWorkCandidate[] = []
  const seenCandidateIds = new Set<string>()
  for (const group of groups) {
    const evidence = evidenceForGroup(group, seeds)
    if (evidence.length === 0) continue

    addCandidate(
      candidates,
      seenCandidateIds,
      candidateFromEvidence({ id: group.id, group, entries: group.entries, registry, evidence }),
    )

    for (const entry of group.entries) {
      const entryGroup: DomainGroup = {
        ...group,
        id: entryCandidateId(group, entry),
        domain: entry.entry.pack.domain,
        entries: [entry],
      }
      const entryEvidence = evidenceForGroup(entryGroup, seeds)
      if (entryEvidence.length === 0) continue
      addCandidate(
        candidates,
        seenCandidateIds,
        candidateFromEvidence({
          id: entryGroup.id,
          group: entryGroup,
          entries: entryGroup.entries,
          registry,
          evidence: entryEvidence,
        }),
      )
    }

    const evidenceBySeed = groupEvidenceBySeed(evidence)
    for (const [seedId, seedEvidence] of evidenceBySeed) {
      if (seedEvidence.length < MIN_LEAVES) continue
      addCandidate(
        candidates,
        seenCandidateIds,
        candidateFromEvidence({
          id: `${group.id}-${slug(seedId)}`,
          group,
          entries: group.entries,
          registry,
          evidence: seedEvidence,
        }),
      )
    }
  }

  return candidates.sort((left, right) => {
    const leftLeaves = left.leafIds.train.length + left.leafIds.holdout.length
    const rightLeaves = right.leafIds.train.length + right.leafIds.holdout.length
    return (
      candidateTier(right) - candidateTier(left) ||
      rightLeaves - leftLeaves ||
      left.id.localeCompare(right.id)
    )
  })
}

function candidateTier(candidate: DomainPackWorkCandidate): number {
  const allFamilyFiles = candidate.registryFiles.every((file) =>
    file.startsWith('registry/families/'),
  )
  const allLayerFiles = candidate.registryFiles.every((file) => file.startsWith('registry/layers/'))
  const groupWide = candidate.ambiguityGroup === candidate.id
  const explicitRegistryEntry = candidate.registryFiles.length === 1
  if (groupWide && candidate.registryFiles.length > 1 && allFamilyFiles) return 8
  if (groupWide && candidate.registryFiles.length > 1 && allLayerFiles) return 7
  if (explicitRegistryEntry && allFamilyFiles) return 6
  if (explicitRegistryEntry && allLayerFiles) return 5
  if (candidate.registryFiles.length === 1 && allFamilyFiles) return 4
  if (candidate.registryFiles.length === 1 && allLayerFiles) return 3
  if (candidate.registryFiles.length > 1 && allFamilyFiles) return 2
  return 1
}

function addCandidate(
  candidates: DomainPackWorkCandidate[],
  seen: Set<string>,
  candidate: DomainPackWorkCandidate,
): void {
  if (seen.has(candidate.id)) return
  seen.add(candidate.id)
  candidates.push(candidate)
}

function candidateFromEvidence({
  id,
  group,
  entries,
  registry,
  evidence,
}: {
  id: string
  group: DomainGroup
  entries: GroupEntry[]
  registry: Registry
  evidence: Evidence[]
}): DomainPackWorkCandidate {
  const verticalIds = unique(evidence.map((item) => item.seed.id))
  const partnerIds = unique(evidence.map((item) => item.seed.partner).filter(isString))
  const selectedEvidence = evidence.slice(0, MAX_LEAVES_PER_CANDIDATE)
  const leafIds = splitLeaves(unique(selectedEvidence.map((item) => item.leaf.id)))
  const candidateGroup: DomainGroup = {
    ...group,
    id,
    entries,
    domain: commonDomain(
      id,
      entries.map(({ entry }) => entry.pack.domain),
    ),
  }
  const intendedStarter = intendedStarterFor(candidateGroup, registry, evidence)
  const registryFiles = unique(entries.map(({ entry }) => registryFileFor(entry)))
  const sourceFiles = unique(selectedEvidence.map((item) => relative(REPO, item.seed.file)))
  const routingPrompts = unique(
    entries.flatMap(({ entry }) =>
      (entry.pack.routingPrompts ?? []).map((prompt) => prompt.prompt),
    ),
  )
  const validationCommands = unique(
    entries.flatMap(({ entry }) => entry.pack.validationCommands ?? []),
  )
  const authenticitySignals = unique(
    entries.flatMap(({ entry }) => entry.pack.authenticitySignals ?? []),
  )
  const authenticityGroups =
    entries.length === 1
      ? uniqueAuthenticityGroups(
          entries.flatMap(({ entry }) => entry.pack.authenticityGroups ?? []),
        )
      : []

  return {
    id,
    status: 'candidate',
    domain: candidateGroup.domain,
    ambiguityGroup: group.ambiguityGroup,
    verticalIds,
    leafIds,
    partnerIds,
    failureEvidence: [
      {
        source: 'blueprint-agent-scenarios',
        bucket: 'vertical-leaf-demand',
        count: evidence.length,
      },
    ],
    intendedStarter,
    routingPrompts,
    validationCommands,
    authenticitySignals,
    ...(authenticityGroups.length > 0 ? { authenticityGroups } : {}),
    registryFiles,
    filesToModify: unique([
      ...registryFiles,
      'tests/domain-packs.test.ts',
      'tests/coverage.test.ts',
    ]),
    gatesToRun: unique([
      'pnpm exec tsx scripts/validate-registry.ts',
      'pnpm build',
      'pnpm exec tsc -p tsconfig.test.json',
      'node --test --test-concurrency=1 dist-tests/domain-packs.test.js dist-tests/coverage.test.js',
      ...validationCommands,
    ]),
    sourceFiles,
  }
}

function entryCandidateId(group: DomainGroup, entry: GroupEntry): string {
  return `${group.id}-${slug(entry.entry.ownerId)}`
}

function groupEvidenceBySeed(evidence: Evidence[]): Map<string, Evidence[]> {
  const bySeed = new Map<string, Evidence[]>()
  for (const item of evidence) {
    const bucket = bySeed.get(item.seed.id) ?? []
    bucket.push(item)
    bySeed.set(item.seed.id, bucket)
  }
  return new Map(
    [...bySeed.entries()].sort((left, right) => {
      const leftScore = sum(left[1].map((item) => item.score))
      const rightScore = sum(right[1].map((item) => item.score))
      return rightScore - leftScore || left[0].localeCompare(right[0])
    }),
  )
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function evidenceForGroup(group: DomainGroup, seeds: ScenarioSeed[]): Evidence[] {
  const evidence: Evidence[] = []
  const singleEntry = group.entries.length === 1 ? group.entries[0] : null
  const requiresCapabilityIntent = singleEntry !== null && singleEntry.entry.ownerKind === 'layer'
  const requiresDomainSpecific =
    singleEntry !== null &&
    Boolean(singleEntry.entry.pack.domain.provider || singleEntry.entry.pack.domain.protocol)
  for (const seed of seeds) {
    const seedScore = scoreText(seed.text, group)
    for (const leaf of seed.leaves) {
      if (!leafMatchesDomainSurface(group, seed, leaf)) continue
      const leafScore = scoreText(leafEvidenceText(seed, leaf), group)
      if (leafScore.evidence <= 0) continue
      if (requiresCapabilityIntent && leafScore.capabilityIntent <= 0) continue
      if (requiresDomainSpecific && seedScore.domainSpecific + leafScore.domainSpecific <= 0)
        continue
      evidence.push({ seed, leaf, score: leafScore.score + Math.min(seedScore.score, 6) })
    }
  }
  return evidence.sort(
    (left, right) => right.score - left.score || left.leaf.id.localeCompare(right.leaf.id),
  )
}

function leafMatchesDomainSurface(
  group: DomainGroup,
  seed: ScenarioSeed,
  leaf: ScenarioLeaf,
): boolean {
  const target = normalizeSurface(group.domain.surface)
  if (!target || !KNOWN_SURFACES.has(target)) return true

  const profile = leafSurfaceProfile(seed, leaf)
  if (profile.explicit.size > 0) {
    return [...profile.explicit].some((surface) => surfacesCompatible(target, surface))
  }

  const targetScore = surfaceScore(profile.scores, target)
  const strongestScore = Math.max(0, ...profile.scores.values())
  if (strongestScore === 0) return true
  if (targetScore === 0) return false

  return targetScore + 1 >= strongestScore
}

function leafSurfaceProfile(
  seed: ScenarioSeed,
  leaf: ScenarioLeaf,
): { explicit: Set<string>; scores: Map<string, number> } {
  const explicit = new Set<string>()
  const scores = new Map<string, number>()
  const addExplicit = (surface: string): void => {
    const normalized = normalizeSurface(surface)
    if (normalized) explicit.add(normalized)
  }
  const addScore = (surface: string, score: number): void => {
    const normalized = normalizeSurface(surface)
    if (!normalized) return
    scores.set(normalized, (scores.get(normalized) ?? 0) + score)
  }

  for (const surface of artifactSurfaces(leaf.loadBearingArtifact)) addExplicit(surface)
  for (const surface of familySurfaces(leaf.expectedFamily)) addExplicit(surface)

  const text = leafEvidenceText(seed, leaf).toLowerCase()
  for (const [surface, patterns] of Object.entries(SURFACE_TERMS)) {
    for (const [pattern, weight] of patterns) {
      if (pattern.test(text)) addScore(surface, weight)
    }
  }

  return { explicit, scores }
}

function artifactSurfaces(value: string | undefined): string[] {
  if (!value) return []
  return ARTIFACT_SURFACES[value.toLowerCase()] ?? []
}

function familySurfaces(value: string | undefined): string[] {
  if (!value) return []
  const lower = value.toLowerCase()
  return FAMILY_SURFACES.flatMap(([pattern, surfaces]) => (pattern.test(lower) ? surfaces : []))
}

function normalizeSurface(value: string | undefined): string | null {
  if (!value) return null
  const lower = value.toLowerCase()
  if (/contracts?|solidity|evm/.test(lower)) return 'contracts'
  if (/ui|frontend|front-end|interface|dashboard|viewer|app/.test(lower)) return 'ui'
  if (/indexer|analytics|monitor|relayer/.test(lower)) return 'indexer'
  if (/api|backend|server/.test(lower)) return 'api'
  if (/worker|job|cron/.test(lower)) return 'worker'
  if (/research|analysis|docs?/.test(lower)) return 'research'
  return lower
}

function surfaceScore(scores: Map<string, number>, target: string): number {
  let total = scores.get(target) ?? 0
  for (const [surface, score] of scores) {
    if (surface !== target && surfacesCompatible(target, surface)) total += score
  }
  return total
}

function surfacesCompatible(target: string, observed: string): boolean {
  if (target === observed) return true
  if (target === 'indexer') return observed === 'api' || observed === 'worker'
  if (target === 'api') return observed === 'indexer'
  return false
}

function leafEvidenceText(seed: ScenarioSeed, leaf: ScenarioLeaf): string {
  return [
    seed.id,
    seed.category,
    seed.partner,
    seed.scaffoldFamily,
    leaf.loadBearingArtifact,
    leaf.expectedFamily,
    leaf.text,
    leaf.tags.join(' '),
  ]
    .filter(isString)
    .join(' ')
}

function scoreText(
  text: string,
  group: DomainGroup,
): {
  score: number
  evidence: number
  capabilityIntent: number
  domainSpecific: number
} {
  const lower = text.toLowerCase()
  let score = 0
  let evidence = 0
  let capabilityIntent = 0
  let domainSpecific = 0
  const seen = new Set<string>()
  for (const { terms } of group.entries) {
    for (const term of terms) {
      const normalized = term.value.toLowerCase()
      if (seen.has(normalized)) continue
      if (!matchesTerm(lower, normalized)) continue
      seen.add(normalized)
      score += term.weight
      if (term.evidence) evidence += term.weight
      if (term.capabilityIntent) capabilityIntent += term.weight
      if (term.domainSpecific) domainSpecific += term.weight
    }
  }
  return { score, evidence, capabilityIntent, domainSpecific }
}

function matchesTerm(lowerText: string, normalizedTerm: string): boolean {
  if (/^[a-z0-9]+$/.test(normalizedTerm)) {
    const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(lowerText)
  }
  return lowerText.includes(normalizedTerm)
}

function intendedStarterFor(
  group: DomainGroup,
  registry: Registry,
  evidence: Evidence[],
): { family: string; layers: string[]; capabilities: string[] } {
  const pinned = evidence
    .map((item) => item.seed.scaffoldFamily)
    .find((family): family is string =>
      Boolean(
        family && registry.families.has(family) && groupSupportsFamily(group, registry, family),
      ),
    )
  if (pinned) {
    return {
      family: pinned,
      layers: frameworkLayersForFamily(registry, pinned),
      capabilities: domainCapabilitiesForFamily(group, registry, pinned),
    }
  }

  const routed = group.entries
    .flatMap(({ entry }) => entry.pack.routingPrompts ?? [])
    .find((prompt) => registry.families.has(prompt.expectedFamily))
  if (routed) {
    return {
      family: routed.expectedFamily,
      layers: routed.expectedLayers ?? frameworkLayersForFamily(registry, routed.expectedFamily),
      capabilities: (routed.expectedLayers ?? []).filter((layer) =>
        layer.startsWith('capability:'),
      ),
    }
  }

  for (const { entry } of group.entries) {
    if (entry.ownerKind === 'family' && entry.familyId) {
      return {
        family: entry.familyId,
        layers: frameworkLayersForFamily(registry, entry.familyId),
        capabilities: domainCapabilitiesForFamily(group, registry, entry.familyId),
      }
    }
    if (entry.ownerKind === 'layer' && entry.layerId) {
      const layer = registry.layers.get(entry.layerId)
      const family = layer?.appliesTo?.find((id) => registry.families.has(id))
      if (family) {
        return {
          family,
          layers: [...frameworkLayersForFamily(registry, family), entry.layerId],
          capabilities: [entry.layerId],
        }
      }
    }
  }

  return { family: 'unknown', layers: [], capabilities: [] }
}

function groupSupportsFamily(group: DomainGroup, registry: Registry, familyId: string): boolean {
  return group.entries.some(({ entry }) => {
    if (entry.familyId === familyId) return true
    if (!entry.layerId) return false
    return registry.layers.get(entry.layerId)?.appliesTo?.includes(familyId) ?? false
  })
}

function frameworkLayersForFamily(registry: Registry, familyId: string): string[] {
  const layers: string[] = []
  for (const [id, layer] of registry.layers) {
    if (layer.group === 'framework' && layer.appliesTo?.includes(familyId)) layers.push(id)
  }
  return layers
}

function domainCapabilitiesForFamily(
  group: DomainGroup,
  registry: Registry,
  familyId: string,
): string[] {
  return group.entries
    .map(({ entry }) => entry.layerId)
    .filter(isString)
    .filter((layerId) => registry.layers.get(layerId)?.appliesTo?.includes(familyId))
}

function registryFileFor(entry: DomainPackEntry): string {
  if (entry.ownerKind === 'family') return `registry/families/${entry.ownerId}/manifest.json`
  const [group, id] = entry.ownerId.split(':')
  return `registry/layers/${group}/${id}/manifest.json`
}

function splitLeaves(ids: string[]): { train: string[]; holdout: string[] } {
  const train: string[] = []
  const holdout: string[] = []
  ids.forEach((id, index) => {
    if (index % 3 === 2) holdout.push(id)
    else train.push(id)
  })
  if (holdout.length === 0 && train.length > 1) holdout.push(train.pop()!)
  return { train, holdout }
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)].sort()
}

function uniqueAuthenticityGroups(
  groups: DomainPackAuthenticityGroup[],
): DomainPackAuthenticityGroup[] {
  const byId = new Map<string, DomainPackAuthenticityGroup>()
  for (const group of groups) {
    const existing = byId.get(group.id)
    byId.set(group.id, {
      ...group,
      description: group.description ?? existing?.description,
      minRequired: Math.max(existing?.minRequired ?? 0, group.minRequired ?? 1),
      signals: unique([...(existing?.signals ?? []), ...group.signals]),
    })
  }
  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id))
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}
