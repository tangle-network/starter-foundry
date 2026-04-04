import { fuzzyKeywordScore, keywordScore, matchesKeyword } from './keywords.js'
import { loadRegistry } from './registry.js'
import { semanticMatch, isSemanticRouterReady } from './semantic-router.js'
import type { SelectionResult, Confidence, ComposeSpec, FamilyManifest } from '../types.js'

const TIER_WEIGHTS = { tier1: 4, tier2: 2, tier3: 1, archetypes: 3 } as const

interface Candidate {
  family: string
  layers: string[]
  score: number
  reasons: string[]
}

function frameworkLayersForFamily(familyId: string, layers: Map<string, { group: string; id: string; appliesTo?: string[] }>): string[] {
  const result: string[] = []
  for (const [key, layer] of layers) {
    if (layer.group === 'framework' && layer.appliesTo?.includes(familyId)) {
      result.push(key)
    }
  }
  return result
}

/**
 * Score a prompt against a family's tiered keywords.
 * One pass, deterministic, traceable.
 */
function scoreFamilyTiered(prompt: string, family: FamilyManifest): number {
  const tk = family.tieredKeywords
  if (!tk) {
    // Fallback to flat keywords if tieredKeywords not present
    return family.keywords?.length ? keywordScore(prompt, family.keywords) : 0
  }

  let score = 0
  if (tk.tier1?.length) score += keywordScore(prompt, tk.tier1) * TIER_WEIGHTS.tier1
  if (tk.tier2?.length) score += keywordScore(prompt, tk.tier2) * TIER_WEIGHTS.tier2
  if (tk.tier3?.length) score += keywordScore(prompt, tk.tier3) * TIER_WEIGHTS.tier3
  if (tk.archetypes?.length) score += keywordScore(prompt, tk.archetypes) * TIER_WEIGHTS.archetypes
  return score
}

export async function selectStarter({
  prompt,
  partner = null,
}: {
  prompt: string
  partner?: string | null
}): Promise<SelectionResult> {
  const registry = await loadRegistry()

  // Score all families in one pass
  const candidates: Candidate[] = []
  for (const family of registry.families.values()) {
    const fwLayers = frameworkLayersForFamily(family.id, registry.layers)
    const score = scoreFamilyTiered(prompt, family)
    candidates.push({
      family: family.id,
      layers: fwLayers,
      score,
      reasons: score > 0 ? [`${family.id} matched`] : [],
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
      const allKeywords = [
        ...(familyManifest.tieredKeywords?.tier1 ?? []),
      ]
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
      const fwLayers = frameworkLayersForFamily('fullstack-ts', registry.layers)
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
