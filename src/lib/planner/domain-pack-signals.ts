import type { Registry } from '../../types.js'
import { scoreDomainPackFamilies } from '../domain-packs.js'
import { hasAny } from '../keywords.js'

const EVM_DOMAIN_RUNTIMES = new Set(['evm', 'foundry', 'hardhat'])

const DOMAIN_PACK_API_SURFACE_SIGNALS = [
  'api',
  'backend',
  'server',
  'endpoint',
  'webhook',
  'indexer',
  'monitor',
  'relayer',
  'bridge script',
  'env setup',
  'private_key env',
]

function isEvmDomainRuntime(runtime: string | undefined): boolean {
  return runtime ? EVM_DOMAIN_RUNTIMES.has(runtime.toLowerCase()) : false
}

function matchHasEvmDomain(
  match: { family: string; layers?: string[] },
  registry: Registry,
): boolean {
  const family = registry.families.get(match.family)
  if (family?.taxonomy?.surface === 'evm-infra') return true
  if (isEvmDomainRuntime(family?.domainPack?.domain.runtime ?? family?.taxonomy?.runtime)) {
    return true
  }

  for (const layerKey of match.layers ?? []) {
    const layer = registry.layers.get(layerKey)
    if (isEvmDomainRuntime(layer?.domainPack?.domain.runtime)) return true
  }

  return false
}

export function hasEvmDomainPackSupportApiSurface({
  prompt,
  partner,
  registry,
}: {
  prompt: string
  partner: string | null
  registry: Registry
}): boolean {
  const text = prompt.toLowerCase()
  if (!hasAny(text, DOMAIN_PACK_API_SURFACE_SIGNALS)) return false

  return scoreDomainPackFamilies({ prompt, partner, registry }).some((match) =>
    matchHasEvmDomain(match, registry),
  )
}
