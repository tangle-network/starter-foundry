import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'

import { ax } from '@ax-llm/ax'

import { createLLM, isLLMAvailable } from './llm.js'

const CACHE_DIR = '.evolve'
const CACHE_PATH = path.join(CACHE_DIR, 'product-brief-cache.json')
const MAX_LRU = 256

export interface ProductBrief {
  canonicalPrompt: string
  vision: string
  taskChecklist: string[]
  milestones: string[]
  testingPlan: string[]
  e2ePlan: string[]
  securityConcerns: string[]
  openQuestions: string[]
  confidence: number
}

export interface BriefArgs {
  prompt: string
  partner?: string | null
  knownFamilies: string[]
  knownCapabilities: string[]
}

export interface BriefResult {
  brief: ProductBrief
  cacheHit: boolean
  latencyMs: number
}

export type BriefFn = (args: BriefArgs) => Promise<BriefResult | null>

const inMemLRU = new Map<string, ProductBrief>()
let diskCache: Map<string, ProductBrief> | null = null
let testOverride: BriefFn | null = null

export function __setTestBrief(fn: BriefFn | null): void {
  testOverride = fn
}

function hashKey(prompt: string, partner: string | null): string {
  return createHash('sha1')
    .update(`brief::${prompt}::${partner ?? ''}`)
    .digest('hex')
    .slice(0, 16)
}

async function loadDiskCache(): Promise<Map<string, ProductBrief>> {
  if (diskCache) return diskCache
  try {
    const raw = await fs.readFile(CACHE_PATH, 'utf8')
    const obj = JSON.parse(raw) as Record<string, ProductBrief>
    diskCache = new Map(Object.entries(obj))
  } catch {
    diskCache = new Map()
  }
  return diskCache
}

async function persistDiskCache(): Promise<void> {
  if (!diskCache) return
  await fs.mkdir(CACHE_DIR, { recursive: true })
  const obj: Record<string, ProductBrief> = {}
  for (const [k, v] of diskCache) obj[k] = v
  await fs.writeFile(CACHE_PATH, JSON.stringify(obj, null, 2))
}

// Rich brief generator: one LLM call yields everything the downstream pipeline
// needs — the canonical routing prompt AND the product plan. Signatures use
// ax's field-description syntax so the model knows what each field should
// contain without needing a prose system prompt.
const briefAgent = ax(
  [
    '"Turn a user product prompt into a structured product brief that drives a deterministic scaffold pipeline downstream. The canonicalPrompt must be a keyword-rich expansion that names concrete technologies drawn from knownFamilies (e.g. nextjs-ts, fullstack-ts, agent-service-ts, go-api, python-api, forge-contracts, solana-program) and concrete UI/infra capabilities drawn from knownCapabilities (e.g. capability:ai-chat-ui, capability:layout-dashboard, capability:saas-billing). It MUST be longer and more specific than the user prompt. Preserve the user intent exactly — do not invent features. The brief is for humans AND for AI agents that will build the project, so be concrete and specific. Each list field should have 3-8 items." ',
    'userPrompt:string, ',
    'knownFamilies:string[], ',
    'knownCapabilities:string[] ',
    '-> ',
    'canonicalPrompt:string, ',
    'vision:string, ',
    'taskChecklist:string[], ',
    'milestones:string[], ',
    'testingPlan:string[], ',
    'e2ePlan:string[], ',
    'securityConcerns:string[], ',
    'openQuestions:string[], ',
    'confidence:number',
  ].join(''),
)

function normalizeConfidence(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0.5
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}

function sanitizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => String(v).trim()).filter(Boolean)
}

async function generateProductBriefImpl({
  prompt,
  partner = null,
  knownFamilies,
  knownCapabilities,
}: BriefArgs): Promise<BriefResult | null> {
  const key = hashKey(prompt, partner)

  const mem = inMemLRU.get(key)
  if (mem) return { brief: mem, cacheHit: true, latencyMs: 0 }

  const disk = await loadDiskCache()
  const cached = disk.get(key)
  if (cached) {
    inMemLRU.set(key, cached)
    return { brief: cached, cacheHit: true, latencyMs: 0 }
  }

  if (!isLLMAvailable()) return null

  const llm = createLLM()
  const t0 = performance.now()
  let raw: Partial<ProductBrief>
  try {
    raw = (await briefAgent.forward(
      llm,
      {
        userPrompt: prompt,
        knownFamilies,
        knownCapabilities,
      },
      { stream: false },
    )) as Partial<ProductBrief>
  } catch {
    return null
  }
  const latencyMs = performance.now() - t0

  const canonicalPrompt = (raw.canonicalPrompt ?? '').trim()
  if (!canonicalPrompt) return null

  const brief: ProductBrief = {
    canonicalPrompt,
    vision: (raw.vision ?? '').trim(),
    taskChecklist: sanitizeList(raw.taskChecklist),
    milestones: sanitizeList(raw.milestones),
    testingPlan: sanitizeList(raw.testingPlan),
    e2ePlan: sanitizeList(raw.e2ePlan),
    securityConcerns: sanitizeList(raw.securityConcerns),
    openQuestions: sanitizeList(raw.openQuestions),
    confidence: normalizeConfidence(raw.confidence),
  }

  inMemLRU.set(key, brief)
  if (inMemLRU.size > MAX_LRU) {
    const first = inMemLRU.keys().next().value
    if (typeof first === 'string') inMemLRU.delete(first)
  }
  disk.set(key, brief)
  persistDiskCache().catch(() => {})

  return { brief, cacheHit: false, latencyMs }
}

export function generateProductBrief(args: BriefArgs): Promise<BriefResult | null> {
  return (testOverride ?? generateProductBriefImpl)(args)
}
