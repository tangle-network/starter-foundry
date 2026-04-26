import { loadRegistry } from './registry.js'

const plannedFamilies: unknown[] = []

export async function buildCatalog(): Promise<{
  schemaVersion: 1
  implemented: {
    id: string
    status: 'implemented'
    language?: string
    runtime?: string
    surface?: string
    description: string
  }[]
  planned: unknown[]
  capabilityThemes: string[]
  databaseTargets: string[]
  cryptoTargets: string[]
}> {
  const registry = await loadRegistry()
  const implemented = [...registry.families.values()].map((family) => ({
    id: family.id,
    status: 'implemented' as const,
    ...(family.taxonomy ?? {}),
    description: family.description,
  }))

  return {
    schemaVersion: 1,
    implemented,
    planned: plannedFamilies,
    capabilityThemes: [
      'frontend',
      'mobile',
      'extension',
      'desktop',
      'automation',
      'cli',
      'ai',
      'backend',
      'worker',
      'edge',
      'data',
      'protocol',
      'infra',
      'database',
      'auth',
      'payments',
      'queue',
      'sdk',
      'crypto',
      'agents',
    ],
    databaseTargets: ['convex', 'sqlite', 'postgres', 'mongodb'],
    cryptoTargets: ['forge', 'solana', 'move'],
  }
}
