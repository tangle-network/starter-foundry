import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'

import { ax } from '@ax-llm/ax'

import { createLLM, isLLMAvailable } from './llm.js'
import type { ProductBrief } from './product-brief.js'
import { generateProductBrief } from './product-brief.js'

const CACHE_DIR = '.evolve'
const CACHE_PATH = path.join(CACHE_DIR, 'rewriter-cache.json')
const MAX_LRU = 256

const inMemLRU = new Map<string, string>()
let diskCache: Map<string, string> | null = null

function hashKey(prompt: string, partner: string | null): string {
  return createHash('sha1')
    .update(`${prompt}::${partner ?? ''}`)
    .digest('hex')
    .slice(0, 16)
}

async function loadDiskCache(): Promise<Map<string, string>> {
  if (diskCache) return diskCache
  try {
    const raw = await fs.readFile(CACHE_PATH, 'utf8')
    const obj = JSON.parse(raw) as Record<string, string>
    diskCache = new Map(Object.entries(obj))
  } catch {
    diskCache = new Map()
  }
  return diskCache
}

async function persistDiskCache(): Promise<void> {
  if (!diskCache) return
  await fs.mkdir(CACHE_DIR, { recursive: true })
  const obj: Record<string, string> = {}
  for (const [k, v] of diskCache) obj[k] = v
  await fs.writeFile(CACHE_PATH, JSON.stringify(obj, null, 2))
}

// The rewriter expands vague prompts into canonical keyword-rich expansions
// that the deterministic router can score confidently. It must not invent
// features the user didn't ask for — only surface implicit intent.
const rewriterAgent = ax(
  '"Expand the userPrompt into a canonical, keyword-rich product spec that names concrete technologies drawn from knownFamilies (e.g. nextjs-ts, fullstack-ts, agent-service-ts) and concrete UI/infra patterns drawn from knownCapabilities (e.g. capability:layout-dashboard, capability:ai-chat-ui, capability:saas-billing). The expansion MUST be longer and more specific than the input. Preserve the user intent exactly — do not invent features. Keep the output to 1-3 sentences of plain English that the user could have written themselves." userPrompt:string, knownFamilies:string[], knownCapabilities:string[] -> canonicalPrompt:string, confidence:number',
)

interface RewriteResult {
  canonicalPrompt: string
  confidence: number
  cacheHit: boolean
  latencyMs: number
}

interface RewriteArgs {
  prompt: string
  partner?: string | null
  knownFamilies: string[]
  knownCapabilities: string[]
}

type RewriterFn = (args: RewriteArgs) => Promise<RewriteResult | null>

let testOverride: RewriterFn | null = null
export function __setTestRewriter(fn: RewriterFn | null): void {
  testOverride = fn
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0.5
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}

async function rewritePromptImpl({
  prompt,
  partner = null,
  knownFamilies,
  knownCapabilities,
}: RewriteArgs): Promise<RewriteResult | null> {
  const key = hashKey(prompt, partner)

  const mem = inMemLRU.get(key)
  if (mem) return { canonicalPrompt: mem, confidence: 1, cacheHit: true, latencyMs: 0 }

  const disk = await loadDiskCache()
  const cached = disk.get(key)
  if (cached) {
    inMemLRU.set(key, cached)
    return { canonicalPrompt: cached, confidence: 1, cacheHit: true, latencyMs: 0 }
  }

  if (!isLLMAvailable()) return null

  const t0 = performance.now()
  const llm = createLLM()
  let raw: { canonicalPrompt?: string; confidence?: number }
  try {
    raw = await rewriterAgent.forward(llm, {
      userPrompt: prompt,
      knownFamilies,
      knownCapabilities,
    })
  } catch {
    return null
  }
  const latencyMs = performance.now() - t0

  const canonical = (raw.canonicalPrompt ?? '').trim()
  if (!canonical) return null

  // Post-audit guardrail — the signature promises "MUST be longer and more
  // specific than the input", but models sometimes compress instead. If the
  // expansion came back shorter, the rewriter has regressed the signal the
  // router needs. Reject the result and let the caller fall back to the raw
  // prompt rather than silently handing the router a degraded input.
  //
  // Use a 90% heuristic: allow trivial re-ordering (punctuation, casing) but
  // reject anything meaningfully shorter than the input.
  if (canonical.length < prompt.length * 0.9) {
    return null
  }

  const confidence = normalizeConfidence(raw.confidence)

  inMemLRU.set(key, canonical)
  if (inMemLRU.size > MAX_LRU) {
    const first = inMemLRU.keys().next().value
    if (typeof first === 'string') inMemLRU.delete(first)
  }
  disk.set(key, canonical)
  persistDiskCache().catch(() => {})

  return { canonicalPrompt: canonical, confidence, cacheHit: false, latencyMs }
}

export function rewritePrompt(args: RewriteArgs): Promise<RewriteResult | null> {
  return (testOverride ?? rewritePromptImpl)(args)
}

// Product-brief path: replaces the narrow rewriter with a rich brief. Returns
// the canonical prompt (for the router) and the full brief (for the build plan
// and context pack). Cached and keyed separately from the narrow rewriter.
export async function rewriteViaBrief(args: RewriteArgs): Promise<{
  canonicalPrompt: string
  brief: ProductBrief
  cacheHit: boolean
  latencyMs: number
} | null> {
  const result = await generateProductBrief({
    prompt: args.prompt,
    partner: args.partner ?? null,
    knownFamilies: args.knownFamilies,
    knownCapabilities: args.knownCapabilities,
  })
  if (!result) return null
  return {
    canonicalPrompt: result.brief.canonicalPrompt,
    brief: result.brief,
    cacheHit: result.cacheHit,
    latencyMs: result.latencyMs,
  }
}
