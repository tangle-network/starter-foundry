import { fuzzyKeywordScore, keywordScore, matchesKeyword } from './keywords.js'
import { loadRegistry } from './registry.js'
import type { SelectionResult, Confidence, ComposeSpec, FamilyManifest } from '../types.js'

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

function buildCandidatesFromRegistry(
  families: Map<string, FamilyManifest>,
  layers: Map<string, { group: string; id: string }>,
  prompt: string,
): Candidate[] {
  const candidates: Candidate[] = []

  for (const family of families.values()) {
    if (!family.keywords?.length) continue

    const fwLayers = frameworkLayersForFamily(family.id, layers)
    const score = keywordScore(prompt, family.keywords)

    candidates.push({
      family: family.id,
      layers: fwLayers,
      score,
      reasons: score > 0 ? [`${family.id} language detected`] : [],
    })
  }

  return candidates
}

function applyBoosts(candidates: Candidate[], prompt: string, lower: string): void {
  for (const candidate of candidates) {
    // Forge-specific boosts
    if (
      candidate.family === 'forge-contracts' &&
      (lower.includes('foundry') ||
        lower.includes('forge') ||
        lower.includes('foundry.toml') ||
        lower.includes('contract verification'))
    ) {
      candidate.score += 3
    }

    // Hardhat vs forge disambiguation
    if (candidate.family === 'hardhat-contracts' && lower.includes('hardhat')) {
      candidate.score += lower.includes('foundry') || lower.includes('forge') ? 0 : 4
    }
    if (
      candidate.family === 'forge-contracts' &&
      lower.includes('hardhat') &&
      !lower.includes('foundry') &&
      !lower.includes('forge')
    ) {
      candidate.score -= 3
    }

    // EVM infra penalty when contract-specific terms present
    if (
      candidate.family === 'evm-infra-ts' &&
      (lower.includes('foundry') ||
        lower.includes('forge') ||
        lower.includes('hardhat') ||
        lower.includes('solidity') ||
        lower.includes('erc20') ||
        lower.includes('erc721'))
    ) {
      candidate.score -= 2
    }
    if (
      candidate.family === 'evm-infra-ts' &&
      (lower.includes('block monitor') ||
        lower.includes('multicall') ||
        lower.includes('wallet balance') ||
        lower.includes('/stats'))
    ) {
      candidate.score += 2
    }

    // Agent framework boosts
    if (candidate.family === 'agent-service-ts' && (lower.includes('langgraph') || lower.includes('mastra'))) {
      candidate.score += 2
    }
    if (
      candidate.family === 'agent-service-py' &&
      (lower.includes('pydanticai') ||
        lower.includes('crewai') ||
        lower.includes('autogen') ||
        lower.includes('agno'))
    ) {
      candidate.score += 2
    }
    if (candidate.family === 'agent-service-rust' && matchesKeyword(prompt, 'rig')) {
      candidate.score += 3
    }

    // MCP/dspy/stylus beat agent when explicitly mentioned (agent keywords are very broad)
    if (candidate.family === 'mcp-server-ts' && (lower.includes('mcp') || lower.includes('model context protocol'))) {
      candidate.score += 4
    }
    if (candidate.family === 'dspy-pipeline-py' && lower.includes('dspy')) {
      candidate.score += 4
    }
    if (candidate.family === 'stylus-contracts' && lower.includes('stylus')) {
      candidate.score += 4
    }

    // Go worker boost
    if (candidate.family === 'go-worker' && (lower.includes('go worker') || lower.includes('golang worker'))) {
      candidate.score += 2
    }
    if (candidate.family === 'python-worker' && (lower.includes('python worker') || lower.includes('celery'))) {
      candidate.score += 2
    }

    // Language-specific API boosts when language co-occurs with API terms
    if (
      candidate.family === 'go-api' &&
      (matchesKeyword(prompt, 'go') || matchesKeyword(prompt, 'golang')) &&
      (lower.includes('api') || lower.includes('backend') || lower.includes('rest') || lower.includes('service'))
    ) {
      candidate.score += 3
    }
    if (
      candidate.family === 'python-api' &&
      (matchesKeyword(prompt, 'python') || lower.includes('fastapi') || lower.includes('flask') || lower.includes('django')) &&
      (lower.includes('api') || lower.includes('backend') || lower.includes('rest') || lower.includes('service'))
    ) {
      candidate.score += 3
    }
    if (
      candidate.family === 'rust-service' &&
      (matchesKeyword(prompt, 'rust') || lower.includes('axum')) &&
      (lower.includes('api') || lower.includes('backend') || lower.includes('service'))
    ) {
      candidate.score += 3
    }
    // Cloudflare boost when explicitly mentioned
    if (candidate.family === 'cloudflare-worker-ts' && lower.includes('cloudflare')) {
      candidate.score += 3
    }
    // Tauri beats electron when explicitly mentioned
    if (candidate.family === 'tauri-desktop' && lower.includes('tauri')) {
      candidate.score += 3
    }
    // Python data app boost for streamlit/gradio
    if (candidate.family === 'python-data-app' && (lower.includes('streamlit') || lower.includes('gradio'))) {
      candidate.score += 3
    }
  }
}

export async function selectStarter({
  prompt,
  partner = null,
}: {
  prompt: string
  partner?: string | null
}): Promise<SelectionResult> {
  const lower = prompt.toLowerCase()
  const registry = await loadRegistry()
  const candidates = buildCandidatesFromRegistry(registry.families, registry.layers, prompt)

  applyBoosts(candidates, prompt, lower)

  candidates.sort((left, right) => right.score - left.score)

  // Fuzzy fallback: when exact matching found nothing, try Levenshtein distance ≤ 1
  // on keywords ≥ 5 chars. Catches typos like "pytohn" → "python", "Nex.js" → "next.js"
  if (candidates[0]!.score === 0) {
    for (const candidate of candidates) {
      const familyManifest = registry.families.get(candidate.family)
      if (!familyManifest?.keywords?.length) continue
      candidate.score = fuzzyKeywordScore(prompt, familyManifest.keywords)
    }
    candidates.sort((left, right) => right.score - left.score)
    applyBoosts(candidates, prompt, lower)
    candidates.sort((left, right) => right.score - left.score)
  }

  const winner = candidates[0]!
  const family = winner.score > 0 ? winner.family : 'frontend-static'
  const layers = winner.score > 0 ? winner.layers : ['framework:web-static']
  const confidence: Confidence = winner.score > 2 ? 'high' : winner.score > 0 ? 'medium' : 'low'
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
