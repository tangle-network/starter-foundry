import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { SelectionResult, Confidence, ComposeSpec, Registry, RoutingRisk } from '../types.js'

import { detectDomainPackAmbiguity, scoreDomainPackFamilies } from './domain-packs.js'
import { fuzzyKeywordScore } from './keywords.js'
import { loadRegistry } from './registry.js'
import { semanticMatch, isSemanticRouterReady } from './semantic-router.js'

const TEMPLATE_LIBRARY_DIR = '.evolve/template-library'

interface LibraryIndex {
  family: string
  current: string
  topN: string[]
}

/**
 * Pick a template-library version for `familyId`, optionally diverse-serving
 * from the top-N candidates when `STARTER_FOUNDRY_DIVERSE_SERVE=1` is set.
 *
 * Default behavior (env unset or 0): returns the `current` pointer from
 * `.evolve/template-library/<family>/_index.json`. Same version every call
 * — no behavior change vs today.
 *
 * Diverse-serve (env=1): hashes the project name (or any stable seed) into
 * a deterministic index within `topN`, so two different projects can land
 * on two different versions but the same project name always gets the same
 * version. Gives us production-grade A/B across the top-quality candidates
 * without per-user randomization breaking replay.
 *
 * Returns null when no `_index.json` exists (family isn't in the library
 * yet) so callers can fall through to the canonical `registry/layers/`
 * serve path unchanged.
 */
export function selectTemplateVersion(
  familyId: string,
  seed: string,
  opts: { repoRoot?: string; envDiverseServe?: string } = {},
): string | null {
  const repoRoot = opts.repoRoot ?? process.cwd()
  const indexPath = join(repoRoot, TEMPLATE_LIBRARY_DIR, familyId, '_index.json')
  if (!existsSync(indexPath)) return null

  let idx: LibraryIndex
  try {
    idx = JSON.parse(readFileSync(indexPath, 'utf8')) as LibraryIndex
  } catch {
    return null
  }

  const diverseServe = opts.envDiverseServe ?? process.env.STARTER_FOUNDRY_DIVERSE_SERVE
  if (diverseServe !== '1' && diverseServe !== 'true') return idx.current

  const candidates = idx.topN?.length ? idx.topN : [idx.current]
  if (candidates.length <= 1) return idx.current

  // SHA-256 of seed, take first 4 bytes as uint32, mod candidates.length.
  // Same seed → same pick; different seeds spread uniformly across topN.
  const hash = createHash('sha256').update(seed).digest()
  const bucket = hash.readUInt32BE(0) % candidates.length
  return candidates[bucket]
}

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
    keyword.includes(' ') || keyword.includes('.') || keyword.includes('/') || keyword.includes('-')
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
    const boost = family.scoring?.boost ?? {}

    for (const tier of [
      'tier1',
      'tier2',
      'tier3',
      'archetypes',
    ] as const satisfies readonly Tier[]) {
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
  // when the same keyword appears in multiple tiers of one family.
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

/**
 * Detect "technical identifier" shape: a kebab-case cluster of ≥2 hyphen-
 * separated tokens with no spaces and no natural-language verbs/articles.
 * This is what BA's H1 canonical-scaffold catalog feeds in (compiler-lexer-dfa,
 * algo-suffix-array-sais, todo-asyncstorage, godot-character-movement). Such
 * prompts that score 0 against all family keywords are UNROUTEABLE — refusing
 * to silently degrade is the resilient behavior.
 *
 * Returns true ONLY when ALL hold:
 *   - No whitespace (a real prompt has at least one space)
 *   - At least 2 hyphens (rules out single words like `bot` or `agent`)
 *   - All characters are [a-z0-9-] (no punctuation, no digits-only)
 *   - No natural-language stopwords (a, an, the, of, for, with, my, your)
 */
export function isTechnicalIdShape(prompt: string): boolean {
  const trimmed = prompt.trim()
  if (trimmed.length === 0) return false
  if (/\s/.test(trimmed)) return false
  const lower = trimmed.toLowerCase()
  if (!/^[a-z][a-z0-9-]*$/.test(lower)) return false
  const hyphens = (lower.match(/-/g) ?? []).length
  if (hyphens < 2) return false
  // No stopwords as standalone tokens — defends against rare natural-language
  // hyphenations like "state-of-the-art".
  const tokens = lower.split('-')
  const stopwords = new Set([
    'a',
    'an',
    'the',
    'of',
    'for',
    'with',
    'my',
    'your',
    'and',
    'or',
    'to',
    'in',
    'on',
  ])
  for (const t of tokens) {
    if (stopwords.has(t)) return false
  }
  return true
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
  const domainMatches = scoreDomainPackFamilies({ prompt, partner, registry })

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

  for (const match of domainMatches) {
    const candidate = candidates.find((item) => item.family === match.family)
    if (!candidate) continue
    candidate.score += match.score
    candidate.reasons.push(
      `domain-pack → ${match.family} (+${match.score}: ${match.reasons.join(', ')})`,
    )
  }

  candidates.sort((left, right) => right.score - left.score)

  // Fuzzy fallback: when exact matching found nothing, try Levenshtein distance ≤ 1
  if (candidates[0].score === 0) {
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
  if (candidates[0].score === 0 && isSemanticRouterReady()) {
    const match = await semanticMatch(prompt)
    if (match && match.score > 0.55) {
      const semanticCandidate = candidates.find((c) => c.family === match.familyId)
      if (semanticCandidate) {
        // Boost the semantically-matched candidate so it wins
        semanticCandidate.score = Math.max(semanticCandidate.score, 8)
        semanticCandidate.reasons = [
          `semantic match: ${match.familyId} (${Math.round(match.score * 100)}% similarity)`,
        ]
        candidates.sort((left, right) => right.score - left.score)
      }
    }
  }

  const winner = candidates[0]
  const domainAmbiguity = detectDomainPackAmbiguity(domainMatches)
  const activeDomainAmbiguity =
    domainAmbiguity && domainAmbiguity.families.includes(winner.family) ? domainAmbiguity : null

  // Resilient fallback (Gen 11.5 — replaces the silent frontend-static default).
  // When no family scores, classify the prompt shape:
  //   1. Product description ("build a X with Y") → fullstack-ts (safe to default)
  //   2. Static content request ("landing page", "portfolio") → frontend-static
  //   3. Technical identifier (kebab-case noun cluster, no verbs) → UNROUTEABLE.
  //      Refuse to silently degrade — the BA / caller has to disambiguate.
  //      Memory: 2026-04-25 BA H1 sweep had compiler-lexer-dfa,
  //      algo-suffix-array-sais bucketed as frontend-static + industry:saas.
  //      That's the muffled-gate pattern in routing form: a "fallback" that
  //      always-passes hides real coverage gaps.
  let defaultFamily = 'frontend-static'
  let defaultLayers = ['framework:web-static']
  let routingRisk: RoutingRisk
  let fallbackReason = ''
  let confidence: Confidence
  if (winner.score > 0) {
    confidence = activeDomainAmbiguity ? 'unknown' : winner.score > 6 ? 'high' : 'medium'
    routingRisk = activeDomainAmbiguity ? 'ambiguous' : 'safe'
  } else {
    const lower = prompt.toLowerCase()
    const describesProduct =
      /\b(build|create|make|ship|launch|want|need|develop)\b/.test(lower) &&
      /\b(app|tool|platform|system|tracker|manager|dashboard|portal|service|bot|agent|clone|saas|mvp|product|store|storefront|shop|marketplace|builder|generator|assistant|analyzer|monitor|finder|scheduler|planner|viewer|editor|player|reader|browser|client|studio|hub|suite|kit|board|library|checker|gallery|frontend|engine|workflow|inbox|scorer|splitter|compiler|canvas|sequencer|tester|formatter|validator|log|logger|maker|community|list|test|quiz|scanner|scorecard|analytics|knowledge base|companion|advisor|tutor|optimizer|space|network|aggregator|launchpad|exchange)\b/.test(
        lower,
      )
    const isStaticContent =
      /\b(landing page|portfolio|cv site|personal site|restaurant website|conference website)\b/.test(
        lower,
      ) && !/\b(ai|builder|generator|dynamic)\b/.test(lower)
    const isTechnicalIdentifier = isTechnicalIdShape(prompt)
    if (isTechnicalIdentifier) {
      // Refuse to silently route — caller must disambiguate.
      confidence = 'unknown'
      routingRisk = 'unrouteable'
      defaultFamily = 'frontend-static' // placeholder spec; caller should NOT use without checking routingRisk
      defaultLayers = ['framework:web-static']
      fallbackReason =
        `unrouteable: prompt "${prompt}" looks like a technical identifier (kebab-case noun cluster) ` +
        `and matched zero family keywords. Refusing to silently degrade to frontend-static. ` +
        `Caller must disambiguate — add tier1/tier2 keywords to the closest family, ` +
        `extend the registry with a new family, or pass a natural-language prompt instead.`
    } else if (describesProduct && !isStaticContent) {
      confidence = 'low'
      routingRisk = 'fallback-product'
      defaultFamily = 'fullstack-ts'
      const fwLayers = index.frameworkLayers.get('fullstack-ts') ?? []
      defaultLayers = fwLayers.length > 0 ? fwLayers : ['framework:fullstack-node-ts']
      fallbackReason =
        'no confident match; prompt shape suggests a product description, defaulting to fullstack-ts'
    } else {
      confidence = 'low'
      routingRisk = 'fallback-static'
      fallbackReason =
        'no confident match; defaulting to frontend-static (historical fallback — review if this looks wrong)'
    }
  }

  const family = winner.score > 0 ? winner.family : defaultFamily
  const layers = winner.score > 0 ? winner.layers : defaultLayers
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
    (family === 'react-vite-ts' ||
      family === 'nextjs-ts' ||
      family === 'fullstack-ts' ||
      family === 'x402-service')
  ) {
    spec.layers = [...new Set([...layers, 'capability:chart-widget'])]
    spec.variables = { ...spec.variables, headline: 'Ship a Coinbase-ready product surface' }
  }

  return {
    confidence,
    spec,
    fallbackUsed: winner.score === 0,
    reasons:
      winner.score > 0
        ? activeDomainAmbiguity
          ? [activeDomainAmbiguity.reason, ...winner.reasons]
          : winner.reasons
        : [fallbackReason],
    routingRisk,
  }
}
