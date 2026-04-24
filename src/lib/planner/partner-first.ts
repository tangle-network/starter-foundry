// Partner-first routing helpers. When a buildout trace carries a partnerGuess
// (fintech-mixed, polymarket-prediction, coinbase-smart-wallet, tangle-network,
// deno, …), prefer a registry family whose manifest aligns with that partner
// over the generic nextjs-ts / api-service workspace default. Pure functions
// over the registry — no I/O, no LLM.

import type { Registry, FamilyManifest } from '../../types.js'

// Partner names in buildout traces are often hyphenated or compound
// (`tangle-network`, `polymarket-prediction`, `coinbase-smart-wallet`). Split
// them on `-` and normalise — a family is considered partner-aligned when its
// id, tags, keywords, or tieredKeywords tier1/tier2 reference ANY of the
// meaningful tokens from the partner name.
const GENERIC_TOKENS = new Set([
  'network', 'prediction', 'mixed', 'foundation', 'chain', 'l1',
  'mpc', 'perps', 'fhe', 'event', 'contracts', 'smart',
])

function partnerTokens(partner: string): string[] {
  const tokens = partner
    .toLowerCase()
    .split(/[-_/]/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !GENERIC_TOKENS.has(t))
  // Always retain the full partner slug — a family like `polymarket-portfolio-
  // hedging` matches the partner `polymarket-prediction` via its anchor token.
  const full = partner.toLowerCase().replace(/[-_/]/g, '')
  if (full.length >= 4) tokens.push(full)
  return [...new Set(tokens)]
}

// Explicit partner → anchor-token map for cases where the raw split loses
// signal (e.g. `ethereum-l1` → we want `ethereum` but the partner's natural
// alias in families is `evm`/`eth`/`ethereum`). Anchors extend, never replace,
// tokens derived from splitting.
const PARTNER_ANCHOR_TOKENS: Record<string, string[]> = {
  'tangle-network': ['tangle', 'agent'],
  'tangle-blueprints-mpc': ['tangle'],
  'ethereum-l1': ['evm', 'ethereum', 'forge'],
  'ethereum-foundation': ['evm', 'ethereum', 'forge'],
  'base-defi': ['evm', 'base'],
  'coinbase-base': ['evm', 'coinbase', 'base'],
  'coinbase-smart-wallet': ['coinbase', 'wallet'],
  'arbitrum-stylus': ['arbitrum', 'stylus'],
  'okx-xlayer': ['xlayer', 'evm'],
  'bnb-chain': ['bnb'],
  'fhenix-fhe': ['fhenix'],
  'hyperliquid-perps': ['hyperliquid'],
  'kalshi-event-contracts': ['kalshi'],
  'polymarket-prediction': ['polymarket'],
  'fintech-mixed': ['fintech', 'ledger'],
  'deno': ['deno'],
}

function familySignalTokens(fm: FamilyManifest): Set<string> {
  const out = new Set<string>()
  const push = (v: string | undefined) => {
    if (!v) return
    const lower = v.toLowerCase()
    for (const part of lower.split(/[-_\s]/)) {
      if (part.length >= 3) out.add(part)
    }
    if (lower.length >= 4) out.add(lower)
  }
  push(fm.id)
  for (const t of fm.tags ?? []) push(t)
  for (const k of fm.keywords ?? []) push(k)
  for (const k of fm.tieredKeywords?.tier1 ?? []) push(k)
  for (const k of fm.tieredKeywords?.tier2 ?? []) push(k)
  return out
}

interface PartnerFamilyMatch {
  familyId: string
  score: number
  surface: string
}

/**
 * Find registry families aligned to a partner, ranked by token-overlap score.
 * Surface is returned so callers can pick a frontend family for the web lane
 * vs a blueprint/agent family for protocol/agent lanes.
 */
export function findPartnerAlignedFamilies(
  partner: string | null,
  registry: Registry,
): PartnerFamilyMatch[] {
  if (!partner) return []
  const tokens = new Set<string>([
    ...partnerTokens(partner),
    ...(PARTNER_ANCHOR_TOKENS[partner.toLowerCase()] ?? []),
  ])
  if (tokens.size === 0) return []

  const matches: PartnerFamilyMatch[] = []
  for (const [id, fm] of registry.families) {
    const sig = familySignalTokens(fm)
    let score = 0
    for (const t of tokens) if (sig.has(t)) score += 1
    // Direct id substring match — strongest signal. Double-weight.
    for (const t of tokens) {
      if (t.length >= 4 && id.toLowerCase().includes(t)) score += 2
    }
    if (score > 0) {
      matches.push({ familyId: id, score, surface: fm.taxonomy?.surface ?? 'unknown' })
    }
  }
  matches.sort((a, b) => b.score - a.score)
  return matches
}

/** Pick the best partner-aligned FRONTEND family, if any. */
export function findPartnerAlignedFrontendFamily(
  partner: string | null,
  registry: Registry,
): string | null {
  const matches = findPartnerAlignedFamilies(partner, registry)
  for (const m of matches) {
    if (m.surface === 'frontend') return m.familyId
  }
  return null
}

/**
 * Decide whether partner-first routing should promote this prompt to a
 * partner-aligned workspace. Only fires when:
 *   - partner is present
 *   - ≥1 partner-aligned family exists in the registry
 *   - the aligned family has a score ≥2 (either direct id substring or
 *     multiple tag/keyword hits) — single tag coincidences are too noisy
 *
 * The second condition is the constraint narrowing: weak partner signals
 * (single-token overlap only) do NOT trigger the override, preserving the
 * current 28-scenario routing stability.
 */
export function shouldPromotePartnerFirst(
  partner: string | null,
  registry: Registry,
): { familyId: string; surface: string } | null {
  const matches = findPartnerAlignedFamilies(partner, registry)
  if (matches.length === 0) return null
  const best = matches[0]!
  if (best.score < 2) return null
  return { familyId: best.familyId, surface: best.surface }
}
