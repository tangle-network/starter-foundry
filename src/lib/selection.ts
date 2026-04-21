import { fuzzyKeywordScore } from './keywords.js'
import { loadRegistry } from './registry.js'
import { semanticMatch, isSemanticRouterReady } from './semantic-router.js'
import type { SelectionResult, Confidence, ComposeSpec, Registry } from '../types.js'

const TIER_WEIGHTS = { tier1: 4, tier2: 2, tier3: 1, archetypes: 3 } as const
type Tier = keyof typeof TIER_WEIGHTS

interface Candidate {
  family: string
  layers: string[]
  score: number
  reasons: string[]
}

interface FamilyWeight {
  family: string
  weight: number
}

interface SelectionIndex {
  /** Tokenized single-word keyword -> family contributions. */
  singleWord: Map<string, FamilyWeight[]>
  /** Multi-word keyword -> family contributions. */
  multiWord: Map<string, FamilyWeight[]>
  /**
   * 2-gram prefilter bucket: first-two-char prefix -> keywords starting with it.
   * A prompt can only substring-match a keyword if the keyword's prefix
   * appears as consecutive chars somewhere in the (lowercase) prompt.
   */
  multiWordByPrefix: Map<string, string[]>
  /** Keywords with length < 2 (rare) — scan unconditionally. */
  multiWordShort: string[]
  /** Precomputed framework layers per family. */
  frameworkLayers: Map<string, string[]>
  /** All family ids, for ordered iteration + default candidate list. */
  familyIds: string[]
}

/**
 * matchesKeyword semantics: multi-word / contains space|dot|slash|dash →
 * case-insensitive substring. Else word-bounded regex \b<kw>\b.
 *
 * For the inverted index we treat the second class as "single-word tokens"
 * and bucket them into the tokenizer path. Tokenizer mirrors \w semantics
 * (a–z, 0–9, underscore) so keywords like "private_key" stay intact.
 */
function isMultiWord(keyword: string): boolean {
  return (
    keyword.includes(' ') ||
    keyword.includes('.') ||
    keyword.includes('/') ||
    keyword.includes('-')
  )
}

function buildIndex(registry: Registry): SelectionIndex {
  const singleWord = new Map<string, FamilyWeight[]>()
  const multiWord = new Map<string, FamilyWeight[]>()
  const frameworkLayers = new Map<string, string[]>()
  const familyIds: string[] = []

  for (const family of registry.families.values()) {
    familyIds.push(family.id)

    // Precompute framework layers per family
    const layers: string[] = []
    for (const [key, layer] of registry.layers) {
      if (layer.group === 'framework' && layer.appliesTo?.includes(family.id)) {
        layers.push(key)
      }
    }
    frameworkLayers.set(family.id, layers)

    const tk = family.tieredKeywords
    if (!tk) {
      // Fallback: flat keywords scored as weight 1 each (matches keywordScore)
      if (family.keywords?.length) {
        for (const raw of family.keywords) {
          addKeyword(singleWord, multiWord, raw, family.id, 1)
        }
      }
      continue
    }

    // Per-family scoring.boost — optional map of keyword → extra weight added
    // ONLY when the keyword also appears in a tiered list. Boost-only keywords
    // (not in any tier) are intentionally ignored here: registering them
    // silently as tier2-equivalents caused routing thrash where a specialty
    // family's broad boost term ("aptos", "qlora") outscored the proper sibling
    // family on off-topic prompts. Specialty-family overrides for distinctive
    // phrases live in prompt-planner.ts instead.
    const boost = (family.scoring as { boost?: Record<string, number> } | undefined)?.boost ?? {}

    for (const tier of ['tier1', 'tier2', 'tier3', 'archetypes'] as const satisfies readonly Tier[]) {
      const weight = TIER_WEIGHTS[tier]
      const list = tk[tier]
      if (!list?.length) continue
      for (const raw of list) {
        const extra = boost[raw.toLowerCase()] ?? 0
        addKeyword(singleWord, multiWord, raw, family.id, weight + extra)
      }
    }
  }

  // Bucket multi-word keywords by 2-char prefix. A 2-gram derived from the
  // prompt is the cheapest sound precondition for a substring hit.
  const multiWordByPrefix = new Map<string, string[]>()
  const multiWordShort: string[] = []
  for (const keyword of multiWord.keys()) {
    if (keyword.length < 2) {
      multiWordShort.push(keyword)
      continue
    }
    const prefix = keyword.slice(0, 2)
    const bucket = multiWordByPrefix.get(prefix)
    if (bucket) bucket.push(keyword)
    else multiWordByPrefix.set(prefix, [keyword])
  }

  return { singleWord, multiWord, multiWordByPrefix, multiWordShort, frameworkLayers, familyIds }
}

function addKeyword(
  singleWord: Map<string, FamilyWeight[]>,
  multiWord: Map<string, FamilyWeight[]>,
  raw: string,
  family: string,
  weight: number,
): void {
  const kw = raw.toLowerCase()
  const bucket = isMultiWord(kw) ? multiWord : singleWord
  appendWeight(bucket, kw, family, weight)
}

function appendWeight(
  bucket: Map<string, FamilyWeight[]>,
  keyword: string,
  family: string,
  weight: number,
): void {
  const existing = bucket.get(keyword)
  if (!existing) {
    bucket.set(keyword, [{ family, weight }])
    return
  }
  // Merge same family into a single entry — avoids double hits at query time
  // when the same keyword appears in multiple tiers of one family (rare, but
  // the legacy scorer counted each tier independently).
  const same = existing.find((e) => e.family === family)
  if (same) {
    same.weight += weight
  } else {
    existing.push({ family, weight })
  }
}

/**
 * Tokenize the prompt the same way \w word-boundaries behave in JS regex.
 * \w = [A-Za-z0-9_]. After lowercasing we split on runs of everything else.
 */
function tokenize(lower: string): Set<string> {
  const tokens = new Set<string>()
  const parts = lower.split(/[^a-z0-9_]+/)
  for (const part of parts) {
    if (part) tokens.add(part)
  }
  return tokens
}

let cachedRegistry: Registry | null = null
let cachedIndex: SelectionIndex | null = null

function getIndex(registry: Registry): SelectionIndex {
  if (cachedRegistry !== registry || !cachedIndex) {
    cachedIndex = buildIndex(registry)
    cachedRegistry = registry
  }
  return cachedIndex
}

/**
 * Score every family in one prompt-scan pass. Returns per-family totals that
 * are bit-exact with scoreFamilyTiered summed over all families.
 */
function scoreAllFamilies(prompt: string, index: SelectionIndex): Map<string, number> {
  const scores = new Map<string, number>()
  const lower = prompt.toLowerCase()

  // Single-word path: tokenize once, look up each token in the index.
  const tokens = tokenize(lower)
  for (const token of tokens) {
    const hits = index.singleWord.get(token)
    if (!hits) continue
    for (const hit of hits) {
      scores.set(hit.family, (scores.get(hit.family) ?? 0) + hit.weight)
    }
  }

  // Multi-word path: 2-gram prefilter — only scan keywords whose 2-char
  // prefix appears in the prompt. A keyword can only be a substring of the
  // prompt if its first two chars appear as consecutive chars somewhere.
  const promptLen = lower.length
  const seenPrefixes = new Set<string>()
  for (let i = 0; i + 1 < promptLen; i++) {
    const prefix = lower.slice(i, i + 2)
    if (seenPrefixes.has(prefix)) continue
    seenPrefixes.add(prefix)
    const bucket = index.multiWordByPrefix.get(prefix)
    if (!bucket) continue
    for (const keyword of bucket) {
      if (!lower.includes(keyword)) continue
      const hits = index.multiWord.get(keyword)
      if (!hits) continue
      for (const hit of hits) {
        scores.set(hit.family, (scores.get(hit.family) ?? 0) + hit.weight)
      }
    }
  }
  // Any keywords shorter than 2 chars still need a scan.
  for (const keyword of index.multiWordShort) {
    if (!lower.includes(keyword)) continue
    const hits = index.multiWord.get(keyword)
    if (!hits) continue
    for (const hit of hits) {
      scores.set(hit.family, (scores.get(hit.family) ?? 0) + hit.weight)
    }
  }

  return scores
}

export async function selectStarter({
  prompt,
  partner = null,
}: {
  prompt: string
  partner?: string | null
}): Promise<SelectionResult> {
  const registry = await loadRegistry()
  const index = getIndex(registry)

  const scores = scoreAllFamilies(prompt, index)

  // Build candidates in registry iteration order (stable tie-break downstream)
  const candidates: Candidate[] = []
  for (const familyId of index.familyIds) {
    const score = scores.get(familyId) ?? 0
    candidates.push({
      family: familyId,
      layers: index.frameworkLayers.get(familyId) ?? [],
      score,
      reasons: score > 0 ? [`${familyId} matched`] : [],
    })
  }

  candidates.sort((left, right) => right.score - left.score)

  // Fuzzy fallback: when exact matching found nothing, try Levenshtein distance ≤ 1
  if (candidates[0]!.score === 0) {
    for (const candidate of candidates) {
      const familyManifest = registry.families.get(candidate.family)
      if (!familyManifest) continue
      // Fuzzy only against tier1 (framework names) — fuzzy on generic words
      // causes false positives like "lending" → "landing"
      const allKeywords = familyManifest.tieredKeywords?.tier1 ?? []
      if (allKeywords.length) {
        candidate.score = fuzzyKeywordScore(prompt, allKeywords)
      }
    }
    candidates.sort((left, right) => right.score - left.score)
  }

  // Semantic fallback: when keyword score is low, use embedding similarity
  // to find the best family match based on description understanding.
  // Only fires when the semantic router has been initialized (optional).
  // Semantic fallback only fires when keywords found NOTHING (score 0).
  // This prevents the embedding from overriding confident keyword matches.
  if (candidates[0]!.score === 0 && isSemanticRouterReady()) {
    const match = await semanticMatch(prompt)
    if (match && match.score > 0.55) {
      const semanticCandidate = candidates.find((c) => c.family === match.familyId)
      if (semanticCandidate) {
        // Boost the semantically-matched candidate so it wins
        semanticCandidate.score = Math.max(semanticCandidate.score, 8)
        semanticCandidate.reasons = [`semantic match: ${match.familyId} (${Math.round(match.score * 100)}% similarity)`]
        candidates.sort((left, right) => right.score - left.score)
      }
    }
  }

  const winner = candidates[0]!

  // Smart default: when no family scores, infer from prompt shape.
  // Product descriptions ("build a X with Y") → fullstack-ts (needs backend).
  // Static content requests → frontend-static.
  let defaultFamily = 'frontend-static'
  let defaultLayers = ['framework:web-static']
  if (winner.score === 0) {
    const lower = prompt.toLowerCase()
    const describesProduct = /\b(build|create|make|ship|launch|want|need|develop)\b/.test(lower) &&
      /\b(app|tool|platform|system|tracker|manager|dashboard|portal|service|bot|agent|clone|saas|mvp|product|store|storefront|shop|marketplace|builder|generator|assistant|analyzer|monitor|finder|scheduler|planner|viewer|editor|player|reader|browser|client|studio|hub|suite|kit|board|library|checker|gallery|frontend|engine|workflow|inbox|scorer|splitter|compiler|canvas|sequencer|tester|formatter|validator|log|logger|maker|community|list|test|quiz|scanner|scorecard|analytics|knowledge base|companion|advisor|tutor|optimizer|space|network|aggregator|launchpad|exchange)\b/.test(lower)
    const isStaticContent = /\b(landing page|portfolio|cv site|personal site|restaurant website|conference website)\b/.test(lower) && !/\b(ai|builder|generator|dynamic)\b/.test(lower)
    if (describesProduct && !isStaticContent) {
      defaultFamily = 'fullstack-ts'
      const fwLayers = index.frameworkLayers.get('fullstack-ts') ?? []
      defaultLayers = fwLayers.length > 0 ? fwLayers : ['framework:fullstack-node-ts']
    }
  }

  const family = winner.score > 0 ? winner.family : defaultFamily
  const layers = winner.score > 0 ? winner.layers : defaultLayers
  const confidence: Confidence = winner.score > 6 ? 'high' : winner.score > 0 ? 'medium' : 'low'
  const spec: ComposeSpec = {
    projectName: partner ? `${partner}-starter` : 'generated-starter',
    family,
    layers,
    partner,
    slots: {},
    variables: {},
  }

  if (partner === 'coinbase' && family === 'frontend-static') {
    spec.layers = [...layers, 'capability:chart-widget']
    spec.variables = { ...spec.variables, headline: 'Ship a Coinbase-ready product surface' }
  }

  if (
    partner === 'coinbase' &&
    (family === 'react-vite-ts' || family === 'nextjs-ts' || family === 'fullstack-ts' || family === 'x402-service')
  ) {
    spec.layers = [...new Set([...layers, 'capability:chart-widget'])]
    spec.variables = { ...spec.variables, headline: 'Ship a Coinbase-ready product surface' }
  }

  return {
    confidence,
    spec,
    fallbackUsed: winner.score === 0,
    reasons: winner.score > 0 ? winner.reasons : ['no confident match, using default frontend family'],
  }
}
