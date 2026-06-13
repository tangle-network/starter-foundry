#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { listDomainPackEntries, type DomainPackEntry } from '../src/lib/domain-packs.js'
import { loadRegistry } from '../src/lib/registry.js'
import type { DomainPackMetadata, Registry } from '../src/types.js'

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
    const leavesStart = text.search(/\bleaves\s*:/)
    const head = leavesStart >= 0 ? text.slice(0, leavesStart) : text
    const seedId = extractStringProperty(head, 'id')
    if (!seedId) continue
    const seedText = extractStringLiterals(text).join(' ')
    seeds.push({
      id: seedId,
      category: extractStringProperty(head, 'category') ?? undefined,
      partner: extractStringProperty(head, 'partner') ?? undefined,
      scaffoldFamily: extractStringProperty(head, 'scaffoldFamily') ?? undefined,
      file,
      text: seedText,
      leaves: extractLeaves(text),
    })
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
    group.entries.push({ entry, terms: packTerms(entry.pack) })
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

function packTerms(pack: DomainPackMetadata): WeightedTerm[] {
  const terms: WeightedTerm[] = []
  const add = (value: string | undefined, weight: number, evidence: boolean) => {
    if (!value) return
    const normalized = value.toLowerCase()
    if (GENERIC_TERMS.has(normalized)) return
    terms.push({ value, weight, evidence })
    const spaced = value.replace(/[-_]+/g, ' ')
    if (spaced !== value) terms.push({ value: spaced, weight, evidence })
  }
  add(pack.domain.family, 3, true)
  add(pack.domain.provider, 5, true)
  add(pack.domain.protocol, 5, true)
  add(pack.domain.runtime, 1, false)
  add(pack.domain.surface, 1, false)
  for (const value of pack.provides) add(value, 3, !TOOLCHAIN_PROVIDES.has(value))
  for (const value of pack.requires ?? []) add(value, 1, false)
  for (const value of pack.authenticitySignals ?? []) add(value, 2, true)
  return terms
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
  for (const group of groups) {
    const evidence = evidenceForGroup(group, seeds)
    if (evidence.length === 0) continue

    const verticalIds = unique(evidence.map((item) => item.seed.id))
    const partnerIds = unique(evidence.map((item) => item.seed.partner).filter(isString))
    const selectedEvidence = evidence.slice(0, MAX_LEAVES_PER_CANDIDATE)
    const leafIds = splitLeaves(unique(selectedEvidence.map((item) => item.leaf.id)))
    const intendedStarter = intendedStarterFor(group, registry, evidence)
    const registryFiles = unique(group.entries.map(({ entry }) => registryFileFor(entry)))
    const sourceFiles = unique(selectedEvidence.map((item) => relative(REPO, item.seed.file)))
    const routingPrompts = unique(
      group.entries.flatMap(({ entry }) =>
        (entry.pack.routingPrompts ?? []).map((prompt) => prompt.prompt),
      ),
    )
    const validationCommands = unique(
      group.entries.flatMap(({ entry }) => entry.pack.validationCommands ?? []),
    )
    const authenticitySignals = unique(
      group.entries.flatMap(({ entry }) => entry.pack.authenticitySignals ?? []),
    )

    candidates.push({
      id: group.id,
      status: 'candidate',
      domain: group.domain,
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
    })
  }

  return candidates.sort((left, right) => {
    const leftLeaves = left.leafIds.train.length + left.leafIds.holdout.length
    const rightLeaves = right.leafIds.train.length + right.leafIds.holdout.length
    return rightLeaves - leftLeaves || left.id.localeCompare(right.id)
  })
}

function evidenceForGroup(group: DomainGroup, seeds: ScenarioSeed[]): Evidence[] {
  const evidence: Evidence[] = []
  for (const seed of seeds) {
    const seedScore = scoreText(seed.text, group)
    for (const leaf of seed.leaves) {
      const score = scoreText(`${seed.text} ${leaf.text} ${leaf.tags.join(' ')}`, group)
      if (Math.max(seedScore.evidence, score.evidence) <= 0) continue
      evidence.push({ seed, leaf, score: Math.max(seedScore.score, score.score) })
    }
  }
  return evidence.sort(
    (left, right) => right.score - left.score || left.leaf.id.localeCompare(right.leaf.id),
  )
}

function scoreText(text: string, group: DomainGroup): { score: number; evidence: number } {
  const lower = text.toLowerCase()
  let score = 0
  let evidence = 0
  const seen = new Set<string>()
  for (const { terms } of group.entries) {
    for (const term of terms) {
      const normalized = term.value.toLowerCase()
      if (seen.has(normalized)) continue
      if (!matchesTerm(lower, normalized)) continue
      seen.add(normalized)
      score += term.weight
      if (term.evidence) evidence += term.weight
    }
  }
  return { score, evidence }
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

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}
